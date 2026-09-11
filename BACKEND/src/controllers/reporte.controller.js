// src/controllers/reporte.controller.js
import ReporteModel from "../models/reporte.model.js";

const validarPeriodo = (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) {
    res.status(400).json({ success: false, error: "Los parámetros 'desde' y 'hasta' son requeridos." });
    return null;
  }
  return { desde, hasta };
};

const ReporteController = {
  getResumen: async (req, res, next) => {
    try {
      const periodo = validarPeriodo(req, res);
      if (!periodo) return;
      const data = await ReporteModel.getResumen(periodo.desde, periodo.hasta, req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getEstadoResultados: async (req, res, next) => {
    try {
      const periodo = validarPeriodo(req, res);
      if (!periodo) return;
      const data = await ReporteModel.getEstadoResultados(periodo.desde, periodo.hasta, req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getBalance: async (req, res, next) => {
    try {
      const data = await ReporteModel.getBalance(req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getFlujoCaja: async (req, res, next) => {
    try {
      const periodo = validarPeriodo(req, res);
      if (!periodo) return;
      const data = await ReporteModel.getFlujoCaja(periodo.desde, periodo.hasta, req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};

export default ReporteController;
