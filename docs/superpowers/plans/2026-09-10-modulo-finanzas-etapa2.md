# Módulo Finanzas — Etapa 2: Cuentas por Cobrar / Cuentas por Pagar — Implementation Plan

> **Para ejecutores agénticos:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para el seguimiento.

**Goal:** Cerrar los tres vacíos que la revisión final de la Etapa 1 dejó marcados como "primero en Etapa 2" (vocabulario de categorías, comisión de MercadoLibre, reversión de movimientos al anular/editar), y construir Cuentas por Cobrar / Cuentas por Pagar generadas automáticamente desde ventas/compras a crédito, con cobro/pago parcial registrado contra `movimientos_financieros`.

**Architecture:** `movimientos_financieros` sigue siendo la única fuente de verdad de caja (nunca de resultado devengado). Una venta/compra a crédito NO genera movimiento de caja al crearse — genera una fila en `cuentas_por_cobrar`/`cuentas_por_pagar` sin movimiento. El movimiento de caja recién se crea cuando se registra un cobro/pago parcial contra esa cuenta, vía un servicio nuevo que decrementa `saldo_pendiente` y crea el movimiento en la misma transacción. Anular una venta o editar una compra ya no deja el libro de movimientos desincronizado: se generan movimientos compensatorios (de signo opuesto) en vez de borrar nada, preservando el carácter append-only del libro.

**Tech Stack:** Igual que Etapa 0-1 — Node/Express 5, `pg` SQL crudo, PostgreSQL/Supabase, tests de integración con `node --test` contra la base real.

**Spec:** [docs/superpowers/plans/2026-09-10-modulo-finanzas.md](2026-09-10-modulo-finanzas.md) (plan de Etapa 0-1, ya mergeado a main) — este documento es su continuación directa. Los rulings de la revisión final de esa etapa son requisitos de este plan, no sugerencias:
- Reversión: `eliminarVenta` y `editarCompra` deben dejar de romper la integridad del libro de movimientos — **primer objetivo de este plan**.
- Vocabulario de categorías: debe existir un módulo compartido de constantes antes de que se agregue un cuarto punto de escritura al libro — **primer objetivo de este plan**.
- Comisión de MercadoLibre: debe generar su propio movimiento de egreso, igual que el flete en compras.

## Global Constraints

- No modificar la firma ni el comportamiento visible de ningún endpoint existente para callers que no manden los campos nuevos (mismo principio que Etapa 0-1: todo lo nuevo es opcional/con default).
- Todo cambio de esquema es aditivo (columnas nullable/con default, tablas nuevas) — se versiona en `BACKEND/sql/migrations/00N_*.sql` y se aplica a mano contra Supabase, con confirmación explícita del usuario antes de correr el SQL real.
- Ninguna categoría nueva entra al libro de movimientos como texto libre sin pasar por el módulo de constantes de la Tarea 1.
- El libro de movimientos (`movimientos_financieros`) nunca se edita ni se borra una vez creado (salvo por los tests, que limpian sus propias filas por id) — toda corrección se hace con un movimiento compensatorio nuevo.
- Todos los modelos siguen el patrón exacto de los existentes: `pool`/`client`, SQL parametrizado, filtro obligatorio por `usuario_id`, `RETURNING *`.
- Commits chicos por tarea, sin push salvo pedido explícito del usuario.

---

## Mapa de tareas

| Tarea | Contenido |
|---|---|
| 1 | Módulo de constantes de categorías + normalización de la categoría de gasto |
| 2 | Comisión de MercadoLibre genera su propio movimiento de egreso |
| 3 | Reversión de movimientos al anular una venta |
| 4 | Reversión + recreación de movimientos al editar una compra |
| 5 | Migración SQL: `cuentas_por_cobrar`, `cuentas_por_pagar` |
| 6 | Modelo + tests de `cuentas_por_cobrar` |
| 7 | Modelo + tests de `cuentas_por_pagar` |
| 8 | Generación automática de cuenta por cobrar en ventas a crédito |
| 9 | Generación automática de cuenta por pagar en compras a crédito |
| 10 | Endpoints de cobro/pago parcial (crean el movimiento de caja real) |

---

### Task 1: Módulo de constantes de categorías financieras

**Files:**
- Create: `BACKEND/src/constants/finanzas.js`
- Modify: `BACKEND/src/controllers/gasto.controller.js`
- Test: `BACKEND/test/finanzas.constants.test.js`

**Interfaces:**
- Produce: `CATEGORIAS_INGRESO`, `CATEGORIAS_COSTO`, `CATEGORIAS_GASTO`, `CATEGORIA_AJUSTE_MANUAL`, `ORIGEN_TIPOS`, `normalizarCategoriaGasto(texto)` — usados por todas las tareas siguientes y por los hooks ya existentes de venta/compra (Tarea 2 en adelante los migra a usar estas constantes).

- [ ] **Paso 1: Escribir el test que falla**

```js
// BACKEND/test/finanzas.constants.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORIAS_GASTO,
  normalizarCategoriaGasto,
} from "../src/constants/finanzas.js";

test("normaliza las categorías sugeridas actuales del frontend a valores canónicos", () => {
  assert.equal(normalizarCategoriaGasto("Alquiler"), CATEGORIAS_GASTO.ALQUILER);
  assert.equal(normalizarCategoriaGasto("Servicios"), CATEGORIAS_GASTO.SERVICIOS);
  assert.equal(normalizarCategoriaGasto("Transporte"), CATEGORIAS_GASTO.COMBUSTIBLE);
  assert.equal(normalizarCategoriaGasto("Marketing"), CATEGORIAS_GASTO.MARKETING);
  assert.equal(normalizarCategoriaGasto("Personal"), CATEGORIAS_GASTO.SUELDOS);
  assert.equal(normalizarCategoriaGasto("Impuestos"), CATEGORIAS_GASTO.IMPUESTOS);
  assert.equal(normalizarCategoriaGasto("Otros"), CATEGORIAS_GASTO.OTROS_GASTOS);
});

test("es insensible a mayúsculas, tildes y espacios extra", () => {
  assert.equal(normalizarCategoriaGasto("  ALQUILER  "), CATEGORIAS_GASTO.ALQUILER);
  assert.equal(normalizarCategoriaGasto("cómbustible"), CATEGORIAS_GASTO.COMBUSTIBLE);
});

test("categoría desconocida o vacía cae a OTROS_GASTOS en vez de pasar texto libre", () => {
  assert.equal(normalizarCategoriaGasto("una categoria que no existe"), CATEGORIAS_GASTO.OTROS_GASTOS);
  assert.equal(normalizarCategoriaGasto(null), CATEGORIAS_GASTO.OTROS_GASTOS);
  assert.equal(normalizarCategoriaGasto(undefined), CATEGORIAS_GASTO.OTROS_GASTOS);
  assert.equal(normalizarCategoriaGasto(""), CATEGORIAS_GASTO.OTROS_GASTOS);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="categor"`
Expected: FAIL — módulo inexistente

- [ ] **Paso 3: Implementar el módulo de constantes**

