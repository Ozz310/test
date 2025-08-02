// API Key provided by the user
const API_KEY = "c27c0cc562a3bfd70fff7003";

// Base URL for the Exchangerate API, using a dynamic base currency
const API_BASE_URL = "https://v6.exchangerate-api.com/v6/";

// --- DOM elements ---
const accountCurrencySelect = document.getElementById('accountCurrency');
const leverageSelect = document.getElementById('leverage');
const currencyPairSelect = document.getElementById('currencyPair');
const tradeSizeInput = document.getElementById('tradeSize');
const tradeSizeLabel = document.getElementById('tradeSizeLabel');
const ratePairDisplay = document.getElementById('ratePairDisplay');
const currentRateDisplay = document.getElementById('currentRateDisplay');
const requiredMarginDisplay = document.getElementById('requiredMarginDisplay');
const marginCurrencySymbol = document.getElementById('marginCurrencySymbol');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const loadingSpinner = document.getElementById('loadingSpinner');
const pipValueRow = document.getElementById('pipValueRow');
const pipValueDisplay = document.getElementById('pipValueDisplay');
const pipValueCurrencySymbol = document.getElementById('pipValueCurrencySymbol');

// --- Event Listeners ---
window.onload = fetchAndDisplayInitialRate;
currencyPairSelect.addEventListener('change', () => {
    fetchAndDisplayInitialRate();
    updateTradeSizeLabel();
});

// --- Message Box Functions ---
function showMessage(message, type = 'info') {
    messageText.textContent = message;
    messageBox.classList.add('show');
    messageBox.style.backgroundColor = (type === 'error') ? '#d32f2f' : '#333';
}

function hideMessage() {
    messageBox.classList.remove('show');
}

function showLoading() {
    loadingSpinner.classList.add('show');
}

function hideLoading() {
    loadingSpinner.classList.remove('show');
}

// --- Helper Functions ---
function getAssetType(symbol) {
    if (symbol.length === 6 && !symbol.startsWith('X')) {
        return 'forex';
    } else if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) {
        return 'metal';
    }
    // These are placeholders for now as the API does not support them in the provided example
    // We will show an error message if the user tries to select them
    else if (['AAPL', 'TSLA', 'GOOGL'].includes(symbol)) {
        return 'stock';
    } else if (['US30', 'SPX500', 'NAS100', 'UK100'].includes(symbol)) {
        return 'index';
    } else if (['BTCUSD', 'ETHUSD', 'XRPUSD'].includes(symbol)) {
        return 'crypto';
    }
    return 'unknown';
}

function updateTradeSizeLabel() {
    const selectedSymbol = currencyPairSelect.value;
    const assetType = getAssetType(selectedSymbol);
    let labelText = "Trade Size (Units):";
    let defaultValue = "1";

    switch (assetType) {
        case 'forex':
            labelText = "Trade Size (Base Currency Units):";
            defaultValue = "100000";
            break;
        case 'metal':
            labelText = "Trade Size (Ounces):";
            defaultValue = "1";
            break;
        case 'stock':
            labelText = "Trade Size (Shares):";
            defaultValue = "1";
            break;
        case 'index':
            labelText = "Trade Size (Contracts/Units):";
            defaultValue = "1";
            break;
        case 'crypto':
            labelText = "Trade Size (Coins):";
            defaultValue = "1";
            break;
    }
    tradeSizeLabel.textContent = labelText;
    tradeSizeInput.value = defaultValue;
    tradeSizeInput.placeholder = `e.g., ${defaultValue}`;
}

function getPipPointDetails(symbol) {
    const assetType = getAssetType(symbol);
    let pipSize = 0;
    let valueLabel = 'N/A';
    let isPipCalculable = false;

    switch (assetType) {
        case 'forex':
            isPipCalculable = true;
            valueLabel = 'Pip Value';
            if (symbol.includes('JPY')) {
                pipSize = 0.01;
            } else {
                pipSize = 0.0001;
            }
            break;
        case 'metal':
            isPipCalculable = true;
            valueLabel = 'Point Value';
            pipSize = 1;
            break;
        case 'stock':
        case 'index':
        case 'crypto':
            isPipCalculable = false;
            valueLabel = 'N/A';
            break;
    }
    return { pipSize, valueLabel, isPipCalculable };
}

function parseSymbol(symbol) {
    if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) {
        return { base: symbol.substring(0, 3), quote: symbol.substring(3, 6) };
    } else if (symbol.length === 6) {
        return { base: symbol.substring(0, 3), quote: symbol.substring(3, 6) };
    }
    // These assets are not supported, so return a placeholder
    return { base: '', quote: '' };
}

