// --- API Keys ---
const API_KEY = "c27c0cc562a3bfd70fff7003";
const API_BASE_URL = "https://v6.exchangerate-api.com/v6/";

// --- DOM Elements ---
const accountCurrencySelect = document.getElementById('accountCurrency');
const leverageSelect = document.getElementById('leverage');
const currencyPairSelect = document.getElementById('currencyPair');
const tradeSizeInput = document.getElementById('tradeSize');
const tradeSizeLabel = document.getElementById('tradeSizeLabel');
const requiredMarginDisplay = document.getElementById('requiredMarginDisplay');
const marginCurrencySymbol = document.getElementById('marginCurrencySymbol');
const pipValueRow = document.getElementById('pipValueRow');
const pipValueDisplay = document.getElementById('pipValueDisplay');
const pipValueCurrencySymbol = document.getElementById('pipValueCurrencySymbol');
const capitalInput = document.getElementById('capital');
const riskPercentSlider = document.getElementById('risk_percent_slider');
const riskPercentValue = document.getElementById('risk_percent_value');
const entryPriceInput = document.getElementById('entry_price');
const stopLossPriceInput = document.getElementById('stop_loss_price');
const takeProfitPriceInput = document.getElementById('take_profit_price');
const rrEntryPriceInput = document.getElementById('entry_price');
const rrStopLossPriceInput = document.getElementById('stop_loss_price');
const resultArea = document.getElementById('resultArea');
const riskAmountDisplay = document.getElementById('risk_amount');
const stopLossPipsDisplay = document.getElementById('stop_loss_pips');
const recommendedUnitsDisplay = document.getElementById('recommended_units');
const rrRatioDisplay = document.getElementById('rr_ratio');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    riskPercentSlider.addEventListener('input', function() {
        riskPercentValue.textContent = this.value;
    });
});

// --- Message Box Functions ---
function showMessage(message, type = 'info') {
    messageText.textContent = message;
    messageBox.classList.add('show');
    messageBox.style.backgroundColor = (type === 'error') ? '#d32f2f' : '#333';
}
function hideMessage() { messageBox.classList.remove('show'); }

