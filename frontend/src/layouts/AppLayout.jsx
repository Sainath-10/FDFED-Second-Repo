/**
 * NEXUS ESPORTS — AppLayout
 *
 * The shared chrome for signed-in/standard pages: sidebar + content + footer.
 * It reproduces the DOM contract exactly (`#sidebar-mount`,
 * `.page-with-sidebar`, `#footer-mount`) so the stylesheet applies
 * unchanged.
 *
 * `offset={false}` omits the `.page-with-sidebar` wrapper and gives the footer the
 * landing `.footer-offset` class. Super-admin-style pages (e.g. admin/users) are
 * also full-bleed but keep a plain `#footer-mount` — those pass
 * `footerClassName=""`.
 */
import Sidebar from '../components/Sidebar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';

export default function AppLayout({ children, offset = true, footerClassName }) {
  return (
    <>
      <div id="sidebar-mount">
        <Sidebar />
      </div>
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
          <div id="footer-mount" className={footerClassName !== undefined ? footerClassName : 'footer-offset'}>
            <SiteFooter />
          </div>
        </>
      )}
    </>
  );
}


