document.addEventListener('DOMContentLoaded', () => {
  // Set temporary user ID
  localStorage.setItem('userId', 'test123');
  console.log('Trading Journal loaded for user: test123');

  const workerUrl = 'https://traders-gazette-proxy.mohammadosama310.workers.dev/';

  // Automatic sheet creation on load
  fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'createSheet' }),
  })
  .then(() => loadTrades())
  .catch(error => console.error('Auto sheet creation failed:', error));

  // Form submission
  const tradeForm = document.getElementById('trade-form');
  tradeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validation
    const requiredFields = ['date', 'symbol', 'assetType', 'buySell', 'entryPrice'];
    let valid = true;
    requiredFields.forEach(id => {
      const input = document.getElementById(id);
      if (!input.value.trim()) {
        input.style.borderColor = 'red';
        valid = false;
      } else {
        input.style.borderColor = '#d4af37';
      }
    });
    if (!valid) {
      alert('Please fill all required fields.');
      return;
    }

    // Collect data
    const tradeData = {
      date: document.getElementById('date').value,
      symbol: document.getElementById('symbol').value,
      assetType: document.getElementById('assetType').value,
      buySell: document.getElementById('buySell').value,
      entryPrice: parseFloat(document.getElementById('entryPrice').value),
      exitPrice: parseFloat(document.getElementById('exitPrice').value) || 0,
      takeProfit: parseFloat(document.getElementById('takeProfit').value) || 0,
      stopLoss: parseFloat(document.getElementById('stopLoss').value) || 0,
      pnlNet: parseFloat(document.getElementById('pnlNet').value) || 0,
      positionSize: parseFloat(document.getElementById('positionSize').value) || 0,
      strategyName: document.getElementById('strategyName').value,
      notes: document.getElementById('notes').value
    };

    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'writeTrade', tradeData })
      });
      const result = await response.json();
      if (result.status === 'Trade saved') {
        alert('Trade saved successfully!');
        tradeForm.reset();
        loadTrades();
      } else {
        alert('Error saving trade: ' + JSON.stringify(result.error));
      }
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('Save Trade Error:', error);
    }
  });

  // Load trades from sheets
  async function loadTrades() {
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readTrades' })
      });
      const trades = await response.json();
      const tradeTableBody = document.getElementById('trade-table-body');
      tradeTableBody.innerHTML = '';
      if (trades.length === 0) {
        tradeTableBody.innerHTML = '<tr><td colspan="12">No trades yet</td></tr>';
      } else {
        trades.forEach(trade => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${trade.date || ''}</td>
            <td>${trade.symbol || ''}</td>
            <td>${trade.assetType || ''}</td>
            <td>${trade.buySell || ''}</td>
            <td>${trade.entryPrice.toFixed(5)}</td>
            <td>${trade.exitPrice.toFixed(5)}</td>
            <td>${trade.takeProfit.toFixed(5)}</td>
            <td>${trade.stopLoss.toFixed(5)}</td>
            <td>${trade.pnlNet.toFixed(5)}</td>
            <td>${trade.positionSize.toFixed(5)}</td>
            <td>${trade.strategyName || ''}</td>
            <td>${trade.notes || ''}</td>
          `;
          tradeTableBody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Load Trades Error:', error);
      document.getElementById('trade-table-body').innerHTML = '<tr><td colspan="12">Error loading trades</td></tr>';
    }
  }

  // Toggle views
  const tableTab = document.getElementById('table-tab');
  const analyticsTab = document.getElementById('analytics-tab');
  const tableView = document.getElementById('table-view');
  const analyticsView = document.getElementById('analytics-view');

  tableTab.addEventListener('click', () => {
    tableTab.classList.add('active');
    analyticsTab.classList.remove('active');
    tableView.style.display = 'block';
    analyticsView.style.display = 'none';
  });

  analyticsTab.addEventListener('click', () => {
    analyticsTab.classList.add('active');
    tableTab.classList.remove('active');
    analyticsView.style.display = 'grid';
    tableView.style.display = 'none';
  });

  // Initial load trades
  loadTrades();
});
