/**
 * Data Service Module
 * Centralized data fetching and caching logic
 * Follows Single Responsibility Principle - only handles data operations
 */

class DataService {
    constructor() {
        this.driverIndex = null;
        this.driverIndexPromise = null; // single-flight promise for index loading
        this.driverNameMirror = null;
        this.driverShardPromises = new Map(); // single-flight promises for shard loading
        this.driverShardCache = new Map();
        this.driverMirrorPath = 'cache/index/driver_index.json.gz';
        this.driverShardBasePath = 'cache/index/shards';
        // Disable status caching: status.json is precomputed and should be fetched fresh
        this.statusCache = null; // last good status (fallback only, not used to avoid fresh fetches)
        this.statusPromise = null; // single-flight promise for status fetch
        this.CACHE_DURATION = 0;
        this.STATUS_CACHE_KEY = 'r3e_status_cache';
        this.DRIVER_INDEX_CACHE_KEY = 'r3e_driver_index_cache';
        // Disable expensive localStorage caching of the giant index to keep UI responsive
        this.ENABLE_INDEX_LOCAL_CACHE = false;
        // Minimal index change detection via status.json
        this.lastIndexUpdate = null;
        this.indexRevalidatorStarted = false;
    }

    _getCompressedJsonHelper() {
        if (!window.CompressedJsonHelper) {
            throw new Error('CompressedJsonHelper is not loaded.');
        }
        return window.CompressedJsonHelper;
    }

    _getDriverIndexModule() {
        const module = window.R3EDriverIndexService;
        if (!module) {
            throw new Error('R3EDriverIndexService is not loaded.');
        }
        return module;
    }
    
    /**
     * Loads driver mirror index with caching.
     * Supports both legacy values (name -> canonical name) and new metadata objects.
     * @param {Function} onProgress - Optional callback for progressive updates (driverName, entries)
     * @returns {Promise<Object>} Driver index object
     */
    async loadDriverIndex(onProgress = null) {
        return this._getDriverIndexModule().loadDriverIndex.call(this, onProgress);
    }

    /**
     * Resolve shard file key from normalized driver key
     * @param {string} normalizedName - Lowercased/normalized driver key
     * @returns {string} Shard key: a-z or _
     */
    _getShardKeyForName(normalizedName) {
        return this._getDriverIndexModule()._getShardKeyForName.call(this, normalizedName);
    }

    _normalizeDriverLookupName(name) {
        return this._getDriverIndexModule()._normalizeDriverLookupName.call(this, name);
    }

    _extractDriverMirrorMetadata(mirrorKey, mirrorEntry) {
        return this._getDriverIndexModule()._extractDriverMirrorMetadata.call(this, mirrorKey, mirrorEntry);
    }

    getDriverMetadata(driverName, driverMirror = null) {
        return this._getDriverIndexModule().getDriverMetadata.call(this, driverName, driverMirror);
    }

    _getDriverSearchModule() {
        const module = window.R3EDriverSearchService;
        if (!module) {
            throw new Error('R3EDriverSearchService is not loaded.');
        }
        return module;
    }

    _matchesDriverSearchTerm(searchTarget, searchLower, isExactSearch) {
        return this._getDriverSearchModule()._matchesDriverSearchTerm.call(this, searchTarget, searchLower, isExactSearch);
    }

    _getSuperclassClasses(superclassName) {
        return this._getDriverSearchModule()._getSuperclassClasses.call(this, superclassName);
    }

    _filterDriverEntries(entries, filters = {}) {
        return this._getDriverSearchModule()._filterDriverEntries.call(this, entries, filters);
    }

    _buildMetadataSearchResult(filteredEntries, mirrorMeta, mirrorKey, driverEntries) {
        return this._getDriverSearchModule()._buildMetadataSearchResult.call(this, filteredEntries, mirrorMeta, mirrorKey, driverEntries);
    }

    _buildLegacySearchResults(filteredEntries, mirrorMeta, mirrorKey, driverEntries) {
        return this._getDriverSearchModule()._buildLegacySearchResults.call(this, filteredEntries, mirrorMeta, mirrorKey, driverEntries);
    }

    async enrichEntriesWithDriverMetadata(entries) {
        return this._getDriverIndexModule().enrichEntriesWithDriverMetadata.call(this, entries);
    }

