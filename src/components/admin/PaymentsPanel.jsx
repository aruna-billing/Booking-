import { useState } from 'react';
import { Badge } from '../ui/misc.jsx';
import { Button } from '../ui/Button.jsx';
import { ConfirmDialog } from './parts.jsx';
import { formatMoney } from '../../lib/format.js';
import { formatShortDate } from '../../lib/date.js';
import {
  COLLECTION_STATUS,
  PAYMENT_CONCEPTS,
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUS,
  balanceDue,
  balanceDueDate,
  collectionStatus,
  isOverdue,
  paidAmount,
  pendingAmount,
} from '../../lib/finance.js';
import * as api from '../../services/api.js';

export const CollectionBadge = ({ request }) => {
  const s = COLLECTION_STATUS[collectionStatus(request)];
  return <Badge tone={s.tone}>{s.label}</Badge>;
};

/** Barra de progreso de cobro: pagado sobre total. */
export function PaidBar({ request: r, compact = false }) {
  const paid = paidAmount(r);
  const pct = r.quote.total ? Math.min(100, Math.round((paid / r.quote.total) * 100)) : 0;
  const depPct = r.quote.total ? Math.round((r.quote.deposit / r.quote.total) * 100) : 0;
  return (
    <div className={`paidbar ${compact ? 'paidbar--compact' : ''}`}>
      <div
        className="paidbar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Pagado ${pct} % del total`}
      >
        <span className="paidbar__fill" style={{ width: `${pct}%` }} />
        <span className="paidbar__mark" style={{ left: `${depPct}%` }} title={`Anticipo (${r.quote.depositPercent} %)`} />
      </div>
      {!compact && (
        <p className="paidbar__legend small">
          <span>{pct} % cobrado</span>
          <span className="muted">Marca: anticipo {r.quote.depositPercent} %</span>
        </p>
      )}
    </div>
  );
}

export function PaymentsPanel({ request: r, onAdd, toast }) {
  const [voiding, setVoiding] = useState(null);
  const cur = r.currency;
  const due = balanceDue(r);
  const overdue = isOverdue(r);
  const list = [...(r.payments ?? [])].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  return (
    <div className="payments">
      <div className="payments__head">
        <CollectionBadge request={r} />
        {r.status !== 'cancelled' && (
          <Button size="sm" onClick={onAdd} disabled={due === 0} data-testid="add-payment">
            + Agregar pago
          </Button>
        )}
      </div>
      <dl className="payments__facts">
        <div><dt>Total</dt><dd>{formatMoney(r.quote.total, cur)}</dd></div>
        <div><dt>Pagado</dt><dd data-testid="paid-amount">{formatMoney(paidAmount(r), cur)}</dd></div>
        <div className={due > 0 ? 'is-due' : ''}>
          <dt>Falta por pagar</dt>
          <dd data-testid="due-amount">{formatMoney(due, cur)}</dd>
        </div>
      </dl>
      <PaidBar request={r} />
      {due > 0 && r.status !== 'cancelled' && (
        <p className={`small ${overdue ? 'warn' : 'muted'}`}>
          {overdue ? 'Saldo vencido desde el ' : 'El saldo vence el '}
          {formatShortDate(balanceDueDate(r))} (día de la sesión).
        </p>
      )}
      {pendingAmount(r) > 0 && (
        <p className="callout">
          Hay {formatMoney(pendingAmount(r), cur)} por verificar. No cuentan como recibidos hasta que se verifiquen.
        </p>
      )}

      {list.length === 0 ? (
        <p className="muted small">Aún no hay pagos registrados.</p>
      ) : (
        <ul className="paylist" aria-label="Pagos registrados">
          {list.map((p) => {
            const st = PAYMENT_RECORD_STATUS[p.status];
            return (
              <li key={p.id} className={`paylist__item is-${p.status}`}>
                <div className="paylist__main">
                  <strong className="num">{formatMoney(p.amount, cur)}</strong>
                  <span className="muted small">
                    {PAYMENT_CONCEPTS[p.concept] ?? 'Pago'} · {PAYMENT_METHODS[p.method] ?? p.method} · {formatShortDate(p.date)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  {p.note && <span className="small">{p.note}</span>}
                  {p.voidReason && <span className="small muted">Anulado: {p.voidReason}</span>}
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
                {p.status === 'verified' && (
                  <button type="button" className="link-btn small paylist__void" onClick={() => setVoiding(p)}>
                    Anular
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Anular pago"
        message={voiding ? `Se anulará el pago de ${formatMoney(voiding.amount, cur)} y dejará de contar como recibido. Queda en el historial.` : ''}
        reasonLabel="Motivo"
        reasonRequired
        presets={['Registrado por error', 'Monto equivocado', 'Pago devuelto']}
        confirmLabel="Anular pago"
        danger
        onConfirm={(reason) => api.voidPayment(r.id, voiding.id, reason).then(() => toast?.('Pago anulado', 'red'))}
      />
    </div>
  );
}
