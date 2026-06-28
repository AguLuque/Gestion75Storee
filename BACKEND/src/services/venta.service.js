// src/services/venta.service.js
// Lógica de negocio para crear una venta completa:
// 1. Abre una transacción
// 2. Verifica stock del producto o de la variante (con FOR UPDATE)
// 3. Inserta la cabecera de venta
// 4. Inserta cada ítem con snapshot del costo
// 5. Descuenta el stock (del producto o de la variante según corresponda)
// 6. Calcula la ganancia total
// 7. Confirma o revierte

import VentaModel from "../models/venta.model.js";
import ProductoModel from "../models/producto.model.js";
import VarianteModel from "../models/variante.model.js";

/**
 * Crea una venta completa con múltiples productos en una sola transacción.
 * @param {Object} data - {
 *   tipo: 'minorista'|'mayorista',
 *   observaciones,
 *   items: [{ producto_id, cantidad, variante_id? }]
 * }
 * @returns {Object} - La venta creada con sus ítems y ganancia
 */
const crearVenta = async ({ tipo, observaciones, items }) => {
  // Validaciones básicas
  if (!tipo || !["minorista", "mayorista"].includes(tipo)) {
    throw { status: 400, message: "El tipo de venta debe ser 'minorista' o 'mayorista'." };
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: "Se requiere al menos un ítem en la venta." };
  }

  for (const item of items) {
    if (!item.producto_id || !item.cantidad) {
      throw { status: 400, message: "Cada ítem debe tener producto_id y cantidad." };
    }
    if (item.cantidad <= 0) {
      throw { status: 400, message: "La cantidad debe ser mayor a 0." };
    }
  }

  // Iniciar transacción
  const client = await VentaModel.getClient();

  try {
    await client.query("BEGIN");

    let total = 0;
    let ganancia = 0;
    const itemsDetallados = [];

    for (const item of items) {
      let precio_unitario;
      let costo_unitario;

      if (item.variante_id) {
        // — Producto CON variante —
        // checkStock bloquea la fila con FOR UPDATE y lanza error si no hay stock suficiente
        const variante = await VarianteModel.checkStock(client, item.variante_id, item.cantidad);

        const precioBase =
          tipo === "mayorista" ? variante.precio_mayorista : variante.precio_minorista;

        const precioDefault = precioBase + (variante.precio_extra ?? 0);

        precio_unitario =
          item.precio_unitario !== undefined && item.precio_unitario !== null
            ? Number(item.precio_unitario)
            : precioDefault;

        costo_unitario = variante.precio_compra;
      } else {
        // — Producto SIN variante —
        const { rows: productoRows } = await client.query(
          `SELECT stock_actual, precio_compra, precio_minorista, precio_mayorista
           FROM productos
           WHERE id = $1 AND activo = true
           FOR UPDATE`,
          [item.producto_id]
        );

        if (!productoRows[0]) {
          throw { status: 404, message: `Producto ${item.producto_id} no encontrado.` };
        }

        const producto = productoRows[0];

        if (producto.stock_actual < item.cantidad) {
          throw {
            status: 400,
            message: `Stock insuficiente para producto ${item.producto_id}. Disponible: ${producto.stock_actual}`,
          };
        }

        const precioDefault =
          tipo === "mayorista" ? producto.precio_mayorista : producto.precio_minorista;

        precio_unitario =
          item.precio_unitario !== undefined && item.precio_unitario !== null
            ? Number(item.precio_unitario)
            : precioDefault;

        costo_unitario = producto.precio_compra;
      }

      const subtotal = item.cantidad * precio_unitario;
      const ganancia_item = item.cantidad * (precio_unitario - costo_unitario);

      total += subtotal;
      ganancia += ganancia_item;

      itemsDetallados.push({
        producto_id: item.producto_id,
        variante_id: item.variante_id ?? null,
        cantidad: item.cantidad,
        precio_unitario,
        costo_unitario,
      });
    }

    // Insertar cabecera de venta
    const venta = await VentaModel.insertCabecera(client, {
      tipo,
      total,
      ganancia,
      observaciones,
    });

    // Insertar ítems y descontar stock
    const itemsCreados = [];
    for (const item of itemsDetallados) {
      const itemCreado = await VentaModel.insertItem(client, {
        venta_id: venta.id,
        ...item,
      });
      itemsCreados.push(itemCreado);

      if (item.variante_id) {
        // Descontar stock de la variante
        await VarianteModel.updateStock(item.variante_id, -item.cantidad, client);
      } else {
        // Descontar stock del producto base
        await ProductoModel.updateStock(item.producto_id, -item.cantidad, client);
      }
    }

    await client.query("COMMIT");

    return { ...venta, items: itemsCreados };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { crearVenta };