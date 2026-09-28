import CompraModel from "../models/compra.model.js";
import ProductoModel from "../models/producto.model.js";
import VarianteModel from "../models/variante.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import { fechaArgentina } from "../utils/fechas.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import CuentaPorPagarModel from "../models/cuentaPorPagar.model.js";
import { CATEGORIAS_COSTO } from "../constants/finanzas.js";

const TIPOS_COMPRA_VALIDOS = ["local", "nacional", "internacional"];
const ESTADOS_PAGO_VALIDOS = ["pagado", "pendiente"];

const validarCabecera = ({ tipo, costo_envio, estado_pago }) => {
  if (tipo && !TIPOS_COMPRA_VALIDOS.includes(tipo)) {
    throw { status: 400, message: `tipo debe ser uno de: ${TIPOS_COMPRA_VALIDOS.join(", ")}.` };
  }
  if (costo_envio !== undefined && costo_envio !== null && Number(costo_envio) < 0) {
    throw { status: 400, message: "El costo de envío no puede ser negativo." };
  }
  if (estado_pago && !ESTADOS_PAGO_VALIDOS.includes(estado_pago)) {
    throw { status: 400, message: `estado_pago debe ser uno de: ${ESTADOS_PAGO_VALIDOS.join(", ")}.` };
  }
};

const validarItems = (items) => {
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
};

// Verifica que el producto/variante del ítem pertenezca al usuario autenticado
// y bloquea la fila (FOR UPDATE) para la actualización de stock que sigue.
const verificarPropiedad = async (client, item, usuario_id) => {
  if (item.variante_id) {
    const { rows } = await client.query(
      `SELECT v.id FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.id = $1 AND p.usuario_id = $2
       FOR UPDATE OF v`,
      [item.variante_id, usuario_id]
    );
    if (!rows[0]) {
      throw { status: 404, message: `Variante ${item.variante_id} no encontrada.` };
    }
  } else {
    const { rows } = await client.query(
      `SELECT id FROM productos WHERE id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
      [item.producto_id, usuario_id]
    );
    if (!rows[0]) {
      throw { status: 404, message: `Producto ${item.producto_id} no encontrado.` };
    }
  }
};

const redondear = (n) => Math.round(n * 100) / 100;

// Cuenta del pago vigente de una compra: la del último egreso de mercadería
// (el de id más alto; las reversiones son ingresos y las ediciones anteriores
// dejan egresos más viejos). null si la compra nunca se pagó desde una cuenta.
const cuentaDelPagoVigente = (movimientos) => {
  const ultimoEgreso = movimientos
    .filter((m) => m.tipo === "egreso" && m.categoria === CATEGORIAS_COSTO.COSTO_MERCADERIA)
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  return ultimoEgreso?.cuenta_dinero_id ?? null;
};

const crearCompra = async ({ proveedor_id, observaciones, tipo, costo_envio, cuenta_dinero_id, estado_pago, items, usuario_id }) => {
  validarCabecera({ tipo, costo_envio, estado_pago });
  validarItems(items);

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    for (const item of items) {
      await verificarPropiedad(client, item, usuario_id);
    }

    const compra = await CompraModel.insertCabecera(client, {
      proveedor_id, total, observaciones, tipo, costo_envio, estado_pago, usuario_id,
    });
    const itemsCreados = [];
    for (const item of items) {
      const itemCreado = await CompraModel.insertItem(client, {
        compra_id: compra.id,
        producto_id: item.producto_id,
        variante_id: item.variante_id ?? null,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      });
      itemsCreados.push(itemCreado);

      if (item.variante_id) {
        await VarianteModel.updateStock(item.variante_id, item.cantidad, client);
      } else {
        await ProductoModel.updateStock(item.producto_id, item.cantidad, client);
      }
    }

    if (compra.estado_pago === "pendiente") {
      await CuentaPorPagarModel.createEnTransaccion(client, {
        compra_id: compra.id,
        proveedor_id: proveedor_id ?? null,
        monto_total: total + (Number(costo_envio) || 0),
        fecha_emision: fechaArgentina(compra.fecha),
        fecha_vencimiento: null,
        usuario_id,
      });
    } else if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: fechaArgentina(compra.fecha),
        tipo: "egreso",
        categoria: CATEGORIAS_COSTO.COSTO_MERCADERIA,
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "compra",
        origen_id: compra.id,
        descripcion: `Compra #${compra.id}`,
        usuario_id,
      });

      const costoEnvioNumerico = Number(costo_envio) || 0;
      if (costoEnvioNumerico > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: fechaArgentina(compra.fecha),
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.FLETE,
          monto: costoEnvioNumerico,
          cuenta_dinero_id,
          origen_tipo: "compra",
          origen_id: compra.id,
          descripcion: `Flete compra #${compra.id}`,
          usuario_id,
        });
      }
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

