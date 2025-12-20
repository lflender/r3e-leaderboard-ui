/**
 * Detail page script for RaceRoom Leaderboards
 * Refactored to use modular architecture
 */

// ===========================================
// URL Parameters & State
// ===========================================
const trackParam = R3EUtils.getUrlParam('track');
const classParam = R3EUtils.getUrlParam('class');
const posParam = parseInt(R3EUtils.getUrlParam('pos') || '');
const difficultyParam = R3EUtils.getUrlParam('difficulty') || 'All difficulties';

// Ensure pos param is applied only once
let posApplied = false;

// Pagination state
let currentPage = 1;
let itemsPerPage = 100;
let allResults = [];
let unfilteredResults = [];

// Car filter
let carFilterSelect = null;
let availableCars = [];

// ===========================================
// Initialize
// ===========================================
const resultsContainer = document.getElementById('detail-results-container');

// Fetch and display data
fetchLeaderboardDetails();

// ===========================================
// Main Fetch Function
// ===========================================
async function fetchLeaderboardDetails() {
    resultsContainer.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        console.log('Loading leaderboard data for track:', trackParam, 'class:', classParam);
        
        const data = await dataService.fetchLeaderboardDetails(trackParam, classParam);
        
        // Extract leaderboard array from data structure
        const leaderboardData = extractLeaderboardArray(data);
        
        if (!leaderboardData || !Array.isArray(leaderboardData)) {
            throw new Error('Leaderboard data not found in the expected format');
        }
        
        console.log('Using leaderboard data with', leaderboardData.length, 'entries');
        
        // Transform data to consistent format
        const transformedData = transformLeaderboardData(leaderboardData, data);
        
        // Set page titles
        setDetailTitles(data, trackParam, classParam);
        
        // Store unfiltered results
        unfilteredResults = transformedData;
        
        // Build car filter from data
        buildCarFilter(transformedData);
        
        // Apply difficulty filter if specified
        if (difficultyParam && difficultyParam !== 'All difficulties') {
            allResults = transformedData.filter(entry => {
                const diff = entry.Difficulty || entry.difficulty || entry.driving_model || '';
                return diff.toLowerCase() === difficultyParam.toLowerCase();
            });
        } else {
            allResults = transformedData;
        }
        
        // Calculate page containing position
        if (posParam && !Number.isNaN(posParam)) {
            const posIndex = allResults.findIndex(entry => {
                const pos = entry.Position || entry.position || entry.Pos || 0;
                return parseInt(String(pos).trim()) === posParam;
            });
            
            if (posIndex !== -1) {
                currentPage = Math.floor(posIndex / itemsPerPage) + 1;
            } else {
                currentPage = 1;
            }
        } else {
            currentPage = 1;
        }
        
        displayResults(allResults);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        displayError(error.message);
    }
}

/**
 * Extract leaderboard array from various data structures
 * @param {Object} data - API response data
 * @returns {Array} Leaderboard array
 */
function extractLeaderboardArray(data) {
    const possibleKeys = ['leaderboard', 'entries', 'results', 'data', 'Leaderboard', 'Entries', 'Results'];
    
    // Check root level
    for (const key of possibleKeys) {
        if (data[key] && Array.isArray(data[key])) {
            return data[key];
        }
    }
    
    // Check track_info
    if (data.track_info) {
        for (const key of possibleKeys) {
            if (data.track_info[key] && Array.isArray(data.track_info[key])) {
                return data.track_info[key];
            }
        }
    }
    
    // Search all keys for arrays
    for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
            return data[key];
        }
    }
    
    // Check nested objects
    for (const key of Object.keys(data)) {
        if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
            for (const nestedKey of Object.keys(data[key])) {
                if (Array.isArray(data[key][nestedKey]) && data[key][nestedKey].length > 0) {
                    return data[key][nestedKey];
                }
            }
        }
    }
    
    return null;
}

/**
 * Transform leaderboard data to consistent format
 * @param {Array} leaderboardData - Raw leaderboard array
 * @param {Object} data - Full data object
 * @returns {Array} Transformed data
 */
