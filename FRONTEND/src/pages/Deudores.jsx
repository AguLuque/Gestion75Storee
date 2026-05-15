import { useState } from 'react';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { deudoresApi } from '../services/api.js';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Boton, Card, Modal, Input, Textarea, Spinner, Tabla, ModalConfirmar, Badge } from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';

const formularioVacio = { nombre: '', monto: '', plazo: '', observaciones: '' };

export default function Deudores() {
  const { deudores, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const listaDeudores = Array.isArray(deudores) ? deudores : [];
  const totalDeuda = listaDeudores.reduce((s, d) => s + Number(d.monto || 0), 0);

  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setModalAbierto(true);
  }

  function abrirEditar(deudor) {
    setEditando(deudor);
    setFormulario({
      nombre: deudor.nombre,
      monto: deudor.monto,
      plazo: deudor.plazo ? deudor.plazo.split('T')[0] : '',
      observaciones: deudor.observaciones || '',
    });
    setModalAbierto(true);
  }

  function actualizar(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e) {
    e.preventDefault();
    const datos = { ...formulario, monto: Number(formulario.monto) };
    const accion = editando
      ? () => deudoresApi.actualizar(editando.id, datos)
      : () => deudoresApi.crear(datos);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(editando ? 'Deudor actualizado' : 'Deudor agregado');
      setModalAbierto(false);
      recargar('deudores');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => deudoresApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Deudor eliminado');
      setConfirmEliminar(null);
      recargar('deudores');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  function colorPlazo(plazo) {
    if (!plazo) return 'default';
    const dias = Math.ceil((new Date(plazo) - new Date()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return 'rojo';
    if (dias <= 7) return 'amarillo';
    return 'verde';
  }

  function textoVencimiento(plazo) {
    if (!plazo) return '—';
    const dias = Math.ceil((new Date(plazo) - new Date()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return `Venció hace ${Math.abs(dias)}d`;
    if (dias === 0) return 'Vence hoy';
    if (dias <= 7) return `Vence en ${dias}d`;
    return formatearFecha(plazo);
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Deudores</h1>
          <p className="text-sm text-slate-500">
            {listaDeudores.length} deudores · {formatearPrecio(totalDeuda)} pendiente
          </p>
        </div>
        <Boton onClick={abrirCrear}><Plus size={16} /> Nuevo</Boton>
      </div>

      {/* Alerta si hay deudas vencidas */}
      {listaDeudores.some(d => d.plazo && new Date(d.plazo) < new Date()) && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">
            Hay deudas vencidas que requieren atención.
          </p>
        </div>
      )}

      <Card className="p-5">
        <Tabla
          columnas={['Deudor', 'Monto', 'Vencimiento', 'Observaciones', 'Acciones']}
          datos={listaDeudores}
          vacio="Sin deudores registrados"
          renderFila={(d) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{d.nombre}</td>
              <td className="py-3 pr-4 font-semibold text-slate-800">{formatearPrecio(d.monto)}</td>
              <td className="py-3 pr-4">
                <Badge color={colorPlazo(d.plazo)}>{textoVencimiento(d.plazo)}</Badge>
              </td>
              <td className="py-3 pr-4 text-slate-500 text-xs max-w-xs truncate">
                {d.observaciones || '—'}
              </td>
              <td className="py-3 flex gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(d)}>
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(d)}>
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
        titulo={editando ? 'Editar deudor' : 'Nuevo deudor'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <Input
            label="Nombre *"
            value={formulario.nombre}
            onChange={e => actualizar('nombre', e.target.value)}
            required
            placeholder="Nombre del deudor"
          />
          <Input
            label="Monto *"
            type="number"
            min="0"
            value={formulario.monto}
            onChange={e => actualizar('monto', e.target.value)}
            required
            placeholder="0"
          />
          <Input
            label="Plazo límite"
            type="date"
            value={formulario.plazo}
            onChange={e => actualizar('plazo', e.target.value)}
          />
          <Textarea
            label="Observaciones"
            value={formulario.observaciones}
            onChange={e => actualizar('observaciones', e.target.value)}
            placeholder="Notas adicionales..."
          />
          <div className="flex gap-2 justify-end">
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
        mensaje={`¿Eliminar a "${confirmEliminar?.nombre}" de la lista de deudores?`}
        cargando={guardando}
      />
    </div>
  );
}