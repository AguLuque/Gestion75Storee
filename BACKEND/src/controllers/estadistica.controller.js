import EstadisticaModel from "../models/estadistica.model.js";

const EstadisticaController = {
  // GET /estadisticas/resumen-mensual?meses=6
  getResumenMensual: async (req, res, next) => {
    try {
      const meses = Number(req.query.meses) || 6;
      const datos = await EstadisticaModel.getResumenMensual(meses, req.usuario_id);
      res.json({ success: true, data: datos });
    } catch (err) {
      next(err);
    }
  },

  // GET /estadisticas/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  getResumenPeriodo: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;
      if (!desde || !hasta) {
        return res.status(400).json({
          success: false,
          error: "Los parámetros 'desde' y 'hasta' son requeridos (formato: YYYY-MM-DD).",
        });
      }
      const datos = await EstadisticaModel.getResumenPeriodo(desde, hasta, req.usuario_id);
      res.json({ success: true, data: datos });
    } catch (err) {
      next(err);
    }
  },

  // GET /estadisticas/top-productos?desde=&hasta=&limite=6
  getTopProductos: async (req, res, next) => {
    try {
      const { desde, hasta } = req.query;
      const limite = Number(req.query.limite) || 6;
      if (!desde || !hasta) {
        return res.status(400).json({
          success: false,
          error: "Los parámetros 'desde' y 'hasta' son requeridos (formato: YYYY-MM-DD).",
        });
      }
      const datos = await EstadisticaModel.getTopProductos(desde, hasta, limite, req.usuario_id);
      res.json({ success: true, data: datos });
    } catch (err) {
      next(err);
    }
  },
};

export default EstadisticaController;