// src/models/variante.model.js
// Queries SQL para la tabla variantes
// Cada variante pertenece a un producto base y tiene su propio stock
// El precio se hereda del producto base (precio_extra permite ajuste opcional)

import pool from "../config/db.js";

const VarianteModel = {
  // Obtener todas las variantes de un producto
  getByProducto: async (producto_id) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.nombre AS producto_nombre,
              p.precio_minorista, p.precio_mayorista, p.precio_compra
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.producto_id = $1
       ORDER BY v.talle ASC, v.color ASC`,
      [producto_id]
    );
    return rows;
  },

  // Obtener una variante por ID
  getById: async (id) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.nombre AS producto_nombre,
              p.precio_minorista, p.precio_mayorista, p.precio_compra
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  // Crear una nueva variante para un producto
  create: async ({ producto_id, talle, color, stock_actual, precio_extra }) => {
    const { rows } = await pool.query(
      `INSERT INTO variantes (producto_id, talle, color, stock_actual, precio_extra)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [producto_id, talle ?? null, color ?? null, stock_actual ?? 0, precio_extra ?? 0]
    );
    return rows[0];
  },

  // Actualizar datos de una variante (talle, color, precio_extra)
  update: async (id, { talle, color, precio_extra }) => {
    const { rows } = await pool.query(
      `UPDATE variantes
       SET talle = $1, color = $2, precio_extra = $3
       WHERE id = $4
       RETURNING *`,
      [talle ?? null, color ?? null, precio_extra ?? 0, id]
    );
    return rows[0] || null;
  },

  // Eliminar una variante
  delete: async (id) => {
    const { rows } = await pool.query(
      `DELETE FROM variantes WHERE id = $1 RETURNING id, talle, color`,
      [id]
    );
    return rows[0] || null;
  },

  // Ajuste manual de stock de una variante (el cliente carga lo que tiene)
  updateStockManual: async (id, stock_actual) => {
    const { rows } = await pool.query(
      `UPDATE variantes
       SET stock_actual = $1
       WHERE id = $2
       RETURNING *`,
      [stock_actual, id]
    );
    return rows[0] || null;
  },

  // Modificar stock por cantidad (positivo = suma, negativo = resta)
  // Usado desde compra.service y venta.service dentro de transacciones
  updateStock: async (id, cantidad, client = pool) => {
    const { rows } = await client.query(
      `UPDATE variantes
       SET stock_actual = stock_actual + $1
       WHERE id = $2
       RETURNING stock_actual`,
      [cantidad, id]
    );
    return rows[0];
  },

  // Verificar stock de una variante con bloqueo (FOR UPDATE)
  // Evita race conditions cuando dos ventas ocurren al mismo tiempo
  checkStock: async (client, variante_id, cantidad) => {
    const { rows } = await client.query(
      `SELECT v.stock_actual, p.precio_compra, p.precio_minorista, p.precio_mayorista, v.precio_extra
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.id = $1
       FOR UPDATE`,
      [variante_id]
    );

    if (!rows[0]) {
      throw { status: 404, message: `Variante ${variante_id} no encontrada.` };
    }

    if (rows[0].stock_actual < cantidad) {
      throw {
        status: 400,
        message: `Stock insuficiente para la variante ${variante_id}. Disponible: ${rows[0].stock_actual}`,
      };
    }

    return rows[0];
  },

  // Variantes sin stock de un producto
  getSinStock: async (producto_id) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.nombre AS producto_nombre
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.stock_actual = 0 AND v.producto_id = $1`,
      [producto_id]
    );
    return rows;
  },
};

export default VarianteModel;