// --- Helper functions ---
function getPipPointDetails(entry, stop, symbol) {
    let pips = Math.abs(entry - stop);
    if (symbol.includes('JPY')) { pips = pips * 100; } 
    else { pips = pips * 10000; }
    return pips.toFixed(2);
}
function getAssetType(symbol) {
    if (symbol.includes('/') && !symbol.startsWith('X')) { return 'forex'; }
    return 'unknown';
}
async function fetchExchangeRate(base, target) {
    try {
        const url = `${API_BASE_URL}${API_KEY}/pair/${base}/${target}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.result === 'success') {
            return data.conversion_rate;
        } else {
            showMessage(`Could not fetch conversion rate for ${base}/${target}.`, 'error');
            return null;
        }
    } catch (error) {
        console.error("Error fetching rate for", base, target, ":", error);
        return null;
    }
}
function updateTradeSizeLabel() {
    const selectedSymbol = currencyPairSelect.value;
    const assetType = getAssetType(selectedSymbol);
    let labelText = "Trade Size (Units):";
    let defaultValue = "100000";
    if (assetType === 'forex') {
        labelText = "Trade Size (Base Currency Units):";
        defaultValue = "100000";
    }
    tradeSizeLabel.textContent = labelText;
    tradeSizeInput.value = defaultValue;
    tradeSizeInput.placeholder = `e.g., ${defaultValue}`;
}
document.addEventListener('DOMContentLoaded', updateTradeSizeLabel);
currencyPairSelect.addEventListener('change', () => {
    updateTradeSizeLabel();
});

// --- Margin Calculator Logic ---
async function calculateMargin() {
    hideMessage();
    const accountCurrency = accountCurrencySelect.value;
    const leverage = parseFloat(leverageSelect.value);
    const currencyPair = currencyPairSelect.value;
    const tradeSizeUnits = parseFloat(tradeSizeInput.value);
    const [baseCurrency, quoteCurrency] = currencyPair.split('/');

    if (isNaN(tradeSizeUnits) || tradeSizeUnits <= 0 || leverage <= 0) {
        return showMessage("Please enter valid inputs for Margin.", 'error');
    }

    let marginRequiredInBaseCurrency = (tradeSizeUnits / leverage);
    
    if (baseCurrency !== accountCurrency) {
         const conversionRate = await fetchExchangeRate(baseCurrency, accountCurrency);
         if (conversionRate) {
             marginRequiredInBaseCurrency *= conversionRate;
         } else {
             return showMessage(`Could not fetch conversion rate for ${baseCurrency}/${accountCurrency}. Margin may be inaccurate.`, 'error');
         }
    }
    
    requiredMarginDisplay.textContent = marginRequiredInBaseCurrency.toFixed(2);
    marginCurrencySymbol.textContent = accountCurrency;

    const pipSize = currencyPair.includes('JPY') ? 0.01 : 0.0001;
    let pipPointValue = tradeSizeUnits * pipSize;
    
    if (quoteCurrency !== accountCurrency) {
        const conversionRate = await fetchExchangeRate(quoteCurrency, accountCurrency);
        if (conversionRate) {
            pipPointValue *= conversionRate;
        } else {
            return showMessage(`Could not fetch conversion rate for pip value.`, 'error');
        }
    }
    pipValueDisplay.textContent = pipPointValue.toFixed(2);
    pipValueCurrencySymbol.textContent = accountCurrency;
    pipValueRow.style.display = 'flex';
    
    // Clear other results
    riskAmountDisplay.textContent = 'N/A';
    stopLossPipsDisplay.textContent = 'N/A';
    recommendedUnitsDisplay.textContent = 'N/A';
    rrRatioDisplay.textContent = 'N/A';
    
    resultArea.style.display = 'block';
}

// --- Position Size & Risk/Reward Logic ---
function calculateRiskRewardAndPosition() {
    hideMessage();
    const capital = parseFloat(capitalInput.value);
    const riskPercent = parseFloat(riskPercentSlider.value);
    const entryPrice = parseFloat(entryPriceInput.value);
    const stopLossPrice = parseFloat(stopLossPriceInput.value);
    const takeProfitPrice = parseFloat(takeProfitPriceInput.value);

    if (isNaN(capital) || isNaN(riskPercent) || isNaN(entryPrice) || isNaN(stopLossPrice)) {
         return showMessage("Please enter valid inputs for the Position Size Calculator.", 'error');
    }
    if (capital <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLossPrice <= 0) {
        return showMessage("All values must be positive.", 'error');
    }
    if (riskPercent > 100) {
         return showMessage("Risk percent cannot exceed 100.", 'error');
    }
    if (entryPrice === stopLossPrice) {
         return showMessage("Entry and Stop Loss cannot be the same.", 'error');
    }
    
    const riskAmount = capital * (riskPercent / 100);
    const stopLossPips = getPipPointDetails(entryPrice, stopLossPrice, 'EURUSD'); // Simplified for now
    const recommendedUnits = riskAmount / Math.abs(entryPrice - stopLossPrice);
    
    const risk = Math.abs(entryPrice - stopLossPrice);
    const reward = Math.abs(entryPrice - takeProfitPrice);
    let rrRatio = 'N/A';
    if (!isNaN(takeProfitPrice) && takeProfitPrice > 0 && risk !== 0) {
         rrRatio = (reward / risk).toFixed(2);
    }
    
    // Clear other results
    requiredMarginDisplay.textContent = 'N/A';
    marginCurrencySymbol.textContent = '';
    pipValueDisplay.textContent = 'N/A';
    pipValueCurrencySymbol.textContent = '';

    riskAmountDisplay.textContent = `$${riskAmount.toFixed(2)}`;
    stopLossPipsDisplay.textContent = `${stopLossPips} pips`;
    recommendedUnitsDisplay.textContent = recommendedUnits.toFixed(2);
    rrRatioDisplay.textContent = `1:${rrRatio}`;
    
    resultArea.style.display = 'block';
}
