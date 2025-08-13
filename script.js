document.addEventListener('DOMContentLoaded', () => {
  // Set temporary user ID
  localStorage.setItem('userId', 'test123');
  console.log('Trading Journal loaded for user: test123');

  const workerUrl = 'https://traders-gazette-proxy.mohammadosama310.workers.dev/';
  const loader = document.getElementById('loader');
  const notification = document.getElementById('notification');
  const entryFormCard = document.getElementById('entry-form-card');
  const syncModal = document.getElementById('sync-modal');
  const timeFrameSelect = document.getElementById('time-frame');
  const exportTableCsv = document.getElementById('export-table-csv');
  const exportAnalyticsCsv = document.getElementById('export-analytics-csv');

  // MetaAPI Setup (Replace with your token and account details)
  const metaApi = new MetaApi({
    token: 'demo_12345', // Replace with your MetaAPI token from https://metaapi.cloud
    domain: 'app.metaapi.cloud'
  });
  let account;

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
  if (addEntryButton) {
    addEntryButton.addEventListener('click', () => {
      entryFormCard.classList.toggle('hidden');
      syncModal.classList.add('hidden');
    });
  }

  // Form submission
  const tradeForm = document.getElementById('trade-form');
  if (tradeForm) {
    tradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validation
      const requiredFields = ['date', 'symbol', 'assetType', 'buySell', 'entryPrice'];
      let valid = true;
      requiredFields.forEach(id => {
        const input = document.getElementById(id);
        if (input && !input.value.trim()) {
          input.style.borderColor = 'red';
          valid = false;
        } else if (input) {
          input.style.borderColor = '#d4af37';
        }
      });
      if (!valid) {
        alert('Please fill all required fields.');
        return;
      }

      // Show loader
      if (loader) loader.classList.remove('hidden');

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
          if (notification) {
            notification.textContent = 'Trade Saved Successfully';
            notification.classList.remove('hidden');
            setTimeout(() => notification.classList.add('hidden'), 3000);
          }
          if (tradeForm) tradeForm.reset();
          loadTrades();
          updateCharts();
        } else {
          alert('Error saving trade: ' + JSON.stringify(result.error));
        }
      } catch (error) {
        alert('Error: ' + error.message);
        console.error('Save Trade Error:', error);
      } finally {
        if (loader) loader.classList.add('hidden');
      }
    });
  }

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
      if (tradeTableBody) {
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
      }
      return trades;
    } catch (error) {
      console.error('Load Trades Error:', error);
      const tradeTableBody = document.getElementById('trade-table-body');
      if (tradeTableBody) {
        tradeTableBody.innerHTML = '<tr><td colspan="12">Error loading trades</td></tr>';
      }
      return [];
    }
  }

  // Update charts with time frame filter
  let timePnlChart, assetPnlChart, winLossChart, pnlDistributionChart;

  async function updateCharts() {
    const trades = await loadTrades();
    const timeFrame = timeFrameSelect ? timeFrameSelect.value : 'all';
    let filteredTrades = [...trades];

    if (timeFrame !== 'all') {
      const now = new Date();
      filteredTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.date);
        if (timeFrame === '7days') {
          return (now - tradeDate) <= 7 * 24 * 60 * 60 * 1000;
        } else if (timeFrame === '30days') {
          return (now - tradeDate) <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }

    if (filteredTrades.length === 0) return;

    // Time-Based P&L (Line Chart)
    const timePnlData = filteredTrades.reduce((acc, trade) => {
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
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
            gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
            return gradient;
          },
          borderWidth: 2,
          pointBackgroundColor: '#d4af37',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#d4af37'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Date', color: '#d4af37' } },
          y: { beginAtZero: true, title: { display: true, text: 'P&L', color: '#d4af37' }, ticks: { color: '#fff' } }
        },
        plugins: {
          legend: { labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff' }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });

    // Asset-Based P&L (Bar Chart)
    const assetPnlData = filteredTrades.reduce((acc, trade) => {
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
          backgroundColor: (context) => {
            const value = context.raw;
            return value >= 0 ? 'rgba(50, 205, 50, 0.8)' : 'rgba(255, 99, 132, 0.8)';
          },
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Asset Type', color: '#d4af37' } },
          y: { beginAtZero: true, title: { display: true, text: 'P&L', color: '#d4af37' }, ticks: { color: '#fff' } }
        },
        plugins: {
          legend: { labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff' }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });

    // Win vs Loss Count (Pie Chart)
    const winLossData = filteredTrades.reduce((acc, trade) => {
      if (trade.pnlNet > 0) acc.win++;
      else if (trade.pnlNet < 0) acc.loss++;
      else acc.breakEven++;
      return acc;
    }, { win: 0, loss: 0, breakEven: 0 });
    if (winLossChart) winLossChart.destroy();
    winLossChart = new Chart(document.getElementById('winLossChart'), {
      type: 'pie',
      data: {
        labels: ['Wins', 'Losses', 'Break-Even'],
        datasets: [{
          data: [winLossData.win, winLossData.loss, winLossData.breakEven],
          backgroundColor: ['#32CD32', '#FF4040', '#d4af37'],
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff' }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });

    // P&L Distribution (Bar Chart)
    const pnlData = filteredTrades.map(trade => trade.pnlNet);
    const pnlBins = [-1000, -500, -100, 0, 100, 500, 1000, Infinity];
    const pnlDistribution = pnlBins.slice(0, -1).map((bin, i) => ({
      label: `${bin} to ${pnlBins[i + 1] === Infinity ? '∞' : pnlBins[i + 1]}`,
      count: pnlData.filter(pnl => pnl >= bin && pnl < pnlBins[i + 1]).length
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
          backgroundColor: (context) => {
            const index = context.dataIndex;
            return index < pnlLabels.length / 2 ? 'rgba(255, 99, 132, 0.8)' : 'rgba(50, 205, 50, 0.8)';
          },
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'P&L Range', color: '#d4af37' } },
          y: { beginAtZero: true, title: { display: true, text: 'Count', color: '#d4af37' }, ticks: { color: '#fff' } }
        },
        plugins: {
          legend: { labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff' }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });
  }

  // Toggle views
  const tableTab = document.getElementById('table-tab');
  const analyticsTab = document.getElementById('analytics-tab');
  const tableView = document.getElementById('table-view');
  const analyticsView = document.getElementById('analytics-view');

  if (tableTab && analyticsTab && tableView && analyticsView) {
    tableTab.addEventListener('click', () => {
      tableTab.classList.add('active');
      analyticsTab.classList.remove('active');
      tableView.style.display = 'block';
      analyticsView.style.display = 'none';
    });

    analyticsTab.addEventListener('click', () => {
      analyticsTab.classList.add('active');
      tableTab.classList.remove('active');
      analyticsView.style.display = 'block';
      tableView.style.display = 'none';
      updateCharts();
    });
  }

  // Time frame change handler
  if (timeFrameSelect) {
    timeFrameSelect.addEventListener('change', () => {
      updateCharts();
    });
  }

  // Sync Modal
  const syncButton = document.getElementById('sync-mt-button');
  const closeModal = document.getElementsByClassName('close')[0];
  const syncForm = document.getElementById('sync-form');

  if (syncButton && closeModal && syncForm) {
    syncButton.addEventListener('click', () => syncModal.classList.remove('hidden'));
    closeModal.addEventListener('click', () => syncModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
      if (e.target === syncModal) syncModal.classList.add('hidden');
    });

    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loader) loader.classList.remove('hidden');

      const credentials = {
        platform: document.getElementById('platform').value,
        server: document.getElementById('server').value,
        accountNumber: document.getElementById('accountNumber').value,
        password: document.getElementById('password').value,
        nickname: document.getElementById('nickname').value,
      };
      localStorage.setItem('mtCredentials', btoa(JSON.stringify(credentials)));

      try {
        // Initialize MetaAPI account
        account = await metaApi.metatraderAccountApi.getAccount('your-account-id'); // Replace with your account ID
        await account.waitSynchronized();
        const trades = await account.getPositions();
        const tradeDataArray = trades.map(trade => ({
          date: new Date(trade.time).toISOString().split('T')[0],
          symbol: trade.symbol,
          assetType: 'Forex', // Adjust based on your needs
          buySell: trade.type === 'BUY' ? 'Buy' : 'Sell',
          entryPrice: trade.entryPrice,
          exitPrice: trade.currentPrice || 0,
          takeProfit: trade.stopLossPrice || 0,
          stopLoss: trade.takeProfitPrice || 0,
          pnlNet: trade.profit || 0,
          positionSize: trade.volume,
          strategyName: '',
          notes: ''
        }));

        // Save trades to worker
        for (const tradeData of tradeDataArray) {
          await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'writeTrade', tradeData })
          });
        }

        if (notification) {
          notification.textContent = 'Trades Synced Successfully';
          notification.classList.remove('hidden');
          setTimeout(() => notification.classList.add('hidden'), 3000);
        }
        syncModal.classList.add('hidden');
        loadTrades();
        updateCharts();
      } catch (error) {
        alert('Error syncing trades: ' + error.message);
        console.error('Sync Error:', error);
      } finally {
        if (loader) loader.classList.add('hidden');
      }
    });
  }

  // Export Table CSV
  if (exportTableCsv) {
    exportTableCsv.addEventListener('click', () => {
      const trades = loadTrades();
      const csv = [
        ['Date,Symbol,Asset Type,Buy/Sell,Entry Price,Exit Price,Take Profit,Stop Loss,P&L Net,Position Size,Strategy Name,Notes'],
        ...trades.then(trades => trades.map(trade =>
          `${trade.date || ''},${trade.symbol || ''},${trade.assetType || ''},${trade.buySell || ''},${trade.entryPrice.toFixed(5)},${trade.exitPrice.toFixed(5)},${trade.takeProfit.toFixed(5)},${trade.stopLoss.toFixed(5)},${trade.pnlNet.toFixed(2)},${trade.positionSize.toFixed(2)},${trade.strategyName || ''},${trade.notes || ''}`
        ))
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trade_journal.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  // Export Analytics CSV (Time-Based P&L)
  if (exportAnalyticsCsv) {
    exportAnalyticsCsv.addEventListener('click', async () => {
      const trades = await loadTrades();
      const timePnlData = trades.reduce((acc, trade) => {
        const date = trade.date;
        acc[date] = (acc[date] || 0) + trade.pnlNet;
        return acc;
      }, {});
      const timeLabels = Object.keys(timePnlData).sort();
      const timeData = timeLabels.map(date => timePnlData[date]);
      const csv = [
        ['Date,P&L'],
        ...timeLabels.map((date, index) => `${date},${timeData[index].toFixed(2)}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analytics_pnl.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  // Initial load
  loadTrades();
  if (analyticsTab && analyticsTab.classList.contains('active')) updateCharts();
});