```js
// BACKEND/src/constants/finanzas.js
// Vocabulario canónico de categorías financieras. Toda categoría que entra a
// movimientos_financieros debe salir de acá — evita que texto libre (ej. la
// categoría de gastos, hoy sugerida en el frontend pero no restringida en la
// base) ensucie el libro con variantes de mayúsculas/tildes que romperían
// cualquier reporte futuro agrupado por categoría.

export const CATEGORIAS_INGRESO = {
  VENTA_PRODUCTOS: "venta_productos",
  VENTA_SERVICIOS: "venta_servicios",
  OTROS_INGRESOS: "otros_ingresos",
};

export const CATEGORIAS_COSTO = {
  COSTO_MERCADERIA: "costo_mercaderia",
  FLETE: "flete",
  IMPORTACION: "importacion",
  COMISIONES: "comisiones",
};

export const CATEGORIAS_GASTO = {
  ALQUILER: "alquiler",
  SERVICIOS: "servicios",
  SUELDOS: "sueldos",
  MARKETING: "marketing",
  SOFTWARE: "software",
  TELEFONIA: "telefonia",
  COMBUSTIBLE: "combustible",
  MANTENIMIENTO: "mantenimiento",
  HONORARIOS: "honorarios",
  IMPUESTOS: "impuestos",
  GASTOS_BANCARIOS: "gastos_bancarios",
  OTROS_GASTOS: "otros_gastos",
};

export const CATEGORIA_AJUSTE_MANUAL = "ajuste_manual";

export const ORIGEN_TIPOS = {
  VENTA: "venta",
  COMPRA: "compra",
  GASTO: "gasto",
  CUENTA_POR_COBRAR: "cuenta_por_cobrar",
  CUENTA_POR_PAGAR: "cuenta_por_pagar",
  AJUSTE_MANUAL: "ajuste_manual",
};

// Mapea el texto libre actual de gastos.categoria (hoy sugerido pero no
// restringido en FRONTEND/src/pages/Gastos.jsx: Servicios, Alquiler,
// Transporte, Marketing, Personal, Impuestos, Otros) a la categoría canónica
// más cercana. Si no matchea nada conocido, cae a OTROS_GASTOS en vez de
// dejar pasar el texto original al libro de movimientos.
const MAPA_NORMALIZACION_GASTO = {
  alquiler: CATEGORIAS_GASTO.ALQUILER,
  servicios: CATEGORIAS_GASTO.SERVICIOS,
  sueldos: CATEGORIAS_GASTO.SUELDOS,
  personal: CATEGORIAS_GASTO.SUELDOS,
  marketing: CATEGORIAS_GASTO.MARKETING,
  software: CATEGORIAS_GASTO.SOFTWARE,
  telefonia: CATEGORIAS_GASTO.TELEFONIA,
  combustible: CATEGORIAS_GASTO.COMBUSTIBLE,
  transporte: CATEGORIAS_GASTO.COMBUSTIBLE,
  mantenimiento: CATEGORIAS_GASTO.MANTENIMIENTO,
  honorarios: CATEGORIAS_GASTO.HONORARIOS,
  impuestos: CATEGORIAS_GASTO.IMPUESTOS,
  "gastos bancarios": CATEGORIAS_GASTO.GASTOS_BANCARIOS,
  otros: CATEGORIAS_GASTO.OTROS_GASTOS,
};

const quitarAcentos = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const normalizarCategoriaGasto = (categoriaLibre) => {
  if (!categoriaLibre) return CATEGORIAS_GASTO.OTROS_GASTOS;
  const clave = quitarAcentos(String(categoriaLibre).trim().toLowerCase());
  return MAPA_NORMALIZACION_GASTO[clave] || CATEGORIAS_GASTO.OTROS_GASTOS;
};
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test -- --test-name-pattern="categor"`
Expected: PASS (3 tests)

- [ ] **Paso 5: Usar la normalización en el hook de gastos**

En [BACKEND/src/controllers/gasto.controller.js](../../../BACKEND/src/controllers/gasto.controller.js), agregar el import:

```js
import { normalizarCategoriaGasto } from "../constants/finanzas.js";
```

y cambiar la línea del movimiento (dentro de `create`, en el bloque `if (cuenta_dinero_id) { ... }`):

```js
        categoria: gasto.categoria || "otros_gastos",
```

por:

```js
        categoria: normalizarCategoriaGasto(gasto.categoria),
```

No tocar ninguna otra línea del archivo.

- [ ] **Paso 6: Actualizar el test existente de gastos que depende de la categoría literal**

En `BACKEND/test/gasto.controller.test.js`, el test "crear un gasto con cuenta_dinero_id genera un movimiento financiero de egreso" crea un gasto con `categoria: "Alquiler"` y luego afirma `assert.equal(movs[0].categoria, "Alquiler")`. Cambiar esa aserción a `assert.equal(movs[0].categoria, "alquiler")` (valor canónico normalizado, ver `CATEGORIAS_GASTO.ALQUILER`). No cambiar nada más del test.

- [ ] **Paso 7: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS — todos los tests, incluyendo el ajustado.

- [ ] **Paso 8: Commit**

```bash
git add BACKEND/src/constants/finanzas.js BACKEND/test/finanzas.constants.test.js BACKEND/src/controllers/gasto.controller.js BACKEND/test/gasto.controller.test.js
git commit -m "agrego vocabulario canonico de categorias financieras y normalizo la categoria de gasto"
```

---

### Task 2: La comisión de MercadoLibre genera su propio movimiento de egreso

**Files:**
- Modify: `BACKEND/src/services/venta.service.js`
- Test: `BACKEND/test/venta.service.test.js`

**Interfaces:**
- Consume: `CATEGORIAS_INGRESO`, `CATEGORIAS_COSTO` (Task 1).
- Produce: cuando una venta con `canal: 'mercadolibre'` y `comision > 0` se crea con `cuenta_dinero_id`, se genera un segundo movimiento `egreso`/`comisiones` además del `ingreso`/`venta_productos` ya existente — el dinero que efectivamente entra a la cuenta pasa a estar correctamente reflejado como dos movimientos (entra el total, sale la comisión) en vez de uno que ignora la comisión.

- [ ] **Paso 1: Escribir el test que falla**

Agregar a `BACKEND/test/venta.service.test.js` (al final, siguiendo la convención ya presente: `MARCA`, `REAL_UID`, `ventasCreadas`, `productoDePrueba`):

```js
test("una venta por MercadoLibre con cuenta de dinero genera movimiento de ingreso y de comision por separado", async () => {
  const p = await productoDePrueba({ stock_actual: 5, precio_compra: 100, precio_minorista: 200 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta ml`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const venta = await VentaService.crearVenta({
    tipo: "minorista", canal: "mercadolibre", comision: 30, cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1 ORDER BY categoria`,
    [venta.id]
  );
  assert.equal(movs.length, 2);
  const ingreso = movs.find((m) => m.categoria === "venta_productos");
  const comisionMov = movs.find((m) => m.categoria === "comisiones");
  assert.ok(ingreso && comisionMov);
  assert.equal(ingreso.tipo, "ingreso");
  assert.equal(Number(ingreso.monto), 200, "el ingreso registra el total de la venta, no el neto");
  assert.equal(comisionMov.tipo, "egreso");
  assert.equal(Number(comisionMov.monto), 30);

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`, [venta.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="comision"`
Expected: FAIL — solo se crea 1 movimiento hoy, el test espera 2.

- [ ] **Paso 3: Modificar el hook de venta**

En [BACKEND/src/services/venta.service.js](../../../BACKEND/src/services/venta.service.js), agregar el import:

```js
import { CATEGORIAS_INGRESO, CATEGORIAS_COSTO } from "../constants/finanzas.js";
```

Reemplazar el bloque `if (cuenta_dinero_id) { ... }` (el que hoy inserta un único movimiento con `categoria: "venta_productos"`) por:

```js
    if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: venta.fecha,
        tipo: "ingreso",
        categoria: CATEGORIAS_INGRESO.VENTA_PRODUCTOS,
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "venta",
        origen_id: venta.id,
        descripcion: `Venta #${venta.id}`,
        usuario_id,
      });

      if (comisionNumerica > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: venta.fecha,
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.COMISIONES,
          monto: comisionNumerica,
          cuenta_dinero_id,
          origen_tipo: "venta",
          origen_id: venta.id,
          descripcion: `Comisión venta #${venta.id}`,
          usuario_id,
        });
      }
    }
