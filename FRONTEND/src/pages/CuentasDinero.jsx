import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { cuentasDineroApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import {
  Boton, Card, Modal, Input, InputPrecio, Select,
  Spinner, Tabla, ModalConfirmar, Badge, Drawer, DetalleCampo
} from '../components/ui/index.jsx';
import { formatearPrecio } from '../utils.js';

const TIPOS_CUENTA = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'banco', etiqueta: 'Banco' },
  { valor: 'billetera_virtual', etiqueta: 'Billetera virtual' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const COLOR_TIPO = { efectivo: 'verde', banco: 'azul', billetera_virtual: 'violeta', otro: 'default' };

const formularioVacio = { nombre: '', tipo: 'efectivo', saldo_inicial: '' };
const ajusteVacio = { tipo: 'ingreso', monto: '', descripcion: '' };

export default function CuentasDinero() {
  const { cuentasDinero: cuentas, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [saldos, setSaldos] = useState({});
  const [cargandoSaldos, setCargandoSaldos] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [detalleMobile, setDetalleMobile] = useState(null);
  const [cuentaAjustando, setCuentaAjustando] = useState(null);
  const [ajuste, setAjuste] = useState(ajusteVacio);

  const cargarSaldos = useCallback(async () => {
    if (!cuentas?.length) { setSaldos({}); return; }
    setCargandoSaldos(true);
    const resultados = await Promise.allSettled(
      cuentas.map(c => cuentasDineroApi.obtenerSaldo(c.id))
    );
    const mapa = {};
    resultados.forEach((r, i) => {
      mapa[cuentas[i].id] = r.status === 'fulfilled' ? Number(r.value?.saldo ?? 0) : null;
    });
    setSaldos(mapa);
    setCargandoSaldos(false);
  }, [cuentas]);

  useEffect(() => { cargarSaldos(); }, [cargarSaldos]);

  function abrirCrear() {
    setCuentaEditando(null);
    setFormulario(formularioVacio);
    setModalAbierto(true);
  }

  function abrirEditar(cuenta) {
    setCuentaEditando(cuenta);
    setFormulario({ nombre: cuenta.nombre, tipo: cuenta.tipo, saldo_inicial: cuenta.saldo_inicial });
    setModalAbierto(true);
  }

  function actualizar(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e) {
    e.preventDefault();
    const datos = { nombre: formulario.nombre, tipo: formulario.tipo, saldo_inicial: Number(formulario.saldo_inicial) || 0 };
    const accion = cuentaEditando
      ? () => cuentasDineroApi.actualizar(cuentaEditando.id, { nombre: datos.nombre, tipo: datos.tipo })
      : () => cuentasDineroApi.crear(datos);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(cuentaEditando ? 'Cuenta actualizada' : 'Cuenta creada');
      setModalAbierto(false);
      recargar('cuentasDinero');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => cuentasDineroApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Cuenta eliminada');
      setConfirmEliminar(null);
      recargar('cuentasDinero');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function guardarAjuste(e) {
    e.preventDefault();
    const resultado = await ejecutar(() => cuentasDineroApi.ajustar(cuentaAjustando.id, {
      tipo: ajuste.tipo,
      monto: Number(ajuste.monto) || 0,
      descripcion: ajuste.descripcion || null,
    }));
    if (resultado.ok) {
      mostrarToast('Ajuste registrado');
      setCuentaAjustando(null);
      setAjuste(ajusteVacio);
      cargarSaldos();
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  const totalDisponible = Object.values(saldos).reduce((s, v) => s + (Number(v) || 0), 0);
  const algunSaldoFallo = Object.values(saldos).some(v => v === null);

  // undefined = todavía cargando; null = falló la consulta de ese saldo
  function mostrarSaldo(id) {
    if (saldos[id] === undefined) return '...';
    if (saldos[id] === null) return 'Error al cargar';
    return formatearPrecio(saldos[id]);
  }

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cuentas de dinero</h1>
          <p className="text-sm text-slate-500">
            Disponible total: {cargandoSaldos ? '...' : formatearPrecio(totalDisponible)}
            {!cargandoSaldos && algunSaldoFallo && <span className="text-red-500"> (sin contar cuentas con error)</span>}
          </p>
        </div>
        <Boton onClick={abrirCrear}>
          <Plus size={16} /> Nueva cuenta
        </Boton>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Nombre', 'Tipo', 'Saldo', 'Acciones']}
          datos={cuentas || []}
          vacio="Todavía no tenés cuentas de dinero cargadas (Caja, Banco, Mercado Pago, etc.)"
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(c) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{c.nombre}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color={COLOR_TIPO[c.tipo]}>{TIPOS_CUENTA.find(t => t.valor === c.tipo)?.etiqueta || c.tipo}</Badge>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {mostrarSaldo(c.id)}
              </p>
            </>
          )}
          renderFila={(c) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{c.nombre}</td>
              <td className="py-3 pr-4">
                <Badge color={COLOR_TIPO[c.tipo]}>{TIPOS_CUENTA.find(t => t.valor === c.tipo)?.etiqueta || c.tipo}</Badge>
              </td>
              <td className="py-3 pr-4 font-semibold text-slate-800">
                {mostrarSaldo(c.id)}
              </td>
              <td className="py-3 flex items-center gap-1.5">
                <Boton variante="fantasma" tamaño="sm" onClick={() => setCuentaAjustando(c)} title="Ajuste manual">
                  <SlidersHorizontal size={14} />
                </Boton>
                <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditar(c)}>
                  <Pencil size={14} />
                </Boton>
                <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmEliminar(c)}>
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
        titulo={cuentaEditando ? 'Editar cuenta' : 'Nueva cuenta de dinero'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <Input
            label="Nombre *"
            value={formulario.nombre}
            onChange={e => actualizar('nombre', e.target.value)}
            required
            placeholder="Ej: Naranja X, Caja, Banco Galicia"
          />
          <Select
            label="Tipo *"
            value={formulario.tipo}
            onChange={e => actualizar('tipo', e.target.value)}
          >
            {TIPOS_CUENTA.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </Select>
          {!cuentaEditando && (
            <InputPrecio
              label="Saldo inicial (lo que ya tenés hoy en esta cuenta)"
              valorInicial={formulario.saldo_inicial}
              onCambio={valor => actualizar('saldo_inicial', valor)}
              placeholder="0"
            />
          )}
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

      <Modal
        abierto={!!cuentaAjustando}
        onCerrar={() => { setCuentaAjustando(null); setAjuste(ajusteVacio); }}
        titulo={`Ajuste manual — ${cuentaAjustando?.nombre || ''}`}
        className="max-w-md mx-4"
      >
        <form onSubmit={guardarAjuste} className="space-y-4">
          <p className="text-xs text-slate-500">
            Usalo solo si el saldo calculado no coincide con la realidad (por ejemplo, un gasto que pagaste con esta cuenta y no registraste en el sistema).
          </p>
          <Select
            label="Tipo *"
            value={ajuste.tipo}
            onChange={e => setAjuste(prev => ({ ...prev, tipo: e.target.value }))}
          >
            <option value="ingreso">Ingreso (tengo más de lo calculado)</option>
            <option value="egreso">Egreso (tengo menos de lo calculado)</option>
          </Select>
          <InputPrecio
            label="Monto *"
            valorInicial={ajuste.monto}
            onCambio={valor => setAjuste(prev => ({ ...prev, monto: valor }))}
            required
            placeholder="0"
          />
          <Input
            label="Motivo (opcional)"
            value={ajuste.descripcion}
            onChange={e => setAjuste(prev => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Ej: gasto pagado fuera del sistema"
          />
          <div className="flex gap-2 justify-end pt-1">
            <Boton variante="secundario" type="button" onClick={() => { setCuentaAjustando(null); setAjuste(ajusteVacio); }} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Registrar ajuste'}
            </Boton>
          </div>
        </form>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmEliminar}
        onCerrar={() => setConfirmEliminar(null)}
        onConfirmar={eliminar}
        mensaje={`¿Eliminar la cuenta "${confirmEliminar?.nombre}"?`}
        cargando={guardando}
      />

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile?.nombre}
        footer={detalleMobile && (
          <>
            <Boton variante="secundario" onClick={() => { setDetalleMobile(null); setCuentaAjustando(detalleMobile); }}>
              <SlidersHorizontal size={14} /> Ajustar
            </Boton>
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
            <DetalleCampo etiqueta="Tipo" valor={TIPOS_CUENTA.find(t => t.valor === detalleMobile.tipo)?.etiqueta} />
            <DetalleCampo etiqueta="Saldo" valor={mostrarSaldo(detalleMobile.id)} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
