import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useDatos, useAccion } from '../hooks/useDatos.js';
import { comprasApi, productosApi, proveedoresApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Boton, Card, Modal, Spinner } from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';
import FormularioCompra from '../components/FormularioCompra.jsx';

export default function Compras() {
  const { datos: compras, cargando, recargar } = useDatos(comprasApi.listar);
  const { datos: productos } = useDatos(productosApi.listar);
  const { datos: proveedores } = useDatos(proveedoresApi.listar);
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [expandida, setExpandida] = useState(null);

  async function guardar(datos) {
    const resultado = await ejecutar(() => comprasApi.crear(datos));
    if (resultado.ok) {
      mostrarToast('Compra registrada');
      setModalAbierto(false);
      recargar();
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Compras</h1>
          <p className="text-sm text-slate-500">{compras?.length || 0} compras registradas</p>
        </div>
        <Boton onClick={() => setModalAbierto(true)}>
          <Plus size={16} /> Nueva compra
        </Boton>
      </div>

      <Card className="p-5">
        {(compras || []).length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Sin compras registradas</p>
        )}
        {(compras || []).map(compra => (
          <div key={compra.id} className="border-b border-slate-50 last:border-0">
            <div
              className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50/50 -mx-5 px-5 transition-colors rounded"
              onClick={() => setExpandida(expandida === compra.id ? null : compra.id)}
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{formatearPrecio(compra.total)}</p>
                <p className="text-xs text-slate-400">
                  {formatearFecha(compra.fecha)} · {compra.proveedor || 'Sin proveedor'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {expandida === compra.id
                  ? <ChevronUp size={14} className="text-slate-400" />
                  : <ChevronDown size={14} className="text-slate-400" />}
              </div>
            </div>

            {expandida === compra.id && compra.items && (
              <div className="pb-3 pl-2">
                <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                  {compra.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-600">{item.producto} × {item.cantidad}</span>
                      <span className="text-slate-700 font-medium">{formatearPrecio(item.subtotal)}</span>
                    </div>
                  ))}
                  {compra.observaciones && (
                    <p className="text-xs text-slate-400 pt-1 border-t border-slate-200 mt-1">
                      {compra.observaciones}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Nueva compra"
        className="max-w-xl mx-4"
      >
        <FormularioCompra
          productos={productos || []}
          proveedores={proveedores || []}
          onGuardar={guardar}
          guardando={guardando}
          onCancelar={() => setModalAbierto(false)}
        />
      </Modal>
    </div>
  );
}
