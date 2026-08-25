initSidebar('activity', '../');
initFooter('../');

const filterTabs = document.querySelectorAll('.filter-tab');
const compsList = document.getElementById('comps-part-list');

if (filterTabs.length > 0 && compsList) {
  filterTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      filterTabs.forEach(b => b.classList.remove('active'));
      // Add active to current
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      const cards = compsList.querySelectorAll(':scope > div');
      
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.status === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}
