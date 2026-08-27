// src/controllers/producto.controller.js
import ProductoModel from "../models/producto.model.js";

const ProductoController = {
  // GET /productos
  getAll: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getAll(req.usuario_id);
      res.json({ success: true, data: productos });
    } catch (err) { next(err); }
  },

  getSinStock: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getSinStock(req.usuario_id);
      res.json({ success: true, data: productos });
    } catch (err) { next(err); }
  },

  getBajoStock: async (req, res, next) => {
    try {
      const productos = await ProductoModel.getBajoStock(req.usuario_id);
      res.json({ success: true, data: productos });
    } catch (err) { next(err); }
  },


  // GET /productos/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const producto = await ProductoModel.getById(id, req.usuario_id);
      if (!producto) return res.status(404).json({ success: false, error: "Producto no encontrado." });
      res.json({ success: true, data: producto });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual } = req.body;
      if (!nombre || !precio_minorista) {
        return res.status(400).json({ success: false, error: "nombre y precio_minorista son requeridos." });
      }
      if (precio_mayorista !== undefined && precio_mayorista !== null && precio_mayorista !== '' && Number(precio_mayorista) < 0) {
        return res.status(400).json({ success: false, error: "El precio mayorista no puede ser negativo." });
      }
      const producto = await ProductoModel.create({
        nombre, categoria_id, precio_minorista, precio_mayorista: precio_mayorista || null, precio_compra, stock_actual,
        usuario_id: req.usuario_id,
      });
      res.status(201).json({ success: true, data: producto });
    } catch (err) { next(err); }
  },

  // PUT /productos/:id
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual } = req.body;
      if (!nombre || !precio_minorista) {
        return res.status(400).json({ success: false, error: "nombre y precio_minorista son requeridos." });
      }
      if (precio_mayorista !== undefined && precio_mayorista !== null && precio_mayorista !== '' && Number(precio_mayorista) < 0) {
        return res.status(400).json({ success: false, error: "El precio mayorista no puede ser negativo." });
      }
      const producto = await ProductoModel.update(id, {
        nombre, categoria_id, precio_minorista, precio_mayorista: precio_mayorista || null, precio_compra, stock_actual,
      }, req.usuario_id);
      if (!producto) return res.status(404).json({ success: false, error: "Producto no encontrado." });
      res.json({ success: true, data: producto });
    } catch (err) { next(err); }
  },

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
      const producto = await ProductoModel.updateStockManual(id, stock_actual, req.usuario_id);
      if (!producto) return res.status(404).json({ success: false, error: "Producto no encontrado." });
      res.json({ success: true, data: producto });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await ProductoModel.delete(id, req.usuario_id);
      if (!resultado) return res.status(404).json({ success: false, error: "Producto no encontrado o ya fue desactivado." });
      res.json({ success: true, message: `El producto "${resultado.nombre}" fue desactivado correctamente.` });
    } catch (err) { next(err); }
  },
};

export default ProductoController;