const editarCompra = async (id, { proveedor_id, observaciones, tipo, costo_envio, cuenta_dinero_id, items, usuario_id }) => {
  validarCabecera({ tipo, costo_envio });
  validarItems(items);

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    // Bloquea la compra para serializar ediciones concurrentes de la misma compra
    const { rows: compraLock } = await client.query(
      `SELECT id FROM compras WHERE id = $1 AND usuario_id = $2 AND activo = true FOR UPDATE`,
      [id, usuario_id]
    );
    if (!compraLock[0]) {
      throw { status: 404, message: "Compra no encontrada." };
    }

    // Compra a crédito: la deuda vive en su cuenta por pagar, que se ajusta al
    // nuevo total (conservando lo ya pagado). No se registra ningún pago acá:
    // eso pasa solo desde "Por pagar". Se valida antes de tocar stock.
    const { rows: cxpRows } = await client.query(
      `SELECT * FROM cuentas_por_pagar WHERE compra_id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );
    const cuentaPorPagar = cxpRows[0] || null;

    if (cuentaPorPagar) {
      const yaPagado = redondear(Number(cuentaPorPagar.monto_total) - Number(cuentaPorPagar.saldo_pendiente));
      const nuevoTotal = redondear(total + (Number(costo_envio) || 0));
      if (nuevoTotal < yaPagado) {
        throw {
          status: 400,
          message: `Ya pagaste $${yaPagado.toLocaleString("es-AR")} de esta compra: el nuevo total ($${nuevoTotal.toLocaleString("es-AR")}) no puede ser menor.`,
        };
      }
      const nuevoSaldo = redondear(nuevoTotal - yaPagado);
      const nuevoEstado = nuevoSaldo === 0 ? "pagado" : yaPagado > 0 ? "parcial" : "pendiente";

      await client.query(
        `UPDATE cuentas_por_pagar
         SET monto_total = $1, saldo_pendiente = $2, estado = $3, proveedor_id = $4
         WHERE id = $5 AND usuario_id = $6`,
        [nuevoTotal, nuevoSaldo, nuevoEstado, proveedor_id ?? null, cuentaPorPagar.id, usuario_id]
      );
    }

    for (const item of items) {
      await verificarPropiedad(client, item, usuario_id);
    }

    const compraAnterior = await CompraModel.getById(id, usuario_id);

    // Nota: compra_items no guarda variante_id (limitación actual del esquema), así que
    // item.variante_id acá siempre es undefined hoy. Se deja la rama lista para cuando
    // se persista esa columna — por ahora se comporta igual que antes para todo dato real.
    for (const item of compraAnterior.items) {
      if (item.variante_id) {
        await VarianteModel.updateStock(item.variante_id, -item.cantidad, client);
      } else {
        await ProductoModel.updateStock(item.producto_id, -item.cantidad, client);
      }
    }

    await CompraModel.deleteItems(client, id);
    await CompraModel.updateCabecera(client, id, { proveedor_id, total, observaciones, tipo, costo_envio }, usuario_id);
    for (const item of items) {
      await CompraModel.insertItem(client, {
        compra_id: id,
        producto_id: item.producto_id,
        variante_id: item.variante_id ?? null,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      });

      if (item.variante_id) {
        await VarianteModel.updateStock(item.variante_id, item.cantidad, client);
      } else {
        await ProductoModel.updateStock(item.producto_id, item.cantidad, client);
      }
    }

    const { rows: movimientosOriginales } = await client.query(
      `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    for (const mov of movimientosOriginales) {
      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: fechaArgentina(),
        tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
        categoria: mov.categoria,
        monto: mov.monto,
        cuenta_dinero_id: mov.cuenta_dinero_id,
        origen_tipo: "compra",
        origen_id: id,
        descripcion: `Reversión por edición de compra #${id}`,
        usuario_id,
      });
    }

    // Cuenta con la que se vuelve a registrar el pago. Si no se indica una
    // nueva, se mantiene la del pago vigente: sin esto, editar una compra
    // pagada (el formulario no manda cuenta) revertía el pago y no lo volvía
    // a registrar, y la cuenta quedaba con más plata de la real.
    // En una compra a crédito no se registra pago aunque llegue una cuenta:
    // antes quedaba contada dos veces (egreso + deuda pendiente).
    const cuentaDestino = cuentaPorPagar
      ? null
      : cuenta_dinero_id || cuentaDelPagoVigente(movimientosOriginales);

    if (cuentaDestino) {
      const cuenta = await CuentaDineroModel.getById(cuentaDestino, usuario_id);
      if (!cuenta) {
        throw {
          status: 400,
          message: cuenta_dinero_id
            ? "La cuenta de dinero indicada no existe o no pertenece al usuario."
            : "La cuenta con la que se pagó esta compra ya no existe: elegí otra cuenta que paga.",
        };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: fechaArgentina(),
        tipo: "egreso",
        categoria: CATEGORIAS_COSTO.COSTO_MERCADERIA,
        monto: total,
        cuenta_dinero_id: cuentaDestino,
        origen_tipo: "compra",
        origen_id: id,
        descripcion: `Compra #${id} (editada)`,
        usuario_id,
      });

      const costoEnvioNumerico = Number(costo_envio) || 0;
      if (costoEnvioNumerico > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: fechaArgentina(),
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.FLETE,
          monto: costoEnvioNumerico,
          cuenta_dinero_id: cuentaDestino,
          origen_tipo: "compra",
          origen_id: id,
          descripcion: `Flete compra #${id} (editada)`,
          usuario_id,
        });
      }
    }

    await client.query("COMMIT");
    return await CompraModel.getById(id, usuario_id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const eliminarCompra = async (id, usuario_id) => {
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    const { rows: compraRows } = await client.query(
      `SELECT id FROM compras WHERE id = $1 AND usuario_id = $2 AND activo = true FOR UPDATE`,
      [id, usuario_id]
    );

    if (!compraRows[0]) {
      throw { status: 404, message: "Compra no encontrada o ya fue eliminada." };
    }

    const { rows: items } = await client.query(
      `SELECT producto_id, cantidad FROM compra_items WHERE compra_id = $1`,
      [id]
    );

    for (const item of items) {
      await ProductoModel.updateStock(item.producto_id, -item.cantidad, client);
    }

    const { rows: movimientosOriginales } = await client.query(
      `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    for (const mov of movimientosOriginales) {
      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: fechaArgentina(),
        tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
        categoria: mov.categoria,
        monto: mov.monto,
        cuenta_dinero_id: mov.cuenta_dinero_id,
        origen_tipo: "compra",
        origen_id: id,
        descripcion: `Reversión por anulación de compra #${id}`,
        usuario_id,
      });
    }

    await client.query(
      `UPDATE cuentas_por_pagar SET activo = false WHERE compra_id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );

    const { rows: compraEliminada } = await client.query(
      `UPDATE compras SET activo = false WHERE id = $1 RETURNING id, total, fecha`,
      [id]
    );

    await client.query("COMMIT");
    return compraEliminada[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { crearCompra, editarCompra, eliminarCompra };
