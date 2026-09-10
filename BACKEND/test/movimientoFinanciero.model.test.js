import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import MovimientoFinancieroModel from "../src/models/movimientoFinanciero.model.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";

const MARCA = "__TEST_FINANZAS__";
let REAL_UID;
let cuenta;
const movimientosCreados = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
  cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} cuenta movs`, tipo: "efectivo", saldo_inicial: 0, usuario_id: REAL_UID,
  });
});

after(async () => {
  for (const id of movimientosCreados) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta.id]);
  await pool.end();
});

test("crea un movimiento de ingreso ligado a una venta", async () => {
  const mov = await MovimientoFinancieroModel.create({
    fecha: "2026-01-15",
    tipo: "ingreso",
    categoria: "venta_productos",
    monto: 15000,
    cuenta_dinero_id: cuenta.id,
    origen_tipo: "venta",
    origen_id: 999999,
    descripcion: "venta de prueba",
    usuario_id: REAL_UID,
  });
  movimientosCreados.push(mov.id);

  assert.equal(mov.tipo, "ingreso");
  assert.equal(Number(mov.monto), 15000);
  assert.equal(mov.origen_tipo, "venta");
});

test("rechaza monto negativo o cero por constraint de base", async () => {
  await assert.rejects(
    MovimientoFinancieroModel.create({
      fecha: "2026-01-15", tipo: "egreso", categoria: "otros_gastos", monto: 0,
      cuenta_dinero_id: cuenta.id, origen_tipo: "ajuste_manual", usuario_id: REAL_UID,
    })
  );
});

test("getByOrigen encuentra los movimientos de una venta puntual", async () => {
  const mov = await MovimientoFinancieroModel.create({
    fecha: "2026-01-16", tipo: "ingreso", categoria: "venta_productos", monto: 500,
    cuenta_dinero_id: cuenta.id, origen_tipo: "venta", origen_id: 424242, usuario_id: REAL_UID,
  });
  movimientosCreados.push(mov.id);

  const encontrados = await MovimientoFinancieroModel.getByOrigen("venta", 424242, REAL_UID);
  assert.equal(encontrados.length, 1);
  assert.equal(encontrados[0].id, mov.id);
});

test("getByPeriodo filtra por rango de fechas y usuario", async () => {
  const mov = await MovimientoFinancieroModel.create({
    fecha: "2026-02-01", tipo: "egreso", categoria: "alquiler", monto: 2000,
    cuenta_dinero_id: cuenta.id, origen_tipo: "gasto", origen_id: 1, usuario_id: REAL_UID,
  });
  movimientosCreados.push(mov.id);

  const resultado = await MovimientoFinancieroModel.getByPeriodo("2026-02-01", "2026-02-28", REAL_UID);
  assert.ok(resultado.some((m) => m.id === mov.id));
});
