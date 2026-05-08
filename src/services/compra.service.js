// src/services/compra.service.js
// Lógica de negocio para crear una compra completa:
// 1. Abre una transacción
// 2. Inserta la cabecera de compra
// 3. Inserta cada ítem
// 4. Aumenta el stock de cada producto
// 5. Confirma o revierte la transacción

import CompraModel from "../models/compra.model.js";
import ProductoModel from "../models/producto.model.js";

/**
 * Crea una compra completa con múltiples productos en una sola transacción.
 * @param {Object} data - { proveedor_id, observaciones, items: [{ producto_id, cantidad, precio_unitario }] }
 * @returns {Object} - La compra creada con sus ítems
 */
const crearCompra = async ({ proveedor_id, observaciones, items }) => {
  // Validaciones previas a la transacción
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: "Se requiere al menos un ítem en la compra." };
  }

  for (const item of items) {
    if (!item.producto_id || !item.cantidad || !item.precio_unitario) {
      throw { status: 400, message: "Cada ítem debe tener producto_id, cantidad y precio_unitario." };
    }
    if (item.cantidad <= 0) {
      throw { status: 400, message: "La cantidad debe ser mayor a 0." };
    }
    if (item.precio_unitario < 0) {
      throw { status: 400, message: "El precio unitario no puede ser negativo." };
    }
  }

  // Calcular el total de la compra
  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);

  // Iniciar transacción
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    // 1. Insertar cabecera
    const compra = await CompraModel.insertCabecera(client, {
      proveedor_id,
      total,
      observaciones,
    });

    // 2. Insertar ítems y actualizar stock
    const itemsCreados = [];
    for (const item of items) {
      // Insertar ítem de compra
      const itemCreado = await CompraModel.insertItem(client, {
        compra_id: compra.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      });
      itemsCreados.push(itemCreado);

      // Aumentar stock del producto
      await ProductoModel.updateStock(item.producto_id, item.cantidad, client);
    }

    await client.query("COMMIT");

    return { ...compra, items: itemsCreados };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { crearCompra };