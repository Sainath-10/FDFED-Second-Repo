/**
 * NEXUS ESPORTS — mock email inbox. Shows the lifecycle emails the platform
 * would send (registration confirmations, refunds, payouts, reminders…).
 * Nothing is delivered; these are ledger-backed previews.
 */
import { useCallback, useEffect, useState } from 'react';
import { paymentRequest, formatDateTime } from '../services/payments.js';
import { Pill } from './PaymentUI.jsx';

export default function PaymentMailbox({ title = 'Mock email inbox', allRecipients = false, showAlerts = true, refreshKey = 0, competitionId }) {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const mail = await paymentRequest('/mail');
      const scoped = competitionId ? mail.filter((m) => m.competitionId === competitionId) : mail;
      setItems(scoped);
      setSelected((current) => scoped.find((m) => m.id === current?.id) || scoped[0] || null);
      setError('');
    } catch (err) { setError(err.message); setItems([]); }
  }, [competitionId]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);
  useEffect(() => {
    if (!showAlerts) return;
    paymentRequest('/subscriptions').then((r) => setAlerts(!!r.enabled)).catch(() => setAlerts(null));
  }, [showAlerts]);

  async function toggleAlerts() {
    setSaving(true);
    try { const r = await paymentRequest('/subscriptions', 'POST', { enabled: !alerts }); setAlerts(r.enabled); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <section className="table-container-card" aria-labelledby="mailbox-title">
      <div className="table-header-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="table-title-md" id="mailbox-title" style={{ margin: 0 }}>{title}</h2>
          <p className="pay-card-text" style={{ marginTop: 4, fontSize: 12.5 }}>Previews of the emails the platform would send. No email is delivered in mock mode.</p>
        </div>
        <div className="pay-actions">
          {showAlerts && alerts !== null && (
            <label className="pay-check" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={alerts} disabled={saving} onChange={toggleAlerts} />
              New competition alerts
            </label>
          )}
          <button type="button" className="pay-btn ghost sm" onClick={refresh}>Refresh</button>
        </div>
      </div>
      {error && <div className="pay-notice error" role="alert" style={{ margin: 16 }}>{error}</div>}
      {items === null && <div className="pay-empty">Loading inbox…</div>}
      {items?.length === 0 && !error && <div className="pay-empty">No emails yet. Payments, refunds and payouts will appear here.</div>}
      {items?.length > 0 && (
        <div className="pay-mail">
          <ul className="pay-mail-list" aria-label="Emails">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="pay-mail-item" aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => setSelected(item)}>
                  <div className="pay-mail-subject">{item.subject}</div>
                  <div className="pay-mail-meta">{allRecipients ? `To @${item.username} · ` : ''}{formatDateTime(item.createdAt)}</div>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <article className="pay-mail-reader" aria-live="polite">
              <h3>{selected.subject}</h3>
              <div className="pay-header-meta" style={{ marginTop: 0 }}>
                <span className="pay-card-text" style={{ fontSize: 12.5 }}>From noreply@nexus.gg · To @{selected.username} · {formatDateTime(selected.createdAt)}</span>
                <Pill tone="accent">Simulated · not sent</Pill>
              </div>
              <pre className="pay-mail-body">{selected.body}</pre>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
