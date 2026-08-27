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

const METODOS_PAGO_VALIDOS = ["efectivo", "transferencia", "tarjeta", "otro"];
const CANALES_VALIDOS = ["directa", "mercadolibre"];

/**
 * Crea una venta completa con múltiples productos en una sola transacción.
 * @param {Object} data - {
 *   tipo: 'minorista'|'mayorista',
 *   observaciones,
 *   metodo_pago: 'efectivo'|'transferencia'|'tarjeta'|'otro'|undefined,
 *   canal: 'directa'|'mercadolibre'|undefined,
 *   comision: número (ej. comisión de MercadoLibre) descontado de la ganancia|undefined,
 *   items: [{ producto_id, cantidad, variante_id? }]
 * }
 * @returns {Object} - La venta creada con sus ítems y ganancia
 */
const crearVenta = async ({ tipo, observaciones, metodo_pago, canal, comision, items, usuario_id }) => {
  // Validaciones básicas
  if (!tipo || !["minorista", "mayorista"].includes(tipo)) {
    throw { status: 400, message: "El tipo de venta debe ser 'minorista' o 'mayorista'." };
  }

  if (metodo_pago && !METODOS_PAGO_VALIDOS.includes(metodo_pago)) {
    throw { status: 400, message: `metodo_pago debe ser uno de: ${METODOS_PAGO_VALIDOS.join(", ")}.` };
  }

  if (canal && !CANALES_VALIDOS.includes(canal)) {
    throw { status: 400, message: `canal debe ser uno de: ${CANALES_VALIDOS.join(", ")}.` };
  }

  if (comision !== undefined && comision !== null && Number(comision) < 0) {
    throw { status: 400, message: "La comisión no puede ser negativa." };
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
        // checkStock bloquea la fila con FOR UPDATE, verifica que sea del usuario autenticado
        // y lanza error si no hay stock suficiente
        const variante = await VarianteModel.checkStock(client, item.variante_id, item.cantidad, usuario_id);

        const precioBase =
          tipo === "mayorista" ? variante.precio_mayorista : variante.precio_minorista;

        const precioDefault = precioBase != null ? precioBase + (variante.precio_extra ?? 0) : null;

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
           WHERE id = $1 AND activo = true AND usuario_id = $2
           FOR UPDATE`,
          [item.producto_id, usuario_id]
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

      if (precio_unitario === null || precio_unitario === undefined || Number.isNaN(precio_unitario) || precio_unitario <= 0) {
        throw {
          status: 400,
          message: `Falta el precio para el producto ${item.producto_id}${tipo === "mayorista" ? " (no tiene precio mayorista cargado, hay que indicarlo a mano)" : ""}.`,
        };
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

    // Descuenta la comisión del canal (ej. MercadoLibre) de la ganancia total
    const comisionNumerica = Number(comision) || 0;
    const gananciaNeta = ganancia - comisionNumerica;

    // Insertar cabecera de venta
    const venta = await VentaModel.insertCabecera(client, {
      tipo,
      total,
      ganancia: gananciaNeta,
      observaciones,
      metodo_pago,
      canal,
      comision: comisionNumerica,
      usuario_id,
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

/**
 * Anula una venta y repone el stock descontado en su momento.
 * Nota: venta_items no guarda variante_id (limitación actual del esquema),
 * así que la reposición siempre se hace sobre el stock del producto base.
 * Hoy esto es correcto para el 100% de las ventas reales, porque el sistema
 * de variantes todavía no está conectado a ninguna pantalla del frontend.
 */
const eliminarVenta = async (id, usuario_id) => {
  const client = await VentaModel.getClient();

  try {
    await client.query("BEGIN");

    const { rows: ventaRows } = await client.query(
      `SELECT id FROM ventas WHERE id = $1 AND usuario_id = $2 AND activo = true FOR UPDATE`,
      [id, usuario_id]
    );

    if (!ventaRows[0]) {
      throw { status: 404, message: "Venta no encontrada o ya fue eliminada." };
    }

    const { rows: items } = await client.query(
      `SELECT producto_id, cantidad FROM venta_items WHERE venta_id = $1`,
      [id]
    );

    for (const item of items) {
      await ProductoModel.updateStock(item.producto_id, item.cantidad, client);
    }

    const { rows: ventaEliminada } = await client.query(
      `UPDATE ventas SET activo = false WHERE id = $1 RETURNING id, total, fecha`,
      [id]
    );

    await client.query("COMMIT");
    return ventaEliminada[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { crearVenta, eliminarVenta };