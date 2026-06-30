import CompraModel from "../models/compra.model.js";
import ProductoModel from "../models/producto.model.js";
import VarianteModel from "../models/variante.model.js";

const crearCompra = async ({ proveedor_id, observaciones, items, usuario_id }) => {
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

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    const compra = await CompraModel.insertCabecera(client, {
      proveedor_id, total, observaciones, usuario_id,
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

const editarCompra = async (id, { proveedor_id, observaciones, items, usuario_id }) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: "Se requiere al menos un ítem." };
  }

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const client = await CompraModel.getClient();

  try {
    await client.query("BEGIN");

    const compraAnterior = await CompraModel.getById(id, usuario_id);
    for (const item of compraAnterior.items) {
      await ProductoModel.updateStock(item.producto_id, -item.cantidad, client);
    }

    await CompraModel.deleteItems(client, id);
    await CompraModel.updateCabecera(client, id, { proveedor_id, total, observaciones }, usuario_id);
    for (const item of items) {
      await CompraModel.insertItem(client, {
        compra_id: id,
        producto_id: item.producto_id,
        variante_id: item.variante_id ?? null,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      });
      await ProductoModel.updateStock(item.producto_id, item.cantidad, client);
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