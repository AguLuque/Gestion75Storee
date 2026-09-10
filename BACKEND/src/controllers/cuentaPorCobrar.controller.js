import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import CuentaPorCobrarService from "../services/cuentaPorCobrar.service.js";

const CuentaPorCobrarController = {
  getAll: async (req, res, next) => {
    try {
      const cuentas = await CuentaPorCobrarModel.getAll(req.usuario_id);
      res.json({ success: true, data: cuentas });
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
