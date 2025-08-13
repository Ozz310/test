document.addEventListener('DOMContentLoaded', () => {
  const workerUrl = 'https://traders-gazette-proxy.mohammadosama310.workers.dev/';
  const loader = document.getElementById('loader');
  const notification = document.getElementById('notification');
  const entryFormCard = document.getElementById('entry-form-card');
  const syncModal = document.getElementById('sync-modal');
  const timeFrameSelect = document.getElementById('time-frame');
  const exportTableCsv = document.getElementById('export-table-csv');
  const exportAnalyticsCsv = document.getElementById('export-analytics-csv');

  const userId = 'test123';
  let tradesData = [];

  console.log(`Trading Journal loaded for user: ${userId}`);

  async function initializeUserSession() {
    // Create user-specific sheet on load
    try {
      await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createSheet', userId: userId }),
      });
      loadTrades();
    } catch (error) {
      console.error('Auto sheet creation failed:', error);
    }
  }

  // Call the initialization function on page load
  initializeUserSession();

  // Wait for MetaAPI SDK to load
  function initializeMetaApi() {
    return new Promise((resolve, reject) => {
      const checkMetaApi = setInterval(() => {
        if (typeof window.MetaApi !== 'undefined') {
          clearInterval(checkMetaApi);
          const metaApiToken = localStorage.getItem('metaApiToken');
          if (!metaApiToken) {
            console.error('MetaAPI token is not configured.');
            return reject('MetaAPI token is not configured.');
          }
          metaApi = new window.MetaApi.MetaApi(metaApiToken);
          resolve();
        }
      }, 100);
    });
  }

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
      if (loader) loader.classList.remove('hidden');

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
          body: JSON.stringify({ action: 'writeTrade', tradeData, userId: userId })
        });
        const result = await response.json();
        if (result.status === 'Trade saved') {
          showNotification('Trade Saved Successfully');
          if (tradeForm) tradeForm.reset();
          loadTrades();
        } else {
          showNotification('Error saving trade: ' + result.error, 'error');
        }
      } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        console.error('Save Trade Error:', error);
      } finally {
        if (loader) loader.classList.add('hidden');
      }
    });
  }

  // Load trades from sheets
  async function loadTrades() {
    if (loader) loader.classList.remove('hidden');
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readTrades', userId: userId })
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const trades = await response.json();
      tradesData = trades;
      console.log('Trades loaded:', tradesData);
      
      const tradeTableBody = document.getElementById('trade-table-body');
      if (tradeTableBody) {
        tradeTableBody.innerHTML = '';
        if (!Array.isArray(tradesData) || tradesData.length === 0) {
          tradeTableBody.innerHTML = '<tr><td colspan="12">No trades yet</td></tr>';
        } else {
          tradesData.forEach(trade => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${trade.date || ''}</td>
              <td>${trade.symbol || ''}</td>
              <td>${trade.assetType || ''}</td>
              <td>${trade.buySell || ''}</td>
              <td>${parseFloat(trade.entryPrice).toFixed(5)}</td>
              <td>${parseFloat(trade.exitPrice).toFixed(5)}</td>
              <td>${parseFloat(trade.takeProfit).toFixed(5)}</td>
              <td>${parseFloat(trade.stopLoss).toFixed(5)}</td>
              <td>${parseFloat(trade.pnlNet).toFixed(2)}</td>
              <td>${parseFloat(trade.positionSize).toFixed(2)}</td>
              <td>${trade.strategyName || ''}</td>
              <td>${trade.notes || ''}</td>
            `;
            tradeTableBody.appendChild(row);
          });
        }
      }
      return tradesData;
    } catch (error) {
      console.error('Load Trades Error:', error);
      showNotification('Error loading trades.', 'error');
      return [];
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  // Chart functions
  let timePnlChart, assetPnlChart, winLossChart, pnlDistributionChart;

  async function updateCharts() {
    const trades = tradesData;
    if (!trades || trades.length === 0) {
      document.querySelectorAll('.chart-card canvas').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#d4af37';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No trades to display.', canvas.width / 2, canvas.height / 2);
      });
      return;
    }

    const timeFrame = timeFrameSelect ? timeFrameSelect.value : 'all';
    let filteredTrades = [...trades];

    if (timeFrame !== 'all') {
      const now = new Date();
      filteredTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.date);
        const timeDiff = now.getTime() - tradeDate.getTime();
        if (timeFrame === '7days') return timeDiff <= 7 * 24 * 60 * 60 * 1000;
        if (timeFrame === '30days') return timeDiff <= 30 * 24 * 60 * 60 * 1000;
        return true;
      });
    }

    // Destroy existing charts
    if (timePnlChart) timePnlChart.destroy();
    if (assetPnlChart) assetPnlChart.destroy();
    if (winLossChart) winLossChart.destroy();
    if (pnlDistributionChart) pnlDistributionChart.destroy();

    // Time-Based P&L (Line Chart)
    const timePnlData = filteredTrades.reduce((acc, trade) => {
      const date = trade.date;
      acc[date] = (acc[date] || 0) + parseFloat(trade.pnlNet);
      return acc;
    }, {});
    const timeLabels = Object.keys(timePnlData).sort();
    const cumulativePnl = timeLabels.reduce((acc, date) => {
      const lastPnl = acc.length > 0 ? acc[acc.length - 1] : 0;
      acc.push(lastPnl + timePnlData[date]);
      return acc;
    }, []);
    timePnlChart = new Chart(document.getElementById('timePnlChart'), {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [{
          label: 'Cumulative P&L',
          data: cumulativePnl,
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
          pointHoverBorderColor: '#d4af37',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Date', color: '#d4af37' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { beginAtZero: true, title: { display: true, text: 'P&L', color: '#d4af37' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
        },
        plugins: {
          legend: { labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff', titleFont: { weight: 'bold' } }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });

    // Asset-Based P&L (Bar Chart)
    const assetPnlData = filteredTrades.reduce((acc, trade) => {
      acc[trade.assetType] = (acc[trade.assetType] || 0) + parseFloat(trade.pnlNet);
      return acc;
    }, {});
    const assetLabels = Object.keys(assetPnlData);
    const assetData = assetLabels.map(asset => assetPnlData[asset]);
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
          x: { title: { display: true, text: 'Asset Type', color: '#d4af37' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { beginAtZero: false, title: { display: true, text: 'P&L', color: '#d4af37' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
        },
        plugins: {
          legend: { labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff', titleFont: { weight: 'bold' } }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });

    // Win vs Loss Count (Pie Chart)
    const winLossData = filteredTrades.reduce((acc, trade) => {
      const pnl = parseFloat(trade.pnlNet);
      if (pnl > 0) acc.win++;
      else if (pnl < 0) acc.loss++;
      else acc.breakEven++;
      return acc;
    }, { win: 0, loss: 0, breakEven: 0 });
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
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff', titleFont: { weight: 'bold' } }
        },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });

    // P&L Distribution (Bar Chart)
    const pnlData = filteredTrades.map(trade => parseFloat(trade.pnlNet));
    const pnlBins = [-1000, -500, -100, 0, 100, 500, 1000, Infinity];
    const pnlDistribution = pnlBins.slice(0, -1).map((bin, i) => ({
      label: `${bin} to ${pnlBins[i + 1] === Infinity ? '∞' : pnlBins[i + 1]}`,
      count: pnlData.filter(pnl => pnl >= bin && pnl < pnlBins[i + 1]).length
    }));
    const pnlLabels = pnlDistribution.map(bin => bin.label);
    const pnlCounts = pnlDistribution.map(bin => bin.count);
    pnlDistributionChart = new Chart(document.getElementById('pnlDistributionChart'), {
      type: 'bar',
      data: {
        labels: pnlLabels,
        datasets: [{
          label: 'P&L Distribution',
          data: pnlCounts,
          backgroundColor: (context) => {
            const index = context.dataIndex;
            return pnlData[index] < 0 ? 'rgba(255, 99, 132, 0.8)' : 'rgba(50, 205, 50, 0.8)';
          },
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'P&L Range', color: '#d4af37' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { beginAtZero: true, title: { display: true, text: 'Count', color: '#d4af37' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
        },
        plugins: {
          legend: { labels: { color: '#d4af37' } },
          tooltip: { backgroundColor: '#252525', titleColor: '#d4af37', bodyColor: '#fff', titleFont: { weight: 'bold' } }
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
  const closeModal = document.querySelector('#sync-modal .close');
  const syncForm = document.getElementById('sync-form');

  if (syncButton && closeModal && syncForm) {
    syncButton.addEventListener('click', () => {
      syncModal.classList.remove('hidden');
    });
    closeModal.addEventListener('click', () => syncModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
      if (e.target === syncModal) syncModal.classList.add('hidden');
    });

    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loader) loader.classList.remove('hidden');
      syncModal.classList.add('hidden');

      const credentials = {
        platform: document.getElementById('mt-platform').value,
        server: document.getElementById('mt-server').value,
        accountNumber: document.getElementById('mt-accountNumber').value,
        password: document.getElementById('mt-password').value,
      };

      try {
        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'syncTrades', credentials, userId: userId })
        });
        const result = await response.json();
        if (result.status === 'Trades synced') {
          showNotification('Trades Synced Successfully');
          loadTrades();
        } else {
          showNotification('Error syncing trades: ' + result.error, 'error');
        }
      } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        console.error('Sync Error:', error);
      } finally {
        if (loader) loader.classList.add('hidden');
      }
    });
  }

  // Export Table CSV
  if (exportTableCsv) {
    exportTableCsv.addEventListener('click', () => {
      if (!tradesData || tradesData.length === 0) {
        showNotification('No data to export.', 'error');
        return;
      }
      const headers = ['Date', 'Symbol', 'Asset Type', 'Buy/Sell', 'Entry Price', 'Exit Price', 'Take Profit', 'Stop Loss', 'P&L Net', 'Position Size', 'Strategy Name', 'Notes'];
      const csv = [
        headers.join(','),
        ...tradesData.map(trade => 
          `${trade.date || ''},${trade.symbol || ''},${trade.assetType || ''},${trade.buySell || ''},${parseFloat(trade.entryPrice).toFixed(5)},${parseFloat(trade.exitPrice).toFixed(5)},${parseFloat(trade.takeProfit).toFixed(5)},${parseFloat(trade.stopLoss).toFixed(5)},${parseFloat(trade.pnlNet).toFixed(2)},${parseFloat(trade.positionSize).toFixed(2)},"${(trade.strategyName || '').replace(/"/g, '""')}","${(trade.notes || '').replace(/"/g, '""')}"`
        )
      ].join('\n');
      downloadCSV(csv, 'trade_journal.csv');
    });
  }

  // Export Analytics CSV (Time-Based P&L)
  if (exportAnalyticsCsv) {
    exportAnalyticsCsv.addEventListener('click', () => {
      if (!tradesData || tradesData.length === 0) {
        showNotification('No data to export.', 'error');
        return;
      }
      const timePnlData = tradesData.reduce((acc, trade) => {
        const date = trade.date;
        acc[date] = (acc[date] || 0) + parseFloat(trade.pnlNet);
        return acc;
      }, {});
      const timeLabels = Object.keys(timePnlData).sort();
      const timeData = timeLabels.map(date => timePnlData[date]);
      const csv = [
        'Date,P&L',
        ...timeLabels.map((date, index) => `${date},${timeData[index].toFixed(2)}`)
      ].join('\n');
      downloadCSV(csv, 'analytics_pnl.csv');
    });
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('CSV Downloaded Successfully');
  }
  
  function showNotification(message, type = 'success') {
    if (notification) {
      notification.textContent = message;
      notification.style.color = type === 'success' ? '#d4af37' : '#FF4040';
      notification.classList.remove('hidden');
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
  }

});
