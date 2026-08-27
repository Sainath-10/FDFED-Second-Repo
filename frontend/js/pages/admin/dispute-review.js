initAdminSidebar('disputes');
initFooter('../../');

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  let compId = params.get('id') || sessionStorage.getItem('last_admin_comp_id');
  if (compId) {
    sessionStorage.setItem('last_admin_comp_id', compId);
    const suffix = '?id=' + encodeURIComponent(compId);
    const backBtn = document.querySelector('.back-btn-alt');
    if (backBtn) {
      backBtn.href = 'dashboard.html';
      backBtn.textContent = '← Back to Dashboard';
    }
  }
});
