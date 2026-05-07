// src/controllers/gasto.controller.js

import GastoModel from "../models/gasto.model.js";

const GastoController = {
  // GET /gastos
  getAll: async (req, res, next) => {
    try {
      const gastos = await GastoModel.getAll();
      res.json({ success: true, data: gastos });
    } catch (err) {
      next(err);
    }
  },

  // GET /gastos/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const gasto = await GastoModel.getById(id);

      if (!gasto) {
        return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      }

      res.json({ success: true, data: gasto });
    } catch (err) {
      next(err);
    }
  },

  // GET /gastos/periodo?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  getByPeriodo: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;

      if (!desde || !hasta) {
        return res.status(400).json({
          success: false,
          error: "Los parámetros 'desde' y 'hasta' son requeridos (formato: YYYY-MM-DD).",
        });
      }

      const gastos = await GastoModel.getByPeriodo(desde, hasta);
      res.json({ success: true, data: gastos });
    } catch (err) {
      next(err);
    }
  },

  // POST /gastos
  create: async (req, res, next) => {
    try {
      const { descripcion, monto, categoria } = req.body;

      if (!descripcion || monto === undefined) {
        return res.status(400).json({
          success: false,
          error: "descripcion y monto son requeridos.",
        });
      }

      if (monto < 0) {
        return res.status(400).json({
          success: false,
          error: "El monto no puede ser negativo.",
        });
      }

      const gasto = await GastoModel.create({ descripcion, monto, categoria });
      res.status(201).json({ success: true, data: gasto });
    } catch (err) {
      next(err);
    }
  },

  // PUT /gastos/:id
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { descripcion, monto, categoria } = req.body;

      if (!descripcion || monto === undefined) {
        return res.status(400).json({
          success: false,
          error: "descripcion y monto son requeridos.",
        });
      }

      const gasto = await GastoModel.update(id, { descripcion, monto, categoria });

      if (!gasto) {
        return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      }

      res.json({ success: true, data: gasto });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /gastos/:id
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await GastoModel.delete(id);

      if (!resultado) {
        return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      }

      res.json({ success: true, message: "Gasto eliminado correctamente." });
    } catch (err) {
      next(err);
    }
  },
};

export default GastoController;