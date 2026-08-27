import { useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { productosApi } from '../services/api.js';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  Boton, Card, Modal, Badge,
  Spinner, Tabla, ModalConfirmar, Drawer, DetalleCampo
} from '../components/ui/index.jsx';
import { formatearPrecio } from '../utils.js';
import FormularioProducto from '../components/FormularioProducto.jsx';

export default function Productos() {
  const { productos, categorias, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [detalleMobile, setDetalleMobile] = useState(null);

  const productosFiltrados = (Array.isArray(productos) ? productos : []).filter(p => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !filtroCategoria || String(p.categoria_id) === filtroCategoria;
    return coincideBusqueda && coincideCategoria;
  });

  function abrirCrear() {
    setProductoEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(producto) {
    setProductoEditando(producto);
    setModalAbierto(true);
  }

  async function guardar(datos) {
    const accion = productoEditando
      ? () => productosApi.actualizar(productoEditando.id, datos)
      : () => productosApi.crear(datos);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(productoEditando ? 'Producto actualizado' : 'Producto creado');
      setModalAbierto(false);
      recargar('productos');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => productosApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Producto eliminado');
      setConfirmEliminar(null);
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
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500">{productosFiltrados.length} productos</p>
        </div>
        <Boton onClick={abrirCrear}>
          <Plus size={16} /> Nuevo
        </Boton>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-base md:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="text-base md:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todas las categorías</option>
            {(Array.isArray(categorias) ? categorias : []).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-5">
        <Tabla
          columnas={['Producto', 'Categoría', 'Stock', 'P. Compra', 'P. Minorista', 'P. Mayorista', 'Acciones']} datos={productosFiltrados}
          vacio="No se encontraron productos"
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(p) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color="azul">{p.categoria_nombre || '—'}</Badge>
                <Badge color={p.stock_actual === 0 ? 'rojo' : p.stock_actual <= 2 ? 'amarillo' : 'verde'}>
                  {p.stock_actual} u.
                </Badge>
              </div>
              <p className="text-sm text-slate-700 font-semibold">{formatearPrecio(p.precio_minorista)}</p>
            </>
          )}
          renderFila={(p) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{p.nombre}</td>
              <td className="py-3 pr-4">
                <Badge color="azul">{p.categoria_nombre || '—'}</Badge>
              </td>
              <td className="py-3 pr-4">
                <Badge color={p.stock_actual === 0 ? 'rojo' : p.stock_actual <= 2 ? 'amarillo' : 'verde'}>
                  <span className="whitespace-nowrap">{p.stock_actual} u.</span>
                </Badge>
              </td>
              <td className="py-3 pr-4 text-slate-500 text-xs hidden sm:table-cell">{formatearPrecio(p.precio_compra)}</td>
              <td className="py-3 pr-4 text-slate-700">{formatearPrecio(p.precio_minorista)}</td>
              <td className="py-3 pr-4 text-slate-700 hidden sm:table-cell">{formatearPrecio(p.precio_mayorista)}</td>
              <td className="py-3 flex items-center gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(p)}>
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(p)}>
                  <Trash2 size={14} />
                </Boton>
              </td>
            </>
          )}
        />
      </Card>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={productoEditando ? 'Editar producto' : 'Nuevo producto'}
      >
        <FormularioProducto
          productoInicial={productoEditando}
          categorias={Array.isArray(categorias) ? categorias : []}
          onGuardar={guardar}
          guardando={guardando}
          onCancelar={() => setModalAbierto(false)}
        />
      </Modal>

      <ModalConfirmar
        abierto={!!confirmEliminar}
        onCerrar={() => setConfirmEliminar(null)}
        onConfirmar={eliminar}
        mensaje={`¿Eliminar el producto "${confirmEliminar?.nombre}"? Esta acción desactivará el producto.`}
        cargando={guardando}
      />

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile?.nombre}
        footer={detalleMobile && (
          <>
            <Boton variante="secundario" onClick={() => { setDetalleMobile(null); abrirEditar(detalleMobile); }}>
              <Pencil size={14} /> Editar
            </Boton>
            <Boton variante="peligro" onClick={() => { setDetalleMobile(null); setConfirmEliminar(detalleMobile); }}>
              <Trash2 size={14} /> Eliminar
            </Boton>
          </>
        )}
      >
        {detalleMobile && (
          <div>
            <DetalleCampo etiqueta="Categoría" valor={detalleMobile.categoria_nombre || '—'} />
            <DetalleCampo etiqueta="Stock" valor={`${detalleMobile.stock_actual} u.`} />
            <DetalleCampo etiqueta="Precio de compra" valor={formatearPrecio(detalleMobile.precio_compra)} />
            <DetalleCampo etiqueta="Precio minorista" valor={formatearPrecio(detalleMobile.precio_minorista)} />
            <DetalleCampo etiqueta="Precio mayorista" valor={formatearPrecio(detalleMobile.precio_mayorista)} />
          </div>
        )}
      </Drawer>
    </div>
  );
}