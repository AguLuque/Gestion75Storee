import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { ventasApi, productosApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { Boton, Card, Modal, Badge, Spinner, Tabla } from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';
import FormularioVenta from '../components/FormularioVenta.jsx';

export default function Ventas() {
  const { ventasFiltradas: ventas, productos, cargando, recargar, esMesFuturo } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [expandida, setExpandida] = useState(null);

  async function guardar(datos) {
    const resultado = await ejecutar(() => ventasApi.crear(datos));
    if (resultado.ok) {
      mostrarToast('Venta registrada');
      setModalAbierto(false);
      recargar('ventas');
      recargar('productos');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ventas</h1>
          <p className="text-sm text-slate-500">{ventas?.length || 0} ventas registradas</p>
        </div>
        <Boton onClick={() => {
          if (esMesFuturo) {
            mostrarToast('No podés registrar ventas en meses futuros.', 'error');
            return;
          }
          setModalAbierto(true);
        }}>
          <Plus size={16} /> Nueva venta
        </Boton>
      </div>

      <Card className="p-5">
        <div className="space-y-0">
          {(ventas || []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Sin ventas registradas</p>
          )}
          {(ventas || []).map(venta => (
            <div key={venta.id} className="border-b border-slate-50 last:border-0">
              <div
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50/50 -mx-5 px-5 transition-colors rounded"
                onClick={() => setExpandida(expandida === venta.id ? null : venta.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{formatearPrecio(venta.total)}</p>
                    <p className="text-xs text-slate-400">{formatearFecha(venta.fecha)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={venta.tipo === 'mayorista' ? 'violeta' : 'azul'}>{venta.tipo}</Badge>
                  {venta.ganancia && (
                    <span className="text-xs text-green-600 font-medium">
                      +{formatearPrecio(venta.ganancia)}
                    </span>
                  )}
                  {expandida === venta.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
              </div>

              {/* Detalle expandido */}
              {expandida === venta.id && venta.items && (
                <div className="pb-3 pl-2">
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    {venta.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-600">{item.producto} × {item.cantidad}</span>
                        <span className="text-slate-700 font-medium">{formatearPrecio(item.subtotal)}</span>
                      </div>
                    ))}
                    {venta.observaciones && (
                      <p className="text-xs text-slate-400 pt-1 border-t border-slate-200 mt-1">
                        {venta.observaciones}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Nueva venta"
        className="max-w-xl mx-4"
      >
        <FormularioVenta
          productos={productos || []}
          onGuardar={guardar}
          guardando={guardando}
          onCancelar={() => setModalAbierto(false)}
        />
      </Modal>
    </div>
  );
}
