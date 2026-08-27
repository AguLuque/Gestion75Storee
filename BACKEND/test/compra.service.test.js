// Tests de integración contra la base real de Supabase — ver la nota de seguridad
// en test/venta.service.test.js sobre por qué no se usa ROLLBACK acá.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import ProductoModel from "../src/models/producto.model.js";
import CompraService from "../src/services/compra.service.js";

const MARCA = "__TEST_AUDITORIA__";
const OTRO_UID = "11111111-1111-1111-1111-111111111111";

let REAL_UID;
const productosCreados = [];
const comprasCreadas = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  for (const id of comprasCreadas) {
    try {
      await pool.query(`DELETE FROM compra_items WHERE compra_id = $1`, [id]);
      await pool.query(`DELETE FROM compras WHERE id = $1`, [id]);
    } catch (err) {
      console.error(`No se pudo limpiar la compra de prueba ${id}:`, err.message);
    }
  }
  for (const id of productosCreados) {
    try {
      await pool.query(`DELETE FROM productos WHERE id = $1`, [id]);
    } catch (err) {
      console.error(`No se pudo limpiar el producto de prueba ${id}:`, err.message);
    }
  }
  await pool.end();
});

async function productoDePrueba(overrides = {}) {
  const p = await ProductoModel.create({
    nombre: `${MARCA} producto`,
    categoria_id: null,
    precio_minorista: 100,
    precio_mayorista: 80,
    precio_compra: 50,
    stock_actual: 10,
    usuario_id: REAL_UID,
    ...overrides,
  });
  productosCreados.push(p.id);
  return p;
}

test("crear una compra suma el stock del producto", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 5, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 15);
});

test("editar una compra revierte el stock anterior y aplica el nuevo", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 5, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await CompraService.editarCompra(compra.id, {
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 8, precio_unitario: 40 }], usuario_id: REAL_UID,
  });

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 18, "10 inicial + 5 (compra original) - 5 (revierte) + 8 (nueva cantidad) = 18");
});

test("no se puede comprar contra un producto de otro usuario", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  await assert.rejects(
    () => CompraService.crearCompra({
      proveedor_id: null, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: OTRO_UID,
    }),
    (err) => err.status === 404
  );

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 10, "el stock no debe cambiar tras un intento de compra ajena");
});

test("editar una compra ajena es rechazada y no toca el stock", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 5, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await assert.rejects(
    () => CompraService.editarCompra(compra.id, {
      proveedor_id: null, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 1 }], usuario_id: OTRO_UID,
    }),
    (err) => err.status === 404
  );

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 15, "el stock no debe cambiar tras un intento de edición ajena");
});

test("editar una compra valida los ítems igual que al crearla", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 5, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await assert.rejects(
    () => CompraService.editarCompra(compra.id, {
      proveedor_id: null, items: [{ producto_id: p.id, cantidad: -1, precio_unitario: 40 }], usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );
});

test("una compra internacional guarda tipo y costo de envío", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, tipo: "internacional", costo_envio: 15000,
    items: [{ producto_id: p.id, cantidad: 3, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  assert.equal(compra.tipo, "internacional");
  assert.equal(Number(compra.costo_envio), 15000);
  assert.equal(Number(compra.total), 120, "el total de mercadería no debe incluir el envío");
});

test("un tipo de compra inválido es rechazado", async () => {
  const p = await productoDePrueba({ stock_actual: 5 });

  await assert.rejects(
    () => CompraService.crearCompra({
      proveedor_id: null, tipo: "por avion", items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );
});

test("una compra sin tipo especificado queda como local por defecto", async () => {
  const p = await productoDePrueba({ stock_actual: 5 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  assert.equal(compra.tipo, "local");
  assert.equal(Number(compra.costo_envio), 0);
});
