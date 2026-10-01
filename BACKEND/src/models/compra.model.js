// src/models/compra.model.js
// Queries para la tabla compras y compra_items
// Las operaciones de escritura usan un client externo (transacción)
// para garantizar atomicidad: cabecera + items + stock en un solo bloque

import pool from "../config/db.js";

const CompraModel = {
  // Listar todas las compras con sus ítems agrupados
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT c.id, c.fecha, c.total, c.observaciones, c.tipo, c.costo_envio, c.estado_pago,
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
    WHERE c.usuario_id = $1 AND c.activo = true
    GROUP BY c.id, p.nombre
    ORDER BY c.fecha DESC
  `, [usuario_id]);
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(`
    SELECT c.id, c.fecha, c.total, c.observaciones, c.tipo, c.costo_envio, c.estado_pago,
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
    WHERE c.id = $1 AND c.usuario_id = $2 AND c.activo = true
    GROUP BY c.id, p.nombre
  `, [id, usuario_id]);
    return rows[0] || null;
  },

  insertCabecera: async (client, { proveedor_id, total, observaciones, tipo, costo_envio, estado_pago, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO compras (proveedor_id, total, observaciones, tipo, costo_envio, estado_pago, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [proveedor_id ?? null, total, observaciones ?? null, tipo || "local", costo_envio ?? 0, estado_pago || "pagado", usuario_id]
    );
    return rows[0];
  },

  updateCabecera: async (client, id, { proveedor_id, total, observaciones, tipo, costo_envio }, usuario_id) => {
    const { rows } = await client.query(
      `UPDATE compras SET proveedor_id=$1, total=$2, observaciones=$3, tipo=$4, costo_envio=$5
     WHERE id=$6 AND usuario_id=$7 RETURNING *`,
      [proveedor_id ?? null, total, observaciones ?? null, tipo || "local", costo_envio ?? 0, id, usuario_id]
    );
    return rows[0];
  },

  // Inserta todos los ítems de una compra en una sola consulta
  insertItems: async (client, compra_id, items) => {
    const { rows } = await client.query(
      `INSERT INTO compra_items (compra_id, producto_id, cantidad, precio_unitario, subtotal)
       SELECT $1, i.producto_id, i.cantidad, i.precio_unitario, i.subtotal
       FROM unnest($2::bigint[], $3::numeric[], $4::numeric[], $5::numeric[])
         WITH ORDINALITY AS i(producto_id, cantidad, precio_unitario, subtotal, orden)
       ORDER BY i.orden
       RETURNING *`,
      [
        compra_id,
        items.map((i) => i.producto_id),
        items.map((i) => i.cantidad),
        items.map((i) => i.precio_unitario),
        items.map((i) => i.cantidad * i.precio_unitario),
      ]
    );
    return rows;
  },

  deleteItems: async (client, compra_id) => {
    await client.query(`DELETE FROM compra_items WHERE compra_id = $1`, [compra_id]);
  },

  getClient: () => pool.connect(),
  
};

export default CompraModel;