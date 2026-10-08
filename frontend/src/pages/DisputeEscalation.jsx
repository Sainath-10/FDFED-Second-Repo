/**
 * NEXUS ESPORTS — Dispute Escalation
 *
 * escalation form,
 * prefill of the referenced dispute from the admin dispute store, the ended-comp
 * lock, and updating the dispute to escalated on submit.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/dispute-escalation.css';

const DISPUTE_STORE_KEY = 'nexus_admin_disputes';
const REASONS = ['Admin decision appears biased or unfair', 'New evidence has emerged', 'Admin has not responded within 48 hours', 'Dispute involves platform policy violation', 'Other'];

export default function DisputeEscalation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const disputeId = params.get('id');
  const compId = params.get('compId') || params.get('id');

  const [referenced, setReferenced] = useState('');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [ended, setEnded] = useState(false);

  const existingRef = (() => {
    if (!disputeId) return null;
    try {
      const disputes = JSON.parse(localStorage.getItem(DISPUTE_STORE_KEY) || '[]');
      return disputes.find((item) => item.id === disputeId) || null;
    } catch (e) { return null; }
  })();

  useEffect(() => {
    if (disputeId) setReferenced(disputeId);
  }, [disputeId]);

  useEffect(() => {
    if (!compId || !NexusData) return;
    const comp = NexusData.getCompetitionById(compId);
    if (comp && NexusData.isCompEnded && NexusData.isCompEnded(comp)) {
      NexusData.enforceNotEnded(comp, '#escalation-form button[type="submit"],.btn-primary,.btn-submit');
      setEnded(true);
    }
    return () => {
      const b = document.getElementById('_ended_banner_');
      if (b) b.remove();
      document.body.style.marginTop = '';
    };
  }, [compId]);

  function submit(event) {
    event.preventDefault();
    const selectedId = referenced || disputeId;
    if (!selectedId || !reason || !summary) { showToast('Please fill in all escalation details.', 'error'); return; }
    try {
      const disputes = JSON.parse(localStorage.getItem(DISPUTE_STORE_KEY) || '[]');
      const idx = disputes.findIndex((item) => item.id === selectedId);
      if (idx >= 0) {
        disputes[idx].status = 'escalated';
        disputes[idx].escalated = true;
        disputes[idx].escalationReason = reason;
        disputes[idx].escalationSummary = summary;
        disputes[idx].escalatedAt = new Date().toISOString();
        localStorage.setItem(DISPUTE_STORE_KEY, JSON.stringify(disputes));
      }
    } catch (e) {
      console.error('Failed to update dispute status:', e);
    }
    showToast('Dispute escalated to Dispute Admin successfully!');
    setTimeout(() => navigate('/pages/disputes.html'), 1400);
  }

  return (
    <main className="main-content">
      <Link to="/pages/disputes.html" className="back-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Disputes
      </Link>

      <h1 className="page-title">Escalate Dispute</h1>
      <p className="page-subtitle">Send an unresolved dispute to the Dispute Admin for final review.</p>

      <div className="layout-grid">
        <div className="form-card">
          <form id="escalation-form" className="escalation-form" onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Dispute Reference</label>
              <select className="form-select" value={referenced} onChange={(e) => setReferenced(e.target.value)} disabled={ended}>
                <option value="">Select existing dispute…</option>
                <option value="041">#DISP-2026-0041 — CS2 QF Match Result (Investigating)</option>
                <option value="038">#DISP-2026-0038 — Valorant Late Forfeit (Pending)</option>
                {existingRef && !['041', '038'].includes(existingRef.id) && (
                  <option value={existingRef.id}>{`#${existingRef.id} — ${existingRef.title}`}</option>
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Escalation Reason</label>
              <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)} disabled={ended}>
                <option value="">Select reason…</option>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Summary of Escalation</label>
              <textarea className="form-textarea form-textarea-tall" placeholder="Briefly explain why this dispute needs Dispute Admin review. Include any new information not covered in the original dispute." value={summary} onChange={(e) => setSummary(e.target.value)} disabled={ended} />
            </div>

            <div className="form-group">
              <label className="form-label">Additional Evidence (optional)</label>
              <div className="evidence-upload" onClick={() => document.getElementById('evidence-file')?.click()}>
                <div className="upload-icon-large">📎</div>
                <div className="upload-text-small">
                  <span className="accent-bold">Upload files</span> — screenshots, videos, logs<br />
                  Max 50MB per file
                </div>
                <input type="file" id="evidence-file" multiple style={{ display: 'none' }} disabled={ended} />
              </div>
            </div>

            <div className="warning-box">
              <p className="warning-text">
                ⚠️ <strong>Important:</strong> Dispute Admin escalations are reserved for serious unresolved matters. Frivolous escalations may result in account restrictions. Dispute Admins typically respond within 72 hours.
              </p>
            </div>

            <button type="submit" className="btn-auth-submit" style={{ fontSize: 16 }} disabled={ended}>Send to Dispute Admin</button>
          </form>
        </div>

        <div className="sidebar-stack">
          <div className="comp-sidebar-block">
            <h3>Escalation Guidelines</h3>
            <div className="guidelines-list">
              <p>✅ Only escalate if the admin response is unsatisfactory or delayed 48h+.</p>
              <p>✅ Include all relevant evidence upfront to speed up resolution.</p>
              <p>✅ Be specific — Dispute Admins review dozens of cases daily.</p>
              <p>❌ Do not escalate the same dispute twice without new evidence.</p>
              <p>❌ Personal grievances or ranking disputes are not grounds for escalation.</p>
            </div>
          </div>
          <div className="comp-sidebar-block">
            <h3>Response Times</h3>
            <div className="info-row"><span className="key">Admin Review</span><span className="val">24–48h</span></div>
            <div className="info-row"><span className="key">Dispute Admin</span><span className="val">48–72h</span></div>
            <div className="info-row"><span className="key">Final Decision</span><span className="val">Binding</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}


