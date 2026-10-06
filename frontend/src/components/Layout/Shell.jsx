import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Footer from './Footer';
import Toast from '../Common/Toast';
import WarningModal from '../Common/WarningModal';
import CoOrganizerToast from '../Common/CoOrganizerToast';

export default function Shell({
  children,
  hasSidebar = true,
  sidebarVariant,
  activePage,
  hasFooter = true
}) {
  const location = useLocation();
  const isSuperAdmin = location.pathname.toLowerCase().startsWith('/super-admin');

  useEffect(() => {
    if (isSuperAdmin) {
      document.body.classList.add('super-admin-classic-shell');
    } else {
      document.body.classList.remove('super-admin-classic-shell');
    }
    return () => {
      document.body.classList.remove('super-admin-classic-shell');
    };
  }, [isSuperAdmin]);

  return (
    <>
      <WarningModal />
      <CoOrganizerToast />
      <Toast />

      {hasSidebar ? (
        <>
          <Sidebar variant={sidebarVariant} activePage={activePage} />
          <div className="page-with-sidebar">
            {children}
            {hasFooter && <Footer />}
          </div>
        </>
      ) : (
        <>
          {children}
          {hasFooter && <Footer />}
        </>
      )}
    </>
  );
}
