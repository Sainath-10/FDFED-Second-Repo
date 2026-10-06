import React, { useState, useEffect } from 'react';

let toastSubscriber = null;

export function showToast(msg, type = 'success') {
  if (toastSubscriber) {
    toastSubscriber(msg, type);
  } else {
    // Fallback if component is not mounted yet
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
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

export function useToast() {
  return { showToast };
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastSubscriber = (msg, type = 'success') => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };

    return () => {
      toastSubscriber = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: t.type === 'success' ? '#c6ff33' : '#e7000b',
            color: t.type === 'success' ? '#000' : '#fff',
            fontFamily: "'Lato', sans-serif",
            fontWeight: 700,
            padding: '12px 24px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            fontSize: 14,
            letterSpacing: 0.5,
            transition: 'all 0.3s ease'
          }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
