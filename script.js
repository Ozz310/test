document.addEventListener('DOMContentLoaded', () => {
  // Set temporary user ID
  localStorage.setItem('userId', 'test123');
  console.log('Trading Journal loaded for user: test123');

  // Placeholder for form submission
  const tradeForm = document.getElementById('trade-form');
  tradeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Form submission placeholder - to be connected to Google Sheets');
  });

  // Add test button to verify Worker
  const appDiv = document.getElementById('app');
  const testButton = document.createElement('button');
  testButton.textContent = 'Test Worker (Create Sheet)';
  testButton.style = 'background: #d4af37; color: #1a1a1a; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;';
  testButton.addEventListener('click', async () => {
    try {
      const response = await fetch('https://traders-gazette-proxy.mohammadosama310.workers.dev/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'createSheet' }),
      });
      const result = await response.json();
      alert(`Worker Test Result: ${JSON.stringify(result)}`);
      console.log('Worker Response:', result);
    } catch (error) {
      alert('Worker Test Failed: ' + error.message);
      console.error('Worker Error:', error);
    }
  });
  appDiv.appendChild(testButton);

  // Placeholder for table data
  const tradeTableBody = document.getElementById('trade-table-body');
  tradeTableBody.innerHTML = '<tr><td colspan="12">No trades yet (placeholder)</td></tr>';
});
