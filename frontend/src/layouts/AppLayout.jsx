/**
 * NEXUS ESPORTS — AppLayout
 *
 * The shared chrome for signed-in/standard pages: sidebar + account menu
 * (top right) + content + footer.
 * It reproduces the DOM contract exactly (`#sidebar-mount`,
 * `.page-with-sidebar`, `#footer-mount`) so the stylesheet applies
 * unchanged.
 *
 * `offset={false}` (the landing page only) omits the `.page-with-sidebar`
 * wrapper and gives the footer the `.footer-offset` class.
 */
import Sidebar from '../components/Sidebar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import UnreadPopup from '../components/UnreadPopup.jsx';
import UserMenu from '../components/UserMenu.jsx';
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications } from '../store/notificationsSlice.js';
import useReportSync from '../hooks/useReportSync.js';

export default function AppLayout({ children, offset = true }) {
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();
  const username = session?.username || '';

  // Keep the signed-in user's notifications in the store fresh (sidebar badge,
  // pop-up and Notifications page all read them from there).
  const loadNotifications = useCallback(() => { if (username) dispatch(fetchNotifications(username)); }, [username, dispatch]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useReportSync(username ? loadNotifications : null);

  return (
    <>
      <div id="sidebar-mount">
        <Sidebar />
      </div>
      <UnreadPopup />
      {offset ? (
        <div className="page-with-sidebar">
          {session && <div className="app-topbar"><UserMenu /></div>}
          {/* Each page supplies its own <main class="…">. */}
          {children}
          <div id="footer-mount">
            <SiteFooter />
          </div>
        </div>
      ) : (
        <>
          <UserMenu floating />
          {children}
          <div id="footer-mount" className="footer-offset">
            <SiteFooter />
          </div>
        </>
      )}
    </>
  );
}


