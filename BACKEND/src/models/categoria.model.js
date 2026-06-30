// src/models/categoria.model.js
// Queries SQL para la tabla categorias
// Las categorías clasifican los productos (ej: Ropa, Zapatillas, Relojes)

import pool from "../config/db.js";

const CategoriaModel = {
  // Obtener todas las categorías ordenadas alfabéticamente
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY nombre ASC`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM categorias WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ nombre, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre, usuario_id) VALUES ($1, $2) RETURNING *`,
      [nombre, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE categorias SET nombre = $1 WHERE id = $2 AND usuario_id = $3 RETURNING *`,
      [nombre, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `DELETE FROM categorias WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },
};

export default CategoriaModel;