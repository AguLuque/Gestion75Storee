import CompraModel from "../models/compra.model.js";
import ProductoModel from "../models/producto.model.js";
import VarianteModel from "../models/variante.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
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
        fecha_emision: compra.fecha,
        fecha_vencimiento: null,
        usuario_id,
      });
    } else if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: compra.fecha,
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
          fecha: compra.fecha,
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
      `SELECT id FROM compras WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );
    if (!compraLock[0]) {
      throw { status: 404, message: "Compra no encontrada." };
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
        fecha: new Date().toISOString().slice(0, 10),
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

    if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "egreso",
        categoria: CATEGORIAS_COSTO.COSTO_MERCADERIA,
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "compra",
        origen_id: id,
        descripcion: `Compra #${id} (editada)`,
        usuario_id,
      });

      const costoEnvioNumerico = Number(costo_envio) || 0;
      if (costoEnvioNumerico > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: new Date().toISOString().slice(0, 10),
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.FLETE,
          monto: costoEnvioNumerico,
          cuenta_dinero_id,
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

export default { crearCompra, editarCompra };
