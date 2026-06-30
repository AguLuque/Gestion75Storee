import { supabase } from '../lib/supabase';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function peticion(ruta, opciones = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers
    },
    cache: 'no-store',
    ...opciones,
  });

  const json = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(json.message || json.error || `Error ${respuesta.status}`);
  }

  return json.data !== undefined ? json.data : json;
}

// Productos
export const productosApi = {
  listar: () => peticion('/productos'),
  obtener: (id) => peticion(`/productos/${id}`),
  crear: (datos) => peticion('/productos', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => peticion(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar: (id) => peticion(`/productos/${id}`, { method: 'DELETE' }),
  sinStock: () => peticion('/productos/sin-stock'),
  bajoStock: () => peticion('/productos/bajo-stock'),
  ajustarStock: (id, stock_actual) => peticion(`/productos/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock_actual }) }),
};

// Categorías
export const categoriasApi = {
  listar: () => peticion('/categorias'),
  crear: (datos) => peticion('/categorias', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => peticion(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar: (id) => peticion(`/categorias/${id}`, { method: 'DELETE' }),
};

// Proveedores
export const proveedoresApi = {
  listar: () => peticion('/proveedores'),
  obtener: (id) => peticion(`/proveedores/${id}`),
  crear: (datos) => peticion('/proveedores', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => peticion(`/proveedores/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar: (id) => peticion(`/proveedores/${id}`, { method: 'DELETE' }),
};

// Ventas
export const ventasApi = {
  listar: () => peticion('/ventas'),
  obtener: (id) => peticion(`/ventas/${id}`),
  crear: (datos) => peticion('/ventas', { method: 'POST', body: JSON.stringify(datos) }),
  porPeriodo: (desde, hasta) => peticion(`/ventas?desde=${desde}&hasta=${hasta}`),
  eliminar: (id) => peticion(`/ventas/${id}`, { method: 'DELETE' }),
};

// Compras
export const comprasApi = {
  listar: () => peticion('/compras'),
  obtener: (id) => peticion(`/compras/${id}`),
  crear: (datos) => peticion('/compras', {
    method: 'POST',
    body: JSON.stringify(datos)
  }),
  actualizar: (id, datos) => peticion(`/compras/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  }),
};

// Gastos
export const gastosApi = {
  listar: () => peticion('/gastos'),
  crear: (datos) => peticion('/gastos', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => peticion(`/gastos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar: (id) => peticion(`/gastos/${id}`, { method: 'DELETE' }),
};

// Variantes
export const variantesApi = {
  porProducto: (producto_id) => peticion(`/productos/${producto_id}/variantes`),
  crear: (datos) => peticion('/variantes', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => peticion(`/variantes/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar: (id) => peticion(`/variantes/${id}`, { method: 'DELETE' }),
  ajustarStock: (id, stock_actual) => peticion(`/variantes/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock_actual }) }),
};

// Deudores
export const deudoresApi = {
  listar: () => peticion('/deudores'),
  crear: (datos) => peticion('/deudores', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => peticion(`/deudores/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar: (id) => peticion(`/deudores/${id}`, { method: 'DELETE' }),
};
