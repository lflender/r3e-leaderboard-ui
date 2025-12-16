// Tab switching functionality
const tabButtons = Array.from(document.querySelectorAll('.tab-button')).filter(b => b.dataset && b.dataset.tab);
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        // Remove active class from all buttons and panels
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));
        
        // Add active class to clicked button and corresponding panel
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Driver search functionality
const driverSearch = document.getElementById('driver-search');
const classFilter = document.getElementById('class-filter');
const classFilterUI = document.getElementById('class-filter-ui');
const resultsContainer = document.getElementById('results-container');

// If CARS_DATA is available (from data/cars.js), populate the hidden class select
function populateClassFilterFromCarsData() {
    if (!classFilter) return;
    if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) return;
    // Build options from CARS_DATA.classes (each entry has `class` property)
    const seen = new Set();
    // Keep the initial placeholder
    const opts = [{ value: '', label: 'All classes' }];
    window.CARS_DATA.forEach(entry => {
        const cls = entry.class || entry.car_class || entry.CarClass || '';
        if (!cls) return;
        if (seen.has(cls)) return;
        seen.add(cls);
        // No reliable id in cars data; store label in value
        opts.push({ value: cls, label: cls });
    });
    // Sort options by label (skip first placeholder)
    const sorted = opts.slice(1).sort((a,b)=>String(a.label).localeCompare(String(b.label)));
    // Rebuild select
    classFilter.innerHTML = '<option value="">All classes</option>' + sorted.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
}

// Try to populate now (if data already loaded), otherwise wait for DOM load where data script runs before script.js
populateClassFilterFromCarsData();

// Pagination state
let currentPage = 1;
let itemsPerPage = 100;
let allResults = [];

// Status cache constants
const STATUS_CACHE_KEY = 'r3e_status_cache';
const STATUS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Fetch and display status on page load
fetchAndDisplayStatus();

driverSearch.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const searchTerm = driverSearch.value.trim();
        
        if (!searchTerm) {
            return;
        }
        
        await searchDriver(searchTerm);
    }
});

// If the class filter is changed and there's an existing search term, re-run the search
if (classFilter) {
    classFilter.addEventListener('change', async () => {
        const searchTerm = driverSearch.value.trim();
        if (!searchTerm) return;
        await searchDriver(searchTerm);
    });
}

// If the URL includes a driver query param (e.g. index.html?driver=Name), pre-fill and run the search
(function handleUrlDriverParam(){
    try {
        const params = new URLSearchParams(window.location.search);
        const driver = params.get('driver') || params.get('query');
        if (driver && driverSearch) {
            driverSearch.value = driver;
            // Wait a tick for any select population, then run search
            setTimeout(()=>{ searchDriver(driver); }, 50);
        }
    } catch (e) {
        // ignore
    }
})();

// Setup custom select UI if present
if (classFilter && classFilterUI) {
    const toggle = classFilterUI.querySelector('.custom-select__toggle');
    const menu = classFilterUI.querySelector('.custom-select__menu');

    // Populate menu from hidden select
    function buildCustomOptions() {
        menu.innerHTML = '';
        Array.from(classFilter.options).forEach(opt => {
            const div = document.createElement('div');
            div.className = 'custom-select__option';
            div.textContent = opt.textContent;
            div.dataset.value = opt.value;
            if (opt.selected) div.setAttribute('aria-selected', 'true');
            menu.appendChild(div);
        });
    }

    buildCustomOptions();

    function closeMenu() {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.hidden) openMenu(); else closeMenu();
    });

    // Option click
    menu.addEventListener('click', async (e) => {
        const opt = e.target.closest('.custom-select__option');
        if (!opt) return;
        const val = opt.dataset.value;
        // Update hidden select
        classFilter.value = val;
        // Update toggle label
        toggle.textContent = `${opt.textContent} ▾`;
        // Rebuild to mark selected
        buildCustomOptions();
        closeMenu();

        const searchTerm = driverSearch.value.trim();
        if (searchTerm) await searchDriver(searchTerm);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!classFilterUI.contains(e.target)) closeMenu();
    });
}

