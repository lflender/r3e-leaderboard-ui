(async function () {
  const banner = document.getElementById('fun-fact-banner');
  if (!banner) return;
  try {
    const resp = await fetch('data/fun-facts.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const facts = data.Facts;
    if (!facts || facts.length === 0) return;
    const fact = facts[Math.floor(Math.random() * facts.length)].Fact;
    banner.innerHTML = '<strong>&#128161; Did you know?</strong> ' + fact;
    banner.hidden = false;
  } catch (e) {
    // Silently hide the banner if data fails to load
  }
})();
