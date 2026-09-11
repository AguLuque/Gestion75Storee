-- BACKEND/sql/migrations/003_compras_activo.sql
-- Permite anular compras (soft delete), igual que ventas.
-- No rompe filas existentes: la columna nace en true.

BEGIN;

ALTER TABLE compras ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;

COMMIT;
