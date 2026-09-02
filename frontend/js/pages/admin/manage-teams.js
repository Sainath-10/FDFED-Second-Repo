initAdminSidebar('competitions');
initFooter('../../');

function filterTable(q) {
  const query = q.toLowerCase();
  document.querySelectorAll('#teams-table tbody tr').forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(query) ? '' : 'none';
  });
}

function revokeRow(btn) {
  const row = btn.closest('tr');
  if (!row) return;
  if (!confirm('Revoke this team\'s approval? They will be removed from the competition.')) return;
  row.style.transition = 'opacity 0.3s';
  row.style.opacity = '0';
  setTimeout(() => row.remove(), 300);
  if (typeof showToast === 'function') showToast('Team approval revoked.', 'error');
}

window.filterTable = filterTable;
window.revokeRow = revokeRow;
