/**
 * NEXUS ESPORTS — toast helper
 *
 * Renders a toast imperatively (not React state) so callers keep the plain
 * API: `showToast('Saved!')`.
 */
export function showToast(msg, type = 'success') {
  if (typeof document === 'undefined') return;
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${type === 'success' ? '#c6ff33' : '#e7000b'};
    color:${type === 'success' ? '#000' : '#fff'};
    font-family: 'Lato', sans-serif; font-weight:700;
    padding:12px 24px; border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    font-size:14px; letter-spacing:0.5px;
    transform:translateY(20px); opacity:0;
    transition: all 0.3s;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


