import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { gastosApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import {
  Boton, Card, Modal, Input, InputPrecio, Select, Textarea,
  Spinner, Tabla, ModalConfirmar, Badge, Drawer, DetalleCampo
} from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';

const CATEGORIAS_GASTO = ['Servicios', 'Alquiler', 'Transporte', 'Marketing', 'Personal', 'Impuestos', 'Otros'];
const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const formularioVacio = { descripcion: '', monto: '', categoria: '', metodo_pago: '' };

export default function Gastos() {
  const { gastosFiltrados: gastos, cargando, recargar, esMesFuturo } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [detalleMobile, setDetalleMobile] = useState(null);

  function abrirCrear() {
    if (esMesFuturo) {
      mostrarToast('No podés registrar gastos en meses futuros.', 'error');
      return;
    }
    setGastoEditando(null);
    setFormulario(formularioVacio);
    setModalAbierto(true);
  }

  function abrirEditar(gasto) {
    setGastoEditando(gasto);
    setFormulario({ descripcion: gasto.descripcion, monto: gasto.monto, categoria: gasto.categoria || '', metodo_pago: gasto.metodo_pago || '' });
    setModalAbierto(true);
  }

  function actualizar(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e) {
    e.preventDefault();
    const datos = { ...formulario, monto: Number(formulario.monto), metodo_pago: formulario.metodo_pago || null };
    const accion = gastoEditando
      ? () => gastosApi.actualizar(gastoEditando.id, datos)
      : () => gastosApi.crear(datos);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(gastoEditando ? 'Gasto actualizado' : 'Gasto registrado');
      setModalAbierto(false);
      recargar('gastos');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => gastosApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Gasto eliminado');
      setConfirmEliminar(null);
      recargar('gastos');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  const totalGastos = (gastos || []).reduce((s, g) => s + Number(g.monto), 0);

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gastos</h1>
          <p className="text-sm text-slate-500">Total: {formatearPrecio(totalGastos)}</p>
        </div>
        <Boton onClick={abrirCrear}>
          <Plus size={16} /> Nuevo gasto
        </Boton>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Descripción', 'Categoría', 'Pago', 'Monto', 'Fecha', 'Acciones']}
          datos={gastos || []}
          vacio="Sin gastos registrados"
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(g) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{g.descripcion}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color="default">{g.categoria || '—'}</Badge>
                <span className="text-xs text-slate-400">{formatearFecha(g.fecha)}</span>
              </div>
              <p className="text-sm font-semibold text-red-600">{formatearPrecio(g.monto)}</p>
            </>
          )}
          renderFila={(g) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{g.descripcion}</td>
              <td className="py-3 pr-4">
                <Badge color="default">{g.categoria || '—'}</Badge>
              </td>
              <td className="py-3 pr-4">
                <Badge color="default">{METODOS_PAGO.find(m => m.valor === g.metodo_pago)?.etiqueta || '—'}</Badge>
              </td>
              <td className="py-3 pr-4 font-semibold text-red-600">{formatearPrecio(g.monto)}</td>
              <td className="py-3 pr-4 text-slate-500 text-xs">{formatearFecha(g.fecha)}</td>
              <td className="py-3 flex items-center gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(g)}>
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(g)}>
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
        titulo={gastoEditando ? 'Editar gasto' : 'Nuevo gasto'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <Input
            label="Descripción *"
            value={formulario.descripcion}
            onChange={e => actualizar('descripcion', e.target.value)}
            required
            placeholder="Ej: Pago de alquiler"
          />
          <InputPrecio
            label="Monto *"
            valorInicial={formulario.monto}
            onCambio={valor => actualizar('monto', valor)}
            required
            placeholder="0"
          />
          <Select
            label="Categoría"
            value={formulario.categoria}
            onChange={e => actualizar('categoria', e.target.value)}
          >
            <option value="">Sin categoría</option>
            {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select
            label="Método de pago"
            value={formulario.metodo_pago}
            onChange={e => actualizar('metodo_pago', e.target.value)}
          >
            <option value="">Sin especificar</option>
            {METODOS_PAGO.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </Select>
          <div className="flex gap-2 justify-end pt-1">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmEliminar}
        onCerrar={() => setConfirmEliminar(null)}
        onConfirmar={eliminar}
        mensaje={`¿Eliminar el gasto "${confirmEliminar?.descripcion}"?`}
        cargando={guardando}
      />

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile?.descripcion}
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
            <DetalleCampo etiqueta="Monto" valor={formatearPrecio(detalleMobile.monto)} />
            <DetalleCampo etiqueta="Categoría" valor={detalleMobile.categoria || '—'} />
            <DetalleCampo etiqueta="Método de pago" valor={METODOS_PAGO.find(m => m.valor === detalleMobile.metodo_pago)?.etiqueta || '—'} />
            <DetalleCampo etiqueta="Fecha" valor={formatearFecha(detalleMobile.fecha)} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
