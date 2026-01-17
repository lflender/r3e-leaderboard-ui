/**
 * Detail page script for RaceRoom Leaderboards
 * Refactored to use modular architecture
 */

// ===========================================
// State Management
// ===========================================
const DetailState = {
    // URL Parameters
    trackParam: R3EUtils.getUrlParam('track'),
    classParam: R3EUtils.getUrlParam('class'),
    superclassParam: R3EUtils.getUrlParam('superclass'), // For combined view
    posParam: parseInt(R3EUtils.getUrlParam('pos') || ''),
    difficultyParam: R3EUtils.getUrlParam('difficulty') || 'All difficulties',
    driverParam: R3EUtils.getUrlParam('driver') || '',
    timeParam: R3EUtils.getUrlParam('time') || '',
    
    // State
    posApplied: false,
    currentPage: 1,
    itemsPerPage: 100,
    allResults: [],
    unfilteredResults: [],
    carFilterSelect: null,
    availableCars: [],
    lastActionTime: 0,
    isCombinedView: false // True when showing combined superclass data
};

// Backward compatibility - keep old variable names pointing to DetailState
const trackParam = DetailState.trackParam;
const classParam = DetailState.classParam;
const superclassParam = DetailState.superclassParam;
const posParam = DetailState.posParam;
const difficultyParam = DetailState.difficultyParam;
const driverParam = DetailState.driverParam;
const timeParam = DetailState.timeParam;
let posApplied = DetailState.posApplied;
let currentPage = DetailState.currentPage;
let itemsPerPage = DetailState.itemsPerPage;
let allResults = DetailState.allResults;
let unfilteredResults = DetailState.unfilteredResults;
let carFilterSelect = DetailState.carFilterSelect;
let availableCars = DetailState.availableCars;
let lastActionTime = DetailState.lastActionTime;

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
    await TemplateHelper.showLoading(resultsContainer);
    
    try {
        // Check if we're in combined superclass mode
        if (superclassParam && trackParam) {
            DetailState.isCombinedView = true;
            await fetchCombinedSuperclassDetails();
            return;
        }
        
        const data = await dataService.fetchLeaderboardDetails(trackParam, classParam);
        
        // Extract leaderboard array from data structure
        const leaderboardData = extractLeaderboardArray(data);
        
        if (!leaderboardData || !Array.isArray(leaderboardData)) {
            throw new Error('Leaderboard data not found in the expected format');
        }
        
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
        
        // Calculate page containing the target entry (prefer driver/time match, fallback to position)
        currentPage = 1;
        let targetIdx = -1;
        if (driverParam) {
            const dLower = String(driverParam).toLowerCase();
            targetIdx = allResults.findIndex(entry => {
                const nm = (entry.Name || entry.name || '').toLowerCase();
                const time = String(entry.LapTime || entry['Lap Time'] || entry.lap_time || '').trim();
                if (timeParam) {
                    return nm === dLower && time === String(timeParam).trim();
                }
                return nm === dLower;
            });
        }
        if (targetIdx === -1 && posParam && !Number.isNaN(posParam)) {
            targetIdx = allResults.findIndex(entry => {
                const pos = entry.Position || entry.position || entry.Pos || 0;
                return parseInt(String(pos).trim()) === posParam;
            });
        }
        if (targetIdx !== -1) {
            currentPage = Math.floor(targetIdx / itemsPerPage) + 1;
        }
        
        displayResults(allResults);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        await displayError(error.message);
    }
}

/**
 * Resolve multiple class names to their numeric IDs using driver index
 * @param {string[]} classNames - Array of class names
 * @returns {Promise<Map<string, number|null>>} Map of className -> classId
 */
