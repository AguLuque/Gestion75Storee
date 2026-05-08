// src/models/categoria.model.js
// Queries SQL para la tabla categorias
// Las categorías clasifican los productos (ej: Ropa, Zapatillas, Relojes)

import pool from "../config/db.js";

const CategoriaModel = {
  // Obtener todas las categorías ordenadas alfabéticamente
  getAll: async () => {
    const { rows } = await pool.query(`SELECT * FROM categorias ORDER BY nombre ASC`);
    return rows;
  },

  // Obtener una categoría por ID
  getById: async (id) => {
    const { rows } = await pool.query(`SELECT * FROM categorias WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  // Crear una nueva categoría
  create: async ({ nombre }) => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ($1) RETURNING *`,
      [nombre]
    );
    return rows[0];
  },

  // Actualizar nombre de una categoría
  update: async (id, { nombre }) => {
    const { rows } = await pool.query(
      `UPDATE categorias SET nombre = $1 WHERE id = $2 RETURNING *`,
      [nombre, id]
    );
    return rows[0] || null;
  },

  // Eliminar una categoría (hard delete — verificar que no tenga productos asociados antes)
  delete: async (id) => {
    const { rows } = await pool.query(
      `DELETE FROM categorias WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

export default CategoriaModel;