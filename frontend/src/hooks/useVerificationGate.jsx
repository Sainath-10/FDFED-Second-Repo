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
  const cancelRef = useRef(null);

  /**
   * Returns true when verified. Always asks the backend (force refresh) so a
   * stale local flag can never override a persisted "unverified" response.
   */
  const check = useCallback(async () => {
    const res = await VerificationAPI.status(true);
    const verified = isVerified(res?.data || res?.verificationStatus);
    setStatus(verified ? 'verified' : 'unverified');
    return verified;
  }, []);

  /**
   * Opens the shared verification dialog and resumes `action` after success.
   * `onCancel` (optional) lets the caller restore the UI it closed before
   * opening this dialog; it is never called after a successful verification.
   */
  const openGate = useCallback((action, onCancel) => {
    pendingRef.current = action;
    cancelRef.current = onCancel || null;
    setOpen(true);
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
    openGate(action);
    return false;
  }, [check, openGate]);

  const modal = (
    <VerificationModal
      open={open}
      onClose={(completed) => {
        setOpen(false);
        if (completed) {
          // Resume the pending action only after the dialog has closed, so the
          // verification and checkout/publish modals never overlap.
          const pending = pendingRef.current;
          pendingRef.current = null;
          cancelRef.current = null;
          if (pending) Promise.resolve(pending()).catch(() => { /* action reports its own errors */ });
          return;
        }
        // Cancelled/failed — no pending action runs and the caller's UI is
        // restored so the user never loses their entered data.
        pendingRef.current = null;
        const cancel = cancelRef.current;
        cancelRef.current = null;
        if (cancel) cancel();
      }}
      onVerified={() => {
        setStatus('verified');
      }}
      purpose={purpose}
    />
  );

  return { check, run, openGate, gateModal: modal, status };
}
