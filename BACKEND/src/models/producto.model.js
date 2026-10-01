// src/models/producto.model.js
import pool from "../config/db.js";
import { agruparCantidades } from "../utils/cantidades.js";

const ProductoModel = {
  // Obtener todos los productos activos con el nombre de su categoría.
  // ultimo_precio_compra: lo que se pagó por unidad en la última compra (sin
  // envío), para precargar el formulario de compras; precio_compra es el costo
  // promedio con envío incluido.
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(`
    SELECT p.*, c.nombre AS categoria_nombre,
      (SELECT ci.precio_unitario
       FROM compra_items ci
       JOIN compras co ON co.id = ci.compra_id
       WHERE ci.producto_id = p.id AND co.activo = true
       ORDER BY co.fecha DESC, ci.id DESC
       LIMIT 1) AS ultimo_precio_compra
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

  // Al anular una venta: devuelve al stock todo lo que se había vendido, en una sola consulta.
  reponerStockDeVenta: async (client, venta_id) => {
    await client.query(
      `UPDATE productos p
     SET stock_actual = p.stock_actual + i.cantidad, updated_at = now()
     FROM (SELECT producto_id, SUM(cantidad) AS cantidad
           FROM venta_items WHERE venta_id = $1 GROUP BY producto_id) AS i
     WHERE p.id = i.producto_id`,
      [venta_id]
    );
  },

  // Entrada de una compra: suma el stock y recalcula el costo (precio_compra)
  // como promedio ponderado entre el stock que había y lo que entra.
  //   costo nuevo = (stock anterior × costo anterior + valor que entra) / (stock anterior + cantidad)
  // "valor que entra" = cantidad × precio unitario + la parte del envío del renglón.
  // Un stock anterior negativo se toma como 0. ajustes: [{ id, cantidad, valor }]
  sumarCompra: async (client, ajustes) => {
    const porProducto = new Map();
    for (const { id, cantidad, valor } of ajustes) {
      const previo = porProducto.get(String(id)) ?? { cantidad: 0, valor: 0 };
      porProducto.set(String(id), { cantidad: previo.cantidad + Number(cantidad), valor: previo.valor + Number(valor) });
    }
    if (porProducto.size === 0) return;
    await client.query(
      `UPDATE productos p
     SET precio_compra = CASE
           WHEN GREATEST(p.stock_actual, 0) + d.cantidad > 0
           THEN ROUND((GREATEST(p.stock_actual, 0) * COALESCE(p.precio_compra, 0) + d.valor)
                      / (GREATEST(p.stock_actual, 0) + d.cantidad), 2)
           ELSE p.precio_compra
         END,
         stock_actual = p.stock_actual + d.cantidad,
         updated_at = now()
     FROM unnest($1::bigint[], $2::numeric[], $3::numeric[]) AS d(id, cantidad, valor)
     WHERE p.id = d.id`,
      [[...porProducto.keys()], [...porProducto.values()].map((v) => v.cantidad), [...porProducto.values()].map((v) => v.valor)]
    );
  },

  // Deshace la entrada de una compra ya guardada (al editarla o anularla):
  // resta su stock y, si revertirCosto, saca su valor del costo promedio
  //   costo anterior = (stock × costo − valor de la compra) / (stock − cantidad)
  // Si ya no queda stock de esa compra (se vendió todo) o el cálculo daría un
  // valor no positivo, el costo queda como está: no hay stock que valuar.
  // revertirCosto es false para compras anteriores al reparto del envío, que
  // nunca tocaron el costo.
  revertirCompra: async (client, compra_id, revertirCosto) => {
    await client.query(
      `UPDATE productos p
     SET precio_compra = CASE
           WHEN $2 AND p.stock_actual - i.cantidad > 0
                AND p.stock_actual * COALESCE(p.precio_compra, 0) - i.valor > 0
           THEN ROUND((p.stock_actual * COALESCE(p.precio_compra, 0) - i.valor) / (p.stock_actual - i.cantidad), 2)
           ELSE p.precio_compra
         END,
         stock_actual = p.stock_actual - i.cantidad,
         updated_at = now()
     FROM (SELECT producto_id,
                  SUM(cantidad) AS cantidad,
                  SUM(cantidad * precio_unitario + envio_asignado) AS valor
           FROM compra_items WHERE compra_id = $1 GROUP BY producto_id) AS i
     WHERE p.id = i.producto_id`,
      [compra_id, revertirCosto]
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