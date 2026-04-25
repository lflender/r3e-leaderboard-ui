/**
 * Detail page script for RaceRoom Leaderboards
 * Refactored to use modular architecture
 */

// ===========================================
// State Management
// ===========================================
const DETAIL_DIFFICULTY_PREFERENCE_KEY = 'detailDifficultyPreference';

function loadDifficultyPreferenceFromLocalStorage() {
    try {
        const saved = localStorage.getItem(DETAIL_DIFFICULTY_PREFERENCE_KEY);
        return typeof saved === 'string' ? saved.trim() : '';
    } catch (e) {
        console.warn('localStorage not available:', e);
        return '';
    }
}

function saveDifficultyPreferenceToLocalStorage(difficultyLabel) {
    try {
        const value = String(difficultyLabel || 'All difficulties').trim() || 'All difficulties';
        localStorage.setItem(DETAIL_DIFFICULTY_PREFERENCE_KEY, value);
    } catch (e) {
        console.warn('Could not save detail difficulty preference:', e);
    }
}

function getInitialDifficultyParam() {
    const urlDifficulty = String(R3EUtils.getUrlParam('difficulty') || '').trim();
    if (urlDifficulty && urlDifficulty.toLowerCase() !== 'all difficulties') {
        return urlDifficulty;
    }

    const savedDifficulty = loadDifficultyPreferenceFromLocalStorage();
    return savedDifficulty || 'All difficulties';
}

const DetailState = {
    // URL Parameters
    trackParam: R3EUtils.getUrlParam('track'),
    classParam: R3EUtils.getUrlParam('class'),
    carParam: R3EUtils.getUrlParam('car'),
    superclassParam: R3EUtils.getUrlParam('superclass'), // For combined view
    classesParam: R3EUtils.getUrlParam('classes'), // For specific multi-class categories (comma-separated IDs)
    posParam: parseInt(R3EUtils.getUrlParam('pos') || ''),
    difficultyParam: getInitialDifficultyParam(),
    driverParam: R3EUtils.getUrlParam('driver') || '',
    timeParam: R3EUtils.getUrlParam('time') || '',
    
    // State
    posApplied: false,
    currentPage: 1,
    itemsPerPage: 100,
    allResults: [],
    unfilteredResults: [],
    carFilterSelect: null,
    activeDifficulties: new Set(['Get Real', 'Amateur', 'Novice']),
    availableCars: [],
    lastActionTime: 0,
    isCombinedView: false, // True when showing combined superclass data
    carDistributionExpanded: false,
    entriesDistributionExpanded: false,
    timeframeStart: null,
    timeframeEnd: null
};

// Backward compatibility - keep old variable names pointing to DetailState
const trackParam = DetailState.trackParam;
const classParam = DetailState.classParam;
const carParam = DetailState.carParam;
const superclassParam = DetailState.superclassParam;
const classesParam = DetailState.classesParam;
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
let activeDifficulties = DetailState.activeDifficulties;
let availableCars = DetailState.availableCars;
let lastActionTime = DetailState.lastActionTime;
let hasTrackedDetailUrlView = false;
const difficultyFilter = window.R3EDetailDifficultyFilter.create({
    escapeHtml: R3EUtils.escapeHtml
});

function trackDetailUrlView() {
    if (hasTrackedDetailUrlView) return;
    if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;

    R3EAnalytics.track('detail page shown', {
        track_id: trackParam || '',
        class_param: classParam || '',
        classes_param: classesParam || '',
        superclass_param: superclassParam || '',
        car_param: carParam || '',
        pos_param: Number.isNaN(posParam) ? '' : (posParam || ''),
        driver_param: driverParam || '',
        time_param: timeParam || '',
        difficulty_param: difficultyParam || '',
        is_combined_view: !!(classesParam || superclassParam)
    });

    hasTrackedDetailUrlView = true;
}

function trackDetailFilter(selectedDifficulty, selectedCar, resultCount) {
    if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
    R3EAnalytics.track('detail filter changed', {
        track_id: trackParam || '',
        class_param: classParam || '',
        classes_param: classesParam || '',
        superclass_param: superclassParam || '',
        car_param: carParam || '',
        selected_difficulty: selectedDifficulty || 'All difficulties',
        selected_car: selectedCar || 'All cars',
        result_count: resultCount || 0,
        is_combined_view: !!DetailState.isCombinedView
    });
}

// ===========================================
// Initialize
// ===========================================
const resultsContainer = document.getElementById('detail-results-container');

// Track detail page view from URL params as soon as script runs.
trackDetailUrlView();

// Fetch and display data
fetchLeaderboardDetails();

// ===========================================
// Main Fetch Function
// ===========================================

