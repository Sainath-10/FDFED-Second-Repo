/**
 * NEXUS ESPORTS — Report form
 *
 * Context-aware: the target, competition and match come from the page the user
 * clicked (never typed by hand). Reporter identity, team IDs, priority and
 * routing are attached by the backend.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI, prepareEvidenceFile } from '../services/local/reporting.js';
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
  const originalReportId = params.get('originalReportId') || '';
  const [originalReport, setOriginalReport] = useState(null);

  const [reasonCode, setReasonCode] = useState('cheating');
  const [description, setDescription] = useState('');
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
    if (!originalReportId) return;
    ReportsAPI.mine()
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) {
          setOriginalReport(res.data.find((row) => String(row.id) === originalReportId) || null);
        }
      })
      .catch(() => undefined);
  }, [originalReportId]);

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
        payload.push(await prepareEvidenceFile(file));
      }
      const res = await ReportsAPI.create({
        competitionId: compId,
        reportedUsername: against,
        reasonCode,
        description: description.trim(),
        matchId: matchId || undefined,
        sourcePage: source,
        originalReportId: originalReportId || undefined,
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
          No punishment is applied automatically. You can follow the status and any case discussion from Reports.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link className="report-btn primary" to="/pages/my-reports.html">Reports</Link>
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
        <Link className="report-btn" to="/pages/my-reports.html">Reports</Link>
      </div>

      {locked && (
        <div className="report-inline-error">
          You have reached the limit of 3 baseless reports in this competition, so reporting is locked here.
          The restriction is per competition and cannot be reset by rejoining a team.
        </div>
      )}

      {originalReportId && (
        <div className="report-context-card">
          <div className="report-context-head">Complaint about an organiser decision</div>
          {originalReport ? (
            <>
              <div className="report-context-row"><span>Original report</span><strong>{originalReport.code}</strong></div>
              <div className="report-context-row"><span>Decision</span><strong>{capitalise(originalReport.finding)} · {capitalise(originalReport.action)}</strong></div>
              <div className="report-context-row"><span>Recorded by</span><strong>@{originalReport.resolvedBy}</strong></div>
              <p className="report-context-note">
                This is a new, independent report reviewed by the Community Moderator. The original report and
                its decision are not changed by submitting it.
              </p>
            </>
          ) : (
            <p className="report-context-note">Loading the original decision…</p>
          )}
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

        <div className="report-field">
          <label htmlFor="evidence">Evidence <span className="hint">Optional, up to 5 images (5 MB each)</span></label>
          <div className="evidence-upload">
            <input
              id="evidence"
              className="evidence-upload-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={addFiles}
            />
            <label className="evidence-upload-btn" htmlFor="evidence">Choose files</label>
            <span className="evidence-upload-name">
              {evidence.length
                ? `${evidence.length} ${evidence.length === 1 ? 'file' : 'files'} selected`
                : 'No files selected'}
            </span>
          </div>
          {evidence.length > 0 && (
            <ul className="evidence-file-list">
              {evidence.map((file, index) => (
                <li className="evidence-file" key={`${file.name}-${index}`}>
                  <span className="evidence-file-name" title={file.name}>{file.name}</span>
                  <button
                    type="button"
                    className="evidence-file-remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setEvidence(evidence.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="report-modal-actions" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
          <button type="submit" className="report-btn primary" disabled={busy || locked}>
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
          <button
            type="button"
            className="report-btn ghost"
            onClick={() => { setDescription(''); setEvidence([]); setError(''); }}
          >
            Discard
          </button>
        </div>
      </form>
    </main>
  );
}
