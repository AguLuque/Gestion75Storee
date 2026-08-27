// src/models/venta.model.js
// Queries para la tabla ventas y venta_items
// Incluye verificación de stock con FOR UPDATE para evitar race conditions

import pool from "../config/db.js";

const VentaModel = {
  // Obtener todas las ventas con sus ítems
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT v.id, v.fecha, v.tipo, v.total, v.ganancia, v.observaciones, v.metodo_pago,
      json_agg(json_build_object(
        'producto_id', vi.producto_id,
        'producto', p.nombre,
        'cantidad', vi.cantidad,
        'precio_unitario', vi.precio_unitario,
        'costo_unitario', vi.costo_unitario,
        'subtotal', vi.subtotal
      )) AS items
    FROM ventas v
    JOIN venta_items vi ON vi.venta_id = v.id
    JOIN productos p ON p.id = vi.producto_id
    WHERE v.activo = true AND v.usuario_id = $1
    GROUP BY v.id
    ORDER BY v.fecha DESC
  `, [usuario_id]);
    return rows;
  },

  // Obtener una venta por ID con sus ítems
  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(`
    SELECT v.id, v.fecha, v.tipo, v.total, v.ganancia, v.observaciones, v.metodo_pago,
      json_agg(json_build_object(
        'producto_id', vi.producto_id,
        'producto', p.nombre,
        'cantidad', vi.cantidad,
        'precio_unitario', vi.precio_unitario,
        'costo_unitario', vi.costo_unitario,
        'subtotal', vi.subtotal
      )) AS items
    FROM ventas v
    JOIN venta_items vi ON vi.venta_id = v.id
    JOIN productos p ON p.id = vi.producto_id
    WHERE v.id = $1 AND v.activo = true AND v.usuario_id = $2
    GROUP BY v.id
  `, [id, usuario_id]);
    return rows[0] || null;
  },

  // Obtener ventas filtradas por rango de fechas
  getByPeriodo: async (desde, hasta, usuario_id) => {
    const { rows } = await pool.query(`
    SELECT v.id, v.fecha, v.tipo, v.total, v.ganancia, v.metodo_pago,
      json_agg(json_build_object(
        'producto', p.nombre,
        'cantidad', vi.cantidad,
        'precio_unitario', vi.precio_unitario,
        'costo_unitario', vi.costo_unitario,
        'subtotal', vi.subtotal
      )) AS items
    FROM ventas v
    JOIN venta_items vi ON vi.venta_id = v.id
    JOIN productos p ON p.id = vi.producto_id
    WHERE v.fecha BETWEEN $1 AND $2 AND v.usuario_id = $3
    GROUP BY v.id
    ORDER BY v.fecha DESC
  `, [desde, hasta, usuario_id]);
    return rows;
  },

  // Insertar cabecera de venta (dentro de una transacción)
  insertCabecera: async (client, { tipo, total, ganancia, observaciones, metodo_pago, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO ventas (tipo, total, ganancia, observaciones, metodo_pago, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tipo, total, ganancia, observaciones ?? null, metodo_pago ?? null, usuario_id]
    );
    return rows[0];
  },

  // Insertar ítem de venta con snapshot del costo actual
  insertItem: async (
    client,
    { venta_id, producto_id, cantidad, precio_unitario, costo_unitario }
  ) => {
    const subtotal = cantidad * precio_unitario;
    const { rows } = await client.query(
      `
      INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal]
    );
    return rows[0];
  },

  // Verificar stock disponible con bloqueo de fila (FOR UPDATE)
  // Previene que dos ventas simultáneas descuenten el mismo stock
  checkStock: async (client, producto_id, cantidad, usuario_id) => {
    const { rows } = await client.query(
      `
      SELECT stock_actual, precio_compra FROM productos
      WHERE id = $1 AND activo = true AND usuario_id = $2
      FOR UPDATE
    `,
      [producto_id, usuario_id]
    );

    if (!rows[0]) {
      throw { status: 404, message: `Producto ${producto_id} no encontrado.` };
    }

    if (rows[0].stock_actual < cantidad) {
      throw {
        status: 400,
        message: `Stock insuficiente para el producto ${producto_id}. Disponible: ${rows[0].stock_actual}`,
      };
    }

    // Retorna { stock_actual, precio_compra } para calcular ganancia
    return rows[0];
  },

  // Obtener un client para manejar transacciones manualmente
  getClient: () => pool.connect(),
};

export default VentaModel;