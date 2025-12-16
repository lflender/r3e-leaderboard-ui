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
    if (v === 'round (flat)' || v === 'round(flat)' || v === 'round(flat)') return '<span class="car-badge round-flat" title="Round (flat)">Round (flat)</span>';
    return `<span class="car-badge unknown">${escapeHtml(cat)}</span>`;
  }

  function transBadge(cat){
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge trans unknown">—</span>';
    if (v === 'paddles') return '<span class="car-badge trans">Paddles</span>';
    if (v === 'sequential') return '<span class="car-badge trans sequential">Sequential</span>';
    if (v === 'h' || v === 'other') return '<span class="car-badge trans h">H</span>';
    return `<span class="car-badge trans unknown">${escapeHtml(cat)}</span>`;
  }

  const data = await loadData();
  const tableContainer = document.getElementById('cars-info-table');
  // If the script is running on the main index page, #cars-info panel may exist.
  // For standalone cars.html we only require the table container.
  const panelContainer = document.getElementById('cars-info');
  if(!tableContainer) return;
  if(!data || data.length === 0){ tableContainer.innerHTML = '<p class="placeholder">No car data available</p>'; return; }

  // Dropdown options
  const wheelOptions = [
    { value: '', label: 'All wheels' },
    { value: 'gt', label: 'GT' },
    { value: 'round', label: 'Round' },
    { value: 'round (flat)', label: 'Round (flat)' }
  ];
  const transOptions = [
    { value: '', label: 'All transmissions' },
    { value: 'paddles', label: 'Paddles' },
    { value: 'sequential', label: 'Sequential' },
    { value: 'h', label: 'H' }
  ];

  // Custom select UI (reuse from Leaderboards)
  function setupCustomSelect(id, options, onChange) {
    const root = document.getElementById(id);
    if (!root) return;
    const toggle = root.querySelector('.custom-select__toggle');
    const menu = root.querySelector('.custom-select__menu');
    let currentValue = '';
    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
    function openMenu() {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
    function setValue(val) {
      currentValue = val;
      const opt = options.find(o => o.value === val) || options[0];
      toggle.innerHTML = opt.label + ' ▾';
      onChange(val);
      closeMenu();
    }
    toggle.onclick = e => {
      menu.hidden ? openMenu() : closeMenu();
    };
    menu.innerHTML = options.map(opt => `<div class="custom-select__option" data-value="${opt.value}">${opt.label}</div>`).join('');
    menu.onclick = e => {
      const v = e.target.getAttribute('data-value');
      if (v !== null) setValue(v);
    };
    document.addEventListener('click', e => { if (!root.contains(e.target)) closeMenu(); });
    setValue('');
  }

  let wheelFilter = '', transFilter = '';
  let classFilter = '';
  // Build class options from data
  const classOptions = [{ value: '', label: 'All classes' }].concat(data.map(c => ({ value: c.class || '', label: c.class || '' })));
  // Deduplicate classOptions
  const seen = new Set();
  const classOptionsUnique = classOptions.filter(o => {
    if (seen.has(o.value)) return false; seen.add(o.value); return true;
  });
  setupCustomSelect('wheel-filter-ui', wheelOptions, v => { wheelFilter = v; renderTable(); });
  setupCustomSelect('trans-filter-ui', transOptions, v => { transFilter = v; renderTable(); });
  setupCustomSelect('class-filter-ui-cars', classOptionsUnique, v => { classFilter = v; renderTable(); });

  function carMatchesFilters(car) {
    const w = (car.wheel_cat || car.wheel || '').toLowerCase();
    const t = (car.transmission_cat || car.transmission || '').toLowerCase();
    const c = (car.car_class || car.class || '').toLowerCase();
    const wheelOk = !wheelFilter || w === wheelFilter;
    const transOk = !transFilter || t === transFilter;
    const classOk = !classFilter || c === classFilter.toLowerCase();
    return wheelOk && transOk && classOk;
  }

  function renderTable() {
    // Compute unique sorted years for ordinal coloring
    let allYears = [];
    data.forEach(cls => {
      (cls.cars || []).forEach(car => {
        if (!carMatchesFilters(car)) return;
        let y = parseInt(car.year);
        if (!isNaN(y)) allYears.push(y);
      });
    });
    let uniqueYears = Array.from(new Set(allYears)).sort((a, b) => a - b);

    function yearColor(year) {
      let y = parseInt(year);
      if (isNaN(y) || uniqueYears.length < 2) return '#e0e0e0';
      let idx = uniqueYears.indexOf(y);
      if (idx === -1) return '#e0e0e0';
      let t = idx / (uniqueYears.length - 1);
      // More pronounced: yellow (#ffd600) to green (#00c853)
      let r = Math.round((1-t)*255 + t*0);
      let g = Math.round((1-t)*214 + t*200);
      let b = Math.round((1-t)*0 + t*83);
      return `rgb(${r},${g},${b})`;
    }

    let html = '<table class="results-table"><thead><tr>' +
      '<th>Car</th><th>Wheel</th><th>Transmission</th><th>Year</th><th>Power</th><th>Weight</th><th>Engine</th>' +
      '</tr></thead><tbody>';

    data.forEach(cls => {
      const className = cls.class || 'Uncategorized';
      const slug = `class-${String(className).replace(/\s+/g,'-').replace(/[^a-z0-9\-]/gi,'').toLowerCase()}`;
      // Only show group if at least one car matches
      const filteredCars = (cls.cars || []).filter(carMatchesFilters);
      if (filteredCars.length === 0) return;
            html += `\n<tr class="driver-group-header" data-group="${slug}">` +
              `<td colspan="8"><span class="toggle-icon">▼</span> <strong>${escapeHtml(className)}</strong></td></tr>`;
      filteredCars.forEach(car => {
        html += `\n<tr class="driver-data-row ${slug}">` +
                `<td class="no-wrap"><b>${escapeHtml(car.car || '')}</b></td>` +
                `<td>${wheelBadge(car.wheel_cat || car.wheel)}</td>` +
                `<td>${transBadge(car.transmission_cat || car.transmission)}</td>` +
                `<td><span style="background:${yearColor(car.year)};color:#222;padding:0.18rem 0.6rem;border-radius:999px;font-weight:800;display:inline-block;min-width:3.5em;text-align:center;">${escapeHtml(car.year || '')}</span></td>` +
                `<td>${escapeHtml(car.power || '')}</td>` +
                `<td>${escapeHtml(car.weight || '')}</td>` +
                `<td>${escapeHtml(car.engine || '')}</td>` +
                `` +
                `</tr>`;
      });
    });

    html += '\n</tbody></table>';
    tableContainer.innerHTML = html;
  }

  renderTable();

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
    '<th>Car</th><th>Wheel</th><th>Transmission</th><th>Year</th><th>Power</th><th>Weight</th><th>Engine</th>' +
    '</tr></thead><tbody>';

  data.forEach(cls => {
    const className = cls.class || 'Uncategorized';
    const slug = `class-${String(className).replace(/\s+/g,'-').replace(/[^a-z0-9\-]/gi,'').toLowerCase()}`;
    // Group header row (same style as driver grouping in leaderboards)
        html += `\n<tr class="driver-group-header" data-group="${slug}" onclick="toggleGroup(this)">` +
          `<td colspan="8"><span class="toggle-icon">▼</span> <strong>${escapeHtml(className)}</strong></td></tr>`;
    const cars = Array.isArray(cls.cars) ? cls.cars : [];
    cars.forEach(car => {
            html += `\n<tr class="driver-data-row ${slug}">` +
              `<td class="no-wrap"><b>${escapeHtml(car.car || '')}</b></td>` +
              `<td>${wheelBadge(car.wheel_cat || car.wheel)}</td>` +
              `<td>${transBadge(car.transmission_cat || car.transmission)}</td>` +
              `<td><span style="background:${yearColor(car.year)};color:#222;padding:0.18rem 0.6rem;border-radius:999px;font-weight:800;display:inline-block;min-width:3.5em;text-align:center;">${escapeHtml(car.year || '')}</span></td>` +
              `<td class="carinfo-meta">${escapeHtml(car.power || '')}</td>` +
              `<td class="carinfo-meta">${escapeHtml(car.weight || '')}</td>` +
              `<td class="carinfo-meta">${escapeHtml(car.engine || '')}</td>` +
              `` +
              `</tr>`;
    });
  });

  html += '\n</tbody></table>';
  tableContainer.innerHTML = html;
})();