async function fetchLeaderboardDetails() {
    await TemplateHelper.showLoading(resultsContainer);
    
    try {
        // Check if we're in specific multi-class mode (e.g., GT3 MP with specific class IDs)
        if (classesParam && trackParam) {
            DetailState.isCombinedView = true;
            await fetchSpecificClassesDetails();
            return;
        }
        
        // Check if we're in combined superclass mode
        if (superclassParam && trackParam) {
            DetailState.isCombinedView = true;
            await fetchCombinedSuperclassDetails();
            return;
        }
        
        const data = await dataService.fetchLeaderboardDetails(trackParam, classParam);
        
        // Extract leaderboard array from data structure
        const leaderboardData = dataService.extractLeaderboardArray(data);
        
        if (!leaderboardData || !Array.isArray(leaderboardData)) {
            throw new Error('Leaderboard data not found in the expected format');
        }
        
        // Transform data to consistent format
        const transformedData = transformLeaderboardData(leaderboardData, data);
        
        // Set page titles
        setDetailTitles(data, trackParam, classParam);
        
        await dataService.enrichEntriesWithDriverMetadata(transformedData);

        // Store unfiltered results
        unfilteredResults = transformedData;
        
        // Build car filter from data
        buildCarFilter(transformedData);
        
        // Apply initial difficulty state from URL param or persisted preference.
        allResults = applyInitialDifficultyFilter(transformedData);

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
 * Resolve multiple class names to their numeric IDs using static mapping
 * @param {string[]} classNames - Array of class names
 * @returns {Promise<Map<string, number|null>>} Map of className -> classId
 */
async function resolveClassNamesToIds(classNames) {
    const result = new Map();
    if (!classNames || classNames.length === 0) return result;

    // Use the fast static lookup from car-classes.js
    if (window.getCarClassId) {
        classNames.forEach(name => {
            const classId = window.getCarClassId(name);
            result.set(name, classId ? Number(classId) : null);
        });
        return result;
    }

    // Fallback: scan driver index (slow path, should not be needed)
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
 * Fetch combined leaderboard details for specific class IDs (multi-class categories)
 */
async function fetchSpecificClassesDetails() {
    try {
        // Keep showing loading state during the entire fetch
        await TemplateHelper.showLoading(resultsContainer);
        
        // Update lastActionTime to prevent premature "no results" display
        lastActionTime = Date.now();
        
        // Parse comma-separated class IDs
        const specificClassIds = classesParam.split(',').map(id => id.trim()).filter(id => id);
        
        if (specificClassIds.length === 0) {
            throw new Error('No valid class IDs provided');
        }

        const classSpecs = specificClassIds.map(classId => ({
            classId,
            className: window.getCarClassName ? window.getCarClassName(classId) : classId
        }));

        const allEntries = await dataService.buildCombinedLeaderboard(trackParam, classSpecs);
        
        // Set page titles for specific classes view
        setSpecificClassesDetailTitles(specificClassIds);
        
        await dataService.enrichEntriesWithDriverMetadata(allEntries);

        // Store unfiltered results
        unfilteredResults = allEntries;
        
        // Build car filter from data
        buildCarFilter(allEntries);
        
        // Apply initial difficulty state from URL param or persisted preference.
        allResults = applyInitialDifficultyFilter(allEntries);

        // Calculate page and display
        currentPage = 1;
        let targetIdx = -1;
        if (driverParam) {
            const dLower = String(driverParam).toLowerCase();
            targetIdx = allResults.findIndex(entry => {
                const n = String(entry.DriverName || entry['Driver Name'] || entry.driver_name || entry.Driver || entry.driver || '').toLowerCase();
                return n.includes(dLower);
            });
        } else if (timeParam) {
            targetIdx = allResults.findIndex(entry => {
                const lt = String(entry.LapTime || entry['Lap Time'] || entry.lap_time || '');
                return lt.includes(timeParam);
            });
        } else if (!isNaN(posParam) && posParam > 0) {
            targetIdx = allResults.findIndex(entry => {
                const p = parseInt(entry.Position || entry.position || entry.Pos || 0);
                return p === posParam;
            });
        }
        
        if (targetIdx !== -1) {
            currentPage = Math.floor(targetIdx / itemsPerPage) + 1;
        }
        
        await displayResults(allResults);
        
    } catch (error) {
        console.error('Error fetching specific classes details:', error);
        await TemplateHelper.showError(resultsContainer, 'Failed to load leaderboard data. Please try again later.');
    }
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

        const classSpecs = superclassClasses
            .map(className => ({
                classId: classIdMap.get(className),
                className
            }))
            .filter(spec => spec.classId !== null && spec.classId !== undefined);

        if (classSpecs.length === 0) {
            throw new Error('No class IDs resolved for superclass: ' + superclassParam);
        }

        const allEntries = await dataService.buildCombinedLeaderboard(trackParam, classSpecs);
        
        // Set page titles for combined view
        setCombinedDetailTitles(superclassParam);
        
        await dataService.enrichEntriesWithDriverMetadata(allEntries);

        // Store unfiltered results
        unfilteredResults = allEntries;
        
        // Build car filter from data
        buildCarFilter(allEntries);
        
        // Apply initial difficulty state from URL param or persisted preference.
        allResults = applyInitialDifficultyFilter(allEntries);

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
 * Set page titles for combined superclass view
 */
function splitTrackAndLayout(fullTrack) {
    const safeTrack = String(fullTrack || '').trim();
    if (!safeTrack) {
        return { trackName: '', layoutName: '' };
    }

    const match = safeTrack.match(/^(.*?)(?:\s*[-–—]\s*)(.+)$/);
    if (match) {
        return {
            trackName: match[1].trim(),
            layoutName: match[2].trim()
        };
    }

    return { trackName: safeTrack, layoutName: '' };
}

function resolveTrackAndLayoutFromTracksData(trackId, fallbackTrackName = '') {
    let resolvedName = fallbackTrackName || trackId || '';
    let resolvedLayout = '';

    if (window.TRACKS_DATA && Array.isArray(window.TRACKS_DATA)) {
        const track = window.TRACKS_DATA.find(t => String(t.id) === String(trackId));
        if (track && track.label) {
            const parts = splitTrackAndLayout(track.label);
            resolvedName = parts.trackName || resolvedName;
            resolvedLayout = parts.layoutName || '';
        }
    }

    return {
        trackName: resolvedName,
        layoutName: resolvedLayout
    };
}

function renderDetailHeader({ pageTitleText, trackName, layoutName, detailClassHtml }) {
    const pageTitleElem = document.querySelector('title');
    const detailTrackElem = document.getElementById('detail-track');
    const detailClassElem = document.getElementById('detail-class');

    if (pageTitleElem) {
        pageTitleElem.textContent = `${pageTitleText} - RaceRoom Leaderboards`;
    }

    // Remove any separately-created layout element (old pattern)
    const oldLayoutElem = document.getElementById('detail-layout');
    if (oldLayoutElem) oldLayoutElem.remove();

    if (detailTrackElem) {
        const trackLogoUrl = (window.R3ETrackImages && typeof window.R3ETrackImages.resolveTrackLogoById === 'function')
            ? window.R3ETrackImages.resolveTrackLogoById(trackParam)
            : '';
        const trackLogoHtml = trackLogoUrl
            ? `<img class="detail-track-logo" src="${R3EUtils.escapeHtml(trackLogoUrl)}" alt="${R3EUtils.escapeHtml(trackName)} logo" title="${R3EUtils.escapeHtml(trackName)}" loading="lazy" decoding="async" />`
            : '';
        const layoutHtml = layoutName
            ? `<span class="detail-track-layout">${R3EUtils.escapeHtml(layoutName)}</span>`
            : '';
        detailTrackElem.innerHTML = `${trackLogoHtml}<span class="detail-track-name">${R3EUtils.escapeHtml(trackName)}</span>${layoutHtml}`;
    }

    if (detailClassElem) {
        detailClassElem.innerHTML = detailClassHtml;
    }
}

/**
/**
 * Build a row of class logos for multi-class/combined views.
 * Returns an HTML string of <img> elements, or '' if no logos can be resolved.
 * @param {Array<{className: string, classId: string|number|null}>} specs
 * @returns {string}
 */
function buildClassLogosHtml(specs) {
    if (!window.R3EUtils || typeof window.R3EUtils.resolveCarClassLogo !== 'function') return '';
    const imgs = specs
        .map(({ className, classId }) => {
            const url = window.R3EUtils.resolveCarClassLogo(className, classId);
            if (!url) return '';
            return `<img class="detail-class-logo" src="${R3EUtils.escapeHtml(url)}" alt="${R3EUtils.escapeHtml(className)} class logo" title="${R3EUtils.escapeHtml(className)}" loading="lazy" decoding="async" />`;
        })
        .filter(Boolean);
    return imgs.join('');
}

/**
 * Set detail page titles for specific classes view
 */
function setSpecificClassesDetailTitles(classIds) {
    const { trackName, layoutName } = resolveTrackAndLayoutFromTracksData(trackParam, trackParam);
    
    // Determine the category label
    const sortedIds = [...classIds].sort().join(',');
    const isGT3MP = sortedIds === '1703,12770,13136' || sortedIds === '12770,13136,1703' || sortedIds === '1703,13136,12770';
    const isAudiTTCup = sortedIds === '4680,5726' || sortedIds === '5726,4680';
    const isPorscheCup = sortedIds === '12015,12969' || sortedIds === '12969,12015';
    const categoryLabel = isGT3MP ? 'GT3 MP' : isAudiTTCup ? 'Audi TT Cup' : isPorscheCup ? 'Porsche Cup' : 'Multi-Class';
    
    const title = `${trackName} - ${categoryLabel}`;

    const specs = classIds.map(classId => ({
        className: window.getCarClassName ? window.getCarClassName(classId) : classId,
        classId
    }));
    const logosHtml = buildClassLogosHtml(specs);
    const detailClassHtml = logosHtml
        ? `<span class="detail-class-logos">${logosHtml}</span>`
        : R3EUtils.escapeHtml(categoryLabel);

    renderDetailHeader({
        pageTitleText: title,
        trackName,
        layoutName,
        detailClassHtml
    });
}

function setCombinedDetailTitles(superclass) {
    const { trackName, layoutName } = resolveTrackAndLayoutFromTracksData(trackParam, trackParam);
    
    const title = `${trackName} - ${superclass} (Combined)`;

    // Resolve class names from CARS_DATA for this superclass
    const specs = [];
    if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
        const seen = new Set();
        window.CARS_DATA.forEach(entry => {
            if (entry.superclass === superclass) {
                const cls = entry.class || entry.car_class || entry.CarClass || '';
                if (cls && !seen.has(cls)) {
                    seen.add(cls);
                    const classId = window.getCarClassId ? window.getCarClassId(cls) : null;
                    specs.push({ className: cls, classId });
                }
            }
        });
    }
    const logosHtml = buildClassLogosHtml(specs);
    const detailClassHtml = logosHtml
        ? `<span class="detail-class-logos">${logosHtml}</span>`
        : R3EUtils.escapeHtml(superclass);

    renderDetailHeader({
        pageTitleText: title,
        trackName,
        layoutName,
        detailClassHtml
    });
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
    let carClassId = '';
    
    // Try to get info from track_info
    if (data.track_info && typeof data.track_info === 'object') {
        let fullTrack = String(data.track_info.Name || data.track_info.name || '');
        // Normalize track name to fix known inconsistencies
        if (fullTrack && window.DataNormalizer && window.DataNormalizer.normalizeTrackName) {
            fullTrack = window.DataNormalizer.normalizeTrackName(fullTrack);
        }
        if (fullTrack && fullTrack !== '') {
            const parts = splitTrackAndLayout(fullTrack);
            trackName = parts.trackName || trackName;
            layoutName = parts.layoutName || '';
        }
        carClassName = data.track_info.ClassName || data.track_info.class_name || '';
        carClassId = data.track_info.ClassId || data.track_info.class_id || data.track_info.classid || '';
    }
    
    // Fallback to results array
    if (!trackName || trackName === trackParam || !carClassName) {
        const results = dataService.extractLeaderboardArray(data);
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
                const parts = splitTrackAndLayout(fullTrack);
                trackName = parts.trackName || trackName;
                layoutName = parts.layoutName || '';
            }
            if (!carClassName) {
                carClassName = first?.car_class?.class?.Name || first?.car_class?.class?.name || 
                              first.CarClass || first['Car Class'] || '';
            }
            if (!carClassId) {
                carClassId = first?.car_class?.class?.Id || first?.car_class?.class?.id ||
                             first?.car_class?.Id || first?.car_class?.id ||
                             first.ClassId || first.class_id || first.classId || '';
            }
        }
    }
    
    if (!carClassName) carClassName = classParam || '';
    
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
    
    const classLogoUrl = (window.R3EUtils && typeof window.R3EUtils.resolveCarClassLogo === 'function')
        ? window.R3EUtils.resolveCarClassLogo(carClassName, carClassId)
        : '';
    const classLogoHtml = classLogoUrl
        ? `<img class="detail-class-logo" src="${R3EUtils.escapeHtml(classLogoUrl)}" alt="${R3EUtils.escapeHtml(carClassName)} class logo" loading="lazy" decoding="async" />`
        : '';

    renderDetailHeader({
        pageTitleText: `${trackName} - ${carClassName}`,
        trackName,
        layoutName,
        detailClassHtml: `${classLogoHtml}<span class="detail-class-name">${R3EUtils.escapeHtml(carClassName)}</span>`
    });
}

/**
 * Display results
 * @param {Array} data - Results data
 */
async function displayResults(data) {
    const baseResults = Array.isArray(data) ? data.slice() : [];
    let results = baseResults.slice();

    preserveDistributionExpandedState();
    updateTimeframeBoundsFromResults(results);

    results = DetailEntriesDist.applyTimeframeFilter(results, DetailState.timeframeStart, DetailState.timeframeEnd);
    
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
        if (baseResults.length > 0) {
            renderEmptyTimeframeState(baseResults, results);
            bindEntriesDistributionInteractions();
            return;
        }

        // Data exists but active filters produced no matches — keep filters visible
        if (unfilteredResults.length > 0) {
            rescueFiltersToStash();
            resultsContainer.innerHTML = `<div class="detail-filters-slot"></div><p class="no-results">No entries match the selected filters.</p>`;
            moveFiltersIntoSlot();
            return;
        }

        await showNoResultsWithActionDelay();
        return;
    }
    
    // Pagination
    const totalResults = results.length;
    const totalPages = Math.ceil(totalResults / itemsPerPage);
    currentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
    
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
    
    const isCarFilterActive = isCarFilterCurrentlyActive();
    
    // Add filtered and absolute position data when car filter is active
    if (isCarFilterActive) {
        annotateFilteredAndAbsolutePositions(paginatedResults, startIndex, totalResults);
    }
    
    // Create table headers using ColumnConfig for consistency.
    // GapTime is a detail-page pseudo column rendered from LapTime delta.
    const baseColumns = ['Position', 'Name', 'LapTime', 'GapTime', 'GapPercent', 'Car', 'Difficulty', 'date_time'];
    const columnsWithClass = ['Position', 'Name', 'LapTime', 'GapTime', 'GapPercent', 'CarClass', 'Car', 'Difficulty', 'date_time'];
    const columnKeys = DetailState.isCombinedView ? columnsWithClass : baseColumns;
    
    // Get display names from ColumnConfig
    const headers = columnKeys.map(key => {
        if (key === 'Name') return 'Driver'; // Special case for detail page
        if (key === 'GapTime') return 'Gap';
        return window.ColumnConfig ? window.ColumnConfig.getDisplayName(key) : key;
    });
    
    let rowsHtml = '';
    paginatedResults.forEach(item => {
        rowsHtml += tableRenderer.renderDetailRow(item, {
            showAbsolutePosition: isCarFilterActive,
            isCombinedView: DetailState.isCombinedView,
            allResultsLength: allResults.length,
            trackParam,
            DataNormalizer,
            R3EUtils,
            tableRenderer
        });
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
    
    const tableWrapperHTML = `<div class="table-scroll-wrapper">${tableHTML}</div>`;
    
    const entriesDistHTML = DetailEntriesDist.generateHtml(
        results,
        DetailState.entriesDistributionExpanded,
        DetailState.timeframeStart,
        DetailState.timeframeEnd,
        baseResults,
        DetailState
    );

    // Add car distribution summary if multiple cars present
    if (availableCars.length > 1) {
        // Default sort: entries (desc), median (asc)
        let defaultSortBy = 'entries';
        let defaultSortDir = 'desc';
        if (defaultSortBy === 'median') {
            defaultSortDir = 'asc';
        }
        const summaryHTML = DetailCarDist.generateHtml(
            allResults,
            defaultSortBy,
            defaultSortBy === 'median' ? 'asc' : 'desc',
            DetailState.carDistributionExpanded
        );
        rescueFiltersToStash();
        tableRenderer.renderDetailSections(resultsContainer, summaryHTML, entriesDistHTML, paginationHTML, tableWrapperHTML);
        moveFiltersIntoSlot();
        bindCarDistributionToggle();
        bindEntriesDistributionInteractions();
        bindCarDistributionSortHandlers({
            allResults,
            filteredResults: results,
            baseResults,
            paginationHTML,
            tableWrapperHTML
        });
    } else if (entriesDistHTML) {
        rescueFiltersToStash();
        tableRenderer.renderDetailSections(resultsContainer, '', entriesDistHTML, paginationHTML, tableWrapperHTML);
        moveFiltersIntoSlot();
        bindEntriesDistributionInteractions();
    } else {
        rescueFiltersToStash();
        tableRenderer.renderDetailSections(resultsContainer, '', '', paginationHTML, tableWrapperHTML);
        moveFiltersIntoSlot();
    }
    
    // Highlight position row if needed
    if (posParam && !Number.isNaN(posParam)) {
        highlightPositionRow(posParam);
    }
}

/**
 * Move #car-filter-ui and #difficulty-filter-ui back to the stash so they
 * survive the upcoming resultsContainer innerHTML replacement.
 */
function rescueFiltersToStash() {
    const stash = document.getElementById('detail-filters-stash');
    if (!stash) return;
    const carFilter = document.getElementById('car-filter-ui');
    const diffFilter = document.getElementById('difficulty-filter-ui');
    if (carFilter && !stash.contains(carFilter)) stash.appendChild(carFilter);
    if (diffFilter && !stash.contains(diffFilter)) stash.appendChild(diffFilter);
}

/**
 * Move #car-filter-ui and #difficulty-filter-ui from their stash into the
 * .detail-filters-slot placeholder that renderDetailSections inserts.
 */
function moveFiltersIntoSlot() {
    const slot = resultsContainer.querySelector('.detail-filters-slot');
    if (!slot) return;
    const carFilter = document.getElementById('car-filter-ui');
    const diffFilter = document.getElementById('difficulty-filter-ui');
    if (carFilter) slot.appendChild(carFilter);
    if (diffFilter) slot.appendChild(diffFilter);
    slot.classList.add('detail-filters-row');
}

function preserveDistributionExpandedState() {    const existingCarDistContent = resultsContainer.querySelector('.car-dist-content');
    if (existingCarDistContent) {
        DetailState.carDistributionExpanded = existingCarDistContent.style.display !== 'none';
    }

    const existingEntriesDistContent = resultsContainer.querySelector('.entries-dist-content');
    if (existingEntriesDistContent) {
        DetailState.entriesDistributionExpanded = existingEntriesDistContent.style.display !== 'none';
    }
}

function updateTimeframeBoundsFromResults(results) {
    const bounds = DetailEntriesDist.getDataTimeBounds(results);
    if (bounds) {
        if (!DetailState.timeframeStart) {
            DetailState.timeframeStart = DetailEntriesDist.toLocalDateInputValue(bounds.min);
        }
        if (!DetailState.timeframeEnd) {
            DetailState.timeframeEnd = DetailEntriesDist.toLocalDateInputValue(bounds.max);
        }
    } else {
        DetailState.timeframeStart = null;
        DetailState.timeframeEnd = null;
    }
}

function renderEmptyTimeframeState(baseResults, filteredResults) {
    const emptyEntriesDistHTML = DetailEntriesDist.generateHtml(
        filteredResults,
        DetailState.entriesDistributionExpanded,
        DetailState.timeframeStart,
        DetailState.timeframeEnd,
        baseResults,
        DetailState
    );
    rescueFiltersToStash();
    resultsContainer.innerHTML = `${emptyEntriesDistHTML}<div class="detail-filters-slot"></div><div class="no-results">No entries found for the selected timeframe.</div>`;
    moveFiltersIntoSlot();
}

async function showNoResultsWithActionDelay() {
    const timeSinceAction = Date.now() - lastActionTime;
    if (timeSinceAction < 1500) {
        await TemplateHelper.showLoading(resultsContainer);
        setTimeout(async () => {
            if (resultsContainer.innerHTML.includes('Loading')) {
                await TemplateHelper.showNoResults(resultsContainer);
            }
        }, 1500 - timeSinceAction);
        return;
    }
    await TemplateHelper.showNoResults(resultsContainer);
}

function isCarFilterCurrentlyActive() {
    const carToggle = document.querySelector('#car-filter-ui .custom-select__toggle');
    const selectedCar = carToggle ? carToggle.textContent.replace(' ▾', '').trim() : 'All cars';
    return selectedCar !== 'All cars';
}

function annotateFilteredAndAbsolutePositions(paginatedResults, startIndex, totalResults) {
    paginatedResults.forEach((item, filteredIndex) => {
        const actualFilteredIndex = startIndex + filteredIndex;
        item.filteredPosition = actualFilteredIndex + 1;
        item.filteredTotal = totalResults;

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

function bindCarDistributionToggle() {
    const toggleBtn = resultsContainer.querySelector('.car-dist-toggle');
    const summaryTable = resultsContainer.querySelector('.car-dist-content');
    if (toggleBtn && summaryTable) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = summaryTable.style.display === 'none';
            summaryTable.style.display = isCollapsed ? '' : 'none';
            toggleBtn.classList.toggle('expanded', isCollapsed);
            toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
            DetailState.carDistributionExpanded = isCollapsed;
        });
    }
}

function bindEntriesDistributionInteractions() {
    const toggleBtn = resultsContainer.querySelector('.entries-dist-toggle');
    const content = resultsContainer.querySelector('.entries-dist-content');
    if (toggleBtn && content) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? '' : 'none';
            toggleBtn.classList.toggle('expanded', isCollapsed);
            toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
            DetailState.entriesDistributionExpanded = isCollapsed;
        });
    }

    const startInput = resultsContainer.querySelector('.entries-timeframe-start');
    const endInput = resultsContainer.querySelector('.entries-timeframe-end');
    const lastWeekBtn = resultsContainer.querySelector('.entries-timeframe-last-week');

    if (startInput) {
        startInput.addEventListener('input', () => {
            if (!startInput.value) return;
            DetailState.timeframeStart = startInput.value;
            if (DetailState.timeframeEnd && startInput.value > DetailState.timeframeEnd) {
                DetailState.timeframeEnd = startInput.value;
            }
            currentPage = 1;
            displayResults(allResults);
        });
    }

    if (endInput) {
        endInput.addEventListener('input', () => {
            if (!endInput.value) return;
            DetailState.timeframeEnd = endInput.value;
            if (DetailState.timeframeStart && endInput.value < DetailState.timeframeStart) {
                DetailState.timeframeStart = endInput.value;
            }
            currentPage = 1;
            displayResults(allResults);
        });
    }

    if (lastWeekBtn) {
        lastWeekBtn.addEventListener('click', () => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            DetailState.timeframeStart = DetailEntriesDist.toLocalDateInputValue(weekAgo);
            DetailState.timeframeEnd = DetailEntriesDist.toLocalDateInputValue(now);
            currentPage = 1;
            displayResults(allResults);
        });
    }
}

