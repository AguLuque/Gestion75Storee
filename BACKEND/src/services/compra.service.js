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
// Cómo se reparte el costo de envío entre los productos de la compra
export const REPARTOS_ENVIO = ["valor", "unidad", "peso"];

const validarCabecera = ({ tipo, costo_envio, estado_pago, reparto_envio }) => {
  if (reparto_envio && !REPARTOS_ENVIO.includes(reparto_envio)) {
    throw { status: 400, message: `reparto_envio debe ser uno de: ${REPARTOS_ENVIO.join(", ")}.` };
  }
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
    if (item.peso !== undefined && item.peso !== null && item.peso !== "" && !(Number(item.peso) >= 0)) {
      throw { status: 400, message: "El peso no puede ser negativo." };
    }
  }
};

// Reparte el costo de envío entre los renglones de la compra y devuelve la
// parte de cada uno (en $, para todas sus unidades):
//   valor:  en proporción a lo que cuesta el renglón (cantidad × precio)
//   unidad: lo mismo por cada unidad, sin importar el precio
//   peso:   en proporción a los kilos del renglón
// Se trabaja en centavos y el último renglón absorbe el redondeo, así la suma
// da exactamente el envío.
export const repartirEnvio = (items, costoEnvio, reparto) => {
  const envioCentavos = Math.round((Number(costoEnvio) || 0) * 100);
  if (envioCentavos <= 0) return items.map(() => 0);

  const bases = items.map((i) => {
    if (reparto === "unidad") return Number(i.cantidad);
    if (reparto === "peso") return Number(i.peso) || 0;
    return Number(i.cantidad) * Number(i.precio_unitario);
  });
  const totalBase = bases.reduce((a, b) => a + b, 0);
  if (totalBase <= 0) {
    throw {
      status: 400,
      message: reparto === "peso"
        ? "Para repartir el envío por peso, cargá los kilos de los productos."
        : "No se puede repartir el envío entre estos productos.",
    };
  }

  const ultimo = bases.findLastIndex((b) => b > 0);
  let asignado = 0;
  return bases.map((base, idx) => {
    if (idx === ultimo) return (envioCentavos - asignado) / 100;
    const centavos = Math.round((envioCentavos * base) / totalBase);
    asignado += centavos;
    return centavos / 100;
  });
};

// Ítems listos para guardar: con la parte del envío de cada renglón, y los
// kilos solo si se repartió por peso.
const prepararItems = (items, costo_envio, reparto) => {
  const envios = repartirEnvio(items, costo_envio, reparto);
  return items.map((item, idx) => ({
    ...item,
    envio_asignado: envios[idx],
    peso: reparto === "peso" ? Number(item.peso) || 0 : null,
  }));
};

// Verifica que los productos/variantes de los ítems pertenezcan al usuario
// autenticado y bloquea las filas (FOR UPDATE) para la actualización de stock
// que sigue. Una consulta por tabla, no una por ítem.
const verificarPropiedad = async (client, items, usuario_id) => {
  const conVariante = items.filter((i) => i.variante_id);
  const sinVariante = items.filter((i) => !i.variante_id);
  const variantes = conVariante.length
    ? await VarianteModel.bloquearVarias(client, conVariante.map((i) => i.variante_id), usuario_id)
    : new Map();
  const productos = sinVariante.length
    ? await ProductoModel.bloquearVarios(client, sinVariante.map((i) => i.producto_id), usuario_id)
    : new Map();

  for (const item of items) {
    if (item.variante_id && !variantes.has(String(item.variante_id))) {
      throw { status: 404, message: `Variante ${item.variante_id} no encontrada.` };
    }
    if (!item.variante_id && !productos.has(String(item.producto_id))) {
      throw { status: 404, message: `Producto ${item.producto_id} no encontrado.` };
    }
  }
};

