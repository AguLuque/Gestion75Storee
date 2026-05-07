// src/controllers/producto.controller.js
// Maneja las peticiones HTTP para el recurso productos
// Delega la lógica de datos al modelo y responde con los códigos HTTP correctos

import ProductoModel from "../models/producto.model.js";

const ProductoController = {
  // GET /productos
  getAll: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getAll();
      res.json({ success: true, data: productos });
    } catch (err) {
      next(err);
    }
  },

  // GET /productos/bajo-stock
  getBajoStock: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getBajoStock();
      res.json({ success: true, data: productos });
    } catch (err) {
      next(err);
    }
  },

  // GET /productos/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const producto = await ProductoModel.getById(id);

      if (!producto) {
        return res.status(404).json({ success: false, error: "Producto no encontrado." });
      }

      res.json({ success: true, data: producto });
    } catch (err) {
      next(err);
    }
  },

  // GET /productos/sin-stock
  getSinStock: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getSinStock();
      res.json({ success: true, data: productos });
    } catch (err) {
      next(err);
    }
  },

  // GET /productos/bajo-stock
  getBajoStock: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getBajoStock();
      res.json({ success: true, data: productos });
    } catch (err) {
      next(err);
    }
  },

  // POST /productos
  create: async (req, res, next) => {
    try {
      const { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, stock_minimo } = req.body;

      // Validaciones básicas
      if (!nombre || !precio_minorista || !precio_mayorista) {
        return res.status(400).json({
          success: false,
          error: "nombre, precio_minorista y precio_mayorista son requeridos.",
        });
      }

      const producto = await ProductoModel.create({
        nombre,
        categoria_id,
        precio_minorista,
        precio_mayorista,
        precio_compra,
        stock_actual,
        stock_minimo,
      });

      res.status(201).json({ success: true, data: producto });
    } catch (err) {
      next(err);
    }
  },

  // PUT /productos/:id
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_minimo } = req.body;

      if (!nombre || !precio_minorista || !precio_mayorista) {
        return res.status(400).json({
          success: false,
          error: "nombre, precio_minorista y precio_mayorista son requeridos.",
        });
      }

      const producto = await ProductoModel.update(id, {
        nombre,
        categoria_id,
        precio_minorista,
        precio_mayorista,
        precio_compra,
        stock_minimo,
      });

      if (!producto) {
        return res.status(404).json({ success: false, error: "Producto no encontrado." });
      }

      res.json({ success: true, data: producto });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /productos/:id/stock
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

      const producto = await ProductoModel.updateStockManual(id, stock_actual);

      if (!producto) {
        return res.status(404).json({ success: false, error: "Producto no encontrado." });
      }

      res.json({ success: true, data: producto });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /productos/:id
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await ProductoModel.delete(id);

      if (!resultado) {
        return res.status(404).json({ success: false, error: "Producto no encontrado." });
      }

      res.json({ success: true, message: "Producto eliminado correctamente." });
    } catch (err) {
      next(err);
    }
  },
};

export default ProductoController;