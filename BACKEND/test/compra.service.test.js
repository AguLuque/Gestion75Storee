// Tests de integración contra la base real de Supabase — ver la nota de seguridad
// en test/venta.service.test.js sobre por qué no se usa ROLLBACK acá.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import ProductoModel from "../src/models/producto.model.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";
import CompraService, { repartirEnvio } from "../src/services/compra.service.js";
import ReporteModel from "../src/models/reporte.model.js";
import CompraModel from "../src/models/compra.model.js";

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

test("editar una compra con movimientos revierte los viejos y crea nuevos con el monto actualizado", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta edicion`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const compra = await CompraService.crearCompra({
    proveedor_id: null, costo_envio: 100, cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 2, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await CompraService.editarCompra(compra.id, {
    proveedor_id: null, costo_envio: 50, cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 5, precio_unitario: 40 }], usuario_id: REAL_UID,
  });

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1 ORDER BY id`,
    [compra.id]
  );
  // 2 originales (mercaderia + flete) + 2 reversiones + 2 nuevos = 6
  assert.equal(movs.length, 6);

  const saldo = await CuentaDineroModel.getSaldo(cuenta_dinero_id, REAL_UID);
  // saldo final = -(5*40) - 50 = -250 (solo cuenta lo vigente tras la edicion)
  assert.equal(Number(saldo), -250);

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`, [compra.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("editar una compra sin volver a pasar cuenta_dinero_id revierte los movimientos viejos y no crea nuevos", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta edicion sin cuenta`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const compra = await CompraService.crearCompra({
    proveedor_id: null, cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await CompraService.editarCompra(compra.id, {
    proveedor_id: null,
    items: [{ producto_id: p.id, cantidad: 2, precio_unitario: 40 }], usuario_id: REAL_UID,
  });

  const saldo = await CuentaDineroModel.getSaldo(cuenta_dinero_id, REAL_UID);
  assert.equal(Number(saldo), 0, "sin cuenta_dinero_id en la edicion, el efecto en caja queda revertido y no se recrea");

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`, [compra.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("eliminar una compra revierte el stock y el movimiento financiero", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta eliminar`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const compra = await CompraService.crearCompra({
    proveedor_id: null, cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 5, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await CompraService.eliminarCompra(compra.id, REAL_UID);

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 10, "el stock vuelve al original tras eliminar la compra");

  const saldo = await CuentaDineroModel.getSaldo(cuenta_dinero_id, REAL_UID);
  assert.equal(Number(saldo), 0, "el movimiento de la compra queda revertido");

  const compraTras = await CompraService.editarCompra(compra.id, {
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 1 }], usuario_id: REAL_UID,
  }).catch((err) => err);
  assert.equal(compraTras.status, 404, "una compra eliminada no puede editarse (queda inactiva)");

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`, [compra.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("eliminar una compra a credito desactiva su cuenta por pagar", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, estado_pago: "pendiente",
    items: [{ producto_id: p.id, cantidad: 2, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await CompraService.eliminarCompra(compra.id, REAL_UID);

  const { rows: cxp } = await pool.query(`SELECT * FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
  assert.equal(cxp[0].activo, false);

  await pool.query(`DELETE FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
});

test("eliminar una compra ajena o inexistente es rechazada y no toca el stock", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 2, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await assert.rejects(
    () => CompraService.eliminarCompra(compra.id, OTRO_UID),
    (err) => err.status === 404
  );

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 12, "el stock no debe cambiar tras un intento de eliminacion ajena");

  await assert.rejects(
    () => CompraService.eliminarCompra(9999999, REAL_UID),
    (err) => err.status === 404
  );
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

test("una compra a credito no genera movimiento pero genera una cuenta por pagar por el total mas envio", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, estado_pago: "pendiente", costo_envio: 200,
    items: [{ producto_id: p.id, cantidad: 3, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  assert.equal(compra.estado_pago, "pendiente");

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`,
    [compra.id]
  );
  assert.equal(movs.length, 0);

  const { rows: cxp } = await pool.query(`SELECT * FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
  assert.equal(cxp.length, 1);
  assert.equal(Number(cxp[0].monto_total), 120 + 200);
  assert.equal(Number(cxp[0].saldo_pendiente), 320);
  assert.equal(cxp[0].estado, "pendiente");

  await pool.query(`DELETE FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
});

