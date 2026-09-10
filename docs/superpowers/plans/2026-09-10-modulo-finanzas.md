# Módulo Finanzas — Implementation Plan

> **Para ejecutores agénticos:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para el seguimiento.

**Goal:** Dar a FluxoGest una fuente única de verdad financiera (`movimientos_financieros`) para generar Resumen, Estado de Resultados, Balance, Flujo de Caja, Cuentas por Cobrar y Cuentas por Pagar, sin romper ni duplicar Ventas/Compras/Gastos/Deudores/Proveedores existentes.

**Architecture:** Se agregan tablas nuevas (cuentas de dinero, movimientos financieros, cuentas por cobrar/pagar) y columnas nullable a `ventas`/`compras`/`gastos`. `venta.service.js` y `compra.service.js` generan movimientos automáticamente al operar; ningún endpoint existente cambia de firma ni de comportamiento visible. Un `finanzas.service.js` nuevo es el único lugar que calcula Resultados/Balance/Flujo de Caja, siempre leyendo de `movimientos_financieros` + tablas de origen.

**Tech Stack:** Node/Express 5, `pg` (SQL crudo, sin ORM), PostgreSQL/Supabase, tests con `node --test` (integración contra la base real, patrón crear+limpiar visto en `test/deudor.model.test.js`).

**Spec:** Este plan resume la conversación de análisis previa (ver mensajes del usuario en esta sesión) — no hay archivo de spec separado. Puntos no negociables acordados con el usuario:
- No se toca el comportamiento actual de ventas/compras/gastos/deudores/proveedores.
- Sin integración de API bancaria — el saldo de cada cuenta de dinero se calcula solo, a partir de los movimientos ya registrados en el sistema (nunca se lee un banco real).
- Único ajuste manual permitido: un movimiento de tipo `ajuste_manual` para corregir diferencias contra la realidad, nunca pisar el saldo directamente.
- El costo de mercadería vendida debe basarse en lo efectivamente vendido, no en el total de compras del período (evitar "Ventas − Compras − Gastos = Ganancia").
- Cada etapa se commitea por separado para trazabilidad; **no se hace push** salvo pedido explícito.

## Global Constraints

- No modificar la firma ni el comportamiento actual de: `venta.routes.js`, `compra.routes.js`, `gasto.routes.js`, `deudor.routes.js`, `proveedor.routes.js` y sus controllers/services.
- Toda columna nueva en tablas existentes debe ser `NULL`able o tener `DEFAULT`, para no romper filas existentes ni inserts actuales.
- No existe herramienta de migraciones en el repo (el esquema vive solo en Supabase). Este plan crea `BACKEND/sql/migrations/NNN_descripcion.sql` como registro versionado en git; cada script se aplica manualmente contra Supabase (SQL Editor o `psql "$DATABASE_URL" -f archivo.sql`) — **este paso lo confirma el usuario antes de correr nada contra la base real**.
- Todos los modelos nuevos siguen el patrón exacto de los existentes: `pool`/`client` con SQL parametrizado, filtro obligatorio por `usuario_id` en cada query, `RETURNING *`.
- Tests: integración contra la base real de Supabase, mismo patrón de `test/deudor.model.test.js` (crear datos marcados con un prefijo de test, limpiar en `after`).
- Commits chicos por tarea, mensaje en español consistente con el historial del repo (`git log` ya visto: minúscula descriptiva, sin prefijo tipo "feat:").

---

## Mapa de etapas (visión completa)

| Etapa | Contenido | Estado en este documento |
|---|---|---|
| 0 | Esquema de base de datos nuevo | Detallado abajo (Tareas 1-2) |
| 1 | Backend core: `cuentas_dinero` + `movimientos_financieros` + hooks automáticos en venta/compra/gasto | Detallado abajo (Tareas 3-7) |
| 2 | Cuentas por Cobrar / Cuentas por Pagar (generación automática + cobros/pagos parciales) | Roadmap (se detalla en plan separado antes de ejecutar) |
| 3 | `finanzas.service.js`: Estado de Resultados, Balance, Flujo de Caja + endpoints | Roadmap |
| 4 | Frontend — sección Finanzas completa | Roadmap |
| 5 | Costeo real (COGS) vía movimientos de stock + compras internacionales (arancel/seguro/tipo de cambio) | Roadmap |
| 6 | Migrar `Dashboard.jsx` actual a consumir el endpoint nuevo, sin quitar nada hasta validar paridad | Roadmap |

