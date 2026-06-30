import VentaModel from "../models/venta.model.js";
import VentaService from "../services/venta.service.js";

const VentaController = {
  // GET /ventas
  getAll: async (req, res, next) => {
    try {
      const ventas = await VentaModel.getAll(req.usuario_id);
      res.json({ success: true, data: ventas });
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const venta = await VentaModel.getById(id, req.usuario_id);
      if (!venta) return res.status(404).json({ success: false, error: "Venta no encontrada." });
      res.json({ success: true, data: venta });
    } catch (err) { next(err); }
  },

  getByPeriodo: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;
      if (!desde || !hasta) return res.status(400).json({ success: false, error: "Los parámetros 'desde' y 'hasta' son requeridos." });
      const ventas = await VentaModel.getByPeriodo(desde, hasta, req.usuario_id);
      res.json({ success: true, data: ventas });
    } catch (err) { next(err); }
  },


  // POST /ventas
  // Body esperado: { tipo: 'minorista'|'mayorista', observaciones?, items: [{ producto_id, cantidad }] }
  create: async (req, res, next) => {
    try {
      const { tipo, observaciones, items } = req.body;
      const venta = await VentaService.crearVenta({ tipo, observaciones, items, usuario_id: req.usuario_id });
      res.status(201).json({ success: true, data: venta });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await VentaModel.delete(id, req.usuario_id);
      if (!resultado) return res.status(404).json({ success: false, error: "Venta no encontrada o ya fue eliminada." });
      res.json({ success: true, message: `Venta del ${new Date(resultado.fecha).toLocaleDateString('es-AR')} por $${resultado.total} eliminada correctamente.` });
    } catch (err) { next(err); }
  },
};

export default VentaController;