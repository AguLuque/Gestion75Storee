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

test("una compra con cuenta de dinero genera movimiento de costo de mercaderia y flete", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta compra`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const compra = await CompraService.crearCompra({
    proveedor_id: null, costo_envio: 500,
    cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 3, precio_unitario: 40 }],
    usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1 ORDER BY categoria`,
    [compra.id]
  );
  assert.equal(movs.length, 2);
  const flete = movs.find((m) => m.categoria === "flete");
  const costoMercaderia = movs.find((m) => m.categoria === "costo_mercaderia");
  assert.ok(flete && costoMercaderia);
  assert.equal(flete.tipo, "egreso");
  assert.equal(Number(flete.monto), 500);
  assert.equal(costoMercaderia.tipo, "egreso");
  assert.equal(Number(costoMercaderia.monto), 120);

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`, [compra.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("una compra con cuenta_dinero_id de otro usuario es rechazada y no crea compra ni movimiento", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuentaAjena = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta ajena compra`, OTRO_UID]
  );
  const cuenta_dinero_id = cuentaAjena.rows[0].id;

  const { rows: countAntesRows } = await pool.query(`SELECT COUNT(*) FROM compras WHERE usuario_id = $1`, [REAL_UID]);
  const countAntes = countAntesRows[0].count;

  await assert.rejects(
    () => CompraService.crearCompra({
      proveedor_id: null,
      cuenta_dinero_id,
      items: [{ producto_id: p.id, cantidad: 3, precio_unitario: 40 }],
      usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 10, "el stock no debe cambiar si la cuenta de dinero es ajena");

  const { rows: countDespuesRows } = await pool.query(`SELECT COUNT(*) FROM compras WHERE usuario_id = $1`, [REAL_UID]);
  assert.equal(countDespuesRows[0].count, countAntes, "no debe crear ninguna compra si la cuenta de dinero es ajena");

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE cuenta_dinero_id = $1`,
    [cuenta_dinero_id]
  );
  assert.equal(movs.length, 0, "no debe crear ningún movimiento");

  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("una compra con cuenta_dinero_id inexistente es rechazada", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  await assert.rejects(
    () => CompraService.crearCompra({
      proveedor_id: null,
      cuenta_dinero_id: 9999999,
      items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 40 }],
      usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 10, "el stock no debe cambiar si la cuenta de dinero no existe");
});

test("una compra con cuenta de dinero pero sin costo de envio genera un solo movimiento", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta compra sin envio`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const compra = await CompraService.crearCompra({
    proveedor_id: null,
    cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 40 }],
    usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`,
    [compra.id]
  );
  assert.equal(movs.length, 1);
  assert.equal(movs[0].categoria, "costo_mercaderia");

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`, [compra.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});