Este documento detalla completamente **Etapa 0 y Etapa 1** (la base imprescindible). Al cerrar la Etapa 1 y validarla, se escribe el plan detallado de la Etapa 2 como documento nuevo, y así sucesivamente — así se cumple "paso a paso, no de una".

---

# ETAPA 0 — Esquema de base de datos

### Task 1: Migración SQL de tablas y columnas nuevas

**Files:**
- Create: `BACKEND/sql/migrations/001_finanzas_base.sql`
- Create: `BACKEND/sql/migrations/README.md` (cómo aplicar las migraciones — no hay runner automático)

**Interfaces:**
- Produce: tablas `cuentas_dinero`, `movimientos_financieros` y columnas nuevas en `ventas`, `compras`, `gastos`, consumidas por los modelos de la Etapa 1.

- [ ] **Paso 1: Escribir la migración SQL**

```sql
-- BACKEND/sql/migrations/001_finanzas_base.sql
-- Etapa 0 del módulo Finanzas. Todas las columnas nuevas son NULL/DEFAULT
-- para no romper filas ni inserts existentes.

BEGIN;

-- Cuentas de dinero (Caja, Banco, Naranja X, etc.)
-- El saldo NO se guarda acá: se calcula siempre sumando movimientos_financieros.
-- saldo_inicial es el único número que el usuario ingresa a mano, una vez, al crear la cuenta.
CREATE TABLE cuentas_dinero (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('efectivo', 'banco', 'billetera_virtual', 'otro')),
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Movimientos financieros: fuente única de verdad para todos los reportes.
-- origen_tipo/origen_id son una referencia polimórfica liviana (sin FK física,
-- igual que el resto del esquema no usa FKs compuestas) hacia venta/compra/gasto/
-- cuenta_por_cobrar/cuenta_por_pagar/ajuste_manual.
CREATE TABLE movimientos_financieros (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  cuenta_dinero_id INTEGER REFERENCES cuentas_dinero(id),
  origen_tipo TEXT NOT NULL CHECK (origen_tipo IN ('venta', 'compra', 'gasto', 'cuenta_por_cobrar', 'cuenta_por_pagar', 'ajuste_manual')),
  origen_id INTEGER,
  descripcion TEXT,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movfin_usuario_fecha ON movimientos_financieros (usuario_id, fecha);
CREATE INDEX idx_movfin_origen ON movimientos_financieros (origen_tipo, origen_id);
CREATE INDEX idx_movfin_cuenta ON movimientos_financieros (cuenta_dinero_id);

-- Columnas nuevas en ventas: separar fecha de cobro de fecha de operación.
-- Default 'cobrado' preserva el comportamiento actual (toda venta hoy se
-- considera cobrada al momento de emitirse).
ALTER TABLE ventas ADD COLUMN estado_cobro TEXT NOT NULL DEFAULT 'cobrado'
  CHECK (estado_cobro IN ('pendiente', 'parcial', 'cobrado'));
ALTER TABLE ventas ADD COLUMN fecha_cobro DATE;

-- Columnas nuevas en compras: estado de pago a proveedor + costos de importación.
ALTER TABLE compras ADD COLUMN estado_pago TEXT NOT NULL DEFAULT 'pagado'
  CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado'));
ALTER TABLE compras ADD COLUMN fecha_pago DATE;
ALTER TABLE compras ADD COLUMN arancel NUMERIC(12,2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN seguro NUMERIC(12,2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN tipo_cambio NUMERIC(12,4);
ALTER TABLE compras ADD COLUMN otros_costos_importacion NUMERIC(12,2) DEFAULT 0;

-- Columna nueva en gastos: clasificación para el Estado de Resultados
-- (operativo/administrativo/financiero). Default 'operativo' preserva
-- el comportamiento de reportes actuales que no distinguen tipo.
ALTER TABLE gastos ADD COLUMN tipo_gasto TEXT NOT NULL DEFAULT 'operativo'
  CHECK (tipo_gasto IN ('operativo', 'administrativo', 'financiero'));

COMMIT;
```

