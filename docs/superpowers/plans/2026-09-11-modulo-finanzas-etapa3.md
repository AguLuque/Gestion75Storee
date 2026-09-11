# Módulo Finanzas — Etapa 3 (Motor de Reportes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir los 4 reportes financieros (Resumen, Estado de Resultados, Balance, Flujo de Caja) leyendo exclusivamente las tablas ya existentes (`ventas`, `venta_items`, `compras`, `gastos`, `movimientos_financieros`, `cuentas_dinero`, `cuentas_por_cobrar`, `cuentas_por_pagar`, `productos`) — sin crear ninguna tabla nueva ni duplicar datos.

**Architecture:** Una capa de sólo lectura (`ReporteModel` con queries SQL de agregación) + un controller/rutas delgado que valida parámetros y expone 4 endpoints bajo `/api/reportes`. El frontend agrega una página nueva `Reportes.jsx` con 4 secciones (tabs simples con botones, sin librería nueva) que consumen esos endpoints. No hay escritura de datos en esta etapa: todo es cálculo sobre lo que ya se registra al vender/comprar/gastar/mover dinero.

**Tech Stack:** Node/Express 5 + `pg` (sin ORM), React 19 + Vite + Tailwind (mismos patrones que el resto del proyecto), `node:test` para tests de integración contra la base real de Supabase (mismo patrón que `test/compra.service.test.js`, `test/gasto.controller.test.js`, etc.).

**Spec:** No hay un archivo de spec separado — el contexto es la conversación previa del usuario (separación devengado/percibido, `movimientos_financieros` como única fuente de verdad para caja, sin Debe/Haber ni Libro Diario/Mayor, sistema NO es un ERP contable profesional) y los planes ya ejecutados `docs/superpowers/plans/2026-09-10-modulo-finanzas.md` y `docs/superpowers/plans/2026-09-10-modulo-finanzas-etapa2.md`.

## Global Constraints

- No se crea ninguna tabla ni columna nueva. Los 4 reportes se calculan 100% a partir de tablas existentes.
- **Devengado vs percibido:** el Estado de Resultados usa `ventas`/`venta_items`/`gastos` (devengado — se registra al emitir la operación, sin importar si se cobró/pagó). El Flujo de Caja usa exclusivamente `movimientos_financieros` (percibido — sólo plata que efectivamente entró o salió de una cuenta). El Balance es una foto "a hoy" que combina ambos (caja real + pendientes de cobro/pago + inventario valuado a costo).
- Todos los queries filtran por `usuario_id` (multi-tenant) igual que el resto del código. Las tablas con soft-delete (`ventas.activo`, `compras.activo`, `cuentas_dinero.activo`, `cuentas_por_cobrar.activo`, `cuentas_por_pagar.activo`, `productos.activo`) deben filtrarse por `activo = true` — nunca contar filas anuladas.
- Los reportes son de sólo lectura: nunca usan `client`/transacción, siempre `pool.query` directo (no hay riesgo de dejar algo a medio escribir).
- Parámetros de período (`desde`, `hasta`) son fechas `YYYY-MM-DD`, igual que `getByPeriodo` ya usado en `venta.model.js`/`gasto.model.js`. `Balance` no toma parámetros de fecha: siempre es "a hoy" (simplificación deliberada — no hay balance histórico en este alcance).
- Nombres exactos que las tareas siguientes dependen entre sí — no cambiarlos: `ReporteModel.getEstadoResultados`, `ReporteModel.getBalance`, `ReporteModel.getFlujoCaja`, `ReporteModel.getResumen`.

---

### Task 1: `ReporteModel.getEstadoResultados` (devengado)

**Files:**
- Create: `BACKEND/src/models/reporte.model.js`
- Test: `BACKEND/test/reporte.model.test.js`

**Interfaces:**
- Produces: `ReporteModel.getEstadoResultados(desde, hasta, usuario_id) => Promise<{ ingresos_por_ventas: number, costo_mercaderia_vendida: number, comisiones: number, utilidad_bruta: number, gastos_operativos: number, utilidad_neta: number }>`

- [ ] **Step 1: Escribir el test que falla**