function bindCarDistributionSortHandlers({ allResults, filteredResults, baseResults, paginationHTML, tableWrapperHTML }) {
    const sortHeaders = resultsContainer.querySelectorAll('.car-dist-table th.sortable');
    sortHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const summaryDiv = resultsContainer.querySelector('.car-dist-summary');
            const currentSort = summaryDiv.getAttribute('data-sort-by');
            const currentDir = summaryDiv.getAttribute('data-sort-dir');
            const clickedSort = header.getAttribute('data-sort');

            const currentContent = resultsContainer.querySelector('.car-dist-content');
            const isExpanded = currentContent && currentContent.style.display !== 'none';
            const currentEntriesContent = resultsContainer.querySelector('.entries-dist-content');
            const entriesExpanded = currentEntriesContent && currentEntriesContent.style.display !== 'none';
            DetailState.carDistributionExpanded = isExpanded;
            DetailState.entriesDistributionExpanded = entriesExpanded;

            let newDir;
            if (currentSort !== clickedSort) {
                newDir = clickedSort === 'median' ? 'asc' : 'desc';
            } else {
                newDir = currentDir === 'desc' ? 'asc' : 'desc';
            }

            const newSummaryHTML = DetailCarDist.generateHtml(allResults, clickedSort, newDir, isExpanded);
            const newEntriesHTML = DetailEntriesDist.generateHtml(
                filteredResults,
                entriesExpanded,
                DetailState.timeframeStart,
                DetailState.timeframeEnd,
                baseResults,
                DetailState
            );

            rescueFiltersToStash();
            tableRenderer.renderDetailSections(resultsContainer, newSummaryHTML, newEntriesHTML, paginationHTML, tableWrapperHTML);
            moveFiltersIntoSlot();
            bindCarDistributionToggle();
            bindEntriesDistributionInteractions();
            bindCarDistributionSortHandlers({
                allResults,
                filteredResults,
                baseResults,
                paginationHTML,
                tableWrapperHTML
            });
        });
    });
}

