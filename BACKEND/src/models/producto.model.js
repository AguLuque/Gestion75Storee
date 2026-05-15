// src/models/producto.model.js
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
      `SELECT p.*, c.nombre AS categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = $1 AND p.activo = true`,
      [id]
    );
    return rows[0] || null;
  },

  // Productos sin stock
  getSinStock: async () => {
    const { rows } = await pool.query(`
      SELECT * FROM productos
      WHERE stock_actual = 0 AND activo = true
      ORDER BY nombre ASC
    `);
    return rows;
  },

  // Productos con poco stock (2 o menos unidades)
  getBajoStock: async () => {
    const { rows } = await pool.query(`
      SELECT * FROM productos
      WHERE stock_actual > 0 AND stock_actual <= 2 AND activo = true
      ORDER BY stock_actual ASC
    `);
    return rows;
  },

  // Crear un producto nuevo
  create: async ({ nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual }) => {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra ?? 0, stock_actual ?? 0]
    );
    return rows[0];
  },

  // Actualizar un producto
  update: async (id, { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual }) => {
    const { rows } = await pool.query(
      `UPDATE productos
     SET nombre = $1,
         categoria_id = $2,
         precio_minorista = $3,
         precio_mayorista = $4,
         precio_compra = $5,
         stock_actual = $6,
         updated_at = now()
     WHERE id = $7 AND activo = true
     RETURNING *`,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, id]
    );
    return rows[0] || null;
  },

  // Soft delete
  delete: async (id) => {
    const { rows } = await pool.query(
      `UPDATE productos SET activo = false 
       WHERE id = $1 AND activo = true
       RETURNING id, nombre`,
      [id]
    );
    return rows[0] || null;
  },

  // Actualizar stock desde transacciones (compra/venta)
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

  // Ajuste manual de stock
  updateStockManual: async (id, stock_actual) => {
    const { rows } = await pool.query(
      `UPDATE productos
       SET stock_actual = $1, updated_at = now()
       WHERE id = $2 AND activo = true
       RETURNING *`,
      [stock_actual, id]
    );
    return rows[0] || null;
  },
};

export default ProductoModel;