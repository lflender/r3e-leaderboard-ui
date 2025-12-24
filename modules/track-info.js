(function(){
  // Helper function for formatting values
  const formatValue = R3EUtils.formatValue;
  
  // Track list moved to data/tracks.js
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

  function closeMenu() { if (rootMenu) { rootMenu.hidden = true; rootToggle.setAttribute('aria-expanded','false'); } }
  function openMenu() { if (rootMenu) { rootMenu.hidden = false; rootToggle.setAttribute('aria-expanded','true'); } }

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

  // Build class menu from the hidden select `#class-filter` if present
  function buildClassMenuFromSelect() {
    if (!classMenu || !classSelect) return false;
    const options = Array.from(classSelect.options).map(o => ({ value: o.value || '', label: o.textContent || o.text }));
    // Deduplicate and remove empty placeholder (we'll add 'All classes' ourselves)
    const seen = new Set();
    const opts = options.filter(o => {
      if (!o.value) return false;
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    }).map(o => ({ value: o.value, label: o.label }));
    buildClassMenu(opts);
    return true;
  }

  // Handle selection
  function setSelectedTrack(val, label) {
    activeTrackId = val ? Number(val) : null;
    console.log('Track selected:', activeTrackId, 'label:', label);
    trackCurrentPage = 1;
    if (rootToggle) rootToggle.textContent = `${label} ▾`;
    closeMenu();
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

  // Wire class menu events
  if (classToggle && classMenu) {
    classToggle.addEventListener('click', (e) => { e.stopPropagation(); classMenu.hidden ? (classMenu.hidden = false, classToggle.setAttribute('aria-expanded','true')) : (classMenu.hidden = true, classToggle.setAttribute('aria-expanded','false')); });
    document.addEventListener('click', (e) => { if (!document.getElementById('track-class-filter-ui').contains(e.target)) { classMenu.hidden = true; classToggle.setAttribute('aria-expanded','false'); } });
    classMenu.addEventListener('click', (e) => {
      const opt = e.target.closest('.custom-select__option');
      if (!opt) return;
      const val = opt.dataset.value;
      const label = opt.textContent || opt.innerText || 'All classes';
      console.log('Class option clicked. Raw value:', val, 'label:', label);
      activeClassId = (val && val !== '') ? Number(val) : null;
      activeClassLabel = activeClassId ? label : null;
      console.log('Class selected:', activeClassId, 'label:', activeClassLabel);
      trackCurrentPage = 1;
      classToggle.textContent = `${label} ▾`;
      classMenu.hidden = true;
      // Keep the hidden select in sync if present
      if (classSelect) {
        try { classSelect.value = val; } catch (e) {}
      }
      fetchAndRender();
    });
  }

  buildMenu();
  // Initialize class menu from hidden select if available, otherwise leave empty until data fetch
  if (!buildClassMenuFromSelect()) {
    buildClassMenu([]);
  }

  // Local driver index cache
  let DRIVER_INDEX_CACHE = null;
  
  // Class menu should be stable: build once and never mutate thereafter.
  let CLASS_MENU_BUILT = false;

  async function ensureClassMenuBuilt() {
    if (CLASS_MENU_BUILT) return;
    // Always build from top_combinations to ensure we have numeric class IDs, not names
    try {
      const ts = Date.now();
      const resp = await fetch(`cache/top_combinations.json?v=${ts}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const d = await resp.json();
      let combos = [];
      if (Array.isArray(d)) combos = d; else if (d && Array.isArray(d.results)) combos = d.results; else if (d && Array.isArray(d.data)) combos = d.data;

      const classes = [];
      const seen = new Set();
      combos.forEach(item => {
        const cid = item.class_id || item.ClassID || item.classId;
        const cname = item.class_name || item.className || item.ClassName || item.car_class || item.CarClass || item.Class;
        if (cid === undefined || cid === null || !cname) return;
        const key = String(cid);
        if (seen.has(key)) return;
        seen.add(key);
        classes.push({ value: Number(cid), label: cname });
      });
      classes.sort((a,b)=> (String(a.label||'').localeCompare(String(b.label||''))));
      buildClassMenu(classes);
      CLASS_MENU_BUILT = true;
    } catch (e) {
      console.warn('Failed to build class menu from cache:', e);
      // Keep the existing menu (empty or previously set) but mark as built to avoid mutations
      CLASS_MENU_BUILT = true;
    }
  }

  async function loadDriverIndexLocal() {
    if (DRIVER_INDEX_CACHE) return DRIVER_INDEX_CACHE;
    try {
      const ts = Date.now();
      const resp = await fetch(`cache/driver_index.json?v=${ts}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      DRIVER_INDEX_CACHE = JSON.parse(text);
      return DRIVER_INDEX_CACHE;
    } catch (e) {
      console.warn('Failed to load driver_index.json', e);
      return null;
    }
  }

  async function decompressGzipToJson(resp) {
    const stream = resp.body.pipeThrough(new DecompressionStream('gzip'));
    const dec = new Response(stream);
    const text = await dec.text();
    return JSON.parse(text);
  }

  // Build static track label lookup
  function buildTrackLabelMap(){ const m = new Map(); TRACKS.forEach(t=> m.set(String(t.id), t.label)); return m; }
  const TRACK_LABELS = buildTrackLabelMap();

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
        track: TRACK_LABELS.get(key) || key,
        track_id: Number(key),
        class_id: Number(selectedClassId),
        class_name: classNameFallback || String(selectedClassId),
        entry_count: count
      });
    });
    rows.sort((a,b)=> (b.entry_count||0)-(a.entry_count||0));
    return rows;
  }

  async function aggregatePerClassForTrack(selectedTrackId){
    const idx = await loadDriverIndexLocal();
    if (!idx) return [];
    console.log('aggregatePerClassForTrack: driver_index loaded, has', Object.keys(idx).length, 'drivers');
    const perClass = new Map(); // name -> {id, count}
    let totalEntries = 0;
    let matchedEntries = 0;
    for (const k of Object.keys(idx)){
      const arr = idx[k] || [];
      totalEntries += arr.length;
      for (let i=0;i<arr.length;i++){
        const e = arr[i] || {};
        const tid = e.track_id || e.TrackID || e.trackId;
        if (i === 0 && totalEntries < 10) console.log('Sample entry:', e);
        if (Number(tid) !== Number(selectedTrackId)) continue;
        matchedEntries++;
        const cid = e.class_id || e.ClassID || e.classId;
        let cname = e.class_name || e.ClassName;
        if (!cname && e.car_class) {
          cname = typeof e.car_class === 'string' ? e.car_class : (e.car_class.class?.Name || e.car_class.class?.name);
        }
        cname = cname || e.class || e.Class || null;
        if (!cname) continue;
        const existing = perClass.get(cname);
        if (existing) {
          existing.count++;
        } else {
          perClass.set(cname, { id: cid, count: 1 });
        }
      }
    }
    console.log('Scanned', totalEntries, 'entries, matched', matchedEntries, 'for track', selectedTrackId);
    const rows = [];
    perClass.forEach((data, cname)=>{
      rows.push({
        track: TRACK_LABELS.get(String(selectedTrackId)) || String(selectedTrackId),
        track_id: Number(selectedTrackId),
        class_id: Number(data.id),
        class_name: cname,
        entry_count: data.count
      });
    });
    rows.sort((a,b)=> (b.entry_count||0)-(a.entry_count||0));
    return rows;
  }

  // Simple: resolve class ID from driver_index by name
  async function resolveClassId(className) {
    if (!className) return null;
    
    // Scan driver_index to find numeric ID for this class name
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

  // Fetch data from local cache
  async function fetchTopCombinations() {
    try {
      console.log('fetchTopCombinations called. activeTrackId:', activeTrackId, 'activeClassId:', activeClassId);
      tableContainer.innerHTML = '<div class="loading">Loading...</div>';
      
      // Case 1: Filter by class only
      if (activeClassId && !activeTrackId) {
        console.log('Filtering by class:', activeClassId, activeClassLabel);
        const results = await aggregatePerTrackForClass(activeClassId, activeClassLabel || String(activeClassId));
        console.log('Class filter returned', results.length, 'results:', results.slice(0, 3));
        return results;
      }
      
      // Case 2: Filter by track only
      if (activeTrackId && !activeClassId) {
        console.log('Filtering by track:', activeTrackId);
        const results = await aggregatePerClassForTrack(activeTrackId);
        console.log('Track filter returned', results.length, 'results:', results.slice(0, 3));
        return results;
      }
      
      // Case 3: Both track and class - aggregate by class then filter by track
      if (activeTrackId && activeClassId) {
        console.log('Filtering by both track:', activeTrackId, 'and class:', activeClassId);
        const results = await aggregatePerTrackForClass(activeClassId, activeClassLabel || String(activeClassId));
        const filtered = results.filter(item => String(item.track_id) === String(activeTrackId));
        console.log('Both filters returned', filtered.length, 'results');
        return filtered;
      }
      
      // Case 4: No filters - use top_combinations
      // Case 4: No filters - use top_combinations
      const timestamp = new Date().getTime();
      const resp = await fetch(`cache/top_combinations.json?v=${timestamp}`, {
        cache: 'no-store'
      });
      
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      
      let combinations = [];
      if (Array.isArray(data)) {
        combinations = data;
      } else if (data && Array.isArray(data.results)) {
        combinations = data.results;
      } else if (data && Array.isArray(data.data)) {
        combinations = data.data;
      }
      
      combinations.sort((a, b) => {
        // Primary sort: entry count descending
        const countDiff = (b.entry_count || 0) - (a.entry_count || 0);
        if (countDiff !== 0) return countDiff;
        
        // Secondary sort: track name alphabetically
        const trackA = String(a.track || a.Track || a.track_name || a.TrackName || '');
        const trackB = String(b.track || b.Track || b.track_name || b.TrackName || '');
        return trackA.localeCompare(trackB);
      });
      const limitedCombinations = combinations.slice(0, 1000);
      
      console.log(`Showing ${limitedCombinations.length} combinations`);
      return limitedCombinations;
    } catch (e) {
      console.error('Failed to fetch data', e);
      return [];
    }
  }

  // Render table using the same style/formatting as leaderboards
  function renderTable(data) {
    trackAllResults = Array.isArray(data) ? data : [];
    if (trackAllResults.length === 0) {
      tableContainer.innerHTML = '<div class="no-results">No results found</div>';
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
    // Keep 'class_name' so we can display it when backend returns it.
    const excludeColumns = ['ClassID','TrackID','TotalEntries','class_id','track_id','total_entries','Name','name','DriverName','driver_name','Country','country','Rank','rank','Team','team','time_diff','timeDiff','timeDifference'];
    keys = keys.filter(k => !excludeColumns.includes(k));

    // Ensure a `Car Class` column is present (normalize various field names)
    // Prefer backend's `class_name` (snake_case) or variants like className, ClassName
    const carClassFields = ['class_name','className','ClassName','car_class','CarClass','Car Class','Class','class'];
    const hasCarClass = keys.some(k => carClassFields.includes(k));
    if (!hasCarClass) {
      // Add synthetic key so we can render it; we'll compute value from item on render
      keys.unshift('Car Class');
    }

    // Order columns similar to leaderboards
    const columnOrder = ['CarClass','Car Class','car_class','Class','Car','car','CarName','Track','track','TrackName','LapTime','Lap Time','lap_time','laptime','Time','Position','position','Pos'];
    keys.sort((a,b)=>{ let ia = columnOrder.indexOf(a); let ib = columnOrder.indexOf(b); if (ia===-1) ia=999; if (ib===-1) ib=999; return ia-ib; });

    let html = '<table class="results-table"><thead><tr>';
    keys.forEach(k=> html += `<th>${R3EUtils.formatHeader(k)}</th>`);
    html += '</tr></thead><tbody>';

    pageItems.forEach(item => {
      // derive IDs and pos for data attributes
      const trackIdVal = item.track_id || item.TrackID || item.trackId || item.track || item.Track || '';
      const classIdVal = item.class_id || item.ClassID || item.classId || item.class || item.class_name || item.className || item.ClassName || '';
      const posVal = item.position || item.Position || item.Pos || item.rank || '';
      html += `<tr class="driver-data-row" onclick="openDetailView(event, this)" data-trackid="${R3EUtils.escapeHtml(String(trackIdVal))}" data-classid="${R3EUtils.escapeHtml(String(classIdVal))}" data-position="${R3EUtils.escapeHtml(String(posVal))}">`;
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
        } else if (key === 'Car Class' || key === 'car_class' || key === 'Class' || key === 'CarClass') {
          // Car class cell: allow wrapping and target with class for mobile sizing
          html += `<td class="class-cell">${formatValue(value)}</td>`;
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
          let trackStr = String(value || '');
          trackStr = trackStr.replace(/(\s+)([-–—])(\s+)/g, '$1<wbr>$2$3');
          trackStr = R3EUtils.escapeHtml(trackStr).replace(/&lt;wbr&gt;/g, '<wbr>');
          html += `<td class="track-cell">${trackStr}</td>`;
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
    const data = await fetchTopCombinations();
    // Ensure class menu is built only once and never mutated
    await ensureClassMenuBuilt();

    renderTable(data);
  }

  // Initial load
  fetchAndRender();
  // Proactively build the class menu from cache on startup so it remains stable
  ensureClassMenuBuilt();

})();