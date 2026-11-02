/**
 * NEXUS ESPORTS — Player entry fee checkout
 *
 * Shown to a player after the team lead accepts their join request, in
 * competitions where each player pays. Paying is what puts them on the roster.
 */
export default function PlayerFeeModal({ compName, teamName, feeAmount, busy, onCancel, onConfirm }) {
  return (
    <div id="player-checkout-modal" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0f172a', border: '1px solid #60a5fa', borderRadius: 16, width: 'min(90vw,460px)', padding: 32, boxShadow: '0 20px 60px #000a' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 20, color: '#f1f5f9' }}>👤 Player Participation Fee</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>
          {teamName ? `The lead of "${teamName}" accepted your request. ` : ''}Pay the entry fee{compName ? ` for "${compName}"` : ''} to join the team.
        </p>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#cbd5e1' }}>
            <span>Participation Fee Model:</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>Per Player (Individual Entry)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#f1f5f9', borderTop: '1px dashed rgba(96,165,250,0.3)', paddingTop: 10 }}>
            <strong>Total Player Entry Fee:</strong>
            <strong style={{ color: '#60a5fa', fontSize: 20 }}>₹{Number(feeAmount || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: 12, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button id="player-fee-confirm" onClick={onConfirm} disabled={busy} style={{ flex: 2, padding: 12, background: '#60a5fa', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {busy ? 'Processing…' : `✔ Pay ₹${Number(feeAmount || 0).toLocaleString('en-IN')} & Join Team`}
          </button>
        </div>
      </div>
    </div>
  );
}
