// src/controllers/variante.controller.js

import VarianteModel from "../models/variante.model.js";

const VarianteController = {
  // GET /productos/:producto_id/variantes
  getByProducto: async (req, res, next) => {
    try {
      const { producto_id } = req.params;
      const variantes = await VarianteModel.getByProducto(producto_id, req.usuario_id);
      res.json({ success: true, data: variantes });
    } catch (err) {
      next(err);
    }
  },

  // GET /variantes/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const variante = await VarianteModel.getById(id, req.usuario_id);

      if (!variante) {
        return res.status(404).json({ success: false, error: "Variante no encontrada." });
      }

      res.json({ success: true, data: variante });
    } catch (err) {
      next(err);
    }
  },

  // POST /productos/:producto_id/variantes
  // Body: { talle, color, stock_actual, precio_extra }
  create: async (req, res, next) => {
    try {
      const { producto_id } = req.params;
      const { talle, color, stock_actual, precio_extra } = req.body;

      // Al menos talle o color son requeridos para identificar la variante
      if (!talle && !color) {
        return res.status(400).json({
          success: false,
          error: "Debe especificar al menos un talle o un color para la variante.",
        });
      }

      const variante = await VarianteModel.create({
        producto_id,
        talle,
        color,
        stock_actual,
        precio_extra,
        usuario_id: req.usuario_id,
      });

      if (!variante) {
        return res.status(404).json({ success: false, error: "Producto no encontrado." });
      }

      res.status(201).json({ success: true, data: variante });
    } catch (err) {
      next(err);
    }
  },

  // PUT /variantes/:id
  // Edita talle, color y precio_extra (no el stock — ese se maneja aparte)
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { talle, color, precio_extra } = req.body;

      if (!talle && !color) {
        return res.status(400).json({
          success: false,
          error: "Debe especificar al menos un talle o un color.",
        });
      }

      const variante = await VarianteModel.update(id, { talle, color, precio_extra }, req.usuario_id);

      if (!variante) {
        return res.status(404).json({ success: false, error: "Variante no encontrada." });
      }

      res.json({ success: true, data: variante });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /variantes/:id/stock — ajuste manual de stock
  updateStock: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { stock_actual } = req.body;

      if (stock_actual === undefined || stock_actual === null) {
        return res.status(400).json({ success: false, error: "stock_actual es requerido." });
      }

      if (stock_actual < 0) {
        return res.status(400).json({ success: false, error: "El stock no puede ser negativo." });
      }

      const variante = await VarianteModel.updateStockManual(id, stock_actual, req.usuario_id);

      if (!variante) {
        return res.status(404).json({ success: false, error: "Variante no encontrada." });
      }

      res.json({ success: true, data: variante });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /variantes/:id
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await VarianteModel.delete(id, req.usuario_id);

      if (!resultado) {
        return res.status(404).json({ success: false, error: "Variante no encontrada." });
      }

      const label = [resultado.talle, resultado.color].filter(Boolean).join(" / ");
      res.json({
        success: true,
        message: `La variante "${label}" fue eliminada correctamente.`,
      });
    } catch (err) {
      next(err);
    }
  },
};

export default VarianteController;