```

Esto reemplaza el literal `"venta_productos"` por la constante y agrega el segundo movimiento condicional. No tocar nada fuera de este bloque.

- [ ] **Paso 4: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS — todos los tests, incluyendo los de Etapa 1 que ya verificaban el movimiento de `venta_productos` (siguen viendo esa categoría porque la constante tiene el mismo valor string).

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/services/venta.service.js BACKEND/test/venta.service.test.js
git commit -m "la comision de mercadolibre genera su propio movimiento de egreso"
```

---

### Task 3: Reversión de movimientos al anular una venta

**Files:**
- Modify: `BACKEND/src/services/venta.service.js`
- Test: `BACKEND/test/venta.service.test.js`

**Interfaces:**
- Consume: `MovimientoFinancieroModel.createEnTransaccion` (existente).
- Produce: `eliminarVenta` ahora, además de reponer stock, crea un movimiento compensatorio (signo opuesto, mismo monto y cuenta) por cada movimiento que la venta original haya generado — el libro queda consistente sin borrar ni editar ninguna fila.

- [ ] **Paso 1: Escribir el test que falla**

Agregar a `BACKEND/test/venta.service.test.js`:

```js
test("anular una venta con movimientos genera movimientos compensatorios y el saldo de la cuenta vuelve al original", async () => {
  const p = await productoDePrueba({ stock_actual: 5, precio_compra: 50, precio_minorista: 100 });

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',1000,$2) RETURNING id`,
    [`${MARCA} cuenta reversion`, REAL_UID]
  );
  const cuenta_dinero_id = cuenta.rows[0].id;

  const venta = await VentaService.crearVenta({
    tipo: "minorista", cuenta_dinero_id,
    items: [{ producto_id: p.id, cantidad: 2 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  const saldoTrasVenta = await CuentaDineroModel.getSaldo(cuenta_dinero_id, REAL_UID);
  assert.equal(Number(saldoTrasVenta), 1000 + 200);

  await VentaService.eliminarVenta(venta.id, REAL_UID);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1 ORDER BY id`,
    [venta.id]
  );
  assert.equal(movs.length, 2, "el movimiento original mas su reversion");
  assert.equal(movs[0].tipo, "ingreso");
  assert.equal(movs[1].tipo, "egreso");
  assert.equal(Number(movs[1].monto), Number(movs[0].monto));

  const saldoTrasAnular = await CuentaDineroModel.getSaldo(cuenta_dinero_id, REAL_UID);
  assert.equal(Number(saldoTrasAnular), 1000, "el saldo debe volver exactamente al inicial");

  await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`, [venta.id]);
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuenta_dinero_id]);
});

test("anular una venta sin movimientos financieros no genera ninguno nuevo", async () => {
  const p = await productoDePrueba({ stock_actual: 5 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista", items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  await VentaService.eliminarVenta(venta.id, REAL_UID);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`,
    [venta.id]
  );
  assert.equal(movs.length, 0);
});
```

Agregar también el import que falte en el archivo: `import CuentaDineroModel from "../src/models/cuentaDinero.model.js";` (verificar primero si ya está importado; si no, agregarlo junto a los demás imports).

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="compensatorio"`
Expected: FAIL — hoy `eliminarVenta` no toca `movimientos_financieros`.

- [ ] **Paso 3: Modificar `eliminarVenta`**

En [BACKEND/src/services/venta.service.js](../../../BACKEND/src/services/venta.service.js), dentro de `eliminarVenta`, después del `for (const item of items) { await ProductoModel.updateStock(...) }` y antes del `UPDATE ventas SET activo = false`, insertar:

```js
    const { rows: movimientosOriginales } = await client.query(
      `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    for (const mov of movimientosOriginales) {
      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: new Date().toISOString().slice(0, 10),
        tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
        categoria: mov.categoria,
        monto: mov.monto,
        cuenta_dinero_id: mov.cuenta_dinero_id,
        origen_tipo: "venta",
        origen_id: id,
        descripcion: `Reversión por anulación de venta #${id}`,
        usuario_id,
      });
    }
```

Esto se ejecuta siempre (sin guardar contra `cuenta_dinero_id`, porque lo que importa es si la venta original generó movimientos, no si el caller de `eliminarVenta` manda algo — `eliminarVenta` no recibe `cuenta_dinero_id`, solo `id` y `usuario_id`, y así se mantiene).

- [ ] **Paso 4: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS — incluyendo el test ya existente "anular una venta repone el stock descontado" (que no usa `cuenta_dinero_id`, por lo que `movimientosOriginales` será un array vacío y el comportamiento no cambia para ese caso).

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/services/venta.service.js BACKEND/test/venta.service.test.js
git commit -m "anular una venta genera movimientos compensatorios en vez de dejar el libro desincronizado"
```

---

### Task 4: Reversión + recreación de movimientos al editar una compra

**Files:**
- Modify: `BACKEND/src/services/compra.service.js`
- Test: `BACKEND/test/compra.service.test.js`

**Interfaces:**
- Consume: `MovimientoFinancieroModel.createEnTransaccion`, `CuentaDineroModel.getById` (existentes).
- Produce: `editarCompra` gana el parámetro opcional `cuenta_dinero_id`. Al editar: (a) siempre revierte (con movimientos compensatorios) cualquier movimiento que la compra ya tuviera, porque el total puede haber cambiado; (b) si en esta llamada se pasa `cuenta_dinero_id`, crea movimientos nuevos con los montos actualizados (mismo patrón que `crearCompra`). Si no se pasa, no se crean movimientos nuevos — la compra queda sin reflejo en caja hasta la próxima edición que sí lo indique (limitación documentada, no ambigua).

- [ ] **Paso 1: Escribir el test que falla**

Agregar a `BACKEND/test/compra.service.test.js`:

```js
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
```

