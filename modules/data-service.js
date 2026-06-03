/**
 * Data Service Module
 * Centralized data fetching and caching logic.
 * Delegates driver index and search operations to R3EDriverIndexService
 * and R3EDriverSearchService via mixin (methods copied onto instance so
 * they share this DataService's state — caches, single-flight promises, etc.).
 */

class DataService {
    constructor() {
        this.driverIndex = null;
        this.driverIndexPromise = null; // single-flight promise for index loading
        this.driverNameMirror = null;
        this.driverShardPromises = new Map(); // single-flight promises for shard loading
        this.driverShardCache = new Map();
        this.driverMirrorPath = 'cache/index/mirror.json.gz';
        this.driverShardBasePath = 'cache/index/entries';
        this.driverMetadataBasePath = 'cache/index/metadata';
        this.driverMetadataShardCache = new Map();
        this.driverMetadataShardPromises = new Map();
        this.teamsCache = null;
        this.teamsPromise = null; // single-flight promise for teams loading
        this.allCombinationsCache = null;
        this.allCombinationsPromise = null; // single-flight promise
        this.topCombinationsCache = null;
        this.topCombinationsPromise = null; // single-flight promise
        this.statusCache = null; // last good status (fallback only)
        this.statusPromise = null; // single-flight promise for status fetch
        this.DRIVER_INDEX_CACHE_KEY = 'r3e_driver_index_cache';
        // Disable expensive localStorage caching of the giant index to keep UI responsive
        this.ENABLE_INDEX_LOCAL_CACHE = false;
        // Minimal index change detection via status.json
        this.lastIndexUpdate = null;
        this.indexRevalidatorStarted = false;
        // Stable cache-busting version derived from status.json last_index_update.
        // Using a stable key lets the browser HTTP-cache index/shard/metadata files
        // across navigations within the same data epoch instead of re-downloading
        // ~3 MB of gzipped data on every page load.
        this._indexCacheVersion = null;
        this._indexCacheVersionPromise = null;

        // Mixin: copy methods from delegate modules onto this instance so their
        // internal this.xxx() calls resolve to sibling methods on the same object.
        this._installDelegateMethods();
    }

    /**
     * Copies all methods from R3EDriverIndexService and R3EDriverSearchService
     * onto this DataService instance.  Because the functions are assigned as own
     * properties, calling  dataService.someMethod()  sets `this` to the
     * DataService instance, giving the delegate code access to shared state
     * (caches, single-flight promises, config paths, etc.).
     */
    _installDelegateMethods() {
        const modules = [
            window.R3EDriverIndexService,
            window.R3EDriverSearchService
        ];
        for (const mod of modules) {
            if (!mod) continue;
            for (const [name, fn] of Object.entries(mod)) {
                if (typeof fn === 'function' && !(name in this)) {
                    this[name] = fn;
                }
            }
        }
    }

    /**
     * Returns a stable cache-busting version string derived from
     * status.json's last_index_update. Falls back to Date.now() if
     * status is unavailable. The result is cached for the page lifetime
     * so all fetches within the same session share the same version key,
     * allowing the browser to serve index/shard/metadata from HTTP cache.
     * @returns {Promise<string>}
     */
    async _getIndexCacheVersion() {
        if (this._indexCacheVersion) {
            return this._indexCacheVersion;
        }
        if (this._indexCacheVersionPromise) {
            return this._indexCacheVersionPromise;
        }
        this._indexCacheVersionPromise = (async () => {
            try {
                const status = await this.calculateStatus();
                const ts = status && (status.last_index_update || status.last_scrape_end);
                if (ts) {
                    // Compact: strip non-alphanumeric chars from ISO timestamp
                    this._indexCacheVersion = String(ts).replace(/[^0-9a-zA-Z]/g, '');
                    return this._indexCacheVersion;
                }
            } catch (_) { /* fall through */ }
            this._indexCacheVersion = String(Date.now());
            return this._indexCacheVersion;
        })();
        return this._indexCacheVersionPromise;
    }

    _getCompressedJsonHelper() {
        if (!window.CompressedJsonHelper) {
            throw new Error('CompressedJsonHelper is not loaded.');
        }
        return window.CompressedJsonHelper;
    }

