import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { cuentasPorCobrarApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import {
  Boton, Card, Modal, InputPrecio, Select,
  Spinner, Tabla, Badge, Drawer, DetalleCampo
} from '../components/ui/index.jsx';
import { formatearPrecio, formatearFechaDia, diaISO, fechaLocalISO } from '../utils.js';

const COLOR_ESTADO = { pendiente: 'amarillo', parcial: 'azul', cobrado: 'verde' };
const ETIQUETA_ESTADO = { pendiente: 'Pendiente', parcial: 'Parcial', cobrado: 'Cobrado' };

// Vencida desde el día siguiente al vencimiento, comparando días (no horas UTC)
function estaVencida(cxc) {
  if (!cxc.fecha_vencimiento || cxc.estado === 'cobrado') return false;
  return diaISO(cxc.fecha_vencimiento) < fechaLocalISO();
}

// Primero lo que falta cobrar (vencimiento más próximo arriba, sin fecha al
// final), después lo ya cobrado. El backend ordena por estado alfabético, que
// pone las cobradas primero.
function ordenarCuentas(lista) {
  return [...lista].sort((a, b) => {
    const cerradaA = a.estado === 'cobrado', cerradaB = b.estado === 'cobrado';
    if (cerradaA !== cerradaB) return cerradaA ? 1 : -1;
    const vencA = diaISO(a.fecha_vencimiento) ?? '9999', vencB = diaISO(b.fecha_vencimiento) ?? '9999';
    return vencA.localeCompare(vencB);
  });
}

export default function CuentasPorCobrar() {
  const { cuentasPorCobrar: cuentas, cuentasDinero, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [cobrando, setCobrando] = useState(null);
  const [monto, setMonto] = useState('');
  const [cuentaDineroId, setCuentaDineroId] = useState('');
  const [detalleMobile, setDetalleMobile] = useState(null);

  const activas = (cuentas || []).filter(c => c.estado !== 'cobrado');
  const totalPendiente = activas.reduce((s, c) => s + Number(c.saldo_pendiente), 0);

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

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cuentas por cobrar</h1>
          <p className="text-sm text-slate-500">Total pendiente: {formatearPrecio(totalPendiente)}</p>
        </div>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Cliente', 'Total', 'Pendiente', 'Vencimiento', 'Estado', 'Acciones']}
          datos={ordenarCuentas(cuentas || [])}
          vacio="Sin cuentas por cobrar — se generan automáticamente al registrar una venta a crédito"
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(c) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{c.cliente_nombre || 'Sin nombre'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color={estaVencida(c) ? 'rojo' : COLOR_ESTADO[c.estado]}>
                  {estaVencida(c) ? 'Vencida' : ETIQUETA_ESTADO[c.estado]}
                </Badge>
                {c.fecha_vencimiento && <span className="text-xs text-slate-400">{formatearFechaDia(c.fecha_vencimiento)}</span>}
              </div>
              <p className="text-sm font-semibold text-slate-800">{formatearPrecio(c.saldo_pendiente)}</p>
            </>
          )}
          renderFila={(c) => (
            <>
              <td className="py-3 pr-4 font-medium text-slate-800">{c.cliente_nombre || 'Sin nombre'}</td>
              <td className="py-3 pr-4 text-slate-500">{formatearPrecio(c.monto_total)}</td>
              <td className="py-3 pr-4 font-semibold text-slate-800">{formatearPrecio(c.saldo_pendiente)}</td>
              <td className="py-3 pr-4 text-slate-500 text-xs">{c.fecha_vencimiento ? formatearFechaDia(c.fecha_vencimiento) : '—'}</td>
              <td className="py-3 pr-4">
                <Badge color={estaVencida(c) ? 'rojo' : COLOR_ESTADO[c.estado]}>
                  {estaVencida(c) ? 'Vencida' : ETIQUETA_ESTADO[c.estado]}
                </Badge>
              </td>
              <td className="py-3">
                {c.estado !== 'cobrado' && (
                  <Boton variante="secundario" tamaño="sm" onClick={() => abrirCobro(c)}>
                    <HandCoins size={14} /> Cobrar
                  </Boton>
                )}
              </td>
            </>
          )}
        />
      </Card>

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

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile?.cliente_nombre || 'Sin nombre'}
        footer={detalleMobile && detalleMobile.estado !== 'cobrado' && (
          <Boton onClick={() => { setDetalleMobile(null); abrirCobro(detalleMobile); }}>
            <HandCoins size={14} /> Cobrar
          </Boton>
        )}
      >
        {detalleMobile && (
          <div>
            <DetalleCampo etiqueta="Total" valor={formatearPrecio(detalleMobile.monto_total)} />
            <DetalleCampo etiqueta="Pendiente" valor={formatearPrecio(detalleMobile.saldo_pendiente)} />
            <DetalleCampo etiqueta="Emitida" valor={formatearFechaDia(detalleMobile.fecha_emision)} />
            <DetalleCampo etiqueta="Vencimiento" valor={detalleMobile.fecha_vencimiento ? formatearFechaDia(detalleMobile.fecha_vencimiento) : '—'} />
            <DetalleCampo etiqueta="Estado" valor={ETIQUETA_ESTADO[detalleMobile.estado]} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
