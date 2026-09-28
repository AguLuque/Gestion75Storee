// src/controllers/gasto.controller.js

import GastoModel from "../models/gasto.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import { normalizarCategoriaGasto } from "../constants/finanzas.js";
import GastoService from "../services/gasto.service.js";

const METODOS_PAGO_VALIDOS = ["efectivo", "transferencia", "tarjeta", "otro"];

const GastoController = {
  // GET /gastos
  getAll: async (req, res, next) => {
    try {
      const gastos = await GastoModel.getAll(req.usuario_id);
      res.json({ success: true, data: gastos });
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const gasto = await GastoModel.getById(id, req.usuario_id);
      if (!gasto) return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      res.json({ success: true, data: gasto });
    } catch (err) { next(err); }
  },

  getByPeriodo: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;
      if (!desde || !hasta) return res.status(400).json({ success: false, error: "Los parámetros 'desde' y 'hasta' son requeridos." });
      const gastos = await GastoModel.getByPeriodo(desde, hasta, req.usuario_id);
      res.json({ success: true, data: gastos });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { descripcion, monto, categoria, metodo_pago, cuenta_dinero_id } = req.body;
      if (!descripcion || monto === undefined) return res.status(400).json({ success: false, error: "descripcion y monto son requeridos." });
      if (monto <= 0) return res.status(400).json({ success: false, error: "El monto debe ser mayor a 0." });
      if (metodo_pago && !METODOS_PAGO_VALIDOS.includes(metodo_pago)) {
        return res.status(400).json({ success: false, error: `metodo_pago debe ser uno de: ${METODOS_PAGO_VALIDOS.join(", ")}.` });
      }

      if (cuenta_dinero_id) {
        const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, req.usuario_id);
        if (!cuenta) {
          return res.status(400).json({ success: false, error: "La cuenta de dinero indicada no existe o no pertenece al usuario." });
        }
      }

      const gasto = await GastoModel.create({ descripcion, monto, categoria, metodo_pago, usuario_id: req.usuario_id });

      if (cuenta_dinero_id) {
        await MovimientoFinancieroModel.create({
          fecha: gasto.fecha,
          tipo: "egreso",
          categoria: normalizarCategoriaGasto(gasto.categoria),
          monto: gasto.monto,
          cuenta_dinero_id,
          origen_tipo: "gasto",
          origen_id: gasto.id,
          descripcion: `Gasto #${gasto.id}: ${gasto.descripcion}`,
          usuario_id: req.usuario_id,
        });
      }

      res.status(201).json({ success: true, data: gasto });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { descripcion, monto, categoria, metodo_pago } = req.body;
      if (!descripcion || monto === undefined) return res.status(400).json({ success: false, error: "descripcion y monto son requeridos." });
      if (monto < 0) return res.status(400).json({ success: false, error: "El monto no puede ser negativo." });
      if (metodo_pago && !METODOS_PAGO_VALIDOS.includes(metodo_pago)) {
        return res.status(400).json({ success: false, error: `metodo_pago debe ser uno de: ${METODOS_PAGO_VALIDOS.join(", ")}.` });
      }
      // El servicio también ajusta el movimiento de la cuenta que pagó el gasto
      // (y devuelve 404 si no existe).
      const gasto = await GastoService.editarGasto(id, { descripcion, monto, categoria, metodo_pago }, req.usuario_id);
      res.json({ success: true, data: gasto });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const gasto = await GastoModel.getById(id, req.usuario_id);
      if (!gasto) return res.status(404).json({ success: false, error: "Gasto no encontrado." });

      const movimientos = await MovimientoFinancieroModel.getByOrigen("gasto", id, req.usuario_id);
      for (const mov of movimientos) {
        await MovimientoFinancieroModel.create({
          fecha: new Date().toISOString().slice(0, 10),
          tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
          categoria: mov.categoria,
          monto: mov.monto,
          cuenta_dinero_id: mov.cuenta_dinero_id,
          origen_tipo: "gasto",
          origen_id: id,
          descripcion: `Reversión por eliminación de gasto #${id}`,
          usuario_id: req.usuario_id,
        });
      }

      const resultado = await GastoModel.delete(id, req.usuario_id);
      if (!resultado) return res.status(404).json({ success: false, error: "Gasto no encontrado." });
      res.json({ success: true, message: "Gasto eliminado correctamente." });
    } catch (err) { next(err); }
  },
};

export default GastoController;