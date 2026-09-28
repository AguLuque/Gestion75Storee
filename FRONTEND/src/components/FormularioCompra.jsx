import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Boton, Select, Textarea, Input, InputPrecio, Modal } from './ui/index.jsx';
import { formatearPrecio } from '../utils.js';
import { SelectorProducto } from './ui/selector-producto.jsx';
import { productosApi, categoriasApi } from '../services/api.js';
import { useAccion } from '../hooks/useDatos.js';
import { useToast } from '../context/ToastContext.jsx';

const itemVacio = () => ({ producto_id: '', cantidad: 1, precio_unitario: '' });

// Precio de compra actual al lado de cada producto del buscador
function detallePrecioCompra(producto) {
  return Number(producto.precio_compra) > 0
    ? <span className="text-slate-500">{formatearPrecio(producto.precio_compra)}</span>
    : <span className="text-slate-400">Sin precio</span>;
}

const TIPOS_COMPRA = [
  { valor: 'local', etiqueta: 'Local' },
  { valor: 'nacional', etiqueta: 'Nacional' },
  { valor: 'internacional', etiqueta: 'Internacional' },
];

export default function FormularioCompra({ compraInicial, productos, proveedores, cuentasDinero = [], onGuardar, guardando, onCancelar, onProductoCreado }) {
  // El estado se inicializa una sola vez desde compraInicial: el padre remonta el
  // formulario (key) cada vez que cambia la compra a editar.
  const [proveedorId, setProveedorId] = useState(compraInicial?.proveedor_id || '');
  const [items, setItems] = useState(() =>
    compraInicial?.items?.length
      ? compraInicial.items.map(i => ({
        producto_id: String(i.producto_id),
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }))
      : [itemVacio()]
  );
  const [observaciones, setObservaciones] = useState(compraInicial?.observaciones || '');
  const [tipo, setTipo] = useState(compraInicial?.tipo || 'local');
  const [costoEnvio, setCostoEnvio] = useState(compraInicial?.costo_envio || '');
  const [cuentaDineroId, setCuentaDineroId] = useState('');
  const [aCredito, setACredito] = useState(false);
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', categoria_id: '', precio_compra: '', precio_minorista: '', precio_mayorista: '' });
  const [categorias, setCategorias] = useState([]);
  const { ejecutar, cargando: creandoProducto } = useAccion();
  const { mostrarToast } = useToast();

  useEffect(() => {
    categoriasApi.listar().then(setCategorias).catch(() => { });
  }, []);

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
      precio_mayorista: nuevoProducto.precio_mayorista === '' ? null : Number(nuevoProducto.precio_mayorista),
      stock_actual: 0,
    }));
    if (resultado.ok) {
      mostrarToast('Producto creado');
      setModalNuevoProducto(false);
      setNuevoProducto({ nombre: '', categoria_id: '', precio_compra: '', precio_minorista: '', precio_mayorista: '' });
      onProductoCreado?.();
      // Seleccionar el nuevo producto en el primer ítem vacío (o en uno nuevo si
      // todos ya tienen producto), con su precio de compra precargado
      const creado = resultado.datos;
      if (creado?.id) {
        const itemNuevo = { producto_id: String(creado.id), precio_unitario: Number(creado.precio_compra) || '' };
        setItems(prev => {
          const idxVacio = prev.findIndex(i => !i.producto_id);
          if (idxVacio === -1) return [...prev, { ...itemVacio(), ...itemNuevo }];
          const copia = [...prev];
          copia[idxVacio] = { ...copia[idxVacio], ...itemNuevo };
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
      tipo,
      costo_envio: Number(costoEnvio) || 0,
      estado_pago: aCredito ? 'pendiente' : 'pagado',
      cuenta_dinero_id: !aCredito && cuentaDineroId ? Number(cuentaDineroId) : null,
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

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de compra" value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS_COMPRA.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </Select>

          <InputPrecio
            label="Costo de envío"
            valorInicial={costoEnvio}
            onCambio={valor => setCostoEnvio(valor || '')}
            placeholder="0"
          />
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Incluye flete, correo, o nafta si tenés que ir a buscarlo (por ej. a otra ciudad por cargo).
        </p>

        {!compraInicial && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="compra-a-credito"
              checked={aCredito}
              onChange={e => setACredito(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="compra-a-credito" className="text-sm text-slate-600">
              Compra a crédito (todavía no se pagó)
            </label>
          </div>
        )}

        {!aCredito && (
          <Select
            label={compraInicial ? 'Cambiar cuenta que paga (opcional)' : 'Cuenta que paga (opcional)'}
            value={cuentaDineroId}
            onChange={e => setCuentaDineroId(e.target.value)}
          >
            {/* Al editar, no elegir cuenta mantiene la del pago original (el backend la conserva) */}
            <option value="">{compraInicial ? 'Mantener la cuenta original' : 'Sin registrar en ninguna cuenta'}</option>
            {cuentasDinero.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Productos</label>
            <Boton variante="primario" tamaño="sm" type="button" onClick={() => setModalNuevoProducto(true)}>
              <Plus size={13} /> Nuevo producto
            </Boton>
          </div>
          {items.map((item, idx) => (
            // En mobile el producto va en su propia línea y cantidad + precio
            // debajo, agrupados en un recuadro; desde md: todo en una fila.
            <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-end rounded-lg border border-slate-100 p-2 md:border-0 md:p-0">
              <div className="flex-1 basis-full md:basis-0 min-w-0">
                <SelectorProducto
                  productos={productos}
                  value={item.producto_id}
                  onChange={id => actualizarItem(idx, 'producto_id', id)}
                  detalle={detallePrecioCompra}
                  required
                />
              </div>
              <input type="number" min="1" value={item.cantidad}
                onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                placeholder="Cant." className="w-20 text-base md:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              <div className="flex-1 md:flex-initial">
                <InputPrecio
                  valorInicial={item.precio_unitario}
                  onCambio={valor =>
                    actualizarItem(idx, 'precio_unitario', valor)
                  }
                />
              </div>
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

        <div className="bg-slate-50 rounded-lg p-3 space-y-1">
          {Number(costoEnvio) > 0 && (
            <>
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Mercadería</span>
                <span>{formatearPrecio(total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Envío</span>
                <span>{formatearPrecio(Number(costoEnvio))}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Total</span>
            <span className="font-bold text-slate-800">{formatearPrecio(total + (Number(costoEnvio) || 0))}</span>
          </div>
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
                  precio_mayorista: valor || '',
                }))
              }
              placeholder="Opcional"
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