import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { comprasApi, productosApi, proveedoresApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { Boton, Card, Modal, Spinner, Drawer, DetalleCampo, CardMobile } from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';
import FormularioCompra from '../components/FormularioCompra.jsx';

export default function Compras() {
  const { comprasFiltradas: compras, productos, proveedores, cargando, recargar, esMesFuturo } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);
  const [expandida, setExpandida] = useState(null);
  const [detalleMobile, setDetalleMobile] = useState(null);


  function abrirCrear() {
    if (esMesFuturo) {
      mostrarToast('No podés registrar compras en meses futuros.', 'error');
      return;
    }

    setCompraEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(compra) {
    setCompraEditando(compra);
    setModalAbierto(true);
  }
  async function guardar(datos) {
    const accion = compraEditando
      ? () => comprasApi.actualizar(compraEditando.id, datos)
      : () => comprasApi.crear(datos);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(compraEditando ? 'Compra actualizada' : 'Compra registrada');
      setModalAbierto(false);
      recargar('compras');
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
          <h1 className="text-xl font-bold text-slate-800">Compras</h1>
          <p className="text-sm text-slate-500">{Array.isArray(compras) ? compras.length : 0} compras registradas</p>
        </div>
        <Boton onClick={abrirCrear}>
          <Plus size={16} /> Nueva compra
        </Boton>
      </div>

      <Card className="p-5">
        <div className="hidden md:block">
        {(Array.isArray(compras) ? compras : []).length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Sin compras registradas</p>
        )}
        {(Array.isArray(compras) ? compras : []).map(compra => (
          <div key={compra.id} className="border-b border-slate-50 last:border-0">
            <div className="flex items-center justify-between py-3 hover:bg-slate-50/50 -mx-5 px-5 transition-colors rounded">
              <div
                className="flex-1 cursor-pointer"
                onClick={() => setExpandida(expandida === compra.id ? null : compra.id)}
              >
                <p className="text-sm font-medium text-slate-800">{formatearPrecio(compra.total)}</p>
                <p className="text-xs text-slate-400">
                  {formatearFecha(compra.fecha)} · {compra.proveedor || 'Sin proveedor'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(compra)}>
                  <Pencil size={14} />
                </Boton>
                <div
                  className="cursor-pointer text-slate-400 p-1"
                  onClick={() => setExpandida(expandida === compra.id ? null : compra.id)}
                >
                  {expandida === compra.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
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
        </div>

        <div className="md:hidden space-y-2">
          {(Array.isArray(compras) ? compras : []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin compras registradas</p>
          ) : (
            (Array.isArray(compras) ? compras : []).map(compra => (
              <CardMobile key={compra.id} onClick={() => setDetalleMobile(compra)}>
                <p className="text-sm font-medium text-slate-800">{formatearPrecio(compra.total)}</p>
                <p className="text-xs text-slate-400">
                  {formatearFecha(compra.fecha)} · {compra.proveedor || 'Sin proveedor'}
                </p>
              </CardMobile>
            ))
          )}
        </div>
      </Card>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={compraEditando ? 'Editar compra' : 'Nueva compra'}
        className="max-w-xl mx-4"
      >
        <FormularioCompra
          compraInicial={compraEditando}
          productos={Array.isArray(productos) ? productos : []}
          proveedores={Array.isArray(proveedores) ? proveedores : []}
          onGuardar={guardar}
          guardando={guardando}
          onCancelar={() => setModalAbierto(false)}
          onProductoCreado={'productos'}
        />
      </Modal>

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile ? formatearPrecio(detalleMobile.total) : ''}
        footer={detalleMobile && (
          <Boton variante="secundario" onClick={() => { setDetalleMobile(null); abrirEditar(detalleMobile); }}>
            <Pencil size={14} /> Editar
          </Boton>
        )}
      >
        {detalleMobile && (
          <div>
            <DetalleCampo etiqueta="Fecha" valor={formatearFecha(detalleMobile.fecha)} />
            <DetalleCampo etiqueta="Proveedor" valor={detalleMobile.proveedor || 'Sin proveedor'} />
            {detalleMobile.items?.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-500 mb-1.5">Productos</p>
                <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                  {detalleMobile.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-600">{item.producto} × {item.cantidad}</span>
                      <span className="text-slate-700 font-medium">{formatearPrecio(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detalleMobile.observaciones && (
              <DetalleCampo etiqueta="Observaciones" valor={detalleMobile.observaciones} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}