```js
// BACKEND/test/reporte.model.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import ProductoModel from "../src/models/producto.model.js";
import VentaService from "../src/services/venta.service.js";
import ReporteModel from "../src/models/reporte.model.js";

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

const HOY = new Date().toISOString().slice(0, 10);

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
    Number(resultado.utilidad_bruta.toFixed(2)),
    Number((Number(resultado.ingresos_por_ventas) - Number(resultado.costo_mercaderia_vendida) - Number(resultado.comisiones)).toFixed(2))
  );
  assert.equal(
    Number(resultado.utilidad_neta.toFixed(2)),
    Number((Number(resultado.utilidad_bruta) - Number(resultado.gastos_operativos)).toFixed(2))
  );
});

test("getEstadoResultados no incluye ventas fuera del periodo ni de otro usuario", async () => {
  const OTRO_UID = "11111111-1111-1111-1111-111111111111";
  const resultado = await ReporteModel.getEstadoResultados("2000-01-01", "2000-01-02", OTRO_UID);
  assert.equal(Number(resultado.ingresos_por_ventas), 0);
  assert.equal(Number(resultado.costo_mercaderia_vendida), 0);
  assert.equal(Number(resultado.gastos_operativos), 0);
  assert.equal(Number(resultado.utilidad_neta), 0);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd BACKEND && node --test test/reporte.model.test.js`
Expected: FAIL — `Cannot find module '../src/models/reporte.model.js'`

- [ ] **Step 3: Implementar `ReporteModel.getEstadoResultados`**

```js
// BACKEND/src/models/reporte.model.js
// Consultas de sólo lectura para los reportes financieros. Nunca escriben,
// nunca usan una transacción — leen exclusivamente de las tablas que ya
// alimentan ventas/compras/gastos/movimientos_financieros.
//
// Devengado (ventas, venta_items, gastos) vs percibido (movimientos_financieros):
// getEstadoResultados usa devengado; getFlujoCaja usa percibido; getBalance
// combina ambos como una foto "a hoy".

import pool from "../config/db.js";

const ReporteModel = {
  getEstadoResultados: async (desde, hasta, usuario_id) => {
    const { rows: ventasRows } = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS ingresos_por_ventas, COALESCE(SUM(comision), 0) AS comisiones
       FROM ventas
       WHERE activo = true AND usuario_id = $1 AND fecha BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const { rows: costoRows } = await pool.query(
      `SELECT COALESCE(SUM(vi.cantidad * vi.costo_unitario), 0) AS costo_mercaderia_vendida
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id
       WHERE v.activo = true AND v.usuario_id = $1 AND v.fecha BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const { rows: gastosRows } = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS gastos_operativos
       FROM gastos
       WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const ingresos_por_ventas = Number(ventasRows[0].ingresos_por_ventas);
    const comisiones = Number(ventasRows[0].comisiones);
    const costo_mercaderia_vendida = Number(costoRows[0].costo_mercaderia_vendida);
    const gastos_operativos = Number(gastosRows[0].gastos_operativos);

    const utilidad_bruta = ingresos_por_ventas - costo_mercaderia_vendida - comisiones;
    const utilidad_neta = utilidad_bruta - gastos_operativos;

    return {
      ingresos_por_ventas,
      costo_mercaderia_vendida,
      comisiones,
      utilidad_bruta,
      gastos_operativos,
      utilidad_neta,
    };
  },
};

