# 75Store - Frontend

Panel de gestión para 75Store. Desarrollado con React + Vite + Tailwind CSS.

## Requisitos
- Node.js 18+
- Backend 75StoreeGestion corriendo

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y ajusta la URL del backend:

```
VITE_API_URL=http://localhost:3000/api
```

## Desarrollo

```bash
npm run dev
```

## Producción

```bash
npm run build
```

## Estructura

```
src/
  pages/         → Pantallas (Dashboard, Productos, Ventas, Compras, Gastos, Categorías, Proveedores)
  components/    → Componentes reutilizables (Layout, Sidebar, formularios)
  components/ui/ → Componentes base (Boton, Input, Modal, Tabla, Badge...)
  services/      → api.js — todas las llamadas al backend
  hooks/         → useDatos, useAccion
  context/       → ToastContext (notificaciones)
  utils.js       → formatearPrecio, formatearFecha, cn()
```
