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

  // Badge label and class mapping for Wheel and Transmission
  function wheelBadge(cat){
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge unknown">—</span>';
    if (v === 'gt') return '<span class="car-badge gt">GT</span>';
    if (v === 'round') return '<span class="car-badge round">Round</span>';
    if (v === 'round (flat)' || v === 'round(flat)' || v === 'round(flat)') return '<span class="car-badge round-flat" title="Round (flat)">Round (flat)</span>';
    return `<span class="car-badge unknown">${R3EUtils.escapeHtml(cat)}</span>`;
  }

  function transBadge(cat){
    const v = (cat || '').toLowerCase().trim();
    if (!v) return '<span class="car-badge trans unknown">—</span>';
    if (v === 'paddles') return '<span class="car-badge trans">Paddles</span>';
    if (v === 'sequential') return '<span class="car-badge trans sequential">Sequential</span>';
    if (v === 'h' || v === 'other') return '<span class="car-badge trans h">H</span>';
    return `<span class="car-badge trans unknown">${R3EUtils.escapeHtml(cat)}</span>`;
  }

  function driveBadge(drive){
    const v = (drive || '').toUpperCase().trim();
    if (!v) return '<span class="car-badge drive unknown">—</span>';
    if (v === 'RWD') return '<span class="car-badge drive rwd">RWD</span>';
    if (v === 'FWD') return '<span class="car-badge drive fwd">FWD</span>';
    if (v === '4WD' || v === 'AWD') return '<span class="car-badge drive awd">4WD</span>';
    return `<span class="car-badge drive unknown">${R3EUtils.escapeHtml(drive)}</span>`;
  }

  function countryFlag(country){
    // Use FlagHelper if available, otherwise return empty
    if (typeof FlagHelper !== 'undefined' && FlagHelper.countryToFlag) {
      return FlagHelper.countryToFlag(country);
    }
    return '';
  }

  const data = await loadData();
  const tableContainer = document.getElementById('cars-info-table');
  if(!tableContainer) return;
  if(!data || data.length === 0){ 
    tableContainer.innerHTML = '<p class="placeholder">No car data available</p>'; 
    return; 
  }

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

  let wheelFilter = '', transFilter = '', classFilter = '';
  
  // Build class options from data
  const superclassOptions = dataService.getSuperclassOptions();
  const regularClassOptions = [];
  const classesSet = new Set();
  data.forEach(cls => {
    const className = (cls.class || '').trim();
    if (className && className !== '-') {
      classesSet.add(className);
    }
  });
  const uniqueClasses = Array.from(classesSet).sort();
  uniqueClasses.forEach(cls => {
    regularClassOptions.push({ value: cls, label: cls });
  });
  
  // Combine: All classes, then Category: superclass entries, then regular classes
  const classOptions = [{ value: '', label: 'All classes' }]
    .concat(superclassOptions)
    .concat(regularClassOptions);
  
  // Use the new CustomSelect component
  new CustomSelect('wheel-filter-ui', wheelOptions, v => { wheelFilter = v; renderTable(); });
  new CustomSelect('trans-filter-ui', transOptions, v => { transFilter = v; renderTable(); });
  new CustomSelect('class-filter-ui-cars', classOptions, v => { classFilter = v; renderTable(); });

  function carMatchesFilters(car) {
    const w = (car.wheel_cat || car.wheel || '').toLowerCase();
    const t = (car.transmission_cat || car.transmission || '').toLowerCase();
    const c = (car.car_class || car.class || '').toLowerCase();
    const wheelOk = !wheelFilter || w === wheelFilter;
    const transOk = !transFilter || t === transFilter;
    
    // Handle class filter - check if it's a superclass filter
    let classOk = true;
    if (classFilter) {
      if (classFilter.startsWith('superclass:')) {
        // For superclass, we'll handle filtering at the class level in renderTable
        classOk = true;
      } else {
        classOk = c === classFilter.toLowerCase();
      }
    }
    
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
        // Apply gamma to emphasize newer years (keep yellow→green tones)
        const gamma = 2.2;
        const tg = Math.pow(Math.min(Math.max(t, 0), 1), gamma);
        // interpolate between #ffd600 (255,214,0) and #00c853 (0,200,83)
        let r = Math.round((1 - tg) * 255 + tg * 0);
        let g = Math.round((1 - tg) * 214 + tg * 200);
        let b = Math.round((1 - tg) * 0   + tg * 83);
        return `rgb(${r},${g},${b})`;
      }

    let html = '<table class="results-table"><thead><tr>' +
      '<th>Car</th><th>Wheel</th><th>Transmission</th><th>Drive</th><th>Year</th><th>Power</th><th>Weight</th><th>Engine</th>' +
      '</tr></thead><tbody>';

    // Check if we're filtering by superclass
    const isSuperclassFilter = classFilter && classFilter.startsWith('superclass:');
    let superclassClasses = new Set();
    if (isSuperclassFilter) {
      const superclassName = classFilter.replace('superclass:', '');
      data.forEach(cls => {
        if (cls.superclass === superclassName) {
          const className = (cls.class || '').trim();
          if (className) superclassClasses.add(className);
        }
      });
    }

    data.forEach(cls => {
      const className = cls.class || 'Uncategorized';
      
      // Skip this class if we're filtering by superclass and it's not in the set
      if (isSuperclassFilter && !superclassClasses.has(className)) {
        return;
      }
      
      const slug = `class-${String(className).replace(/\s+/g,'-').replace(/[^a-z0-9\-]/gi,'').toLowerCase()}`;
      // Only show group if at least one car matches
      const filteredCars = (cls.cars || []).filter(carMatchesFilters);
      if (filteredCars.length === 0) return;
      
      // Build class header with optional superclass
      const superclass = cls.superclass;
      const classHeaderText = superclass 
        ? `${R3EUtils.escapeHtml(className)} (${R3EUtils.escapeHtml(superclass)})`
        : R3EUtils.escapeHtml(className);
      
      html += `\n<tr class="driver-group-header" data-group="${slug}" onclick="toggleGroup(this)">` +
              `<td colspan="9"><span class="toggle-icon">▼</span> <strong>${classHeaderText}</strong></td></tr>`;
      filteredCars.forEach(car => {
        if (car.link === undefined) car.link = '';
        const rowLink = R3EUtils.escapeHtml(car.link || '');
        const linkOpen = rowLink ? `<a class="row-link" href="${rowLink}" target="_blank" rel="noopener">` : '';
        const linkClose = rowLink ? `</a>` : '';
        const infoIcon = car.description ? `<span class="info-icon" title="${R3EUtils.escapeHtml(car.description)}" aria-label="More info" role="img">i</span>` : '';
        const flag = countryFlag(car.country || '');
        const flagHtml = flag ? `<span class="country-flag">${flag}</span>` : '';
        const carName = String(car.car || '');
        const lastSpace = carName.lastIndexOf(' ');
        const carNameHtml = (lastSpace >= 0)
          ? `${flagHtml}<b>${R3EUtils.escapeHtml(carName.slice(0, lastSpace))}</b><span class="no-wrap-tail"> <b>${R3EUtils.escapeHtml(carName.slice(lastSpace + 1))}</b> ${infoIcon}</span>`
          : `<span class="no-wrap-tail">${flagHtml}<b>${R3EUtils.escapeHtml(carName)}</b> ${infoIcon}</span>`;
        html += `\n<tr class="driver-data-row ${slug}" data-link="${rowLink}">` +
          `<td>${linkOpen}${carNameHtml}${linkClose}</td>` +
                `<td>${linkOpen}${wheelBadge(car.wheel_cat || car.wheel)}${linkClose}</td>` +
                `<td>${linkOpen}${transBadge(car.transmission_cat || car.transmission)}${linkClose}</td>` +
                `<td>${linkOpen}${driveBadge(car.drive)}${linkClose}</td>` +
                `<td>${linkOpen}<span class="car-badge" style="background:${yearColor(car.year)};color:#222;">${R3EUtils.escapeHtml(car.year || '')}</span>${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.power || '')}${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.weight || '')}${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.engine || '')}${linkClose}</td>` +
                `</tr>`;
      });
    });

    html += '\n</tbody></table>';
    tableContainer.innerHTML = html;

    // Make rows with a data-link attribute open that link in a new tab
    Array.from(tableContainer.querySelectorAll('tr.driver-data-row')).forEach(row => {
      const link = row.getAttribute('data-link') || '';
      if (link) {
        // prefer native anchor preview; only add click handler when no anchor exists
        const hasAnchor = !!row.querySelector('a.row-link');
        row.style.cursor = 'pointer';
        if (!hasAnchor) {
          row.addEventListener('click', (e) => {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'a' || tag === 'button' || (e.target.closest && e.target.closest('.custom-select'))) return;
            try { window.open(link, '_blank'); } catch (err) { console.warn('Failed to open link', err); }
          });
        }
      }
    });
  }

  renderTable();
})();