async function searchDriver(driverName) {
    // Show loading state
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        let url = `http://localhost:8080/api/search?driver=${encodeURIComponent(driverName)}`;
        try {
            const selectedClass = classFilter ? classFilter.value : '';
            if (selectedClass) {
                url += `&class=${encodeURIComponent(selectedClass)}`;
            }
        } catch (e) {
            // ignore
        }
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        allResults = data;
        currentPage = 1;
        displayResults(data);
    } catch (error) {
        console.error('Search error:', error);
        displayError(error.message);
    }
}

function displayResults(data) {
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    
    // Handle different response formats
    let results = data;
    
    // If data is an object with a results/data/items property, extract it
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log('Data keys:', Object.keys(data));
        
        if (data.results) results = data.results;
        else if (data.data) results = data.data;
        else if (data.items) results = data.items;
        else if (data.leaderboard) results = data.leaderboard;
        else if (data.entries) results = data.entries;
        else {
            // If it's a single object with properties, wrap it in an array
            results = [data];
        }
    }
    
    console.log('Results after processing:', results);
    console.log('Results is array:', Array.isArray(results));
    
    // Ensure results is an array
    if (!Array.isArray(results)) {
        displayError('Invalid response format. Expected an array of results.');
        console.error('Results is not an array:', results);
        return;
    }
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
        // Normalize to an array of driver groups: { driver, entries: [...] }
        let driverGroups = [];
        if (results.length > 0 && results[0] && typeof results[0] === 'object' && Array.isArray(results[0].entries) && ('driver' in results[0] || 'name' in results[0])) {
            // Already grouped by backend
            driverGroups = results;
        } else {
            // Old flat format: group results by driver name while preserving order of appearance
            const map = new Map();
            results.forEach(item => {
                const driverName = item.driver || item.name || item.Name || item.DriverName || item.driver_name || 'Unknown';
                if (!map.has(driverName)) map.set(driverName, { driver: driverName, entries: [] });
                map.get(driverName).entries.push(item);
            });
            driverGroups = Array.from(map.values());
        }

        const totalDrivers = driverGroups.length;
        const totalPages = Math.ceil(totalDrivers / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalDrivers);
        const paginatedDrivers = driverGroups.slice(startIndex, endIndex);
    
    // Calculate totals and keys using normalized driverGroups/paginatedDrivers
    let totalEntriesShown = 0;
    paginatedDrivers.forEach(g => { totalEntriesShown += Array.isArray(g.entries) ? g.entries.length : 0; });

    console.log(`Showing drivers ${startIndex + 1}-${endIndex} of ${totalDrivers} (${totalEntriesShown} entries)`);

    // Get all keys from the first entry to create table headers
    let keys = [];
    if (paginatedDrivers.length > 0 && Array.isArray(paginatedDrivers[0].entries) && paginatedDrivers[0].entries.length > 0) {
        keys = Object.keys(paginatedDrivers[0].entries[0]);
    }
    console.log('Original keys:', keys);
    
    // Filter out unwanted columns - now including Name, Country, Rank, Team (they'll be in group headers)
    const excludeColumns = ['ClassID', 'ClassName', 'TrackID', 'TotalEntries', 'Class ID', 'Class Name', 'Track ID', 'Total Entries', 
                           'class_id', 'class_name', 'track_id', 'total_entries',
                           'Name', 'name', 'DriverName', 'driver_name',
                           'Country', 'country',
                           'Rank', 'rank',
                           'Team', 'team',
                           // Backend time-difference fields (do not display as separate column)
                           'time_diff', 'timeDiff', 'timeDifference', 'time_diff_s', 'time_diff_seconds'];
    keys = keys.filter(key => !excludeColumns.includes(key));
    console.log('Filtered keys:', keys);
    
    // Custom column order: Car Class, Car, Track, Lap time, Position
    const columnOrder = ['CarClass', 'Car Class', 'car_class', 'Class', 
                        'Car', 'car', 'CarName', 
                        'Track', 'track', 'TrackName', 'track_name',
                        'LapTime', 'Lap Time', 'lap_time', 'Time',
                        'Position', 'position', 'Pos'];
    
    keys.sort((a, b) => {
        let indexA = columnOrder.indexOf(a);
        let indexB = columnOrder.indexOf(b);
        
        // If not in the order list, put at the end
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        
        return indexA - indexB;
    });
    
    console.log('Sorted keys:', keys);
    
    let tableHTML = '<table class="results-table"><thead><tr>';
    
    // Create headers
    keys.forEach(key => {
        tableHTML += `<th>${formatHeader(key)}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    // Create grouped rows with driver headers - use PAGINATED drivers from backend (or normalized groups)
    paginatedDrivers.forEach(driverObj => {
        const driverResults = Array.isArray(driverObj.entries) ? driverObj.entries : [];
        const firstEntry = driverResults[0] || {};

        // Display name: prefer cased name from first entry (preserve original casing)
        const displayName = firstEntry.name || firstEntry.Name || driverObj.driver || driverObj.name || driverObj.DriverName || driverObj.driver_name || 'Unknown';

        // Get driver info from first entry
        const country = firstEntry.country || firstEntry.Country || '-';
        const rank = firstEntry.rank || firstEntry.Rank || '';
        const team = firstEntry.team || firstEntry.Team || '';
        // Create driver header row (use a slugified lowercase id for class names)
        const slugSource = (driverObj.driver || driverObj.name || firstEntry.name || firstEntry.Name || 'unknown');
        const groupId = `group-${String(slugSource).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase()}`;
        const flagHtml = countryToFlag(country) ? '<span class="country-flag">' + countryToFlag(country) + '</span> ' : '';
        tableHTML += `
            <tr class="driver-group-header" data-group="${groupId}" onclick="toggleGroup(this)">
                <td colspan="${keys.length}">
                    <span class="toggle-icon">▼</span>
                    <strong>${escapeHtml(displayName)}</strong>
                    <span class="driver-meta">${flagHtml}${escapeHtml(country)}${rank ? renderRankStars(rank) : ''}${team ? ' | 🏁 Team ' + team : ''}</span>
                </td>
            </tr>`;

        // Create data rows for this driver
        driverResults.forEach(item => {
            const trackId = item.track_id || item.TrackID || item['Track ID'] || '';
            const classId = item.class_id || item.ClassID || item['Class ID'] || '';
            const rawPos = item.position || item.Position || item.Pos || '';
            const numericPos = parseInt(String(rawPos).replace(/[^0-9]/g, '')) || '';
            tableHTML += `<tr class="driver-data-row ${groupId}" onclick="openDetailView(event, this)" data-position="${numericPos}" data-trackid="${escapeHtml(trackId)}" data-classid="${escapeHtml(classId)}" data-track="${escapeHtml(item.track || item.Track || '')}" data-class="${escapeHtml(firstEntry.car_class || firstEntry.CarClass || firstEntry['Car Class'] || firstEntry.Class || '')}">`;

            keys.forEach(key => {
                let value = item[key];
                const isPositionKey = key === 'Position' || key === 'position' || key === 'Pos';
                const isCarClassKey = key === 'CarClass' || key === 'Car Class' || key === 'car_class' || key === 'Class' || key === 'class';
                const isLapTimeKey = key === 'LapTime' || key === 'Lap Time' || key === 'lap_time' || key === 'Time';

                if (isPositionKey) {
                    const totalEntries = item.total_entries || item.TotalEntries || item['Total Entries'] || item.TotalRacers || item.total_racers;
                    const posNum = String(value || '').trim();
                    const totalNum = totalEntries ? String(totalEntries).trim() : '';
                    let badgeColor = '';
                    let pos = parseInt(posNum);
                    let total = parseInt(totalNum);
                    if (!isNaN(pos) && !isNaN(total) && total > 1) {
                        if (pos === 1) badgeColor = '#22c55e';
                        else if (pos === total) badgeColor = '#ef4444';
                        else {
                            let t = (pos - 1) / (total - 1);
                            let r = Math.round(34 + (239-34)*t);
                            let g = Math.round(197 + (68-197)*t);
                            let b = Math.round(94 + (68-94)*t);
                            badgeColor = `rgb(${r},${g},${b})`;
                        }
                    } else {
                        badgeColor = 'rgba(59,130,246,0.18)';
                    }
                    if (totalNum) {
                        tableHTML += `<td class="pos-cell"><span class="pos-number" style="background:${badgeColor}">${escapeHtml(posNum)}</span><span class="pos-sep">/</span><span class="pos-total">${escapeHtml(totalNum)}</span></td>`;
                    } else {
                        tableHTML += `<td class="pos-cell"><span class="pos-number" style="background:${badgeColor}">${escapeHtml(posNum)}</span></td>`;
                    }
                } else if (isCarClassKey) {
                    tableHTML += `<td class="no-wrap">${formatValue(value)}</td>`;
                } else if (isLapTimeKey) {
                    const s = String(value || '');
                    const parts = s.split(/,\s*/);
                    const main = parts[0] || '';
                    const delta = parts.slice(1).join(', ');
                    const escMain = escapeHtml(String(main)).replace(/\s+/g, '&nbsp;');
                    const escDelta = escapeHtml(String(delta));
                    if (delta) tableHTML += `<td class="lap-time-cell"><div class="lap-main">${escMain}</div><div class="time-delta">${escDelta}</div></td>`;
                    else tableHTML += `<td class="lap-time-cell">${escMain}</td>`;
                } else if (key === 'Track' || key === 'track' || key === 'TrackName' || key === 'track_name') {
                    let trackStr = String(value || '');
                    trackStr = trackStr.replace(/(\s+)([-–—])(\s+)/g, '$1<wbr>$2$3');
                    trackStr = escapeHtml(trackStr).replace(/&lt;wbr&gt;/g, '<wbr>');
                    tableHTML += `<td>${trackStr}</td>`;
                } else {
                    tableHTML += `<td>${formatValue(value)}</td>`;
                }
            });
            tableHTML += '</tr>';
        });
    });
    
    tableHTML += '</tbody></table>';
    
    // Add pagination controls only if there's more than 1 page
    let paginationHTML = '';
    
    if (totalPages > 1) {
        paginationHTML = '<div class="pagination">';
        paginationHTML += `<div class="pagination-info">Showing drivers ${startIndex + 1}-${endIndex} of ${totalDrivers} (${totalEntriesShown} total entries)</div>`;
        paginationHTML += '<div class="pagination-buttons">';
        
        // Previous button
        if (currentPage > 1) {
            paginationHTML += `<button onclick="goToPage(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
        }
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            paginationHTML += `<button onclick="goToPage(1)" class="page-btn">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="page-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            paginationHTML += `<button onclick="goToPage(${i})" class="page-btn ${activeClass}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span class="page-ellipsis">...</span>';
            }
            paginationHTML += `<button onclick="goToPage(${totalPages})" class="page-btn">${totalPages}</button>`;
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `<button onclick="goToPage(${currentPage + 1})" class="page-btn">Next ›</button>`;
        }
        
        paginationHTML += '</div></div>';
    }
    
    resultsContainer.innerHTML = tableHTML + paginationHTML;
}