export default ReporteModel;
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd BACKEND && node --test test/reporte.model.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add BACKEND/src/models/reporte.model.js BACKEND/test/reporte.model.test.js
git commit -m "feat(finanzas): agrego ReporteModel.getEstadoResultados (devengado)"
```

---

### Task 2: `ReporteModel.getBalance` y `ReporteModel.getFlujoCaja`

**Files:**
- Modify: `BACKEND/src/models/reporte.model.js`
- Test: `BACKEND/test/reporte.model.test.js` (agregar tests a este mismo archivo)

**Interfaces:**
- Consumes: nada de Task 1 (funciones independientes en el mismo módulo).
- Produces:
  - `ReporteModel.getBalance(usuario_id) => Promise<{ disponible: number, por_cobrar: number, inventario: number, total_activos: number, por_pagar: number, total_pasivos: number, patrimonio: number }>`
  - `ReporteModel.getFlujoCaja(desde, hasta, usuario_id) => Promise<{ saldo_inicial: number, ingresos_caja: number, egresos_caja: number, flujo_neto: number, saldo_final: number, detalle_por_categoria: Array<{ tipo: 'ingreso'|'egreso', categoria: string, monto: number }> }>`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `BACKEND/test/reporte.model.test.js` (mismos imports/fixtures ya declarados arriba en el archivo — no duplicar el `import`/`before`/`after`):

```js
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

  const balanceAntes = await ReporteModel.getBalance(REAL_UID);

  const p = await ProductoModel.create({
    nombre: `${MARCA} producto balance`, categoria_id: null,
    precio_minorista: 100, precio_mayorista: 80, precio_compra: 40,
    stock_actual: 10, usuario_id: REAL_UID,
  });
  productosCreados.push(p.id);

  const balanceDespues = await ReporteModel.getBalance(REAL_UID);

  assert.equal(
    Number(balanceDespues.disponible.toFixed(2)),
    Number((Number(balanceAntes.disponible) + 1500).toFixed(2)),
    "disponible debe subir por saldo_inicial (1000) + movimiento (500) de la cuenta nueva"
  );
  assert.equal(
    Number(balanceDespues.inventario.toFixed(2)),
    Number((Number(balanceAntes.inventario) + 400).toFixed(2)),
    "inventario debe subir por 10 unidades * 40 de costo"
  );
  assert.equal(
    Number(balanceDespues.total_activos.toFixed(2)),
    Number((Number(balanceDespues.disponible) + Number(balanceDespues.por_cobrar) + Number(balanceDespues.inventario)).toFixed(2))
  );
  assert.equal(
    Number(balanceDespues.patrimonio.toFixed(2)),
    Number((Number(balanceDespues.total_activos) - Number(balanceDespues.total_pasivos)).toFixed(2))
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

  // Movimiento ANTES del periodo: debe contar en saldo_inicial, no en ingresos_caja del periodo.
  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES ('2020-01-01', 'ingreso', 'otros_ingresos', 700, $1, 'ajuste_manual', $2)`,
    [cuenta_dinero_id, REAL_UID]
  );
  // Movimientos DENTRO del periodo (hoy).
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
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd BACKEND && node --test test/reporte.model.test.js`
Expected: FAIL — `ReporteModel.getBalance is not a function`

- [ ] **Step 3: Implementar `getBalance` y `getFlujoCaja`**

Agregar estas dos funciones dentro del objeto `ReporteModel` en `BACKEND/src/models/reporte.model.js` (junto a `getEstadoResultados`, antes del `export default`):

```js
  getBalance: async (usuario_id) => {
    const { rows: disponibleRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo), 0) AS disponible FROM (
         SELECT cd.id,
           cd.saldo_inicial
             + COALESCE(SUM(CASE WHEN mf.tipo = 'ingreso' THEN mf.monto ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN mf.tipo = 'egreso' THEN mf.monto ELSE 0 END), 0) AS saldo
         FROM cuentas_dinero cd
         LEFT JOIN movimientos_financieros mf ON mf.cuenta_dinero_id = cd.id
         WHERE cd.activo = true AND cd.usuario_id = $1
         GROUP BY cd.id, cd.saldo_inicial
       ) sub`,
      [usuario_id]
    );

    const { rows: cxcRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS por_cobrar FROM cuentas_por_cobrar WHERE activo = true AND usuario_id = $1`,
      [usuario_id]
    );

    const { rows: inventarioRows } = await pool.query(
      `SELECT COALESCE(SUM(stock_actual * precio_compra), 0) AS inventario FROM productos WHERE activo = true AND usuario_id = $1`,
      [usuario_id]
    );

    const { rows: cxpRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS por_pagar FROM cuentas_por_pagar WHERE activo = true AND usuario_id = $1`,
      [usuario_id]
    );

    const disponible = Number(disponibleRows[0].disponible);
    const por_cobrar = Number(cxcRows[0].por_cobrar);
    const inventario = Number(inventarioRows[0].inventario);
    const por_pagar = Number(cxpRows[0].por_pagar);

    const total_activos = disponible + por_cobrar + inventario;
    const total_pasivos = por_pagar;

    return {
      disponible,
      por_cobrar,
      inventario,
      total_activos,
      por_pagar,
      total_pasivos,
      patrimonio: total_activos - total_pasivos,
    };
  },

  getFlujoCaja: async (desde, hasta, usuario_id) => {
    const { rows: saldoInicialRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo), 0) AS saldo_inicial FROM (
         SELECT cd.id,
           cd.saldo_inicial
             + COALESCE(SUM(CASE WHEN mf.tipo = 'ingreso' AND mf.fecha < $2 THEN mf.monto ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN mf.tipo = 'egreso' AND mf.fecha < $2 THEN mf.monto ELSE 0 END), 0) AS saldo
         FROM cuentas_dinero cd
         LEFT JOIN movimientos_financieros mf ON mf.cuenta_dinero_id = cd.id
         WHERE cd.activo = true AND cd.usuario_id = $1
         GROUP BY cd.id, cd.saldo_inicial
       ) sub`,
      [usuario_id, desde]
    );

    const { rows: totalesRows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos_caja,
         COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS egresos_caja
       FROM movimientos_financieros
       WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const { rows: detalleRows } = await pool.query(
      `SELECT tipo, categoria, COALESCE(SUM(monto), 0) AS monto
       FROM movimientos_financieros
       WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
       GROUP BY tipo, categoria
       ORDER BY tipo, monto DESC`,
      [usuario_id, desde, hasta]
    );

    const saldo_inicial = Number(saldoInicialRows[0].saldo_inicial);
    const ingresos_caja = Number(totalesRows[0].ingresos_caja);
    const egresos_caja = Number(totalesRows[0].egresos_caja);
    const flujo_neto = ingresos_caja - egresos_caja;

    return {
      saldo_inicial,
      ingresos_caja,
      egresos_caja,
      flujo_neto,
      saldo_final: saldo_inicial + flujo_neto,
      detalle_por_categoria: detalleRows.map((r) => ({ tipo: r.tipo, categoria: r.categoria, monto: Number(r.monto) })),
    };
  },
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd BACKEND && node --test test/reporte.model.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add BACKEND/src/models/reporte.model.js BACKEND/test/reporte.model.test.js
git commit -m "feat(finanzas): agrego ReporteModel.getBalance y getFlujoCaja"
```

