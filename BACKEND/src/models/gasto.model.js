// src/models/gasto.model.js
// Queries SQL para la tabla gastos
// Los gastos son egresos del negocio no relacionados a compras de stock

import pool from "../config/db.js";

const GastoModel = {
  // Obtener todos los gastos ordenados por fecha
  getAll: async () => {
    const { rows } = await pool.query(`SELECT * FROM gastos ORDER BY fecha DESC`);
    return rows;
  },

  // Obtener un gasto por ID
  getById: async (id) => {
    const { rows } = await pool.query(`SELECT * FROM gastos WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  // Obtener gastos por rango de fechas (útil para reportes mensuales)
  getByPeriodo: async (desde, hasta) => {
    const { rows } = await pool.query(
      `
      SELECT * FROM gastos
      WHERE fecha BETWEEN $1 AND $2
      ORDER BY fecha DESC
    `,
      [desde, hasta]
    );
    return rows;
  },

  // Crear un nuevo gasto
  create: async ({ descripcion, monto, categoria }) => {
    const { rows } = await pool.query(
      `
      INSERT INTO gastos (descripcion, monto, categoria)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [descripcion, monto, categoria ?? null]
    );
    return rows[0];
  },

  // Actualizar un gasto existente
  update: async (id, { descripcion, monto, categoria }) => {
    const { rows } = await pool.query(
      `
      UPDATE gastos
      SET descripcion = $1, monto = $2, categoria = $3
      WHERE id = $4
      RETURNING *
    `,
      [descripcion, monto, categoria, id]
    );
    return rows[0] || null;
  },

  // Eliminar un gasto
  delete: async (id) => {
    const { rows } = await pool.query(
      `DELETE FROM gastos WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

export default GastoModel;