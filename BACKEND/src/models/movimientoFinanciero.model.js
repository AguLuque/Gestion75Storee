// Fuente única de verdad para todos los reportes financieros.
// create() abre su propia conexión; createEnTransaccion() recibe un client
// ya abierto por venta.service.js / compra.service.js para que el movimiento
// se confirme o revierta junto con la operación que lo origina.

import pool from "../config/db.js";

const INSERT_SQL = `
  INSERT INTO movimientos_financieros
    (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, origen_id, descripcion, usuario_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
`;

const toParams = ({ fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, origen_id, descripcion, usuario_id }) => [
  fecha, tipo, categoria, monto, cuenta_dinero_id ?? null, origen_tipo, origen_id ?? null, descripcion ?? null, usuario_id,
];

const MovimientoFinancieroModel = {
  create: async (data) => {
    const { rows } = await pool.query(INSERT_SQL, toParams(data));
    return rows[0];
  },

  createEnTransaccion: async (client, data) => {
    const { rows } = await client.query(INSERT_SQL, toParams(data));
    return rows[0];
  },

  // Registra la contrapartida (ingreso <-> egreso) de todos los movimientos de un
  // origen (ej. una compra) en una sola consulta. Devuelve los movimientos
  // originales, como estaban antes de revertirlos.
  revertirOrigenEnTransaccion: async (client, { origen_tipo, origen_id, usuario_id, fecha, descripcion }) => {
    const { rows } = await client.query(
      `WITH originales AS (
         SELECT * FROM movimientos_financieros
         WHERE origen_tipo = $1 AND origen_id = $2 AND usuario_id = $3
       ), reversiones AS (
         INSERT INTO movimientos_financieros
           (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, origen_id, descripcion, usuario_id)
         SELECT $4, CASE WHEN tipo = 'ingreso' THEN 'egreso' ELSE 'ingreso' END,
                categoria, monto, cuenta_dinero_id, origen_tipo, origen_id, $5, usuario_id
         FROM originales
         ORDER BY id
       )
       SELECT * FROM originales ORDER BY id`,
      [origen_tipo, origen_id, usuario_id, fecha, descripcion]
    );
    return rows;
  },

  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM movimientos_financieros WHERE usuario_id = $1 ORDER BY fecha DESC, id DESC`,
      [usuario_id]
    );
    return rows;
  },

  getByPeriodo: async (desde, hasta, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM movimientos_financieros
       WHERE fecha BETWEEN $1 AND $2 AND usuario_id = $3
       ORDER BY fecha DESC, id DESC`,
      [desde, hasta, usuario_id]
    );
    return rows;
  },

  getByOrigen: async (origen_tipo, origen_id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM movimientos_financieros
       WHERE origen_tipo = $1 AND origen_id = $2 AND usuario_id = $3`,
      [origen_tipo, origen_id, usuario_id]
    );
    return rows;
  },
};

export default MovimientoFinancieroModel;