// --- Core Logic ---
async function fetchConversionRates(baseCurrency) {
    showLoading();
    try {
        const url = `${API_BASE_URL}${API_KEY}/latest/${baseCurrency}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === 'success') {
            return data.conversion_rates;
        } else if (data.result === 'error') {
            const errorMsg = data["error-type"] || 'Unknown API Error';
            showMessage(`API Error: ${errorMsg}. Please check your API key or plan.`, 'error');
            return null;
        }
    } catch (error) {
        console.error("Error fetching rates:", error);
        showMessage(`Failed to fetch rates. Check your internet connection.`, 'error');
        return null;
    } finally {
        hideLoading();
    }
}

async function fetchAndDisplayInitialRate() {
    const selectedSymbol = currencyPairSelect.value;
    const { base, quote } = parseSymbol(selectedSymbol);

    if (!base || !quote) {
        currentRateDisplay.textContent = 'N/A';
        return;
    }

    ratePairDisplay.textContent = `${base}/${quote}`;

    const rates = await fetchConversionRates(base);
    if (rates && rates[quote]) {
        currentRateDisplay.textContent = rates[quote].toFixed(5);
    } else {
        currentRateDisplay.textContent = 'N/A';
    }
}

async function calculateMargin() {
    hideMessage();
    showLoading();

    const accountCurrency = accountCurrencySelect.value;
    const leverage = parseFloat(leverageSelect.value);
    const selectedSymbol = currencyPairSelect.value;
    const tradeSizeUnits = parseFloat(tradeSizeInput.value);

    const assetType = getAssetType(selectedSymbol);
    if (assetType === 'unknown' || assetType === 'stock' || assetType === 'index' || assetType === 'crypto') {
        showMessage("This calculator only supports Forex pairs and Metals with the current API.", 'error');
        hideLoading();
        return;
    }
    
    if (isNaN(tradeSizeUnits) || tradeSizeUnits <= 0) {
        showMessage("Please enter a valid Trade Size (Units).", 'error');
        hideLoading();
        return;
    }
    if (leverage <= 0) {
        showMessage("Invalid Leverage selected.", 'error');
        hideLoading();
        return;
    }

    const { base: baseCurrencyOfPair, quote: quoteCurrencyOfPair } = parseSymbol(selectedSymbol);
    
    const baseRates = await fetchConversionRates(baseCurrencyOfPair);
    if (!baseRates) {
        requiredMarginDisplay.textContent = 'N/A';
        marginCurrencySymbol.textContent = accountCurrency;
        pipValueDisplay.textContent = 'N/A';
        pipValueCurrencySymbol.textContent = '';
        return;
    }
    const currentPrice = baseRates[quoteCurrencyOfPair];
    currentRateDisplay.textContent = currentPrice.toFixed(5);
    
    let marginRequiredInBaseCurrency = (currentPrice * tradeSizeUnits) / leverage;

    let finalMarginAmount = marginRequiredInBaseCurrency;
    
    // The margin base currency is not always the pair's base currency (e.g. for USD/JPY, the margin is calculated in USD)
    let marginCurrency = (assetType === 'forex') ? baseCurrencyOfPair : quoteCurrencyOfPair;

    // We now have the correct base currency, so we can convert it to the account currency
    if (marginCurrency !== accountCurrency) {
        const conversionRates = await fetchConversionRates(marginCurrency);
        if (!conversionRates || !conversionRates[accountCurrency]) {
            showMessage(`Could not fetch conversion rate from ${marginCurrency} to ${accountCurrency}. Margin may be inaccurate.`, 'error');
            requiredMarginDisplay.textContent = finalMarginAmount.toFixed(2);
            marginCurrencySymbol.textContent = marginCurrency;
            hideLoading();
            return;
        }
        finalMarginAmount = finalMarginAmount * conversionRates[accountCurrency];
    }
    
    requiredMarginDisplay.textContent = finalMarginAmount.toFixed(2);
    marginCurrencySymbol.textContent = accountCurrency;

    const { pipSize, valueLabel, isPipCalculable } = getPipPointDetails(selectedSymbol);
    
    if (isPipCalculable) {
        let pipPointValue = tradeSizeUnits * pipSize;
        
        if (quoteCurrencyOfPair !== accountCurrency) {
            const conversionRates = await fetchConversionRates(quoteCurrencyOfPair);
            if (!conversionRates || !conversionRates[accountCurrency]) {
                showMessage(`Could not fetch conversion rate for pip/point value from ${quoteCurrencyOfPair} to ${accountCurrency}.`, 'error');
                pipValueDisplay.textContent = 'N/A';
                pipValueCurrencySymbol.textContent = '';
                hideLoading();
                return;
            }
            const conversionRateForPip = conversionRates[accountCurrency];
            pipPointValue = pipPointValue * conversionRateForPip;
        }

        pipValueDisplay.textContent = pipPointValue.toFixed(2);
        pipValueCurrencySymbol.textContent = accountCurrency;
        pipValueRow.style.display = 'flex';
    } else {
        pipValueDisplay.textContent = valueLabel;
        pipValueCurrencySymbol.textContent = '';
        pipValueRow.style.display = 'flex';
    }
    
    hideLoading();
}