function attachHighlightedRowExternalLink(row) {
    const trackId = row.dataset.trackid || trackParam || '';
    const classId = row.dataset.classid || classParam || '';
    if (!trackId) {
        return;
    }

    const isNumericId = /^\d+$/.test(String(classId));
    const carClass = isNumericId ? `class-${classId}` : '';
    const openExternal = () => {
        let url = `https://game.raceroom.com/leaderboard/?track=${encodeURIComponent(trackId)}`;
        if (carClass) {
            url += `&car_class=${encodeURIComponent(carClass)}`;
        }
        window.open(url, '_blank');
    };

    row.style.cursor = 'pointer';
    if (!row.dataset.externalClickAdded) {
        row.addEventListener('click', openExternal);
        row.dataset.externalClickAdded = '1';
    }

    const nameLink = row.querySelector('a.detail-driver-link');
    if (nameLink && !nameLink.dataset.preventDefault) {
        nameLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openExternal();
        });
        nameLink.style.cursor = 'pointer';
        nameLink.dataset.preventDefault = '1';
    }
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
                    attachHighlightedRowExternalLink(r);
                    
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
                attachHighlightedRowExternalLink(r);
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

    if (typeof R3EAnalytics !== 'undefined' && typeof R3EAnalytics.track === 'function') {
        const totalPages = Math.max(1, Math.ceil((allResults || []).length / itemsPerPage));
        R3EAnalytics.track('detail pagination changed', {
            page_number: currentPage,
            total_pages: totalPages,
            result_count: (allResults || []).length,
            track_id: trackParam || '',
            class_param: classParam || '',
            classes_param: classesParam || '',
            superclass_param: superclassParam || '',
            is_combined_view: !!DetailState.isCombinedView
        });
    }
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
            { value: '', label: 'All cars' }
        ];
        
        // If in combined view, find all car combinations
        let carCombinations = [];
        if (DetailState.isCombinedView) {
            carCombinations = R3EUtils.findCarCombinations(availableCars);
        }
        
        // Build the list with combined options inserted after their models
        const addedCombinations = new Set(); // Track which combinations we've already added
        
        availableCars.forEach((car, index) => {
            // Add the car itself
            const logoUrl = (typeof R3EUtils.resolveBrandLogoPath === 'function')
                ? R3EUtils.resolveBrandLogoPath(car)
                : '';
            carOptions.push({ value: car, label: car, logoUrl: logoUrl || undefined });
            
            // Check if there's a combination for this car
            const combo = R3EUtils.findCombinationForCar(car, carCombinations);
            if (combo && !addedCombinations.has(combo.value)) {
                // Only add if this is the last car in the group
                const last = R3EUtils.isLastInCarGroup(car, availableCars, index);
                if (last) {
                    carOptions.push({ value: combo.value, label: combo.label });
                    addedCombinations.add(combo.value);
                }
            }
        });
        
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
    // Use the actual value from the CustomSelect component, not the label text
    if (selector === '#car-filter-ui' && carFilterSelect) {
        const value = carFilterSelect.getValue();
        return value === '' ? 'All cars' : value;
    }
    // Fallback to reading button text (backward compatibility)
    const toggle = document.querySelector(`${selector} .custom-select__toggle`);
    return toggle ? toggle.textContent.replace(' ▾', '').trim() : defaultValue;
}