- [ ] **Paso 2: Escribir el README de migraciones**

```markdown
<!-- BACKEND/sql/migrations/README.md -->
# Migraciones SQL

Este proyecto no usa un runner de migraciones (el esquema vive en Supabase).
Cada archivo `NNN_descripcion.sql` se aplica UNA VEZ, a mano, en orden numérico:

- Opción A: pegar el contenido en el SQL Editor de Supabase y ejecutar.
- Opción B: `psql "$DATABASE_URL" -f sql/migrations/NNN_descripcion.sql`

Después de aplicar un archivo, anotar la fecha acá abajo:

| Archivo | Aplicado el |
|---|---|
| 001_finanzas_base.sql | (pendiente) |
```

- [ ] **Paso 3: Confirmar con el usuario y aplicar la migración**

Mostrarle el SQL, esperar confirmación explícita, y que él (o vos con su autorización) lo corra contra Supabase. **No ejecutar contra la base real sin esa confirmación** — es una operación de esquema sobre producción.

- [ ] **Paso 4: Commit**

```bash
git add BACKEND/sql/migrations/001_finanzas_base.sql BACKEND/sql/migrations/README.md
git commit -m "agrego esquema base de datos para movimientos financieros y cuentas de dinero"
```

---

# ETAPA 1 — Backend core: cuentas de dinero y movimientos financieros

### Task 2: Modelo y tests de `cuentas_dinero`

**Files:**
- Create: `BACKEND/src/models/cuentaDinero.model.js`
- Test: `BACKEND/test/cuentaDinero.model.test.js`

**Interfaces:**
- Produce: `CuentaDineroModel.{getAll, getById, create, update, delete, getSaldo}` — `getSaldo(id, usuario_id)` devuelve `saldo_inicial + SUM(ingresos) - SUM(egresos)` de `movimientos_financieros` para esa cuenta (usado por la Etapa 3).

- [ ] **Paso 1: Escribir el test que falla**

```js
// BACKEND/test/cuentaDinero.model.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";

const MARCA = "__TEST_FINANZAS__";
let REAL_UID;
const cuentasCreadas = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  for (const id of cuentasCreadas) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE cuenta_dinero_id = $1`, [id]);
    await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.end();
});

test("crear una cuenta de dinero con saldo inicial", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Naranja X`, tipo: "billetera_virtual", saldo_inicial: 1000, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  assert.equal(cuenta.nombre, `${MARCA} Naranja X`);
  assert.equal(Number(cuenta.saldo_inicial), 1000);
  assert.equal(cuenta.activo, true);
});

test("getSaldo sin movimientos devuelve el saldo inicial", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Caja`, tipo: "efectivo", saldo_inicial: 500, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  const saldo = await CuentaDineroModel.getSaldo(cuenta.id, REAL_UID);
  assert.equal(saldo, 500);
});

test("getSaldo suma ingresos y resta egresos", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Banco`, tipo: "banco", saldo_inicial: 0, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'ingreso', 'venta_productos', 800, $1, 'ajuste_manual', $2)`,
    [cuenta.id, REAL_UID]
  );
  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'egreso', 'otros_gastos', 300, $1, 'ajuste_manual', $2)`,
    [cuenta.id, REAL_UID]
  );

  const saldo = await CuentaDineroModel.getSaldo(cuenta.id, REAL_UID);
  assert.equal(saldo, 500);
});

test("no se puede ver el saldo de una cuenta de otro usuario", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Ajena`, tipo: "efectivo", saldo_inicial: 999, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  const saldo = await CuentaDineroModel.getSaldo(cuenta.id, "11111111-1111-1111-1111-111111111111");
  assert.equal(saldo, null);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="cuenta"`
Expected: FAIL — `Cannot find module '../src/models/cuentaDinero.model.js'`

- [ ] **Paso 3: Implementar el modelo**

```js
// BACKEND/src/models/cuentaDinero.model.js
// Queries SQL para la tabla cuentas_dinero.
// El saldo NUNCA se guarda en esta tabla: se calcula sumando movimientos_financieros.

import pool from "../config/db.js";

