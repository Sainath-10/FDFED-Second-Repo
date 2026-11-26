/**
 * NEXUS ESPORTS — toasts
 *
 * Renders the toasts in the Redux store (state.toasts.items), newest at the
 * bottom. Mounted once in App.jsx; pages add toasts with showToast().
 */
import { useSelector } from 'react-redux';
import '../styles/components/toaster.css';

export default function Toaster() {
  const toasts = useSelector((state) => state.toasts.items);
  if (!toasts.length) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type === 'error' ? 'error' : 'success'}${t.leaving ? ' is-leaving' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
