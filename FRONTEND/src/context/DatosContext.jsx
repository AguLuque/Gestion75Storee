import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { ventasApi, comprasApi, productosApi, gastosApi, categoriasApi, proveedoresApi, deudoresApi } from '../services/api.js';

const DatosContext = createContext(null);

function aplicarFiltro(lista, periodo, campo = 'fecha', mesSeleccionado, añoSeleccionado) {
  if (periodo === 'todo') return lista;
  const ahora = new Date();
  return lista.filter(item => {
    const fecha = new Date(item[campo]);
    switch (periodo) {
      case 'dia': {
        const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        return fecha >= hoy;
      }
      case 'semana': {
        const inicio = new Date(ahora);
        inicio.setDate(ahora.getDate() - 7);
        return fecha >= inicio;
      }
      case 'mes':
        return fecha.getMonth() === mesSeleccionado &&
          fecha.getFullYear() === añoSeleccionado;
      case 'año':
        return fecha.getFullYear() === ahora.getFullYear();
      default:
        return true;
    }
  });
}

export function DatosProvider({ children }) {
  const [datos, setDatos] = useState({
    ventas: [], compras: [], productos: [], gastos: [],
    categorias: [], proveedores: [], bajoStock: [], deudores: [],
  });
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());
  const [añoSeleccionado, setAñoSeleccionado] = useState(new Date().getFullYear());
  const esMesFuturo =
    añoSeleccionado > new Date().getFullYear() ||
    (añoSeleccionado === new Date().getFullYear() && mesSeleccionado > new Date().getMonth());


  const cargarTodo = useCallback(async () => {
    setCargando(true);
    const resultados = await Promise.allSettled([
      ventasApi.listar(),
      comprasApi.listar(),
      productosApi.listar(),
      gastosApi.listar(),
      categoriasApi.listar(),
      proveedoresApi.listar(),
      productosApi.bajoStock(),
      deudoresApi.listar(),
    ]);

    const [ventas, compras, productos, gastos, categorias, proveedores, bajoStock, deudores] = resultados;

    setDatos({
      ventas: ventas.status === 'fulfilled' ? ventas.value : [],
      compras: compras.status === 'fulfilled' ? compras.value : [],
      productos: productos.status === 'fulfilled' ? productos.value : [],
      gastos: gastos.status === 'fulfilled' ? gastos.value : [],
      categorias: categorias.status === 'fulfilled' ? categorias.value : [],
      proveedores: proveedores.status === 'fulfilled' ? proveedores.value : [],
      bajoStock: bajoStock.status === 'fulfilled' ? bajoStock.value : [],
      deudores: deudores.status === 'fulfilled' ? deudores.value : [],
    });
    setCargando(false);
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  const recargar = useCallback(async (seccion) => {
    const apis = {
      ventas: ventasApi.listar,
      compras: comprasApi.listar,
      productos: productosApi.listar,
      gastos: gastosApi.listar,
      categorias: categoriasApi.listar,
      proveedores: proveedoresApi.listar,
      bajoStock: productosApi.bajoStock,
      deudores: deudoresApi.listar,
    };
    try {
      const resultado = await apis[seccion]();
      setDatos(prev => ({ ...prev, [seccion]: Array.isArray(resultado) ? resultado : [] }));
    } catch {
      // silencioso, mantiene datos anteriores
    }
  }, []);

  // Datos filtrados por período — se recalculan solos al cambiar el período
  const datosFiltrados = useMemo(() => ({
    ventas: aplicarFiltro(datos.ventas, periodo, 'fecha', mesSeleccionado, añoSeleccionado),
    compras: aplicarFiltro(datos.compras, periodo, 'fecha', mesSeleccionado, añoSeleccionado),
    gastos: aplicarFiltro(datos.gastos, periodo, 'fecha', mesSeleccionado, añoSeleccionado),
  }), [datos.ventas, datos.compras, datos.gastos, periodo, mesSeleccionado, añoSeleccionado]);

  return (
    <DatosContext.Provider value={{
      // Datos crudos (para páginas que no necesitan filtro)
      ...datos,
      // Datos filtrados (para dashboard y totales)
      ventasFiltradas: datosFiltrados.ventas,
      comprasFiltradas: datosFiltrados.compras,
      gastosFiltrados: datosFiltrados.gastos,
      // Control del período
      periodo,
      setPeriodo,
      mesSeleccionado,
      añoSeleccionado,
      esMesFuturo,
      setMesSeleccionado,
      setAñoSeleccionado,
      cargando,
      recargar,
      recargarTodo: cargarTodo,
    }}>
      {children}
    </DatosContext.Provider>
  );
}

export function useDatosGlobal() {
  return useContext(DatosContext);
}