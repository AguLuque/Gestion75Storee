// src/controllers/venta.controller.js
// Delega la lógica transaccional al service de ventas

import VentaModel from "../models/venta.model.js";
import VentaService from "../services/venta.service.js";

const VentaController = {
  // GET /ventas
  getAll: async (req, res, next) => {
    try {
      const ventas = await VentaModel.getAll();
      res.json({ success: true, data: ventas });
    } catch (err) {
      next(err);
    }
  },

  // GET /ventas/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const venta = await VentaModel.getById(id);

      if (!venta) {
        return res.status(404).json({ success: false, error: "Venta no encontrada." });
      }

      res.json({ success: true, data: venta });
    } catch (err) {
      next(err);
    }
  },

  // GET /ventas/periodo?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  getByPeriodo: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;

      if (!desde || !hasta) {
        return res.status(400).json({
          success: false,
          error: "Los parámetros 'desde' y 'hasta' son requeridos (formato: YYYY-MM-DD).",
        });
      }

      const ventas = await VentaModel.getByPeriodo(desde, hasta);
      res.json({ success: true, data: ventas });
    } catch (err) {
      next(err);
    }
  },

  // POST /ventas
  // Body esperado: { tipo: 'minorista'|'mayorista', observaciones?, items: [{ producto_id, cantidad }] }
  create: async (req, res, next) => {
    try {
      const { tipo, observaciones, items } = req.body;

      const venta = await VentaService.crearVenta({ tipo, observaciones, items });

      res.status(201).json({ success: true, data: venta });
    } catch (err) {
      next(err);
    }
  },
};

export default VentaController;