async function resolveClassNamesToIds(classNames) {
    const result = new Map();
    if (!classNames || classNames.length === 0) return result;

    const buildCountsFromIndex = (idx) => {
        const classNameMap = new Map(); // className -> Map<classId, count>
        classNames.forEach(name => {
            classNameMap.set(String(name).trim().toLowerCase(), new Map());
        });
        for (const driverKey of Object.keys(idx || {})) {
            const entries = (idx && idx[driverKey]) || [];
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
        return classNameMap;
    };

    // Try a few times in case the driver index is still loading on hard refresh
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const idx = await dataService.loadDriverIndex();
        const classNameMap = buildCountsFromIndex(idx || {});

        // For each class name, pick the class ID with the highest count
        result.clear();
        classNames.forEach(name => {
            const cnameKey = String(name).trim().toLowerCase();
            const counts = classNameMap.get(cnameKey);
            let bestId = null;
            let bestCount = 0;
            if (counts) {
                for (const [cid, count] of counts) {
                    if (count > bestCount) {
                        bestCount = count;
                        bestId = cid;
                    }
                }
            }
            result.set(name, bestId);
        });

        const unresolvedList = Array.from(result.entries()).filter(([k, v]) => v === null || v === undefined);
        if (unresolvedList.length === 0) {
            return result; // success
        }
        // Wait briefly and try again
        await new Promise(r => setTimeout(r, 350));
    }

    return result; // may contain nulls; callers should handle
}

/**
 * Fetch combined leaderboard details for a superclass (all classes combined)
 */
async function fetchCombinedSuperclassDetails() {
    try {
        // Keep showing loading state during the entire fetch
        await TemplateHelper.showLoading(resultsContainer);
        
        // Update lastActionTime to prevent premature "no results" display
        lastActionTime = Date.now();
        
        // Get all classes that belong to this superclass
        const superclassClasses = [];
        if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
            window.CARS_DATA.forEach(entry => {
                if (entry.superclass === superclassParam) {
                    const cls = entry.class || entry.car_class || entry.CarClass || '';
                    if (cls && !superclassClasses.includes(cls)) superclassClasses.push(cls);
                }
            });
        }
        
        if (superclassClasses.length === 0) {
            throw new Error('No classes found for superclass: ' + superclassParam);
        }
        
        // Resolve class names to class IDs
        const classIdMap = await resolveClassNamesToIds(superclassClasses);
        
        // Fetch data from all classes in parallel (using class ID, not name)
        const allEntries = [];
        const fetchPromises = superclassClasses.map(async (className) => {
            try {
                const classId = classIdMap.get(className);
                if (classId === null || classId === undefined) {
                    console.warn('No class ID found for:', className);
                    return [];
                }
                const data = await dataService.fetchLeaderboardDetails(trackParam, classId);
                const leaderboardData = extractLeaderboardArray(data);
                if (leaderboardData && Array.isArray(leaderboardData)) {
                    const transformed = transformLeaderboardData(leaderboardData, data);
                    // Add class name to each entry
                    transformed.forEach(entry => {
                        entry.ClassName = className;
                    });
                    return transformed;
                }
                return [];
            } catch (e) {
                console.warn('Failed to fetch class:', className, e);
                return [];
            }
        });
        
        const results = await Promise.all(fetchPromises);
        results.forEach(entries => {
            allEntries.push(...entries);
        });
        
        // Sort by lap time using minimal, explicit parser
        allEntries.forEach((entry, idx) => {
            const rawLap = (window.DataNormalizer && window.DataNormalizer.extractLapTime) ? window.DataNormalizer.extractLapTime(entry) : (entry.LapTime || entry['Lap Time'] || entry.lap_time || '');
            entry.__debugRawLap = rawLap;
            entry.__debugMs = lapToMs(rawLap);
        });
        allEntries.sort((a, b) => {
            return a.__debugMs - b.__debugMs;
        });
        
        // Re-assign positions after sorting - overwrite ALL position properties to ensure correct order
        allEntries.forEach((entry, idx) => {
            const newPos = idx + 1;
            entry.Position = newPos;
            entry.position = newPos;
            entry.Pos = newPos;
            // Clear the original TotalEntries so it doesn't conflict
            delete entry.TotalEntries;
            delete entry.total_entries;
        });
        
        // Recalculate gap times relative to position 1 (fastest time in combined dataset)
        if (allEntries.length > 0) {
            const fastestMs = allEntries[0].__debugMs;
            
            allEntries.forEach((entry, idx) => {
                const entryMs = entry.__debugMs;
                const rawLapTime = entry.__debugRawLap || '';
                
                // Extract just the lap time part (before any comma/gap)
                const lapTimePart = rawLapTime.split(',')[0].trim();
                
                if (idx === 0) {
                    // Position 1 - no gap
                    entry.LapTime = lapTimePart;
                    entry['Lap Time'] = lapTimePart;
                    entry.lap_time = lapTimePart;
                } else {
                    // Calculate gap in milliseconds
                    const gapMs = entryMs - fastestMs;
                    const gapSeconds = (gapMs / 1000).toFixed(3);
                    const gapFormatted = `+${gapSeconds}s`;
                    const newLapTime = `${lapTimePart}, ${gapFormatted}`;
                    
                    entry.LapTime = newLapTime;
                    entry['Lap Time'] = newLapTime;
                    entry.lap_time = newLapTime;
                }
            });
        }
        
        // Set page titles for combined view
        setCombinedDetailTitles(superclassParam);
        
        // Store unfiltered results
        unfilteredResults = allEntries;
        
        // Build car filter from data
        buildCarFilter(allEntries);
        
        // Apply difficulty filter if specified
        if (difficultyParam && difficultyParam !== 'All difficulties') {
            allResults = allEntries.filter(entry => {
                const diff = entry.Difficulty || entry.difficulty || entry.driving_model || '';
                return diff.toLowerCase() === difficultyParam.toLowerCase();
            });
        } else {
            allResults = allEntries;
        }
        
        // Calculate page containing the target entry
        currentPage = 1;
        let targetIdx = -1;
        if (driverParam) {
            const dLower = String(driverParam).toLowerCase();
            targetIdx = allResults.findIndex(entry => {
                const nm = (entry.Name || entry.name || '').toLowerCase();
                return nm === dLower;
            });
        }
        if (targetIdx !== -1) {
            currentPage = Math.floor(targetIdx / itemsPerPage) + 1;
        }
        
        displayResults(allResults);
    } catch (error) {
        console.error('Error loading combined leaderboard:', error);
        await displayError(error.message);
    }
}

