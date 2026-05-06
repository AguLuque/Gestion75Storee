// src/controllers/proveedor.controller.js

import ProveedorModel from "../models/proveedor.model.js";

const ProveedorController = {
  // GET /proveedores
  getAll: async (req, res, next) => {
    try {
      const proveedores = await ProveedorModel.getAll();
      res.json({ success: true, data: proveedores });
    } catch (err) {
      next(err);
    }
  },

  // GET /proveedores/:id
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const proveedor = await ProveedorModel.getById(id);

      if (!proveedor) {
        return res.status(404).json({ success: false, error: "Proveedor no encontrado." });
      }

      res.json({ success: true, data: proveedor });
    } catch (err) {
      next(err);
    }
  },

  // GET /proveedores/:id/compras
  getCompras: async (req, res, next) => {
    try {
      const { id } = req.params;
      const compras = await ProveedorModel.getCompras(id);
      res.json({ success: true, data: compras });
    } catch (err) {
      next(err);
    }
  },

  // POST /proveedores
  create: async (req, res, next) => {
    try {
      const { nombre, contacto, observaciones } = req.body;

      if (!nombre) {
        return res.status(400).json({ success: false, error: "El nombre es requerido." });
      }

      const proveedor = await ProveedorModel.create({ nombre, contacto, observaciones });
      res.status(201).json({ success: true, data: proveedor });
    } catch (err) {
      next(err);
    }
  },

  // PUT /proveedores/:id
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nombre, contacto, observaciones } = req.body;

      if (!nombre) {
        return res.status(400).json({ success: false, error: "El nombre es requerido." });
      }

      const proveedor = await ProveedorModel.update(id, { nombre, contacto, observaciones });

      if (!proveedor) {
        return res.status(404).json({ success: false, error: "Proveedor no encontrado." });
      }

      res.json({ success: true, data: proveedor });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /proveedores/:id
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await ProveedorModel.delete(id);

      if (!resultado) {
        return res.status(404).json({ success: false, error: "Proveedor no encontrado." });
      }

      res.json({ success: true, message: "Proveedor eliminado correctamente." });
    } catch (err) {
      next(err);
    }
  },
};

export default ProveedorController;