function transformLeaderboardData(leaderboardData, data) {
    const totalEntries = leaderboardData.length;
    const defaultClassName = data.track_info?.ClassName || data.track_info?.class_name || null;
    const firstClassName = leaderboardData[0]?.car_class?.class?.Name || 
                          leaderboardData[0]?.car_class?.class?.name || null;
    
    return leaderboardData.map((entry, index) => {
        let carClass = entry.car_class?.class?.Name || entry.car_class?.class?.name || 
                      entry.car_class?.Name || entry.car_class?.name || entry.CarClass || '';
        if (!carClass) carClass = firstClassName || defaultClassName || '';
        
        const carName = entry.car_class?.car?.Name || entry.car_class?.car?.name || 
                       entry.vehicle?.Name || entry.vehicle?.name || 
                       entry.car?.Name || entry.car?.name || entry.Car || '';
        
        const classId = entry.class_id || entry.ClassID || entry['Class ID'] || 
                       entry.car_class?.class?.Id || entry.car_class?.class?.ID || null;
        const trackIdFromEntry = entry.track_id || entry.TrackID || entry['Track ID'] || 
                                data.track_info?.Id || data.track_info?.ID || null;
        
        return {
            Position: entry.class_position !== undefined ? entry.class_position + 1 : 
                     (entry.index !== undefined ? entry.index + 1 : index + 1),
            Name: entry.driver?.Name || entry.driver?.name || entry.Name || 'Unknown',
            Country: entry.country?.Name || entry.country?.name || entry.Country || '',
            CarClass: carClass,
            Car: carName,
            LapTime: entry.laptime || entry.lap_time || entry.LapTime || entry.time || '',
            Rank: entry.rank?.Name || entry.rank?.name || entry.Rank || '',
            Team: entry.team?.Name || entry.team?.name || entry.Team || '',
            Difficulty: entry.driving_model || entry.difficulty || entry.Difficulty || '',
            Track: data.track_info?.Name || data.track_name || '',
            TotalEntries: totalEntries,
            ClassID: classId || undefined,
            TrackID: trackIdFromEntry || undefined,
            class_id: classId || undefined,
            track_id: trackIdFromEntry || undefined
        };
    });
}

/**
 * Set detail page titles from data
 * @param {Object} data - Full data object
 * @param {string} trackParam - Track parameter
 * @param {string} classParam - Class parameter
 */
function setDetailTitles(data, trackParam, classParam) {
    let trackName = trackParam || '';
    let layoutName = '';
    let carClassName = '';
    
    // Try to get info from track_info
    if (data.track_info && typeof data.track_info === 'object') {
        const fullTrack = String(data.track_info.Name || data.track_info.name || '');
        if (fullTrack && fullTrack !== '') {
            const match = fullTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
            if (match) {
                trackName = match[1].trim();
                layoutName = match[2].trim();
            } else {
                trackName = fullTrack;
            }
        }
        carClassName = data.track_info.ClassName || data.track_info.class_name || '';
    }
    
    // Fallback to results array
    if (!trackName || trackName === trackParam || !carClassName) {
        const results = extractLeaderboardArray(data);
        if (results && results.length > 0) {
            const first = results[0];
            let fullTrackRaw = first.Track || first.track || trackName;
            // If track is an object, try to extract the name property
            if (fullTrackRaw && typeof fullTrackRaw === 'object') {
                fullTrackRaw = fullTrackRaw.Name || fullTrackRaw.name || '';
            }
            const fullTrack = String(fullTrackRaw || '');
            if (fullTrack && fullTrack !== '' && fullTrack !== 'undefined' && fullTrack !== '[object Object]') {
                const match = fullTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
                if (match) {
                    trackName = match[1].trim();
                    layoutName = match[2].trim();
                } else {
                    trackName = fullTrack;
                }
            }
            if (!carClassName) {
                carClassName = first?.car_class?.class?.Name || first?.car_class?.class?.name || 
                              first.CarClass || first['Car Class'] || '';
            }
        }
    }
    
    if (!carClassName) carClassName = classParam || '';
    
    document.getElementById('detail-track').innerHTML = 
        `<span class="detail-label">Track:</span> ${R3EUtils.escapeHtml(trackName)}`;
    
    if (layoutName) {
        let layoutElem = document.getElementById('detail-layout');
        if (!layoutElem) {
            layoutElem = document.createElement('div');
            layoutElem.id = 'detail-layout';
            document.getElementById('detail-track').after(layoutElem);
        }
        layoutElem.innerHTML = `<span class="detail-label">Layout:</span> ${R3EUtils.escapeHtml(layoutName)}`;
    } else {
        const layoutElem = document.getElementById('detail-layout');
        if (layoutElem) layoutElem.remove();
    }
    
    document.getElementById('detail-class').innerHTML = 
        `<span class="detail-label">Class:</span> ${R3EUtils.escapeHtml(carClassName)}`;
}

