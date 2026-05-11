import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { categoriasApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { Boton, Card, Modal, Input, Spinner, Tabla, ModalConfirmar } from '../components/ui/index.jsx';

export default function Categorias() {
  const { categorias, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [nombre, setNombre] = useState('');
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  function abrirCrear() {
    setEditando(null);
    setNombre('');
    setModalAbierto(true);
  }

  function abrirEditar(cat) {
    setEditando(cat);
    setNombre(cat.nombre);
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const accion = editando
      ? () => categoriasApi.actualizar(editando.id, { nombre })
      : () => categoriasApi.crear({ nombre });

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(editando ? 'Categoría actualizada' : 'Categoría creada');
      setModalAbierto(false);
      recargar('categorias');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => categoriasApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Categoría eliminada');
      setConfirmEliminar(null);
      recargar('categorias');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Categorías</h1>
          <p className="text-sm text-slate-500">{categorias?.length || 0} categorías</p>
        </div>
        <Boton onClick={abrirCrear}><Plus size={16} /> Nueva</Boton>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Nombre', 'Acciones']}
          datos={categorias || []}
          vacio="Sin categorías"
          renderFila={(cat) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{cat.nombre}</td>
              <td className="py-3 flex gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(cat)}>
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(cat)}>
                  <Trash2 size={14} />
                </Boton>
              </td>
            </>
          )}
        />
      </Card>

      <Modal abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} titulo={editando ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={guardar} className="space-y-4">
          <Input
            label="Nombre *"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            placeholder="Ej: Zapatillas"
            autoFocus
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
        mensaje={`¿Eliminar la categoría "${confirmEliminar?.nombre}"?`}
        cargando={guardando}
      />
    </div>
  );
}