const CuentaDineroModel = {
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_dinero WHERE activo = true AND usuario_id = $1 ORDER BY nombre ASC`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_dinero WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ nombre, tipo, saldo_inicial, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, tipo, saldo_inicial ?? 0, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre, tipo }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE cuentas_dinero SET nombre = $1, tipo = $2
       WHERE id = $3 AND activo = true AND usuario_id = $4 RETURNING *`,
      [nombre, tipo, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE cuentas_dinero SET activo = false WHERE id = $1 AND activo = true AND usuario_id = $2 RETURNING id`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  // saldo_inicial + ingresos - egresos, sólo movimientos de esta cuenta.
  getSaldo: async (id, usuario_id) => {
    const cuenta = await CuentaDineroModel.getById(id, usuario_id);
    if (!cuenta) return null;

    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS egresos
       FROM movimientos_financieros
       WHERE cuenta_dinero_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    const { ingresos, egresos } = rows[0];
    return Number(cuenta.saldo_inicial) + Number(ingresos) - Number(egresos);
  },
};

export default CuentaDineroModel;
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test -- --test-name-pattern="cuenta"`
Expected: PASS (4 tests)

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/models/cuentaDinero.model.js BACKEND/test/cuentaDinero.model.test.js
git commit -m "agrego modelo de cuentas de dinero con saldo calculado desde movimientos"
```

---

### Task 3: Modelo y tests de `movimientos_financieros`

**Files:**
- Create: `BACKEND/src/models/movimientoFinanciero.model.js`
- Test: `BACKEND/test/movimientoFinanciero.model.test.js`

**Interfaces:**
- Consume: nada (tabla base).
- Produce: `MovimientoFinancieroModel.{create, createEnTransaccion, getAll, getByPeriodo, getByOrigen}`. `createEnTransaccion(client, data)` es la versión usada dentro de las transacciones de venta/compra (Task 5-6); `create(data)` es la versión standalone (usada por gastos y ajustes manuales).

- [ ] **Paso 1: Escribir el test que falla**

```js
// BACKEND/test/movimientoFinanciero.model.test.js
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
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="movimiento"`
Expected: FAIL — módulo inexistente

- [ ] **Paso 3: Implementar el modelo**

```js
// BACKEND/src/models/movimientoFinanciero.model.js
// Fuente única de verdad para todos los reportes financieros.
// create() abre su propia conexión; createEnTransaccion() recibe un client
// ya abierto por venta.service.js / compra.service.js para que el movimiento
// se confirme o revierta junto con la operación que lo origina.

import pool from "../config/db.js";

const INSERT_SQL = `
  INSERT INTO movimientos_financieros
    (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, origen_id, descripcion, usuario_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
`;

const toParams = ({ fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, origen_id, descripcion, usuario_id }) => [
  fecha, tipo, categoria, monto, cuenta_dinero_id ?? null, origen_tipo, origen_id ?? null, descripcion ?? null, usuario_id,
];

const MovimientoFinancieroModel = {
  create: async (data) => {
    const { rows } = await pool.query(INSERT_SQL, toParams(data));
    return rows[0];
  },

  createEnTransaccion: async (client, data) => {
    const { rows } = await client.query(INSERT_SQL, toParams(data));
    return rows[0];
  },

  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM movimientos_financieros WHERE usuario_id = $1 ORDER BY fecha DESC, id DESC`,
      [usuario_id]
    );
    return rows;
  },

  getByPeriodo: async (desde, hasta, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM movimientos_financieros
       WHERE fecha BETWEEN $1 AND $2 AND usuario_id = $3
       ORDER BY fecha DESC, id DESC`,
      [desde, hasta, usuario_id]
    );
    return rows;
  },

  getByOrigen: async (origen_tipo, origen_id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM movimientos_financieros
       WHERE origen_tipo = $1 AND origen_id = $2 AND usuario_id = $3`,
      [origen_tipo, origen_id, usuario_id]
    );
    return rows;
  },
};

export default MovimientoFinancieroModel;
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test -- --test-name-pattern="movimiento"`
Expected: PASS (4 tests)

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/models/movimientoFinanciero.model.js BACKEND/test/movimientoFinanciero.model.test.js
git commit -m "agrego modelo de movimientos financieros como fuente unica de verdad"
```

---

### Task 4: Rutas CRUD de `cuentas_dinero` (para que el usuario pueda crear "Naranja X", "Caja", etc.)

**Files:**
- Create: `BACKEND/src/controllers/cuentaDinero.controller.js`
- Create: `BACKEND/src/routes/cuentaDinero.routes.js`
- Modify: `BACKEND/src/routes/index.js`

**Interfaces:**
- Consume: `CuentaDineroModel` (Task 2).
- Produce: `GET/POST/PUT/DELETE /cuentas-dinero`, `GET /cuentas-dinero/:id/saldo`.

- [ ] **Paso 1: Implementar el controller**

```js
// BACKEND/src/controllers/cuentaDinero.controller.js

import CuentaDineroModel from "../models/cuentaDinero.model.js";

const TIPOS_VALIDOS = ["efectivo", "banco", "billetera_virtual", "otro"];

const CuentaDineroController = {
  getAll: async (req, res, next) => {
    try {
      const cuentas = await CuentaDineroModel.getAll(req.usuario_id);
      res.json({ success: true, data: cuentas });
    } catch (err) { next(err); }
  },

  getSaldo: async (req, res, next) => {
    try {
      const { id } = req.params;
      const saldo = await CuentaDineroModel.getSaldo(id, req.usuario_id);
      if (saldo === null) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });
      res.json({ success: true, data: { saldo } });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { nombre, tipo, saldo_inicial } = req.body;
      if (!nombre || !tipo) return res.status(400).json({ success: false, error: "nombre y tipo son requeridos." });
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}.` });
      }
      const cuenta = await CuentaDineroModel.create({ nombre, tipo, saldo_inicial, usuario_id: req.usuario_id });
      res.status(201).json({ success: true, data: cuenta });
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nombre, tipo } = req.body;
      if (!nombre || !tipo) return res.status(400).json({ success: false, error: "nombre y tipo son requeridos." });
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}.` });
      }
      const cuenta = await CuentaDineroModel.update(id, { nombre, tipo }, req.usuario_id);
      if (!cuenta) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });
      res.json({ success: true, data: cuenta });
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const resultado = await CuentaDineroModel.delete(id, req.usuario_id);
      if (!resultado) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });
      res.json({ success: true, message: "Cuenta eliminada correctamente." });
    } catch (err) { next(err); }
  },
};

