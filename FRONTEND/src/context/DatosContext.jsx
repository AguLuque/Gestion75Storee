import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ventasApi, comprasApi, productosApi, gastosApi, categoriasApi, proveedoresApi, cuentasDineroApi, cuentasPorCobrarApi, cuentasPorPagarApi } from '../services/api.js';
import { rangoDelPeriodo } from '../utils.js';

const DatosContext = createContext(null);

// Ventas, compras y gastos se piden al backend solo del período elegido en el
// filtro global (no todo el historial), así la carga no crece con los meses.
const SECCIONES_POR_PERIODO = ['ventas', 'compras', 'gastos'];

const valorOVacio = (resultado) => (resultado.status === 'fulfilled' ? resultado.value : []);

async function pedirDatosDelPeriodo(rango) {
  const [ventas, compras, gastos] = await Promise.allSettled([
    ventasApi.listar(rango),
    comprasApi.listar(rango),
    gastosApi.listar(rango),
  ]);
  return { ventas: valorOVacio(ventas), compras: valorOVacio(compras), gastos: valorOVacio(gastos) };
}

async function pedirDatosBase() {
  const [productos, categorias, proveedores, bajoStock, cuentasDinero, cuentasPorCobrar, cuentasPorPagar] =
    await Promise.allSettled([
      productosApi.listar(),
      categoriasApi.listar(),
      proveedoresApi.listar(),
      productosApi.bajoStock(),
      cuentasDineroApi.listar(),
      cuentasPorCobrarApi.listar(),
      cuentasPorPagarApi.listar(),
    ]);
  return {
    productos: valorOVacio(productos),
    categorias: valorOVacio(categorias),
    proveedores: valorOVacio(proveedores),
    bajoStock: valorOVacio(bajoStock),
    cuentasDinero: valorOVacio(cuentasDinero),
    cuentasPorCobrar: valorOVacio(cuentasPorCobrar),
    cuentasPorPagar: valorOVacio(cuentasPorPagar),
  };
}

export function DatosProvider({ children }) {
  const [datos, setDatos] = useState({
    ventas: [], compras: [], productos: [], gastos: [],
    categorias: [], proveedores: [], bajoStock: [],
    cuentasDinero: [], cuentasPorCobrar: [], cuentasPorPagar: [],
  });
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());
  const [añoSeleccionado, setAñoSeleccionado] = useState(new Date().getFullYear());
  const esMesFuturo =
    añoSeleccionado > new Date().getFullYear() ||
    (añoSeleccionado === new Date().getFullYear() && mesSeleccionado > new Date().getMonth());


  // El rango vigente vive también en un ref: así una respuesta que llega
  // después de cambiar el período se descarta en vez de pisar los datos nuevos.
  const rango = useMemo(
    () => rangoDelPeriodo(periodo, mesSeleccionado, añoSeleccionado),
    [periodo, mesSeleccionado, añoSeleccionado]
  );
  const rangoRef = useRef(rango);

  // Pide todo; los datos del período solo se aplican si el período no cambió
  // mientras tanto (si cambió, ya los está pidiendo el efecto de abajo).
  const cargarTodo = useCallback(() => {
    const rangoPedido = rangoRef.current;
    return Promise.all([pedirDatosBase(), pedirDatosDelPeriodo(rangoPedido)])
      .then(([base, delPeriodo]) => {
        setDatos(prev => ({
          ...prev,
          ...base,
          ...(rangoRef.current === rangoPedido ? delPeriodo : {}),
        }));
        setCargando(false);
      });
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  const recargarTodo = useCallback(() => {
    setCargando(true);
    return cargarTodo();
  }, [cargarTodo]);

  // Al cambiar el período solo se vuelven a pedir ventas, compras y gastos.
  // La primera carga ya la hace cargarTodo.
  const esPrimerRango = useRef(true);
  useEffect(() => {
    rangoRef.current = rango;
    if (esPrimerRango.current) {
      esPrimerRango.current = false;
      return;
    }
    pedirDatosDelPeriodo(rango).then(delPeriodo => {
      if (rangoRef.current === rango) setDatos(prev => ({ ...prev, ...delPeriodo }));
    });
  }, [rango]);

  const recargar = useCallback(async (seccion) => {
    const apis = {
      ventas: ventasApi.listar,
      compras: comprasApi.listar,
      productos: productosApi.listar,
      gastos: gastosApi.listar,
      categorias: categoriasApi.listar,
      proveedores: proveedoresApi.listar,
      bajoStock: productosApi.bajoStock,
      cuentasDinero: cuentasDineroApi.listar,
      cuentasPorCobrar: cuentasPorCobrarApi.listar,
      cuentasPorPagar: cuentasPorPagarApi.listar,
    };
    const porPeriodo = SECCIONES_POR_PERIODO.includes(seccion);
    const rangoPedido = rangoRef.current;
    try {
      const resultado = await (porPeriodo ? apis[seccion](rangoPedido) : apis[seccion]());
      if (porPeriodo && rangoRef.current !== rangoPedido) return;
      setDatos(prev => ({ ...prev, [seccion]: Array.isArray(resultado) ? resultado : [] }));
    } catch {
      // silencioso, mantiene datos anteriores
    }
  }, []);

  return (
    <DatosContext.Provider value={{
      // Datos crudos (para páginas que no necesitan filtro)
      ...datos,
      // Ya vienen del backend acotados al período elegido
      ventasFiltradas: datos.ventas,
      comprasFiltradas: datos.compras,
      gastosFiltrados: datos.gastos,
      // Control del período (rango = días desde/hasta que abarca)
      rango,
      periodo,
      setPeriodo,
      mesSeleccionado,
      añoSeleccionado,
      esMesFuturo,
      setMesSeleccionado,
      setAñoSeleccionado,
      cargando,
      recargar,
      recargarTodo,
    }}>
      {children}
    </DatosContext.Provider>
  );
}

export function useDatosGlobal() {
  return useContext(DatosContext);
}