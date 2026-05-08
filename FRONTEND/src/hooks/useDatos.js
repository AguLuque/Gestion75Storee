import { useState, useEffect, useCallback } from 'react';

export function useDatos(fn, deps = []) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await fn();
      // Siempre guardar como array si corresponde
      setDatos(Array.isArray(resultado) ? resultado : resultado ?? []);
    } catch (err) {
      setError(err.message);
      setDatos([]); // en caso de error, array vacío en lugar de null
    } finally {
      setCargando(false);
    }
  }, deps);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { datos, cargando, error, recargar: cargar };
}

export function useAccion() {
  const [cargando, setCargando] = useState(false);

  const ejecutar = useCallback(async (fn) => {
    setCargando(true);
    try {
      const resultado = await fn();
      return { ok: true, datos: resultado };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      setCargando(false);
    }
  }, []);

  return { cargando, ejecutar };
}