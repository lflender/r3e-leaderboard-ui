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

  // Handle selection
  function setSelectedTrack(val, label) {
    activeTrackId = val ? Number(val) : null;
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

  buildMenu();
  
  // Initialize class menu - EXACT SAME WAY AS DRIVER INFO PAGE
  const classOptions = [{ value: '', label: 'All classes' }].concat(
    dataService.getClassOptionsFromCarsData()
  );
  
  new CustomSelect('track-class-filter-ui', classOptions, async (value) => {
    activeClassId = value || null;
    activeClassLabel = value || null;
    trackCurrentPage = 1;
    if (classSelect) {
      try { classSelect.value = value; } catch (e) {}
    }
    fetchAndRender();
  });

  // Local driver index cache
  let DRIVER_INDEX_CACHE = null;

  async function loadDriverIndexLocal() {
    if (DRIVER_INDEX_CACHE) return DRIVER_INDEX_CACHE;
    const maxAttempts = 10;
    const baseDelayMs = 250;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        if (!text || text.trim().length === 0) throw new Error('Empty body');
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
        if (Object.keys(parsed).length === 0) throw new Error('Empty index');
        DRIVER_INDEX_CACHE = parsed;
        return DRIVER_INDEX_CACHE;
      } catch (e) {
        const delay = baseDelayMs * Math.min(20, attempt);
        console.warn(`Driver index attempt ${attempt}/${maxAttempts} failed:`, e && e.message ? e.message : e);
        if (attempt === maxAttempts) return null;
        await new Promise(r => setTimeout(r, delay));
      }
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
    const perClass = new Map(); // name -> {id, count}
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
      tableContainer.innerHTML = '<div class="loading">Loading...</div>';
      
      // Load all combinations from cache
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
        filtered = filtered.filter(item => {
          const className = item.class_name || item.ClassName || item.car_class || item.CarClass || item.Class || item.class || '';
          return String(className).trim() === String(activeClassId).trim();
        });
      }
      
      // Sort filtered results
      filtered.sort((a, b) => {
        // Primary sort: entry count descending
        const countDiff = (b.entry_count || 0) - (a.entry_count || 0);
        if (countDiff !== 0) return countDiff;
        
        // Secondary sort: track name alphabetically
        const trackA = String(a.track || a.Track || a.track_name || a.TrackName || '');
        const trackB = String(b.track || b.Track || b.track_name || b.TrackName || '');
        return trackA.localeCompare(trackB);
      });
      
      const limitedCombinations = filtered.slice(0, 1000);
      
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
      const nameVal = item.Name || item.name || item.DriverName || '';
      const timeVal = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
      html += `<tr class="driver-data-row" onclick="openDetailView(event, this)" data-trackid="${R3EUtils.escapeHtml(String(trackIdVal))}" data-classid="${R3EUtils.escapeHtml(String(classIdVal))}" data-position="${R3EUtils.escapeHtml(String(posVal))}" data-name="${R3EUtils.escapeHtml(String(nameVal))}" data-time="${R3EUtils.escapeHtml(String(timeVal))}">`;
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
    // BOTH track and class selected - scan driver_index for the specific combination
    if (activeTrackId && activeClassId) {
      const numericClassId = await resolveClassId(activeClassId);
      if (numericClassId === null) {
        console.warn('Could not resolve class ID for:', activeClassId);
        tableContainer.innerHTML = '<div class="no-results">No results found for this class</div>';
        return;
      }
      // Get all tracks for this class, then filter by selected track
      const allTracksForClass = await aggregatePerTrackForClass(numericClassId, activeClassId);
      const filtered = allTracksForClass.filter(row => Number(row.track_id) === Number(activeTrackId));
      renderTable(filtered);
    }
    // Only class selected - aggregate from driver_index for all tracks with this class
    else if (activeClassId) {
      const numericClassId = await resolveClassId(activeClassId);
      if (numericClassId === null) {
        console.warn('Could not resolve class ID for:', activeClassId);
        tableContainer.innerHTML = '<div class="no-results">No results found for this class</div>';
        return;
      }
      const data = await aggregatePerTrackForClass(numericClassId, activeClassId);
      renderTable(data);
    }
    // Only track selected - aggregate from driver_index for all classes at this track
    else if (activeTrackId) {
      const data = await aggregatePerClassForTrack(activeTrackId);
      renderTable(data);
    }
    // No filters - show top combinations
    else {
      const data = await fetchTopCombinations();
      renderTable(data);
    }
  }

  // Initial load
  fetchAndRender();

})();