test("una compra con estado_pago pagado (el default) sigue sin generar cuenta por pagar", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const compra = await CompraService.crearCompra({
    proveedor_id: null, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  assert.equal(compra.estado_pago, "pagado");
  const { rows: cxp } = await pool.query(`SELECT * FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
  assert.equal(cxp.length, 0);
});

test("un estado_pago invalido es rechazado y no crea compra ni movimiento ni cuenta por pagar", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const { rows: countAntesRows } = await pool.query(`SELECT COUNT(*) FROM compras WHERE usuario_id = $1`, [REAL_UID]);
  const countAntes = countAntesRows[0].count;

  await assert.rejects(
    () => CompraService.crearCompra({
      proveedor_id: null, estado_pago: "parcial",
      items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );

  const { rows: countDespuesRows } = await pool.query(`SELECT COUNT(*) FROM compras WHERE usuario_id = $1`, [REAL_UID]);
  assert.equal(countDespuesRows[0].count, countAntes, "no debe crear ninguna compra con estado_pago invalido");

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 10, "el stock no debe cambiar si estado_pago es invalido");
});

test("una compra a credito con costo de envio y cuenta_dinero_id igual genera cuenta por pagar y ningun movimiento", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta compra credito`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const compra = await CompraService.crearCompra({
    proveedor_id: null, estado_pago: "pendiente", costo_envio: 200, cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 3, precio_unitario: 40 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1`,
    [compra.id]
  );
  assert.equal(movs.length, 0, "una compra a credito no debe generar movimiento aunque tenga cuenta_dinero_id");

  const { rows: cxp } = await pool.query(`SELECT * FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
  assert.equal(cxp.length, 1);
  assert.equal(Number(cxp[0].monto_total), 120 + 200);

  await pool.query(`DELETE FROM cuentas_por_pagar WHERE compra_id = $1`, [compra.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
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

// ── Reparto del envío y costo promedio ──────────────────────────────────────

const costoDe = async (id) => {
  const p = await ProductoModel.getById(id, REAL_UID);
  return { costo: Number(p.precio_compra), stock: Number(p.stock_actual) };
};

test("repartirEnvio: según el valor, por unidad y por peso, y la suma da exacto el envío", () => {
  // 10 remeras a $1.000 y 2 camperas a $10.000, envío $4.000
  const items = [
    { cantidad: 10, precio_unitario: 1000, peso: 5 },
    { cantidad: 2, precio_unitario: 10000, peso: 15 },
  ];
  assert.deepEqual(repartirEnvio(items, 4000, "valor"), [1333.33, 2666.67]);
  assert.deepEqual(repartirEnvio(items, 4000, "unidad"), [3333.33, 666.67]);
  assert.deepEqual(repartirEnvio(items, 4000, "peso"), [1000, 3000]);

  const tres = [1, 2, 3].map(() => ({ cantidad: 1, precio_unitario: 10 }));
  const partes = repartirEnvio(tres, 100, "valor");
  assert.deepEqual(partes, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(partes.reduce((a, b) => a + b, 0) * 100), 10000);

  assert.deepEqual(repartirEnvio(items, 0, "valor"), [0, 0]);
});

test("repartir por peso sin cargar los kilos es rechazado", async () => {
  const p = await productoDePrueba();
  await assert.rejects(
    CompraService.crearCompra({
      costo_envio: 100, reparto_envio: "peso",
      items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );
  assert.deepEqual(await costoDe(p.id), { costo: 50, stock: 10 });
});

test("una compra recalcula el costo como promedio ponderado con el envío incluido", async () => {
  // Había 10 a $50 ($500). Entran 10 a $60 + $200 de envío ($800) → 20 a $65.
  const p = await productoDePrueba({ stock_actual: 10, precio_compra: 50 });
  const compra = await CompraService.crearCompra({
    costo_envio: 200, items: [{ producto_id: p.id, cantidad: 10, precio_unitario: 60 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  assert.equal(compra.reparto_envio, "valor", "sin indicar reparto, se reparte según el valor");
  assert.equal(Number(compra.items[0].envio_asignado), 200);
  assert.deepEqual(await costoDe(p.id), { costo: 65, stock: 20 });
});

test("sin stock previo, el costo pasa a ser lo pagado más su parte del envío", async () => {
  const p = await productoDePrueba({ stock_actual: 0, precio_compra: 0 });
  const compra = await CompraService.crearCompra({
    costo_envio: 40, items: [{ producto_id: p.id, cantidad: 4, precio_unitario: 100 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);
  assert.deepEqual(await costoDe(p.id), { costo: 110, stock: 4 });
});

test("editar una compra deshace su costo y aplica el nuevo, como si se hubiera cargado así", async () => {
  const p = await productoDePrueba({ stock_actual: 10, precio_compra: 50 });
  const p2 = await productoDePrueba({ stock_actual: 0, precio_compra: 0 });
  const compra = await CompraService.crearCompra({
    costo_envio: 200, items: [{ producto_id: p.id, cantidad: 10, precio_unitario: 60 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  // Pasa a 5 unidades a $60, se agrega otro producto y el envío se reparte por
  // unidad: 6 unidades, $120 de envío → $20 por unidad.
  await CompraService.editarCompra(compra.id, {
    costo_envio: 120, reparto_envio: "unidad",
    items: [
      { producto_id: p.id, cantidad: 5, precio_unitario: 60 },
      { producto_id: p2.id, cantidad: 1, precio_unitario: 30 },
    ],
    usuario_id: REAL_UID,
  });

  // p: 10 a $50 ($500) + 5 a $60 + $100 de envío ($400) = 15 a $60
  assert.deepEqual(await costoDe(p.id), { costo: 60, stock: 15 });
  // p2: sin stock previo → $30 + $20 de envío
  assert.deepEqual(await costoDe(p2.id), { costo: 50, stock: 1 });

  const editada = await CompraService.editarCompra(compra.id, {
    costo_envio: 0, items: [{ producto_id: p.id, cantidad: 10, precio_unitario: 50 }], usuario_id: REAL_UID,
  });
  assert.equal(editada.reparto_envio, "valor");
  assert.deepEqual(await costoDe(p.id), { costo: 50, stock: 20 });
  assert.equal((await costoDe(p2.id)).stock, 0, "el producto que se sacó de la compra devuelve su stock");
});

test("anular una compra deja el costo y el stock como estaban antes", async () => {
  const p = await productoDePrueba({ stock_actual: 10, precio_compra: 50 });
  const compra = await CompraService.crearCompra({
    costo_envio: 200, items: [{ producto_id: p.id, cantidad: 10, precio_unitario: 60 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);

  await CompraService.eliminarCompra(compra.id, REAL_UID);
  assert.deepEqual(await costoDe(p.id), { costo: 50, stock: 10 });
});

test("anular una compra cuya mercadería ya se vendió toda no toca el costo", async () => {
  const p = await productoDePrueba({ stock_actual: 0, precio_compra: 0 });
  const compra = await CompraService.crearCompra({
    costo_envio: 40, items: [{ producto_id: p.id, cantidad: 4, precio_unitario: 100 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);
  await ProductoModel.updateStockManual(p.id, 0, REAL_UID); // se vendió todo

  await CompraService.eliminarCompra(compra.id, REAL_UID);
  assert.deepEqual(await costoDe(p.id), { costo: 110, stock: -4 });
});

test("anular una compra anterior al reparto del envío solo revierte el stock", async () => {
  const p = await productoDePrueba({ stock_actual: 15, precio_compra: 50 });
  // Compra vieja: sin reparto_envio y sin haber tocado el costo del producto
  const { rows } = await pool.query(
    `INSERT INTO compras (total, costo_envio, usuario_id) VALUES (300, 100, $1) RETURNING id`, [REAL_UID]
  );
  const compraId = rows[0].id;
  comprasCreadas.push(compraId);
  await pool.query(
    `INSERT INTO compra_items (compra_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, 5, 60, 300)`,
    [compraId, p.id]
  );

  await CompraService.eliminarCompra(compraId, REAL_UID);
  assert.deepEqual(await costoDe(p.id), { costo: 50, stock: 10 });
});

test("una compra trae su proveedor_id para que editarla no lo pierda", async () => {
  const p = await productoDePrueba();
  const { rows } = await pool.query(
    `INSERT INTO proveedores (nombre, usuario_id) VALUES ($1, $2) RETURNING id`, [`${MARCA} proveedor`, REAL_UID]
  );
  const proveedorId = rows[0].id;
  try {
    const compra = await CompraService.crearCompra({
      proveedor_id: proveedorId, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
    });
    comprasCreadas.push(compra.id);
    const leida = await CompraModel.getById(compra.id, REAL_UID);
    assert.equal(Number(leida.proveedor_id), Number(proveedorId));
  } finally {
    await pool.query(`UPDATE compras SET proveedor_id = NULL WHERE proveedor_id = $1`, [proveedorId]);
    await pool.query(`DELETE FROM proveedores WHERE id = $1`, [proveedorId]);
  }
});

test("el envío de una compra nueva no se resta aparte en el Estado de Resultados", async () => {
  const p = await productoDePrueba();
  const hoy = new Date().toISOString().slice(0, 10);
  const antes = await ReporteModel.getEstadoResultados(hoy, hoy, REAL_UID);
  const compra = await CompraService.crearCompra({
    costo_envio: 70, items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 10 }], usuario_id: REAL_UID,
  });
  comprasCreadas.push(compra.id);
  const despues = await ReporteModel.getEstadoResultados(hoy, hoy, REAL_UID);
  assert.equal(despues.fletes_compras, antes.fletes_compras, "el envío ya está dentro del costo del producto");
});