/**
 * Display results
 * @param {Array} data - Results data
 */
function displayResults(data) {
    let results = Array.isArray(data) ? data.slice() : [];
    
    // Sort by position
    results.sort((a, b) => {
        const posA = parseInt(a.Position || a.position || a.Pos || 0);
        const posB = parseInt(b.Position || b.position || b.Pos || 0);
        return posA - posB;
    });
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    // Pagination
    const totalResults = results.length;
    const totalPages = Math.ceil(totalResults / itemsPerPage);
    
    // Apply position highlighting
    if (!posApplied && posParam && !Number.isNaN(posParam)) {
        const posIndex = results.findIndex(entry => {
            const p = parseInt(entry.Position || entry.position || entry.Pos || 0);
            return p === posParam;
        });
        const targetIndex = posIndex !== -1 ? posIndex : Math.max(0, posParam - 1);
        const targetPage = Math.floor(targetIndex / itemsPerPage) + 1;
        currentPage = Math.min(Math.max(1, targetPage), totalPages);
        posApplied = true;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalResults);
    const paginatedResults = results.slice(startIndex, endIndex);
    
    // Check if car filter is active
    const carToggle = document.querySelector('#car-filter-ui .custom-select__toggle');
    const selectedCar = carToggle ? carToggle.textContent.replace(' ▾', '').trim() : 'All cars';
    const isCarFilterActive = selectedCar !== 'All cars';
    
    // Add filtered and absolute position data when car filter is active
    if (isCarFilterActive) {
        paginatedResults.forEach((item, filteredIndex) => {
            // Calculate filtered position (position within the current filtered results)
            const actualFilteredIndex = startIndex + filteredIndex;
            item.filteredPosition = actualFilteredIndex + 1;
            item.filteredTotal = totalResults;
            
            // Find absolute position in unfiltered results
            const originalPos = item.Position || item.position || item.Pos;
            const itemName = item.Name || item.name;
            const absoluteEntry = unfilteredResults.find(entry => {
                const entryPos = entry.Position || entry.position || entry.Pos;
                const entryName = entry.Name || entry.name;
                return entryPos === originalPos && entryName === itemName;
            });
            if (absoluteEntry) {
                item.absolutePosition = absoluteEntry.Position || absoluteEntry.position || absoluteEntry.Pos;
                item.absoluteTotal = absoluteEntry.TotalEntries || unfilteredResults.length;
            }
        });
    }
    
    // Create table
    const headers = ['Position', 'Driver Name', 'Lap Time', 'Car', 'Difficulty'];
    let tableHTML = '<table class="results-table"><thead><tr>';
    headers.forEach(h => tableHTML += `<th>${h}</th>`);
    tableHTML += '</tr></thead><tbody>';
    
    paginatedResults.forEach(item => {
        tableHTML += renderDetailRow(item, isCarFilterActive);
    });
    
    tableHTML += '</tbody></table>';
    
    // Pagination
    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML = generateDetailPaginationHTML(startIndex, endIndex, totalResults, currentPage, totalPages);
    }
    
    resultsContainer.innerHTML = paginationHTML + tableHTML + paginationHTML;
    
    // Highlight position row if needed
    if (posParam && !Number.isNaN(posParam)) {
        highlightPositionRow(posParam);
    }
}

/**
 * Render detail row
 * @param {Object} item - Data item
 * @param {boolean} showAbsolutePosition - Whether to show absolute position
 * @returns {string} HTML string
 */
