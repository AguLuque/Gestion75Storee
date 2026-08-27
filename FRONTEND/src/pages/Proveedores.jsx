import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { proveedoresApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { Boton, Card, Modal, Input, Textarea, Spinner, Tabla, ModalConfirmar, Drawer, DetalleCampo } from '../components/ui/index.jsx';

const formularioVacio = { nombre: '', contacto: '', observaciones: '' };

export default function Proveedores() {
  const { proveedores, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [detalleMobile, setDetalleMobile] = useState(null);

  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setModalAbierto(true);
  }

  function abrirEditar(prov) {
    setEditando(prov);
    setFormulario({ nombre: prov.nombre, contacto: prov.contacto || '', observaciones: prov.observaciones || '' });
    setModalAbierto(true);
  }

  function actualizar(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e) {
    e.preventDefault();
    const accion = editando
      ? () => proveedoresApi.actualizar(editando.id, formulario)
      : () => proveedoresApi.crear(formulario);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(editando ? 'Proveedor actualizado' : 'Proveedor creado');
      setModalAbierto(false);
      recargar('proveedores');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => proveedoresApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Proveedor eliminado');
      setConfirmEliminar(null);
      recargar('proveedores');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Proveedores</h1>
          <p className="text-sm text-slate-500">{proveedores?.length || 0} proveedores</p>
        </div>
        <Boton onClick={abrirCrear}><Plus size={16} /> Nuevo</Boton>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Nombre', 'Contacto', 'Observaciones', 'Acciones']}
          datos={proveedores || []}
          vacio="Sin proveedores"
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(prov) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{prov.nombre}</p>
              <p className="text-xs text-slate-500 truncate">{prov.contacto || 'Sin contacto'}</p>
            </>
          )}
          renderFila={(prov) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{prov.nombre}</td>
              <td className="py-3 pr-4 text-slate-600 text-sm">{prov.contacto || '—'}</td>
              <td className="py-3 pr-4 text-slate-500 text-xs max-w-xs truncate">{prov.observaciones || '—'}</td>
              <td className="py-3 flex gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(prov)}>
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(prov)}>
                  <Trash2 size={14} />
                </Boton>
              </td>
            </>
          )}
        />
      </Card>

      <Modal abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} titulo={editando ? 'Editar proveedor' : 'Nuevo proveedor'}>
        <form onSubmit={guardar} className="space-y-4">
          <Input
            label="Nombre *"
            value={formulario.nombre}
            onChange={e => actualizar('nombre', e.target.value)}
            required
            placeholder="Ej: Textil del Norte"
          />
          <Input
            label="Contacto"
            value={formulario.contacto}
            onChange={e => actualizar('contacto', e.target.value)}
            placeholder="Teléfono o email"
          />
          <Textarea
            label="Observaciones"
            value={formulario.observaciones}
            onChange={e => actualizar('observaciones', e.target.value)}
            placeholder="Notas adicionales..."
          />
          <div className="flex gap-2 justify-end">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)} disabled={guardando}>Cancelar</Boton>
            <Boton type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Boton>
          </div>
        </form>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmEliminar}
        onCerrar={() => setConfirmEliminar(null)}
        onConfirmar={eliminar}
        mensaje={`¿Eliminar el proveedor "${confirmEliminar?.nombre}"?`}
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
            <DetalleCampo etiqueta="Contacto" valor={detalleMobile.contacto} />
            <DetalleCampo etiqueta="Observaciones" valor={detalleMobile.observaciones} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
