// src/models/producto.model.js
// Queries SQL directas a la tabla productos
// Sin ORM — queries explícitas para máximo control

import pool from "../config/db.js";

const ProductoModel = {
  // Obtener todos los productos activos con el nombre de su categoría
  getAll: async () => {
    const { rows } = await pool.query(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = true
      ORDER BY p.nombre ASC
    `);
    return rows;
  },

  // Obtener un producto por ID
  getById: async (id) => {
    const { rows } = await pool.query(
      `
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = $1 AND p.activo = true
    `,
      [id]
    );
    return rows[0] || null;
  },

  // Crear un producto nuevo
  create: async ({
    nombre,
    categoria_id,
    precio_minorista,
    precio_mayorista,
    precio_compra,
    stock_actual,
    stock_minimo,
  }) => {
    const { rows } = await pool.query(
      `
      INSERT INTO productos (nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, stock_minimo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        nombre,
        categoria_id,
        precio_minorista,
        precio_mayorista,
        precio_compra ?? 0,
        stock_actual ?? 0,
        stock_minimo ?? 0,
      ]
    );
    return rows[0];
  },

  // Actualizar un producto
  update: async (
    id,
    { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_minimo }
  ) => {
    const { rows } = await pool.query(
      `
      UPDATE productos
      SET nombre = $1,
          categoria_id = $2,
          precio_minorista = $3,
          precio_mayorista = $4,
          precio_compra = $5,
          stock_minimo = $6,
          updated_at = now()
      WHERE id = $7 AND activo = true
      RETURNING *
    `,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_minimo, id]
    );
    return rows[0] || null;
  },

  // Soft delete: marca como inactivo en lugar de borrar físicamente
  delete: async (id) => {
    const { rows } = await pool.query(
      `UPDATE productos SET activo = false WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },

  // Actualizar stock (usado desde services de compra/venta)
  // Acepta un client externo para operar dentro de transacciones
  updateStock: async (id, cantidad, client = pool) => {
    const { rows } = await client.query(
      `
      UPDATE productos
      SET stock_actual = stock_actual + $1, updated_at = now()
      WHERE id = $2
      RETURNING stock_actual
    `,
      [cantidad, id]
    );
    return rows[0];
  },

  // Obtener productos con stock bajo (stock_actual <= stock_minimo)
  getBajoStock: async () => {
    const { rows } = await pool.query(`
      SELECT * FROM productos
      WHERE stock_actual <= stock_minimo AND activo = true
      ORDER BY stock_actual ASC
    `);
    return rows;
  },
};

export default ProductoModel;