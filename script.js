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

  // Placeholder for table data
  const tradeTableBody = document.getElementById('trade-table-body');
  tradeTableBody.innerHTML = '<tr><td colspan="12">No trades yet (placeholder)</td></tr>';
});
