import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import ProductoModel from "../src/models/producto.model.js";
import VentaService from "../src/services/venta.service.js";
import ReporteModel from "../src/models/reporte.model.js";
import { fechaArgentina } from "../src/utils/fechas.js";

const MARCA = "__TEST_REPORTES__";
let REAL_UID;
const productosCreados = [];
const ventasCreadas = [];
const gastosCreados = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  for (const id of gastosCreados) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'gasto' AND origen_id = $1`, [id]);
    await pool.query(`DELETE FROM gastos WHERE id = $1`, [id]).catch(() => {});
  }
  for (const id of ventasCreadas) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`, [id]);
    await pool.query(`DELETE FROM venta_items WHERE venta_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM ventas WHERE id = $1`, [id]).catch(() => {});
  }
  for (const id of productosCreados) {
    await pool.query(`DELETE FROM productos WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.end();
});

// Hoy en Argentina, igual que los reportes (en UTC, después de las 21 ya es mañana)
const HOY = fechaArgentina();

test("getEstadoResultados calcula ingresos, costo de mercaderia, comisiones y gastos del periodo", async () => {
  const p = await ProductoModel.create({
    nombre: `${MARCA} producto`, categoria_id: null,
    precio_minorista: 100, precio_mayorista: 80, precio_compra: 40,
    stock_actual: 20, usuario_id: REAL_UID,
  });
  productosCreados.push(p.id);

  const venta = await VentaService.crearVenta({
    tipo: "minorista", comision: 10,
    items: [{ producto_id: p.id, cantidad: 3, precio_unitario: 100 }],
    usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  const gasto = await pool.query(
    `INSERT INTO gastos (descripcion, monto, categoria, usuario_id, fecha) VALUES ($1,$2,$3,$4, CURRENT_DATE) RETURNING id`,
    [`${MARCA} gasto`, 50, "Otros", REAL_UID]
  );
  gastosCreados.push(gasto.rows[0].id);

  const resultado = await ReporteModel.getEstadoResultados(HOY, HOY, REAL_UID);

  assert.equal(Number(resultado.ingresos_por_ventas) >= 300, true, "debe incluir al menos la venta de prueba (3*100)");
  assert.equal(Number(resultado.costo_mercaderia_vendida) >= 120, true, "debe incluir al menos el costo de la venta de prueba (3*40)");
  assert.equal(Number(resultado.comisiones) >= 10, true);
  assert.equal(Number(resultado.gastos_operativos) >= 50, true);
  assert.equal(
    Number(resultado.ingresos_totales.toFixed(2)),
    Number((resultado.ingresos_por_ventas + resultado.ventas_fiadas).toFixed(2))
  );
  assert.equal(
    Number(resultado.utilidad_bruta.toFixed(2)),
    Number((resultado.ingresos_totales - resultado.costo_mercaderia_vendida - resultado.fletes_compras - resultado.comisiones).toFixed(2))
  );
  assert.equal(
    Number(resultado.utilidad_neta.toFixed(2)),
    Number((Number(resultado.utilidad_bruta) - Number(resultado.gastos_operativos)).toFixed(2))
  );
});

test("getEstadoResultados suma el fiado cargado a mano y resta el flete de las compras del periodo", async () => {
  const antes = await ReporteModel.getEstadoResultados(HOY, HOY, REAL_UID);

  const compra = await pool.query(
    `INSERT INTO compras (total, costo_envio, observaciones, usuario_id) VALUES (0, 70, $1, $2) RETURNING id`,
    [`${MARCA} compra`, REAL_UID]
  );
  const fiado = await pool.query(
    `INSERT INTO cuentas_por_cobrar (venta_id, cliente_nombre, monto_total, saldo_pendiente, fecha_emision, usuario_id)
     VALUES (NULL, $1, 300, 300, $2, $3) RETURNING id`,
    [`${MARCA} fiado`, HOY, REAL_UID]
  );

  try {
    const despues = await ReporteModel.getEstadoResultados(HOY, HOY, REAL_UID);
    assert.equal(Number((despues.fletes_compras - antes.fletes_compras).toFixed(2)), 70);
    assert.equal(Number((despues.ventas_fiadas - antes.ventas_fiadas).toFixed(2)), 300);
    assert.equal(Number((despues.ingresos_por_ventas - antes.ingresos_por_ventas).toFixed(2)), 0, "el fiado no es una venta registrada");
    assert.equal(Number((despues.utilidad_neta - antes.utilidad_neta).toFixed(2)), 230, "300 de fiado - 70 de flete");
  } finally {
    await pool.query(`DELETE FROM cuentas_por_cobrar WHERE id = $1`, [fiado.rows[0].id]);
    await pool.query(`DELETE FROM compras WHERE id = $1`, [compra.rows[0].id]);
  }
});

test("getEstadoResultados no incluye ventas fuera del periodo ni de otro usuario", async () => {
  const OTRO_UID = "11111111-1111-1111-1111-111111111111";
  const resultado = await ReporteModel.getEstadoResultados("2000-01-01", "2000-01-02", OTRO_UID);
  assert.equal(Number(resultado.ingresos_por_ventas), 0);
  assert.equal(Number(resultado.costo_mercaderia_vendida), 0);
  assert.equal(Number(resultado.gastos_operativos), 0);
  assert.equal(Number(resultado.utilidad_neta), 0);
});

test("getBalance suma disponible (cuentas de dinero), por cobrar, inventario y por pagar", async () => {
  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',1000,$2) RETURNING id`,
    [`${MARCA} cuenta balance`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'ingreso', 'otros_ingresos', 500, $1, 'ajuste_manual', $2)`,
    [cuenta_dinero_id, REAL_UID]
  );

  const p = await ProductoModel.create({
    nombre: `${MARCA} producto balance`, categoria_id: null,
    precio_minorista: 100, precio_mayorista: 80, precio_compra: 40,
    stock_actual: 10, usuario_id: REAL_UID,
  });
  productosCreados.push(p.id);

  const balance = await ReporteModel.getBalance(REAL_UID);

  // Se usan cotas ">=" (no un delta exacto antes/después) porque node --test
  // corre los archivos de test en paralelo contra el mismo usuario real:
  // otro archivo puede crear/borrar productos o cuentas entre dos llamadas
  // separadas a getBalance, lo que ya causó un fallo intermitente acá.
  assert.equal(Number(balance.disponible) >= 1500, true, "disponible debe incluir saldo_inicial (1000) + movimiento (500) de la cuenta nueva");
  assert.equal(Number(balance.inventario) >= 400, true, "inventario debe incluir 10 unidades * 40 de costo del producto nuevo");
  assert.equal(
    Number(balance.total_activos.toFixed(2)),
    Number((Number(balance.disponible) + Number(balance.por_cobrar) + Number(balance.inventario)).toFixed(2))
  );
  assert.equal(
    Number(balance.patrimonio.toFixed(2)),
    Number((Number(balance.total_activos) - Number(balance.total_pasivos)).toFixed(2))
  );

  await pool.query(`DELETE FROM movimientos_financieros WHERE cuenta_dinero_id = $1`, [cuenta_dinero_id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("getFlujoCaja separa saldo inicial, ingresos, egresos y detalle por categoria del periodo", async () => {
  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta flujo`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES ('2020-01-01', 'ingreso', 'otros_ingresos', 700, $1, 'ajuste_manual', $2)`,
    [cuenta_dinero_id, REAL_UID]
  );
  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'ingreso', 'venta_productos', 300, $1, 'venta', $2)`,
    [cuenta_dinero_id, REAL_UID]
  );
  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'egreso', 'alquiler', 100, $1, 'gasto', $2)`,
    [cuenta_dinero_id, REAL_UID]
  );

  const flujo = await ReporteModel.getFlujoCaja("2021-01-01", HOY, REAL_UID);

  assert.equal(Number(flujo.saldo_inicial) >= 700, true, "el movimiento de 2020 debe estar en saldo_inicial, no en el periodo");
  assert.equal(Number(flujo.ingresos_caja) >= 300, true);
  assert.equal(Number(flujo.egresos_caja) >= 100, true);
  assert.equal(
    Number(flujo.flujo_neto.toFixed(2)),
    Number((Number(flujo.ingresos_caja) - Number(flujo.egresos_caja)).toFixed(2))
  );
  assert.equal(
    Number(flujo.saldo_final.toFixed(2)),
    Number((Number(flujo.saldo_inicial) + Number(flujo.flujo_neto)).toFixed(2))
  );
  assert.ok(Array.isArray(flujo.detalle_por_categoria));
  const ingresoVenta = flujo.detalle_por_categoria.find((d) => d.categoria === "venta_productos" && d.tipo === "ingreso");
  assert.ok(ingresoVenta, "debe listar el detalle de la categoria venta_productos");
  assert.equal(Number(ingresoVenta.monto) >= 300, true);

  await pool.query(`DELETE FROM movimientos_financieros WHERE cuenta_dinero_id = $1`, [cuenta_dinero_id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("getResumen combina estado de resultados, balance y flujo de caja", async () => {
  const resumen = await ReporteModel.getResumen(HOY, HOY, REAL_UID);
  for (const clave of [
    "utilidad_neta_periodo", "ingresos_por_ventas_periodo", "saldo_total_cuentas",
    "total_por_cobrar", "total_por_pagar", "ingresos_caja_periodo",
    "egresos_caja_periodo", "flujo_neto_caja_periodo",
  ]) {
    assert.ok(clave in resumen, `falta la clave ${clave}`);
  }
});

test("getEstadoResultados no resta los retiros del dueño de la ganancia: los muestra aparte", async () => {
  const antes = await ReporteModel.getEstadoResultados(HOY, HOY, REAL_UID);
  const { rows } = await pool.query(
    `INSERT INTO gastos (descripcion, monto, categoria, usuario_id, fecha) VALUES ($1, 500, 'Retiro del dueño (personal)', $2, now()) RETURNING id`,
    [`${MARCA} retiro`, REAL_UID]
  );
  gastosCreados.push(rows[0].id);

  const despues = await ReporteModel.getEstadoResultados(HOY, HOY, REAL_UID);
  assert.equal(despues.gastos_operativos, antes.gastos_operativos, "el retiro no es gasto operativo");
  assert.equal(despues.utilidad_neta, antes.utilidad_neta, "la ganancia no cambia");
  assert.equal(Number((despues.retiros_dueno - antes.retiros_dueno).toFixed(2)), 500);
  assert.equal(Number(despues.queda_en_el_negocio.toFixed(2)), Number((despues.utilidad_neta - despues.retiros_dueno).toFixed(2)));
});
