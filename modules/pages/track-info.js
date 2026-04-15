(function(){
  // Helper function for formatting values
  const formatValue = R3EUtils.formatValue;
  
  // Track list moved to modules/data/tracks.js
  const TRACKS = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];

  // DOM refs
  const rootToggle = document.querySelector('#track-filter-ui .custom-select__toggle');
  const rootMenu = document.querySelector('#track-filter-ui .custom-select__menu');
  const classToggle = document.querySelector('#track-class-filter-ui .custom-select__toggle');
  const classMenu = document.querySelector('#track-class-filter-ui .custom-select__menu');
  const classSelect = document.getElementById('class-filter');
  const tableContainer = document.getElementById('track-info-table');

  // Pagination state (separate from leaderboards to avoid conflicts)
  let trackCurrentPage = 1;
  const trackItemsPerPage = 100;
  let trackAllResults = [];
  let activeTrackId = null; // null => All tracks
  let activeClassId = null; // null => All classes
  let activeClassLabel = null; // human-readable label for selected class
  let combineMode = false; // When true, combine all classes in superclass by track
  let hasTrackedTrackInfoDisplay = false;

  // DOM refs for combine checkbox
  const combineContainer = document.getElementById('combine-checkbox-container');
  const combineCheckbox = document.getElementById('combine-checkbox');

  function closeMenu() { if (rootMenu) { rootMenu.hidden = true; rootToggle.setAttribute('aria-expanded','false'); } }
  function openMenu() { if (rootMenu) { rootMenu.hidden = false; rootToggle.setAttribute('aria-expanded','true'); } }

  function trackTrackInfoFilter(filterName, filterValue) {
    if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
    R3EAnalytics.track('track info filter changed', {
      filter_name: filterName,
      filter_value: filterValue || '',
      track_filter: activeTrackId ? String(activeTrackId) : '',
      class_filter: activeClassId || '',
      combine_mode: !!combineMode,
      is_superclass_filter: !!(activeClassId && activeClassId.startsWith('superclass:'))
    });
  }

  // Build menu options from TRACKS + All tracks
  function buildMenu() {
    if (!rootMenu) return;
    const options = [{ value: '', label: 'All tracks' }].concat(TRACKS.map(t => ({ value: String(t.id), label: t.label })));
    rootMenu.innerHTML = options.map(opt => `<div class="custom-select__option" data-value="${R3EUtils.escapeHtml(opt.value)}">${R3EUtils.escapeHtml(opt.label)}</div>`).join('');
  }

  // Build class menu from a list of class options (value/label)
  function buildClassMenu(classOptions) {
    if (!classMenu) return;
    const opts = [{ value: '', label: 'All classes' }].concat(classOptions.map(c => ({ value: String(c.value), label: c.label })));
    classMenu.innerHTML = opts.map(opt => `<div class="custom-select__option" data-value="${R3EUtils.escapeHtml(opt.value)}">${R3EUtils.escapeHtml(opt.label)}</div>`).join('');
  }

  // Handle selection
  function setSelectedTrack(val, label) {
    activeTrackId = val ? Number(val) : null;
    trackCurrentPage = 1;
    if (rootToggle) rootToggle.textContent = `${label} ▾`;
    closeMenu();
    trackTrackInfoFilter('track', val ? String(val) : '');
    fetchAndRender();
  }

  // Wire menu events
  if (rootToggle && rootMenu) {
    rootToggle.addEventListener('click', (e) => { e.stopPropagation(); rootMenu.hidden ? openMenu() : closeMenu(); });
    document.addEventListener('click', (e) => { if (!document.getElementById('track-filter-ui').contains(e.target)) closeMenu(); });
    rootMenu.addEventListener('click', (e) => {
      const opt = e.target.closest('.custom-select__option');
      if (!opt) return;
      const val = opt.dataset.value;
      const label = opt.textContent || opt.innerText || 'All tracks';
      setSelectedTrack(val, label);
    });
  }

  buildMenu();
  
  // Initialize class menu with superclass categories
  const superclassOptions = dataService.getSuperclassOptions();
  const regularClassOptions = dataService.getClassOptionsFromCarsData();
  
  const classOptions = [{ value: '', label: 'All classes' }]
    .concat(superclassOptions)
    .concat(regularClassOptions);
  
  new CustomSelect('track-class-filter-ui', classOptions, async (value, opts) => {
    activeClassId = value || null;
    activeClassLabel = value || null;
    trackCurrentPage = 1;
    if (classSelect) {
      try { classSelect.value = value; } catch (e) {}
    }
    
    // Show/hide combine checkbox based on whether a superclass is selected
    const isSuperclass = value && value.startsWith('superclass:');
    if (combineContainer) {
      combineContainer.style.display = isSuperclass ? 'flex' : 'none';
    }
    // Reset combine mode when changing filter
    if (!isSuperclass && combineCheckbox) {
      combineCheckbox.checked = false;
      combineMode = false;
    }

    if (opts?.source === 'user') {
      trackTrackInfoFilter('class', value || '');
    }
    
    fetchAndRender();
  });

  // Handle combine checkbox changes
  if (combineCheckbox) {
    combineCheckbox.addEventListener('change', () => {
      combineMode = combineCheckbox.checked;
      trackCurrentPage = 1;
      trackTrackInfoFilter('combine', combineMode ? 'on' : 'off');
      fetchAndRender();
    });
  }

  // Local driver index cache (populated via dataService for single-flight behavior)
  let DRIVER_INDEX_CACHE = null;

  async function loadDriverIndexLocal() {
    if (DRIVER_INDEX_CACHE) return DRIVER_INDEX_CACHE;
    // Reuse centralized loader to avoid duplicate fetches and leverage stale cache
    const idx = await dataService.waitForDriverIndex();
    if (idx && Object.keys(idx).length > 0) {
      DRIVER_INDEX_CACHE = idx;
      return DRIVER_INDEX_CACHE;
    }
    return null;
  }

  async function decompressGzipToJson(resp) {
    if (!window.CompressedJsonHelper || typeof window.CompressedJsonHelper.readGzipJson !== 'function') {
      throw new Error('CompressedJsonHelper is not loaded.');
    }
    return window.CompressedJsonHelper.readGzipJson(resp);
  }
  function resolveTrackLabel(trackId, fallback = '') {
    if (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabel === 'function') {
      return window.R3EUtils.resolveTrackLabel(trackId, fallback);
    }
    return fallback ? String(fallback) : String(trackId || '');
  }

  function resolveTrackLabelForItem(item, fallback = '') {
    if (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function') {
      return window.R3EUtils.resolveTrackLabelForItem(item, fallback);
    }

    const tid = item?.track_id || item?.TrackID || item?.trackId || item?.['Track ID'] || '';
    return resolveTrackLabel(tid, fallback || item?.track || item?.Track || item?.track_name || item?.TrackName || '');
  }

  async function aggregatePerTrackForClass(selectedClassId, classNameFallback){
    const idx = await loadDriverIndexLocal();
    if (!idx) return [];
    const perTrack = new Map();
    for (const k of Object.keys(idx)){
      const arr = idx[k] || [];
      for (let i=0;i<arr.length;i++){
        const e = arr[i] || {};
        const cid = e.class_id || e.ClassID || e.classId;
        if (Number(cid) !== Number(selectedClassId)) continue;
        const tid = e.track_id || e.TrackID || e.trackId;
        if (tid === undefined || tid === null) continue;
        const key = String(tid);
        const cur = perTrack.get(key) || 0;
        perTrack.set(key, cur + 1);
      }
    }
    const rows = [];
    perTrack.forEach((count, key)=>{
      rows.push({
        track_id: Number(key),
        class_id: Number(selectedClassId),
        class_name: classNameFallback || String(selectedClassId),
        entry_count: count
      });
    });
    rows.sort((a,b)=> (b.entry_count||0)-(a.entry_count||0));
    return rows;
  }

  // Aggregate by track for a superclass, combining all classes in the superclass
  async function aggregateByTrackForSuperclass(superclassName) {
    const idx = await loadDriverIndexLocal();
    if (!idx) return [];
    
    // Get all class IDs that belong to this superclass
    const superclassClassIds = new Set();
    const classIdMap = await resolveMultipleClassIds(
      window.CARS_DATA
        .filter(entry => entry.superclass === superclassName)
        .map(entry => entry.class || entry.car_class || '')
        .filter(c => c)
    );
    classIdMap.forEach((id, name) => {
      if (id !== null) superclassClassIds.add(Number(id));
    });
    
    // Aggregate by track
    const perTrack = new Map();
    for (const k of Object.keys(idx)) {
      const arr = idx[k] || [];
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i] || {};
        const cid = Number(e.class_id || e.ClassID || e.classId);
        if (!superclassClassIds.has(cid)) continue;
        const tid = e.track_id || e.TrackID || e.trackId;
        if (tid === undefined || tid === null) continue;
        const key = String(tid);
        const cur = perTrack.get(key) || 0;
        perTrack.set(key, cur + 1);
      }
    }
    
    const rows = [];
    perTrack.forEach((count, key) => {
      rows.push({
        track_id: Number(key),
        superclass: superclassName,
        entry_count: count
      });
    });
    rows.sort((a, b) => (b.entry_count || 0) - (a.entry_count || 0));
    return rows;
  }

  async function aggregatePerClassForTrack(selectedTrackId){
    const idx = await loadDriverIndexLocal();
    if (!idx) return [];
    const perClass = new Map(); // classId -> {name, count}
    let totalEntries = 0;
    let matchedEntries = 0;
    for (const k of Object.keys(idx)){
      const arr = idx[k] || [];
      totalEntries += arr.length;
      for (let i=0;i<arr.length;i++){
        const e = arr[i] || {};
        const tid = e.track_id || e.TrackID || e.trackId;
        if (Number(tid) !== Number(selectedTrackId)) continue;
        matchedEntries++;
        const cid = e.class_id || e.ClassID || e.classId;
        if (!cid) continue;
        
        // Use static lookup for class name (fast) or fallback to entry fields
        let cname = window.getCarClassName ? window.getCarClassName(cid) : null;
        if (!cname || cname === String(cid)) {
          cname = e.car_class || e.class_name || e.ClassName || e.class || e.Class || String(cid);
        }
        
        const key = String(cid);
        const existing = perClass.get(key);
        if (existing) {
          existing.count++;
        } else {
          perClass.set(key, { id: cid, name: cname, count: 1 });
        }
      }
    }
    const rows = [];
    perClass.forEach((data, key)=>{
      rows.push({
        track_id: Number(selectedTrackId),
        class_id: Number(data.id),
        class_name: data.name,
        entry_count: data.count
      });
    });
    rows.sort((a,b)=> (b.entry_count||0)-(a.entry_count||0));
    return rows;
  }

  // Simple: resolve class ID from static mapping (fast)
  async function resolveClassId(className) {
    if (!className) return null;
    
    // Use the fast static lookup from car-classes.js
    if (window.getCarClassId) {
      const classId = window.getCarClassId(className);
      return classId ? Number(classId) : null;
    }
    
    // Fallback: scan driver_index to find numeric ID for this class name (slow)
    const idx = await loadDriverIndexLocal();
    if (!idx) return null;
    
    const targetName = String(className).trim().toLowerCase();
    const counts = new Map();
    
    for (const driverKey of Object.keys(idx)) {
      const entries = idx[driverKey] || [];
      for (const e of entries) {
        let cname = e.class_name || e.ClassName;
        if (!cname && e.car_class) {
          cname = typeof e.car_class === 'string' ? e.car_class : (e.car_class.class?.Name || e.car_class.class?.name);
        }
        cname = cname || e.Class || e.class || '';
        if (String(cname).trim().toLowerCase() === targetName) {
          const cid = e.class_id || e.ClassID || e.classId;
          if (cid !== undefined && cid !== null) {
            const key = Number(cid);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
      }
    }
    
    let bestId = null;
    let bestCount = 0;
    for (const [cid, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestId = cid;
      }
    }
    
    return bestId;
  }

  // Resolve multiple class names to their IDs using static mapping (fast)
  async function resolveMultipleClassIds(classNames) {
    const result = new Map();
    if (!classNames || classNames.length === 0) return result;
    
    // Use the fast static lookup from car-classes.js
    if (window.getCarClassId) {
      classNames.forEach(className => {
        const classId = window.getCarClassId(className);
        result.set(className, classId ? Number(classId) : null);
      });
      return result;
    }
    
    // Fallback: scan driver index (slow path, should not be needed)
    const idx = await loadDriverIndexLocal();
    if (!idx) return result;
    
    // Build a map of lowercase class names to their counts
    const classNameMap = new Map(); // className -> Map<classId, count>
    classNames.forEach(name => {
      classNameMap.set(String(name).trim().toLowerCase(), new Map());
    });
    
    for (const driverKey of Object.keys(idx)) {
      const entries = idx[driverKey] || [];
      for (const e of entries) {
        let cname = e.class_name || e.ClassName;
        if (!cname && e.car_class) {
          cname = typeof e.car_class === 'string' ? e.car_class : (e.car_class.class?.Name || e.car_class.class?.name);
        }
        cname = cname || e.Class || e.class || '';
        const cnameKey = String(cname).trim().toLowerCase();
        
        if (classNameMap.has(cnameKey)) {
          const cid = e.class_id || e.ClassID || e.classId;
          if (cid !== undefined && cid !== null) {
            const counts = classNameMap.get(cnameKey);
            const key = Number(cid);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
      }
    }
    
    // Find best ID for each class
    classNames.forEach(className => {
      const cnameKey = String(className).trim().toLowerCase();
      const counts = classNameMap.get(cnameKey);
      if (counts && counts.size > 0) {
        let bestId = null;
        let bestCount = 0;
        for (const [cid, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bestId = cid;
          }
        }
        result.set(className, bestId);
      } else {
        result.set(className, null);
      }
    });
    
    return result;
  }

  // Single-flight cache for all_combinations.json.gz to handle concurrent requests
  let allCombinationsPromise = null;
  let allCombinations = null;

  // Fetch all combinations (full list, for use when filters are applied)
  async function loadAllCombinations() {
    if (allCombinations) return allCombinations;
    if (allCombinationsPromise) return allCombinationsPromise;

    allCombinationsPromise = (async () => {
      const timestamp = new Date().getTime();
      try {
        const resp = await fetch(`cache/all_combinations.json.gz?v=${timestamp}`, {
          cache: 'no-store'
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await decompressGzipToJson(resp);
        let combinations = [];
        if (Array.isArray(data)) {
          combinations = data;
        } else if (data && Array.isArray(data.results)) {
          combinations = data.results;
        } else if (data && Array.isArray(data.data)) {
          combinations = data.data;
        }
        allCombinations = combinations;
        return combinations;
      } catch (e) {
        console.error('Failed to load all_combinations.json.gz:', e);
        return [];
      } finally {
        allCombinationsPromise = null;
      }
    })();

    return allCombinationsPromise;
  }

  // Fetch data from local cache
  // Without filters: use top_combinations.json.gz (1000 entries, fast)
  // With filters: use all_combinations.json.gz (all entries, with single-flight caching for concurrent access)
  async function fetchTopCombinations() {
    try {
      await TemplateHelper.showLoading(tableContainer);

      const timestamp = new Date().getTime();
      let combinations = [];

      // If filters are active, use the full uncapped data
      if (activeTrackId || activeClassId) {
        combinations = await loadAllCombinations();
      } else {
        // No filters: use legacy top_combinations.json.gz for speed (1000 cap is intentional for default view)
        const resp = await fetch(`cache/top_combinations.json.gz?v=${timestamp}`, {
          cache: 'no-store'
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await decompressGzipToJson(resp);
        if (Array.isArray(data)) {
          combinations = data;
        } else if (data && Array.isArray(data.results)) {
          combinations = data.results;
        } else if (data && Array.isArray(data.data)) {
          combinations = data.data;
        }
      }

      // Apply filters
      let filtered = combinations;

      // Filter by track if selected
      if (activeTrackId) {
        filtered = filtered.filter(item => {
          const tid = item.track_id || item.TrackID || item.trackId;
          return Number(tid) === Number(activeTrackId);
        });
      }

      // Filter by class if selected (using class NAME like other pages)
      if (activeClassId) {
        // Check if this is a superclass filter
        if (activeClassId.startsWith('superclass:')) {
          const superclassName = activeClassId.replace('superclass:', '');

          // Get all classes that belong to this superclass
          const superclassClasses = new Set();
          if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
            window.CARS_DATA.forEach(entry => {
              if (entry.superclass === superclassName) {
                const cls = entry.class || entry.car_class || entry.CarClass || '';
                if (cls) superclassClasses.add(cls);
              }
            });
          }

          // Filter by any class in this superclass
          filtered = filtered.filter(item => {
            const className = item.class_name || item.ClassName || item.car_class || item.CarClass || item.Class || item.class || '';
            return superclassClasses.has(String(className).trim());
          });
        } else {
          // Regular class filter
          filtered = filtered.filter(item => {
            const className = item.class_name || item.ClassName || item.car_class || item.CarClass || item.Class || item.class || '';
            return String(className).trim() === String(activeClassId).trim();
          });
        }
      }

      // Sort filtered results
      filtered.sort((a, b) => {
        // Primary sort: entry count descending
        const countDiff = (b.entry_count || 0) - (a.entry_count || 0);
        if (countDiff !== 0) return countDiff;

        // Secondary sort: track name alphabetically
        const trackA = resolveTrackLabelForItem(a);
        const trackB = resolveTrackLabelForItem(b);
        return trackA.localeCompare(trackB);
      });

      return filtered;
    } catch (e) {
      console.error('Failed to fetch data', e);
      return [];
    }
  }

  // Render table using the same style/formatting as leaderboards
  async function renderTable(data) {
    trackAllResults = Array.isArray(data) ? data : [];
    if (!hasTrackedTrackInfoDisplay && typeof R3EAnalytics !== 'undefined' && typeof R3EAnalytics.track === 'function') {
      R3EAnalytics.track('track info displayed', {
        displayed_rows: trackAllResults.length,
        track_filter: activeTrackId ? String(activeTrackId) : '',
        class_filter: activeClassId || '',
        combine_mode: !!combineMode,
        is_superclass_filter: !!(activeClassId && activeClassId.startsWith('superclass:'))
      });
      hasTrackedTrackInfoDisplay = true;
    }
    if (trackAllResults.length === 0) {
      await TemplateHelper.showNoResults(tableContainer);
      return;
    }

    // For track-info we expect items as plain rows (not grouped by driver) so reuse displayResults logic lightly
    // We'll group by driver if needed, but keep it simple: show rows directly with same column ordering
    const totalItems = trackAllResults.length;
    const totalPages = Math.ceil(totalItems / trackItemsPerPage);
    const startIndex = (trackCurrentPage - 1) * trackItemsPerPage;
    const endIndex = Math.min(startIndex + trackItemsPerPage, totalItems);
    const pageItems = trackAllResults.slice(startIndex, endIndex);

    // Determine keys from first item and ensure Car Class column exists
    let keys = pageItems.length > 0 ? Object.keys(pageItems[0]) : [];
    const hasTrackId = keys.some(k => ['track_id','TrackID','trackId','Track ID'].includes(k));
    const hasTrackColumn = keys.some(k => ['Track','track','TrackName','track_name'].includes(k));
    // Keep 'class_name' so we can display it when backend returns it.
    let excludeColumns = ['ClassID','TrackID','class_id','track_id','Name','name','DriverName','driver_name','Country','country','Rank','rank','Team','team','time_diff','timeDiff','timeDifference'];
    
    // In combine mode, also exclude class-related columns since we're showing combined data
    if (combineMode) {
      excludeColumns = excludeColumns.concat(['class_name','className','ClassName','car_class','CarClass','Car Class','Class','class','superclass']);
    }
    
    keys = keys.filter(k => !excludeColumns.includes(k));

    if (hasTrackId && !hasTrackColumn) {
      keys.unshift('track');
    }

    // Ensure a `Car Class` column is present (normalize various field names) - but NOT in combine mode
    if (!combineMode) {
      const carClassFields = ['class_name','className','ClassName','car_class','CarClass','Car Class','Class','class'];
      const hasCarClass = keys.some(k => carClassFields.includes(k));
      if (!hasCarClass) {
        // Add synthetic key so we can render it; we'll compute value from item on render
        keys.unshift('Car Class');
      }
    }

    // Order columns using ColumnConfig for consistency
    // Note: Track Info needs the entry_count column, so we preserve it even though it's marked hidden in ColumnConfig
    const entryCountKey = keys.find(k => window.ColumnConfig && window.ColumnConfig.isColumnType(k, 'TOTAL_ENTRIES'));
    
    if (window.ColumnConfig) {
      // Get ordered columns (this will filter out entry_count since it's marked hidden)
      let orderedKeys = window.ColumnConfig.getOrderedColumns(keys, { addSynthetic: false });
      
      // Manually add entry_count back if it was in the original data (use the actual key from data, not canonical ID)
      if (entryCountKey && !orderedKeys.some(k => window.ColumnConfig.isColumnType(k, 'TOTAL_ENTRIES'))) {
        // Find where to insert it based on the TOTAL_ENTRIES order setting (35, between Track and Position)
        const trackIndex = orderedKeys.findIndex(k => window.ColumnConfig.isColumnType(k, 'TRACK'));
        const insertIndex = trackIndex >= 0 ? trackIndex + 1 : orderedKeys.length;
        orderedKeys.splice(insertIndex, 0, entryCountKey);
      }
      
      keys = orderedKeys;
    } else {
      // Fallback: basic ordering
      const columnOrder = ['CarClass','Car Class','car_class','Class','Car','car','CarName','Track','track','TrackName','LapTime','Lap Time','lap_time','laptime','Time','Position','position','Pos','date_time','Date'];
      keys.sort((a,b)=>{ let ia = columnOrder.indexOf(a); let ib = columnOrder.indexOf(b); if (ia===-1) ia=999; if (ib===-1) ib=999; return ia-ib; });
    }

    let html = '<table class="results-table"><thead><tr>';
    keys.forEach(k => {
      const displayName = window.ColumnConfig ? window.ColumnConfig.getDisplayName(k) : R3EUtils.formatHeader(k);
      const isEntriesColumn = window.ColumnConfig && window.ColumnConfig.isColumnType(k, 'TOTAL_ENTRIES');
      let headerClass = '';
      if (isEntriesColumn) headerClass = ' class="entries-cell"';
      html += `<th${headerClass}>${displayName}</th>`;
    });
    html += '</tr></thead><tbody>';

    pageItems.forEach(item => {
      // derive IDs and pos for data attributes
      const trackIdVal = item.track_id || item.TrackID || item.trackId || '';
      const classIdVal = item.class_id || item.ClassID || item.classId || item.class || item.class_name || item.className || item.ClassName || '';
      const superclassVal = item.superclass || ''; // For combined mode
      const posVal = item.position || item.Position || item.Pos || item.rank || '';
      const nameVal = item.Name || item.name || item.DriverName || '';
      const timeVal = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
      html += `<tr class="driver-data-row" onclick="openDetailView(event, this)" data-trackid="${R3EUtils.escapeHtml(String(trackIdVal))}" data-classid="${R3EUtils.escapeHtml(String(classIdVal))}" data-superclass="${R3EUtils.escapeHtml(String(superclassVal))}" data-position="${R3EUtils.escapeHtml(String(posVal))}" data-name="${R3EUtils.escapeHtml(String(nameVal))}" data-time="${R3EUtils.escapeHtml(String(timeVal))}">`;
      keys.forEach(key => {
        // If synthetic 'Car Class' key, derive value from common fields in the item
        let value;
        if (key === 'Car Class' && (item['Car Class'] === undefined && item['CarClass'] === undefined && item['car_class'] === undefined && item['Class'] === undefined && item['class'] === undefined && item['class_name'] === undefined && item.className === undefined && item.ClassName === undefined)) {
          value = item.class_name || item.className || item.ClassName || item.car_class || item.CarClass || item['Car Class'] || item.Class || item.class || '-';
        } else {
          value = item[key];
        }
        // position handling
        if (key === 'Position' || key === 'position' || key === 'Pos') {
          const posNum = String(value || '');
          html += `<td class="pos-cell"><span class="pos-number">${R3EUtils.escapeHtml(posNum)}</span></td>`;
        } else if (key === 'Car Class' || key === 'car_class' || key === 'Class' || key === 'CarClass' || key === 'class_name' || key === 'className' || key === 'ClassName' || key === 'class') {
          const className = String(value || '').trim();
          const classLogoUrl = (window.R3EUtils && typeof window.R3EUtils.resolveCarClassLogo === 'function')
            ? window.R3EUtils.resolveCarClassLogo(className, classIdVal)
            : '';
          const classLogoHtml = classLogoUrl
            ? `<img class="table-car-class-logo" src="${R3EUtils.escapeHtml(classLogoUrl)}" alt="${R3EUtils.escapeHtml(className || 'Car class')} class logo" loading="lazy" decoding="async" />`
            : '';
          const classTextHtml = className ? R3EUtils.escapeHtml(className) : '—';
          html += `<td class="class-cell car-class-cell"><strong>${classLogoHtml}${classTextHtml}</strong></td>`;
        } else if (key === 'LapTime' || key === 'Lap Time' || key === 'lap_time' || key === 'laptime' || key === 'Time') {
          const s = String(value || '');
          const parts = s.split(/,\s*/);
          const main = parts[0] || '';
          const delta = parts.slice(1).join(', ');
          const escMain = R3EUtils.escapeHtml(String(main));
          const escDelta = R3EUtils.escapeHtml(String(delta));
          if (delta) html += `<td class="no-wrap">${escMain} <span class="time-delta-inline">${escDelta}</span></td>`;
          else html += `<td class="no-wrap">${escMain}</td>`;
        } else if (key === 'Track' || key === 'track' || key === 'TrackName' || key === 'track_name') {
          let trackStr = resolveTrackLabelForItem(item, value || '');
          // Normalize track name to fix known inconsistencies
          if (window.DataNormalizer && window.DataNormalizer.normalizeTrackName) {
            trackStr = window.DataNormalizer.normalizeTrackName(trackStr);
          }
          // Split track name and layout (e.g., "Donington Park - Grand Prix")
          const parts = trackStr.split(/\s*[-–—]\s+/);
          if (parts.length >= 2) {
            const trackName = R3EUtils.escapeHtml(parts[0]);
            const layoutName = R3EUtils.escapeHtml(parts.slice(1).join(' - '));
            html += `<td class="track-cell">${trackName} <span class="track-layout">${layoutName}</span></td>`;
          } else {
            // No layout part, just return track name with word break
            trackStr = trackStr.replace(/(\s+)([-–—])(\s+)/g, '$1<wbr>$2$3');
            trackStr = R3EUtils.escapeHtml(trackStr).replace(/&lt;wbr&gt;/g, '<wbr>');
            html += `<td class="track-cell">${trackStr}</td>`;
          }
        } else if (key === 'date_time' || key === 'dateTime' || key === 'Date') {
          // Date formatting
          const formattedDate = value ? R3EUtils.formatDate(value) : '';
          html += `<td class="date-cell">${R3EUtils.escapeHtml(formattedDate)}</td>`;
        } else if (window.ColumnConfig && window.ColumnConfig.isColumnType(key, 'TOTAL_ENTRIES')) {
          // Entries column: use specific class for right-alignment
          html += `<td class="entries-cell">${formatValue(value)}</td>`;
        } else {
          html += `<td>${formatValue(value)}</td>`;
        }
      });
      html += '</tr>';
    });

    html += '</tbody></table>';

    // Pagination controls (both above and below table for easier navigation)
    let paginationHTML = '';
    if (totalPages > 1) {
      paginationHTML = '<div class="pagination">';
      paginationHTML += `<div class="pagination-info">Showing ${startIndex+1}-${endIndex} of ${totalItems}</div>`;
      paginationHTML += '<div class="pagination-buttons">';
      if (trackCurrentPage > 1) paginationHTML += `<button onclick="window.trackInfoGoToPage(${trackCurrentPage-1})" class="page-btn">‹ Previous</button>`;
      const maxPagesToShow = 5;
      let startPage = Math.max(1, trackCurrentPage - Math.floor(maxPagesToShow/2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      if (endPage - startPage < maxPagesToShow - 1) startPage = Math.max(1, endPage - maxPagesToShow + 1);
      if (startPage > 1) { paginationHTML += `<button onclick="window.trackInfoGoToPage(1)" class="page-btn">1</button>`; if (startPage > 2) paginationHTML += '<span class="page-ellipsis">...</span>'; }
      for (let i=startPage;i<=endPage;i++){ const active = i===trackCurrentPage ? 'active' : ''; paginationHTML += `<button onclick="window.trackInfoGoToPage(${i})" class="page-btn ${active}">${i}</button>`; }
      if (endPage < totalPages) { if (endPage < totalPages - 1) paginationHTML += '<span class="page-ellipsis">...</span>'; paginationHTML += `<button onclick="window.trackInfoGoToPage(${totalPages})" class="page-btn">${totalPages}</button>`; }
      if (trackCurrentPage < totalPages) paginationHTML += `<button onclick="window.trackInfoGoToPage(${trackCurrentPage+1})" class="page-btn">Next ›</button>`;
      paginationHTML += '</div></div>';
    }

    tableContainer.innerHTML = paginationHTML + html + paginationHTML;
  }

  // Expose a global function for pagination buttons to call
  window.trackInfoGoToPage = function(page){ trackCurrentPage = page; renderTable(trackAllResults); const el = document.getElementById('track-info'); if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); };

  async function fetchAndRender(){
    // Show a loading indicator during initial heavy aggregations
    if (tableContainer && (activeTrackId || activeClassId)) {
      tableContainer.innerHTML = '<div class="loading">Loading...</div>';
    }

    // fetchTopCombinations already handles filtering by activeTrackId / activeClassId
    // (including superclass expansion) via closures. Use it for all cases.
    let data = await fetchTopCombinations();

    // Combine mode: collapse per-class rows into per-track totals for a superclass filter
    if (activeClassId && activeClassId.startsWith('superclass:') && combineMode) {
      const superclassName = activeClassId.replace('superclass:', '');
      const byTrack = new Map();
      data.forEach(row => {
        const tid = String(row.track_id || row.TrackID || row.trackId || '');
        if (!tid) return;
        const existing = byTrack.get(tid);
        if (existing) {
          existing.entry_count = (existing.entry_count || 0) + (row.entry_count || 0);
        } else {
          byTrack.set(tid, {
            track: row.track || row.Track || row.track_name || row.TrackName || tid,
            track_id: row.track_id || row.TrackID || row.trackId,
            superclass: superclassName,
            entry_count: row.entry_count || 0
          });
        }
      });
      data = Array.from(byTrack.values());
      data.sort((a, b) => (b.entry_count || 0) - (a.entry_count || 0));
    }

    renderTable(data);
  }

  // Initial load
  fetchAndRender();

})();