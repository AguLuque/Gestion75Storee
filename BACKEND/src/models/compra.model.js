// src/models/compra.model.js
// Queries para la tabla compras y compra_items
// Las operaciones de escritura usan un client externo (transacción)
// para garantizar atomicidad: cabecera + items + stock en un solo bloque

import pool from "../config/db.js";

const CompraModel = {
  // Listar todas las compras con sus ítems agrupados
  getAll: async () => {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.fecha,
        c.total,
        c.observaciones,
        p.nombre AS proveedor,
        json_agg(json_build_object(
          'producto_id', ci.producto_id,
          'producto', prod.nombre,
          'cantidad', ci.cantidad,
          'precio_unitario', ci.precio_unitario,
          'subtotal', ci.subtotal
        )) AS items
      FROM compras c
      LEFT JOIN proveedores p ON p.id = c.proveedor_id
      JOIN compra_items ci ON ci.compra_id = c.id
      JOIN productos prod ON prod.id = ci.producto_id
      GROUP BY c.id, p.nombre
      ORDER BY c.fecha DESC
    `);
    return rows;
  },

  // Obtener una compra por ID con sus ítems
  getById: async (id) => {
    const { rows } = await pool.query(
      `
      SELECT
        c.id,
        c.fecha,
        c.total,
        c.observaciones,
        p.nombre AS proveedor,
        json_agg(json_build_object(
          'producto_id', ci.producto_id,
          'producto', prod.nombre,
          'cantidad', ci.cantidad,
          'precio_unitario', ci.precio_unitario,
          'subtotal', ci.subtotal
        )) AS items
      FROM compras c
      LEFT JOIN proveedores p ON p.id = c.proveedor_id
      JOIN compra_items ci ON ci.compra_id = c.id
      JOIN productos prod ON prod.id = ci.producto_id
      WHERE c.id = $1
      GROUP BY c.id, p.nombre
    `,
      [id]
    );
    return rows[0] || null;
  },

  // Insertar la cabecera de la compra (dentro de una transacción)
  insertCabecera: async (client, { proveedor_id, total, observaciones }) => {
    const { rows } = await client.query(
      `
      INSERT INTO compras (proveedor_id, total, observaciones)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [proveedor_id ?? null, total, observaciones ?? null]
    );
    return rows[0];
  },

  // Insertar un ítem de compra (dentro de una transacción)
  insertItem: async (client, { compra_id, producto_id, cantidad, precio_unitario }) => {
    const subtotal = cantidad * precio_unitario;
    const { rows } = await client.query(
      `
      INSERT INTO compra_items (compra_id, producto_id, cantidad, precio_unitario, subtotal)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [compra_id, producto_id, cantidad, precio_unitario, subtotal]
    );
    return rows[0];
  },

  // Obtener un client de la pool para manejar transacciones manualmente
  getClient: () => pool.connect(),

  // Eliminar ítems de una compra (para reemplazarlos al editar)
  deleteItems: async (client, compra_id) => {
    await client.query(`DELETE FROM compra_items WHERE compra_id = $1`, [compra_id]);
  },

  // Actualizar cabecera de compra
  updateCabecera: async (client, id, { proveedor_id, total, observaciones }) => {
    const { rows } = await client.query(
      `UPDATE compras SET proveedor_id=$1, total=$2, observaciones=$3 WHERE id=$4 RETURNING *`,
      [proveedor_id ?? null, total, observaciones ?? null, id]
    );
    return rows[0];
  },
};

export default CompraModel;