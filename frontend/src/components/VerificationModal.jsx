/**
 * NEXUS ESPORTS — Shared Simulated Aadhaar Verification Modal (§12)
 *
 * Reusable two-step dialog:
 *   Step 1 — 12-digit Aadhaar FORMAT check (front-end mirror of the backend rule).
 *   Step 2 — non-empty OTP completes the SIMULATED flow.
 *
 * Labelled "simulated" everywhere: this does NOT provide KYC, identity
 * authentication or legal proof of identity. Values are sent only to the
 * verification endpoint and never logged or stored in full.
 *
 * Used from the Profile page and as the verification gate before creating or
 * joining a competition — onVerified() lets the caller resume the original
 * pending action with the preserved state (competition id, form values, etc.).
 */
import { useEffect, useRef, useState } from 'react';
import { VerificationAPI, formatAadhaarInput, isValidAadhaarFormat } from '../services/verificationApi.js';
import '../styles/pages/verification.css';

export default function VerificationModal({ open, onClose, onVerified, purpose }) {
  const [step, setStep] = useState(1);
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setAadhaar('');
    setOtp('');
    setError('');
    setBusy(false);
    setDone(false);
    setTimeout(() => firstFieldRef.current && firstFieldRef.current.focus(), 50);
  }, [open]);

  if (!open) return null;

  function close(cancelled) {
    // Esc/backdrop/X = cancellable safely at any step; no partial state persists.
    onClose && onClose(cancelled);
  }

  async function submitAadhaar(e) {
    e.preventDefault();
    setError('');
    if (!isValidAadhaarFormat(aadhaar)) {
      setError('Please enter exactly 12 digits (0–9). A 12-digit format check does not verify authenticity — this is a simulated flow.');
      return;
    }
    setBusy(true);
    const res = await VerificationAPI.requestOtp(aadhaar.replace(/\D/g, ''));
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Format validation failed. Please try again.');
      return;
    }
    setAadhaar(formatAadhaarInput(aadhaar));
    setStep(2);
    setTimeout(() => firstFieldRef.current && firstFieldRef.current.focus(), 50);
  }

  async function submitOtp(e) {
    e.preventDefault();
    setError('');
    if (!String(otp).trim()) {
      setError('Please enter the OTP to complete verification (any non-empty value — simulated flow).');
      return;
    }
    setBusy(true);
    const res = await VerificationAPI.verify(otp);
    if (!res.ok) {
      setBusy(false);
      setError(res.error || 'Verification failed. Please try again.');
      return;
    }
    setBusy(false);
    setDone(true);
    setTimeout(() => {
      onVerified && onVerified(true);
      onClose && onClose(true);
    }, 700);
  }

  const purposeLine = purpose ? `Required before you can ${purpose}.` : '';

  return (
    <div
      className="modal-overlay open"
      role="dialog"
      aria-modal="true"
      aria-label="Simulated Aadhaar verification"
      onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
    >
      <div className="modal" id="verification-modal">
        <button
          type="button"
          aria-label="Close verification dialog"
          onClick={() => close(false)}
          style={{
            position: 'absolute', top: 14, right: 16, background: 'none', border: 'none',
            color: '#9aa4b2', fontSize: 20, cursor: 'pointer', lineHeight: 1,
          }}
        >✕</button>

        <h2 style={{ marginBottom: 4 }}> Aadhaar Verification</h2>
        <p style={{ color: '#9aa4b2', marginBottom: 14, fontSize: 13.5 }}>{purposeLine}</p>

        <div className="verify-simulated-banner" role="note">
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong>SIMULATED verification — not real UIDAI/KYC.</strong> A 12-digit format check does not prove
            identity, and no OTP is sent. This is an application workflow flag, not a security boundary.
          </span>
        </div>

        {done ? (
          <div className="verify-loading" id="verification-success">
            <span aria-hidden="true" style={{ fontSize: 22 }}>✅</span>
            Verification complete (simulated). Updating your profile…
          </div>
        ) : step === 1 ? (
          <form id="verification-step-1" onSubmit={submitAadhaar} noValidate>
            <div className="verify-step-count">Step 1 of 2 — Aadhaar Number</div>
            <label className="verify-field-label" htmlFor="verification-aadhaar-input">Aadhaar number</label>
            <input
              ref={firstFieldRef}
              id="verification-aadhaar-input"
              className="verify-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="XXXX XXXX XXXX"
              maxLength={14}
              value={aadhaar}
              onChange={(e) => setAadhaar(formatAadhaarInput(e.target.value))}
            />
            {error && <div className="verify-error" id="verification-error" role="alert">{error}</div>}
            <div className="verify-actions">
              <button type="button" className="btn btn-ghost" id="verification-cancel" onClick={() => close(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" id="verification-request-otp" disabled={busy}>
                {busy ? 'Validating…' : 'Request OTP'}
              </button>
            </div>
            <p className="verify-help">No OTP is actually sent — the next step is part of the simulated flow.</p>
          </form>
        ) : (
          <form id="verification-step-2" onSubmit={submitOtp} noValidate>
            <div className="verify-step-count">Step 2 of 2 — OTP</div>
            <label className="verify-field-label" htmlFor="verification-otp-input">Enter OTP</label>
            <input
              ref={firstFieldRef}
              id="verification-otp-input"
              className="verify-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="● ● ● ● ● ●"
              maxLength={10}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {error && <div className="verify-error" id="verification-error" role="alert">{error}</div>}
            <div className="verify-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setError(''); }}>Back</button>
              <button type="submit" className="btn btn-primary" id="verification-verify" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
            </div>
            <p className="verify-help">Simulated flow: any non-empty OTP is accepted. The OTP is never stored.</p>
          </form>
        )}
      </div>
    </div>
  );
}
