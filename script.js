// --- API Keys ---
const API_KEY = "c27c0cc562a3bfd70fff7003";
const API_BASE_URL = "https://v6.exchangerate-api.com/v6/";

// --- DOM Elements ---
const accountCurrencySelect = document.getElementById('accountCurrency');
const leverageSelect = document.getElementById('leverage');
const currencyPairSelect = document.getElementById('currencyPair');
const tradeSizeInput = document.getElementById('tradeSize');
const tradeSizeLabel = document.getElementById('tradeSizeLabel');
const requiredMarginDisplay = document.getElementById('requiredMarginDisplay').querySelector('p');
const marginCurrencySymbol = document.getElementById('marginCurrencySymbol');
const pipValueRow = document.getElementById('pipValueRow');
const pipValueDisplay = document.getElementById('pipValueRow').querySelector('p');
const pipValueCurrencySymbol = document.getElementById('pipValueCurrencySymbol');
const capitalInput = document.getElementById('capital');
const riskPercentSlider = document.getElementById('risk_percent_slider');
const riskPercentValue = document.getElementById('risk_percent_value');
const entryPriceInput = document.getElementById('entry_price');
const stopLossPriceInput = document.getElementById('stop_loss_price');
const takeProfitPriceInput = document.getElementById('take_profit_price');
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
document.addEventListener('DOMContentLoaded', updateTradeSizeLabel);
currencyPairSelect.addEventListener('change', () => {
    updateTradeSizeLabel();
});

// --- Message Box Functions ---
function showMessage(message, type = 'info') {
    messageText.textContent = message;
    messageBox.style.backgroundColor = (type === 'error') ? '#d32f2f' : '#333';
    messageBox.classList.add('show');
    resultArea.style.display = 'block';
}
function hideMessage() { messageBox.classList.remove('show'); }

// --- Helper functions ---
function getPipValue(entry, stop, symbol) {
    const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
    return Math.abs(entry - stop) * pipMultiplier;
}

async function fetchExchangeRate(base, target) {
    try {
        const url = `${API_BASE_URL}${API_KEY}/pair/${base}/${target}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.result === 'success') {
            return data.conversion_rate;
        } else {
            console.error(`API Error: ${data['error-type']}`);
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
    const isJPY = selectedSymbol.includes('JPY');
    const labelText = "Trade Size (Units):";
    let defaultValue = isJPY ? "100000" : "100000";
    tradeSizeLabel.textContent = labelText;
    tradeSizeInput.value = defaultValue;
    tradeSizeInput.placeholder = `e.g., ${defaultValue}`;
}

// --- Margin Calculator Logic ---
async function calculateMargin() {
    hideMessage();
    const accountCurrency = accountCurrencySelect.value;
    const leverage = parseFloat(leverageSelect.value);
    const currencyPair = currencyPairSelect.value;
    const tradeSizeUnits = parseFloat(tradeSizeInput.value);
    const [baseCurrency, quoteCurrency] = currencyPair.split('/');

    if (isNaN(tradeSizeUnits) || tradeSizeUnits <= 0 || isNaN(leverage) || leverage <= 0) {
        return showMessage("Please enter valid inputs for Margin.", 'error');
    }

    let marginRequired = (tradeSizeUnits / leverage);

    if (baseCurrency !== accountCurrency) {
        const conversionRate = await fetchExchangeRate(baseCurrency, accountCurrency);
        if (conversionRate) {
            marginRequired *= conversionRate;
        } else {
            return showMessage(`Could not fetch conversion rate for ${baseCurrency}/${accountCurrency}. Margin may be inaccurate.`, 'error');
        }
    }

    requiredMarginDisplay.textContent = `$${marginRequired.toFixed(2)}`;
    marginCurrencySymbol.textContent = accountCurrency;

    const pipSize = currencyPair.includes('JPY') ? 0.01 : 0.0001;
    let pipValue = tradeSizeUnits * pipSize;

    if (quoteCurrency !== accountCurrency) {
        const conversionRate = await fetchExchangeRate(quoteCurrency, accountCurrency);
        if (conversionRate) {
            pipValue *= conversionRate;
        } else {
            return showMessage(`Could not fetch conversion rate for pip value.`, 'error');
        }
    }
    pipValueDisplay.textContent = `$${pipValue.toFixed(2)}`;
    pipValueCurrencySymbol.textContent = accountCurrency;
    pipValueRow.parentElement.style.display = 'block';

    // Reset other results
    riskAmountDisplay.textContent = '--';
    stopLossPipsDisplay.textContent = '--';
    recommendedUnitsDisplay.textContent = '--';
    rrRatioDisplay.textContent = '--';
    
    resultArea.style.display = 'block';
}

// --- Position Size & Risk/Reward Logic ---
async function calculateRiskRewardAndPosition() {
    hideMessage();
    const capital = parseFloat(capitalInput.value);
    const riskPercent = parseFloat(riskPercentSlider.value);
    const entryPrice = parseFloat(entryPriceInput.value);
    const stopLossPrice = parseFloat(stopLossPriceInput.value);
    const takeProfitPrice = parseFloat(takeProfitPriceInput.value);
    const currencyPair = currencyPairSelect.value;
    const accountCurrency = accountCurrencySelect.value;

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
    const stopLossPips = getPipValue(entryPrice, stopLossPrice, currencyPair);
    const pipValueInQuote = await getPipValueInQuoteCurrency(currencyPair);
    const conversionRate = await fetchExchangeRate(currencyPair.split('/')[1], accountCurrency);
    
    if (pipValueInQuote === null || conversionRate === null) {
        return showMessage("Could not fetch necessary conversion rates.", 'error');
    }

    const riskPerUnit = Math.abs(entryPrice - stopLossPrice) * 1; // 1 unit
    const recommendedUnits = riskAmount / (riskPerUnit * conversionRate)
    
    const risk = Math.abs(entryPrice - stopLossPrice);
    const reward = Math.abs(entryPrice - takeProfitPrice);
    let rrRatio = 'N/A';
    if (!isNaN(takeProfitPrice) && takeProfitPrice > 0 && risk !== 0) {
        rrRatio = (reward / risk).toFixed(2);
    }
    
    // Reset Margin results
    requiredMarginDisplay.textContent = '--';
    marginCurrencySymbol.textContent = '';
    pipValueDisplay.textContent = '--';
    pipValueCurrencySymbol.textContent = '';

    riskAmountDisplay.textContent = `$${riskAmount.toFixed(2)}`;
    stopLossPipsDisplay.textContent = `${stopLossPips.toFixed(1)} pips`;
    recommendedUnitsDisplay.textContent = `${recommendedUnits.toFixed(0)}`;
    rrRatioDisplay.textContent = `1:${rrRatio}`;
    
    resultArea.style.display = 'block';
}

async function getPipValueInQuoteCurrency(currencyPair) {
    const [base, quote] = currencyPair.split('/');
    const pipMultiplier = currencyPair.includes('JPY') ? 0.01 : 0.0001;
    
    // For a standard lot (100,000 units), pip value is 10 in quote currency
    // For 1 unit, it's 10 / 100,000 = 0.0001
    // For 100,000 units, pip value is (100000 * 0.0001) = 10
    // This is the value of one pip in the QUOTE currency
    return 10; 
}
