// src/controllers/compra.controller.js
// Delega la lógica transaccional al service de compras

import CompraModel from "../models/compra.model.js";
import CompraService from "../services/compra.service.js";
import { leerRangoFechas } from "../utils/fechas.js";

const CompraController = {
  // GET /compras?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (opcionales)
  getAll: async (req, res, next) => {
    try {
      const compras = await CompraModel.getAll(req.usuario_id, leerRangoFechas(req.query));
      res.json({ success: true, data: compras });
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const compra = await CompraModel.getById(id, req.usuario_id);
      if (!compra) return res.status(404).json({ success: false, error: "Compra no encontrada." });
      res.json({ success: true, data: compra });
    } catch (err) { next(err); }
  },

  // POST /compras
  // Body esperado: { proveedor_id?, observaciones?, costo_envio?, reparto_envio? ("valor" | "unidad" | "peso"),
  //   items: [{ producto_id, cantidad, precio_unitario, peso? }] }
  create: async (req, res, next) => {
    try {
      const { proveedor_id, observaciones, tipo, costo_envio, reparto_envio, cuenta_dinero_id, estado_pago, items } = req.body;
      const compra = await CompraService.crearCompra({
        proveedor_id, observaciones, tipo, costo_envio, reparto_envio, cuenta_dinero_id, estado_pago, items,
        usuario_id: req.usuario_id,
      });
      res.status(201).json({ success: true, data: compra });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { proveedor_id, observaciones, tipo, costo_envio, reparto_envio, cuenta_dinero_id, items } = req.body;
      const compra = await CompraService.editarCompra(id, {
        proveedor_id, observaciones, tipo, costo_envio, reparto_envio, cuenta_dinero_id, items,
        usuario_id: req.usuario_id,
      });
      res.json({ success: true, data: compra });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await CompraService.eliminarCompra(id, req.usuario_id);
      res.json({ success: true, message: `Compra del ${new Date(resultado.fecha).toLocaleDateString('es-AR')} por $${resultado.total} eliminada correctamente.` });
    } catch (err) { next(err); }
  },
};

export default CompraController;