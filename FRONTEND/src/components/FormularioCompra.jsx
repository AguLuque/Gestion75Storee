import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Boton, Select, Textarea, Input, InputPrecio, Modal } from './ui/index.jsx';
import { formatearPrecio } from '../utils.js';
import { productosApi, categoriasApi } from '../services/api.js';
import { useAccion } from '../hooks/useDatos.js';
import { useToast } from '../context/ToastContext.jsx';

const itemVacio = () => ({ producto_id: '', cantidad: 1, precio_unitario: '' });

export default function FormularioCompra({ compraInicial, productos, proveedores, onGuardar, guardando, onCancelar, onProductoCreado }) {
  const [proveedorId, setProveedorId] = useState('');
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState('');
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', categoria_id: '', precio_compra: '', precio_minorista: '', precio_mayorista: '' });
  const [categorias, setCategorias] = useState([]);
  const { ejecutar, cargando: creandoProducto } = useAccion();
  const { mostrarToast } = useToast();

  useEffect(() => {
    categoriasApi.listar().then(setCategorias).catch(() => { });
  }, []);

  useEffect(() => {
    if (compraInicial) {
      setProveedorId(compraInicial.proveedor_id || '');
      setObservaciones(compraInicial.observaciones || '');
      if (compraInicial.items?.length) {
        setItems(compraInicial.items.map(i => ({
          producto_id: String(i.producto_id),
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })));
      }
    } else {
      setProveedorId('');
      setObservaciones('');
      setItems([itemVacio()]);
    }
  }, [compraInicial]);

  function actualizarItem(idx, campo, valor) {
    setItems(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };
      if (campo === 'producto_id' && valor) {
        const prod = productos.find(p => String(p.id) === valor);
        if (prod) copia[idx].precio_unitario = prod.precio_compra || '';
      }
      return copia;
    });
  }

  async function crearProductoNuevo(e) {
    e.preventDefault();
    const resultado = await ejecutar(() => productosApi.crear({
      ...nuevoProducto,
      categoria_id: nuevoProducto.categoria_id ? Number(nuevoProducto.categoria_id) : null,
      precio_compra: Number(nuevoProducto.precio_compra) || 0,
      precio_minorista: Number(nuevoProducto.precio_minorista) || 0,
      precio_mayorista: Number(nuevoProducto.precio_mayorista) || 0,
      stock_actual: 0,
    }));
    if (resultado.ok) {
      mostrarToast('Producto creado');
      setModalNuevoProducto(false);
      setNuevoProducto({ nombre: '', categoria_id: '', precio_compra: '', precio_minorista: '', precio_mayorista: '' });
      onProductoCreado?.();
      // Seleccionar el nuevo producto en el último ítem
      const nuevoId = String(resultado.datos?.id || '');
      if (nuevoId) {
        setItems(prev => {
          const copia = [...prev];
          copia[copia.length - 1] = { ...copia[copia.length - 1], producto_id: nuevoId };
          return copia;
        });
      }
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0);

  function enviar(e) {
    e.preventDefault();
    const itemsValidos = items.filter(i => i.producto_id && i.cantidad > 0);
    if (!itemsValidos.length) return;
    onGuardar({
      proveedor_id: proveedorId ? Number(proveedorId) : null,
      observaciones: observaciones || null,
      items: itemsValidos.map(i => ({
        producto_id: Number(i.producto_id),
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario) || 0,
      })),
    });
  }

  return (
    <>
      <form onSubmit={enviar} className="space-y-4">
        <Select label="Proveedor (opcional)" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
          <option value="">Sin proveedor</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Select>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Productos</label>
            <Boton variante="fantasma" tamaño="sm" type="button" onClick={() => setModalNuevoProducto(true)}>
              <Plus size={13} /> Nuevo producto
            </Boton>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <select
                  value={item.producto_id}
                  onChange={e => actualizarItem(idx, 'producto_id', e.target.value)}
                  className="w-full text-base md:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <input type="number" min="1" value={item.cantidad}
                onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                placeholder="Cant." className="w-20 text-base md:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              <InputPrecio
                valorInicial={item.precio_unitario}
                onCambio={valor =>
                  actualizarItem(idx, 'precio_unitario', valor)
                }
              />
              {items.length > 1 && (
                <Boton variante="peligro" tamaño="sm" type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} />
                </Boton>
              )}
            </div>
          ))}
          <Boton variante="secundario" tamaño="sm" type="button" onClick={() => setItems(prev => [...prev, itemVacio()])}>
            <Plus size={14} /> Agregar producto
          </Boton>
        </div>

        <Textarea label="Observaciones (opcional)" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas..." />

        <div className="bg-slate-50 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-slate-600">Total</span>
          <span className="font-bold text-slate-800">{formatearPrecio(total)}</span>
        </div>

        <div className="flex gap-2 justify-end">
          <Boton variante="secundario" type="button" onClick={onCancelar} disabled={guardando}>Cancelar</Boton>
          <Boton type="submit" disabled={guardando}>{guardando ? 'Guardando...' : compraInicial ? 'Guardar cambios' : 'Registrar compra'}</Boton>
        </div>
      </form>

      {/* Modal nuevo producto */}
      <Modal abierto={modalNuevoProducto} onCerrar={() => setModalNuevoProducto(false)} titulo="Nuevo producto" className="max-w-md mx-4">
        <form onSubmit={crearProductoNuevo} className="space-y-3">
          <Input label="Nombre *" value={nuevoProducto.nombre} onChange={e => setNuevoProducto(p => ({ ...p, nombre: e.target.value }))} required placeholder="Ej: Remera talle M" />
          <Select label="Categoría" value={nuevoProducto.categoria_id} onChange={e => setNuevoProducto(p => ({ ...p, categoria_id: e.target.value }))}>
            <option value="">Sin categoría</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <div className="grid grid-cols-3 gap-2">
            <InputPrecio
              label="P. Compra"
              valorInicial={nuevoProducto.precio_compra}
              onCambio={valor =>
                setNuevoProducto(p => ({
                  ...p,
                  precio_compra: valor,
                }))
              }
              placeholder="0"
            />

            <InputPrecio
              label="P. Minorista"
              valorInicial={nuevoProducto.precio_minorista}
              onCambio={valor =>
                setNuevoProducto(p => ({
                  ...p,
                  precio_minorista: valor,
                }))
              }
              placeholder="0"
            />

            <InputPrecio
              label="P. Mayorista"
              valorInicial={nuevoProducto.precio_mayorista}
              onCambio={valor =>
                setNuevoProducto(p => ({
                  ...p,
                  precio_mayorista: valor,
                }))
              }
              placeholder="0"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Boton variante="secundario" type="button" onClick={() => setModalNuevoProducto(false)} disabled={creandoProducto}>Cancelar</Boton>
            <Boton type="submit" disabled={creandoProducto}>{creandoProducto ? 'Creando...' : 'Crear producto'}</Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}