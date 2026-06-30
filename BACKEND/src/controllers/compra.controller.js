// src/controllers/compra.controller.js
// Delega la lógica transaccional al service de compras

import CompraModel from "../models/compra.model.js";
import CompraService from "../services/compra.service.js";

const CompraController = {
  // GET /compras
  getAll: async (req, res, next) => {
    try {
      const compras = await CompraModel.getAll(req.usuario_id);
      res.json({ success: true, data: compras });
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const compra = await CompraModel.getById(id, req.usuario_id);
      if (!compra) return res.status(404).json({ success: false, error: "Compra no encontrada." });
      res.json({ success: true, data: compra });
    } catch (err) { next(err); }
  },

  // POST /compras
  // Body esperado: { proveedor_id?, observaciones?, items: [{ producto_id, cantidad, precio_unitario }] }
  create: async (req, res, next) => {
    try {
      const { proveedor_id, observaciones, items } = req.body;
      const compra = await CompraService.crearCompra({
        proveedor_id, observaciones, items,
        usuario_id: req.usuario_id,
      });
      res.status(201).json({ success: true, data: compra });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { proveedor_id, observaciones, items } = req.body;
      const compra = await CompraService.editarCompra(id, {
        proveedor_id, observaciones, items,
        usuario_id: req.usuario_id,
      });
      res.json({ success: true, data: compra });
    } catch (err) { next(err); }
  },
};

export default CompraController;