// Entrada de la mercadería: suma el stock y, en los productos, recalcula el
// costo promedio con lo pagado más la parte del envío. Las variantes solo
// suman stock: el costo es del producto base.
const entrarMercaderia = async (client, items) => {
  await VarianteModel.updateStockVarias(
    client,
    items.filter((i) => i.variante_id).map((i) => ({ id: i.variante_id, cantidad: i.cantidad }))
  );
  await ProductoModel.sumarCompra(
    client,
    items.filter((i) => !i.variante_id).map((i) => ({
      id: i.producto_id,
      cantidad: i.cantidad,
      valor: i.cantidad * i.precio_unitario + i.envio_asignado,
    }))
  );
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

const crearCompra = async ({ proveedor_id, observaciones, tipo, costo_envio, reparto_envio = "valor", cuenta_dinero_id, estado_pago, items: itemsRecibidos, usuario_id }) => {
  reparto_envio = reparto_envio || "valor";
  validarCabecera({ tipo, costo_envio, estado_pago, reparto_envio });
  validarItems(itemsRecibidos);
  const items = prepararItems(itemsRecibidos, costo_envio, reparto_envio);

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    await verificarPropiedad(client, items, usuario_id);

    const compra = await CompraModel.insertCabecera(client, {
      proveedor_id, total, observaciones, tipo, costo_envio, estado_pago, reparto_envio, usuario_id,
    });
    const itemsCreados = await CompraModel.insertItems(client, compra.id, items);
    await entrarMercaderia(client, items);

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

const editarCompra = async (id, { proveedor_id, observaciones, tipo, costo_envio, reparto_envio = "valor", cuenta_dinero_id, items: itemsRecibidos, usuario_id }) => {
  reparto_envio = reparto_envio || "valor";
  validarCabecera({ tipo, costo_envio, reparto_envio });
  validarItems(itemsRecibidos);
  const items = prepararItems(itemsRecibidos, costo_envio, reparto_envio);

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    // Bloquea la compra para serializar ediciones concurrentes de la misma compra
    const { rows: compraLock } = await client.query(
      `SELECT id, reparto_envio FROM compras WHERE id = $1 AND usuario_id = $2 AND activo = true FOR UPDATE`,
      [id, usuario_id]
    );
    if (!compraLock[0]) {
      throw { status: 404, message: "Compra no encontrada." };
    }
    // Compras anteriores al reparto del envío (reparto_envio NULL) nunca
    // tocaron el costo de los productos: al editarlas solo se revierte el stock.
    const costoAplicado = compraLock[0].reparto_envio !== null;

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

    await verificarPropiedad(client, items, usuario_id);

    // Deshace la versión anterior de la compra (stock y costo promedio) y
    // aplica la nueva, como si se hubiera cargado así desde el principio.
    // compra_items no guarda variante_id (limitación actual del esquema), así
    // que lo anterior siempre se revierte sobre el producto base, igual que antes.
    await ProductoModel.revertirCompra(client, id, costoAplicado);

    await CompraModel.deleteItems(client, id);
    await CompraModel.updateCabecera(client, id, { proveedor_id, total, observaciones, tipo, costo_envio, reparto_envio }, usuario_id);
    await CompraModel.insertItems(client, id, items);
    await entrarMercaderia(client, items);

    const movimientosOriginales = await MovimientoFinancieroModel.revertirOrigenEnTransaccion(client, {
      origen_tipo: "compra",
      origen_id: id,
      usuario_id,
      fecha: fechaArgentina(),
      descripcion: `Reversión por edición de compra #${id}`,
    });

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
      `SELECT id, reparto_envio FROM compras WHERE id = $1 AND usuario_id = $2 AND activo = true FOR UPDATE`,
      [id, usuario_id]
    );

    if (!compraRows[0]) {
      throw { status: 404, message: "Compra no encontrada o ya fue eliminada." };
    }

    // Saca el stock de la compra y su valor del costo promedio (las compras
    // anteriores al reparto del envío nunca tocaron el costo: solo stock).
    await ProductoModel.revertirCompra(client, id, compraRows[0].reparto_envio !== null);

    await MovimientoFinancieroModel.revertirOrigenEnTransaccion(client, {
      origen_tipo: "compra",
      origen_id: id,
      usuario_id,
      fecha: fechaArgentina(),
      descripcion: `Reversión por anulación de compra #${id}`,
    });

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
