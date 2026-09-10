# Migraciones SQL

Este proyecto no usa un runner de migraciones (el esquema vive en Supabase).
Cada archivo `NNN_descripcion.sql` se aplica UNA VEZ, a mano, en orden numérico:

- Opción A: pegar el contenido en el SQL Editor de Supabase y ejecutar.
- Opción B: `psql "$DATABASE_URL" -f sql/migrations/NNN_descripcion.sql`

Después de aplicar un archivo, anotar la fecha acá abajo:

| Archivo | Aplicado el |
| --- | --- |
| 001_finanzas_base.sql | 2026-09-10 |
| 002_cuentas_cobrar_pagar.sql | (pendiente) |