function renderDetailRow(item, showAbsolutePosition = false) {
    const position = item.Position || item.position || item.Pos || '-';
    const totalEntries = R3EUtils.getTotalEntriesCount(item);
    const posNum = String(position).trim();
    const totalNum = totalEntries ? String(totalEntries).trim() : '';
    const badgeColor = R3EUtils.getPositionBadgeColor(parseInt(posNum), parseInt(totalNum));
    
    // When car filter is active, we swap the display:
    // - Small label shows filtered position (position within the car filter)
    // - Main badge shows absolute position (position across all cars)
    const filteredPos = item.filteredPosition ? String(item.filteredPosition).trim() : null;
    const filteredTotal = item.filteredTotal ? String(item.filteredTotal).trim() : null;
    const absolutePos = item.absolutePosition ? String(item.absolutePosition).trim() : null;
    const absoluteTotal = item.absoluteTotal ? String(item.absoluteTotal).trim() : null;
    
    const name = item.Name || item.name || '-';
    const highlisted = item.highlisted || item.Highlisted || false;
    
    const lapTime = item.LapTime || item['Lap Time'] || item.lap_time || '-';
    const parts = String(lapTime).split(/,\s*/);
    const mainClassic = R3EUtils.formatClassicLapTime(parts[0] || '');
    const deltaRaw = parts.slice(1).join(' ');
    const deltaClassic = deltaRaw ? R3EUtils.formatClassicLapTime(deltaRaw) : '';
    
    const car = item.Car || item.car || '-';
    
    const difficulty = item.Difficulty || item.difficulty || '-';
    const diffStr = String(difficulty).trim().toLowerCase();
    let diffClass = '';
    if (diffStr === 'get real') diffClass = 'difficulty-get-real';
    else if (diffStr === 'amateur') diffClass = 'difficulty-amateur';
    else if (diffStr === 'novice') diffClass = 'difficulty-novice';
    
    const rowTrackId = item.track_id || item.TrackID || trackParam || '';
    const rowClassId = item.class_id || item.ClassID || '';
    
    let html = `<tr data-trackid="${R3EUtils.escapeHtml(String(rowTrackId))}" data-classid="${R3EUtils.escapeHtml(String(rowClassId))}">`;
    
    // Position
    html += '<td class="pos-cell">';
    
    // When car filter is active, show filtered position in small label
    if (showAbsolutePosition && filteredPos && filteredTotal) {
        html += `<span class="absolute-pos-label">${R3EUtils.escapeHtml(filteredPos)}/${R3EUtils.escapeHtml(filteredTotal)}</span> `;
    }
    
    // Main position display - show absolute position when filter is active, otherwise normal position
    if (showAbsolutePosition && absolutePos && absoluteTotal) {
        const absoluteBadgeColor = R3EUtils.getPositionBadgeColor(parseInt(absolutePos), parseInt(absoluteTotal));
        html += `<span class="pos-number" style="background:${absoluteBadgeColor}">${R3EUtils.escapeHtml(absolutePos)}</span>`;
        html += `<span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(absoluteTotal)}</span>`;
    } else {
        html += `<span class="pos-number" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span>`;
        if (totalNum) {
            html += `<span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(totalNum)}</span>`;
        }
    }
    
    html += '</td>';
    
    // Driver name
    if (!highlisted) {
        const encoded = encodeURIComponent(String(name));
        html += `<td><a class="detail-driver-link" href="index.html?driver=${encoded}">${R3EUtils.escapeHtml(String(name))}</a></td>`;
    } else {
        html += `<td>${R3EUtils.escapeHtml(String(name))}</td>`;
    }
    
    // Lap time
    if (deltaClassic) {
        html += `<td class="no-wrap">${R3EUtils.escapeHtml(mainClassic)} <span class="time-delta-inline no-wrap">${R3EUtils.escapeHtml(deltaClassic)}</span></td>`;
    } else {
        html += `<td class="no-wrap">${R3EUtils.escapeHtml(mainClassic)}</td>`;
    }
    
    // Car
    html += `<td>${R3EUtils.escapeHtml(String(car))}</td>`;
    
    // Difficulty
    html += `<td class="difficulty-cell"><span class="difficulty-pill ${diffClass}">${R3EUtils.escapeHtml(String(difficulty))}</span></td>`;
    
    html += '</tr>';
    return html;
}

/**
 * Generate pagination HTML for detail view
 */
