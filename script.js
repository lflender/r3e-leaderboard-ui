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
const STATUS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
        tableHTML += `
            <tr class="driver-group-header" onclick="toggleGroup('${groupId}')">
                <td colspan="${keys.length}">
                    <span class="toggle-icon">▼</span>
                    <strong>${driverName}</strong>
                    <span class="driver-meta">🌍 ${country} | ⭐ Rank ${rank} | 🏁 Team ${team}</span>
                </td>
            </tr>`;
        
        // Create data rows for this driver
        driverResults.forEach(item => {
            // Use TrackID and ClassID for detail view if available
            const trackId = item.TrackID || item.track_id || item['Track ID'] || '';
            const classId = item.ClassID || item.class_id || item['Class ID'] || '';
            tableHTML += `<tr class="driver-data-row ${groupId}" onclick="openDetailView(event, this)" data-trackid="${escapeHtml(trackId)}" data-classid="${escapeHtml(classId)}" data-track="${escapeHtml(item.Track || item.track || '')}" data-class="${escapeHtml(firstEntry.CarClass || firstEntry['Car Class'] || firstEntry.car_class || firstEntry.Class || '')}">`;
            keys.forEach(key => {
                let value = item[key];
                
                // Special handling for Position column - merge with TotalEntries
                const isPositionKey = key === 'Position' || key === 'position' || key === 'Pos';
                if (isPositionKey) {
                    const totalEntries = item.TotalEntries || item['Total Entries'] || item.total_entries || item.TotalRacers || item.total_racers;
                    if (totalEntries) {
                        value = `${value} / ${totalEntries}`;
                    }
                }
                
                tableHTML += `<td>${formatValue(value)}</td>`;
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
    if (trackId && classId) {
        const url = `detail.html?track=${encodeURIComponent(trackId)}&class=${encodeURIComponent(classId)}`;
        window.open(url, '_blank');
    } else if (track && carClass) {
        const url = `detail.html?track=${encodeURIComponent(track)}&class=${encodeURIComponent(carClass)}`;
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
    
    // Update the display
    document.getElementById('status-timestamp').textContent = lastFetchTime.toLocaleString();
    document.getElementById('status-tracks').textContent = (statusData.unique_tracks || 0).toLocaleString();
    document.getElementById('status-combinations').textContent = (statusData.tracks_loaded || 0).toLocaleString();
    document.getElementById('status-entries').textContent = (statusData.total_entries || 0).toLocaleString();
}