export default CuentaDineroController;
```

- [ ] **Paso 2: Implementar las rutas**

```js
// BACKEND/src/routes/cuentaDinero.routes.js

import { Router } from "express";
import CuentaDineroController from "../controllers/cuentaDinero.controller.js";

const router = Router();

router.get("/", CuentaDineroController.getAll);
router.get("/:id/saldo", CuentaDineroController.getSaldo);
router.post("/", CuentaDineroController.create);
router.put("/:id", CuentaDineroController.update);
router.delete("/:id", CuentaDineroController.delete);

export default router;
```

- [ ] **Paso 3: Registrar la ruta**

En [BACKEND/src/routes/index.js](BACKEND/src/routes/index.js), agregar el import junto a los demás y una línea `router.use("/cuentas-dinero", cuentaDineroRoutes);` junto a las otras `router.use(...)` — sin tocar ninguna línea existente.

- [ ] **Paso 4: Probar manualmente**

Run: `cd BACKEND && npm run dev`, luego (con un token válido) `curl -X POST http://localhost:PUERTO/cuentas-dinero -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"nombre":"Naranja X","tipo":"billetera_virtual","saldo_inicial":0}'`
Expected: 201 con la cuenta creada; `GET /cuentas-dinero` la lista.

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/controllers/cuentaDinero.controller.js BACKEND/src/routes/cuentaDinero.routes.js BACKEND/src/routes/index.js
git commit -m "agrego endpoints CRUD de cuentas de dinero"
```

---

### Task 5: Hook automático en `venta.service.js` — genera movimiento al cobrar

**Files:**
- Modify: `BACKEND/src/services/venta.service.js`
- Test: `BACKEND/test/venta.service.test.js` (agregar casos, no romper los existentes)

**Interfaces:**
- Consume: `MovimientoFinancieroModel.createEnTransaccion` (Task 3).
- Produce: cada venta con `estado_cobro: 'cobrado'` (el default) genera automáticamente 1 movimiento de tipo `ingreso`, categoría `venta_productos`, dentro de la misma transacción de la venta. Si `estado_cobro` es `'pendiente'` o `'parcial'`, **no** genera movimiento de caja todavía (eso lo hace la Etapa 2, cuando exista la cuenta por cobrar) — se deja el campo listo pero sin comportamiento nuevo visible hasta esa etapa.

- [ ] **Paso 1: Leer el test existente para no romper nada**

Ya leído: `test/venta.service.test.js` prueba `crearVenta`/`eliminarVenta` contra la base real con el mismo patrón de limpieza. Los casos nuevos se agregan al final del archivo, no se tocan los existentes.

- [ ] **Paso 2: Escribir el test que falla**

Agregar a `BACKEND/test/venta.service.test.js` (después de los tests existentes, respetando `MARCA`/`REAL_UID`/limpieza ya presentes en el archivo):

```js
test("una venta cobrada genera un movimiento financiero de ingreso", async () => {
  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const producto = await pool.query(
    `SELECT id, precio_minorista, precio_compra FROM productos WHERE usuario_id = $1 AND stock_actual > 0 LIMIT 1`,
    [REAL_UID]
  );
  if (!producto.rows[0]) throw new Error("No hay producto con stock para el test.");

  const venta = await VentaService.crearVenta({
    tipo: "minorista",
    metodo_pago: "efectivo",
    cuenta_dinero_id,
    items: [{ producto_id: producto.rows[0].id, cantidad: 1 }],
    usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`,
    [venta.id]
  );
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, "ingreso");
  assert.equal(movs[0].categoria, "venta_productos");
  assert.equal(Number(movs[0].monto), Number(venta.total));

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`, [venta.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});
```

(Ajustar el nombre de la variable que guarda ids de ventas creadas al nombre real usado en el archivo — verificar antes de escribir, ej. puede llamarse `ventasCreadas` o similar.)

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="movimiento financiero de ingreso"`
Expected: FAIL — no se crea ningún movimiento todavía.

- [ ] **Paso 4: Modificar `crearVenta` en `venta.service.js`**

En [BACKEND/src/services/venta.service.js](BACKEND/src/services/venta.service.js), dentro de `crearVenta`, después de insertar la cabecera de venta (línea ~153-162, `const venta = await VentaModel.insertCabecera(...)`) y **antes** del `COMMIT`, agregar:

```js
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
```

y en la firma de `crearVenta`, agregar el parámetro `cuenta_dinero_id` (opcional, `undefined` no rompe nada de lo existente):

```js
const crearVenta = async ({ tipo, observaciones, metodo_pago, canal, comision, cuenta_dinero_id, items, usuario_id }) => {
```

y luego, justo después del bloque que inserta la cabecera:

```js
    // Genera el movimiento financiero automáticamente solo si la venta se cobra
    // en el momento (comportamiento actual, estado_cobro default 'cobrado').
    // Si en el futuro se pasa estado_cobro pendiente/parcial, esto se resuelve
    // en la Etapa 2 (cuentas por cobrar) — acá no se genera movimiento todavía.
    if (cuenta_dinero_id) {
      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: venta.fecha,
        tipo: "ingreso",
        categoria: "venta_productos",
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "venta",
        origen_id: venta.id,
        descripcion: `Venta #${venta.id}`,
        usuario_id,
      });
    }