    /**
     * Loads a single shard file with single-flight dedupe and in-memory caching
     * @param {string} shardKey - a-z or _
     * @returns {Promise<Object>} Shard object mapping normalized name -> entries[]
     */
    async _loadDriverShard(shardKey) {
        return this._getDriverIndexModule()._loadDriverShard.call(this, shardKey);
    }

    async _fetchSingleDriverShard(shardKey) {
        return this._getDriverIndexModule()._fetchSingleDriverShard.call(this, shardKey);
    }

    async _fetchDriverMirrorData() {
        return this._getDriverIndexModule()._fetchDriverMirrorData.call(this);
    }

    /**
     * Parse driver index JSON and call onProgress for each driver entry
     * @param {Response} response - Fetch response object
     * @param {Function} onProgress - Callback(driverName, entries)
     * @returns {Promise<Object>} Complete driver index
     */
    async _streamParseDriverIndex(response, onProgress) {
        return this._getDriverIndexModule()._streamParseDriverIndex.call(this, response, onProgress);
    }
    
    /**
     * Waits for driver index to be loaded
     * @param {number} maxAttempts - Maximum number of attempts
     * @returns {Promise<Object>} Driver index
     */
    async waitForDriverIndex(maxAttempts = 50) {
        return this._getDriverIndexModule().waitForDriverIndex.call(this, maxAttempts);
    }
    