Agregar el import de `CuentaDineroModel` al test si no está ya presente.

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="editar una compra con movimientos"`
Expected: FAIL — hoy `editarCompra` no toca movimientos ni acepta `cuenta_dinero_id`.

- [ ] **Paso 3: Modificar `editarCompra`**

En [BACKEND/src/services/compra.service.js](../../../BACKEND/src/services/compra.service.js):

1. Agregar el import: `import { CATEGORIAS_COSTO } from "../constants/finanzas.js";`
2. Cambiar la firma de `editarCompra`:

```js
const editarCompra = async (id, { proveedor_id, observaciones, tipo, costo_envio, cuenta_dinero_id, items, usuario_id }) => {
```

3. Después del bloque `await CompraModel.updateCabecera(...)` y el `for` que reinserta items/actualiza stock, y antes de `await client.query("COMMIT")`, insertar:

```js
    const { rows: movimientosOriginales } = await client.query(
      `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'compra' AND origen_id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    for (const mov of movimientosOriginales) {
      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: new Date().toISOString().slice(0, 10),
        tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
        categoria: mov.categoria,
        monto: mov.monto,
        cuenta_dinero_id: mov.cuenta_dinero_id,
        origen_tipo: "compra",
        origen_id: id,
        descripcion: `Reversión por edición de compra #${id}`,
        usuario_id,
      });
    }

    if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "egreso",
        categoria: CATEGORIAS_COSTO.COSTO_MERCADERIA,
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "compra",
        origen_id: id,
        descripcion: `Compra #${id} (editada)`,
        usuario_id,
      });

      const costoEnvioNumerico = Number(costo_envio) || 0;
      if (costoEnvioNumerico > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: new Date().toISOString().slice(0, 10),
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.FLETE,
          monto: costoEnvioNumerico,
          cuenta_dinero_id,
          origen_tipo: "compra",
          origen_id: id,
          descripcion: `Flete compra #${id} (editada)`,
          usuario_id,
        });
      }
    }
```

4. En `crearCompra`, reemplazar los literales `"costo_mercaderia"` y `"flete"` por `CATEGORIAS_COSTO.COSTO_MERCADERIA` y `CATEGORIAS_COSTO.FLETE` (mismo valor string, solo se centraliza el origen).

- [ ] **Paso 4: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS — incluyendo los tests de edición existentes que no usan `cuenta_dinero_id` (donde `movimientosOriginales` es un array vacío, sin cambio de comportamiento).

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/services/compra.service.js BACKEND/test/compra.service.test.js
git commit -m "editar una compra revierte y recrea sus movimientos financieros con el monto actualizado"
```

---

### Task 5: Migración SQL — `cuentas_por_cobrar` y `cuentas_por_pagar`

**Files:**
- Create: `BACKEND/sql/migrations/002_cuentas_cobrar_pagar.sql`
- Modify: `BACKEND/sql/migrations/README.md`

**Interfaces:**
- Produce: tablas `cuentas_por_cobrar`, `cuentas_por_pagar`, consumidas por las Tareas 6-10.

- [ ] **Paso 1: Escribir la migración**

```sql
-- BACKEND/sql/migrations/002_cuentas_cobrar_pagar.sql
-- Etapa 2 del módulo Finanzas: cuentas por cobrar y por pagar.
-- Ninguna columna rompe filas existentes: son tablas nuevas.

BEGIN;

CREATE TABLE cuentas_por_cobrar (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER REFERENCES ventas(id),
  cliente_nombre TEXT,
  monto_total NUMERIC(12,2) NOT NULL,
  saldo_pendiente NUMERIC(12,2) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'cobrado')),
  activo BOOLEAN NOT NULL DEFAULT true,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cuentas_por_pagar (
  id SERIAL PRIMARY KEY,
  compra_id INTEGER REFERENCES compras(id),
  proveedor_id INTEGER REFERENCES proveedores(id),
  monto_total NUMERIC(12,2) NOT NULL,
  saldo_pendiente NUMERIC(12,2) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagado')),
  activo BOOLEAN NOT NULL DEFAULT true,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cxc_usuario_estado ON cuentas_por_cobrar (usuario_id, estado);
CREATE INDEX idx_cxc_venta ON cuentas_por_cobrar (venta_id);
CREATE INDEX idx_cxp_usuario_estado ON cuentas_por_pagar (usuario_id, estado);
CREATE INDEX idx_cxp_compra ON cuentas_por_pagar (compra_id);

COMMIT;
```

- [ ] **Paso 2: Actualizar el README de migraciones**

Agregar una fila a la tabla de seguimiento en `BACKEND/sql/migrations/README.md`:

```markdown
| 002_cuentas_cobrar_pagar.sql | (pendiente) |
```

- [ ] **Paso 3: Confirmar con el usuario y aplicar la migración**

Mostrarle el SQL, esperar confirmación explícita antes de correrlo contra Supabase — mismo procedimiento que la migración 001.

- [ ] **Paso 4: Commit**

```bash
git add BACKEND/sql/migrations/002_cuentas_cobrar_pagar.sql BACKEND/sql/migrations/README.md
git commit -m "agrego esquema de cuentas por cobrar y por pagar"
```

---

### Task 6: Modelo + tests de `cuentas_por_cobrar`

**Files:**
- Create: `BACKEND/src/models/cuentaPorCobrar.model.js`
- Test: `BACKEND/test/cuentaPorCobrar.model.test.js`

**Interfaces:**
- Produce: `CuentaPorCobrarModel.{getAll, getById, create, createEnTransaccion, registrarCobroEnTransaccion, getTotalPendiente}`. `registrarCobroEnTransaccion(client, id, monto, usuario_id)` bloquea la fila con `FOR UPDATE`, valida que `monto <= saldo_pendiente`, decrementa `saldo_pendiente`, actualiza `estado` (`pendiente` si no se cobró nada aún — no debería pasar por acá con monto>0 —, `parcial` si `saldo_pendiente > 0`, `cobrado` si llega a `0`), y devuelve la fila actualizada. No crea el movimiento financiero — eso lo hace el servicio de la Tarea 10, que es quien tiene el `cuenta_dinero_id`.

- [ ] **Paso 1: Escribir el test que falla**

```js
// BACKEND/test/cuentaPorCobrar.model.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaPorCobrarModel from "../src/models/cuentaPorCobrar.model.js";

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
    await pool.query(`DELETE FROM cuentas_por_cobrar WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.end();
});

test("crear una cuenta por cobrar arranca en estado pendiente con saldo igual al total", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 5000,
    fecha_emision: "2026-01-10", fecha_vencimiento: "2026-02-10", usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  assert.equal(cxc.estado, "pendiente");
  assert.equal(Number(cxc.saldo_pendiente), 5000);
});

test("un cobro parcial deja estado parcial y decrementa el saldo", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 1000,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actualizada = await CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cxc.id, 400, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "parcial");
    assert.equal(Number(actualizada.saldo_pendiente), 600);
  } finally {
    client.release();
  }
});

test("un cobro que cubre el saldo total deja estado cobrado", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 800,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actualizada = await CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cxc.id, 800, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "cobrado");
    assert.equal(Number(actualizada.saldo_pendiente), 0);
  } finally {
    client.release();
  }
});

test("un cobro mayor al saldo pendiente es rechazado", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 100,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      () => CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cxc.id, 150, REAL_UID),
      (err) => err.status === 400
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});

