document.addEventListener('DOMContentLoaded', () => {
  // Set temporary user ID for testing
  localStorage.setItem('userId', 'test123');
  // Load Trading Journal module
  const mainContainer = document.getElementById('main-container');
  fetch('modules/trading-journal/index.html')
    .then(response => response.text())
    .then(html => {
      mainContainer.innerHTML = html;
      // Load module-specific script
      const script = document.createElement('script');
      script.src = 'modules/trading-journal/script.js';
      document.body.appendChild(script);
    })
    .catch(error => {
      mainContainer.innerHTML = '<h2>Error loading module</h2>';
      console.error('Error:', error);
    });
});
