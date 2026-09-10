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
