// Loads modules/data/cars.json and renders a grouped table in #cars-info, styled like leaderboards
(async function(){
  async function loadData(){
    if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
      return window.CARS_DATA;
    }
    try{
      const resp = await R3EUtils.fetchWithTimeout('modules/data/cars.json', {}, 10000);
      if(!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    }catch(e){
      console.error('Failed to load cars.json', e);
      return [];
    }
  }

  // Badge label and class mapping for Wheel and Transmission
  const wheelBadge = R3ECarUtils.wheelBadge;
  const transBadge = R3ECarUtils.transBadge;
  const driveBadge = R3ECarUtils.driveBadge;

  const countryFlag = (country) => FlagHelper.countryToFlag(country);

  const renderCarDisplayHtml = R3ECarUtils.renderCarDisplayHtml;

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
    { value: 'gt', label: 'GT', labelHtml: wheelBadge('gt') },
    { value: 'round', label: 'Round', labelHtml: wheelBadge('round') },
    { value: 'round flat', label: 'Round flat', labelHtml: wheelBadge('round flat') },
    { value: 'round_and_roundflat', label: 'Round & Round flat', labelHtml: `${wheelBadge('round')} + ${wheelBadge('round flat')}` }
  ];
  const transOptions = [
    { value: '', label: 'All transmissions' },
    { value: 'paddles', label: 'Paddles', labelHtml: transBadge('paddles') },
    { value: 'sequential', label: 'Sequential', labelHtml: transBadge('sequential') },
    { value: 'h', label: 'H', labelHtml: transBadge('h') }
  ];

  let wheelFilter = '', transFilter = '', classFilter = '', ratingFilter = '';
  let searchFilter = '';
  let viewMode = 'table';
  const CAR_VIEW_MODE_KEY = 'carInfoViewMode';
  let hasTrackedCarInfoDisplay = false;
  let searchDebounceTimer = null;
  const minSearchLength = 3;
  
  // Build class options from data
  const superclassOptions = FilterOptionsService.getSuperclassOptions();
  const regularClassOptions = FilterOptionsService.getClassOptionsFromCarsData();
  
  // Combine: All classes, then Category: superclass entries, then regular classes
  const classOptions = [{ value: '', label: 'All classes' }]
    .concat(superclassOptions)
    .concat(regularClassOptions);

  function buildRatingFilterLabel(stars, options = {}) {
    const heart = options.heart === true
      ? '<span class="cars-rating-filter-heart">♥</span>'
      : '';
    return `<span class="cars-rating-filter-label"><span class="cars-rating-filter-symbols">${stars}${heart}</span></span>`;
  }
  
  // Rating filter options: unrated, 1+ stars, 2+ stars, ..., 5 stars, favorites
  const ratingOptions = [
    { value: '', label: 'All ratings' },
    { value: '0', label: 'Unrated', labelHtml: buildRatingFilterLabel('☆') },
    { value: '1', label: '1+ stars', labelHtml: buildRatingFilterLabel('★+') },
    { value: '2', label: '2+ stars', labelHtml: buildRatingFilterLabel('★★+') },
    { value: '3', label: '3+ stars', labelHtml: buildRatingFilterLabel('★★★+') },
    { value: '4', label: '4+ stars', labelHtml: buildRatingFilterLabel('★★★★+') },
    { value: '5', label: '5 stars', labelHtml: buildRatingFilterLabel('★★★★★+') },
    { value: '6', label: 'Favorites', labelHtml: buildRatingFilterLabel('★★★★★', { heart: true }) }
  ];
  
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
    R3EAnalytics.track('cars toggled view', {
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

  function trackCarSearched(searchTerm, source, stats) {
    if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
    R3EAnalytics.track('car searched', {
      search_term: searchTerm || '',
      search_length: (searchTerm || '').length,
      source: source || 'input',
      view_mode: viewMode,
      wheel_filter: wheelFilter || '',
      transmission_filter: transFilter || '',
      class_filter: classFilter || '',
      displayed_cars: (stats && stats.displayedCars) || 0,
      displayed_classes: (stats && stats.displayedClasses) || 0,
      is_superclass_filter: !!(classFilter && classFilter.startsWith('superclass:'))
    });
  }

  function applySearchTerm(nextValue, source) {
    const trimmed = (nextValue || '').trim();
    if (trimmed.length === 0 || trimmed.length < minSearchLength) {
      searchFilter = '';
      renderResults();
      return;
    }

    searchFilter = trimmed.toLowerCase();
    const stats = renderResults();
    trackCarSearched(trimmed, source, stats);
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

  function setupSearchInput() {
    const searchInput = document.getElementById('cars-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      const nextValue = searchInput.value.trim();

      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }

      if (nextValue.length === 0 || nextValue.length < minSearchLength) {
        applySearchTerm('', 'input');
        return;
      }

      searchDebounceTimer = setTimeout(() => {
        applySearchTerm(nextValue, 'input');
      }, 300);
    });

    searchInput.addEventListener('keypress', (event) => {
      if (event.key !== 'Enter') return;
      const nextValue = searchInput.value.trim();
      if (nextValue.length < minSearchLength) return;
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      event.target.blur();
      applySearchTerm(nextValue, 'enter');
    });
  }

  function setupRatingTransferControls() {
    const exportBtn = document.getElementById('cars-export-ratings');
    const importBtn = document.getElementById('cars-import-ratings');
    const importInput = document.getElementById('cars-import-ratings-input');
    if (!exportBtn || !importBtn || !importInput || typeof CarRatings === 'undefined') return;

    exportBtn.addEventListener('click', () => {
      try {
        const payload = CarRatings.exportPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'r3e-car-ratings.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to export car scores', err);
        window.alert('Could not export car scores.');
      }
    });

    importBtn.addEventListener('click', () => {
      importInput.value = '';
      importInput.click();
    });

    importInput.addEventListener('change', async (event) => {
      const file = event.target && event.target.files ? event.target.files[0] : null;
      if (!file) return;

      try {
        const text = await file.text();
        CarRatings.importPayload(text);
        renderResults();
      } catch (err) {
        console.error('Failed to import car scores', err);
        window.alert('Could not import car scores. Please select a valid JSON export file.');
      } finally {
        importInput.value = '';
      }
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
  }, { searchable: false });
  new CustomSelect('trans-filter-ui', transOptions, (v, opts) => {
    transFilter = v;
    const stats = renderResults();
    if (opts?.source === 'user') {
      trackCarInfoFilter('transmission', v, stats);
    }
  }, { searchable: false });
  new CustomSelect('class-filter-ui-cars', classOptions, (v, opts) => {
    classFilter = v;
    const stats = renderResults();
    if (opts?.source === 'user') {
      trackCarInfoFilter('class', v, stats);
    }
  });
  new CustomSelect('rating-filter-ui', ratingOptions, (v, opts) => {
    ratingFilter = v;
    const stats = renderResults();
    if (opts?.source === 'user') {
      trackCarInfoFilter('rating', v, stats);
    }
  }, { searchable: false });

  initViewMode();
  setupSearchInput();
  setupRatingTransferControls();

  function carMatchesFilters(car) {
    const w = (car.wheel_cat || '').toLowerCase();
    const t = (car.transmission_cat || '').toLowerCase();
    const c = (car.car_class || car.class || '').toLowerCase();
    const carName = String(car.car || '').toLowerCase();
    
    // Handle wheel filter - check if it's the combined filter
    let wheelOk = true;
    if (wheelFilter) {
      if (wheelFilter === 'round_and_roundflat') {
        wheelOk = w === 'round' || w === 'round flat' || w === 'round (flat)';
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
    
    // Handle rating filter
    let ratingOk = true;
    if (ratingFilter) {
      if (typeof CarRatings !== 'undefined') {
        const carId = CarRatings.buildCarId(car);
        const carRating = CarRatings.get(carId);
        if (ratingFilter === '0') {
          ratingOk = carRating === 0;
        } else if (ratingFilter === '6') {
          ratingOk = carRating === 6;
        } else {
          const minRating = parseInt(ratingFilter);
          ratingOk = carRating >= minRating;
        }
      } else {
        ratingOk = false; // Can't filter if ratings not available
      }
    }

    let searchOk = true;
    if (searchFilter) {
      const brand = (window.R3EUtils && typeof R3EUtils.splitCarName === 'function')
        ? (R3EUtils.splitCarName(car.car || '').brand || '').toLowerCase()
        : '';
      searchOk = carName.includes(searchFilter) || c.includes(searchFilter) || brand.includes(searchFilter);
    }
    
    return wheelOk && transOk && classOk && searchOk && ratingOk;
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
    return R3ECarUtils.yearBadgeColor;
  }

  const attachBrandLogoHandlers = R3ECarUtils.attachBrandLogoHandlers;

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

  // ---- Car rating helpers ----

  const buildRatingHtml = R3ECarUtils.buildRatingHtml;
  const attachRatingHandlers = R3ECarUtils.attachRatingHandlers;

  function buildClassHeadingHtml(className, superclass) {
    const classLogoUrl = (window.R3ECarUtils && typeof window.R3ECarUtils.resolveCarClassLogoByName === 'function')
      ? window.R3ECarUtils.resolveCarClassLogoByName(className)
      : '';
    const classLogoHtml = classLogoUrl
      ? `<img class="table-car-class-logo" src="${R3EUtils.escapeHtml(classLogoUrl)}" alt="${R3EUtils.escapeHtml(className)} class logo" loading="lazy" decoding="async">`
      : '';
    const classHeaderText = R3EUtils.escapeHtml(className);
    const superclassChip = superclass
      ? `<span class="cars-class-superclass-chip">${R3EUtils.escapeHtml(superclass)}</span>`
      : '';
    return { classLogoHtml, classHeaderText, superclassChip };
  }

  function renderTable() {
    let displayedClasses = 0;
    let displayedCars = 0;
    const yearColor = createYearColorFn();

    let html = '<table class="results-table"><thead><tr>' +
      '<th>Car</th><th>Rating</th><th>Wheel</th><th>Transmission</th><th>Drive</th><th>Assists</th><th>Year</th><th>Power</th><th>Weight<br><span class="th-sub-label">*with driver</span></th><th>Engine</th>' +
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
      const { classLogoHtml, classHeaderText, superclassChip } = buildClassHeadingHtml(className, superclass);

            html += `\n<tr class="driver-group-header" data-group="${slug}" onclick="toggleGroup(this)">` +
              `<td colspan="11"><div class="cars-class-heading-wrap"><span class="toggle-icon">▼</span> <h3 class="cars-class-heading">${classLogoHtml}${classHeaderText}</h3>${superclassChip}<span class="cars-class-count">(${filteredCars.length})</span></div></td></tr>`;

      filteredCars.forEach(car => {
        displayedCars++;
        const rawLink = String(car.link || '').trim();
        const carId = CarRatings.buildCarId(car);
        const currentRating = (typeof CarRatings !== 'undefined') ? CarRatings.get(carId) : 0;
        const scoreHtml = buildRatingHtml(carId, currentRating, 'table');
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
        const carNameHtml = renderCarDisplayHtml(carName, {
          flagHtml,
          metaHtml: metaIcons,
          className: 'cars-page-car-name'
        });

        html += `\n<tr class="driver-data-row ${slug}" data-link="${rowLink}">` +
                `<td>${linkOpen}${carNameHtml}${thumbPreview}${linkClose}</td>` +
          `<td class="rating-cell">${scoreHtml}</td>` +
                `<td>${linkOpen}${wheelBadge(car.wheel_cat)}${linkClose}</td>` +
                `<td>${linkOpen}${transBadge(car.transmission_cat)}${linkClose}</td>` +
                `<td>${linkOpen}${driveBadge(car.drive)}${linkClose}</td>` +
                `<td class="car-assists-cell">${[car.TC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--tc">TC</span>' : '', car.ABS === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--abs">ABS</span>' : '', car.LC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--lc">Launch Control</span>' : ''].filter(Boolean).join(' ')}</td>` +
                `<td>${linkOpen}<span class="car-badge year-badge" data-year="${car.year}" style="background:${yearColor(car.year)}">${R3EUtils.escapeHtml(car.year || '')}</span>${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.power || '')}${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.weight || '')}${linkClose}</td>` +
                `<td class="carinfo-meta">${linkOpen}${R3EUtils.escapeHtml(car.engine || '')}${linkClose}</td>` +
                `</tr>`;
      });
    });

    html += '\n</tbody></table>';
    tableContainer.innerHTML = html;
    attachBrandLogoHandlers(tableContainer);
    attachImageCyclers(tableContainer);
    attachRatingHandlers(tableContainer);

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

  function attachDescriptionToggle(root) {
    root.querySelectorAll('.car-tile-description').forEach(function (desc) {
      desc.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var section = desc.closest('.cars-class-section');
        if (!section) return;
        var isExpanded = section.classList.contains('descriptions-expanded');
        var descs = section.querySelectorAll('.car-tile-description');

        if (isExpanded) {
          // COLLAPSE: measure expanded height, then animate down
          var expandedHeights = [];
          descs.forEach(function(d) { expandedHeights.push(d.offsetHeight); });
          // Lock at expanded height
          descs.forEach(function(d, i) { d.style.maxHeight = expandedHeights[i] + 'px'; });
          // Remove expanded class so base line-clamp:3 applies → measure target
          section.classList.remove('descriptions-expanded');
          var collapsedHeights = [];
          descs.forEach(function(d) { collapsedHeights.push(d.offsetHeight); });
          // Add animating class: line-clamp:99 + transition (text stays visible, overflow clips)
          descs.forEach(function(d) { d.classList.add('desc-animating'); });
          section.offsetHeight; // reflow with start value committed
          // Trigger transition to collapsed height
          descs.forEach(function(d, i) { d.style.maxHeight = collapsedHeights[i] + 'px'; });
          function onCollapse(ev) {
            if (!ev.target.classList || !ev.target.classList.contains('car-tile-description')) return;
            descs.forEach(function(d) { d.style.maxHeight = ''; d.classList.remove('desc-animating'); });
            section.removeEventListener('transitionend', onCollapse);
          }
          section.addEventListener('transitionend', onCollapse);
          setTimeout(function() { descs.forEach(function(d) { d.style.maxHeight = ''; d.classList.remove('desc-animating'); }); }, 350);
        } else {
          // EXPAND: measure collapsed height, then animate up
          var collapsedHeights = [];
          descs.forEach(function(d) { collapsedHeights.push(d.offsetHeight); });
          // Lock at collapsed height and enable animation
          descs.forEach(function(d, i) { d.style.maxHeight = collapsedHeights[i] + 'px'; d.classList.add('desc-animating'); });
          // Switch to expanded (line-clamp:99 from both class and desc-animating)
          section.classList.add('descriptions-expanded');
          section.offsetHeight; // reflow
          // Measure full content height and animate to it
          descs.forEach(function(d) { d.style.maxHeight = d.scrollHeight + 'px'; });
          function onExpand(ev) {
            if (!ev.target.classList || !ev.target.classList.contains('car-tile-description')) return;
            descs.forEach(function(d) { d.style.maxHeight = ''; d.classList.remove('desc-animating'); });
            section.removeEventListener('transitionend', onExpand);
          }
          section.addEventListener('transitionend', onExpand);
          setTimeout(function() { descs.forEach(function(d) { d.style.maxHeight = ''; d.classList.remove('desc-animating'); }); }, 350);
        }
      });
    });
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
      const { classLogoHtml, classHeaderText, superclassChip } = buildClassHeadingHtml(className, superclass);

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
        const carNameHtml = renderCarDisplayHtml(rawCarName, {
          className: 'cars-page-car-name cars-page-car-name-tile'
        });
        const carNameAttr = R3EUtils.escapeHtml(rawCarName);
        const isSafetyCar = (car.car_class || car.class || '').toLowerCase() === 'safety car';
        const warningIcon = isSafetyCar ? `<span class="warning-icon" title="Not eligible to Leaderboards" aria-label="Warning" role="img">⚠️</span>` : '';
        const open = rowLink ? `<a class="car-tile-link" href="${rowLink}" target="_blank" rel="noopener">` : '<div class="car-tile-link">';
        const close = rowLink ? '</a>' : '</div>';
        const description = car.description ? `<div class="car-tile-description">${R3EUtils.escapeHtml(car.description)}</div>` : '';
        const yearBadgeHtml = `<span class="car-tile-year-overlay car-badge year-badge" data-year="${car.year}" style="background:${yearColor(car.year)}">${R3EUtils.escapeHtml(car.year || '')}</span>`;
        const weightDisplay = (car.weight || '—').replace(/kg\*$/, 'kg with driver');
        const carId = CarRatings.buildCarId(car);
        const currentRating = (typeof CarRatings !== 'undefined') ? CarRatings.get(carId) : 0;
        const ratingHtml = buildRatingHtml(carId, currentRating, 'tile');
        const assistBadges = [
          car.TC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--tc">TC</span>' : '',
          car.ABS === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--abs">ABS</span>' : '',
          car.LC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--lc">Launch Control</span>' : ''
        ].filter(Boolean).join('');
        const assistsHtml = assistBadges ? `<div class="car-tile-assists-row">${assistBadges}</div>` : '';

        html += `<article class="car-tile">` +
                `${open}` +
                `<div class="car-tile-name">${carNameHtml}${warningIcon}</div>` +
                `${imageUrl ? `<div class="car-tile-image-wrap"><div class="car-tile-top-row">${flagHtml}${ratingHtml}</div><img class="car-tile-image car-rotating-image" data-image-list="${encodedImageList}" src="${imageUrl}" alt="${carNameAttr}" loading="lazy" decoding="async">${yearBadgeHtml}</div>` : ''}` +
                `${close}` +
                `<div class="car-tile-meta">` +
                `<span>${wheelBadge(car.wheel_cat)}</span><span>${transBadge(car.transmission_cat)}</span><span>${driveBadge(car.drive)}</span>` +
                `${assistsHtml}` +
                `<div class="car-tile-specs">${R3EUtils.escapeHtml(car.power || '—')} • ${R3EUtils.escapeHtml(weightDisplay)} • ${R3EUtils.escapeHtml(car.engine || '—')}</div>` +
                `${description}` +
                `</div>` +
                `</article>`;
      });
      html += '</div></section>';
    });

    html += '</div>';
    tableContainer.innerHTML = html;
    attachBrandLogoHandlers(tableContainer);
    attachImageCyclers(tableContainer);
    attachRatingHandlers(tableContainer);
    attachDescriptionToggle(tableContainer);
    return { displayedCars, displayedClasses };
  }

  function renderResults() {
    return viewMode === 'tiles' ? renderTiles() : renderTable();
  }

  const initialStats = renderResults();
  if (!hasTrackedCarInfoDisplay && typeof R3EAnalytics !== 'undefined' && typeof R3EAnalytics.track === 'function') {
    const totalClasses = data.length;
    const totalCars = data.reduce((sum, cls) => sum + ((cls.cars || []).length), 0);
    R3EAnalytics.track('cars page shown', {
      total_classes: totalClasses,
      total_cars: totalCars,
      displayed_classes: (initialStats && initialStats.displayedClasses) || 0,
      displayed_cars: (initialStats && initialStats.displayedCars) || 0,
      view_mode: viewMode
    });
    hasTrackedCarInfoDisplay = true;
  }
})();
