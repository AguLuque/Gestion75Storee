// src/models/producto.model.js
import pool from "../config/db.js";

const ProductoModel = {
  // Obtener todos los productos activos con el nombre de su categoría
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT p.*, c.nombre AS categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.activo = true AND p.usuario_id = $1
    ORDER BY p.nombre ASC
  `, [usuario_id]);
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre
     FROM productos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     WHERE p.id = $1 AND p.activo = true AND p.usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  getSinStock: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT * FROM productos
    WHERE stock_actual = 0 AND activo = true AND usuario_id = $1
    ORDER BY nombre ASC
  `, [usuario_id]);
    return rows;
  },

  getBajoStock: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT * FROM productos
    WHERE stock_actual > 0 AND stock_actual <= 2 AND activo = true AND usuario_id = $1
    ORDER BY stock_actual ASC
  `, [usuario_id]);
    return rows;
  },

  create: async ({ nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra ?? 0, stock_actual ?? 0, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE productos
     SET nombre = $1, categoria_id = $2, precio_minorista = $3,
         precio_mayorista = $4, precio_compra = $5, stock_actual = $6, updated_at = now()
     WHERE id = $7 AND activo = true AND usuario_id = $8
     RETURNING *`,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE productos SET activo = false
     WHERE id = $1 AND activo = true AND usuario_id = $2
     RETURNING id, nombre`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },
  updateStock: async (id, cantidad, client = pool) => {
    const { rows } = await client.query(
      `UPDATE productos
     SET stock_actual = stock_actual + $1, updated_at = now()
     WHERE id = $2
     RETURNING stock_actual`,
      [cantidad, id]
    );
    return rows[0];
  },
};

export default ProductoModel;