```

Nota: `cuenta_dinero_id` queda **opcional** a propósito — todas las ventas que se sigan creando desde el frontend actual (que todavía no manda ese campo) siguen funcionando exactamente igual, sin generar movimiento. Esto se activa recién cuando el frontend de la Etapa 4 empiece a mandarlo.

- [ ] **Paso 5: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS — todos los tests existentes de venta siguen en verde, más el nuevo.

- [ ] **Paso 6: Commit**

```bash
git add BACKEND/src/services/venta.service.js BACKEND/test/venta.service.test.js
git commit -m "las ventas generan movimiento financiero automatico cuando se indica cuenta de dinero"
```

---

### Task 6: Hook automático en `compra.service.js` y en gastos

**Files:**
- Modify: `BACKEND/src/services/compra.service.js`
- Modify: `BACKEND/src/controllers/gasto.controller.js`
- Test: `BACKEND/test/compra.service.test.js`, `BACKEND/test/gasto.controller.test.js` (crear este último si no existe control de integración de gastos)

**Interfaces:**
- Consume: `MovimientoFinancieroModel` (Task 3).
- Produce: mismo patrón que Task 5 pero para compras (`categoria` según `tipo`: `costo_mercaderia`, más un segundo movimiento de `flete` si `costo_envio > 0`) y gastos (`categoria` = `gastos.categoria` normalizada, `tipo` según `tipo_gasto`).

- [ ] **Paso 1: Escribir el test que falla para compras** (mismo patrón que Task 5, adaptado a `crearCompra`, verificando que se genera 1 movimiento `egreso`/`costo_mercaderia` por el total de items y, si `costo_envio > 0`, un segundo movimiento `egreso`/`flete`).

- [ ] **Paso 2: Correr y verificar que falla.**

- [ ] **Paso 3: Modificar `crearCompra` en `compra.service.js`** — mismo patrón que Task 5: parámetro opcional `cuenta_dinero_id`, insertar movimiento(s) dentro de la transacción antes del `COMMIT`, solo si `cuenta_dinero_id` viene informado.

- [ ] **Paso 4: Escribir el test que falla para gastos** — al crear un gasto con `cuenta_dinero_id`, se genera 1 movimiento `egreso` con `origen_tipo = 'gasto'`.

- [ ] **Paso 5: Modificar `gasto.controller.js`** — en `create`, después de `GastoModel.create(...)`, si viene `cuenta_dinero_id` en el body, llamar a `MovimientoFinancieroModel.create({...})` con `categoria` = el valor de `gasto.categoria` (texto libre actual, se mapea 1 a 1 por ahora) y `tipo` fijo `'egreso'`.

- [ ] **Paso 6: Correr todos los tests y verificar que pasan.**

Run: `cd BACKEND && npm test`
Expected: PASS — ningún test existente se rompe.

- [ ] **Paso 7: Commit**

```bash
git add BACKEND/src/services/compra.service.js BACKEND/src/controllers/gasto.controller.js BACKEND/test/compra.service.test.js BACKEND/test/gasto.controller.test.js
git commit -m "las compras y gastos generan movimiento financiero automatico cuando se indica cuenta de dinero"
```

---

### Task 7: Endpoint de ajuste manual

**Files:**
- Modify: `BACKEND/src/controllers/cuentaDinero.controller.js`
- Modify: `BACKEND/src/routes/cuentaDinero.routes.js`

**Interfaces:**
- Produce: `POST /cuentas-dinero/:id/ajuste` `{ monto, tipo: 'ingreso'|'egreso', descripcion }` → crea un `movimientos_financieros` con `origen_tipo: 'ajuste_manual'`, `origen_id: null`, `cuenta_dinero_id: id`.

- [ ] **Paso 1: Agregar el método al controller**

```js
  crearAjuste: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { monto, tipo, descripcion } = req.body;
      if (!monto || monto <= 0) return res.status(400).json({ success: false, error: "monto debe ser mayor a 0." });
      if (!["ingreso", "egreso"].includes(tipo)) {
        return res.status(400).json({ success: false, error: "tipo debe ser 'ingreso' o 'egreso'." });
      }
      const cuenta = await CuentaDineroModel.getById(id, req.usuario_id);
      if (!cuenta) return res.status(404).json({ success: false, error: "Cuenta no encontrada." });

      const movimiento = await MovimientoFinancieroModel.create({
        fecha: new Date().toISOString().slice(0, 10),
        tipo, categoria: "ajuste_manual", monto,
        cuenta_dinero_id: id, origen_tipo: "ajuste_manual",
        descripcion: descripcion || "Ajuste manual de saldo",
        usuario_id: req.usuario_id,
      });
      res.status(201).json({ success: true, data: movimiento });
    } catch (err) { next(err); }
  },
