// src/controllers/gasto.controller.js

import GastoModel from "../models/gasto.model.js";

const METODOS_PAGO_VALIDOS = ["efectivo", "transferencia", "tarjeta", "otro"];

const GastoController = {
  // GET /gastos
  getAll: async (req, res, next) => {
    try {
      const gastos = await GastoModel.getAll(req.usuario_id);
      res.json({ success: true, data: gastos });
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const gasto = await GastoModel.getById(id, req.usuario_id);
      if (!gasto) return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      res.json({ success: true, data: gasto });
    } catch (err) { next(err); }
  },

  getByPeriodo: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;
      if (!desde || !hasta) return res.status(400).json({ success: false, error: "Los parámetros 'desde' y 'hasta' son requeridos." });
      const gastos = await GastoModel.getByPeriodo(desde, hasta, req.usuario_id);
      res.json({ success: true, data: gastos });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { descripcion, monto, categoria, metodo_pago } = req.body;
      if (!descripcion || monto === undefined) return res.status(400).json({ success: false, error: "descripcion y monto son requeridos." });
      if (monto < 0) return res.status(400).json({ success: false, error: "El monto no puede ser negativo." });
      if (metodo_pago && !METODOS_PAGO_VALIDOS.includes(metodo_pago)) {
        return res.status(400).json({ success: false, error: `metodo_pago debe ser uno de: ${METODOS_PAGO_VALIDOS.join(", ")}.` });
      }
      const gasto = await GastoModel.create({ descripcion, monto, categoria, metodo_pago, usuario_id: req.usuario_id });
      res.status(201).json({ success: true, data: gasto });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { descripcion, monto, categoria, metodo_pago } = req.body;
      if (!descripcion || monto === undefined) return res.status(400).json({ success: false, error: "descripcion y monto son requeridos." });
      if (monto < 0) return res.status(400).json({ success: false, error: "El monto no puede ser negativo." });
      if (metodo_pago && !METODOS_PAGO_VALIDOS.includes(metodo_pago)) {
        return res.status(400).json({ success: false, error: `metodo_pago debe ser uno de: ${METODOS_PAGO_VALIDOS.join(", ")}.` });
      }
      const gasto = await GastoModel.update(id, { descripcion, monto, categoria, metodo_pago }, req.usuario_id);
      if (!gasto) return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      res.json({ success: true, data: gasto });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await GastoModel.delete(id, req.usuario_id);
      if (!resultado) return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      res.json({ success: true, message: "Gasto eliminado correctamente." });
    } catch (err) { next(err); }
  },
};

export default GastoController;