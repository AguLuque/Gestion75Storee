// src/services/venta.service.js
// Lógica de negocio para crear una venta completa:
// 1. Abre una transacción
// 2. Verifica stock de cada producto (con FOR UPDATE)
// 3. Inserta la cabecera de venta
// 4. Inserta cada ítem con snapshot del costo
// 5. Descuenta el stock
// 6. Calcula la ganancia total
// 7. Confirma o revierte

import VentaModel from "../models/venta.model.js";
import ProductoModel from "../models/producto.model.js";

/**
 * Crea una venta completa con múltiples productos en una sola transacción.
 * @param {Object} data - { tipo: 'minorista'|'mayorista', observaciones, items: [{ producto_id, cantidad }] }
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

    // Para cada ítem: verificar stock y obtener precios
    for (const item of items) {
      // Obtener producto con bloqueo (FOR UPDATE previene race conditions)
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

      // Verificar stock suficiente
      if (producto.stock_actual < item.cantidad) {
        throw {
          status: 400,
          message: `Stock insuficiente para producto ${item.producto_id}. Disponible: ${producto.stock_actual}`,
        };
      }

      // Determinar precio según tipo de venta
      const precio_unitario =
        tipo === "mayorista" ? producto.precio_mayorista : producto.precio_minorista;
      const costo_unitario = producto.precio_compra;

      const subtotal = item.cantidad * precio_unitario;
      const ganancia_item = item.cantidad * (precio_unitario - costo_unitario);

      total += subtotal;
      ganancia += ganancia_item;

      itemsDetallados.push({
        producto_id: item.producto_id,
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

      // Descontar stock (negativo = resta)
      await ProductoModel.updateStock(item.producto_id, -item.cantidad, client);
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