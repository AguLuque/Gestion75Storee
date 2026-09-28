import { useState } from 'react';
import { HandCoins, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { cuentasPorCobrarApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import {
  Boton, Card, Modal, Input, InputPrecio, Select, Textarea,
  Spinner, Tabla, Badge, Drawer, DetalleCampo, ModalConfirmar
} from '../components/ui/index.jsx';
import { formatearPrecio, formatearFechaDia, diaISO, fechaLocalISO } from '../utils.js';

const COLOR_ESTADO = { pendiente: 'amarillo', parcial: 'azul', cobrado: 'verde' };
const ETIQUETA_ESTADO = { pendiente: 'Pendiente', parcial: 'Parcial', cobrado: 'Cobrado' };

const deudaVacia = { cliente_nombre: '', monto: '', fecha_vencimiento: '', observaciones: '' };

// Vencida desde el día siguiente al vencimiento, comparando días (no horas UTC)
function estaVencida(cxc) {
  if (!cxc.fecha_vencimiento || cxc.estado === 'cobrado') return false;
  return diaISO(cxc.fecha_vencimiento) < fechaLocalISO();
}

// Deuda manual: "fiado" cargado a mano (antes Deudores), sin venta atrás.
// Solo esas se editan/anulan acá; las de una venta se manejan desde la venta.
const esManual = (cxc) => !cxc.venta_id;

// Con cobros = ya entró plata (o se migró de Deudores como pagada): el monto
// queda fijo y no se puede anular.
const tieneCobros = (cxc) => Number(cxc.monto_total) - Number(cxc.saldo_pendiente) > 0.005;

// Pendientes: vencimiento más próximo arriba, sin fecha al final.
function ordenarPendientes(lista) {
  return [...lista].sort((a, b) =>
    (diaISO(a.fecha_vencimiento) ?? '9999').localeCompare(diaISO(b.fecha_vencimiento) ?? '9999')
  );
}

// Cobradas: las más recientes primero.
function ordenarCobradas(lista) {
  return [...lista].sort((a, b) => (diaISO(b.fecha_emision) ?? '').localeCompare(diaISO(a.fecha_emision) ?? ''));
}

function BadgeOrigen({ cxc }) {
  return esManual(cxc)
    ? <Badge color="default">Manual</Badge>
    : <Badge color="azul">Venta #{cxc.venta_id}</Badge>;
}

function BadgeEstado({ cxc }) {
  return (
    <Badge color={estaVencida(cxc) ? 'rojo' : COLOR_ESTADO[cxc.estado]}>
      {estaVencida(cxc) ? 'Vencida' : ETIQUETA_ESTADO[cxc.estado]}
    </Badge>
  );
}

export default function CuentasPorCobrar() {
  const { cuentasPorCobrar: cuentas, cuentasDinero, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [pestaña, setPestaña] = useState('pendientes');
  const [cobrando, setCobrando] = useState(null);
  const [monto, setMonto] = useState('');
  const [cuentaDineroId, setCuentaDineroId] = useState('');
  const [detalleMobile, setDetalleMobile] = useState(null);
  // null = cerrado; 'nueva' = alta; un objeto = la deuda que se edita
  const [deudaEditando, setDeudaEditando] = useState(null);
  const [formulario, setFormulario] = useState(deudaVacia);
  const [confirmAnular, setConfirmAnular] = useState(null);

  const todas = cuentas || [];
  const pendientes = ordenarPendientes(todas.filter(c => c.estado !== 'cobrado'));
  const cobradas = ordenarCobradas(todas.filter(c => c.estado === 'cobrado'));
  const totalPendiente = pendientes.reduce((s, c) => s + Number(c.saldo_pendiente), 0);
  const editando = deudaEditando && deudaEditando !== 'nueva' ? deudaEditando : null;

  function abrirCobro(cxc) {
    setCobrando(cxc);
    setMonto(cxc.saldo_pendiente);
    setCuentaDineroId('');
  }

  async function guardarCobro(e) {
    e.preventDefault();
    if (!cuentaDineroId) {
      mostrarToast('Elegí la cuenta que recibe el cobro.', 'error');
      return;
    }
    const resultado = await ejecutar(() => cuentasPorCobrarApi.registrarCobro(cobrando.id, {
      monto: Number(monto),
      cuenta_dinero_id: Number(cuentaDineroId),
    }));
    if (resultado.ok) {
      mostrarToast('Cobro registrado');
      setCobrando(null);
      recargar('cuentasPorCobrar');
      recargar('cuentasDinero');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  function abrirNuevaDeuda() {
    setFormulario(deudaVacia);
    setDeudaEditando('nueva');
  }

  function abrirEditarDeuda(cxc) {
    setFormulario({
      cliente_nombre: cxc.cliente_nombre || '',
      monto: Number(cxc.monto_total),
      fecha_vencimiento: diaISO(cxc.fecha_vencimiento) ?? '',
      observaciones: cxc.observaciones || '',
    });
    setDeudaEditando(cxc);
  }

  function actualizar(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardarDeuda(e) {
    e.preventDefault();
    const datos = {
      cliente_nombre: formulario.cliente_nombre,
      monto: Number(formulario.monto),
      fecha_vencimiento: formulario.fecha_vencimiento || null,
      observaciones: formulario.observaciones,
    };
    const resultado = await ejecutar(() => editando
      ? cuentasPorCobrarApi.actualizar(editando.id, datos)
      : cuentasPorCobrarApi.crear(datos));
    if (resultado.ok) {
      mostrarToast(editando ? 'Deuda actualizada' : 'Deuda registrada');
      setDeudaEditando(null);
      if (!editando) setPestaña('pendientes');
      recargar('cuentasPorCobrar');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function anular() {
    const resultado = await ejecutar(() => cuentasPorCobrarApi.anular(confirmAnular.id));
    if (resultado.ok) {
      mostrarToast('Deuda anulada');
      setConfirmAnular(null);
      recargar('cuentasPorCobrar');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) return <Spinner />;

  const lista = pestaña === 'pendientes' ? pendientes : cobradas;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cuentas por cobrar</h1>
          <p className="text-sm text-slate-500">Total pendiente: {formatearPrecio(totalPendiente)}</p>
        </div>
        <Boton onClick={abrirNuevaDeuda}>
          <Plus size={16} /> Nueva deuda manual
        </Boton>
      </div>

      <div className="flex gap-2">
        <Boton variante={pestaña === 'pendientes' ? 'primario' : 'secundario'} tamaño="sm" onClick={() => setPestaña('pendientes')}>
          Pendientes ({pendientes.length})
        </Boton>
        <Boton variante={pestaña === 'cobradas' ? 'primario' : 'secundario'} tamaño="sm" onClick={() => setPestaña('cobradas')}>
          Cobradas ({cobradas.length})
        </Boton>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Cliente', 'Origen', 'Total', 'Pendiente', 'Vencimiento', 'Estado', 'Acciones']}
          datos={lista}
          vacio={pestaña === 'pendientes'
            ? 'No hay deudas pendientes. Se generan al registrar una venta a crédito o con "Nueva deuda manual".'
            : 'Todavía no hay deudas cobradas.'}
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(c) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{c.cliente_nombre || 'Sin nombre'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <BadgeOrigen cxc={c} />
                <BadgeEstado cxc={c} />
                {c.fecha_vencimiento && <span className="text-xs text-slate-400">{formatearFechaDia(c.fecha_vencimiento)}</span>}
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {formatearPrecio(pestaña === 'pendientes' ? c.saldo_pendiente : c.monto_total)}
              </p>
            </>
          )}
          renderFila={(c) => (
            <>
              <td className="py-3 pr-4 max-w-[14rem]">
                <p className="font-medium text-slate-800 truncate">{c.cliente_nombre || 'Sin nombre'}</p>
                {c.observaciones && <p className="text-xs text-slate-400 truncate" title={c.observaciones}>{c.observaciones}</p>}
              </td>
              <td className="py-3 pr-4"><BadgeOrigen cxc={c} /></td>
              <td className="py-3 pr-4 text-slate-500">{formatearPrecio(c.monto_total)}</td>
              <td className="py-3 pr-4 font-semibold text-slate-800">{formatearPrecio(c.saldo_pendiente)}</td>
              <td className="py-3 pr-4 text-slate-500 text-xs">{c.fecha_vencimiento ? formatearFechaDia(c.fecha_vencimiento) : '—'}</td>
              <td className="py-3 pr-4"><BadgeEstado cxc={c} /></td>
              <td className="py-3">
                <div className="flex items-center gap-1.5">
                  {c.estado !== 'cobrado' && (
                    <Boton variante="secundario" tamaño="sm" onClick={() => abrirCobro(c)}>
                      <HandCoins size={14} /> Cobrar
                    </Boton>
                  )}
                  {esManual(c) && (
                    <Boton variante="fantasma" tamaño="sm" onClick={() => abrirEditarDeuda(c)} title="Editar deuda">
                      <Pencil size={14} />
                    </Boton>
                  )}
                  {esManual(c) && !tieneCobros(c) && (
                    <Boton variante="peligro" tamaño="sm" onClick={() => setConfirmAnular(c)} title="Anular deuda">
                      <Trash2 size={14} />
                    </Boton>
                  )}
                </div>
              </td>
            </>
          )}
        />
      </Card>

      {/* Registrar cobro */}
      <Modal
        abierto={!!cobrando}
        onCerrar={() => setCobrando(null)}
        titulo={`Registrar cobro — ${cobrando?.cliente_nombre || 'Sin nombre'}`}
        className="max-w-md mx-4"
      >
        <form onSubmit={guardarCobro} className="space-y-4">
          <p className="text-xs text-slate-500">
            Saldo pendiente: {cobrando ? formatearPrecio(cobrando.saldo_pendiente) : ''}
          </p>
          <InputPrecio
            label="Monto cobrado *"
            valorInicial={monto}
            onCambio={setMonto}
            required
            placeholder="0"
          />
          <Select
            label="Cuenta que recibe el dinero *"
            value={cuentaDineroId}
            onChange={e => setCuentaDineroId(e.target.value)}
            required
          >
            <option value="">Seleccionar...</option>
            {(cuentasDinero || []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <div className="flex gap-2 justify-end pt-1">
            <Boton variante="secundario" type="button" onClick={() => setCobrando(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Registrando...' : 'Registrar cobro'}
            </Boton>
          </div>
        </form>
      </Modal>

      {/* Alta / edición de deuda manual */}
      <Modal
        abierto={!!deudaEditando}
        onCerrar={() => setDeudaEditando(null)}
        titulo={editando ? 'Editar deuda' : 'Nueva deuda manual'}
        className="max-w-md mx-4"
      >
        <form onSubmit={guardarDeuda} className="space-y-4">
          <p className="text-xs text-slate-500">
            Para mercadería entregada que todavía no se cobró, sin una venta registrada.
          </p>
          <Input
            label="Cliente *"
            value={formulario.cliente_nombre}
            onChange={e => actualizar('cliente_nombre', e.target.value)}
            required
            placeholder="Ej: Juan Pérez"
          />
          {editando && tieneCobros(editando) ? (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="text-slate-700">Monto: <span className="font-semibold">{formatearPrecio(editando.monto_total)}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">
                Ya tiene cobros por {formatearPrecio(Number(editando.monto_total) - Number(editando.saldo_pendiente))}: el monto no se puede cambiar.
              </p>
            </div>
          ) : (
            <InputPrecio
              label="Monto *"
              valorInicial={formulario.monto}
              onCambio={valor => actualizar('monto', valor)}
              required
              placeholder="0"
            />
          )}
          <Input
            label="Vence el (opcional)"
            type="date"
            value={formulario.fecha_vencimiento}
            onChange={e => actualizar('fecha_vencimiento', e.target.value)}
          />
          <Textarea
            label="Observaciones (opcional)"
            value={formulario.observaciones}
            onChange={e => actualizar('observaciones', e.target.value)}
            placeholder="Ej: 2 remeras talle M"
          />
          <div className="flex gap-2 justify-end pt-1">
            <Boton variante="secundario" type="button" onClick={() => setDeudaEditando(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar deuda'}
            </Boton>
          </div>
        </form>
      </Modal>

      <ModalConfirmar
        abierto={!!confirmAnular}
        onCerrar={() => setConfirmAnular(null)}
        onConfirmar={anular}
        mensaje={`¿Anular la deuda de ${confirmAnular?.cliente_nombre || 'Sin nombre'} por ${confirmAnular ? formatearPrecio(confirmAnular.monto_total) : ''}? Deja de figurar en Por cobrar.`}
        cargando={guardando}
      />

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile?.cliente_nombre || 'Sin nombre'}
        footer={detalleMobile && (
          <>
            {detalleMobile.estado !== 'cobrado' && (
              <Boton onClick={() => { setDetalleMobile(null); abrirCobro(detalleMobile); }}>
                <HandCoins size={14} /> Cobrar
              </Boton>
            )}
            {esManual(detalleMobile) && (
              <Boton variante="secundario" onClick={() => { setDetalleMobile(null); abrirEditarDeuda(detalleMobile); }}>
                <Pencil size={14} /> Editar
              </Boton>
            )}
            {esManual(detalleMobile) && !tieneCobros(detalleMobile) && (
              <Boton variante="peligro" onClick={() => { setDetalleMobile(null); setConfirmAnular(detalleMobile); }}>
                <Trash2 size={14} /> Anular
              </Boton>
            )}
          </>
        )}
      >
        {detalleMobile && (
          <div>
            <DetalleCampo etiqueta="Origen" valor={esManual(detalleMobile) ? 'Deuda manual' : `Venta #${detalleMobile.venta_id}`} />
            <DetalleCampo etiqueta="Total" valor={formatearPrecio(detalleMobile.monto_total)} />
            <DetalleCampo etiqueta="Pendiente" valor={formatearPrecio(detalleMobile.saldo_pendiente)} />
            <DetalleCampo etiqueta="Emitida" valor={formatearFechaDia(detalleMobile.fecha_emision)} />
            <DetalleCampo etiqueta="Vencimiento" valor={detalleMobile.fecha_vencimiento ? formatearFechaDia(detalleMobile.fecha_vencimiento) : '—'} />
            <DetalleCampo etiqueta="Estado" valor={ETIQUETA_ESTADO[detalleMobile.estado]} />
            {detalleMobile.observaciones && <DetalleCampo etiqueta="Observaciones" valor={detalleMobile.observaciones} />}
          </div>
        )}
      </Drawer>
    </div>
  );
}