function displayError(message) {
    resultsContainer.innerHTML = `
        <div class="error">
            <strong>Error:</strong> ${message}
            <br><br>
            <small>Make sure the backend server is running on http://localhost:8080</small>
        </div>
    `;
}

function formatHeader(key) {
    // Convert camelCase or snake_case to Title Case
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    return value;
}

// Convert a 2-letter country code to a regional indicator flag emoji.
function codeToFlag(code) {
    if (!code || code.length !== 2) return '';
    const A = 'A'.charCodeAt(0);
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + (c.charCodeAt(0) - A)));
}

// A list of ISO 3166-1 alpha-2 country codes to try matching by name when only a country name is provided.
const ISO_COUNTRY_CODES = [
    'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY','HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM','JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU','VE','VN','VG','VI','WF','EH','YE','ZM','ZW'
];

// Try to resolve a country name to an ISO code using Intl.DisplayNames where available.
function findCountryCodeByName(name) {
    if (!name) return null;
    const nm = String(name).trim().toLowerCase();
    try {
        const disp = new Intl.DisplayNames(['en'], { type: 'region' });
        for (const code of ISO_COUNTRY_CODES) {
            const display = disp.of(code);
            if (!display) continue;
            const d = String(display).toLowerCase();
            if (d === nm || d.includes(nm) || nm.includes(d)) return code;
        }
    } catch (e) {
        // Intl or DisplayNames not available, fall back later
    }
    return null;
}

