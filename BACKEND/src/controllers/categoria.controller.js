// src/controllers/categoria.controller.js

import CategoriaModel from "../models/categoria.model.js";

const CategoriaController = {
  // GET /categorias
  getAll: async (req, res, next) => {
    try {
      const categorias = await CategoriaModel.getAll();
      res.json({ success: true, data: categorias });
    } catch (err) {
      next(err);
    }
  },

  // GET /categorias/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const categoria = await CategoriaModel.getById(id);

      if (!categoria) {
        return res.status(404).json({ success: false, error: "Categoría no encontrada." });
      }

      res.json({ success: true, data: categoria });
    } catch (err) {
      next(err);
    }
  },

  // POST /categorias
  create: async (req, res, next) => {
    try {
      const { nombre } = req.body;

      if (!nombre) {
        return res.status(400).json({ success: false, error: "El nombre es requerido." });
      }

      const categoria = await CategoriaModel.create({ nombre });
      res.status(201).json({ success: true, data: categoria });
    } catch (err) {
      next(err);
    }
  },

  // PUT /categorias/:id
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nombre } = req.body;

      if (!nombre) {
        return res.status(400).json({ success: false, error: "El nombre es requerido." });
      }

      const categoria = await CategoriaModel.update(id, { nombre });

      if (!categoria) {
        return res.status(404).json({ success: false, error: "Categoría no encontrada." });
      }

      res.json({ success: true, data: categoria });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /categorias/:id
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await CategoriaModel.delete(id);

      if (!resultado) {
        return res.status(404).json({ success: false, error: "Categoría no encontrada." });
      }

      res.json({ success: true, message: "Categoría eliminada correctamente." });
    } catch (err) {
      next(err);
    }
  },
};

export default CategoriaController;