---

### Task 3: `ReporteModel.getResumen` + controller + rutas

**Files:**
- Modify: `BACKEND/src/models/reporte.model.js`
- Create: `BACKEND/src/controllers/reporte.controller.js`
- Create: `BACKEND/src/routes/reporte.routes.js`
- Modify: `BACKEND/src/routes/index.js`
- Test: `BACKEND/test/reporte.controller.test.js`

**Interfaces:**
- Consumes: `ReporteModel.getEstadoResultados` (Task 1), `ReporteModel.getBalance`, `ReporteModel.getFlujoCaja` (Task 2).
- Produces:
  - `ReporteModel.getResumen(desde, hasta, usuario_id) => Promise<{ utilidad_neta_periodo, ingresos_por_ventas_periodo, saldo_total_cuentas, total_por_cobrar, total_por_pagar, ingresos_caja_periodo, egresos_caja_periodo, flujo_neto_caja_periodo }>`
  - Rutas montadas en `/api/reportes`: `GET /resumen?desde&hasta`, `GET /estado-resultados?desde&hasta`, `GET /balance`, `GET /flujo-caja?desde&hasta`.

- [ ] **Step 1: Escribir el test que falla**

```js
// BACKEND/test/reporte.controller.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
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

const HOY = new Date().toISOString().slice(0, 10);

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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd BACKEND && node --test test/reporte.controller.test.js`
Expected: FAIL — `Cannot find module '../src/controllers/reporte.controller.js'`

- [ ] **Step 3: Implementar `getResumen`, el controller y las rutas**

Agregar a `BACKEND/src/models/reporte.model.js`, dentro del objeto `ReporteModel` (después de `getFlujoCaja`, antes de `export default`):

```js
  getResumen: async (desde, hasta, usuario_id) => {
    const [estadoResultados, balance, flujoCaja] = await Promise.all([
      ReporteModel.getEstadoResultados(desde, hasta, usuario_id),
      ReporteModel.getBalance(usuario_id),
      ReporteModel.getFlujoCaja(desde, hasta, usuario_id),
    ]);

    return {
      utilidad_neta_periodo: estadoResultados.utilidad_neta,
      ingresos_por_ventas_periodo: estadoResultados.ingresos_por_ventas,
      saldo_total_cuentas: balance.disponible,
      total_por_cobrar: balance.por_cobrar,
      total_por_pagar: balance.por_pagar,
      ingresos_caja_periodo: flujoCaja.ingresos_caja,
      egresos_caja_periodo: flujoCaja.egresos_caja,
      flujo_neto_caja_periodo: flujoCaja.flujo_neto,
    };
  },
```

