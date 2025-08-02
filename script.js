// IMPORTANT: Replace with your actual API Key from exchangerate-api.com
const API_KEY = "c27c0cc562a3bfd70fff7003";

// Base URL for the Exchangerate API
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
    if (type === 'error') {
        messageBox.style.backgroundColor = '#d32f2f';
    } else {
        messageBox.style.backgroundColor = '#333';
    }
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
function getContractDetails(symbol) {
    return { contractSize: 1, marginFactor: 1 };
}

function updateTradeSizeLabel() {
    tradeSizeLabel.textContent = "Trade Size (Base Currency Units):";
    tradeSizeInput.value = "100000";
    tradeSizeInput.placeholder = `e.g., 100000`;
}

function getPipPointDetails(symbol) {
    let pipSize = 0;
    let valueLabel = 'Pip Value';
    let isPipCalculable = true;

    if (symbol.includes('JPY')) {
        pipSize = 0.01;
    } else {
        pipSize = 0.0001;
    }
    return { pipSize, valueLabel, isPipCalculable };
}

function parseSymbol(symbol) {
    return { base: symbol.substring(0, 3), quote: symbol.substring(3, 6) };
}

// --- Core Logic ---
async function fetchConversionRates(baseCurrency) {
    hideMessage();
    showLoading();
    try {
        const url = `${API_BASE_URL}${API_KEY}/latest/${baseCurrency}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.result === 'success') {
            return data.conversion_rates;
        } else if (data.result === 'error') {
            showMessage(`API Error: ${data["error-type"]}.`, 'error');
            return null;
        } else {
            showMessage(`Could not fetch conversion rates for ${baseCurrency}.`, 'error');
            return null;
        }
    } catch (error) {
        console.error("Error fetching rates for", baseCurrency, ":", error);
        showMessage(`Failed to fetch live rates for ${baseCurrency}. Check your internet connection or API key.`, 'error');
        return null;
    } finally {
        hideLoading();
    }
}

async function fetchAndDisplayInitialRate() {
    const selectedSymbol = currencyPairSelect.value;
    ratePairDisplay.textContent = selectedSymbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');

    const { base, quote } = parseSymbol(selectedSymbol);
    const conversionRates = await fetchConversionRates(base);
    if (conversionRates && conversionRates[quote]) {
        currentRateDisplay.textContent = conversionRates[quote].toFixed(5);
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
    let marginBaseCurrency = baseCurrencyOfPair;
    
    if (marginBaseCurrency !== accountCurrency) {
        const conversionRates = await fetchConversionRates(marginBaseCurrency);
        if (!conversionRates || !conversionRates[accountCurrency]) {
            showMessage(`Could not fetch conversion rate from ${marginBaseCurrency} to ${accountCurrency}. Margin may be inaccurate.`, 'error');
            requiredMarginDisplay.textContent = 'N/A';
            marginCurrencySymbol.textContent = accountCurrency;
            hideLoading();
            return;
        }
        finalMarginAmount = finalMarginAmount * conversionRates[accountCurrency];
    }
    
    requiredMarginDisplay.textContent = finalMarginAmount.toFixed(2);
    marginCurrencySymbol.textContent = accountCurrency;

    const { pipSize, valueLabel, isPipCalculable } = getPipPointDetails(selectedSymbol);

    if (isPipCalculable) {
        let pipPointValue = 0;
        let pipPointCurrencySymbol = accountCurrency;

        pipPointValue = tradeSizeUnits * pipSize;
        
        if (quoteCurrencyOfPair !== accountCurrency) {
            const conversionRates = await fetchConversionRates(quoteCurrencyOfPair);
            if (!conversionRates || !conversionRates[accountCurrency]) {
                showMessage(`Could not fetch conversion rate for pip value from ${quoteCurrencyOfPair} to ${accountCurrency}.`, 'error');
                pipValueDisplay.textContent = 'N/A';
                pipValueCurrencySymbol.textContent = '';
                hideLoading();
                return;
            }
            const conversionRateForPip = conversionRates[accountCurrency];
            pipPointValue = pipPointValue * conversionRateForPip;
        }

        pipValueDisplay.textContent = pipPointValue.toFixed(2);
        pipValueCurrencySymbol.textContent = pipPointCurrencySymbol;
        pipValueRow.style.display = 'flex';
    } else {
        pipValueDisplay.textContent = valueLabel;
        pipValueCurrencySymbol.textContent = '';
        pipValueRow.style.display = 'flex';
    }

    hideLoading();
}
