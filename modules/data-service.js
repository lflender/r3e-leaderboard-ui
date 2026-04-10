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
    
    /**
     * Loads driver mirror index with caching.
     * Supports both legacy values (name -> canonical name) and new metadata objects.
     * @param {Function} onProgress - Optional callback for progressive updates (driverName, entries)
     * @returns {Promise<Object>} Driver index object
     */
    async loadDriverIndex(onProgress = null) {
        // Return immediately if already loaded
        if (this.driverIndex) {
            return this.driverIndex;
        }

        // Serve cached index (stale-while-revalidate) to avoid empty UI on refresh
        const cached = this._getCachedDriverIndex();
        if (cached) {
            this.driverIndex = cached;
            // Kick off a background refresh without blocking the UI
            setTimeout(() => { this._refreshDriverIndexInBackground(); }, 0);
            // Initialize baseline lastIndexUpdate and start periodic revalidation
            setTimeout(() => { this._updateLastIndexFromStatus(); }, 0);
            this._startIndexStatusRevalidator();
            return this.driverIndex;
        }

        // Ensure single-flight: reuse ongoing promise if present
        if (this.driverIndexPromise) {
            return this.driverIndexPromise;
        }

        const maxAttempts = 10;
        const baseDelayMs = 250;
        this.driverIndexPromise = (async () => {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const mirrorData = await this._fetchDriverMirrorData();
                    this.driverIndex = mirrorData;
                    
                    if (!this.driverIndex || typeof this.driverIndex !== 'object') {
                        throw new Error('Driver name mirror index is not an object');
                    }
                    const keyCount = Object.keys(this.driverIndex).length;
                    if (keyCount === 0) {
                        throw new Error('Driver name mirror index is empty');
                    }
                    this.driverNameMirror = this.driverIndex;
                    this._saveDriverIndexToCache(this.driverIndex);
                    // Update baseline and start periodic revalidation
                    setTimeout(() => { this._updateLastIndexFromStatus(); }, 0);
                    this._startIndexStatusRevalidator();
                    return this.driverIndex;
                } catch (error) {
                    const delay = baseDelayMs * Math.min(20, attempt);
                    console.warn(`Driver index load attempt ${attempt}/${maxAttempts} failed:`, error?.message || error);
                    if (attempt === maxAttempts) {
                        console.error('Giving up loading driver index after retries');
                        // Do not overwrite with empty object; preserve null so callers can decide
                        throw error;
                    }
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        })();

        return this.driverIndexPromise;
    }

    /**
     * Resolve shard file key from normalized driver key
     * @param {string} normalizedName - Lowercased/normalized driver key
     * @returns {string} Shard key: a-z or _
     */
    _getShardKeyForName(normalizedName) {
        if (!normalizedName || typeof normalizedName !== 'string') {
            return '_';
        }

        const firstChar = normalizedName.trim().charAt(0).toLowerCase();
        if (firstChar >= 'a' && firstChar <= 'z') {
            return firstChar;
        }
        return '_';
    }

    _normalizeDriverLookupName(name) {
        return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    _extractDriverMirrorMetadata(mirrorKey, mirrorEntry) {
        if (mirrorEntry && typeof mirrorEntry === 'object' && !Array.isArray(mirrorEntry)) {
            const lookupKey = this._normalizeDriverLookupName(
                mirrorEntry.lookup_key ||
                mirrorEntry.lookupKey ||
                mirrorEntry.canonical_key ||
                mirrorEntry.canonicalKey ||
                mirrorEntry.canonical_name ||
                mirrorEntry.canonicalName ||
                mirrorKey
            );

            return {
                lookupKey: lookupKey || this._normalizeDriverLookupName(mirrorKey),
                displayName: String(mirrorEntry.name || mirrorKey),
                country: String(mirrorEntry.country || ''),
                team: String(mirrorEntry.team || ''),
                rank: String(mirrorEntry.rank || ''),
                hasMetadata: true
            };
        }

        return {
            lookupKey: this._normalizeDriverLookupName(String(mirrorEntry || mirrorKey)),
            displayName: String(mirrorEntry || mirrorKey),
            country: '',
            team: '',
            rank: '',
            hasMetadata: false
        };
    }

    getDriverMetadata(driverName, driverMirror = null) {
        const mirror = driverMirror || this.driverIndex || this.driverNameMirror;
        if (!mirror || typeof mirror !== 'object') {
            return null;
        }

        const normalizedName = this._normalizeDriverLookupName(driverName);
        if (!normalizedName) {
            return null;
        }

        const mirrorEntry = mirror[normalizedName] || mirror[String(driverName)] || null;
        if (!mirrorEntry) {
            return null;
        }

        return this._extractDriverMirrorMetadata(normalizedName, mirrorEntry);
    }

    async enrichEntriesWithDriverMetadata(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return entries;
        }

        const driverMirror = await this.waitForDriverIndex();
        if (!driverMirror || typeof driverMirror !== 'object' || Object.keys(driverMirror).length === 0) {
            return entries;
        }

        entries.forEach(entry => {
            const driverName = window.DataNormalizer && typeof window.DataNormalizer.extractName === 'function'
                ? window.DataNormalizer.extractName(entry)
                : (entry.name || entry.Name || '');

            if (!driverName) {
                return;
            }

            const metadata = this.getDriverMetadata(driverName, driverMirror);
            if (!metadata) {
                return;
            }

            if (metadata.country) {
                entry.country = metadata.country;
                entry.Country = metadata.country;
            }
            entry.team = metadata.team || '';
            entry.Team = metadata.team || '';
            entry.rank = metadata.rank || '';
            entry.Rank = metadata.rank || '';
        });

        return entries;
    }

    /**
     * Loads a single shard file with single-flight dedupe and in-memory caching
     * @param {string} shardKey - a-z or _
     * @returns {Promise<Object>} Shard object mapping normalized name -> entries[]
     */
    async _loadDriverShard(shardKey) {
        const safeShardKey = (typeof shardKey === 'string' && shardKey.length > 0) ? shardKey : '_';

        if (this.driverShardCache.has(safeShardKey)) {
            return this.driverShardCache.get(safeShardKey);
        }

        if (this.driverShardPromises.has(safeShardKey)) {
            return this.driverShardPromises.get(safeShardKey);
        }

        const shardPromise = (async () => {
            const parsed = await this._fetchSingleDriverShard(safeShardKey);
            this.driverShardCache.set(safeShardKey, parsed);
            return parsed;
        })();

        this.driverShardPromises.set(safeShardKey, shardPromise);
        try {
            return await shardPromise;
        } finally {
            this.driverShardPromises.delete(safeShardKey);
        }
    }

    async _fetchSingleDriverShard(shardKey) {
        const maxAttempts = 6;
        const baseDelayMs = 200;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                const timestamp = Date.now();
                const response = await fetch(`${this.driverShardBasePath}/${shardKey}.json.gz?v=${timestamp}`, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`Failed to load shard ${shardKey}: ${response.status} ${response.statusText}`);
                }

                const helper = this._getCompressedJsonHelper();
                const text = await helper.readGzipText(response);
                if (!text || text.trim().length === 0) {
                    throw new Error(`Shard ${shardKey} response is empty`);
                }

                const parsed = await this._parseJsonWhenIdle(text);
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error(`Shard ${shardKey} is not an object`);
                }

                return parsed;
            } catch (error) {
                const delay = baseDelayMs * Math.min(20, attempt);
                if (attempt === maxAttempts) {
                    throw error;
                }
                await new Promise(r => setTimeout(r, delay));
            }
        }

        throw new Error(`Failed to load shard ${shardKey}`);
    }

    async _fetchDriverMirrorData() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`${this.driverMirrorPath}?v=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Failed to load driver index: ${response.status} ${response.statusText}`);
        }

        const helper = this._getCompressedJsonHelper();
        const text = await helper.readGzipText(response);
        if (!text || text.trim().length === 0) {
            throw new Error('Driver name mirror response is empty');
        }

        const parsed = await this._parseJsonWhenIdle(text);
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
            throw new Error('Driver name mirror index is invalid');
        }

        return parsed;
    }

    /**
     * Stream-parse driver index JSON and call onProgress for each driver entry
     * @param {Response} response - Fetch response object
     * @param {Function} onProgress - Callback(driverName, entries)
     * @returns {Promise<Object>} Complete driver index
     */
    async _streamParseDriverIndex(response, onProgress) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const index = {};
        let inObject = false;
        let currentKey = '';
        let braceDepth = 0;
        let valueStart = -1;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Simple streaming JSON parser for {key:[...], key:[...]} structure
            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];
                
                if (char === '{' && !inObject && braceDepth === 0) {
                    braceDepth = 1;
                    continue;
                }
                
                if (braceDepth === 1) {
                    // Looking for key
                    if (char === '"' && !currentKey) {
                        const closeQuote = buffer.indexOf('"', i + 1);
                        if (closeQuote > i) {
                            currentKey = buffer.substring(i + 1, closeQuote);
                            i = closeQuote;
                        }
                    } else if (char === '[' && currentKey) {
                        valueStart = i;
                        braceDepth = 2;
                    }
                } else if (braceDepth === 2) {
                    // Inside array, look for closing ]
                    if (char === '[') braceDepth++;
                    else if (char === ']') {
                        braceDepth--;
                        if (braceDepth === 1) {
                            // Complete entry found
                            const arrayJson = buffer.substring(valueStart, i + 1);
                            try {
                                const entries = JSON.parse(arrayJson);
                                index[currentKey] = entries;
                                // Call progress callback
                                if (onProgress) {
                                    onProgress(currentKey, entries);
                                }
                            } catch (e) {
                                // Ignore malformed entries
                            }
                            currentKey = '';
                            valueStart = -1;
                            // Remove processed content from buffer
                            buffer = buffer.substring(i + 1);
                            i = -1;
                        }
                    } else if (char === '{' || char === '}') {
                        // Track nested objects within arrays
                        if (char === '{') braceDepth++;
                        else braceDepth--;
                    }
                }
            }
        }

        return index;
    }
    
    /**
     * Waits for driver index to be loaded
     * @param {number} maxAttempts - Maximum number of attempts
     * @returns {Promise<Object>} Driver index
     */
    async waitForDriverIndex(maxAttempts = 50) {
        // If already loaded, return immediately
        if (this.driverIndex !== null) {
            return this.driverIndex;
        }

        // Ensure loading is started and await the single-flight promise with timeout aligned to retries
        const promise = this.loadDriverIndex();
        if (promise && typeof promise.then === 'function') {
            try {
                // Align timeout with retry window (~12s)
                const timeoutMs = Math.max(5000, maxAttempts * 250);
                return await this._withTimeout(promise, timeoutMs);
            } catch (e) {
                console.error('waitForDriverIndex timed out or failed:', e?.message || e);
                return this.driverIndex || {};
            }
        }

        // Fallback if loadDriverIndex returned synchronously (cached)
        return this.driverIndex || {};
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
        const driverMirror = await this.waitForDriverIndex();

        if (!driverMirror || Object.keys(driverMirror).length === 0) {
            throw new Error('Driver index is loading or unavailable. Please try again in a moment.');
        }
        
        let searchTerm = driverName.trim();
        let isExactSearch = false;
        
        // Check if search term is wrapped in quotes for exact matching
        if ((searchTerm.startsWith('"') && searchTerm.endsWith('"')) ||
            (searchTerm.startsWith("'") && searchTerm.endsWith("'"))) {
            isExactSearch = true;
            searchTerm = searchTerm.slice(1, -1).trim(); // Remove quotes
        }
        
        const searchLower = searchTerm.toLowerCase();
        const results = [];

        for (const [mirrorKey, mirrorEntry] of Object.entries(driverMirror)) {
            const mirrorMeta = this._extractDriverMirrorMetadata(mirrorKey, mirrorEntry);
            const searchTarget = mirrorMeta.displayName || mirrorKey;
            const driverLower = this._normalizeDriverLookupName(searchTarget);
            let matches = false;
            
            if (isExactSearch) {
                // Exact word/phrase matching with word boundaries
                const words = searchLower.split(/\s+/);
                if (words.length === 1) {
                    // Single word: match as whole word using word boundary
                    const wordRegex = new RegExp(`\\b${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    matches = wordRegex.test(searchTarget);
                } else {
                    // Multiple words: each word must be complete, in order, with any amount of space between
                    const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const pattern = escapedWords.map(w => `\\b${w}\\b`).join('\\s+');
                    const phraseRegex = new RegExp(pattern, 'i');
                    matches = phraseRegex.test(searchTarget);
                }
            } else {
                // Partial matching (current behavior)
                matches = driverLower.includes(searchLower);
            }
            
            if (!matches) {
                continue;
            }
            
            const shardKey = this._getShardKeyForName(mirrorKey);
            const shardData = await this._loadDriverShard(shardKey);
            const normalizedLookupName = mirrorMeta.lookupKey || this._normalizeDriverLookupName(mirrorKey);
            const driverEntries = shardData[normalizedLookupName] || shardData[mirrorKey] || shardData[this._normalizeDriverLookupName(searchTarget)] || [];
            if (!Array.isArray(driverEntries) || driverEntries.length === 0) {
                continue;
            }

            let filteredEntries = driverEntries;

            // Apply track filter
            if (filters.trackId) {
                const selectedTrackId = Number(filters.trackId);
                filteredEntries = filteredEntries.filter(entry => {
                    const entryTrackId = entry.track_id || entry.TrackID || entry.trackId ||
                        (entry.track && (entry.track.id || entry.track.Id || entry.track.track_id));
                    if (entryTrackId === undefined || entryTrackId === null) return false;
                    return Number(entryTrackId) === selectedTrackId;
                });
            }
            
            // Apply class filter
            if (filters.classId || filters.className) {
                const filterValue = filters.classId || filters.className;
                
                // Check if this is a superclass filter
                if (filterValue.startsWith('superclass:')) {
                    const superclassName = filterValue.replace('superclass:', '');
                    
                    // Get all classes that belong to this superclass
                    const superclassClasses = new Set();
                    if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
                        window.CARS_DATA.forEach(entry => {
                            if (entry.superclass === superclassName) {
                                const cls = entry.class || entry.car_class || entry.CarClass || '';
                                if (cls) superclassClasses.add(cls);
                            }
                        });
                    }
                    
                    // Filter entries by any of the classes in this superclass
                    filteredEntries = filteredEntries.filter(entry => {
                        const entryClass = entry.car_class || entry.CarClass || entry['Car Class'] || entry.Class || entry.class || '';
                        return superclassClasses.has(entryClass);
                    });
                } else {
                    // Regular class filter
                    filteredEntries = filteredEntries.filter(entry => {
                        const entryClass = entry.car_class || entry.CarClass || entry['Car Class'] || entry.Class || entry.class || '';
                        return entryClass === filterValue;
                    });
                }
            }
            
            // Apply difficulty filter
            if (filters.difficulty && filters.difficulty !== 'All difficulties') {
                filteredEntries = filteredEntries.filter(entry => {
                    const entryDifficulty = entry.difficulty || entry.Difficulty || entry.driving_model || '';
                    return entryDifficulty === filters.difficulty;
                });
            }
            
            if (filteredEntries.length > 0) {
                if (mirrorMeta.hasMetadata) {
                    const enrichedEntries = filteredEntries.map(entry => {
                        const enrichedEntry = { ...entry };
                        if (mirrorMeta.country) {
                            enrichedEntry.country = mirrorMeta.country;
                            enrichedEntry.Country = mirrorMeta.country;
                        }
                        enrichedEntry.team = mirrorMeta.team;
                        enrichedEntry.Team = mirrorMeta.team;
                        enrichedEntry.rank = mirrorMeta.rank;
                        enrichedEntry.Rank = mirrorMeta.rank;
                        if (mirrorMeta.displayName && !enrichedEntry.name && !enrichedEntry.Name) {
                            enrichedEntry.name = mirrorMeta.displayName;
                        }
                        return enrichedEntry;
                    });

                    results.push({
                        driver: mirrorMeta.displayName || driverEntries[0].name || mirrorKey,
                        country: mirrorMeta.country || '-',
                        team: mirrorMeta.team || '',
                        rank: mirrorMeta.rank || '',
                        entries: enrichedEntries
                    });
                    continue;
                }

                // Legacy fallback: group entries by country and team when metadata is not in the mirror.
                const entriesByCountryAndTeam = new Map();
                filteredEntries.forEach(entry => {
                    const country = entry.country || entry.Country || '-';
                    const team = entry.team || entry.Team || '-';
                    const groupKey = `${country}|${team}`;
                    if (!entriesByCountryAndTeam.has(groupKey)) {
                        entriesByCountryAndTeam.set(groupKey, {
                            country: country,
                            team: team,
                            rank: entry.rank || entry.Rank || '',
                            entries: []
                        });
                    }
                    entriesByCountryAndTeam.get(groupKey).entries.push(entry);
                });
                
                entriesByCountryAndTeam.forEach((groupData) => {
                    const driverName = driverEntries[0].name || mirrorMeta.displayName || mirrorKey;
                    results.push({
                        driver: driverName,
                        country: groupData.country,
                        team: groupData.team,
                        rank: groupData.rank,
                        entries: groupData.entries
                    });
                });
            }
        }
        
        return results;
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

    // -------- Internal helpers for index caching --------
    async _parseJsonWhenIdle(text) {
        if (typeof requestIdleCallback === 'function') {
            return await new Promise((resolve, reject) => {
                requestIdleCallback(() => {
                    try { resolve(JSON.parse(text)); }
                    catch (e) { reject(e); }
                }, { timeout: 2000 });
            });
        }
        // Fallback: parse immediately
        return JSON.parse(text);
    }

    _getCachedDriverIndex() {
        if (!this.ENABLE_INDEX_LOCAL_CACHE) return null;
        try {
            const raw = localStorage.getItem(this.DRIVER_INDEX_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            if (Object.keys(parsed).length === 0) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    _saveDriverIndexToCache(idx) {
        if (!this.ENABLE_INDEX_LOCAL_CACHE) return;
        try {
            localStorage.setItem(this.DRIVER_INDEX_CACHE_KEY, JSON.stringify(idx));
        } catch (_) {
            // Ignore storage errors (quota, privacy mode)
        }
    }

    async _refreshDriverIndexInBackground() {
        try {
            const maxAttempts = 5;
            const baseDelayMs = 250;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const parsed = await this._fetchDriverMirrorData();
                    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
                        throw new Error('Invalid index');
                    }
                    this.driverIndex = parsed;
                    this.driverNameMirror = parsed;
                    this.driverShardCache.clear();
                    this.driverShardPromises.clear();
                    this._saveDriverIndexToCache(parsed);
                    // After refresh, also update baseline status timestamp
                    setTimeout(() => { this._updateLastIndexFromStatus(); }, 0);
                    return;
                } catch (e) {
                    if (attempt === maxAttempts) return;
                    await new Promise(r => setTimeout(r, baseDelayMs * Math.min(20, attempt)));
                }
            }
        } catch (_) {
            // Swallow background refresh failures
        }
    }

    _withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('Timeout')), ms);
            promise.then(v => { clearTimeout(t); resolve(v); })
                   .catch(e => { clearTimeout(t); reject(e); });
        });
    }

    // -------- Minimal index change detection via status.json --------
    async _updateLastIndexFromStatus() {
        try {
            const status = await this.calculateStatus();
            const latest = status && (status.last_index_update || status.last_scrape_end) || null;
            if (latest) this.lastIndexUpdate = String(latest);
        } catch (_) { /* ignore */ }
    }

    _startIndexStatusRevalidator() {
        if (this.indexRevalidatorStarted) return;
        this.indexRevalidatorStarted = true;

        const baseIntervalMs = 10 * 60 * 1000; // 10 minutes
        const jitterMs = Math.floor(Math.random() * 60 * 1000); // up to 60s jitter

        const runCheck = async () => {
            try {
                if (typeof document !== 'undefined' && document.hidden) return; // skip when hidden
                const status = await this.calculateStatus();
                const latest = status && (status.last_index_update || status.last_scrape_end) || null;
                if (!latest) return;
                const latestStr = String(latest);
                if (!this.lastIndexUpdate) {
                    this.lastIndexUpdate = latestStr;
                    return;
                }
                if (latestStr !== this.lastIndexUpdate) {
                    this.lastIndexUpdate = latestStr;
                    await this._refreshDriverIndexInBackground();
                }
            } catch (_) { /* ignore */ }
        };

        // Re-check when tab becomes visible
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) setTimeout(runCheck, 500);
            });
        }

        setTimeout(runCheck, 2000 + jitterMs); // initial check shortly after load
        setInterval(runCheck, baseIntervalMs + jitterMs);
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
                    superclassMap.set(superclass, []);
                }
                superclassMap.get(superclass).push(cls);
            }
        });
        
        const options = [];
        superclassMap.forEach((classes, superclass) => {
            options.push({
                value: `superclass:${superclass}`,
                label: `Category: ${superclass}`,
                classes: classes
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
