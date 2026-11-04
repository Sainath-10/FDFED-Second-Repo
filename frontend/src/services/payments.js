import { API_URL, getToken } from './api.js';

export async function paymentRequest(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`${API_URL}/payments${path}`, {
      method,
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Could not reach the payment service. Is the backend running?');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Payment request failed');
  return data;
}

let checkoutScript;
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => { checkoutScript = null; script.remove(); reject(new Error('Could not load payment checkout. Please retry.')); };
    document.head.appendChild(script);
  });
  return checkoutScript;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
/** Ledger amounts are integer paise. */
export const money = (minor) => inr.format((Number(minor) || 0) / 100);
/** Competition fields (prize, platformFee, entryFeeAmount) are rupees. */
export const rupees = (value) => inr.format(Number(value) || 0);

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const TERMINAL_STATES = ['PRIZE_RELEASED', 'REFUND_ISSUED', 'CANCELLED', 'EXPIRED', 'ABANDONED', 'REVERSED'];

const COMPETITION_STATES = {
  AWAITING_PLATFORM_FEE: ['Awaiting platform fee', 'warn'],
  OPEN_FOR_REGISTRATION: ['Open for registration', 'accent'],
  COMPLETED: ['Awaiting finance review', 'info'],
  PRIZE_RELEASED: ['Settled', 'ok'],
  REFUND_ISSUED: ['Cancelled · refunded', 'bad'],
  CANCELLED: ['Cancelled', 'muted'],
  EXPIRED: ['Draft expired', 'muted'],
  ABANDONED: ['Abandoned', 'bad'],
  REVERSED: ['Reversed (fraud)', 'bad'],
  LEGACY: ['Legacy', 'muted'],
};
export const competitionState = (status) => {
  const [label, tone] = COMPETITION_STATES[status] || [String(status || 'Unknown').replace(/_/g, ' ').toLowerCase(), 'muted'];
  return { label, tone };
};

const TX_STATES = { PENDING: 'warn', ESCROWED: 'info', CONFIRMED: 'ok', RELEASED: 'ok', REFUNDED: 'muted', FAILED: 'bad', REVERSED: 'bad' };
export const txTone = (status) => TX_STATES[status] || 'muted';

export const TX_TYPES = {
  PLATFORM_FEE: 'Platform fee',
  PRIZE_POOL: 'Prize pool deposit',
  REGISTRATION: 'Registration fee',
  REFUND: 'Refund',
  PAYOUT: 'Prize payout',
  REG_FEE_RELEASED: 'Revenue release',
  PRIZE_RETURN: 'Prize pool return',
  CLAWBACK: 'Fraud clawback',
};
export const txType = (type) => TX_TYPES[type] || String(type || '').replace(/_/g, ' ');
export const isMock = (tx) => String(tx?.gatewayOrderId || '').startsWith('mock_');
