document.addEventListener('DOMContentLoaded', () => {
  const workerUrl = 'https://traders-gazette-proxy.mohammadosama310.workers.dev/';
  const loader = document.getElementById('loader');
  const notification = document.getElementById('notification');
  const entryFormCard = document.getElementById('entry-form-card');
  const syncModal = document.getElementById('sync-modal');
  const uploadCsvModal = document.getElementById('upload-csv-modal');
  const timeFrameSelect = document.getElementById('time-frame');
  const exportTableCsv = document.getElementById('export-table-csv');
  const exportAnalyticsCsv = document.getElementById('export-analytics-csv');

  const userId = 'test123';
  let tradesData = [];

  console.log(`Trading Journal loaded for user: ${userId}`);

  async function initializeUserSession() {
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

  initializeUserSession();

  function showNotification(message, type = 'success') {
    if (notification) {
      notification.textContent = message;
      notification.style.color = type === 'success' ? '#d4af37' : '#FF4040';
      notification.classList.remove('hidden');
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
  }

  // Helper function for API calls
  async function makeApiCall(action, payload) {
    if (loader) loader.classList.remove('hidden');
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload, userId }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      if (result.status === 'Error') {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
      console.error(`API call for ${action} failed:`, error);
      return null;
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  // Trade Form Submission (Manual Entry)
  const addEntryButton = document.getElementById('add-entry-button');
  const tradeForm = document.getElementById('trade-form');
  if (addEntryButton && tradeForm) {
    addEntryButton.addEventListener('click', () => {
      entryFormCard.classList.toggle('hidden');
      syncModal.classList.add('hidden');
      uploadCsvModal.classList.add('hidden');
    });

    tradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
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
      
      const result = await makeApiCall('writeTrade', { tradeData });
      if (result) {
        showNotification('Trade Saved Successfully');
        tradeForm.reset();
        loadTrades();
      }
    });
  }

  // MetaQuotes Sync Modal
  const syncButton = document.getElementById('sync-mt-button');
  const syncForm = document.getElementById('sync-form');
  if (syncButton && syncForm) {
    syncButton.addEventListener('click', () => {
      syncModal.classList.remove('hidden');
      entryFormCard.classList.add('hidden');
      uploadCsvModal.classList.add('hidden');
    });

    document.querySelector('#sync-modal .close').addEventListener('click', () => syncModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
      if (e.target === syncModal) syncModal.classList.add('hidden');
    });

    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      syncModal.classList.add('hidden');
      const credentials = {
        platform: document.getElementById('mt-platform').value,
        server: document.getElementById('mt-server').value,
        accountNumber: document.getElementById('mt-accountNumber').value,
        password: document.getElementById('mt-password').value,
        nickname: document.getElementById('mt-nickname').value,
      };
      const result = await makeApiCall('syncTrades', { credentials });
      if (result) {
        showNotification('Trades Synced Successfully');
        loadTrades();
      }
    });
  }

  // CSV Upload Modal
  const uploadCsvButton = document.getElementById('upload-csv-button');
  const uploadCsvForm = document.getElementById('upload-csv-form');
  if (uploadCsvButton && uploadCsvForm) {
    uploadCsvButton.addEventListener('click', () => {
      uploadCsvModal.classList.remove('hidden');
      entryFormCard.classList.add('hidden');
      syncModal.classList.add('hidden');
    });
    
    document.getElementById('close-csv-modal').addEventListener('click', () => uploadCsvModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
      if (e.target === uploadCsvModal) uploadCsvModal.classList.add('hidden');
    });

    uploadCsvForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('csv-file');
      const file = fileInput.files[0];
      if (!file) {
        showNotification('Please select a file.', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csvText = event.target.result;
        const trades = parseCsv(csvText);
        if (trades.length > 0) {
          const result = await makeApiCall('writeTradesBulk', { trades });
          if (result) {
            showNotification(`Uploaded ${result.newTradesCount} new trades successfully.`);
            uploadCsvModal.classList.add('hidden');
            loadTrades();
          }
        } else {
          showNotification('No valid trades found in CSV.', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  function parseCsv(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const trades = [];
    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i].split(',');
      if (currentLine.length === headers.length) {
        const trade = {};
        for (let j = 0; j < headers.length; j++) {
          trade[headers[j]] = currentLine[j].trim();
        }
        trades.push(trade);
      }
    }
    return trades;
  }

  // Load trades from sheets
  async function loadTrades() {
    const result = await makeApiCall('readTrades');
    if (result) {
      tradesData = result;
      console.log('Trades loaded:', tradesData);
      
      const tradeTableBody = document.getElementById('trade-table-body');
      if (tradeTableBody) {
        tradeTableBody.innerHTML = '';
        if (!Array.isArray(tradesData) || tradesData.length === 0) {
          tradeTableBody.innerHTML = '<tr><td colspan="12">No trades yet</td></tr>';
        } else {
          tradesData.forEach(trade => {
            const row = document.createElement('tr');
            const entryPrice = parseFloat(trade['Entry Price']);
            const exitPrice = parseFloat(trade['Exit Price']);
            const takeProfit = parseFloat(trade['Take Profit']);
            const stopLoss = parseFloat(trade['Stop Loss']);
            const pnlNet = parseFloat(trade['P&L Net']);
            const positionSize = parseFloat(trade['Position Size']);

            row.innerHTML = `
              <td>${trade.Date || ''}</td>
              <td>${trade.Symbol || ''}</td>
              <td>${trade['Asset Type'] || ''}</td>
              <td>${trade['Buy/Sell'] || ''}</td>
              <td>${!isNaN(entryPrice) ? entryPrice.toFixed(5) : 'N/A'}</td>
              <td>${!isNaN(exitPrice) ? exitPrice.toFixed(5) : 'N/A'}</td>
              <td>${!isNaN(takeProfit) ? takeProfit.toFixed(5) : 'N/A'}</td>
              <td>${!isNaN(stopLoss) ? stopLoss.toFixed(5) : 'N/A'}</td>
              <td>${!isNaN(pnlNet) ? pnlNet.toFixed(2) : 'N/A'}</td>
              <td>${!isNaN(positionSize) ? positionSize.toFixed(2) : 'N/A'}</td>
              <td>${trade['Strategy Name'] || ''}</td>
              <td>${trade.Notes || ''}</td>
            `;
            tradeTableBody.appendChild(row);
          });
        }
      }
    }
  }

  // (The rest of the script, including updateCharts(), export functions, etc., remains the same as our previous working version.)
  // Please ensure you copy the entire script, as all functions are interdependent.
});
