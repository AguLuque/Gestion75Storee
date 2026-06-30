// src/models/compra.model.js
// Queries para la tabla compras y compra_items
// Las operaciones de escritura usan un client externo (transacción)
// para garantizar atomicidad: cabecera + items + stock en un solo bloque

import pool from "../config/db.js";

const CompraModel = {
  // Listar todas las compras con sus ítems agrupados
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT c.id, c.fecha, c.total, c.observaciones,
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
    WHERE c.usuario_id = $1
    GROUP BY c.id, p.nombre
    ORDER BY c.fecha DESC
  `, [usuario_id]);
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(`
    SELECT c.id, c.fecha, c.total, c.observaciones,
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
    WHERE c.id = $1 AND c.usuario_id = $2
    GROUP BY c.id, p.nombre
  `, [id, usuario_id]);
    return rows[0] || null;
  },

  insertCabecera: async (client, { proveedor_id, total, observaciones, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO compras (proveedor_id, total, observaciones, usuario_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
      [proveedor_id ?? null, total, observaciones ?? null, usuario_id]
    );
    return rows[0];
  },

  updateCabecera: async (client, id, { proveedor_id, total, observaciones }, usuario_id) => {
    const { rows } = await client.query(
      `UPDATE compras SET proveedor_id=$1, total=$2, observaciones=$3
     WHERE id=$4 AND usuario_id=$5 RETURNING *`,
      [proveedor_id ?? null, total, observaciones ?? null, id, usuario_id]
    );
    return rows[0];
  },
};

export default CompraModel;