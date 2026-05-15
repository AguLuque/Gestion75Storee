// src/models/proveedor.model.js
// Queries SQL para la tabla proveedores

import pool from "../config/db.js";

const ProveedorModel = {
  // Obtener todos los proveedores
  getAll: async () => {
    const { rows } = await pool.query(`SELECT * FROM proveedores ORDER BY nombre ASC`);
    return rows;
  },

  // Obtener un proveedor por ID
  getById: async (id) => {
    const { rows } = await pool.query(`SELECT * FROM proveedores WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  // Crear un nuevo proveedor
  create: async ({ nombre, contacto, observaciones }) => {
    const { rows } = await pool.query(
      `
      INSERT INTO proveedores (nombre, contacto, observaciones)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [nombre, contacto ?? null, observaciones ?? null]
    );
    return rows[0];
  },

  // Actualizar datos de un proveedor
  update: async (id, { nombre, contacto, observaciones }) => {
    const { rows } = await pool.query(
      `
      UPDATE proveedores
      SET nombre = $1, contacto = $2, observaciones = $3
      WHERE id = $4
      RETURNING *
    `,
      [nombre, contacto, observaciones, id]
    );
    return rows[0] || null;
  },

  // Eliminar un proveedor
  delete: async (id) => {
    const { rows } = await pool.query(
      `DELETE FROM proveedores WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },

  // Historial de compras asociadas a un proveedor específico
  getCompras: async (proveedorId) => {
    const { rows } = await pool.query(
      `
      SELECT
        c.id,
        c.fecha,
        c.total,
        c.observaciones,
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
      WHERE c.proveedor_id = $1
      GROUP BY c.id
      ORDER BY c.fecha DESC
    `,
      [proveedorId]
    );
    return rows;
  },
};

export default ProveedorModel;