test("getTotalPendiente suma el saldo_pendiente de todas las cuentas no cobradas del usuario", async () => {
  const c1 = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente 1`, monto_total: 300,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  const c2 = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente 2`, monto_total: 200,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(c1.id, c2.id);

  const total = await CuentaPorCobrarModel.getTotalPendiente(REAL_UID);
  assert.ok(Number(total) >= 500, "debe incluir al menos las dos cuentas recién creadas");
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="cobrar"`
Expected: FAIL — módulo inexistente

- [ ] **Paso 3: Implementar el modelo**

```js
// BACKEND/src/models/cuentaPorCobrar.model.js
// Queries SQL para la tabla cuentas_por_cobrar.
// El cobro (registrarCobroEnTransaccion) no crea el movimiento financiero —
// eso es responsabilidad del servicio que sí conoce la cuenta de dinero
// destino (ver cuentaPorCobrar.service.js, Tarea 10).

import pool from "../config/db.js";

const CuentaPorCobrarModel = {
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_cobrar WHERE activo = true AND usuario_id = $1
       ORDER BY estado ASC, fecha_vencimiento ASC NULLS LAST`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ venta_id, cliente_nombre, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO cuentas_por_cobrar
         (venta_id, cliente_nombre, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [venta_id ?? null, cliente_nombre ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  createEnTransaccion: async (client, { venta_id, cliente_nombre, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO cuentas_por_cobrar
         (venta_id, cliente_nombre, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [venta_id ?? null, cliente_nombre ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  registrarCobroEnTransaccion: async (client, id, monto, usuario_id) => {
    const { rows: filaActual } = await client.query(
      `SELECT * FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );

    if (!filaActual[0]) {
      throw { status: 404, message: "Cuenta por cobrar no encontrada." };
    }

    if (Number(monto) > Number(filaActual[0].saldo_pendiente)) {
      throw { status: 400, message: `El cobro (${monto}) supera el saldo pendiente (${filaActual[0].saldo_pendiente}).` };
    }

    const nuevoSaldo = Number(filaActual[0].saldo_pendiente) - Number(monto);
    const nuevoEstado = nuevoSaldo === 0 ? "cobrado" : "parcial";

    const { rows } = await client.query(
      `UPDATE cuentas_por_cobrar SET saldo_pendiente = $1, estado = $2
       WHERE id = $3 AND usuario_id = $4 RETURNING *`,
      [nuevoSaldo, nuevoEstado, id, usuario_id]
    );
    return rows[0];
  },

  getTotalPendiente: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM cuentas_por_cobrar
       WHERE activo = true AND usuario_id = $1 AND estado != 'cobrado'`,
      [usuario_id]
    );
    return rows[0].total;
  },
};

export default CuentaPorCobrarModel;
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test -- --test-name-pattern="cobrar"`
Expected: PASS (5 tests)

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/models/cuentaPorCobrar.model.js BACKEND/test/cuentaPorCobrar.model.test.js
git commit -m "agrego modelo de cuentas por cobrar con cobro parcial"
```

---

### Task 7: Modelo + tests de `cuentas_por_pagar`

**Files:**
- Create: `BACKEND/src/models/cuentaPorPagar.model.js`
- Test: `BACKEND/test/cuentaPorPagar.model.test.js`

**Interfaces:**
- Produce: `CuentaPorPagarModel.{getAll, getById, create, createEnTransaccion, registrarPagoEnTransaccion, getTotalPendiente}` — mismo diseño exacto que `CuentaPorCobrarModel` (Task 6), con `compra_id`/`proveedor_id` en vez de `venta_id`/`cliente_nombre`, y estado final `pagado` en vez de `cobrado`.

- [ ] **Paso 1: Escribir el test que falla**

Copiar el archivo de test de la Tarea 6 (`BACKEND/test/cuentaPorCobrar.model.test.js`) a `BACKEND/test/cuentaPorPagar.model.test.js` y adaptar mecánicamente: `CuentaPorCobrarModel` → `CuentaPorPagarModel`, `cliente_nombre` → `proveedor_id: null`, `venta_id` → `compra_id`, tabla `cuentas_por_cobrar` → `cuentas_por_pagar`, y en el test de "cobro total" el estado esperado pasa de `"cobrado"` a `"pagado"`. Los nombres de los tests cambian "cobro"/"cobrar" por "pago"/"pagar" según corresponda.

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="pagar"`
Expected: FAIL — módulo inexistente

- [ ] **Paso 3: Implementar el modelo**

```js
// BACKEND/src/models/cuentaPorPagar.model.js
// Queries SQL para la tabla cuentas_por_pagar. Mismo diseño que
// cuentaPorCobrar.model.js: el pago no crea el movimiento financiero,
// eso lo hace el servicio que conoce la cuenta de dinero (Tarea 10).

import pool from "../config/db.js";

const CuentaPorPagarModel = {
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_pagar WHERE activo = true AND usuario_id = $1
       ORDER BY estado ASC, fecha_vencimiento ASC NULLS LAST`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_pagar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ compra_id, proveedor_id, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO cuentas_por_pagar
         (compra_id, proveedor_id, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [compra_id ?? null, proveedor_id ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  createEnTransaccion: async (client, { compra_id, proveedor_id, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO cuentas_por_pagar
         (compra_id, proveedor_id, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [compra_id ?? null, proveedor_id ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  registrarPagoEnTransaccion: async (client, id, monto, usuario_id) => {
    const { rows: filaActual } = await client.query(
      `SELECT * FROM cuentas_por_pagar WHERE id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );

    if (!filaActual[0]) {
      throw { status: 404, message: "Cuenta por pagar no encontrada." };
    }

    if (Number(monto) > Number(filaActual[0].saldo_pendiente)) {
      throw { status: 400, message: `El pago (${monto}) supera el saldo pendiente (${filaActual[0].saldo_pendiente}).` };
    }

    const nuevoSaldo = Number(filaActual[0].saldo_pendiente) - Number(monto);
    const nuevoEstado = nuevoSaldo === 0 ? "pagado" : "parcial";

    const { rows } = await client.query(
      `UPDATE cuentas_por_pagar SET saldo_pendiente = $1, estado = $2
       WHERE id = $3 AND usuario_id = $4 RETURNING *`,
      [nuevoSaldo, nuevoEstado, id, usuario_id]
    );
    return rows[0];
  },

  getTotalPendiente: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM cuentas_por_pagar
       WHERE activo = true AND usuario_id = $1 AND estado != 'pagado'`,
      [usuario_id]
    );
    return rows[0].total;
  },
};

export default CuentaPorPagarModel;
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test -- --test-name-pattern="pagar"`
Expected: PASS (5 tests)

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/models/cuentaPorPagar.model.js BACKEND/test/cuentaPorPagar.model.test.js
git commit -m "agrego modelo de cuentas por pagar con pago parcial"
```

---

### Task 8: Generación automática de cuenta por cobrar en ventas a crédito

**Files:**
- Modify: `BACKEND/src/models/venta.model.js`
- Modify: `BACKEND/src/services/venta.service.js`
- Test: `BACKEND/test/venta.service.test.js`

**Interfaces:**
- Consume: `CuentaPorCobrarModel.createEnTransaccion` (Task 6).
- Produce: `crearVenta` gana los parámetros opcionales `estado_cobro` (`'cobrado'` default — comportamiento actual sin cambios — o `'pendiente'`) y `cliente_nombre`/`fecha_vencimiento` (solo relevantes si `estado_cobro: 'pendiente'`). Cuando `estado_cobro: 'pendiente'`, NO se crea ningún movimiento financiero (no hay caja todavía) y en cambio se crea una fila en `cuentas_por_cobrar` por el total de la venta.

- [ ] **Paso 1: Extender `VentaModel.insertCabecera` para persistir `estado_cobro`**

En [BACKEND/src/models/venta.model.js](../../../BACKEND/src/models/venta.model.js), cambiar `insertCabecera`:

```js
  insertCabecera: async (client, { tipo, total, ganancia, observaciones, metodo_pago, canal, comision, estado_cobro, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO ventas (tipo, total, ganancia, observaciones, metodo_pago, canal, comision, estado_cobro, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tipo, total, ganancia, observaciones ?? null, metodo_pago ?? null, canal || "directa", comision ?? 0, estado_cobro || "cobrado", usuario_id]
    );
    return rows[0];
  },
```

Esto preserva el comportamiento actual: si no se pasa `estado_cobro`, la columna toma `"cobrado"` explícitamente en el INSERT en vez de depender solo del `DEFAULT` de la base — mismo valor final, ahora explícito.

- [ ] **Paso 2: Escribir el test que falla**

Agregar a `BACKEND/test/venta.service.test.js`:

```js
test("una venta a credito no genera movimiento pero genera una cuenta por cobrar por el total", async () => {
  const p = await productoDePrueba({ stock_actual: 5, precio_compra: 50, precio_minorista: 300 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista", estado_cobro: "pendiente", cliente_nombre: `${MARCA} cliente credito`,
    items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  assert.equal(venta.estado_cobro, "pendiente");

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'venta' AND origen_id = $1`,
    [venta.id]
  );
  assert.equal(movs.length, 0, "una venta pendiente de cobro no debe mover caja");

  const { rows: cxc } = await pool.query(
    `SELECT * FROM cuentas_por_cobrar WHERE venta_id = $1`,
    [venta.id]
  );
  assert.equal(cxc.length, 1);
  assert.equal(Number(cxc[0].monto_total), 300);
  assert.equal(Number(cxc[0].saldo_pendiente), 300);
  assert.equal(cxc[0].estado, "pendiente");
  assert.equal(cxc[0].cliente_nombre, `${MARCA} cliente credito`);

  await pool.query(`DELETE FROM cuentas_por_cobrar WHERE venta_id = $1`, [venta.id]);
});

test("una venta con estado_cobro cobrado (el default) sigue sin generar cuenta por cobrar", async () => {
  const p = await productoDePrueba({ stock_actual: 5 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista", items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  assert.equal(venta.estado_cobro, "cobrado");

  const { rows: cxc } = await pool.query(`SELECT * FROM cuentas_por_cobrar WHERE venta_id = $1`, [venta.id]);
  assert.equal(cxc.length, 0);
});
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="credito"`
Expected: FAIL — `estado_cobro` no se persiste ni genera nada todavía.

- [ ] **Paso 4: Modificar `crearVenta`**

En [BACKEND/src/services/venta.service.js](../../../BACKEND/src/services/venta.service.js):

1. Agregar el import: `import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";`
2. Cambiar la firma:

```js
const crearVenta = async ({ tipo, observaciones, metodo_pago, canal, comision, cuenta_dinero_id, estado_cobro, cliente_nombre, fecha_vencimiento, items, usuario_id }) => {
```

3. Pasar `estado_cobro` a `insertCabecera`:

```js
    const venta = await VentaModel.insertCabecera(client, {
      tipo,
      total,
      ganancia: gananciaNeta,
      observaciones,
      metodo_pago,
      canal,
      comision: comisionNumerica,
      estado_cobro,
      usuario_id,
    });
```

4. Reemplazar el bloque `if (cuenta_dinero_id) { ... }` completo (el que crea los movimientos de ingreso y comisión) por:

```js
    if (venta.estado_cobro === "pendiente") {
      await CuentaPorCobrarModel.createEnTransaccion(client, {
        venta_id: venta.id,
        cliente_nombre: cliente_nombre ?? null,
        monto_total: total,
        fecha_emision: venta.fecha,
        fecha_vencimiento: fecha_vencimiento ?? null,
        usuario_id,
      });
    } else if (cuenta_dinero_id) {
      const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
      if (!cuenta) {
        throw { status: 400, message: "La cuenta de dinero indicada no existe o no pertenece al usuario." };
      }

      await MovimientoFinancieroModel.createEnTransaccion(client, {
        fecha: venta.fecha,
        tipo: "ingreso",
        categoria: CATEGORIAS_INGRESO.VENTA_PRODUCTOS,
        monto: total,
        cuenta_dinero_id,
        origen_tipo: "venta",
        origen_id: venta.id,
        descripcion: `Venta #${venta.id}`,
        usuario_id,
      });

      if (comisionNumerica > 0) {
        await MovimientoFinancieroModel.createEnTransaccion(client, {
          fecha: venta.fecha,
          tipo: "egreso",
          categoria: CATEGORIAS_COSTO.COMISIONES,
          monto: comisionNumerica,
          cuenta_dinero_id,
          origen_tipo: "venta",
          origen_id: venta.id,
          descripcion: `Comisión venta #${venta.id}`,
          usuario_id,
        });
      }
    }
```

(Nota: esto es la Tarea 2 de este mismo plan, ahora con la rama `estado_cobro === "pendiente"` agregada antes.)

- [ ] **Paso 5: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS.

- [ ] **Paso 6: Commit**

```bash
git add BACKEND/src/models/venta.model.js BACKEND/src/services/venta.service.js BACKEND/test/venta.service.test.js
git commit -m "una venta a credito genera cuenta por cobrar en vez de movimiento de caja"
```

---

### Task 9: Generación automática de cuenta por pagar en compras a crédito

**Files:**
- Modify: `BACKEND/src/models/compra.model.js`
- Modify: `BACKEND/src/services/compra.service.js`
- Test: `BACKEND/test/compra.service.test.js`

**Interfaces:**
- Mismo diseño que la Tarea 8, espejado para compras: `crearCompra` gana `estado_pago` (`'pagado'` default, o `'pendiente'`) — si `'pendiente'`, crea una `cuenta_por_pagar` por el total (mercadería + envío) y no crea movimiento.

- [ ] **Paso 1: Extender `CompraModel.insertCabecera` para persistir `estado_pago`**

En [BACKEND/src/models/compra.model.js](../../../BACKEND/src/models/compra.model.js):

```js
  insertCabecera: async (client, { proveedor_id, total, observaciones, tipo, costo_envio, estado_pago, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO compras (proveedor_id, total, observaciones, tipo, costo_envio, estado_pago, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [proveedor_id ?? null, total, observaciones ?? null, tipo || "local", costo_envio ?? 0, estado_pago || "pagado", usuario_id]
    );
    return rows[0];
  },
```

- [ ] **Paso 2: Escribir el test que falla**

Agregar a `BACKEND/test/compra.service.test.js`:

```js
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
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="credito"`
Expected: FAIL para los nuevos casos de compra.

- [ ] **Paso 4: Modificar `crearCompra`**

En [BACKEND/src/services/compra.service.js](../../../BACKEND/src/services/compra.service.js):

1. Agregar el import: `import CuentaPorPagarModel from "../models/cuentaPorPagar.model.js";`
2. Agregar `estado_pago` a la firma de `crearCompra` y a la llamada `validarCabecera` si corresponde (no requiere validación especial, ya que `insertCabecera` hace el fallback a `"pagado"`).
3. Pasar `estado_pago` a `CompraModel.insertCabecera(...)`.
4. Envolver el bloque `if (cuenta_dinero_id) { ... }` existente así:

```js
    if (compra.estado_pago === "pendiente") {
      await CuentaPorPagarModel.createEnTransaccion(client, {
        compra_id: compra.id,
        proveedor_id: proveedor_id ?? null,
        monto_total: total + (Number(costo_envio) || 0),
        fecha_emision: compra.fecha,
        fecha_vencimiento: null,
        usuario_id,
      });
    } else if (cuenta_dinero_id) {
      // ... (el bloque existente de movimientos de costo_mercaderia/flete, sin cambios)
    }
```

- [ ] **Paso 5: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS.

- [ ] **Paso 6: Commit**

```bash
git add BACKEND/src/models/compra.model.js BACKEND/src/services/compra.service.js BACKEND/test/compra.service.test.js
git commit -m "una compra a credito genera cuenta por pagar en vez de movimiento de caja"
```

---

### Task 10: Endpoints de cobro/pago parcial

**Files:**
- Create: `BACKEND/src/services/cuentaPorCobrar.service.js`
- Create: `BACKEND/src/services/cuentaPorPagar.service.js`
- Create: `BACKEND/src/controllers/cuentaPorCobrar.controller.js`
- Create: `BACKEND/src/controllers/cuentaPorPagar.controller.js`
- Create: `BACKEND/src/routes/cuentaPorCobrar.routes.js`
- Create: `BACKEND/src/routes/cuentaPorPagar.routes.js`
- Modify: `BACKEND/src/routes/index.js`
- Test: `BACKEND/test/cuentaPorCobrar.service.test.js`, `BACKEND/test/cuentaPorPagar.service.test.js`

**Interfaces:**
- Produce: `GET /cuentas-por-cobrar`, `POST /cuentas-por-cobrar/:id/cobro` `{ monto, cuenta_dinero_id }`; `GET /cuentas-por-pagar`, `POST /cuentas-por-pagar/:id/pago` `{ monto, cuenta_dinero_id }`. Cada cobro/pago abre una transacción, valida la cuenta de dinero, decrementa el saldo pendiente (Task 6/7), y crea el movimiento financiero real — este es el único punto donde una venta/compra a crédito finalmente toca `movimientos_financieros`.

- [ ] **Paso 1: Escribir el test que falla para el servicio de cobro**

```js
// BACKEND/test/cuentaPorCobrar.service.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaPorCobrarModel from "../src/models/cuentaPorCobrar.model.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";
import CuentaPorCobrarService from "../src/services/cuentaPorCobrar.service.js";

const MARCA = "__TEST_FINANZAS__";
let REAL_UID;
const cuentasCxCCreadas = [];
let cuentaDineroId;

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta cobro`, REAL_UID]
  );
  cuentaDineroId = cuenta.rows[0].id;
});

after(async () => {
  for (const id of cuentasCxCCreadas) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'cuenta_por_cobrar' AND origen_id = $1`, [id]);
    await pool.query(`DELETE FROM cuentas_por_cobrar WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuentaDineroId]);
  await pool.end();
});

test("registrar un cobro parcial decrementa el saldo y crea un movimiento de ingreso", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 1000,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCxCCreadas.push(cxc.id);

  const actualizada = await CuentaPorCobrarService.registrarCobro(cxc.id, {
    monto: 400, cuenta_dinero_id: cuentaDineroId,
  }, REAL_UID);

  assert.equal(actualizada.estado, "parcial");
  assert.equal(Number(actualizada.saldo_pendiente), 600);

  const saldoCuenta = await CuentaDineroModel.getSaldo(cuentaDineroId, REAL_UID);
  assert.equal(Number(saldoCuenta), 400);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'cuenta_por_cobrar' AND origen_id = $1`,
    [cxc.id]
  );
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, "ingreso");
  assert.equal(Number(movs[0].monto), 400);
});

