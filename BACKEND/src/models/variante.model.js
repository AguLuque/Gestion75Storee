// src/models/variante.model.js
// Queries SQL para la tabla variantes
// Cada variante pertenece a un producto base y tiene su propio stock
// El precio se hereda del producto base (precio_extra permite ajuste opcional)

import pool from "../config/db.js";

const VarianteModel = {
  // Obtener todas las variantes de un producto
  getByProducto: async (producto_id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.nombre AS producto_nombre,
            p.precio_minorista, p.precio_mayorista, p.precio_compra
     FROM variantes v
     JOIN productos p ON p.id = v.producto_id
     WHERE v.producto_id = $1 AND p.usuario_id = $2
     ORDER BY v.talle ASC, v.color ASC`,
      [producto_id, usuario_id]
    );
    return rows;
  },

  // Obtener una variante por ID (verificando que el producto sea del usuario autenticado)
  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.nombre AS producto_nombre,
              p.precio_minorista, p.precio_mayorista, p.precio_compra
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.id = $1 AND p.usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  // Crear una nueva variante para un producto (verifica que el producto sea del usuario)
  create: async ({ producto_id, talle, color, stock_actual, precio_extra, usuario_id }) => {
    const { rows: productoRows } = await pool.query(
      `SELECT id FROM productos WHERE id = $1 AND usuario_id = $2 AND activo = true`,
      [producto_id, usuario_id]
    );
    if (!productoRows[0]) return null;

    const { rows } = await pool.query(
      `INSERT INTO variantes (producto_id, talle, color, stock_actual, precio_extra)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [producto_id, talle ?? null, color ?? null, stock_actual ?? 0, precio_extra ?? 0]
    );
    return rows[0];
  },

  // Actualizar datos de una variante (talle, color, precio_extra)
  update: async (id, { talle, color, precio_extra }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE variantes v
       SET talle = $1, color = $2, precio_extra = $3
       FROM productos p
       WHERE v.id = $4 AND v.producto_id = p.id AND p.usuario_id = $5
       RETURNING v.*`,
      [talle ?? null, color ?? null, precio_extra ?? 0, id, usuario_id]
    );
    return rows[0] || null;
  },

  // Eliminar una variante
  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `DELETE FROM variantes v
       USING productos p
       WHERE v.id = $1 AND v.producto_id = p.id AND p.usuario_id = $2
       RETURNING v.id, v.talle, v.color`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  // Ajuste manual de stock de una variante (el cliente carga lo que tiene)
  updateStockManual: async (id, stock_actual, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE variantes v
       SET stock_actual = $1
       FROM productos p
       WHERE v.id = $2 AND v.producto_id = p.id AND p.usuario_id = $3
       RETURNING v.*`,
      [stock_actual, id, usuario_id]
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
  // También verifica que la variante pertenezca a un producto del usuario autenticado
  checkStock: async (client, variante_id, cantidad, usuario_id) => {
    const { rows } = await client.query(
      `SELECT v.stock_actual, p.precio_compra, p.precio_minorista, p.precio_mayorista, v.precio_extra
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.id = $1 AND p.usuario_id = $2
       FOR UPDATE OF v`,
      [variante_id, usuario_id]
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
  getSinStock: async (producto_id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.nombre AS producto_nombre
     FROM variantes v
     JOIN productos p ON p.id = v.producto_id
     WHERE v.stock_actual = 0 AND v.producto_id = $1 AND p.usuario_id = $2`,
      [producto_id, usuario_id]
    );
    return rows;
  },
};

export default VarianteModel;