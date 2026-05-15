import DeudorModel from "../models/deudor.model.js";

const DeudorController = {
  getAll: async (req, res, next) => {
    try {
      const deudores = await DeudorModel.getAll();
      res.json({ success: true, data: deudores });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { nombre, monto, plazo, observaciones } = req.body;
      if (!nombre || !monto) {
        return res.status(400).json({ success: false, error: "Nombre y monto son requeridos." });
      }
      const deudor = await DeudorModel.create({ nombre, monto, plazo, observaciones });
      res.status(201).json({ success: true, data: deudor });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const deudor = await DeudorModel.update(id, req.body);
      if (!deudor) return res.status(404).json({ success: false, error: "Deudor no encontrado." });
      res.json({ success: true, data: deudor });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const deudor = await DeudorModel.delete(id);
      if (!deudor) return res.status(404).json({ success: false, error: "Deudor no encontrado." });
      res.json({ success: true, data: deudor });
    } catch (err) { next(err); }
  },
};

export default DeudorController;