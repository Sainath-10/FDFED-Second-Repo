initAdminSidebar('competitions');
initFooter('../../');

const editForm = document.getElementById('edit-form');
if (editForm) {
  editForm.addEventListener('submit', e => {
    e.preventDefault();
    if (typeof showToast === 'function') {
      showToast('Competition changes saved successfully!');
    }
  });
}

function previewBanner(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const preview = document.getElementById('banner-preview');
    if (preview) {
      preview.src = ev.target.result;
    }
  };
  r.readAsDataURL(f);
}

// Global exposure
window.previewBanner = previewBanner;
