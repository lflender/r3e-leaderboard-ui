/**
 * MP Position Service Module
 * Handles loading and caching of MP (Multiplayer) position data
 * Follows Single Responsibility Principle - only handles MP position operations
 */

let mpPosCache = null;
let mpPosCachePromise = null;
let mpPosInactiveCache = null;
let mpPosInactiveCachePromise = null;

/**
 * Build a dual-index cache structure from an array of ranking entries.
 * Shared by both active and inactive loaders (DRY).
 * @param {Array} results - Array of { name, user_id, position } entries
 * @returns {Object} Cache with byName, byNameUserId, nameStats Maps
 */
function buildMpPosIndex(results) {
    const cache = {
        byName: new Map(),
        byNameUserId: new Map(),
        nameStats: new Map()
    };

    if (Array.isArray(results)) {
        results.forEach(entry => {
            if (entry.name && entry.position) {
                const nameLower = String(entry.name).trim().toLowerCase();

                const currentStats = cache.nameStats.get(nameLower) || { count: 0 };
                currentStats.count += 1;
                cache.nameStats.set(nameLower, currentStats);

                if (!cache.byName.has(nameLower)) {
                    cache.byName.set(nameLower, entry.position);
                }

                if (entry.user_id) {
                    const key = `${nameLower}|${String(entry.user_id).trim()}`;
                    cache.byNameUserId.set(key, entry.position);
                }
            }
        });
    }

    return cache;
}

/**
 * Load MP position cache from cache/mp_pos/mp_pos.json.gz
 * Uses single-flight pattern to prevent concurrent fetches
 * Creates a dual-index cache structure:
 * - byName: name -> position (for backward compatibility)
 * - byNameUserId: (name|user_id) -> position (for user_id-aware lookup)
 * - nameStats: name -> occurrence metadata (for safe fallback decisions)
 * @returns {Promise<Object>} Cache object with both index types
 */
async function loadMpPosCache() {
    if (mpPosCache !== null) return mpPosCache;
    
    // Single-flight protection: reuse ongoing promise if present
    if (mpPosCachePromise) return mpPosCachePromise;
    
    mpPosCachePromise = (async () => {
        try {
            // 30-minute cache bucket: same version string for 30 min, then rotates
            const cacheVersion = Math.floor(Date.now() / (30 * 60 * 1000));
            const response = await fetch(`cache/mp_pos/mp_pos.json.gz?v=${cacheVersion}`);
            if (!response.ok) throw new Error('Failed to load mp_pos.json.gz');
            if (!window.CompressedJsonHelper || typeof window.CompressedJsonHelper.readGzipJson !== 'function') {
                throw new Error('CompressedJsonHelper is not loaded.');
            }
            const data = await window.CompressedJsonHelper.readGzipJson(response);
            
            mpPosCache = buildMpPosIndex(data.results);
            return mpPosCache;
        } catch (err) {
            console.warn('Could not load mp_pos cache:', err);
            mpPosCache = buildMpPosIndex([]);
            return mpPosCache;
        }
    })();
    
    return mpPosCachePromise;
}

/**
 * Load inactive MP position cache from cache/mp_pos/mp_pos_inactive.json.gz
 * Uses single-flight pattern to prevent concurrent fetches.
 * Loaded asynchronously — never blocks the main render path.
 * @returns {Promise<Object>} Cache object with both index types
 */
async function loadMpPosInactiveCache() {
    if (mpPosInactiveCache !== null) return mpPosInactiveCache;

    if (mpPosInactiveCachePromise) return mpPosInactiveCachePromise;

    mpPosInactiveCachePromise = (async () => {
        try {
            const cacheVersion = Math.floor(Date.now() / (30 * 60 * 1000));
            const response = await fetch(`cache/mp_pos/mp_pos_inactive.json.gz?v=${cacheVersion}`);
            if (!response.ok) throw new Error('Failed to load mp_pos_inactive.json.gz');
            if (!window.CompressedJsonHelper || typeof window.CompressedJsonHelper.readGzipJson !== 'function') {
                throw new Error('CompressedJsonHelper is not loaded.');
            }
            const data = await window.CompressedJsonHelper.readGzipJson(response);

            mpPosInactiveCache = buildMpPosIndex(data.results);
            return mpPosInactiveCache;
        } catch (err) {
            console.warn('Could not load mp_pos_inactive cache:', err);
            mpPosInactiveCache = buildMpPosIndex([]);
            return mpPosInactiveCache;
        }
    })();

    return mpPosInactiveCachePromise;
}

/**
 * Look up a position in a given cache by name and optional user ID.
 * @param {Object} cache - Cache object with byName/byNameUserId Maps
 * @param {string} driverName - Driver name
 * @param {string} userId - Optional user ID
 * @returns {number|null} Position or null
 */