    /**
     * Fetches leaderboard details from gzipped cache
     * @param {string|number} trackId - Track ID
     * @param {string|number} classId - Class ID
     * @returns {Promise<Object>} Leaderboard data
     */
    async fetchLeaderboardDetails(trackId, classId) {
        const filePath = `cache/tracks/track_${trackId}/class_${classId}.json.gz`;
        
        const timestamp = new Date().getTime();
        const response = await fetch(`${filePath}?v=${timestamp}`, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        const helper = this._getCompressedJsonHelper();
        return helper.readGzipJson(response);
    }
    
    /**
     * Fetches top combinations data
     * @returns {Promise<Array>} Combinations array
     */
    async fetchTopCombinations() {
        const timestamp = new Date().getTime();
        const response = await fetch(`cache/top_combinations.json.gz?v=${timestamp}`, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const helper = this._getCompressedJsonHelper();
        const data = await helper.readGzipJson(response);
        
        let combinations = [];
        if (Array.isArray(data)) {
            combinations = data;
        } else if (data && Array.isArray(data.results)) {
            combinations = data.results;
        } else if (data && Array.isArray(data.data)) {
            combinations = data.data;
        }
        
        return combinations;
    }
    
    /**
     * Fetches status from server-provided cache/status.json
     * @returns {Promise<Object>} Status data
     */
    async calculateStatus() {
        // Single-flight: reuse ongoing fetch to avoid concurrent reads and races
        if (this.statusPromise) {
            return this.statusPromise;
        }

        this.statusPromise = (async () => {
            // Always fetch fresh status.json without caching
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(`cache/status.json?v=${Date.now()}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    console.error('Failed to fetch status.json:', response.status, response.statusText);
                    // Graceful fallback: return last good status if present
                    return this.statusCache || null;
                }

                // Use text + JSON.parse to avoid potential BOM/issues
                const text = await response.text();
                let parsed = null;
                try {
                    parsed = JSON.parse(text);
                } catch (e) {
                    console.error('Invalid JSON in status.json:', e);
                    // Graceful fallback
                    return this.statusCache || null;
                }

                // Minimal validation
                if (parsed && typeof parsed === 'object') {
                    this.statusCache = parsed; // update fallback
                }
                return parsed;
            } catch (error) {
                console.error('Error fetching status.json:', error);
                // Graceful fallback
                return this.statusCache || null;
            } finally {
                // Allow future calls to start a fresh fetch
                this.statusPromise = null;
            }
        })();

        return this.statusPromise;
    }
    
    /**
     * Searches for driver in index
     * @param {string} driverName - Driver name to search
     * @param {Object} filters - Filter options (class, difficulty)
     * @returns {Promise<Array>} Search results
     */
    async searchDriver(driverName, filters = {}) {
        return this._getDriverSearchModule().searchDriver.call(this, driverName, filters);
    }
    
    /**
     * Extract leaderboard array from cache data
     * @param {Object} data - Cache file data
     * @returns {Array} Leaderboard entries
     */
    extractLeaderboardArray(data) {
        if (!data || typeof data !== 'object') {
            return [];
        }

        if (data.track_info && data.track_info.Data && Array.isArray(data.track_info.Data)) {
            return data.track_info.Data;
        }

        const possibleKeys = ['leaderboard', 'entries', 'results', 'data', 'Data', 'Leaderboard', 'Entries', 'Results'];

        for (const key of possibleKeys) {
            if (data[key] && Array.isArray(data[key])) {
                return data[key];
            }
        }

        if (data.track_info && typeof data.track_info === 'object') {
            for (const key of possibleKeys) {
                if (data.track_info[key] && Array.isArray(data.track_info[key])) {
                    return data.track_info[key];
                }
            }
        }

        for (const key of Object.keys(data)) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                return data[key];
            }
        }

        for (const key of possibleKeys) {
            if (data.track_info && data.track_info[key] && Array.isArray(data.track_info[key])) {
                return data.track_info[key];
            }
        }

        for (const key of Object.keys(data)) {
            const value = data[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                for (const nestedKey of Object.keys(value)) {
                    if (Array.isArray(value[nestedKey]) && value[nestedKey].length > 0) {
                        return value[nestedKey];
                    }
                }
            }
        }
        
        return [];
    }
    
    /**
     * Normalize time string for comparison
     * @param {string} time - Time string
     * @returns {string} Normalized time
     */
    normalizeTime(time) {
        if (!time) return '';
        return String(time).split(',')[0].trim(); // Remove gap info, just get main time
    }

    _normalizeLeaderboardEntriesForDetail(leaderboardData, data) {
        if (!Array.isArray(leaderboardData)) {
            return [];
        }

        const totalEntries = leaderboardData.length;
        const defaultClassName = data?.track_info?.ClassName || data?.track_info?.class_name || null;
        const firstClassName = leaderboardData[0]?.car_class?.class?.Name ||
            leaderboardData[0]?.car_class?.class?.name || null;

        return leaderboardData.map((entry, index) => {
            let normalized;
            if (window.DataNormalizer && typeof window.DataNormalizer.normalizeLeaderboardEntry === 'function') {
                normalized = window.DataNormalizer.normalizeLeaderboardEntry(entry, data, index, totalEntries);
            } else {
                normalized = { ...entry };
            }

            if (!normalized.CarClass) {
                normalized.CarClass = firstClassName || defaultClassName || '';
            }

            return normalized;
        });
    }

    _extractRawLapTime(entry) {
        if (window.DataNormalizer && typeof window.DataNormalizer.extractLapTime === 'function') {
            return window.DataNormalizer.extractLapTime(entry);
        }
        return entry.LapTime || entry['Lap Time'] || entry.lap_time || entry.laptime || entry.Time || '';
    }

    _rebuildCombinedLapTimes(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return entries;
        }

        entries.forEach(entry => {
            const rawLap = this._extractRawLapTime(entry);
            entry.__rawLapForSort = rawLap;
            // Strip any pre-existing gap suffix (e.g. "2m 00.392s, +01.533s") before parsing
            const lapOnly = String(rawLap || '').split(',')[0].trim();
            entry.__lapSortMs = R3EUtils.parseLapTimeToMillis(lapOnly) || Number.POSITIVE_INFINITY;
        });

        entries.sort((a, b) => a.__lapSortMs - b.__lapSortMs);

        entries.forEach((entry, index) => {
            const newPos = index + 1;
            entry.Position = newPos;
            entry.position = newPos;
            entry.Pos = newPos;
            delete entry.TotalEntries;
            delete entry.total_entries;
        });

        const fastestMs = entries[0].__lapSortMs;
        entries.forEach((entry, index) => {
            const entryMs = entry.__lapSortMs;
            const lapTimePart = String(entry.__rawLapForSort || '').split(',')[0].trim();

            if (index === 0) {
                entry.LapTime = lapTimePart;
                entry['Lap Time'] = lapTimePart;
                entry.lap_time = lapTimePart;
            } else {
                const gapMs = entryMs - fastestMs;
                const gapSeconds = (gapMs / 1000).toFixed(3);
                const gapFormatted = `+${gapSeconds}s`;
                const newLapTime = `${lapTimePart}, ${gapFormatted}`;
                entry.LapTime = newLapTime;
                entry['Lap Time'] = newLapTime;
                entry.lap_time = newLapTime;
            }

            delete entry.__rawLapForSort;
            delete entry.__lapSortMs;
        });

        return entries;
    }

    async buildCombinedLeaderboard(trackId, classSpecs = []) {
        const validSpecs = (Array.isArray(classSpecs) ? classSpecs : []).filter(spec => {
            return spec && spec.classId !== null && spec.classId !== undefined && String(spec.classId).trim() !== '';
        });

        if (validSpecs.length === 0) {
            return [];
        }

        const fetchPromises = validSpecs.map(async (spec) => {
            try {
                const data = await this.fetchLeaderboardDetails(trackId, spec.classId);
                const leaderboardData = this.extractLeaderboardArray(data);
                if (!Array.isArray(leaderboardData) || leaderboardData.length === 0) {
                    return [];
                }

                const normalizedEntries = this._normalizeLeaderboardEntriesForDetail(leaderboardData, data);
                if (spec.className) {
                    normalizedEntries.forEach(entry => {
                        entry.ClassName = spec.className;
                    });
                }
                return normalizedEntries;
            } catch (error) {
                console.warn('Failed to fetch class for combined leaderboard:', spec.classId, error);
                return [];
            }
        });

        const batches = await Promise.all(fetchPromises);
        const allEntries = batches.flat();
        return this._rebuildCombinedLapTimes(allEntries);
    }

    // -------- Internal helpers for index caching --------
    async _parseJsonWhenIdle(text) {
        return this._getDriverIndexModule()._parseJsonWhenIdle.call(this, text);
    }

    _getCachedDriverIndex() {
        return this._getDriverIndexModule()._getCachedDriverIndex.call(this);
    }

    _saveDriverIndexToCache(idx) {
        return this._getDriverIndexModule()._saveDriverIndexToCache.call(this, idx);
    }

    async _refreshDriverIndexInBackground() {
        return this._getDriverIndexModule()._refreshDriverIndexInBackground.call(this);
    }

    _withTimeout(promise, ms) {
        return this._getDriverIndexModule()._withTimeout.call(this, promise, ms);
    }

    // -------- Minimal index change detection via status.json --------
    async _updateLastIndexFromStatus() {
        return this._getDriverIndexModule()._updateLastIndexFromStatus.call(this);
    }

    _startIndexStatusRevalidator() {
        return this._getDriverIndexModule()._startIndexStatusRevalidator.call(this);
    }
    
    /**
     * Populates class filter from cars data, filtered to only classes with leaderboard data
     * @returns {Array<{value: string, label: string}>} Class options
     */
    getClassOptionsFromCarsData() {
        if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) {
            return [];
        }

        const seen = new Set();
        const options = [];
        
        window.CARS_DATA.forEach(entry => {
            const cls = entry.class || entry.car_class || entry.CarClass || '';
            if (!cls || seen.has(cls)) return;
            
            // Only include classes that exist in CAR_CLASSES_DATA (have leaderboard entries)
            if (window.getCarClassId && !window.getCarClassId(cls)) {
                return; // Skip classes without leaderboard data (e.g., Safety Car)
            }
            
            seen.add(cls);
            options.push({ value: cls, label: cls });
        });
        
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * Get unique superclass options with classes that belong to each
     * @returns {Array<{value: string, label: string, classes: Array<string>}>} Superclass options with associated classes
     */
    getSuperclassOptions() {
        if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) {
            return [];
        }
        
        const superclassMap = new Map();
        
        window.CARS_DATA.forEach(entry => {
            const superclass = entry.superclass;
            const cls = entry.class || entry.car_class || entry.CarClass || '';
            
            if (superclass && cls) {
                if (!superclassMap.has(superclass)) {
                    superclassMap.set(superclass, new Set());
                }
                superclassMap.get(superclass).add(cls);
            }
        });
        
        const options = [];
        superclassMap.forEach((classes, superclass) => {
            options.push({
                value: `superclass:${superclass}`,
                label: `Category: ${superclass}`,
                classes: Array.from(classes)
            });
        });
        
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }
}

// Create singleton instance
const dataService = new DataService();

// Export for use in other modules
window.DataService = DataService;
window.dataService = dataService;
