initAdminSidebar('revenue');
initFooter('../../');

let competitionsList = [];
let transactionsList = [];

function calculateFeeLive() {
  const prizeInput = document.getElementById('calc-prize-pool');
  const resultFee = document.getElementById('calc-result-fee');
  const resultExp = document.getElementById('calc-result-explanation');
  if (!prizeInput || !resultFee || !resultExp) return;

  const prizePool = parseFloat(prizeInput.value) || 0;
  const pctFee = Math.round(prizePool * 0.07 * 100) / 100;
  const finalFee = Math.max(50, pctFee);

  resultFee.textContent = `₹${finalFee.toLocaleString()}`;

  if (pctFee >= 50) {
    resultExp.textContent = `7% of ₹${prizePool.toLocaleString()} = ₹${pctFee.toLocaleString()} (Exceeds ₹50 minimum flat fee)`;
  } else {
    resultExp.textContent = `7% of ₹${prizePool.toLocaleString()} = ₹${pctFee.toLocaleString()} (₹50 minimum applied as it is higher)`;
  }
}

async function loadRevenueData() {
  // 1. Fetch platform stats from Backend
  if (window.NexusAPI && window.NexusAPI.Revenue) {
    const statsRes = await window.NexusAPI.Revenue.getStats();
    if (statsRes.ok && statsRes.data) {
      const s = statsRes.data;
      document.getElementById('stat-platform-fees').textContent = `₹${(s.totalPlatformFeeCollected || 0).toLocaleString()}`;
      document.getElementById('stat-platform-count').textContent = `${s.transactionCounts?.platformFees || 0} fee transactions completed`;

      document.getElementById('stat-prize-pools').textContent = `₹${(s.totalPrizePoolsConfigured || 0).toLocaleString()}`;

      document.getElementById('stat-entry-fees').textContent = `₹${(s.totalEntryFeeCollected || 0).toLocaleString()}`;
      document.getElementById('stat-entry-count').textContent = `${s.transactionCounts?.entryFees || 0} team registrations`;

      document.getElementById('stat-payouts').textContent = `₹${(s.totalPayouts || 0).toLocaleString()}`;
      document.getElementById('stat-payout-count').textContent = `${s.transactionCounts?.prizePayouts || 0} tournament winners paid`;
    }

    // 2. Fetch transactions
    const txnRes = await window.NexusAPI.Revenue.getTransactions();
    if (txnRes.ok && Array.isArray(txnRes.data)) {
      transactionsList = txnRes.data;
      renderTransactions(transactionsList);
    }
  }

  // 3. Load competitions dropdown
  if (window.NexusAPI && window.NexusAPI.Competitions) {
    const compRes = await window.NexusAPI.Competitions.getAll();
    if (compRes.ok && Array.isArray(compRes.data)) {
      competitionsList = compRes.data;
      populateCompSelect(competitionsList);
    }
  }
}

function populateCompSelect(comps) {
  const select = document.getElementById('calc-comp-select');
  if (!select) return;

  select.innerHTML = '<option value="">Select a tournament...</option>' +
    comps.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  select.addEventListener('change', async (e) => {
    const compId = e.target.value;
    if (!compId) return;

    if (window.NexusAPI && window.NexusAPI.Revenue) {
      const feeRes = await window.NexusAPI.Revenue.getCompetitionFee(compId);
      if (feeRes.ok && feeRes.data) {
        document.getElementById('calc-prize-pool').value = feeRes.data.prizePool || 5000;
        document.getElementById('calc-entry-fee').value = feeRes.data.entryFee || 250;
        calculateFeeLive();
      }
    }
  });
}

function renderTransactions(txns) {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;

  if (!txns.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">
          No transactions recorded yet. Set a tournament fee above or record a fee payment to test.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = txns.map(t => {
    let typeBadge = `<span class="status-pill ongoing" style="font-size:11px;">${t.type}</span>`;
    if (t.type === 'platform_fee') {
      typeBadge = `<span style="background:rgba(198,255,51,0.15);color:var(--accent-neon);border:1px solid var(--accent-neon);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">Platform Fee</span>`;
    } else if (t.type === 'entry_fee') {
      typeBadge = `<span style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">Entry Fee</span>`;
    } else if (t.type === 'prize_payout') {
      typeBadge = `<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">Prize Payout</span>`;
    }

    return `
      <tr>
        <td style="font-family:monospace;font-weight:700;">#${t.id.slice(0, 8)}</td>
        <td>${typeBadge}</td>
        <td style="font-weight:800;color:var(--text-main);">₹${Number(t.amount).toLocaleString()}</td>
        <td style="color:var(--text-muted);font-size:13px;">${t.description || '—'}</td>
        <td><span class="status-pill completed" style="font-size:11px;">Completed</span></td>
        <td style="color:var(--text-muted);font-size:12px;">${new Date(t.createdAt).toLocaleDateString()} ${new Date(t.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
      </tr>`;
  }).join('');
}

async function saveTournamentFeeConfig() {
  const select = document.getElementById('calc-comp-select');
  const compId = select ? select.value : '';
  if (!compId) {
    if (typeof showToast === 'function') showToast('Please select a tournament from the list first.', 'error');
    return;
  }

  const prizePool = parseFloat(document.getElementById('calc-prize-pool').value) || 0;
  const entryFee = parseFloat(document.getElementById('calc-entry-fee').value) || 0;

  if (window.NexusAPI && window.NexusAPI.Revenue) {
    const res = await window.NexusAPI.Revenue.setCompetitionFee(compId, entryFee, prizePool);
    if (res.ok) {
      if (typeof showToast === 'function') {
        showToast(`Fee saved! Calculated Platform Fee: ₹${res.data.platformFee} [max(₹50, 7%)]`);
      }
      await loadRevenueData();
    } else {
      if (typeof showToast === 'function') showToast('Failed to save fee: ' + (res.error || ''), 'error');
    }
  }
}

async function recordPlatformFeePaid() {
  const select = document.getElementById('calc-comp-select');
  const compId = select ? select.value : '';
  if (!compId) {
    if (typeof showToast === 'function') showToast('Please select a tournament first.', 'error');
    return;
  }

  if (window.NexusAPI && window.NexusAPI.Revenue) {
    const res = await window.NexusAPI.Revenue.payPlatformFee(compId);
    if (res.ok) {
      if (typeof showToast === 'function') {
        showToast(`Platform fee payment recorded: ₹${res.data.fee?.platformFee || ''}`);
      }
      await loadRevenueData();
    } else {
      if (typeof showToast === 'function') showToast('Error recording payment: ' + (res.error || ''), 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  calculateFeeLive();
  loadRevenueData();
});

window.calculateFeeLive = calculateFeeLive;
window.saveTournamentFeeConfig = saveTournamentFeeConfig;
window.recordPlatformFeePaid = recordPlatformFeePaid;
window.loadRevenueData = loadRevenueData;