function lookupPosition(cache, driverName, userId) {
    if (!cache || !driverName) return null;

    const nameLower = String(driverName).trim().toLowerCase();

    if (userId) {
        const userIdStr = String(userId).trim();
        const nameUserIdKey = `${nameLower}|${userIdStr}`;
        const position = cache.byNameUserId.get(nameUserIdKey);
        if (position !== undefined) return position;
        // Strict mode when user_id is known: do not fallback to name-only.
        return null;
    }

    return cache.byName.get(nameLower) || null;
}

/**
 * Get MP position for a driver by name and optional user ID.
 * If a userId is provided, lookup is strict: it must match (name|user_id).
 * This prevents incorrect rank assignment for same-name drivers.
 * @param {string} driverName - Driver name to look up
 * @param {string} userId - (Optional) User ID from driver path (e.g., "6098133")
 * @returns {number|null} MP position or null if not found
 */
function getMpPos(driverName, userId) {
    return lookupPosition(mpPosCache, driverName, userId);
}

/**
 * Get inactive MP position for a driver by name and optional user ID.
 * Same lookup semantics as getMpPos but against the inactive cache.
 * @param {string} driverName - Driver name to look up
 * @param {string} userId - (Optional) User ID
 * @returns {number|null} Inactive MP position or null if not found
 */
function getInactiveMpPos(driverName, userId) {
    return lookupPosition(mpPosInactiveCache, driverName, userId);
}

/**
 * Resolve MP position for a driver using name and optional user ID.
 * Falls back to name-only lookup when user ID is unavailable.
 * @param {string} driverName - Driver name to look up
 * @param {string} userId - User ID from driver path URL slug (e.g., "6098133")
 * @returns {number|null} MP position or null if not found
 */
function resolveMpPos(driverName, userId) {
    if (!driverName) return null;

    return getMpPos(driverName, userId || null);
}

/**
 * Resolve MP position with inactive fallback.
 * Returns { position, inactive } where inactive indicates the source.
 * Active rankings are checked first; inactive only when no active rank exists.
 * @param {string} driverName - Driver name to look up
 * @param {string} userId - User ID from driver path URL slug
 * @returns {{ position: number|null, inactive: boolean }}
 */
function resolveMpPosWithInactive(driverName, userId) {
    if (!driverName) return { position: null, inactive: false };

    const activePos = getMpPos(driverName, userId || null);
    if (activePos !== null) return { position: activePos, inactive: false };

    const inactivePos = getInactiveMpPos(driverName, userId || null);
    if (inactivePos !== null) return { position: inactivePos, inactive: true };

    return { position: null, inactive: false };
}

/**
 * Map an MP position to the appropriate driver highlight class.
 * @param {number|null} mpPos - Multiplayer position
 * @param {Object} thresholds - Class thresholds
 * @param {number} thresholds.gold - Max position for gold highlight
 * @param {number} thresholds.silver - Max position for silver highlight
 * @returns {string} CSS class name or empty string when no highlight applies
 */
function getMpPosHighlightClass(mpPos, thresholds = { gold: 50, silver: 200 }) {
    if (mpPos === null || mpPos === undefined) return '';

    if (mpPos <= thresholds.gold) {
        return 'driver-name-gold';
    }

    if (mpPos <= thresholds.silver) {
        return 'driver-name-silver';
    }

    return '';
}

/**
 * Build the full set of MP position CSS classes for a driver name.
 * @param {number|null} mpPos - Multiplayer position
 * @param {Object} options - Threshold configuration
 * @param {number} options.gold - Max position for gold highlight
 * @param {number} options.silver - Max position for silver highlight
 * @param {number} options.glitter - Max position for glitter effect
 * @param {boolean} options.inactive - Whether the ranking is from inactive data
 * @returns {string} Space-separated CSS classes
 */
function getMpPosNameClasses(mpPos, options = {}) {
    if (mpPos === null || mpPos === undefined) return '';

    const gold = options.gold ?? 50;
    const silver = options.silver ?? 200;
    const glitter = options.glitter ?? 10;

    // Inactive rankings never get name highlight classes
    if (options.inactive) {
        return '';
    }

    const classes = [];
    const highlightClass = getMpPosHighlightClass(mpPos, { gold, silver });

    if (highlightClass) {
        classes.push(highlightClass);
    }

    if (mpPos <= glitter) {
        classes.push('driver-name-top10-glitter');
    }

    return classes.join(' ');
}

// Load mp_pos caches early (active immediately, inactive asynchronously)
loadMpPosCache();
loadMpPosInactiveCache();
