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
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import { CATEGORIAS_INGRESO, CATEGORIAS_COSTO } from "../constants/finanzas.js";

const METODOS_PAGO_VALIDOS = ["efectivo", "transferencia", "tarjeta", "otro"];
const CANALES_VALIDOS = ["directa", "mercadolibre"];
const ESTADOS_COBRO_VALIDOS = ["cobrado", "pendiente"];

/**
 * Crea una venta completa con múltiples productos en una sola transacción.
 * @param {Object} data - {
 *   tipo: 'minorista'|'mayorista',
 *   observaciones,
 *   metodo_pago: 'efectivo'|'transferencia'|'tarjeta'|'otro'|undefined,
 *   canal: 'directa'|'mercadolibre'|undefined,
 *   comision: número (ej. comisión de MercadoLibre) descontado de la ganancia|undefined,
 *   cuenta_dinero_id: opcional — si se indica, genera automáticamente el movimiento
 *     financiero de ingreso correspondiente a la venta dentro de la misma transacción,
 *   estado_cobro: 'cobrado' (default, comportamiento actual sin cambios) | 'pendiente'
 *     (venta a crédito: no genera movimiento financiero, en cambio genera una fila
 *     en cuentas_por_cobrar por el total)|undefined,
 *   cliente_nombre, fecha_vencimiento: solo relevantes si estado_cobro es 'pendiente',
 *   items: [{ producto_id, cantidad, variante_id? }]
 * }
 * @returns {Object} - La venta creada con sus ítems y ganancia
 */
const crearVenta = async ({ tipo, observaciones, metodo_pago, canal, comision, cuenta_dinero_id, estado_cobro, cliente_nombre, fecha_vencimiento, items, usuario_id }) => {
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

  if (estado_cobro && !ESTADOS_COBRO_VALIDOS.includes(estado_cobro)) {
    throw { status: 400, message: `estado_cobro debe ser uno de: ${ESTADOS_COBRO_VALIDOS.join(", ")}.` };
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
      estado_cobro,
      usuario_id,
    });

    // Si la venta es a crédito (estado_cobro 'pendiente'), todavía no hay caja
    // involucrada: en vez de un movimiento financiero se genera una cuenta por
    // cobrar por el total. Si la venta se cobra en el momento (comportamiento
    // actual, estado_cobro default 'cobrado'), se genera el movimiento de
    // ingreso automáticamente (y el de comisión si corresponde).
    if (venta.estado_cobro === "pendiente") {
      await CuentaPorCobrarModel.createEnTransaccion(client, {
        venta_id: venta.id,
        cliente_nombre: cliente_nombre ?? null,
        monto_total: total,
        fecha_emision: venta.fecha,
        fecha_vencimiento: fecha_vencimiento ?? null,
        usuario_id,
      });
    } else if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: venta.fecha,
        tipo: "ingreso",
        categoria: CATEGORIAS_INGRESO.VENTA_PRODUCTOS,
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "venta",
        origen_id: venta.id,
        descripcion: `Venta #${venta.id}`,
        usuario_id,
      });

      if (comisionNumerica > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: venta.fecha,
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.COMISIONES,
          monto: comisionNumerica,
          cuenta_dinero_id,
          origen_tipo: "venta",
          origen_id: venta.id,
          descripcion: `Comisión venta #${venta.id}`,
          usuario_id,
        });
      }
    }

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

    const { rows: movimientosOriginales } = await client.query(
      `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    for (const mov of movimientosOriginales) {
      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: new Date().toISOString().slice(0, 10),
        tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
        categoria: mov.categoria,
        monto: mov.monto,
        cuenta_dinero_id: mov.cuenta_dinero_id,
        origen_tipo: "venta",
        origen_id: id,
        descripcion: `Reversión por anulación de venta #${id}`,
        usuario_id,
      });
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