/**
 * Parse lap time string to milliseconds for sorting
 */
function lapToMs(timeStr) {
    if (!timeStr) return Number.POSITIVE_INFINITY;
    
    const original = String(timeStr).trim();
    const beforeComma = original.split(',')[0].trim();
    
    let primary = beforeComma;
    let m;
    
    // Format: "3m 54.196s" or "3m 54s"
    m = primary.match(/^(\d+)m\s+(\d+)\.(\d+)s?$/i);
    if (m) {
        const minutes = +m[1];
        const seconds = +m[2];
        const millis = +m[3];
        return minutes * 60000 + seconds * 1000 + millis;
    }
    
    m = primary.match(/^(\d+)m\s+(\d+)s?$/i);
    if (m) {
        const minutes = +m[1];
        const seconds = +m[2];
        return minutes * 60000 + seconds * 1000;
    }
    
    // Remove trailing 's' for other formats
    primary = primary.replace(/s$/i, '');
    
    // M:SS:mmm (e.g., 1:20:029)
    m = primary.match(/^(\d+):(\d{2}):(\d{3})$/);
    if (m) return (+m[1]) * 60000 + (+m[2]) * 1000 + (+m[3]);
    
    // M:SS.mmm (e.g., 1:20.029)
    m = primary.match(/^(\d+):(\d{2})\.(\d{3})$/);
    if (m) return (+m[1]) * 60000 + (+m[2]) * 1000 + (+m[3]);
    
    // SS:mmm (e.g., 59:026)
    m = primary.match(/^(\d{2}):(\d{3})$/);
    if (m) return (+m[1]) * 1000 + (+m[2]);
    
    // SS.mmm (e.g., 59.026)
    m = primary.match(/^(\d{2})\.(\d{3})$/);
    if (m) return (+m[1]) * 1000 + (+m[2]);
    
    // Plain seconds
    m = primary.match(/^(\d+)$/);
    if (m) return (+m[1]) * 1000;
    
    return Number.POSITIVE_INFINITY;
}

/**
 * Set page titles for combined superclass view
 */
