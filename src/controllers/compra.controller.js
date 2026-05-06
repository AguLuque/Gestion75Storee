// src/controllers/compra.controller.js
// Delega la lógica transaccional al service de compras

import CompraModel from "../models/compra.model.js";
import CompraService from "../services/compra.service.js";

const CompraController = {
  // GET /compras
  getAll: async (req, res, next) => {
    try {
      const compras = await CompraModel.getAll();
      res.json({ success: true, data: compras });
    } catch (err) {
      next(err);
    }
  },

  // GET /compras/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const compra = await CompraModel.getById(id);

      if (!compra) {
        return res.status(404).json({ success: false, error: "Compra no encontrada." });
      }

      res.json({ success: true, data: compra });
    } catch (err) {
      next(err);
    }
  },

  // POST /compras
  // Body esperado: { proveedor_id?, observaciones?, items: [{ producto_id, cantidad, precio_unitario }] }
  create: async (req, res, next) => {
    try {
      const { proveedor_id, observaciones, items } = req.body;

      const compra = await CompraService.crearCompra({ proveedor_id, observaciones, items });

      res.status(201).json({ success: true, data: compra });
    } catch (err) {
      // Los errores con status custom (400, 404) vienen del service
      next(err);
    }
  },
};

export default CompraController;