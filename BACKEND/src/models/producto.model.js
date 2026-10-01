// src/models/producto.model.js
import pool from "../config/db.js";
import { agruparCantidades } from "../utils/cantidades.js";

const ProductoModel = {
  // Obtener todos los productos activos con el nombre de su categoría
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT p.*, c.nombre AS categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.activo = true AND p.usuario_id = $1
    ORDER BY p.nombre ASC
  `, [usuario_id]);
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre
     FROM productos p
     LEFT JOIN categorias c ON p.categoria_id = c.id
     WHERE p.id = $1 AND p.activo = true AND p.usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  getSinStock: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT * FROM productos
    WHERE stock_actual = 0 AND activo = true AND usuario_id = $1
    ORDER BY nombre ASC
  `, [usuario_id]);
    return rows;
  },

  getBajoStock: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT * FROM productos
    WHERE stock_actual > 0 AND stock_actual <= 2 AND activo = true AND usuario_id = $1
    ORDER BY stock_actual ASC
  `, [usuario_id]);
    return rows;
  },

  create: async ({ nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra ?? 0, stock_actual ?? 0, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE productos
     SET nombre = $1, categoria_id = $2, precio_minorista = $3,
         precio_mayorista = $4, precio_compra = $5, stock_actual = $6, updated_at = now()
     WHERE id = $7 AND activo = true AND usuario_id = $8
     RETURNING *`,
      [nombre, categoria_id, precio_minorista, precio_mayorista, precio_compra, stock_actual, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE productos SET activo = false
     WHERE id = $1 AND activo = true AND usuario_id = $2
     RETURNING id, nombre`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },
  // Bloquea (FOR UPDATE) y trae en una sola consulta los productos activos del
  // usuario. El ORDER BY id hace que dos transacciones bloqueen siempre en el
  // mismo orden y no se traben entre sí. Devuelve un Map id -> fila.
  bloquearVarios: async (client, ids, usuario_id) => {
    const { rows } = await client.query(
      `SELECT id, stock_actual, precio_compra, precio_minorista, precio_mayorista
     FROM productos
     WHERE id = ANY($1) AND activo = true AND usuario_id = $2
     ORDER BY id
     FOR UPDATE`,
      [ids, usuario_id]
    );
    return new Map(rows.map((r) => [String(r.id), r]));
  },

  // Suma (o resta, con cantidad negativa) stock a varios productos en una sola consulta.
  // ajustes: [{ id, cantidad }]
  updateStockVarios: async (client, ajustes) => {
    const { ids, cantidades } = agruparCantidades(ajustes);
    if (ids.length === 0) return;
    await client.query(
      `UPDATE productos p
     SET stock_actual = p.stock_actual + d.cantidad, updated_at = now()
     FROM unnest($1::bigint[], $2::numeric[]) AS d(id, cantidad)
     WHERE p.id = d.id`,
      [ids, cantidades]
    );
  },

  // Repone (signo 1) o descuenta (signo -1) el stock de todos los ítems ya
  // guardados de una venta o compra, en una sola consulta.
  updateStockDesdeItems: async (client, tablaItems, padreId, signo) => {
    const columnaPadre = { venta_items: "venta_id", compra_items: "compra_id" }[tablaItems];
    if (!columnaPadre || ![1, -1].includes(signo)) {
      throw new Error("updateStockDesdeItems: parámetros no permitidos");
    }
    await client.query(
      `UPDATE productos p
     SET stock_actual = p.stock_actual + ${signo} * i.cantidad, updated_at = now()
     FROM (SELECT producto_id, SUM(cantidad) AS cantidad
           FROM ${tablaItems} WHERE ${columnaPadre} = $1 GROUP BY producto_id) AS i
     WHERE p.id = i.producto_id`,
      [padreId]
    );
  },

  // Ajuste manual de stock (el cliente carga el valor absoluto que tiene, no un delta)
  updateStockManual: async (id, stock_actual, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE productos
     SET stock_actual = $1, updated_at = now()
     WHERE id = $2 AND activo = true AND usuario_id = $3
     RETURNING *`,
      [stock_actual, id, usuario_id]
    );
    return rows[0] || null;
  },
};

export default ProductoModel;