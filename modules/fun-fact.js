(async function () {
  const banner = document.getElementById('fun-fact-banner');
  const driverSearchInput = document.getElementById('driver-search');
  if (!banner) return;

  function isSearchActive() {
    if (driverSearchInput && driverSearchInput.value.trim().length > 0) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    return Boolean((params.get('driver') || params.get('query') || '').trim());
  }

  function updateVisibility() {
    banner.hidden = isSearchActive();
  }

  try {
    const resp = await fetch('modules/data/fun-facts.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const facts = data.Facts;
    if (!facts || facts.length === 0) return;
    const fact = facts[Math.floor(Math.random() * facts.length)].Fact;
    banner.innerHTML = '<strong>&#128161; Did you know?</strong> ' + fact;
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
