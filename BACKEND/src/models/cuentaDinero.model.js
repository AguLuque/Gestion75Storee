// Queries SQL para la tabla cuentas_dinero.
// El saldo NUNCA se guarda en esta tabla: se calcula sumando movimientos_financieros.

import pool from "../config/db.js";

const CuentaDineroModel = {
  // Todas las cuentas activas con su saldo, calculado en la misma consulta
  // (mismo cálculo que getSaldo) para no pedir el saldo de a una cuenta.
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT c.*,
         c.saldo_inicial + COALESCE(m.ingresos, 0) - COALESCE(m.egresos, 0) AS saldo
       FROM cuentas_dinero c
       LEFT JOIN (
         SELECT cuenta_dinero_id,
           SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) AS ingresos,
           SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) AS egresos
         FROM movimientos_financieros
         WHERE usuario_id = $1
         GROUP BY cuenta_dinero_id
       ) m ON m.cuenta_dinero_id = c.id
       WHERE c.activo = true AND c.usuario_id = $1
       ORDER BY c.nombre ASC`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_dinero WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ nombre, tipo, saldo_inicial, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, tipo, saldo_inicial ?? 0, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre, tipo }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE cuentas_dinero SET nombre = $1, tipo = $2
       WHERE id = $3 AND activo = true AND usuario_id = $4 RETURNING *`,
      [nombre, tipo, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE cuentas_dinero SET activo = false WHERE id = $1 AND activo = true AND usuario_id = $2 RETURNING id`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  // saldo_inicial + ingresos - egresos, sólo movimientos de esta cuenta.
  getSaldo: async (id, usuario_id) => {
    const cuenta = await CuentaDineroModel.getById(id, usuario_id);
    if (!cuenta) return null;

    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS egresos
       FROM movimientos_financieros
       WHERE cuenta_dinero_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    const { ingresos, egresos } = rows[0];
    return Number(cuenta.saldo_inicial) + Number(ingresos) - Number(egresos);
  },
};

export default CuentaDineroModel;
