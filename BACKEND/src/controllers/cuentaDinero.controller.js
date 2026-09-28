import CuentaDineroModel from "../models/cuentaDinero.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import { fechaArgentina } from "../utils/fechas.js";

const TIPOS_VALIDOS = ["efectivo", "banco", "billetera_virtual", "otro"];

const CuentaDineroController = {
  getAll: async (req, res, next) => {
    try {
      const cuentas = await CuentaDineroModel.getAll(req.usuario_id);
      res.json({ success: true, data: cuentas });
    } catch (err) { next(err); }
  },

  getSaldo: async (req, res, next) => {
    try {
      const { id } = req.params;
      const saldo = await CuentaDineroModel.getSaldo(id, req.usuario_id);
      if (saldo === null) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });
      res.json({ success: true, data: { saldo } });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { nombre, tipo, saldo_inicial } = req.body;
      if (!nombre || !tipo) return res.status(400).json({ success: false, error: "nombre y tipo son requeridos." });
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}.` });
      }
      const cuenta = await CuentaDineroModel.create({ nombre, tipo, saldo_inicial, usuario_id: req.usuario_id });
      res.status(201).json({ success: true, data: cuenta });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nombre, tipo } = req.body;
      if (!nombre || !tipo) return res.status(400).json({ success: false, error: "nombre y tipo son requeridos." });
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}.` });
      }
      const cuenta = await CuentaDineroModel.update(id, { nombre, tipo }, req.usuario_id);
      if (!cuenta) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });
      res.json({ success: true, data: cuenta });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await CuentaDineroModel.delete(id, req.usuario_id);
      if (!resultado) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });
      res.json({ success: true, message: "Cuenta eliminada correctamente." });
    } catch (err) { next(err); }
  },

  crearAjuste: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { monto, tipo, descripcion } = req.body;
      if (!monto || monto <= 0) return res.status(400).json({ success: false, error: "monto debe ser mayor a 0." });
      if (!["ingreso", "egreso"].includes(tipo)) {
        return res.status(400).json({ success: false, error: "tipo debe ser 'ingreso' o 'egreso'." });
      }
      const cuenta = await CuentaDineroModel.getById(id, req.usuario_id);
      if (!cuenta) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });

      const movimiento = await MovimientoFinancieroModel.create({
        fecha: fechaArgentina(),
        tipo, categoria: "ajuste_manual", monto,
        cuenta_dinero_id: id, origen_tipo: "ajuste_manual",
        descripcion: descripcion || "Ajuste manual de saldo",
        usuario_id: req.usuario_id,
      });
      res.status(201).json({ success: true, data: movimiento });
    } catch (err) { next(err); }
  },
};

export default CuentaDineroController;
