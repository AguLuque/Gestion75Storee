import CuentaPorPagarModel from "../models/cuentaPorPagar.model.js";
import CuentaPorPagarService from "../services/cuentaPorPagar.service.js";

const CuentaPorPagarController = {
  getAll: async (req, res, next) => {
    try {
      const cuentas = await CuentaPorPagarModel.getAll(req.usuario_id);
      res.json({ success: true, data: cuentas });
    } catch (err) { next(err); }
  },

  registrarPago: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { monto, cuenta_dinero_id } = req.body;
      const actualizada = await CuentaPorPagarService.registrarPago(id, { monto, cuenta_dinero_id }, req.usuario_id);
      res.status(201).json({ success: true, data: actualizada });
    } catch (err) { next(err); }
  },
};

export default CuentaPorPagarController;
