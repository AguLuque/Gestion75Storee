// src/models/proveedor.model.js
// Queries SQL para la tabla proveedores

import pool from "../config/db.js";

const ProveedorModel = {
  // Obtener todos los proveedores
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM proveedores WHERE usuario_id = $1 ORDER BY nombre ASC`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM proveedores WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ nombre, contacto, observaciones, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO proveedores (nombre, contacto, observaciones, usuario_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, contacto ?? null, observaciones ?? null, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre, contacto, observaciones }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE proveedores
     SET nombre = $1, contacto = $2, observaciones = $3
     WHERE id = $4 AND usuario_id = $5
     RETURNING *`,
      [nombre, contacto, observaciones, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `DELETE FROM proveedores WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  getCompras: async (proveedorId, usuario_id) => {
    const { rows } = await pool.query(`
    SELECT c.id, c.fecha, c.total, c.observaciones,
      json_agg(json_build_object(
        'producto_id', ci.producto_id,
        'producto', p.nombre,
        'cantidad', ci.cantidad,
        'precio_unitario', ci.precio_unitario,
        'subtotal', ci.subtotal
      )) AS items
    FROM compras c
    JOIN compra_items ci ON ci.compra_id = c.id
    JOIN productos p ON p.id = ci.producto_id
    WHERE c.proveedor_id = $1 AND c.usuario_id = $2
    GROUP BY c.id
    ORDER BY c.fecha DESC
  `, [proveedorId, usuario_id]);
    return rows;
  },
};

export default ProveedorModel;