// Given a country value (name or code), try to return a flag emoji or empty string.
function countryToFlag(country) {
    if (!country) return '';
    const s = String(country).trim();
    // If it already contains regional indicator symbols or emoji, return it
    try {
        if (/\p{Regional_Indicator}/u.test(s) || /[\u{1F1E6}-\u{1F1FF}]/u.test(s)) return s + ' ';
    } catch (e) {}

    // If it's a 2-letter code (e.g., GB, US), convert
    if (/^[A-Za-z]{2}$/.test(s)) {
        return codeToFlag(s) + ' ';
    }

    // If value contains a country code in parentheses like "United Kingdom (GB)", extract
    const paren = s.match(/\(([A-Za-z]{2})\)$/);
    if (paren) return codeToFlag(paren[1]) + ' ';

    // Try to map the full country name to an ISO code
    const mapped = findCountryCodeByName(s);
    if (mapped) return codeToFlag(mapped) + ' ';

    // Nothing matched — return empty to avoid showing world icon
    return '';
}

function toggleGroup(target) {
    // Accept either the header element (passed via onclick="toggleGroup(this)")
    // or a string group id.
    let headerElem = null;
    let group = null;
    if (target && typeof target === 'object' && target.dataset) {
        headerElem = target;
        group = target.dataset.group;
    } else if (typeof target === 'string') {
        group = target;
    } else {
        return;
    }

    if (!group) return;
    const rows = document.querySelectorAll(`.${group}`);
    const icon = headerElem ? headerElem.querySelector('.toggle-icon') : null;

    rows.forEach(row => {
        if (row.style.display === 'none') {
            row.style.display = '';
            if (icon) icon.textContent = '▼';
        } else {
            row.style.display = 'none';
            if (icon) icon.textContent = '▶';
        }
    });
}

