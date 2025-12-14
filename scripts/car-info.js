// Loads data/cars.json and renders a grouped table in #cars-info, styled like leaderboards
(async function(){
  async function loadData(){
    if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
      return window.CARS_DATA;
    }
    try{
      const resp = await fetch('data/cars.json');
      if(!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    }catch(e){
      console.error('Failed to load cars.json', e);
      return [];
    }
  }

  function escapeHtml(s){
    if (s === null || s === undefined) return '';
    const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML;
  }


  // Color and label maps for badges
  // Badge label and class mapping for Wheel and Transmission
  function wheelBadge(cat){
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge unknown">—</span>';
    if (v === 'gt') return '<span class="car-badge gt">GT</span>';
    if (v === 'round') return '<span class="car-badge round">Round</span>';
    if (v === 'round (flat)' || v === 'round(flat)' || v === 'round(flat)') return '<span class="car-badge round" title="Round (flat)">Round (flat)</span>';
    return `<span class="car-badge unknown">${escapeHtml(cat)}</span>`;
  }

  function transBadge(cat){
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge trans unknown">—</span>';
    if (v === 'paddles') return '<span class="car-badge trans">Paddles</span>';
    if (v === 'sequential') return '<span class="car-badge trans sequential">Sequential</span>';
    if (v === 'other') return '<span class="car-badge trans h">H</span>';
    return `<span class="car-badge trans unknown">${escapeHtml(cat)}</span>`;
  }

  const data = await loadData();
  const container = document.getElementById('cars-info');
  if(!container) return;
  if(!data || data.length === 0){ container.innerHTML = '<p class="placeholder">No car data available</p>'; return; }

  // Compute min/max year for color gradient
  let allYears = [];
  data.forEach(cls => {
    (cls.cars || []).forEach(car => {
      let y = parseInt(car.year);
      if (!isNaN(y)) allYears.push(y);
    });
  });
  let minYear = Math.min(...allYears), maxYear = Math.max(...allYears);

  function yearColor(year) {
    let y = parseInt(year);
    if (isNaN(y) || minYear === maxYear) return '#e0e0e0';
    // More pronounced: yellow (#ffd600) to green (#00c853)
    let t = (y - minYear) / (maxYear - minYear);
    // interpolate between #ffd600 (255,214,0) and #00c853 (0,200,83)
    let r = Math.round((1-t)*255 + t*0);
    let g = Math.round((1-t)*214 + t*200);
    let b = Math.round((1-t)*0 + t*83);
    return `rgb(${r},${g},${b})`;
  }

  let html = '<table class="results-table"><thead><tr>' +
    '<th>Car</th><th>Wheel</th><th>Transmission</th><th>Year</th><th>Power</th><th>Weight</th><th>Engine</th><th>Drive</th>' +
    '</tr></thead><tbody>';

  data.forEach(cls => {
    const className = cls.class || 'Uncategorized';
    const slug = `class-${String(className).replace(/\s+/g,'-').replace(/[^a-z0-9\-]/gi,'').toLowerCase()}`;
    // Group header row (same style as driver grouping in leaderboards)
    html += `\n<tr class="driver-group-header" data-group="${slug}" onclick="toggleGroup(this)">` +
            `<td colspan="9"><span class="toggle-icon">▼</span> <strong>${escapeHtml(className)}</strong></td></tr>`;
    const cars = Array.isArray(cls.cars) ? cls.cars : [];
    cars.forEach(car => {
            html += `\n<tr class="driver-data-row ${slug}">` +
              `<td class="no-wrap"><b>${escapeHtml(car.car || '')}</b></td>` +
              `<td>${wheelBadge(car.wheel_cat || car.wheel)}</td>` +
              `<td>${transBadge(car.transmission_cat || car.transmission)}</td>` +
              `<td><span style="background:${yearColor(car.year)};color:#222;padding:0.18rem 0.6rem;border-radius:999px;font-weight:800;display:inline-block;min-width:3.5em;text-align:center;">${escapeHtml(car.year || '')}</span></td>` +
              `<td>${escapeHtml(car.power || '')}</td>` +
              `<td>${escapeHtml(car.weight || '')}</td>` +
              `<td>${escapeHtml(car.engine || '')}</td>` +
              `<td>${escapeHtml(car.drive || '')}</td>` +
              `</tr>`;
    });
  });

  html += '\n</tbody></table>';
  container.innerHTML = html;
})();
