/**
 * NEXUS ESPORTS — Verification gate hook (§12.4)
 *
 * Shared by competition create/join paths. Guarantees the pending action
 * resumes after verification completes:
 *   gate.run(action) →
 *     - verified already? runs action() immediately.
 *     - unverified? opens the shared VerificationModal, preserving the pending
 *       action in a ref; when verification succeeds, resumes it automatically.
 *
 * The backend independently enforces the gate for direct API requests.
 */
import { useCallback, useRef, useState } from 'react';
import VerificationModal from '../components/VerificationModal.jsx';
import { VerificationAPI, isVerified } from '../services/verificationApi.js';

export default function useVerificationGate(purpose = 'continue') {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // 'verified' | 'unverified' | null
  const pendingRef = useRef(null);

  /** Returns true when verified; false when the gate modal was opened instead. */
  const check = useCallback(async () => {
    const res = await VerificationAPI.status();
    const verified = isVerified(res?.data || res?.verificationStatus);
    setStatus(verified ? 'verified' : 'unverified');
    return verified;
  }, []);

  /**
   * Runs `action` once verified. If unverified, stores the action and opens the
   * modal; after successful verification the same action is invoked so the
   * original form values / competition ids are preserved by the closure.
   */
  const run = useCallback(async (action) => {
    const verified = await check();
    if (verified) {
      await action();
      return true;
    }
    pendingRef.current = action;
    setOpen(true);
    return false;
  }, [check]);

  const modal = (
    <VerificationModal
      open={open}
      onClose={(completed) => {
        setOpen(false);
        if (!completed) pendingRef.current = null; // cancelled or failed — no duplicate action
      }}
      onVerified={() => {
        // resume the original pending action after verification succeeds
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) Promise.resolve(pending()).catch(() => { /* action reports its own errors */ });
        setStatus('verified');
      }}
      purpose={purpose}
    />
  );

  return { check, run, gateModal: modal, status };
}
