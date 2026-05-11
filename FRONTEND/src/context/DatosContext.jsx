import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ventasApi, comprasApi, productosApi, gastosApi, categoriasApi, proveedoresApi } from '../services/api.js';

const DatosContext = createContext(null);

export function DatosProvider({ children }) {
  const [datos, setDatos] = useState({
    ventas: [], compras: [], productos: [], gastos: [],
    categorias: [], proveedores: [], bajoStock: [],
  });
  const [cargando, setCargando] = useState(true);

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
    ]);

    const [ventas, compras, productos, gastos, categorias, proveedores, bajoStock] = resultados;

    setDatos({
      ventas:      ventas.status      === 'fulfilled' ? ventas.value      : [],
      compras:     compras.status     === 'fulfilled' ? compras.value     : [],
      productos:   productos.status   === 'fulfilled' ? productos.value   : [],
      gastos:      gastos.status      === 'fulfilled' ? gastos.value      : [],
      categorias:  categorias.status  === 'fulfilled' ? categorias.value  : [],
      proveedores: proveedores.status === 'fulfilled' ? proveedores.value : [],
      bajoStock:   bajoStock.status   === 'fulfilled' ? bajoStock.value   : [],
    });
    setCargando(false);
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  // Recargar solo una sección específica
  const recargar = useCallback(async (seccion) => {
    const apis = {
      ventas:      ventasApi.listar,
      compras:     comprasApi.listar,
      productos:   productosApi.listar,
      gastos:      gastosApi.listar,
      categorias:  categoriasApi.listar,
      proveedores: proveedoresApi.listar,
      bajoStock:   productosApi.bajoStock,
    };
    try {
      const resultado = await apis[seccion]();
      setDatos(prev => ({ ...prev, [seccion]: Array.isArray(resultado) ? resultado : [] }));
    } catch {
      // silencioso, mantiene datos anteriores
    }
  }, []);

  return (
    <DatosContext.Provider value={{ ...datos, cargando, recargar, recargarTodo: cargarTodo }}>
      {children}
    </DatosContext.Provider>
  );
}

export function useDatosGlobal() {
  return useContext(DatosContext);
}