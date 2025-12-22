(function(){
  // Helper function for formatting values
  const formatValue = R3EUtils.formatValue;
  
  // Track list provided by user: label and id
  const TRACKS = [
    { id: 12500, label: 'AVUS - 1994' },
    { id: 12420, label: 'AVUS - 1998' },
    { id: 12938, label: 'Alemannenring - Full Circuit' },
    { id: 5301, label: 'Anderstorp Raceway - Grand Prix' },
    { id: 6164, label: 'Anderstorp Raceway - South' },
    { id: 7112, label: 'Autodrom Most - Grand Prix' },
    { id: 1846, label: 'Bathurst Circuit - Mount Panorama' },
    { id: 7819, label: 'Bilster Berg - Gesamtstrecke' },
    { id: 8069, label: 'Bilster Berg - Gesamtstrecke Schikane' },
    { id: 8070, label: 'Bilster Berg - Ostschleife' },
    { id: 8071, label: 'Bilster Berg - Ostschleife Schikane' },
    { id: 8095, label: 'Bilster Berg - Westschleife' },
    { id: 9473, label: 'Brands Hatch Grand Prix - Grand Prix' },
    { id: 2520, label: 'Brands Hatch Indy - Indy' },
    { id: 5298, label: 'Brno - Grand Prix' },
    { id: 9796, label: 'Brno - Grand Prix (Short Pit Entry)' },
    { id: 4944, label: 'Chang International Circuit - D Circuit' },
    { id: 4253, label: 'Chang International Circuit - Full Circuit' },
    { id: 10782, label: 'Circuit Zandvoort - Grand Prix' },
    { id: 11090, label: 'Circuit Zandvoort - Short' },
    { id: 1679, label: 'Circuit Zandvoort 2019 - Club' },
    { id: 1678, label: 'Circuit Zandvoort 2019 - Grand Prix' },
    { id: 1680, label: 'Circuit Zandvoort 2019 - National' },
    { id: 1684, label: 'Circuit Zolder - Grand Prix' },
    { id: 11908, label: 'Circuit de Charade - Classic Racing School' },
    { id: 10904, label: 'Circuit de Charade - Grand Prix' },
    { id: 11905, label: 'Circuit de Pau-Ville - Grand Prix' },
    { id: 9055, label: 'DEKRA Lausitzring - DTM Grand Prix Course' },
    { id: 2468, label: 'DEKRA Lausitzring - DTM Short Course' },
    { id: 10328, label: 'DEKRA Lausitzring - GP Course Oval T1' },
    { id: 6166, label: 'DEKRA Lausitzring - Grand Prix Course' },
    { id: 3291, label: 'DEKRA Lausitzring - Short Course' },
    { id: 8367, label: 'Daytona International Speedway - Road Course' },
    { id: 8655, label: 'Daytona International Speedway - Road Course Motorcycle (2006)' },
    { id: 8648, label: 'Daytona International Speedway - Speedway (Not Supported)' },
    { id: 10394, label: 'Donington Park - Grand Prix' },
    { id: 10725, label: 'Donington Park - National' },
    { id: 7976, label: 'Dubai Autodrome - Club Circuit' },
    { id: 6587, label: 'Dubai Autodrome - Grand Prix Circuit' },
    { id: 7978, label: 'Dubai Autodrome - International Circuit' },
    { id: 7977, label: 'Dubai Autodrome - National Circuit' },
    { id: 2024, label: 'Estoril Circuit - Grand Prix' },
    { id: 12318, label: 'Estoril Circuit - Tanque' },
    { id: 6140, label: 'Falkenberg Motorbana - Grand Prix' },
    { id: 12395, label: 'Fliegerhorst Diepholz - Full Circuit' },
    { id: 5925, label: 'Gelleråsen Arena - Grand Prix Circuit' },
    { id: 6138, label: 'Gelleråsen Arena - Short Circuit' },
    { id: 9360, label: 'Genting Highlands Highway - Circuit' },
    { id: 11859, label: 'Genting Highlands Highway - Dual Stage' },
    { id: 11861, label: 'Genting Highlands Highway - Short Stage' },
    { id: 9321, label: 'Genting Highlands Highway - Stage' },
    { id: 1693, label: 'Hockenheimring - Grand Prix' },
    { id: 1763, label: 'Hockenheimring - National' },
    { id: 1764, label: 'Hockenheimring - Short' },
    { id: 12112, label: 'Hockenheimring Classic - Grand Prix' },
    { id: 12236, label: 'Hockenheimring Classic - Short' },
    { id: 10274, label: 'Hockenheimring DMEC - DMEC' },
    { id: 1866, label: 'Hungaroring - Grand Prix' },
    { id: 1850, label: 'Imola - Grand Prix' },
    { id: 1852, label: 'Indianapolis 2012 - Grand Prix' },
    { id: 9957, label: 'Indianapolis Motor Speedway - Historic' },
    { id: 9958, label: 'Indianapolis Motor Speedway - Oval' },
    { id: 9943, label: 'Indianapolis Motor Speedway - Road Course' },
    { id: 10463, label: 'Interlagos - Grand Prix' },
    { id: 6137, label: 'Knutstorp Ring - GP' },
    { id: 1682, label: 'Lakeview Hillclimb - Full Run' },
    { id: 2181, label: 'Lakeview Hillclimb - Reverse' },
    { id: 2123, label: 'Macau - Grand Prix' },
    { id: 6010, label: 'Mantorp Park - Long Circuit' },
    { id: 6167, label: 'Mantorp Park - Short Circuit' },
    { id: 1676, label: 'Mid Ohio - Chicane' },
    { id: 1674, label: 'Mid Ohio - Full' },
    { id: 1675, label: 'Mid Ohio - Short' },
    { id: 1671, label: 'Monza Circuit - Grand Prix' },
    { id: 1672, label: 'Monza Circuit - Junior' },
    { id: 3683, label: 'Moscow Raceway - FIM' },
    { id: 3383, label: 'Moscow Raceway - Full' },
    { id: 2473, label: 'Moscow Raceway - Sprint' },
    { id: 9043, label: 'Motorland Aragón - Fast Circuit' },
    { id: 8704, label: 'Motorland Aragón - Grand Prix' },
    { id: 9040, label: 'Motorland Aragón - Motorcycle Grand Prix' },
    { id: 9042, label: 'Motorland Aragón - Motorcycle National' },
    { id: 9041, label: 'Motorland Aragón - National' },
    { id: 9483, label: 'Motorland Aragón - WTCR' },
    { id: 12571, label: 'Motorsport Arena Oschersleben 2024 - Alternate' },
    { id: 12506, label: 'Motorsport Arena Oschersleben 2024 - Grand Prix' },
    { id: 12572, label: 'Motorsport Arena Oschersleben 2024 - Short' },
    { id: 7273, label: 'Ningbo International Speedpark - Full circuit' },
    { id: 8309, label: 'Ningbo International Speedpark - Full circuit no chicane' },
    { id: 8310, label: 'Ningbo International Speedpark - Intermediate circuit' },
    { id: 8311, label: 'Ningbo International Speedpark - Intermediate circuit no chicane' },
    { id: 8314, label: 'Ningbo International Speedpark - Short circuit' },
    { id: 10392, label: 'Nogaro Circuit Paul Armagnac - Caupenne Circuit' },
    { id: 10258, label: 'Nogaro Circuit Paul Armagnac - Club Circuit' },
    { id: 9659, label: 'Nogaro Circuit Paul Armagnac - Grand Prix Circuit' },
    { id: 12573, label: 'Nogaro Circuit Paul Armagnac - Moto Circuit' },
    { id: 5095, label: 'Nordschleife - 24 Hours' },
    { id: 4975, label: 'Nordschleife - NLS' },
    { id: 2813, label: 'Nordschleife - Nordschleife' },
    { id: 5093, label: 'Nordschleife - Tourist' },
    { id: 2518, label: 'Norisring - Grand Prix' },
    { id: 1691, label: 'Nürburgring - Grand Prix' },
    { id: 2010, label: 'Nürburgring - Grand Prix Fast Chicane' },
    { id: 9847, label: 'Nürburgring - Müllenbachschleife' },
    { id: 3377, label: 'Nürburgring - Sprint' },
    { id: 2011, label: 'Nürburgring - Sprint Fast Chicane' },
    { id: 11909, label: 'Paul Ricard - Solution 1A' },
    { id: 4246, label: 'Paul Ricard - Solution 1A-V2' },
    { id: 4247, label: 'Paul Ricard - Solution 1C-V2' },
    { id: 4248, label: 'Paul Ricard - Solution 2A short' },
    { id: 2867, label: 'Paul Ricard - Solution 3C' },
    { id: 1784, label: 'Portimao Circuit - Chicane' },
    { id: 1778, label: 'Portimao Circuit - Grand Prix' },
    { id: 1783, label: 'Portimao Circuit - Moto' },
    { id: 1785, label: 'Portimao Circuit - Short' },
    { id: 1709, label: 'RaceRoom Hillclimb - Full Run' },
    { id: 2214, label: 'RaceRoom Hillclimb - Reverse' },
    { id: 266, label: 'RaceRoom Raceway - Bridge' },
    { id: 264, label: 'RaceRoom Raceway - Classic' },
    { id: 265, label: 'RaceRoom Raceway - Classic Sprint' },
    { id: 10414, label: 'RaceRoom Raceway - Drift Area' },
    { id: 263, label: 'RaceRoom Raceway - Grand Prix' },
    { id: 267, label: 'RaceRoom Raceway - National' },
    { id: 2556, label: 'Red Bull Ring Spielberg - Grand Prix Circuit' },
    { id: 11296, label: 'Red Bull Ring Spielberg - Moto' },
    { id: 5794, label: 'Red Bull Ring Spielberg - Südschleife National Circuit' },
    { id: 5276, label: 'Road America - Grand Prix' },
    { id: 3538, label: 'Sachsenring - Grand Prix' },
    { id: 2026, label: 'Salzburgring - Grand Prix' },
    { id: 6341, label: 'Sepang - Grand Prix' },
    { id: 6578, label: 'Sepang - North' },
    { id: 6579, label: 'Sepang - South' },
    { id: 2027, label: 'Shanghai Circuit - Grand Prix' },
    { id: 4041, label: 'Shanghai Circuit - Intermediate (WTCC)' },
    { id: 4042, label: 'Shanghai Circuit - West Long' },
    { id: 4039, label: 'Silverstone Circuit - Grand Prix' },
    { id: 5862, label: 'Silverstone Circuit - Historic Grand Prix' },
    { id: 5816, label: 'Silverstone Circuit - International' },
    { id: 5817, label: 'Silverstone Circuit - National' },
    { id: 12268, label: 'Silverstone Circuit Classic - Grand Prix' },
    { id: 12390, label: 'Silverstone Circuit Classic - International' },
    { id: 12389, label: 'Silverstone Circuit Classic - National' },
    { id: 2064, label: 'Slovakia Ring - Grand Prix' },
    { id: 3913, label: 'Sonoma Raceway - IRL' },
    { id: 3912, label: 'Sonoma Raceway - Long' },
    { id: 2016, label: 'Sonoma Raceway - Sprint' },
    { id: 1854, label: 'Sonoma Raceway - WTCC' },
    { id: 6055, label: 'Stowe Circuit - Long' },
    { id: 6056, label: 'Stowe Circuit - Short' },
    { id: 2012, label: 'Suzuka Circuit - East Course' },
    { id: 1841, label: 'Suzuka Circuit - Grand Prix' },
    { id: 2013, label: 'Suzuka Circuit - West Course' },
    { id: 9985, label: 'TT Circuit Assen - Grand Prix' },
    { id: 10355, label: 'TT Circuit Assen - Motorcycle Course' },
    { id: 10351, label: 'TT Circuit Assen - North Course' },
    { id: 9839, label: 'Twin Forest - Duel' },
    { id: 7027, label: 'Twin Ring Motegi - East Course' },
    { id: 6658, label: 'Twin Ring Motegi - Road Course' },
    { id: 7026, label: 'Twin Ring Motegi - West Course' },
    { id: 9465, label: 'Vålerbanen - Full Circuit' },
    { id: 9344, label: 'Watkins Glen International - Grand Prix' },
    { id: 9324, label: 'Watkins Glen International - Grand Prix with Inner Loop' },
    { id: 9343, label: 'Watkins Glen International - Short Circuit' },
    { id: 9177, label: 'Watkins Glen International - Short with Inner loop' },
    { id: 1856, label: 'WeatherTech Raceway Laguna Seca - Grand Prix' },
    { id: 8327, label: 'Zhejiang Circuit - East circuit' },
    { id: 8075, label: 'Zhejiang Circuit - Grand Prix' },
    { id: 3464, label: 'Zhuhai Circuit - Grand Prix' }
  ];

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