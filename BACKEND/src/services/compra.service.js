import CompraModel from "../models/compra.model.js";
import ProductoModel from "../models/producto.model.js";
import VarianteModel from "../models/variante.model.js";

const TIPOS_COMPRA_VALIDOS = ["local", "nacional", "internacional"];

const validarCabecera = ({ tipo, costo_envio }) => {
  if (tipo && !TIPOS_COMPRA_VALIDOS.includes(tipo)) {
    throw { status: 400, message: `tipo debe ser uno de: ${TIPOS_COMPRA_VALIDOS.join(", ")}.` };
  }
  if (costo_envio !== undefined && costo_envio !== null && Number(costo_envio) < 0) {
    throw { status: 400, message: "El costo de envío no puede ser negativo." };
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

const crearCompra = async ({ proveedor_id, observaciones, tipo, costo_envio, items, usuario_id }) => {
  validarCabecera({ tipo, costo_envio });
  validarItems(items);

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    for (const item of items) {
      await verificarPropiedad(client, item, usuario_id);
    }

    const compra = await CompraModel.insertCabecera(client, {
      proveedor_id, total, observaciones, tipo, costo_envio, usuario_id,
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

    await client.query("COMMIT");
    return { ...compra, items: itemsCreados };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const editarCompra = async (id, { proveedor_id, observaciones, tipo, costo_envio, items, usuario_id }) => {
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