function setCombinedDetailTitles(superclass) {
    const pageTitle = document.querySelector('title');
    const detailTrackElem = document.getElementById('detail-track');
    const detailClassElem = document.getElementById('detail-class');
    const subtitleElem = document.getElementById('detail-subtitle');
    
    // Get track name from TRACKS_DATA
    let trackName = trackParam;
    let layoutName = '';
    if (window.TRACKS_DATA && Array.isArray(window.TRACKS_DATA)) {
        const track = window.TRACKS_DATA.find(t => String(t.id) === String(trackParam));
        if (track && track.label) {
            const fullTrack = track.label;
            const match = fullTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
            if (match) {
                trackName = match[1].trim();
                layoutName = match[2].trim();
            } else {
                trackName = fullTrack;
            }
        }
    }
    
    const title = `${trackName} - ${superclass} (Combined)`;
    
    if (pageTitle) pageTitle.textContent = title + ' — RaceRoom Leaderboards';
    if (detailTrackElem) {
        detailTrackElem.innerHTML = `<span class="detail-label">Track:</span> ${R3EUtils.escapeHtml(trackName)}`;
    }
    
    // Add layout element if needed
    if (layoutName) {
        let layoutElem = document.getElementById('detail-layout');
        if (!layoutElem && detailTrackElem) {
            layoutElem = document.createElement('div');
            layoutElem.id = 'detail-layout';
            detailTrackElem.after(layoutElem);
        }
        if (layoutElem) {
            layoutElem.innerHTML = `<span class="detail-label">Layout:</span> ${R3EUtils.escapeHtml(layoutName)}`;
        }
    }
    
    if (detailClassElem) {
        detailClassElem.innerHTML = `<span class="detail-label">Category:</span> ${R3EUtils.escapeHtml(superclass)} (Combined)`;
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
        // Use DataNormalizer for consistent field extraction
        const normalized = DataNormalizer.normalizeLeaderboardEntry(entry, data, index, totalEntries);
        
        // Override car class with firstClassName or defaultClassName if empty
        if (!normalized.CarClass) {
            normalized.CarClass = firstClassName || defaultClassName || '';
        }
        
        return normalized;
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
        let fullTrack = String(data.track_info.Name || data.track_info.name || '');
        // Normalize track name to fix known inconsistencies
        if (fullTrack && window.DataNormalizer && window.DataNormalizer.normalizeTrackName) {
            fullTrack = window.DataNormalizer.normalizeTrackName(fullTrack);
        }
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
            let fullTrack = String(fullTrackRaw || '');
            // Normalize track name to fix known inconsistencies
            if (fullTrack && window.DataNormalizer && window.DataNormalizer.normalizeTrackName) {
                fullTrack = window.DataNormalizer.normalizeTrackName(fullTrack);
            }
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
async function displayResults(data) {
    let results = Array.isArray(data) ? data.slice() : [];
    
    // Sort by position - in combined view, data is already sorted by lap time with proper positions
    // For normal view, sort by the position field
    if (!DetailState.isCombinedView) {
        results.sort((a, b) => {
            const posA = parseInt(a.Position || a.position || a.Pos || 0);
            const posB = parseInt(b.Position || b.position || b.Pos || 0);
            return posA - posB;
        });
    }
    // In combined view, results are already in correct order (sorted by lap time with sequential positions)
    
    if (results.length === 0) {
        // Only show "no results" if enough time has passed since last action
        const timeSinceAction = Date.now() - lastActionTime;
        if (timeSinceAction < 1500) {
            await TemplateHelper.showLoading(resultsContainer);
            // Schedule showing "no results" after the delay
            setTimeout(async () => {
                if (resultsContainer.innerHTML.includes('Loading')) {
                    await TemplateHelper.showNoResults(resultsContainer);
                }
            }, 1500 - timeSinceAction);
            return;
        }
        await TemplateHelper.showNoResults(resultsContainer);
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
    const headers = DetailState.isCombinedView 
        ? ['Position', 'Driver Name', 'Lap Time', 'Class', 'Car', 'Difficulty']
        : ['Position', 'Driver Name', 'Lap Time', 'Car', 'Difficulty'];
    let rowsHtml = '';
    paginatedResults.forEach(item => {
        rowsHtml += renderDetailRow(item, isCarFilterActive);
    });
    const tableHTML = TemplateHelper.generateTable(headers, rowsHtml);
    
    // Pagination
    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML = TemplateHelper.generatePagination({
            startIndex,
            endIndex,
            total: totalResults,
            currentPage,
            totalPages,
            onPageChange: 'goToPage'
        });
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
    // Extract fields using helper functions
    // In combined view, use our re-assigned Position, otherwise extract from item
    const position = DetailState.isCombinedView 
        ? (item.Position || item.position || DataNormalizer.extractPosition(item))
        : DataNormalizer.extractPosition(item);
    const name = DataNormalizer.extractName(item);
    const country = DataNormalizer.extractCountry(item);
    const car = DataNormalizer.extractCar(item);
    const difficulty = DataNormalizer.extractDifficulty(item);
    const lapTime = DataNormalizer.extractLapTime(item);
    
    // In combined view, use total count from allResults, otherwise from item
    const totalEntries = DetailState.isCombinedView 
        ? allResults.length 
        : R3EUtils.getTotalEntriesCount(item);
    const posNum = String(position).trim();
    const totalNum = totalEntries ? String(totalEntries).trim() : '';
    const badgeColor = R3EUtils.getPositionBadgeColor(parseInt(posNum), parseInt(totalNum));
    
    const flag = FlagHelper.countryToFlag(country);
    const flagHtml = flag ? `<span class="country-flag">${flag}</span>` : '';
    const highlisted = item.highlisted || item.Highlisted || false;
    
    // Position details for filtering
    const filteredPos = item.filteredPosition ? String(item.filteredPosition).trim() : null;
    const filteredTotal = item.filteredTotal ? String(item.filteredTotal).trim() : null;
    const absolutePos = item.absolutePosition ? String(item.absolutePosition).trim() : null;
    const absoluteTotal = item.absoluteTotal ? String(item.absoluteTotal).trim() : null;
    
    // Lap time parsing
    const parts = String(lapTime).split(/,\s*/);
    const mainClassic = R3EUtils.formatClassicLapTime(parts[0] || '');
    const deltaRaw = parts.slice(1).join(' ');
    const deltaClassic = deltaRaw ? R3EUtils.formatClassicLapTime(deltaRaw) : '';
    
    // Difficulty class
    const diffStr = String(difficulty).trim().toLowerCase();
    let diffClass = '';
    if (diffStr === 'get real') diffClass = 'difficulty-get-real';
    else if (diffStr === 'amateur') diffClass = 'difficulty-amateur';
    else if (diffStr === 'novice') diffClass = 'difficulty-novice';
    
    // Data attributes
    const rowTrackId = DataNormalizer.extractTrackId(item) || trackParam || '';
    const rowClassId = DataNormalizer.extractClassId(item) || '';
    const rowName = name;
    const rowTime = lapTime;
    
    let html = `<tr data-trackid="${R3EUtils.escapeHtml(String(rowTrackId))}" data-classid="${R3EUtils.escapeHtml(String(rowClassId))}" data-name="${R3EUtils.escapeHtml(String(rowName))}" data-time="${R3EUtils.escapeHtml(String(rowTime))}">`;
    
    // Position
    html += '<td class="pos-cell">';
    
    // When car filter is active, show filtered position in small label
    if (showAbsolutePosition && filteredPos && filteredTotal) {
        html += `<span class="absolute-pos-label">${R3EUtils.escapeHtml(filteredPos)}/${R3EUtils.escapeHtml(filteredTotal)}</span> `;
    }
    
    // Main position display - show absolute position when filter is active, otherwise normal position
    // Note: Position badges use inline styles for dynamic background colors calculated per position
    if (showAbsolutePosition && absolutePos && absoluteTotal) {
        const absoluteBadgeColor = R3EUtils.getPositionBadgeColor(parseInt(absolutePos), parseInt(absoluteTotal));
        const absPos = parseInt(absolutePos);
        const absTotal = parseInt(absoluteTotal);
        const podiumClass = (absTotal >= 4 && (absPos === 1 || absPos === 2 || absPos === 3)) ? ` pos-${absPos}` : '';
        html += `<span class="pos-number${podiumClass}" data-color="${absoluteBadgeColor}" style="background:${absoluteBadgeColor}">${R3EUtils.escapeHtml(absolutePos)}</span>`;
        html += `<span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(absoluteTotal)}</span>`;
    } else {
        const pos = parseInt(posNum);
        const total = parseInt(totalNum);
        const podiumClass = (total >= 4 && (pos === 1 || pos === 2 || pos === 3)) ? ` pos-${pos}` : '';
        html += `<span class="pos-number${podiumClass}" data-color="${badgeColor}" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span>`;
        if (totalNum) {
            html += `<span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(totalNum)}</span>`;
        }
    }
    
    html += '</td>';
    
    // Driver name
    if (!highlisted) {
        const encoded = encodeURIComponent(String(name));
        html += `<td><a class="detail-driver-link" href="index.html?driver=${encoded}">${flagHtml}${R3EUtils.escapeHtml(String(name))}</a></td>`;
    } else {
        html += `<td>${flagHtml}${R3EUtils.escapeHtml(String(name))}</td>`;
    }
    
    // Lap time
    if (deltaClassic) {
        html += `<td class="no-wrap">${R3EUtils.escapeHtml(mainClassic)} <span class="time-delta-inline no-wrap">${R3EUtils.escapeHtml(deltaClassic)}</span></td>`;
    } else {
        html += `<td class="no-wrap">${R3EUtils.escapeHtml(mainClassic)}</td>`;
    }
    
    // Class (only in combined view)
    if (DetailState.isCombinedView) {
        const className = item.ClassName || item.class_name || item.CarClass || item.car_class || '';
        html += `<td class="class-cell">${R3EUtils.escapeHtml(String(className))}</td>`;
    }
    
    // Car
    html += `<td>${R3EUtils.escapeHtml(String(car))}</td>`;
    
    // Difficulty
    html += `<td class="difficulty-cell"><span class="difficulty-pill ${diffClass}">${R3EUtils.escapeHtml(String(difficulty))}</span></td>`;
    
    html += '</tr>';
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
        
        // First try to match by driver/time if provided
        if (driverParam) {
            const dLower = String(driverParam).toLowerCase();
            for (const r of rows) {
                const rName = (r.dataset.name || '').toLowerCase();
                const rTime = String(r.dataset.time || '').trim();
                if (rName === dLower && (!timeParam || rTime === String(timeParam).trim())) {
                    r.classList.add('highlight-row');
                    
                    // Add external link handler for highlighted row
                    const trackId = r.dataset.trackid || trackParam || '';
                    const classId = r.dataset.classid || classParam || '';
                    if (trackId) {
                        const isNumericId = /^\d+$/.test(String(classId));
                        const carClass = isNumericId ? `class-${classId}` : '';
                        const openExternal = (e) => {
                            let url = `https://game.raceroom.com/leaderboard/?track=${encodeURIComponent(trackId)}`;
                            if (carClass) url += `&car_class=${encodeURIComponent(carClass)}`;
                            window.open(url, '_blank');
                        };
                        r.style.cursor = 'pointer';
                        if (!r.dataset.externalClickAdded) {
                            r.addEventListener('click', openExternal);
                            r.dataset.externalClickAdded = '1';
                        }
                        // Prevent driver name links from navigating in highlighted rows
                        const nameLink = r.querySelector('a.detail-driver-link');
                        if (nameLink && !nameLink.dataset.preventDefault) {
                            nameLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openExternal(e);
                            });
                            nameLink.style.cursor = 'pointer';
                            nameLink.dataset.preventDefault = '1';
                        }
                    }
                    
                    // If a position was provided, enforce it visually on the highlighted row
                    if (posParam && !Number.isNaN(posParam)) {
                        const posCell = r.querySelector('td.pos-cell');
                        if (posCell) {
                            const posBadge = posCell.querySelector('.pos-number');
                            const posTotalEl = posCell.querySelector('.pos-total');
                            if (posBadge) {
                                posBadge.textContent = String(posParam);
                                const totalEntries = posTotalEl ? parseInt(posTotalEl.textContent.trim()) : (unfilteredResults?.length || 0);
                                const color = R3EUtils.getPositionBadgeColor(parseInt(posParam), parseInt(totalEntries || 0));
                                posBadge.style.background = color;
                            }
                            if (posTotalEl && (!posTotalEl.textContent || posTotalEl.textContent.trim() === '')) {
                                posTotalEl.textContent = String(unfilteredResults?.length || '');
                            }
                        }
                    }
                    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }
        }

        // Fallback to matching by position number
        for (const r of rows) {
            const posCell = r.querySelector('td.pos-cell');
            if (!posCell) continue;
            
            // Look for the main position badge (pos-number span)
            const posBadge = posCell.querySelector('.pos-number');
            if (!posBadge) continue;
            
            const num = parseInt(posBadge.textContent.trim());
            if (num === targetPos) {
                r.classList.add('highlight-row');
                
                const trackId = r.dataset.trackid || trackParam || '';
                const classId = r.dataset.classid || classParam || '';
                if (trackId) {
                    const isNumericId = /^\d+$/.test(String(classId));
                    const carClass = isNumericId ? `class-${classId}` : '';
                    const openExternal = (e) => {
                        let url = `https://game.raceroom.com/leaderboard/?track=${encodeURIComponent(trackId)}`;
                        if (carClass) url += `&car_class=${encodeURIComponent(carClass)}`;
                        window.open(url, '_blank');
                    };
                    r.style.cursor = 'pointer';
                    if (!r.dataset.externalClickAdded) {
                        r.addEventListener('click', openExternal);
                        r.dataset.externalClickAdded = '1';
                    }
                    // Prevent driver name links from navigating in highlighted rows
                    const nameLink = r.querySelector('a.detail-driver-link');
                    if (nameLink && !nameLink.dataset.preventDefault) {
                        nameLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openExternal(e);
                        });
                        nameLink.style.cursor = 'pointer';
                        nameLink.dataset.preventDefault = '1';
                    }
                }
                // Ensure displayed position matches the requested one when provided
                if (posParam && !Number.isNaN(posParam)) {
                    const posBadge = r.querySelector('td.pos-cell .pos-number');
                    const posTotalEl = r.querySelector('td.pos-cell .pos-total');
                    if (posBadge) {
                        posBadge.textContent = String(posParam);
                        const totalEntries = posTotalEl ? parseInt(posTotalEl.textContent.trim()) : (unfilteredResults?.length || 0);
                        const color = R3EUtils.getPositionBadgeColor(parseInt(posParam), parseInt(totalEntries || 0));
                        posBadge.style.background = color;
                    }
                    if (posTotalEl && (!posTotalEl.textContent || posTotalEl.textContent.trim() === '')) {
                        posTotalEl.textContent = String(unfilteredResults?.length || '');
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
async function displayError(message) {
    await TemplateHelper.showError(
        resultsContainer,
        message,
        'Make sure the data files are available'
    );
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

// ===========================================
// Filter Helpers
// ===========================================

/**
 * Gets selected filter value from UI
 * @param {string} selector - CSS selector for filter UI
 * @param {string} defaultValue - Default value if not found
 * @returns {string} Selected filter value
 */
function getSelectedFilter(selector, defaultValue) {
    const toggle = document.querySelector(`${selector} .custom-select__toggle`);
    return toggle ? toggle.textContent.replace(' ▾', '').trim() : defaultValue;
}

/**
 * Checks if entry matches difficulty filter
 * @param {Object} entry - Data entry
 * @param {string} selectedDifficulty - Selected difficulty
 * @returns {boolean} True if matches
 */
function matchesDifficultyFilter(entry, selectedDifficulty) {
    if (selectedDifficulty === 'All difficulties') return true;
    const diff = getField(entry, FIELD_NAMES.DIFFICULTY);
    return diff.toLowerCase() === selectedDifficulty.toLowerCase();
}

/**
 * Checks if entry matches car filter
 * @param {Object} entry - Data entry
 * @param {string} selectedCar - Selected car
 * @returns {boolean} True if matches
 */
function matchesCarFilter(entry, selectedCar) {
    if (selectedCar === 'All cars') return true;
    const car = getField(entry, FIELD_NAMES.CAR);
    return car === selectedCar;
}

/**
 * Filter and display results by difficulty and car
 */
function filterAndDisplayResults() {
    lastActionTime = Date.now();
    
    const selectedDifficulty = getSelectedFilter('#difficulty-filter-ui', 'All difficulties');
    const selectedCar = getSelectedFilter('#car-filter-ui', 'All cars');
    
    // Apply both filters using helper functions
    allResults = unfilteredResults.filter(entry => {
        return matchesDifficultyFilter(entry, selectedDifficulty) && 
               matchesCarFilter(entry, selectedCar);
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
