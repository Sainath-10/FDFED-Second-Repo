/**
 * NEXUS ESPORTS — AppLayout
 *
 * The shared chrome for signed-in/standard pages: sidebar + content + footer.
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

export default function AppLayout({ children, offset = true }) {
  return (
    <>
      <div id="sidebar-mount">
        <Sidebar />
      </div>
      <UnreadPopup />
      {offset ? (
        <div className="page-with-sidebar">
          {/* Each page supplies its own <main class="…">. */}
          {children}
          <div id="footer-mount">
            <SiteFooter />
          </div>
        </div>
      ) : (
        <>
          {children}
          <div id="footer-mount" className="footer-offset">
            <SiteFooter />
          </div>
        </>
      )}
    </>
  );
}


