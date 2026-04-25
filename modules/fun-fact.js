(async function () {
  const banner = document.getElementById('fun-fact-banner');
  const driverSearchInput = document.getElementById('driver-search');
  if (!banner) return;

  function updateVisibility() {
    banner.hidden = window.R3EUtils.isDriverSearchActive();
  }

  try {
    const resp = await fetch('modules/data/fun-facts.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const facts = data.Facts;
    if (!facts || facts.length === 0) return;
    const fact = facts[Math.floor(Math.random() * facts.length)].Fact;
    const strong = document.createElement('strong');
    strong.textContent = '\ud83d\udca1 Did you know?';
    banner.innerHTML = '';
    banner.appendChild(strong);
    banner.appendChild(document.createTextNode(' ' + fact));
    updateVisibility();

    // Listen for search input changes to hide banner when searching
    if (driverSearchInput) {
      driverSearchInput.addEventListener('input', updateVisibility);
      driverSearchInput.addEventListener('change', updateVisibility);
    }
  } catch (e) {
    // Silently hide the banner if data fails to load
  }
})();
