import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { cuentasPorPagarApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import {
  Boton, Card, Modal, InputPrecio, Select,
  Spinner, Tabla, Badge, Drawer, DetalleCampo
} from '../components/ui/index.jsx';
import { formatearPrecio, formatearFechaDia, diaISO, fechaLocalISO } from '../utils.js';

const COLOR_ESTADO = { pendiente: 'amarillo', parcial: 'azul', pagado: 'verde' };
const ETIQUETA_ESTADO = { pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Pagado' };

// Vencida desde el día siguiente al vencimiento, comparando días (no horas UTC)
function estaVencida(cxp) {
  if (!cxp.fecha_vencimiento || cxp.estado === 'pagado') return false;
  return diaISO(cxp.fecha_vencimiento) < fechaLocalISO();
}

// Primero lo que falta pagar (vencimiento más próximo arriba, sin fecha al
// final), después lo ya pagado. El backend ordena por estado alfabético, que
// pone las pagadas primero.
function ordenarCuentas(lista) {
  return [...lista].sort((a, b) => {
    const cerradaA = a.estado === 'pagado', cerradaB = b.estado === 'pagado';
    if (cerradaA !== cerradaB) return cerradaA ? 1 : -1;
    const vencA = diaISO(a.fecha_vencimiento) ?? '9999', vencB = diaISO(b.fecha_vencimiento) ?? '9999';
    return vencA.localeCompare(vencB);
  });
}

export default function CuentasPorPagar() {
  const { cuentasPorPagar: cuentas, cuentasDinero, proveedores, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [pagando, setPagando] = useState(null);
  const [monto, setMonto] = useState('');
  const [cuentaDineroId, setCuentaDineroId] = useState('');
  const [detalleMobile, setDetalleMobile] = useState(null);

  const activas = (cuentas || []).filter(c => c.estado !== 'pagado');
  const totalPendiente = activas.reduce((s, c) => s + Number(c.saldo_pendiente), 0);

  function nombreProveedor(c) {
    // proveedores.id es bigint (llega como string) y cuentas_por_pagar.proveedor_id
    // es integer (llega como número): comparar como string, si no nunca coincide.
    return (proveedores || []).find(p => String(p.id) === String(c.proveedor_id))?.nombre || 'Sin proveedor';
  }

  function abrirPago(cxp) {
    setPagando(cxp);
    setMonto(cxp.saldo_pendiente);
    setCuentaDineroId('');
  }

  async function guardarPago(e) {
    e.preventDefault();
    if (!cuentaDineroId) {
      mostrarToast('Elegí la cuenta que realiza el pago.', 'error');
      return;
    }
    const resultado = await ejecutar(() => cuentasPorPagarApi.registrarPago(pagando.id, {
      monto: Number(monto),
      cuenta_dinero_id: Number(cuentaDineroId),
    }));
    if (resultado.ok) {
      mostrarToast('Pago registrado');
      setPagando(null);
      recargar('cuentasPorPagar');
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
          <h1 className="text-xl font-bold text-slate-800">Cuentas por pagar</h1>
          <p className="text-sm text-slate-500">Total pendiente: {formatearPrecio(totalPendiente)}</p>
        </div>
      </div>

      <Card className="p-5">
        <Tabla
          columnas={['Proveedor', 'Total', 'Pendiente', 'Vencimiento', 'Estado', 'Acciones']}
          datos={ordenarCuentas(cuentas || [])}
          vacio="Sin cuentas por pagar — se generan automáticamente al registrar una compra a crédito"
          onSeleccionar={setDetalleMobile}
          renderCardMobile={(c) => (
            <>
              <p className="text-sm font-medium text-slate-800 truncate">{nombreProveedor(c)}</p>
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
              <td className="py-3 pr-4 font-medium text-slate-800">{nombreProveedor(c)}</td>
              <td className="py-3 pr-4 text-slate-500">{formatearPrecio(c.monto_total)}</td>
              <td className="py-3 pr-4 font-semibold text-slate-800">{formatearPrecio(c.saldo_pendiente)}</td>
              <td className="py-3 pr-4 text-slate-500 text-xs">{c.fecha_vencimiento ? formatearFechaDia(c.fecha_vencimiento) : '—'}</td>
              <td className="py-3 pr-4">
                <Badge color={estaVencida(c) ? 'rojo' : COLOR_ESTADO[c.estado]}>
                  {estaVencida(c) ? 'Vencida' : ETIQUETA_ESTADO[c.estado]}
                </Badge>
              </td>
              <td className="py-3">
                {c.estado !== 'pagado' && (
                  <Boton variante="secundario" tamaño="sm" onClick={() => abrirPago(c)}>
                    <HandCoins size={14} /> Pagar
                  </Boton>
                )}
              </td>
            </>
          )}
        />
      </Card>

      <Modal
        abierto={!!pagando}
        onCerrar={() => setPagando(null)}
        titulo={`Registrar pago — ${pagando ? nombreProveedor(pagando) : ''}`}
        className="max-w-md mx-4"
      >
        <form onSubmit={guardarPago} className="space-y-4">
          <p className="text-xs text-slate-500">
            Saldo pendiente: {pagando ? formatearPrecio(pagando.saldo_pendiente) : ''}
          </p>
          <InputPrecio
            label="Monto pagado *"
            valorInicial={monto}
            onCambio={setMonto}
            required
            placeholder="0"
          />
          <Select
            label="Cuenta que paga *"
            value={cuentaDineroId}
            onChange={e => setCuentaDineroId(e.target.value)}
            required
          >
            <option value="">Seleccionar...</option>
            {(cuentasDinero || []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <div className="flex gap-2 justify-end pt-1">
            <Boton variante="secundario" type="button" onClick={() => setPagando(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Registrando...' : 'Registrar pago'}
            </Boton>
          </div>
        </form>
      </Modal>

      <Drawer
        abierto={!!detalleMobile}
        onCerrar={() => setDetalleMobile(null)}
        titulo={detalleMobile ? nombreProveedor(detalleMobile) : ''}
        footer={detalleMobile && detalleMobile.estado !== 'pagado' && (
          <Boton onClick={() => { setDetalleMobile(null); abrirPago(detalleMobile); }}>
            <HandCoins size={14} /> Pagar
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