function normalizeDifficultyForPreference(value) {
    if (window.R3EDetailDifficultyFilter && typeof window.R3EDetailDifficultyFilter.normalizeDifficultyName === 'function') {
        return window.R3EDetailDifficultyFilter.normalizeDifficultyName(value);
    }
    return String(value || '').trim();
}

function matchesDifficultyPreference(entry, selectedDifficultyLabel) {
    const label = String(selectedDifficultyLabel || '').trim();
    if (!label || label === 'All difficulties') return true;

    const selectedDifficulties = label
        .split(',')
        .map(part => normalizeDifficultyForPreference(part))
        .filter(Boolean);

    if (selectedDifficulties.length === 0) return true;

    const selectedSet = new Set(selectedDifficulties);
    const diff = getField(entry, FIELD_NAMES.DIFFICULTY);
    const normalizedDiff = normalizeDifficultyForPreference(diff);
    return normalizedDiff ? selectedSet.has(normalizedDiff) : false;
}

function applyInitialDifficultyFilter(entries) {
    const list = Array.isArray(entries) ? entries : [];
    return list.filter(entry => matchesDifficultyPreference(entry, difficultyParam));
}

/**
 * Checks if entry matches difficulty filter
 * @param {Object} entry - Data entry
 * @param {string} selectedDifficulty - Selected difficulty
 * @returns {boolean} True if matches
 */