(Nota: como `getResumen` está definido dentro del mismo objeto literal `ReporteModel` y lo llama por su nombre (`ReporteModel.getEstadoResultados(...)`), la referencia a `ReporteModel` dentro del objeto sólo funciona porque `ReporteModel` ya es una `const` visible en el módulo al momento en que estas funciones se *ejecutan* — no cuando se *definen*. Es el mismo patrón ya usado en otros modelos del proyecto con funciones que se llaman entre sí.)

Crear `BACKEND/src/controllers/reporte.controller.js`:

```js
// src/controllers/reporte.controller.js
import ReporteModel from "../models/reporte.model.js";

const validarPeriodo = (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) {
    res.status(400).json({ success: false, error: "Los parámetros 'desde' y 'hasta' son requeridos." });
    return null;
  }
  return { desde, hasta };
};

const ReporteController = {
  getResumen: async (req, res, next) => {
    try {
      const periodo = validarPeriodo(req, res);
      if (!periodo) return;
      const data = await ReporteModel.getResumen(periodo.desde, periodo.hasta, req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getEstadoResultados: async (req, res, next) => {
    try {
      const periodo = validarPeriodo(req, res);
      if (!periodo) return;
      const data = await ReporteModel.getEstadoResultados(periodo.desde, periodo.hasta, req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getBalance: async (req, res, next) => {
    try {
      const data = await ReporteModel.getBalance(req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getFlujoCaja: async (req, res, next) => {
    try {
      const periodo = validarPeriodo(req, res);
      if (!periodo) return;
      const data = await ReporteModel.getFlujoCaja(periodo.desde, periodo.hasta, req.usuario_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};

export default ReporteController;
```

Crear `BACKEND/src/routes/reporte.routes.js`:

```js
// src/routes/reporte.routes.js
import { Router } from "express";
import ReporteController from "../controllers/reporte.controller.js";

const router = Router();

router.get("/resumen", ReporteController.getResumen);
router.get("/estado-resultados", ReporteController.getEstadoResultados);
router.get("/balance", ReporteController.getBalance);
router.get("/flujo-caja", ReporteController.getFlujoCaja);

export default router;
```

Modificar `BACKEND/src/routes/index.js` — agregar el import junto a los demás y montar la ruta junto a las otras `router.use(...)`:

```js
import reporteRoutes from "./reporte.routes.js";
```

```js
router.use("/reportes", reporteRoutes);
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd BACKEND && node --test test/reporte.controller.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add BACKEND/src/models/reporte.model.js BACKEND/src/controllers/reporte.controller.js BACKEND/src/routes/reporte.routes.js BACKEND/src/routes/index.js BACKEND/test/reporte.controller.test.js
git commit -m "feat(finanzas): expongo /api/reportes (resumen, estado-resultados, balance, flujo-caja)"
```

---

### Task 4: Frontend — `reportesApi` + página `Reportes.jsx`

**Files:**
- Modify: `FRONTEND/src/services/api.js`
- Create: `FRONTEND/src/pages/Reportes.jsx`
- Modify: `FRONTEND/src/App.jsx`
- Modify: `FRONTEND/src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: los 4 endpoints de Task 3 (`GET /reportes/resumen|estado-resultados|balance|flujo-caja`).
- Produces: ruta `/reportes` navegable desde el sidebar.

- [ ] **Step 1: Agregar `reportesApi` a `FRONTEND/src/services/api.js`**

Agregar al final del archivo (mismo patrón que `cuentasDineroApi` ya existente):

```js
// Reportes
export const reportesApi = {
  resumen: (desde, hasta) => peticion(`/reportes/resumen?desde=${desde}&hasta=${hasta}`),
  estadoResultados: (desde, hasta) => peticion(`/reportes/estado-resultados?desde=${desde}&hasta=${hasta}`),
  balance: () => peticion(`/reportes/balance`),
  flujoCaja: (desde, hasta) => peticion(`/reportes/flujo-caja?desde=${desde}&hasta=${hasta}`),
};
```

- [ ] **Step 2: Crear `FRONTEND/src/pages/Reportes.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, FileText, Scale, Waves } from 'lucide-react';
import { reportesApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Card, Boton, Spinner, StatCard } from '../components/ui/index.jsx';
import { formatearPrecio } from '../utils.js';

const TABS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'estado-resultados', etiqueta: 'Estado de Resultados' },
  { id: 'balance', etiqueta: 'Balance' },
  { id: 'flujo-caja', etiqueta: 'Flujo de Caja' },
];

function primerDiaDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Reportes() {
  const { mostrarToast } = useToast();
  const [tab, setTab] = useState('resumen');
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resumen, estadoResultados, balance, flujoCaja] = await Promise.all([
        reportesApi.resumen(desde, hasta),
        reportesApi.estadoResultados(desde, hasta),
        reportesApi.balance(),
        reportesApi.flujoCaja(desde, hasta),
      ]);
      setDatos({
        resumen: resumen.data,
        'estado-resultados': estadoResultados.data,
        balance: balance.data,
        'flujo-caja': flujoCaja.data,
      });
    } catch (err) {
      mostrarToast(err.message || 'No se pudieron cargar los reportes', 'error');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, mostrarToast]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reportes</h1>
          <p className="text-sm text-slate-500">Resumen, Estado de Resultados, Balance y Flujo de Caja</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-slate-400 text-sm">a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Boton key={t.id} variante={tab === t.id ? 'primario' : 'secundario'} tamaño="sm" onClick={() => setTab(t.id)}>
            {t.etiqueta}
          </Boton>
        ))}
      </div>

      {cargando ? <Spinner /> : (
        <>
          {tab === 'resumen' && <TabResumen datos={datos.resumen} />}
          {tab === 'estado-resultados' && <TabEstadoResultados datos={datos['estado-resultados']} />}
          {tab === 'balance' && <TabBalance datos={datos.balance} />}
          {tab === 'flujo-caja' && <TabFlujoCaja datos={datos['flujo-caja']} />}
        </>
      )}
    </div>
  );
}

function TabResumen({ datos }) {
  if (!datos) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard titulo="Utilidad neta del período" valor={formatearPrecio(datos.utilidad_neta_periodo)} icono={<TrendingUp size={18} />} color={datos.utilidad_neta_periodo >= 0 ? 'verde' : 'rojo'} />
      <StatCard titulo="Saldo en cuentas" valor={formatearPrecio(datos.saldo_total_cuentas)} icono={<Scale size={18} />} color="azul" />
      <StatCard titulo="Por cobrar" valor={formatearPrecio(datos.total_por_cobrar)} icono={<FileText size={18} />} color="amarillo" />
      <StatCard titulo="Por pagar" valor={formatearPrecio(datos.total_por_pagar)} icono={<FileText size={18} />} color="rojo" />
      <StatCard titulo="Ingresos de caja del período" valor={formatearPrecio(datos.ingresos_caja_periodo)} icono={<Waves size={18} />} color="verde" />
      <StatCard titulo="Egresos de caja del período" valor={formatearPrecio(datos.egresos_caja_periodo)} icono={<Waves size={18} />} color="rojo" />
      <StatCard titulo="Flujo neto de caja del período" valor={formatearPrecio(datos.flujo_neto_caja_periodo)} icono={<Waves size={18} />} color={datos.flujo_neto_caja_periodo >= 0 ? 'verde' : 'rojo'} />
      <StatCard titulo="Ingresos por ventas del período" valor={formatearPrecio(datos.ingresos_por_ventas_periodo)} icono={<TrendingUp size={18} />} color="azul" />
    </div>
  );
}

