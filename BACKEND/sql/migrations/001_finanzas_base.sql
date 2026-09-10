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
