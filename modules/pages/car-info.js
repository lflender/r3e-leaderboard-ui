// Loads modules/data/cars.json and renders a grouped table in #cars-info, styled like leaderboards
(async function(){
  async function loadData(){
    if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
      return window.CARS_DATA;
    }
    try{
      const resp = await fetch('modules/data/cars.json');
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
    { value: 'round (flat)', label: 'Round (flat)' },
    { value: 'round_and_roundflat', label: 'Round & Round (flat)' }
  ];
  const transOptions = [
    { value: '', label: 'All transmissions' },
    { value: 'paddles', label: 'Paddles' },
    { value: 'sequential', label: 'Sequential' },
    { value: 'h', label: 'H' }
  ];

  let wheelFilter = '', transFilter = '', classFilter = '';
  let viewMode = 'table';
  const CAR_VIEW_MODE_KEY = 'carInfoViewMode';
  let hasTrackedCarInfoDisplay = false;
  
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
  function trackCarInfoFilter(filterName, filterValue, stats) {
    if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
    R3EAnalytics.track('car info filter changed', {
      filter_name: filterName,
      filter_value: filterValue || '',
      wheel_filter: wheelFilter || '',
      transmission_filter: transFilter || '',
      class_filter: classFilter || '',
      displayed_cars: (stats && stats.displayedCars) || 0,
      displayed_classes: (stats && stats.displayedClasses) || 0,
      is_superclass_filter: !!(classFilter && classFilter.startsWith('superclass:'))
    });
  }

  function trackCarInfoViewMode(nextMode, previousMode, stats) {
    if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
    R3EAnalytics.track('car info view mode changed', {
      view_mode: nextMode,
      previous_view_mode: previousMode,
      wheel_filter: wheelFilter || '',
      transmission_filter: transFilter || '',
      class_filter: classFilter || '',
      displayed_cars: (stats && stats.displayedCars) || 0,
      displayed_classes: (stats && stats.displayedClasses) || 0,
      is_superclass_filter: !!(classFilter && classFilter.startsWith('superclass:'))
    });
  }

  function updateViewToggleUI() {
    const wrap = document.getElementById('cars-view-toggle');
    if (!wrap) return;
    Array.from(wrap.querySelectorAll('button[data-view]')).forEach(btn => {
      const active = btn.getAttribute('data-view') === viewMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setViewMode(nextMode, options = {}) {
    if (nextMode !== 'table' && nextMode !== 'tiles') return;
    const previousMode = viewMode;
    const changed = previousMode !== nextMode;
    viewMode = nextMode;
    updateViewToggleUI();

    if (options.persist !== false) {
      try { window.localStorage.setItem(CAR_VIEW_MODE_KEY, viewMode); } catch (err) {}
    }

    if (changed) {
      const stats = renderResults();
      if (options.track === true) {
        trackCarInfoViewMode(nextMode, previousMode, stats);
      }
    }
  }

  function initViewMode() {
    try {
      const stored = window.localStorage.getItem(CAR_VIEW_MODE_KEY);
      if (stored === 'table' || stored === 'tiles') {
        viewMode = stored;
      }
    } catch (err) {}

    const wrap = document.getElementById('cars-view-toggle');
    if (wrap) {
      wrap.addEventListener('click', (event) => {
        const btn = event.target.closest && event.target.closest('button[data-view]');
        if (!btn) return;
        const nextMode = btn.getAttribute('data-view');
        setViewMode(nextMode, { persist: true, track: true });
      });
    }

    updateViewToggleUI();
  }

  new CustomSelect('wheel-filter-ui', wheelOptions, (v, opts) => {
    wheelFilter = v;
    const stats = renderResults();
    if (opts?.source === 'user') {
      trackCarInfoFilter('wheel', v, stats);
    }
  });
  new CustomSelect('trans-filter-ui', transOptions, (v, opts) => {
    transFilter = v;
    const stats = renderResults();
    if (opts?.source === 'user') {
      trackCarInfoFilter('transmission', v, stats);
    }
  });
  new CustomSelect('class-filter-ui-cars', classOptions, (v, opts) => {
    classFilter = v;
    const stats = renderResults();
    if (opts?.source === 'user') {
      trackCarInfoFilter('class', v, stats);
    }
  });

  initViewMode();

  function carMatchesFilters(car) {
    const w = (car.wheel_cat || '').toLowerCase();
    const t = (car.transmission_cat || '').toLowerCase();
    const c = (car.car_class || car.class || '').toLowerCase();
    
    // Handle wheel filter - check if it's the combined filter
    let wheelOk = true;
    if (wheelFilter) {
      if (wheelFilter === 'round_and_roundflat') {
        wheelOk = w === 'round' || w === 'round (flat)';
      } else {
        wheelOk = w === wheelFilter;
      }
    }
    
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

  function getImageListForCar(car, rawLink) {
    const imageMap = (window.CAR_IMAGES_BY_LINK && typeof window.CAR_IMAGES_BY_LINK === 'object')
      ? window.CAR_IMAGES_BY_LINK
      : null;
    const mappedList = (imageMap && rawLink && Array.isArray(imageMap[rawLink]))
      ? imageMap[rawLink]
      : null;
    return mappedList || (Array.isArray(car.image)
      ? car.image
      : (car.image ? [car.image] : []));
  }

  function createYearColorFn() {
    const allYears = [];
    data.forEach(cls => {
      (cls.cars || []).forEach(car => {
        if (!carMatchesFilters(car)) return;
        const y = parseInt(car.year);
        if (!isNaN(y)) allYears.push(y);
      });
    });
    const uniqueYears = Array.from(new Set(allYears)).sort((a, b) => a - b);

    return function yearColor(year) {
      const y = parseInt(year);
      if (isNaN(y) || uniqueYears.length < 2) return '#e0e0e0';
      const idx = uniqueYears.indexOf(y);
      if (idx === -1) return '#e0e0e0';
      const t = idx / (uniqueYears.length - 1);
      const gamma = 2.2;
      const tg = Math.pow(Math.min(Math.max(t, 0), 1), gamma);
      const r = Math.round((1 - tg) * 255 + tg * 0);
      const g = Math.round((1 - tg) * 214 + tg * 200);
      const b = Math.round((1 - tg) * 0 + tg * 83);
      return `rgb(${r},${g},${b})`;
    };
  }

  function attachImageCyclers(rootEl) {
    Array.from(rootEl.querySelectorAll('img.car-rotating-image[data-image-list]')).forEach(img => {
      const host = img.closest('a.row-link, a.car-tile-link, .car-tile-link');
      if (!host) return;

      let images = [];
      try {
        const raw = decodeURIComponent(img.getAttribute('data-image-list') || '[]');
        const parsed = JSON.parse(raw);
        images = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (err) {
        images = [];
      }

      if (images.length < 2) return;

      let currentIndex = 0;
      let cycleTimeoutId = null;
      let isCycling = false;
      let cycleToken = 0;
      const preloadMap = new Map();

      const ensurePreloaded = (url) => {
        if (!url) return Promise.resolve();
        if (preloadMap.has(url)) return preloadMap.get(url);
        const p = new Promise(resolve => {
          const preImg = new Image();
          preImg.onload = () => resolve();
          preImg.onerror = () => resolve();
          preImg.src = url;
        });
        preloadMap.set(url, p);
        return p;
      };

      const waitNextTick = () => new Promise(resolve => {
        cycleTimeoutId = window.setTimeout(() => {
          cycleTimeoutId = null;
          resolve();
        }, 1000);
      });

      const showImageWhenReady = async (url, token) => {
        if (!url || token !== cycleToken) return false;
        await ensurePreloaded(url);
        if (token !== cycleToken) return false;
        if (img.src !== url) img.src = url;
        return true;
      };

      const runCycle = async (token) => {
        while (isCycling && token === cycleToken) {
          await waitNextTick();
          if (!isCycling || token !== cycleToken) break;
          const nextIndex = (currentIndex + 1) % images.length;
          const shown = await showImageWhenReady(images[nextIndex], token);
          if (!shown) break;
          currentIndex = nextIndex;
        }
      };

      const startCycle = () => {
        if (isCycling) return;
        isCycling = true;
        cycleToken += 1;
        const token = cycleToken;
        img.src = images[0];
        images.slice(1).forEach(ensurePreloaded);
        runCycle(token);
      };

      const stopCycle = () => {
        isCycling = false;
        cycleToken += 1;
        if (cycleTimeoutId !== null) {
          window.clearTimeout(cycleTimeoutId);
          cycleTimeoutId = null;
        }
        currentIndex = 0;
        img.src = images[0];
      };

      host.addEventListener('mouseenter', startCycle);
      host.addEventListener('mouseleave', stopCycle);
      host.addEventListener('focus', startCycle);
      host.addEventListener('blur', stopCycle);
    });
  }

  function renderTable() {
    let displayedClasses = 0;
    let displayedCars = 0;
    const yearColor = createYearColorFn();

    let html = '<table class="results-table"><thead><tr>' +
      '<th>Car</th><th>Wheel</th><th>Transmission</th><th>Drive</th><th>Year</th><th>Power</th><th>Weight<br><span style="display:block;font-size:0.72em;font-weight:500;line-height:1.05;letter-spacing:0;">*with driver</span></th><th>Engine</th>' +
      '</tr></thead><tbody>';

    const isSuperclassFilter = classFilter && classFilter.startsWith('superclass:');
    const superclassClasses = new Set();
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
      if (isSuperclassFilter && !superclassClasses.has(className)) return;

      const slug = `class-${String(className).replace(/\s+/g,'-').replace(/[^a-z0-9\-]/gi,'').toLowerCase()}`;
      const filteredCars = (cls.cars || []).filter(carMatchesFilters);
      if (filteredCars.length === 0) return;
      displayedClasses++;

      const superclass = cls.superclass;
      const classLogoUrl = (window.R3EUtils && typeof window.R3EUtils.resolveCarClassLogoByName === 'function')
        ? window.R3EUtils.resolveCarClassLogoByName(className)
        : '';
      const classLogoHtml = classLogoUrl
        ? `<img class="table-car-class-logo" src="${R3EUtils.escapeHtml(classLogoUrl)}" alt="${R3EUtils.escapeHtml(className)} class logo" loading="lazy" decoding="async">`
        : '';
      const classHeaderText = superclass
        ? `${R3EUtils.escapeHtml(className)} (${R3EUtils.escapeHtml(superclass)})`
        : R3EUtils.escapeHtml(className);

      html += `\n<tr class="driver-group-header" data-group="${slug}" onclick="toggleGroup(this)">` +
              `<td colspan="9"><span class="toggle-icon">▼</span> <strong class="car-class-header-text">${classLogoHtml}${classHeaderText}</strong></td></tr>`;

      filteredCars.forEach(car => {
        displayedCars++;
        const rawLink = String(car.link || '').trim();
        const rowLink = R3EUtils.escapeHtml(rawLink);
        const linkOpen = rowLink ? `<a class="row-link" href="${rowLink}" target="_blank" rel="noopener">` : '';
        const linkClose = rowLink ? `</a>` : '';
        const thumbUrl = R3EUtils.escapeHtml(car.thumbnail || '');
        const imageList = getImageListForCar(car, rawLink);
        const encodedImageList = encodeURIComponent(JSON.stringify(imageList));
        const imageUrl = R3EUtils.escapeHtml(imageList[0] || '');
        const thumbInline = thumbUrl
          ? `<img class="car-inline-thumbnail" src="${thumbUrl}" alt="" loading="lazy" decoding="async" aria-hidden="true">`
          : '';
        const thumbPreview = imageUrl
          ? `<span class="car-link-thumbnail" aria-hidden="true"><img class="car-rotating-image" data-image-list="${encodedImageList}" src="${imageUrl}" alt="" loading="lazy" decoding="async"></span>`
          : '';
        const infoIcon = car.description ? `<span class="info-icon" title="${R3EUtils.escapeHtml(car.description)}" aria-label="More info" role="img">i</span>` : '';
        const isSafetyCar = (car.car_class || car.class || '').toLowerCase() === 'safety car';
        const warningIcon = isSafetyCar ? `<span class="warning-icon" title="Not eligible to Leaderboards" aria-label="Warning" role="img">⚠️</span>` : '';
        const metaIcons = (infoIcon || thumbInline || warningIcon)
          ? `<span class="car-inline-meta">${infoIcon}${thumbInline}${warningIcon}</span>`
          : '';
        const flag = countryFlag(car.country || '');
        const flagHtml = flag ? `<span class="country-flag">${flag}</span>` : '';
        const carName = String(car.car || '');
        const lastSpace = carName.lastIndexOf(' ');
        const carNameHtml = (lastSpace >= 0)
          ? `${flagHtml}<b>${R3EUtils.escapeHtml(carName.slice(0, lastSpace))}</b><span class="no-wrap-tail"> <b>${R3EUtils.escapeHtml(carName.slice(lastSpace + 1))}</b> ${metaIcons}</span>`
          : `<span class="no-wrap-tail">${flagHtml}<b>${R3EUtils.escapeHtml(carName)}</b> ${metaIcons}</span>`;

        html += `\n<tr class="driver-data-row ${slug}" data-link="${rowLink}">` +
                `<td>${linkOpen}${carNameHtml}${thumbPreview}${linkClose}</td>` +
                `<td>${linkOpen}${wheelBadge(car.wheel_cat)}${linkClose}</td>` +
                `<td>${linkOpen}${transBadge(car.transmission_cat)}${linkClose}</td>` +
                `<td>${linkOpen}${driveBadge(car.drive)}${linkClose}</td>` +
                `<td>${linkOpen}<span class="car-badge year-badge" data-year="${car.year}" style="background:${yearColor(car.year)}">${R3EUtils.escapeHtml(car.year || '')}</span>${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.power || '')}${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.weight || '')}${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.engine || '')}${linkClose}</td>` +
                `</tr>`;
      });
    });

    html += '\n</tbody></table>';
    tableContainer.innerHTML = html;
    attachImageCyclers(tableContainer);

    Array.from(tableContainer.querySelectorAll('tr.driver-data-row')).forEach(row => {
      const link = row.getAttribute('data-link') || '';
      if (link) {
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

    return { displayedCars, displayedClasses };
  }

  function renderTiles() {
    let displayedClasses = 0;
    let displayedCars = 0;
    const yearColor = createYearColorFn();

    const isSuperclassFilter = classFilter && classFilter.startsWith('superclass:');
    const superclassClasses = new Set();
    if (isSuperclassFilter) {
      const superclassName = classFilter.replace('superclass:', '');
      data.forEach(cls => {
        if (cls.superclass === superclassName) {
          const className = (cls.class || '').trim();
          if (className) superclassClasses.add(className);
        }
      });
    }

    let html = '<div class="cars-tile-grid">';
    data.forEach(cls => {
      const className = cls.class || 'Uncategorized';
      if (isSuperclassFilter && !superclassClasses.has(className)) return;

      const filteredCars = (cls.cars || []).filter(carMatchesFilters);
      if (filteredCars.length === 0) return;
      displayedClasses++;

      const superclass = cls.superclass;
      const classLogoUrl = (window.R3EUtils && typeof window.R3EUtils.resolveCarClassLogoByName === 'function')
        ? window.R3EUtils.resolveCarClassLogoByName(className)
        : '';
      const classLogoHtml = classLogoUrl
        ? `<img class="table-car-class-logo" src="${R3EUtils.escapeHtml(classLogoUrl)}" alt="${R3EUtils.escapeHtml(className)} class logo" loading="lazy" decoding="async">`
        : '';
      const classHeaderText = R3EUtils.escapeHtml(className);
      const superclassChip = superclass
        ? `<span class="cars-class-superclass-chip">${R3EUtils.escapeHtml(superclass)} Category</span>`
        : '';

      html += `<section class="cars-class-section"><div class="cars-class-heading-wrap"><h3 class="cars-class-heading">${classLogoHtml}${classHeaderText}</h3>${superclassChip}</div><div class="cars-tiles">`;
      filteredCars.forEach(car => {
        displayedCars++;
        const rawLink = String(car.link || '').trim();
        const rowLink = R3EUtils.escapeHtml(rawLink);
        const imageList = getImageListForCar(car, rawLink);
        const encodedImageList = encodeURIComponent(JSON.stringify(imageList));
        const imageUrl = R3EUtils.escapeHtml(imageList[0] || car.thumbnail || '');
        const flag = countryFlag(car.country || '');
        const flagHtml = flag ? `<span class="car-tile-flag-overlay">${flag}</span>` : '';
        const rawCarName = car.car || '';
        const { brand: carBrand, model: carModel } = (window.R3EUtils && R3EUtils.splitCarName) ? R3EUtils.splitCarName(rawCarName) : { brand: '', model: rawCarName };
        const carNameHtml = carBrand
          ? `<strong>${R3EUtils.escapeHtml(carBrand)}</strong> ${R3EUtils.escapeHtml(carModel)}`
          : R3EUtils.escapeHtml(rawCarName);
        const carNameAttr = R3EUtils.escapeHtml(rawCarName);
        const isSafetyCar = (car.car_class || car.class || '').toLowerCase() === 'safety car';
        const warningIcon = isSafetyCar ? `<span class="warning-icon" title="Not eligible to Leaderboards" aria-label="Warning" role="img">⚠️</span>` : '';
        const open = rowLink ? `<a class="car-tile-link" href="${rowLink}" target="_blank" rel="noopener">` : '<div class="car-tile-link">';
        const close = rowLink ? '</a>' : '</div>';
        const description = car.description ? `<div class="car-tile-description">${R3EUtils.escapeHtml(car.description)}</div>` : '';
        const yearBadgeHtml = `<span class="car-tile-year-overlay car-badge year-badge" data-year="${car.year}" style="background:${yearColor(car.year)}">${R3EUtils.escapeHtml(car.year || '')}</span>`;
        const weightDisplay = (car.weight || '—').replace(/kg\*$/, 'kg with driver');

        html += `<article class="car-tile">` +
                `${open}` +
                `<div class="car-tile-name">${carNameHtml}${warningIcon}</div>` +
                `${imageUrl ? `<div class="car-tile-image-wrap">${flagHtml}<img class="car-tile-image car-rotating-image" data-image-list="${encodedImageList}" src="${imageUrl}" alt="${carNameAttr}" loading="lazy" decoding="async">${yearBadgeHtml}</div>` : ''}` +
                `${close}` +
                `<div class="car-tile-meta">` +
                `<span>${wheelBadge(car.wheel_cat)}</span><span>${transBadge(car.transmission_cat)}</span><span>${driveBadge(car.drive)}</span>` +
                `<div class="car-tile-specs">${R3EUtils.escapeHtml(car.power || '—')} • ${R3EUtils.escapeHtml(weightDisplay)} • ${R3EUtils.escapeHtml(car.engine || '—')}</div>` +
                `${description}` +
                `</div>` +
                `</article>`;
      });
      html += '</div></section>';
    });

    html += '</div>';
    tableContainer.innerHTML = html;
    attachImageCyclers(tableContainer);
    return { displayedCars, displayedClasses };
  }

  function renderResults() {
    return viewMode === 'tiles' ? renderTiles() : renderTable();
  }

  const initialStats = renderResults();
  if (!hasTrackedCarInfoDisplay && typeof R3EAnalytics !== 'undefined' && typeof R3EAnalytics.track === 'function') {
    const totalClasses = data.length;
    const totalCars = data.reduce((sum, cls) => sum + ((cls.cars || []).length), 0);
    R3EAnalytics.track('car info displayed', {
      total_classes: totalClasses,
      total_cars: totalCars,
      displayed_classes: (initialStats && initialStats.displayedClasses) || 0,
      displayed_cars: (initialStats && initialStats.displayedCars) || 0
    });
    hasTrackedCarInfoDisplay = true;
  }
})();
