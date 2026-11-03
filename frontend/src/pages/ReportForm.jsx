/**
 * NEXUS ESPORTS — Report form
 *
 * Context-aware: the target, competition and match come from the page the user
 * clicked (never typed by hand). Reporter identity, team IDs, priority and
 * routing are attached by the backend.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ReportsAPI } from '../services/api.js';
import { reasonsFor, capitalise } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export default function ReportForm() {
  const [params] = useSearchParams();
  const compId = params.get('compId') || '';
  const against = params.get('against') || '';
  const targetRole = params.get('role') || 'player';
  const matchId = params.get('matchId') || '';
  const source = params.get('source') || 'report-button';

  const [reasonCode, setReasonCode] = useState('cheating');
  const [description, setDescription] = useState('');
  const [incidentAt, setIncidentAt] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [restriction, setRestriction] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const reasons = useMemo(() => reasonsFor(targetRole === 'organiser' ? 'organiser' : 'participant'), [targetRole]);

  useEffect(() => {
    if (!reasons.some((r) => r.code === reasonCode)) setReasonCode(reasons[0]?.code || 'other');
  }, [reasons, reasonCode]);

  useEffect(() => {
    if (!compId) return;
    ReportsAPI.restrictions(compId)
      .then((res) => { if (res.ok && res.data) setRestriction(res.data); })
      .catch(() => undefined);
  }, [compId]);

  function addFiles(event) {
    const files = Array.from(event.target.files || []);
    const accepted = [];
    for (const file of files) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        showToast(`${file.name}: only PNG/JPEG/WEBP images are accepted.`, 'error');
        continue;
      }
      if (file.size > MAX_BYTES) {
        showToast(`${file.name} is larger than 5 MB.`, 'error');
        continue;
      }
      accepted.push(file);
    }
    const next = [...evidence, ...accepted].slice(0, MAX_FILES);
    if (evidence.length + accepted.length > MAX_FILES) showToast(`Attach at most ${MAX_FILES} files.`, 'error');
    setEvidence(next);
    event.target.value = '';
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!compId || !against) {
      setError('This form must be opened from a Report button so the competition and the reported person are known.');
      return;
    }
    if (description.trim().length < 15) {
      setError('Describe what happened (at least 15 characters).');
      return;
    }
    setBusy(true);
    try {
      const payload = [];
      for (const file of evidence) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        payload.push({ url: dataUrl, filename: file.name, mimetype: file.type, size: file.size });
      }
      const res = await ReportsAPI.create({
        competitionId: compId,
        reportedUsername: against,
        reasonCode,
        description: description.trim(),
        matchId: matchId || undefined,
        incidentAt: incidentAt ? new Date(incidentAt).toISOString() : undefined,
        sourcePage: source,
        evidence: payload,
      });
      if (!res.ok) {
        setError(res.error || 'Unable to submit this report.');
        return;
      }
      setSubmitted(res.data);
      showToast('Report submitted. A report is an allegation — a reviewer will look into it.', 'success');
    } catch (err) {
      setError(err?.message || 'Unable to submit this report.');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main className="main-content reports-page">
        <div className="report-inline-ok">
          Report {submitted.code} submitted. It was routed to{' '}
          {submitted.queue === 'moderator' ? 'the Community Moderator' : 'the competition organiser'}.
        </div>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          No punishment is applied automatically. You can follow the status and any case discussion from My Reports.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link className="report-btn primary" to="/pages/my-reports.html">My reports</Link>
          <Link className="report-btn" to={`/pages/comp-info.html?id=${compId}`}>Back to competition</Link>
        </div>
      </main>
    );
  }

  const locked = restriction?.restricted;

  return (
    <main className="main-content reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">Report a problem</h1>
          <p className="reports-subtitle">
            Reports are allegations, not proof. The backend decides the priority and the reviewer — you never
            choose who judges the case.
          </p>
        </div>
        <Link className="report-btn" to="/pages/my-reports.html">My reports</Link>
      </div>

      {locked && (
        <div className="report-inline-error">
          You have reached the limit of 3 baseless reports in this competition, so reporting is locked here.
          The restriction is per competition and cannot be reset by rejoining a team.
        </div>
      )}

      <form onSubmit={submit} style={{ maxWidth: 720 }}>
        {error && <div className="report-inline-error">{error}</div>}

        <div className="report-form-grid">
          <div className="report-field">
            <label>Against</label>
            <input value={against ? `@${against}` : ''} readOnly disabled />
            <span className="hint">Filled in automatically from the page you reported from.</span>
          </div>
          <div className="report-field">
            <label>Report type</label>
            <input value={capitalise(targetRole)} readOnly disabled />
            <span className="hint">Determined by the reported person's role in this competition.</span>
          </div>
        </div>

        <div className="report-field">
          <label htmlFor="reason">Reason</label>
          <select id="reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            {reasons.map((reason) => (
              <option key={reason.code} value={reason.code}>{reason.label}</option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="description">What happened?</label>
          <textarea
            id="description"
            rows={6}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Include what you saw, when it happened, and any relevant match or team context."
          />
          <span className="hint">{description.trim().length}/15 characters minimum</span>
        </div>

        <div className="report-form-grid">
          <div className="report-field">
            <label htmlFor="incident">Incident date/time <span className="hint">Optional</span></label>
            <input id="incident" type="datetime-local" value={incidentAt} onChange={(e) => setIncidentAt(e.target.value)} />
          </div>
          <div className="report-field">
            <label htmlFor="evidence">Evidence <span className="hint">Optional, up to 5 images (5 MB each)</span></label>
            <input id="evidence" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addFiles} />
          </div>
        </div>

        {evidence.length > 0 && (
          <div className="evidence-list">
            {evidence.map((file, index) => (
              <span className="evidence-item" key={`${file.name}-${index}`}>
                {file.name}
                <button
                  type="button"
                  className="report-btn ghost"
                  style={{ padding: '2px 6px' }}
                  onClick={() => setEvidence(evidence.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="report-modal-actions" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
          <button type="submit" className="report-btn primary" disabled={busy || locked}>
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
          <button
            type="button"
            className="report-btn ghost"
            onClick={() => { setDescription(''); setEvidence([]); setIncidentAt(''); setError(''); }}
          >
            Discard
          </button>
        </div>
      </form>
    </main>
  );
}
