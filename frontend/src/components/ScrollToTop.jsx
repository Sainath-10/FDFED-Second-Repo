/**
 * NEXUS ESPORTS — ScrollToTop
 *
 * Centralised scroll restoration for the SPA. Every page was a separate
 * document load, so navigating always started at the top of the page. On
 * PUSH/REPLACE navigations we therefore reset the window scroll; POP
 * (browser back/forward) is deliberately left alone so the browser's own
 * history scroll restoration keeps working.
 *
 * One handler for the whole app — do not add per-page scroll calls.
 */
import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    if (hash) {
      // Links like /pages/about.html#policies land on that section once it renders.
      const id = decodeURIComponent(hash.slice(1));
      const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const timer = window.setTimeout(scroll, 60);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, search, hash, navigationType]);

  return null;
}


