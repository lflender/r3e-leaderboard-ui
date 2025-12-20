/**
 * Main script for RaceRoom Leaderboards Explorer
 * Refactored to use modular architecture
 */

// ===========================================
// Tab Switching
// ===========================================
const tabButtons = Array.from(document.querySelectorAll('.tab-button')).filter(b => b.dataset && b.dataset.tab);
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// ===========================================
// Main Application State
// ===========================================
const driverSearch = document.getElementById('driver-search');
const classFilter = document.getElementById('class-filter');
const classFilterUI = document.getElementById('class-filter-ui');
const difficultyFilterUI = document.getElementById('difficulty-filter-ui');
const resultsContainer = document.getElementById('results-container');

// Check if we're on the driver search page
const isDriverSearchPage = driverSearch !== null;

// Pagination state
let currentPage = 1;
let itemsPerPage = 100;
let allResults = [];

// ===========================================
// Initialize Data Service
// ===========================================
// Load driver index on page load
dataService.loadDriverIndex();

// ===========================================
// Status Display (Works on all pages)
// ===========================================
async function fetchAndDisplayStatus() {
    try {
        const statusData = await dataService.calculateStatus();
        
        if (!statusData) {
            console.log('Status data not available yet');
            return;
        }
        
        displayStatus({ data: statusData });
    } catch (error) {
        console.error('Error calculating status:', error);
    }
}

function displayStatus(data) {
    const statusData = data.data || data;
    
    const driversCount = statusData.total_indexed_drivers || statusData.total_drivers || 0;
    const fetchInProgress = statusData.fetch_in_progress === true;
    
    const timestampEl = document.getElementById('status-timestamp');
    const timestampLabelEl = document.getElementById('status-timestamp-label');
    const tracksEl = document.getElementById('status-tracks');
    const combinationsEl = document.getElementById('status-combinations');
    const entriesEl = document.getElementById('status-entries');
    const driversEl = document.getElementById('status-drivers');
    
    // Update the label based on fetch_in_progress
    if (timestampLabelEl) {
        timestampLabelEl.textContent = fetchInProgress ? 'Last partial update:' : 'Last complete update:';
    }
    
    // Use appropriate timestamp from status.json
    if (timestampEl) {
        let timestamp = fetchInProgress ? statusData.last_index_update : statusData.last_scrape_end;
        if (timestamp) {
            // Parse the timestamp and format it
            const date = new Date(timestamp);
            timestampEl.textContent = date.toLocaleString();
        } else {
            timestampEl.textContent = '-';
        }
    }
    
    if (tracksEl) tracksEl.textContent = (statusData.unique_tracks || 0).toLocaleString();
    if (combinationsEl) combinationsEl.textContent = (statusData.track_class_combination || 0).toLocaleString();
    if (entriesEl) entriesEl.textContent = (statusData.total_entries || 0).toLocaleString();
    if (driversEl) driversEl.textContent = driversCount.toLocaleString();
}

// Fetch status on page load
fetchAndDisplayStatus();

// ===========================================
// Driver Search Page Specific Code
// ===========================================
if (isDriverSearchPage) {
    // ===========================================
    // Class Filter Setup
    // ===========================================
    function populateClassFilterFromCarsData() {
    if (!classFilter) return;
    
    const classOptions = dataService.getClassOptionsFromCarsData();
    if (classOptions.length === 0) return;
    
    const allOption = '<option value="">All classes</option>';
    const optionsHtml = classOptions.map(o => 
        `<option value="${R3EUtils.escapeHtml(o.value)}">${R3EUtils.escapeHtml(o.label)}</option>`
    ).join('');
    
    classFilter.innerHTML = allOption + optionsHtml;
}

// Populate class filter
populateClassFilterFromCarsData();

// ===========================================
// Custom Select Components Setup
// ===========================================
if (classFilter && classFilterUI) {
    const classOptions = [{ value: '', label: 'All classes' }].concat(
        dataService.getClassOptionsFromCarsData()
    );
    
    const classSelect = new CustomSelect('class-filter-ui', classOptions, async (value) => {
        classFilter.value = value;
        const searchTerm = driverSearch.value.trim();
        if (searchTerm) await searchDriver(searchTerm);
    });
}

if (difficultyFilterUI) {
    const difficultyOptions = [
        { value: '', label: 'All difficulties' },
        { value: 'Get Real', label: 'Get Real' },
        { value: 'Amateur', label: 'Amateur' },
        { value: 'Novice', label: 'Novice' }
    ];
    
    const difficultySelect = new CustomSelect('difficulty-filter-ui', difficultyOptions, async (value) => {
        const searchTerm = driverSearch.value.trim();
        if (searchTerm) await searchDriver(searchTerm);
    });
}

// ===========================================
// Driver Search
// ===========================================
driverSearch.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const searchTerm = driverSearch.value.trim();
        if (!searchTerm) return;
        
        // Close keyboard on mobile
        e.target.blur();
        
        R3EUtils.updateUrlParam('driver', searchTerm);
        await searchDriver(searchTerm);
    }
});

// Class filter change handler
if (classFilter) {
    classFilter.addEventListener('change', async () => {
        const searchTerm = driverSearch.value.trim();
        if (!searchTerm) return;
        await searchDriver(searchTerm);
    });
}

// Handle URL driver parameter on load
(function handleUrlDriverParam() {
    const driver = R3EUtils.getUrlParam('driver') || R3EUtils.getUrlParam('query');
    if (driver && driverSearch) {
        driverSearch.value = driver;
        setTimeout(() => { searchDriver(driver); }, 50);
    }
})();

