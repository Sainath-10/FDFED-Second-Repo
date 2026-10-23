/**
 * NEXUS ESPORTS — Verification API + gate helpers (§12)
 *
 * SIMULATED AADHAAR VERIFICATION:
 * - Step 1 validates the 12-digit FORMAT only — format checks prove nothing
 *   about authenticity/ownership.
 * - Step 2 accepts any non-empty OTP (mock). No real OTP is sent/stored.
 * - Status is persisted on the BACKEND (authoritative). localStorage is never
 *   the source of truth — we only keep an in-session copy for rendering.
 * - Never stores/logs the full Aadhaar number or OTP.
 * - The gateway is isolated here so a compliant identity-verification provider
 *   can replace the flow later.
 */
import { makeRequest, getUser, setUser } from './api.js';

/** Cached in-session status (refreshed from the backend). */
let cachedStatus = null;

export const VerificationAPI = {
  async status(force = false) {
    if (!force && cachedStatus) return cachedStatus;
    const res = await makeRequest('/verification/status', { method: 'GET' });
    if (res.ok && res.data) {
      cachedStatus = res.data;
      // keep the authenticated session copy in sync (best-effort)
      const user = getUser();
      if (user && res.data.verificationStatus) {
        setUser({ ...user, verificationStatus: res.data.verificationStatus });
      }
    }
    return res;
  },

  async requestOtp(aadhaarNumber) {
    return makeRequest('/verification/aadhaar/request-otp', {
      method: 'POST',
      body: JSON.stringify({ aadhaarNumber }),
    });
  },

  async verify(otp) {
    const res = await makeRequest('/verification/aadhaar/verify', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
    if (res.ok) {
      cachedStatus = { ...(cachedStatus || {}), verificationStatus: 'verified', simulated: true };
      const user = getUser();
      if (user) setUser({ ...user, verificationStatus: 'verified' });
    }
    return res;
  },

  /** Clears the in-session cache (e.g. on logout / user switch). */
  resetCache() {
    cachedStatus = null;
  },
};

export function isVerified(status) {
  return String(status?.verificationStatus || status || '').toLowerCase() === 'verified';
}

/** Formats a raw Aadhaar input into "1234 5678 9012" while the user types. */
export function formatAadhaarInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/**
 * Local 12-digit format pre-check mirroring the backend rule. Never claims
 * authenticity — only that the input has exactly 12 digits.
 */
export function isValidAadhaarFormat(raw) {
  return /^\d{12}$/.test(String(raw || '').replace(/\D/g, ''));
}
