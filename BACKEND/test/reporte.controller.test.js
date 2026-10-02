import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fechaArgentina } from "../src/utils/fechas.js";
dotenv.config();

import pool from "../src/config/db.js";
import ReporteController from "../src/controllers/reporte.controller.js";

let REAL_UID;

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  await pool.end();
});

function crearReqRes(query) {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  const req = { query, usuario_id: REAL_UID };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

// Hoy en Argentina, igual que los reportes (en UTC, después de las 21 ya es mañana)
const HOY = fechaArgentina();

test("GET resumen requiere desde y hasta", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({});
  await ReporteController.getResumen(req, res, (err) => { throw err; });
  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("desde") || getJson().error.includes("requeridos"));
});

test("GET resumen devuelve las claves esperadas", async () => {
  const { req, res, getJson } = crearReqRes({ desde: HOY, hasta: HOY });
  await ReporteController.getResumen(req, res, (err) => { throw err; });
  const data = getJson().data;
  for (const clave of [
    "utilidad_neta_periodo", "ingresos_por_ventas_periodo", "saldo_total_cuentas",
    "total_por_cobrar", "total_por_pagar", "ingresos_caja_periodo",
    "egresos_caja_periodo", "flujo_neto_caja_periodo",
  ]) {
    assert.ok(clave in data, `falta la clave ${clave}`);
  }
});

test("GET estado-resultados requiere desde y hasta", async () => {
  const { req, res, getStatus } = crearReqRes({});
  await ReporteController.getEstadoResultados(req, res, (err) => { throw err; });
  assert.equal(getStatus(), 400);
});

test("GET balance no requiere parametros", async () => {
  const { req, res, getJson, getStatus } = crearReqRes({});
  await ReporteController.getBalance(req, res, (err) => { throw err; });
  assert.equal(getStatus(), 200);
  assert.ok("patrimonio" in getJson().data);
});

test("GET flujo-caja requiere desde y hasta", async () => {
  const { req, res, getStatus } = crearReqRes({});
  await ReporteController.getFlujoCaja(req, res, (err) => { throw err; });
  assert.equal(getStatus(), 400);
});