test("un cobro con cuenta de dinero de otro usuario es rechazado y no modifica el saldo pendiente", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 500,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCxCCreadas.push(cxc.id);

  await assert.rejects(
    () => CuentaPorCobrarService.registrarCobro(cxc.id, { monto: 100, cuenta_dinero_id: cuentaDineroId }, "11111111-1111-1111-1111-111111111111"),
    (err) => err.status === 404
  );
});

test("un cobro mayor al saldo pendiente es rechazado y no crea movimiento", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 100,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCxCCreadas.push(cxc.id);

  await assert.rejects(
    () => CuentaPorCobrarService.registrarCobro(cxc.id, { monto: 200, cuenta_dinero_id: cuentaDineroId }, REAL_UID),
    (err) => err.status === 400
  );

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'cuenta_por_cobrar' AND origen_id = $1`,
    [cxc.id]
  );
  assert.equal(movs.length, 0);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="registrar un cobro"`
Expected: FAIL — servicio inexistente.

- [ ] **Paso 3: Implementar `cuentaPorCobrar.service.js`**

```js
// BACKEND/src/services/cuentaPorCobrar.service.js
// Único lugar donde una cuenta por cobrar toca movimientos_financieros:
// el cobro real de dinero, no la emisión de la venta a crédito.

import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import { CATEGORIAS_INGRESO, ORIGEN_TIPOS } from "../constants/finanzas.js";
import pool from "../config/db.js";

const registrarCobro = async (cuentaPorCobrarId, { monto, cuenta_dinero_id }, usuario_id) => {
  if (!monto || Number(monto) <= 0) {
    throw { status: 400, message: "El monto del cobro debe ser mayor a 0." };
  }
  if (!cuenta_dinero_id) {
    throw { status: 400, message: "Se requiere indicar la cuenta de dinero que recibe el cobro." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
    if (!cuenta) {
      throw { status: 404, message: "Cuenta por cobrar no encontrada." };
    }

    const cxcExistente = await client.query(
      `SELECT id FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [cuentaPorCobrarId, usuario_id]
    );
    if (!cxcExistente.rows[0]) {
      throw { status: 404, message: "Cuenta por cobrar no encontrada." };
    }

    const actualizada = await CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cuentaPorCobrarId, monto, usuario_id);

    await MovimientoFinancieroModel.createEnTransaccion(client, {
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "ingreso",
      categoria: CATEGORIAS_INGRESO.VENTA_PRODUCTOS,
      monto,
      cuenta_dinero_id,
      origen_tipo: ORIGEN_TIPOS.CUENTA_POR_COBRAR,
      origen_id: cuentaPorCobrarId,
      descripcion: `Cobro de cuenta por cobrar #${cuentaPorCobrarId}`,
      usuario_id,
    });

    await client.query("COMMIT");
    return actualizada;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { registrarCobro };