    /**
     * Fetches leaderboard details from gzipped cache
     * @param {string|number} trackId - Track ID
     * @param {string|number} classId - Class ID
     * @returns {Promise<Object>} Leaderboard data
     */
    async fetchLeaderboardDetails(trackId, classId) {
        // Validate inputs are safe path segments (numeric IDs only)
        const safeTrackId = String(trackId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const safeClassId = String(classId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeTrackId || !safeClassId) {
            throw new Error('Invalid track or class ID');
        }
        const filePath = `cache/tracks/track_${safeTrackId}/class_${safeClassId}.json.gz`;
        
        const cacheVersion = await this._getIndexCacheVersion();
        const response = await R3EUtils.fetchWithTimeout(`${filePath}?v=${cacheVersion}`, {}, 15000);
        
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        const helper = this._getCompressedJsonHelper();
        return helper.readGzipJson(response);
    }
    
    /**
     * Fetches top combinations data.
     * Uses single-flight promise to avoid concurrent fetches.
     * @returns {Promise<Array>} Combinations array
     */
    async fetchTopCombinations() {
        if (this.topCombinationsCache) return this.topCombinationsCache;
        if (this.topCombinationsPromise) return this.topCombinationsPromise;

        this.topCombinationsPromise = (async () => {
            try {
                const cacheVersion = await this._getIndexCacheVersion();
                const response = await R3EUtils.fetchWithTimeout(`cache/combinations/top_combinations.json.gz?v=${cacheVersion}`, {}, 15000);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const helper = this._getCompressedJsonHelper();
                const data = await helper.readGzipJson(response);

                this.topCombinationsCache = this._normalizeCombinations(data);
                return this.topCombinationsCache;
            } catch (err) {
                this.topCombinationsPromise = null;
                throw err;
            }
        })();

        return this.topCombinationsPromise;
    }
    
    /**
     * Fetches all combinations data (every track+class pair with entries).
     * Uses single-flight promise to avoid concurrent fetches.
     * @returns {Promise<Array>} Combinations array
     */
    async fetchAllCombinations() {
        if (this.allCombinationsCache) return this.allCombinationsCache;
        if (this.allCombinationsPromise) return this.allCombinationsPromise;

        this.allCombinationsPromise = (async () => {
            try {
                const cacheVersion = await this._getIndexCacheVersion();
                const response = await R3EUtils.fetchWithTimeout(`cache/combinations/all_combinations.json.gz?v=${cacheVersion}`, {}, 15000);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const helper = this._getCompressedJsonHelper();
                const data = await helper.readGzipJson(response);

                this.allCombinationsCache = this._normalizeCombinations(data);
                return this.allCombinationsCache;
            } catch (err) {
                this.allCombinationsPromise = null;
                throw err;
            }
        })();

        return this.allCombinationsPromise;
    }

    /**
     * Normalize combinations payload to a flat array.
     * @param {*} data - Raw parsed JSON
     * @returns {Array}
     */
    _normalizeCombinations(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.results)) return data.results;
        if (data && Array.isArray(data.data)) return data.data;
        return [];
    }

    /**
     * Loads the teams index (cache/index/teams.gz).
     * Uses a single-flight promise to avoid concurrent fetches.
     * @returns {Promise<Object>} Teams data keyed by team name
     */
    async loadTeams() {
        if (this.teamsCache) return this.teamsCache;
        if (this.teamsPromise) return this.teamsPromise;

        this.teamsPromise = (async () => {
            try {
                const cacheVersion = await this._getIndexCacheVersion();
                const response = await R3EUtils.fetchWithTimeout(
                    `cache/index/teams.json.gz?v=${cacheVersion}`, {}, 15000
                );
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const helper = this._getCompressedJsonHelper();
                const data = await helper.readGzipJson(response);
                this.teamsCache = data;
                return data;
            } catch (err) {
                // Allow retry on next call
                this.teamsPromise = null;
                throw err;
            }
        })();

        return this.teamsPromise;
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
                const response = await R3EUtils.fetchWithTimeout(`cache/status.json?v=${Date.now()}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                }, 5000);

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
        }).slice(0, 20); // Cap to prevent DoS via crafted URLs

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
}

// Create singleton instance
const dataService = new DataService();

// Export for use in other modules
window.DataService = DataService;
window.dataService = dataService;
