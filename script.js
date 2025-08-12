document.addEventListener('DOMContentLoaded', () => {
  // Set temporary user ID
  localStorage.setItem('userId', 'test123');
  console.log('Trading Journal loaded for user: test123');

  const workerUrl = 'https://traders-gazette-proxy.mohammadosama310.workers.dev/';
  const loader = document.getElementById('loader');
  const notification = document.getElementById('notification');
  const entryFormCard = document.getElementById('entry-form-card');
  const syncModal = document.getElementById('sync-modal');

  // Automatic sheet creation on load
  fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'createSheet' }),
  })
  .then(() => loadTrades())
  .catch(error => console.error('Auto sheet creation failed:', error));

  // Toggle entry form
  const addEntryButton = document.getElementById('add-entry-button');
  addEntryButton.addEventListener('click', () => {
    entryFormCard.classList.toggle('hidden');
    syncModal.classList.add('hidden'); // Ensure sync modal is closed
  });

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

    // Show loader
    loader.classList.remove('hidden');

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
        notification.textContent = 'Trade Saved Successfully';
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
        tradeForm.reset();
        loadTrades();
        updateCharts();
      } else {
        alert('Error saving trade: ' + JSON.stringify(result.error));
      }
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('Save Trade Error:', error);
    } finally {
      loader.classList.add('hidden');
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
      if (!response.ok) throw new Error('Network response was not ok');
      const trades = await response.json();
      const tradeTableBody = document.getElementById('trade-table-body');
      tradeTableBody.innerHTML = '';
      if (!Array.isArray(trades) || trades.length === 0) {
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
            <td>${trade.pnlNet.toFixed(2)}</td>
            <td>${trade.positionSize.toFixed(2)}</td>
            <td>${trade.strategyName || ''}</td>
            <td>${trade.notes || ''}</td>
          `;
          tradeTableBody.appendChild(row);
        });
      }
      return trades; // Return for charts
    } catch (error) {
      console.error('Load Trades Error:', error);
      document.getElementById('trade-table-body').innerHTML = '<tr><td colspan="12">Error loading trades</td></tr>';
      return [];
    }
  }

  // Update charts
  let timePnlChart, assetPnlChart, winLossChart, pnlDistributionChart, selectedChart;

  async function updateCharts() {
    const trades = await loadTrades();
    if (trades.length === 0) return;

    // Time-Based P&L (Line Chart)
    const timePnlData = trades.reduce((acc, trade) => {
      const date = trade.date;
      acc[date] = (acc[date] || 0) + trade.pnlNet;
      return acc;
    }, {});
    const timeLabels = Object.keys(timePnlData).sort();
    const timeData = timeLabels.map(date => timePnlData[date]);
    if (timePnlChart) timePnlChart.destroy();
    timePnlChart = new Chart(document.getElementById('timePnlChart'), {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [{
          label: 'P&L Over Time',
          data: timeData,
          borderColor: '#d4af37',
          backgroundColor: 'rgba(212, 175, 55, 0.2)',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true },
        }
      }
    });

    // Asset-Based P&L (Bar Chart)
    const assetPnlData = trades.reduce((acc, trade) => {
      acc[trade.assetType] = (acc[trade.assetType] || 0) + trade.pnlNet;
      return acc;
    }, {});
    const assetLabels = Object.keys(assetPnlData);
    const assetData = assetLabels.map(asset => assetPnlData[asset]);
    if (assetPnlChart) assetPnlChart.destroy();
    assetPnlChart = new Chart(document.getElementById('assetPnlChart'), {
      type: 'bar',
      data: {
        labels: assetLabels,
        datasets: [{
          label: 'P&L by Asset Type',
          data: assetData,
          backgroundColor: '#d4af37',
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true },
        }
      }
    });

    // Win vs Loss Count (Pie Chart)
    const winLossData = trades.reduce((acc, trade) => {
      if (trade.pnlNet > 0) acc.win++;
      else if (trade.pnlNet < 0) acc.loss++;
      return acc;
    }, { win: 0, loss: 0 });
    if (winLossChart) winLossChart.destroy();
    winLossChart = new Chart(document.getElementById('winLossChart'), {
      type: 'pie',
      data: {
        labels: ['Wins', 'Losses'],
        datasets: [{
          data: [winLossData.win, winLossData.loss],
          backgroundColor: ['#d4af37', '#1a1a1a'],
        }]
      },
      options: {
        responsive: true,
      }
    });

    // P&L Distribution (Histogram - Bar Chart)
    const pnlData = trades.map(trade => trade.pnlNet);
    const pnlBins = [-1000, -500, -100, 0, 100, 500, 1000, Infinity];
    const pnlDistribution = pnlBins.slice(0, -1).map((bin, i) => ({
      label: `${bin} to ${pnlBins[i+1]}`,
      count: pnlData.filter(pnl => pnl >= bin && pnl < pnlBins[i+1]).length,
    }));
    const pnlLabels = pnlDistribution.map(bin => bin.label);
    const pnlCounts = pnlDistribution.map(bin => bin.count);
    if (pnlDistributionChart) pnlDistributionChart.destroy();
    pnlDistributionChart = new Chart(document.getElementById('pnlDistributionChart'), {
      type: 'bar',
      data: {
        labels: pnlLabels,
        datasets: [{
          label: 'P&L Distribution',
          data: pnlCounts,
          backgroundColor: '#d4af37',
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true },
        }
      }
    });

    // Single Chart Update
    const chartSelector = document.getElementById('chart-selector');
    if (selectedChart) selectedChart.destroy();
    selectedChart = new Chart(document.getElementById('selectedChart'), {
      type: 'bar', // Default type, can be adjusted per chart
      data: {
        labels: pnlLabels, // Default to P&L Distribution
        datasets: [{
          label: 'Selected Chart',
          data: pnlCounts,
          backgroundColor: '#d4af37',
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true },
        }
      }
    });
    chartSelector.addEventListener('change', () => {
      const selectedId = chartSelector.value;
      let chartData = { labels: [], datasets: [{ data: [], backgroundColor: '#d4af37' }] };
      if (selectedId === 'timePnlChart') {
        chartData.labels = timeLabels;
        chartData.datasets[0].data = timeData;
      } else if (selectedId === 'assetPnlChart') {
        chartData.labels = assetLabels;
        chartData.datasets[0].data = assetData;
      } else if (selectedId === 'winLossChart') {
        chartData.labels = ['Wins', 'Losses'];
        chartData.datasets[0].data = [winLossData.win, winLossData.loss];
      } else if (selectedId === 'pnlDistributionChart') {
        chartData.labels = pnlLabels;
        chartData.datasets[0].data = pnlCounts;
      }
      selectedChart.data = chartData;
      selectedChart.update();
    });
  }

  // Toggle views
  const allChartsTab = document.getElementById('all-charts-tab');
  const singleChartTab = document.getElementById('single-chart-tab');
  const timePnlCard = document.getElementById('time-pnl-card');
  const assetPnlCard = document.getElementById('asset-pnl-card');
  const winLossCard = document.getElementById('win-loss-card');
  const pnlDistCard = document.getElementById('pnl-dist-card');
  const singleChartView = document.getElementById('single-chart-view');

  allChartsTab.addEventListener('click', () => {
    allChartsTab.classList.add('active');
    singleChartTab.classList.remove('active');
    timePnlCard.style.display = 'block';
    assetPnlCard.style.display = 'block';
    winLossCard.style.display = 'block';
    pnlDistCard.style.display = 'block';
    singleChartView.style.display = 'none';
    updateCharts(); // Refresh all charts
  });

  singleChartTab.addEventListener('click', () => {
    singleChartTab.classList.add('active');
    allChartsTab.classList.remove('active');
    timePnlCard.style.display = 'none';
    assetPnlCard.style.display = 'none';
    winLossCard.style.display = 'none';
    pnlDistCard.style.display = 'none';
    singleChartView.style.display = 'block';
    updateCharts(); // Refresh single chart
  });

  // Initial load trades
  loadTrades();
  // Initial chart load
  updateCharts();

  // MetaAPI Sync Button and Modal
  const syncMqButton = document.getElementById('sync-mq-button');
  const closeModal = document.getElementsByClassName('close')[0];
  const syncForm = document.getElementById('sync-form');

  syncMqButton.addEventListener('click', () => {
    entryFormCard.classList.add('hidden'); // Close entry form
    syncModal.classList.remove('hidden');
  });
  closeModal.addEventListener('click', () => syncModal.classList.add('hidden'));
  window.addEventListener('click', (e) => {
    if (e.target === syncModal) syncModal.classList.add('hidden');
  });

  syncForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const credentials = {
      platform: document.getElementById('platform').value,
      server: document.getElementById('server').value,
      accountNumber: document.getElementById('accountNumber').value,
      password: document.getElementById('password').value,
      nickname: document.getElementById('nickname').value,
    };
    localStorage.setItem('mtCredentials', btoa(JSON.stringify(credentials))); // Simple encryption

    loader.classList.remove('hidden');
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'syncMetaAPI', credentials })
      });
      const result = await response.json();
      if (result.status === 'Sync complete') {
        notification.textContent = 'Trades Synced Successfully';
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
        syncModal.classList.add('hidden');
        loadTrades();
        updateCharts();
      } else {
        alert('Error syncing trades: ' + JSON.stringify(result.error));
      }
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('Sync Error:', error);
    } finally {
      loader.classList.add('hidden');
    }
  });
});