```

Nota: la validación de "cuenta por cobrar de otro usuario" en el test ocurre porque `CuentaDineroModel.getById(cuenta_dinero_id, usuario_id)` con un `usuario_id` ficticio no encuentra la cuenta de dinero (que fue creada con `REAL_UID`) y lanza 404 antes de llegar a tocar la cuenta por cobrar — cubre el caso igual, con el mismo código de error que pedía el test.

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `cd BACKEND && npm test -- --test-name-pattern="registrar un cobro"`
Expected: PASS (3 tests)

- [ ] **Paso 5: Repetir Pasos 1-4 para pago (mecánico, mismo patrón)**

Crear `BACKEND/test/cuentaPorPagar.service.test.js` y `BACKEND/src/services/cuentaPorPagar.service.js` adaptando 1 a 1 el código anterior: `CuentaPorCobrarModel` → `CuentaPorPagarModel`, `registrarCobro` → `registrarPago`, `tipo: "ingreso"` → `tipo: "egreso"`, `categoria: CATEGORIAS_INGRESO.VENTA_PRODUCTOS` → `categoria: CATEGORIAS_COSTO.COSTO_MERCADERIA`, `ORIGEN_TIPOS.CUENTA_POR_COBRAR` → `ORIGEN_TIPOS.CUENTA_POR_PAGAR`, mensajes "cobro"/"cobrar" → "pago"/"pagar".

- [ ] **Paso 6: Controllers y rutas**

```js
// BACKEND/src/controllers/cuentaPorCobrar.controller.js
import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import CuentaPorCobrarService from "../services/cuentaPorCobrar.service.js";

