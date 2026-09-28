import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import CuentaPorCobrarService from "../services/cuentaPorCobrar.service.js";

const CuentaPorCobrarController = {
  getAll: async (req, res, next) => {
    try {
      const cuentas = await CuentaPorCobrarModel.getAll(req.usuario_id);
      res.json({ success: true, data: cuentas });
    } catch (err) { next(err); }
  },

  // POST /cuentas-por-cobrar — deuda manual (sin venta)
  crearManual: async (req, res, next) => {
    try {
      const { cliente_nombre, monto, fecha_vencimiento, observaciones } = req.body;
      const cxc = await CuentaPorCobrarService.crearManual({ cliente_nombre, monto, fecha_vencimiento, observaciones }, req.usuario_id);
      res.status(201).json({ success: true, data: cxc });
    } catch (err) { next(err); }
  },

  // PUT /cuentas-por-cobrar/:id — solo deudas manuales
  editarManual: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { cliente_nombre, monto, fecha_vencimiento, observaciones } = req.body;
      const cxc = await CuentaPorCobrarService.editarManual(id, { cliente_nombre, monto, fecha_vencimiento, observaciones }, req.usuario_id);
      res.json({ success: true, data: cxc });
    } catch (err) { next(err); }
  },

  // DELETE /cuentas-por-cobrar/:id — anula una deuda manual sin cobros
  anularManual: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await CuentaPorCobrarService.anularManual(id, req.usuario_id);
      res.json({ success: true, data: resultado });
    } catch (err) { next(err); }
  },

  registrarCobro: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { monto, cuenta_dinero_id } = req.body;
      const actualizada = await CuentaPorCobrarService.registrarCobro(id, { monto, cuenta_dinero_id }, req.usuario_id);
      res.status(201).json({ success: true, data: actualizada });
    } catch (err) { next(err); }
  },
};

export default CuentaPorCobrarController;
