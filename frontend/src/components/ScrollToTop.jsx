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
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, search, navigationType]);

  return null;
}