/**
 * Search for driver in the leaderboards
 * @param {string} driverName - Driver name to search
 */
async function searchDriver(driverName) {
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        // Get current filters
        const selectedClass = classFilter ? classFilter.value : '';
        const difficultyToggle = document.querySelector('#difficulty-filter-ui .custom-select__toggle');
        const selectedDifficulty = difficultyToggle ? 
            difficultyToggle.textContent.replace(' ▾', '').trim() : 'All difficulties';
        
        // Search using data service
        const results = await dataService.searchDriver(driverName, {
            className: selectedClass,
            difficulty: selectedDifficulty
        });
        
        console.log('Search results:', results.length, 'drivers found');
        
        allResults = results;
        currentPage = 1;
        displayResults(results);
    } catch (error) {
        console.error('Search error:', error);
        displayError(error.message);
    }
}

/**
 * Display search results
 * @param {Array} data - Search results
 */
function displayResults(data) {
    if (!Array.isArray(data)) {
        displayError('Invalid response format');
        return;
    }
    
    if (data.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    // Paginate driver groups
    const totalDrivers = data.length;
    const totalPages = Math.ceil(totalDrivers / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalDrivers);
    const paginatedDrivers = data.slice(startIndex, endIndex);
    
    // Calculate total entries shown
    let totalEntriesShown = 0;
    paginatedDrivers.forEach(g => { 
        totalEntriesShown += Array.isArray(g.entries) ? g.entries.length : 0; 
    });
    
    console.log(`Showing drivers ${startIndex + 1}-${endIndex} of ${totalDrivers} (${totalEntriesShown} entries)`);
    
    // Get keys from first entry
    let keys = [];
    if (paginatedDrivers.length > 0 && 
        Array.isArray(paginatedDrivers[0].entries) && 
        paginatedDrivers[0].entries.length > 0) {
        keys = Object.keys(paginatedDrivers[0].entries[0]);
        keys = tableRenderer.filterAndSortKeys(keys);
    }
    
    // Render table
    const tableHTML = tableRenderer.renderDriverGroupedTable(paginatedDrivers, keys);
    
    // Generate pagination HTML
    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML = generatePaginationHTML(startIndex, endIndex, totalDrivers, totalEntriesShown, currentPage, totalPages);
    }
    
    resultsContainer.innerHTML = tableHTML + paginationHTML;
}

/**
 * Generate pagination HTML
 */
function generatePaginationHTML(startIndex, endIndex, totalDrivers, totalEntriesShown, currentPage, totalPages) {
    let html = '<div class="pagination">';
    html += `<div class="pagination-info">Showing drivers ${startIndex + 1}-${endIndex} of ${totalDrivers} (${totalEntriesShown} total entries)</div>`;
    html += '<div class="pagination-buttons">';
    
    if (currentPage > 1) {
        html += `<button onclick="goToPage(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
    }
    
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    if (startPage > 1) {
        html += `<button onclick="goToPage(1)" class="page-btn">1</button>`;
        if (startPage > 2) html += '<span class="page-ellipsis">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        html += `<button onclick="goToPage(${i})" class="page-btn ${activeClass}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="page-ellipsis">...</span>';
        html += `<button onclick="goToPage(${totalPages})" class="page-btn">${totalPages}</button>`;
    }
    
    if (currentPage < totalPages) {
        html += `<button onclick="goToPage(${currentPage + 1})" class="page-btn">Next ›</button>`;
    }
    
    html += '</div></div>';
    return html;
}

/**
 * Display error message
 * @param {string} message - Error message
 */
function displayError(message) {
    resultsContainer.innerHTML = `
        <div class="error">
            <strong>Error:</strong> ${message}
        </div>
    `;
}

/**
 * Go to specific page
 * @param {number} page - Page number
 */
function goToPage(page) {
    currentPage = page;
    displayResults(allResults);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Toggle driver group visibility
 * @param {HTMLElement|string} target - Header element or group ID
 */
function toggleGroup(target) {
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

// (moved) openDetailView is now defined globally below

    // Make functions globally accessible for driver search page
    window.goToPage = goToPage;
    window.toggleGroup = toggleGroup;

} // End of isDriverSearchPage block

// ===========================================
// Global Functions (Available on all pages)
// ===========================================
/**
 * Open detail view for a leaderboard entry
 * Works on both Driver and Track pages
 * @param {Event} event - Click event
 * @param {HTMLElement} row - Table row element
 */
function openDetailView(event, row) {
    if (event && event.target && event.target.closest && event.target.closest('.driver-group-header')) {
        return;
    }

    const trackId = row?.dataset?.trackid;
    const classId = row?.dataset?.classid;
    const track = row?.dataset?.track;
    const carClass = row?.dataset?.class;
    const pos = row?.dataset?.position;

    const difficultyToggle = document.querySelector('#difficulty-filter-ui .custom-select__toggle');
    const selectedDifficulty = difficultyToggle ?
        difficultyToggle.textContent.replace(' ▾', '').trim() : 'All difficulties';

    let url = '';
    if (trackId && classId) {
        url = `detail.html?track=${encodeURIComponent(trackId)}&class=${encodeURIComponent(classId)}`;
    } else if (track && carClass) {
        url = `detail.html?track=${encodeURIComponent(track)}&class=${encodeURIComponent(carClass)}`;
    }

    if (url) {
        if (pos) url += `&pos=${encodeURIComponent(pos)}`;
        if (selectedDifficulty !== 'All difficulties') {
            url += `&difficulty=${encodeURIComponent(selectedDifficulty)}`;
        }
        window.open(url, '_blank');
    }
}
window.openDetailView = openDetailView;
