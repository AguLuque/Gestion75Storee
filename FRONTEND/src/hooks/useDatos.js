import { useState, useCallback } from 'react';

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