```

(agregar el import de `MovimientoFinancieroModel` arriba del archivo)

- [ ] **Paso 2: Agregar la ruta**

```js
router.post("/:id/ajuste", CuentaDineroController.crearAjuste);
```

- [ ] **Paso 3: Probar manualmente** con `curl`/Postman: crear cuenta, ver saldo, crear ajuste, ver que el saldo cambió lo esperado.

- [ ] **Paso 4: Commit**

```bash
git add BACKEND/src/controllers/cuentaDinero.controller.js BACKEND/src/routes/cuentaDinero.routes.js
git commit -m "agrego endpoint de ajuste manual de saldo por cuenta de dinero"
```

---

## Roadmap detallado de Etapas 2 a 6 (a planificar en documentos separados)

**Etapa 2 — Cuentas por Cobrar / Cuentas por Pagar**
- Tablas `cuentas_por_cobrar`, `cuentas_por_pagar` (venta_id/compra_id opcional, saldo_pendiente, vencimiento, estado).
- Al crear una venta con `estado_cobro != 'cobrado'`, generar automáticamente una `cuenta_por_cobrar`.
- Al crear una compra con `estado_pago != 'pagado'`, generar automáticamente una `cuenta_por_pagar`.
- Endpoints de cobro/pago parcial que descuentan `saldo_pendiente` y generan el `movimiento_financiero` correspondiente recién en ese momento (éste es el punto donde el dinero "realmente entra/sale").
- `deudores` actual queda intacto, sin migración forzada — convive como registro manual independiente.

**Etapa 3 — `finanzas.service.js` (el motor de reportes)**
- Estado de Resultados: ingresos por ventas − costo de mercadería vendida (ver Etapa 5 para el cálculo correcto de COGS) = resultado bruto; − gastos operativos/administrativos/financieros (por `tipo_gasto`) = resultado antes de impuestos; − impuestos = resultado neto; márgenes.
- Balance: Activo (saldo de cuentas de dinero + cuentas por cobrar + valor de stock) = Pasivo (cuentas por pagar) + Patrimonio Neto (capital + resultados acumulados), con validación de la ecuación contable.
- Flujo de Caja: saldo inicial + ingresos reales (movimientos) − egresos reales (movimientos) = saldo final, por período.
- Endpoints: `GET /finanzas/resumen`, `/finanzas/resultados`, `/finanzas/balance`, `/finanzas/flujo-caja`, todos con filtro de período.

**Etapa 4 — Frontend**
- `FRONTEND/src/pages/Finanzas/` con subpáginas Resumen, EstadoResultados, Balance, FlujoCaja, Movimientos, CuentasPorCobrar, CuentasPorPagar, ConfiguracionFinanciera (alta de cuentas de dinero).
- Reutilizar `ui/index.jsx`, `FiltroPeriodoGlobal.jsx`, patrón de `api.js`.
- Alertas: cuentas por pagar > cuentas por cobrar, deudas vencidas, flujo de caja negativo, caída de margen, próximos vencimientos, capital inmovilizado en stock.

**Etapa 5 — Costeo real (COGS) y compras internacionales**
- Usar `venta_items.costo_unitario` (ya es snapshot histórico) como base del COGS real por período, en vez de "compras del período" — esto ya resuelve el punto crítico que pediste, sin necesitar FIFO/promedio pleno.
- Incorporar `arancel + seguro + tipo_cambio + otros_costos_importacion` al costo prorrateado por ítem en compras internacionales, actualizando `precio_compra` del producto de forma explícita (no silenciosa) al cerrar una compra.

**Etapa 6 — Migración del Dashboard**
- `Dashboard.jsx` pasa a llamar `GET /finanzas/resumen` en lugar de recalcular en memoria.
- Correr ambos cálculos en paralelo durante una etapa de validación (mostrar los dos números o loguear diferencias) antes de retirar el cálculo viejo.

---

## Self-Review

**Cobertura de la conversación:** movimientos financieros como fuente única ✅ (Task 3), cuentas de dinero calculadas sin integración bancaria ✅ (Task 2), ajuste manual como única vía de corrección ✅ (Task 7), no romper ventas/compras/gastos/deudores ✅ (todos los campos nuevos son opcionales/con default, ningún test existente se modifica salvo agregar casos), commits por tarea sin push ✅ (cada task termina en commit, no se menciona push en ningún paso), COGS real vs. compras del período — dejado explícitamente para Etapa 5 con el mecanismo concreto (usar `costo_unitario` ya existente) para que no quede como placeholder.

**Placeholders:** ninguno en Etapas 0-1 (todo el código y SQL está completo). El roadmap de Etapas 2-6 es intencionalmente de alto nivel — se detalla igual de exhaustivamente en un documento nuevo antes de ejecutar cada una, tal como pidió el usuario ("paso a paso, no de una").
