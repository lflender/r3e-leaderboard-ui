// Tab switching functionality
const tabButtons = document.querySelectorAll('.tab-button');
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
const resultsContainer = document.getElementById('results-container');

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

async function searchDriver(driverName) {
    // Show loading state
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const url = `http://localhost:8080/api/search?driver=${encodeURIComponent(driverName)}`;
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
    
    // Group ALL results by driver name FIRST
    const groupedByDriver = {};
    results.forEach(item => {
        const driverName = item.Name || item.name || item.DriverName || item.driver_name || 'Unknown';
        if (!groupedByDriver[driverName]) {
            groupedByDriver[driverName] = [];
        }
        groupedByDriver[driverName].push(item);
    });
    
    // Sort each group by time difference (the +XX.XXXs part)
    Object.keys(groupedByDriver).forEach(driverName => {
        groupedByDriver[driverName].sort((a, b) => {
            const timeA = a.LapTime || a['Lap Time'] || a.lap_time || a.Time || '';
            const timeB = b.LapTime || b['Lap Time'] || b.lap_time || b.Time || '';
            
            // Extract time difference (e.g., "+01.887s" from "1m 23.414s, +01.887s")
            const diffA = timeA.match(/\+(\d+\.\d+)s/);
            const diffB = timeB.match(/\+(\d+\.\d+)s/);
            
            if (diffA && diffB) {
                return parseFloat(diffA[1]) - parseFloat(diffB[1]);
            }
            
            // Fallback to string comparison if no difference found
            return timeA.localeCompare(timeB);
        });
    });
    
    // Get sorted driver names (alphabetically)
    const allDriverNames = Object.keys(groupedByDriver).sort((a, b) => a.localeCompare(b));
    
    // Calculate pagination on DRIVER GROUPS, not individual entries
    const totalDrivers = allDriverNames.length;
    const totalPages = Math.ceil(totalDrivers / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalDrivers);
    const paginatedDriverNames = allDriverNames.slice(startIndex, endIndex);
    
    // Calculate total entries being shown
    let totalEntriesShown = 0;
    paginatedDriverNames.forEach(name => {
        totalEntriesShown += groupedByDriver[name].length;
    });
    
    console.log(`Showing drivers ${startIndex + 1}-${endIndex} of ${totalDrivers} (${totalEntriesShown} entries)`);
    
    // Get all keys from the first object to create table headers
    const firstDriverResults = groupedByDriver[allDriverNames[0]];
    let keys = Object.keys(firstDriverResults[0]);
    console.log('Original keys:', keys);
    
    // Filter out unwanted columns - now including Name, Country, Rank, Team (they'll be in group headers)
    const excludeColumns = ['ClassID', 'ClassName', 'TrackID', 'TotalEntries', 'Class ID', 'Class Name', 'Track ID', 'Total Entries', 
                           'class_id', 'class_name', 'track_id', 'total_entries',
                           'Name', 'name', 'DriverName', 'driver_name',
                           'Country', 'country',
                           'Rank', 'rank',
                           'Team', 'team'];
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
    
    // Create grouped rows with driver headers - use PAGINATED driver names
    paginatedDriverNames.forEach(driverName => {
        const driverResults = groupedByDriver[driverName];
        const firstEntry = driverResults[0];
        
        // Get driver info from first entry
        const country = firstEntry.Country || firstEntry.country || '-';
        const rank = firstEntry.Rank || firstEntry.rank || '-';
        const team = firstEntry.Team || firstEntry.team || '-';
        
        // Create driver header row
        const groupId = `group-${driverName.replace(/\s+/g, '-')}`;
        // Prepare flag HTML (no tooltip) when available
        const flagHtml = countryToFlag(country) ? '<span class="country-flag">' + countryToFlag(country) + '</span> ' : '';
        tableHTML += `
            <tr class="driver-group-header" onclick="toggleGroup('${groupId}')">
                <td colspan="${keys.length}">
                    <span class="toggle-icon">▼</span>
                    <strong>${driverName}</strong>
                    <span class="driver-meta">${flagHtml}${escapeHtml(country)} | ⭐ Rank ${rank} | 🏁 Team ${team}</span>
                </td>
            </tr>`;
        
        // Create data rows for this driver
        driverResults.forEach(item => {
            // Use TrackID and ClassID for detail view if available
            const trackId = item.TrackID || item.track_id || item['Track ID'] || '';
            const classId = item.ClassID || item.class_id || item['Class ID'] || '';
            // Determine numeric position if present
            const rawPos = item.Position || item.position || item.Pos || '';
            const numericPos = parseInt(String(rawPos).replace(/[^0-9]/g, '')) || '';
            tableHTML += `<tr class="driver-data-row ${groupId}" onclick="openDetailView(event, this)" data-position="${numericPos}" data-trackid="${escapeHtml(trackId)}" data-classid="${escapeHtml(classId)}" data-track="${escapeHtml(item.Track || item.track || '')}" data-class="${escapeHtml(firstEntry.CarClass || firstEntry['Car Class'] || firstEntry.car_class || firstEntry.Class || '')}">`;
            keys.forEach(key => {
                let value = item[key];
                
                // Column type detection
                const isPositionKey = key === 'Position' || key === 'position' || key === 'Pos';
                const isCarClassKey = key === 'CarClass' || key === 'Car Class' || key === 'car_class' || key === 'Class' || key === 'class';
                const isLapTimeKey = key === 'LapTime' || key === 'Lap Time' || key === 'lap_time' || key === 'Time';

                if (isPositionKey) {
                    const totalEntries = item.TotalEntries || item['Total Entries'] || item.total_entries || item.TotalRacers || item.total_racers;
                    const posNum = String(value || '').trim();
                    const totalNum = totalEntries ? String(totalEntries).trim() : '';
                    // Compute color: green for 1, red for last, gradient in between
                    let badgeColor = '';
                    let pos = parseInt(posNum);
                    let total = parseInt(totalNum);
                    if (!isNaN(pos) && !isNaN(total) && total > 1) {
                        if (pos === 1) {
                            badgeColor = '#22c55e'; // bright green
                        } else if (pos === total) {
                            badgeColor = '#ef4444'; // bright red
                        } else {
                            // Interpolate between green and red
                            // 0 = green, 1 = red
                            let t = (pos - 1) / (total - 1);
                            // Green: 34,197,94  Red: 239,68,68
                            let r = Math.round(34 + (239-34)*t);
                            let g = Math.round(197 + (68-197)*t);
                            let b = Math.round(94 + (68-94)*t);
                            badgeColor = `rgb(${r},${g},${b})`;
                        }
                    } else {
                        badgeColor = 'rgba(59,130,246,0.18)'; // fallback
                    }
                    if (totalNum) {
                        tableHTML += `<td class="pos-cell"><span class="pos-number" style="background:${badgeColor}">${escapeHtml(posNum)}</span><span class="pos-sep">/</span><span class="pos-total">${escapeHtml(totalNum)}</span></td>`;
                    } else {
                        tableHTML += `<td class="pos-cell"><span class="pos-number" style="background:${badgeColor}">${escapeHtml(posNum)}</span></td>`;
                    }
                } else if (isCarClassKey) {
                    tableHTML += `<td class="no-wrap">${formatValue(value)}</td>`;
                } else if (isLapTimeKey) {
                    // ...existing code for lap time...
                    const s = String(value || '');
                    const parts = s.split(/,\s*/);
                    const main = parts[0] || '';
                    const delta = parts.slice(1).join(', ');
                    const escMain = escapeHtml(String(main)).replace(/\s+/g, '&nbsp;');
                    const escDelta = escapeHtml(String(delta));
                    if (delta) {
                        tableHTML += `<td class="lap-time-cell"><div class="lap-main">${escMain}</div><div class="time-delta">${escDelta}</div></td>`;
                    } else {
                        tableHTML += `<td class="lap-time-cell">${escMain}</td>`;
                    }
                } else if (key === 'Track' || key === 'track' || key === 'TrackName' || key === 'track_name') {
                    // Insert word-break opportunity before dash for nice two-line breaks, preserving spaces
                    let trackStr = String(value || '');
                    // Match spaces, dash (any type), spaces
                    trackStr = trackStr.replace(/(\s+)([-–—])(\s+)/g, '$1<wbr>$2$3');
                    trackStr = escapeHtml(trackStr);
                    // Unescape <wbr> (since escapeHtml will escape it)
                    trackStr = trackStr.replace(/&lt;wbr&gt;/g, '<wbr>');
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

function toggleGroup(groupId) {
    const rows = document.querySelectorAll(`.${groupId}`);
    const header = event.target.closest('.driver-group-header');
    const icon = header.querySelector('.toggle-icon');
    
    rows.forEach(row => {
        if (row.style.display === 'none') {
            row.style.display = '';
            icon.textContent = '▼';
        } else {
            row.style.display = 'none';
            icon.textContent = '▶';
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
    // Get the cached data to show last fetch time
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    let lastFetchTime = new Date();
    
    if (cached) {
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
    document.getElementById('status-combinations').textContent = (statusData.tracks_loaded || statusData.tracksLoaded || 0).toLocaleString();
    document.getElementById('status-entries').textContent = (statusData.total_entries || statusData.totalEntries || 0).toLocaleString();
    document.getElementById('status-drivers').textContent = (driversCount !== undefined ? driversCount.toLocaleString() : '-');

    console.log('Resolved driversCount:', driversCount, 'statusData keys:', Object.keys(statusData || {}));
}
