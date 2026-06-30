// src/models/gasto.model.js
// Queries SQL para la tabla gastos
// Los gastos son egresos del negocio no relacionados a compras de stock

import pool from "../config/db.js";

const GastoModel = {
  // Obtener todos los gastos ordenados por fecha
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM gastos WHERE usuario_id = $1 ORDER BY fecha DESC`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM gastos WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  getByPeriodo: async (desde, hasta, usuario_id) => {
    const { rows } = await pool.query(`
    SELECT * FROM gastos
    WHERE fecha BETWEEN $1 AND $2 AND usuario_id = $3
    ORDER BY fecha DESC
  `, [desde, hasta, usuario_id]);
    return rows;
  },

  create: async ({ descripcion, monto, categoria, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO gastos (descripcion, monto, categoria, usuario_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
      [descripcion, monto, categoria ?? null, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { descripcion, monto, categoria }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE gastos
     SET descripcion = $1, monto = $2, categoria = $3
     WHERE id = $4 AND usuario_id = $5
     RETURNING *`,
      [descripcion, monto, categoria, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `DELETE FROM gastos WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },
};

export default GastoModel;