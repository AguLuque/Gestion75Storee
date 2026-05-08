import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, PackageX } from 'lucide-react';
import { useDatos, useAccion } from '../hooks/useDatos.js';
import { productosApi, categoriasApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  Boton, Card, Modal, Input, Select, Badge,
  Spinner, Tabla, ModalConfirmar
} from '../components/ui/index.jsx';
import { formatearPrecio } from '../utils.js';
import FormularioProducto from '../components/FormularioProducto.jsx';

export default function Productos() {
  const { datos: productos, cargando, recargar } = useDatos(productosApi.listar);
  const { datos: categorias } = useDatos(categoriasApi.listar);
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const productosFiltrados = (productos || []).filter(p => {
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
      recargar();
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => productosApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Producto eliminado');
      setConfirmEliminar(null);
      recargar();
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500">{productos?.length || 0} productos activos</p>
        </div>
        <Boton onClick={abrirCrear}>
          <Plus size={16} /> Nuevo
        </Boton>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todas las categorías</option>
            {(categorias || []).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="p-5">
        <Tabla
          columnas={['Producto', 'Categoría', 'Stock', 'P. Compra', 'P. Minorista', 'P. Mayorista', 'Acciones']}
          datos={productosFiltrados}
          vacio="No se encontraron productos"
          renderFila={(p) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{p.nombre}</td>
              <td className="py-3 pr-4">
                <Badge color="azul">{p.categoria_nombre || '—'}</Badge>
              </td>
              <td className="py-3 pr-4">
                <Badge color={p.stock_actual === 0 ? 'rojo' : p.stock_actual <= 2 ? 'amarillo' : 'verde'}>
                  {p.stock_actual} u.
                </Badge>
              </td>
              <td className="py-3 pr-4 text-slate-500 text-xs">{formatearPrecio(p.precio_compra)}</td>
              <td className="py-3 pr-4 text-slate-700">{formatearPrecio(p.precio_minorista)}</td>
              <td className="py-3 pr-4 text-slate-700">{formatearPrecio(p.precio_mayorista)}</td>
              <td className="py-3 flex items-center gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(p)} title="Editar">
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(p)} title="Eliminar">
                  <Trash2 size={14} />
                </Boton>
              </td>
            </>
          )}
        />
      </Card>

      {/* Modal formulario */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={productoEditando ? 'Editar producto' : 'Nuevo producto'}
      >
        <FormularioProducto
          productoInicial={productoEditando}
          categorias={categorias || []}
          onGuardar={guardar}
          guardando={guardando}
          onCancelar={() => setModalAbierto(false)}
        />
      </Modal>

      {/* Confirmar eliminación */}
      <ModalConfirmar
        abierto={!!confirmEliminar}
        onCerrar={() => setConfirmEliminar(null)}
        onConfirmar={eliminar}
        mensaje={`¿Eliminar el producto "${confirmEliminar?.nombre}"? Esta acción desactivará el producto.`}
        cargando={guardando}
      />
    </div>
  );
}