function generateDetailPaginationHTML(startIndex, endIndex, totalResults, currentPage, totalPages) {
    let html = '<div class="pagination">';
    html += `<div class="pagination-info">Showing ${startIndex + 1}-${endIndex} of ${totalResults} results</div>`;
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
 * Highlight position row
 * @param {number} targetPos - Position to highlight
 */
function highlightPositionRow(targetPos) {
    setTimeout(() => {
        const rows = document.querySelectorAll('#detail-results-container table.results-table tbody tr');
        rows.forEach(r => r.classList.remove('highlight-row'));
        
        for (const r of rows) {
            const td = r.querySelector('td');
            if (!td) continue;
            const posText = String(td.textContent || '');
            const num = parseInt((posText.match(/\d+/) || [''])[0]);
            if (num === targetPos) {
                r.classList.add('highlight-row');
                
                const trackId = r.dataset.trackid || trackParam || '';
                const classId = r.dataset.classid || classParam || '';
                if (trackId) {
                    const isNumericId = /^\d+$/.test(String(classId));
                    const carClass = isNumericId ? `class-${classId}` : '';
                    const openExternal = () => {
                        let url = `https://game.raceroom.com/leaderboard/?track=${encodeURIComponent(trackId)}`;
                        if (carClass) url += `&car_class=${encodeURIComponent(carClass)}`;
                        window.open(url, '_blank');
                    };
                    r.style.cursor = 'pointer';
                    if (!r.dataset.externalClickAdded) {
                        r.addEventListener('click', openExternal);
                        r.dataset.externalClickAdded = '1';
                    }
                }
                r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            }
        }
    }, 50);
}

/**
 * Display error
 * @param {string} message - Error message
 */
function displayError(message) {
    resultsContainer.innerHTML = `
        <div class="error">
            <strong>Error:</strong> ${message}
            <br><br>
            <small>Make sure the data files are available</small>
        </div>
    `;
}

/**
 * Go to page
 * @param {number} page - Page number
 */
function goToPage(page) {
    currentPage = page;
    displayResults(allResults);
    document.getElementById('detail-results-container').scrollIntoView({ 
        behavior: 'smooth', block: 'start' 
    });
}

/**
 * Build car filter from data
 */
function buildCarFilter(data) {
    // Extract unique cars
    const carsSet = new Set();
    data.forEach(entry => {
        const car = entry.Car || entry.car || '';
        if (car && car !== '-') {
            carsSet.add(car);
        }
    });
    
    availableCars = Array.from(carsSet).sort();
    
    // Only show car filter if there are 2 or more cars
    if (availableCars.length > 1 && carFilterSelect) {
        // Update car filter options
        const carOptions = [
            { value: '', label: 'All cars' },
            ...availableCars.map(car => ({ value: car, label: car }))
        ];
        
        carFilterSelect.setOptions(carOptions);
        
        const carFilterContainer = document.getElementById('car-filter-ui');
        if (carFilterContainer) {
            carFilterContainer.style.display = '';
        }
    }
}

/**
 * Filter and display results by difficulty and car
 */
function filterAndDisplayResults() {
    const difficultyToggle = document.querySelector('#difficulty-filter-ui .custom-select__toggle');
    const selectedDifficulty = difficultyToggle ? 
        difficultyToggle.textContent.replace(' ▾', '').trim() : 'All difficulties';
    
    const carToggle = document.querySelector('#car-filter-ui .custom-select__toggle');
    const selectedCar = carToggle ? 
        carToggle.textContent.replace(' ▾', '').trim() : 'All cars';
    
    // Apply both filters
    allResults = unfilteredResults.filter(entry => {
        // Difficulty filter
        const diff = entry.Difficulty || entry.difficulty || entry.driving_model || '';
        const difficultyMatch = selectedDifficulty === 'All difficulties' || 
            diff.toLowerCase() === selectedDifficulty.toLowerCase();
        
        // Car filter
        const car = entry.Car || entry.car || '';
        const carMatch = selectedCar === 'All cars' || car === selectedCar;
        
        return difficultyMatch && carMatch;
    });
    
    posApplied = false;
    if (posParam && !Number.isNaN(posParam)) {
        const posIndex = allResults.findIndex(entry => {
            const pos = parseInt(entry.Position || entry.position || entry.Pos || 0);
            return pos === posParam;
        });
        currentPage = posIndex !== -1 ? (Math.floor(posIndex / itemsPerPage) + 1) : 1;
    } else {
        currentPage = 1;
    }
    
    displayResults(allResults);
}

// ===========================================
// Filter Setup
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    // Car filter - will be populated dynamically when data loads
    const carOptions = [{ value: '', label: 'All cars' }];
    carFilterSelect = new CustomSelect('car-filter-ui', carOptions, () => {
        filterAndDisplayResults();
    });
    
    // Difficulty filter
    const difficultyOptions = [
        { value: '', label: 'All difficulties' },
        { value: 'Get Real', label: 'Get Real' },
        { value: 'Amateur', label: 'Amateur' },
        { value: 'Novice', label: 'Novice' }
    ];
    
    const difficultySelect = new CustomSelect('difficulty-filter-ui', difficultyOptions, () => {
        filterAndDisplayResults();
    });
    
    // Set initial difficulty from URL param
    if (difficultyParam && difficultyParam !== 'All difficulties') {
        difficultySelect.setValue(difficultyParam);
    }
});

// Make functions globally accessible
window.goToPage = goToPage;