function matchesDifficultyFilter(entry, selectedDifficulties) {
    if (!selectedDifficulties || difficultyFilter.isAllActive()) return true;
    const diff = getField(entry, FIELD_NAMES.DIFFICULTY);
    return difficultyFilter.isDifficultyActive(diff);
}

/**
 * Checks if entry matches car filter
 * @param {Object} entry - Data entry
 * @param {string} selectedCar - Selected car
 * @returns {boolean} True if matches
 */
function matchesCarFilter(entry, selectedCar) {
    const car = getField(entry, FIELD_NAMES.CAR);
    return R3EUtils.matchesCarFilterValue(car, selectedCar);
}

/**
 * Filter and display results by difficulty and car
 */
function filterAndDisplayResults(source = 'system') {
    lastActionTime = Date.now();
    
    const selectedDifficulty = difficultyFilter.getActiveDifficultyLabel();
    const selectedCar = getSelectedFilter('#car-filter-ui', 'All cars');
    
    // Apply both filters using helper functions
    allResults = unfilteredResults.filter(entry => {
        return matchesDifficultyFilter(entry, activeDifficulties) && 
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

    if (source === 'user') {
        trackDetailFilter(selectedDifficulty, selectedCar, allResults.length);
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
        filterAndDisplayResults('user');
    });
    DetailState.carFilterSelect = carFilterSelect;

    const difficultyContainer = document.getElementById('difficulty-filter-ui');
    difficultyFilter.initializeFromParam(difficultyParam);
    activeDifficulties = difficultyFilter.getActiveDifficulties();
    DetailState.activeDifficulties = activeDifficulties;
    saveDifficultyPreferenceToLocalStorage(difficultyFilter.getActiveDifficultyLabel());
    difficultyFilter.render(difficultyContainer);
    difficultyFilter.bind(difficultyContainer, (nextSet) => {
        activeDifficulties = new Set(nextSet);
        DetailState.activeDifficulties = activeDifficulties;
        saveDifficultyPreferenceToLocalStorage(difficultyFilter.getActiveDifficultyLabel());
        filterAndDisplayResults('user');
    });
});

// Make functions globally accessible
window.goToPage = goToPage;