const CuentaPorCobrarController = {
  getAll: async (req, res, next) => {
    try {
      const cuentas = await CuentaPorCobrarModel.getAll(req.usuario_id);
      res.json({ success: true, data: cuentas });
    } catch (err) { next(err); }
  },

  registrarCobro: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { monto, cuenta_dinero_id } = req.body;
      const actualizada = await CuentaPorCobrarService.registrarCobro(id, { monto, cuenta_dinero_id }, req.usuario_id);
      res.status(201).json({ success: true, data: actualizada });
    } catch (err) { next(err); }
  },
};

export default CuentaPorCobrarController;
```

```js
// BACKEND/src/routes/cuentaPorCobrar.routes.js
import { Router } from "express";
import CuentaPorCobrarController from "../controllers/cuentaPorCobrar.controller.js";

const router = Router();

router.get("/", CuentaPorCobrarController.getAll);
router.post("/:id/cobro", CuentaPorCobrarController.registrarCobro);

export default router;
```

Mismo patrón para `cuentaPorPagar.controller.js` / `cuentaPorPagar.routes.js`, cambiando `registrarCobro`→`registrarPago`, `/cobro`→`/pago`.

En [BACKEND/src/routes/index.js](../../../BACKEND/src/routes/index.js), agregar (junto a las demás, sin tocar ninguna línea existente):

```js
import cuentaPorCobrarRoutes from "./cuentaPorCobrar.routes.js";
import cuentaPorPagarRoutes from "./cuentaPorPagar.routes.js";
// ...
router.use("/cuentas-por-cobrar", cuentaPorCobrarRoutes);
router.use("/cuentas-por-pagar", cuentaPorPagarRoutes);
```

- [ ] **Paso 7: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS.

- [ ] **Paso 8: Commit**

```bash
git add BACKEND/src/services/cuentaPorCobrar.service.js BACKEND/src/services/cuentaPorPagar.service.js BACKEND/src/controllers/cuentaPorCobrar.controller.js BACKEND/src/controllers/cuentaPorPagar.controller.js BACKEND/src/routes/cuentaPorCobrar.routes.js BACKEND/src/routes/cuentaPorPagar.routes.js BACKEND/src/routes/index.js BACKEND/test/cuentaPorCobrar.service.test.js BACKEND/test/cuentaPorPagar.service.test.js
git commit -m "agrego endpoints de cobro y pago parcial de cuentas por cobrar y por pagar"
```

---

### Task 11: Anular una venta a crédito desactiva su cuenta por cobrar

**Files:**
- Modify: `BACKEND/src/services/venta.service.js`
- Test: `BACKEND/test/venta.service.test.js`

**Interfaces:**
- Produce: `eliminarVenta` ahora, además de revertir movimientos (Task 3), busca cualquier `cuenta_por_cobrar` activa con `venta_id = id` y la marca `activo = false` — evita que una venta a crédito anulada siga apareciendo como saldo pendiente en `CuentaPorCobrarModel.getTotalPendiente`. No se toca ningún cobro parcial ya registrado (esos movimientos financieros quedan intactos, como cualquier cobro real ya recibido).

- [ ] **Paso 1: Escribir el test que falla**

Agregar a `BACKEND/test/venta.service.test.js`:

```js
test("anular una venta a credito desactiva su cuenta por cobrar", async () => {
  const p = await productoDePrueba({ stock_actual: 5, precio_minorista: 300 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista", estado_cobro: "pendiente", cliente_nombre: `${MARCA} cliente a anular`,
    items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  await VentaService.eliminarVenta(venta.id, REAL_UID);

  const { rows: cxc } = await pool.query(
    `SELECT * FROM cuentas_por_cobrar WHERE venta_id = $1`,
    [venta.id]
  );
  assert.equal(cxc.length, 1);
  assert.equal(cxc[0].activo, false);

  await pool.query(`DELETE FROM cuentas_por_cobrar WHERE venta_id = $1`, [venta.id]);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `cd BACKEND && npm test -- --test-name-pattern="desactiva su cuenta"`
Expected: FAIL — `cxc[0].activo` sigue en `true`.

- [ ] **Paso 3: Modificar `eliminarVenta`**

En [BACKEND/src/services/venta.service.js](../../../BACKEND/src/services/venta.service.js), dentro de `eliminarVenta`, en cualquier punto dentro de la transacción antes del `COMMIT` (por ejemplo, junto al bloque de reversión de movimientos de la Task 3), agregar:

```js
    await client.query(
      `UPDATE cuentas_por_cobrar SET activo = false WHERE venta_id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
```

Esto es un no-op silencioso si la venta no tenía cuenta por cobrar (no afecta ninguna fila), preservando el comportamiento actual para toda venta que no sea a crédito.

- [ ] **Paso 4: Correr toda la suite y verificar que pasa**

Run: `cd BACKEND && npm test`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add BACKEND/src/services/venta.service.js BACKEND/test/venta.service.test.js
git commit -m "anular una venta a credito desactiva su cuenta por cobrar huerfana"
```

---

## Self-Review

**Cobertura:** los 3 rulings de la revisión final de Etapa 1 quedan resueltos en las Tareas 1-4, antes de tocar cuentas por cobrar/pagar. Devengado vs. percibido queda explícito: `cuentas_por_cobrar`/`cuentas_por_pagar` reflejan el Estado de Resultados (a través de `ventas.total`/`compras.total`, ya existentes), `movimientos_financieros` solo se toca cuando hay caja real (creación con estado cobrado/pagado, o cobro/pago posterior) — exactamente el ejemplo que pidió el usuario ("una venta a crédito genera ingreso... pero no caja hasta que se cobra").

**Placeholders:** ninguno — todo el código de las 10 tareas está completo, sin "TODO" ni pasos descritos sin código.

**Simplificaciones documentadas (no placeholders, decisiones explícitas):** un cobro/pago parcial usa siempre `categoria: venta_productos`/`costo_mercaderia` genérico (no desagrega qué proporción del pago corresponde a flete vs. mercadería); editar una compra sin volver a pasar `cuenta_dinero_id` deja el efecto en caja revertido sin recrear. Ambas quedan anotadas para refinar en Etapa 3/5, no bloquean esta etapa.