function goToPage(page) {
    currentPage = page;
    displayResults(allResults);
    // Scroll to top of results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDetailView(event, row) {
    // Don't trigger if clicking on the toggle icon or header
    if (event.target.closest('.driver-group-header')) {
        return;
    }
    // Prefer IDs for detail view
    const trackId = row.dataset.trackid;
    const classId = row.dataset.classid;
    // Fallback to names if IDs are missing
    const track = row.dataset.track;
    const carClass = row.dataset.class;
    const pos = row.dataset.position;
    if (trackId && classId) {
        let url = `detail.html?track=${encodeURIComponent(trackId)}&class=${encodeURIComponent(classId)}`;
        if (pos) url += `&pos=${encodeURIComponent(pos)}`;
        window.open(url, '_blank');
    } else if (track && carClass) {
        let url = `detail.html?track=${encodeURIComponent(track)}&class=${encodeURIComponent(carClass)}`;
        if (pos) url += `&pos=${encodeURIComponent(pos)}`;
        window.open(url, '_blank');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render rank as stars: D -> 1, C -> 2, B -> 3, A -> 4
function renderRankStars(rank) {
    if (!rank) return '';
    const r = String(rank).trim().toUpperCase();
    const map = { 'D': 1, 'C': 2, 'B': 3, 'A': 4 };
    const count = map[r] || 0;
    if (count === 0) return ` | ⭐ Rank ${escapeHtml(rank)}`;
    return ' | ' + '⭐'.repeat(count) + ` Rank ${escapeHtml(r)}`;
}

async function fetchAndDisplayStatus() {
    try {
        // Check if we have cached data
        const cached = localStorage.getItem(STATUS_CACHE_KEY);
        let statusData = null;
        let needsFetch = true;
        
        if (cached) {
            const cachedData = JSON.parse(cached);
            const cacheAge = Date.now() - cachedData.timestamp;
            
            if (cacheAge < STATUS_CACHE_DURATION) {
                // Cache is still valid
                statusData = cachedData.data;
                needsFetch = false;
                console.log('Using cached status data');
            } else {
                console.log('Cache expired, fetching new data');
            }
        }
        
        // Fetch new data if needed
        if (needsFetch) {
            const response = await fetch('http://localhost:8080/api/status');
            if (response.ok) {
                statusData = await response.json();
                
                // Cache the data
                const cacheData = {
                    timestamp: Date.now(),
                    data: statusData
                };
                localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(cacheData));
                console.log('Fetched and cached new status data');
            } else {
                console.error('Failed to fetch status:', response.status);
            }
        }
        
        // Display the status data
        if (statusData) {
            displayStatus(statusData);
        }
    } catch (error) {
        console.error('Error fetching status:', error);
    }
}

function displayStatus(data) {
    // Determine last fetch time:
    // Prefer the API-provided `last_fetch_end` (or similar) field (may be nested),
    // fall back to the cached timestamp stored locally.
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    let lastFetchTime = new Date();
    
    // Helper to find a field by regex (returns the value)
    function findField(obj, re) {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const key of Object.keys(obj)) {
            try {
                if (re.test(key)) return obj[key];
            } catch (e) {}
            const val = obj[key];
            if (val && typeof val === 'object') {
                const found = findField(val, re);
                if (found !== undefined) return found;
            }
        }
        return undefined;
    }

    // Try to get `last_fetch_end` (or variants) from the API response
    let lastFetchValue = undefined;
    try {
        lastFetchValue = findField(data, /last[_ ]?fetch[_ ]?end|lastFetchEnd|last_fetch_end/i);
    } catch (e) {
        lastFetchValue = undefined;
    }

    if (lastFetchValue !== undefined && lastFetchValue !== null) {
        // If numeric (epoch seconds or ms) handle appropriately
        if (typeof lastFetchValue === 'number') {
            // Heuristic: if value looks like seconds (10 digits) convert to ms
            lastFetchTime = (String(lastFetchValue).length <= 10) ? new Date(lastFetchValue * 1000) : new Date(lastFetchValue);
        } else if (typeof lastFetchValue === 'string') {
            const parsed = Date.parse(lastFetchValue);
            if (!Number.isNaN(parsed)) lastFetchTime = new Date(parsed);
        }
    } else if (cached) {
        const cachedData = JSON.parse(cached);
        lastFetchTime = new Date(cachedData.timestamp);
    }
    
    console.log('Status data:', data);
    
    // The API returns nested data under the 'data' property
    const statusData = data.data || data;

    // Helper: recursively search for a numeric field matching a key pattern
    function findNumericField(obj, re) {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const key of Object.keys(obj)) {
            try {
                if (re.test(key) && typeof obj[key] === 'number') return obj[key];
            } catch (e) {}
            const val = obj[key];
            if (val && typeof val === 'object') {
                const found = findNumericField(val, re);
                if (found !== undefined) return found;
            }
        }
        return undefined;
    }

    // Try common property names first, then fall back to recursive search
    let driversCount = undefined;
    if (statusData && typeof statusData === 'object') {
        if (typeof statusData.total_indexed_drivers === 'number') driversCount = statusData.total_indexed_drivers;
        else if (typeof statusData.total_drivers === 'number') driversCount = statusData.total_drivers;
        else if (typeof statusData.totalIndexedDrivers === 'number') driversCount = statusData.totalIndexedDrivers;
        else driversCount = findNumericField(statusData, /total[_ ]?indexed[_ ]?drivers|total[_ ]?drivers|indexed[_ ]?drivers|totalDrivers|totalIndexedDrivers/i);
    }

    // Update the display (show '-' if value missing)
    document.getElementById('status-timestamp').textContent = lastFetchTime.toLocaleString();
    document.getElementById('status-tracks').textContent = (statusData.unique_tracks || statusData.uniqueTracks || '-').toLocaleString ? (statusData.unique_tracks || statusData.uniqueTracks || 0).toLocaleString() : '-';
    document.getElementById('status-combinations').textContent = (statusData.track_class_combination || 0).toLocaleString();
    document.getElementById('status-entries').textContent = (statusData.total_entries || statusData.totalEntries || 0).toLocaleString();
    document.getElementById('status-drivers').textContent = (driversCount !== undefined ? driversCount.toLocaleString() : '-');

    console.log('Resolved driversCount:', driversCount, 'statusData keys:', Object.keys(statusData || {}));
}
