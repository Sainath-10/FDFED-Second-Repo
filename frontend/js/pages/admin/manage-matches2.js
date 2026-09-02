initAdminSidebar('competitions');
initFooter('../../');

const filterTabs = document.querySelectorAll('.filter-tab');
if (filterTabs.length > 0) {
  filterTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all tabs
      filterTabs.forEach(b => b.classList.remove('active'));
      // Add active class to clicked tab
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      const matchCards = document.querySelectorAll('#matches-list > div');
      
      matchCards.forEach(card => {
        if (filter === 'all' || card.dataset.status === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}