function Fila({ etiqueta, valor, negativo, total }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${total ? 'border-t border-slate-200 mt-1 pt-3 font-semibold text-slate-800' : 'text-slate-600'}`}>
      <span>{etiqueta}</span>
      <span className={negativo ? 'text-red-500' : ''}>{negativo ? '-' : ''}{formatearPrecio(Math.abs(valor))}</span>
    </div>
  );
}

function TabEstadoResultados({ datos }) {
  if (!datos) return null;
  return (
    <Card className="p-5 max-w-xl">
      <Fila etiqueta="Ingresos por ventas" valor={datos.ingresos_por_ventas} />
      <Fila etiqueta="Costo de mercadería vendida" valor={datos.costo_mercaderia_vendida} negativo />
      <Fila etiqueta="Comisiones" valor={datos.comisiones} negativo />
      <Fila etiqueta="Utilidad bruta" valor={datos.utilidad_bruta} total />
      <Fila etiqueta="Gastos operativos" valor={datos.gastos_operativos} negativo />
      <Fila etiqueta="Utilidad neta" valor={datos.utilidad_neta} total />
    </Card>
  );
}

function TabBalance({ datos }) {
  if (!datos) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Activos</h3>
        <Fila etiqueta="Disponible en cuentas" valor={datos.disponible} />
        <Fila etiqueta="Por cobrar" valor={datos.por_cobrar} />
        <Fila etiqueta="Inventario (a costo)" valor={datos.inventario} />
        <Fila etiqueta="Total activos" valor={datos.total_activos} total />
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Pasivos y patrimonio</h3>
        <Fila etiqueta="Por pagar" valor={datos.por_pagar} />
        <Fila etiqueta="Total pasivos" valor={datos.total_pasivos} total />
        <Fila etiqueta="Patrimonio" valor={datos.patrimonio} total />
      </Card>
    </div>
  );
}

function TabFlujoCaja({ datos }) {
  if (!datos) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
      <Card className="p-5">
        <Fila etiqueta="Saldo inicial del período" valor={datos.saldo_inicial} />
        <Fila etiqueta="Ingresos de caja" valor={datos.ingresos_caja} />
        <Fila etiqueta="Egresos de caja" valor={datos.egresos_caja} negativo />
        <Fila etiqueta="Flujo neto" valor={datos.flujo_neto} total />
        <Fila etiqueta="Saldo final del período" valor={datos.saldo_final} total />
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Detalle por categoría</h3>
        {(datos.detalle_por_categoria || []).length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos en el período</p>
        ) : (
          datos.detalle_por_categoria.map((d, i) => (
            <Fila key={i} etiqueta={d.categoria} valor={d.monto} negativo={d.tipo === 'egreso'} />
          ))
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Agregar la ruta en `FRONTEND/src/App.jsx`**

Agregar el import junto a los demás:

```js
import Reportes from './pages/Reportes.jsx';
```

Agregar la ruta dentro del bloque protegido, junto a las otras `<Route path="..." element={...} />`:

```jsx
<Route path="reportes" element={<Reportes />} />
```

- [ ] **Step 4: Agregar el ítem al sidebar en `FRONTEND/src/components/Sidebar.jsx`**

Agregar `FileBarChart` al import de `lucide-react` (junto a `Wallet, HandCoins, Landmark`):

```js
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp,
  Tag, Truck, DollarSign, Users, X, LogOut,
  Wallet, HandCoins, Landmark, FileBarChart
} from 'lucide-react';
```

Agregar la entrada al array `items` (después de `cuentas-por-pagar`):

```js
  { a: '/reportes', icono: FileBarChart, etiqueta: 'Reportes' },
```

- [ ] **Step 5: Verificar manualmente en el navegador**

Con el backend (`node server.js`, puerto 3001) y el frontend (`npm run dev`) corriendo localmente:
1. Iniciar sesión, ir a "Reportes" en el sidebar.
2. Confirmar que las 4 pestañas cargan sin error y muestran números (aunque sean $0 si no hay movimientos en el rango elegido).
3. Cambiar el rango de fechas y confirmar que el Estado de Resultados y el Flujo de Caja cambian; confirmar que el Balance NO cambia con el rango de fechas (es siempre "a hoy").
4. Registrar una venta o un gasto de prueba con cuenta de dinero asociada y confirmar que el Resumen y el Flujo de Caja reflejan el movimiento tras recargar la página (no hay recarga automática entre páginas en este alcance).

- [ ] **Step 6: Commit**

```bash
git add FRONTEND/src/services/api.js FRONTEND/src/pages/Reportes.jsx FRONTEND/src/App.jsx FRONTEND/src/components/Sidebar.jsx
git commit -m "feat(finanzas): agrego pagina Reportes (Resumen, Estado de Resultados, Balance, Flujo de Caja)"
```

---

## Notas para quien ejecute el plan

- No se necesita ninguna migración SQL nueva en esta etapa — todo lee tablas ya existentes.
- El Balance es deliberadamente "a hoy" sin parámetro de fecha — no hay balance histórico en este alcance (evita la complejidad de recomputar inventario a una fecha pasada, que requeriría un método de costeo tipo FIFO que el proyecto explícitamente no quiere).
- Los reportes no cuentan movimientos de cuentas de dinero que fueron desactivadas (`activo = false`) — es la misma limitación que ya tiene `CuentaDineroModel.getSaldo` hoy; no es una regresión de esta etapa.
- Al terminar todas las tareas: usar `superpowers:finishing-a-development-branch` para decidir cómo integrar `feature/modulo-finanzas-etapa3` (dado el historial de esta conversación, lo más probable es "merge local a main", pero hay que preguntar, no asumir).
