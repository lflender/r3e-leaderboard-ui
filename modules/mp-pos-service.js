/**
 * MP Position Service Module
 * Handles loading and caching of MP (Multiplayer) position data
 * Follows Single Responsibility Principle - only handles MP position operations
 */

let mpPosCache = null;
let mpPosCachePromise = null;

/**
 * Load MP position cache from cache/mp_pos.json.gz
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
            const response = await fetch(`cache/mp_pos.json.gz?v=${cacheVersion}`);
            if (!response.ok) throw new Error('Failed to load mp_pos.json.gz');
            if (!window.CompressedJsonHelper || typeof window.CompressedJsonHelper.readGzipJson !== 'function') {
                throw new Error('CompressedJsonHelper is not loaded.');
            }
            const data = await window.CompressedJsonHelper.readGzipJson(response);
            
            // Create dual-index cache structure
            mpPosCache = {
                byName: new Map(),      // name (lowercase) -> position (for backward compatibility)
                byNameUserId: new Map(), // (name|user_id) -> position (keyed by name + user_id)
                nameStats: new Map() // name (lowercase) -> { count: number }
            };
            
            if (data.results && Array.isArray(data.results)) {
                data.results.forEach(entry => {
                    if (entry.name && entry.position) {
                        const nameLower = String(entry.name).trim().toLowerCase();

                        // Track how many times a name appears so we can avoid ambiguous fallbacks.
                        const currentStats = mpPosCache.nameStats.get(nameLower) || { count: 0 };
                        currentStats.count += 1;
                        mpPosCache.nameStats.set(nameLower, currentStats);
                        
                        // Index by name (backward compatibility)
                        // Only set if not already set (first occurrence wins)
                        if (!mpPosCache.byName.has(nameLower)) {
                            mpPosCache.byName.set(nameLower, entry.position);
                        }
                        
                        // Index by (name|user_id) if user_id is provided
                        if (entry.user_id) {
                            const key = `${nameLower}|${String(entry.user_id).trim()}`;
                            mpPosCache.byNameUserId.set(key, entry.position);
                        }
                    }
                });
            }
            return mpPosCache;
        } catch (err) {
            console.warn('Could not load mp_pos cache:', err);
            mpPosCache = { 
                byName: new Map(), 
                byNameUserId: new Map(),
                nameStats: new Map()
            }; // Empty maps to prevent retries
            return mpPosCache;
        }
    })();
    
    return mpPosCachePromise;
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
    if (!mpPosCache || !driverName) return null;
    
    const nameLower = String(driverName).trim().toLowerCase();
    
    // If user ID is provided, try user_id-aware lookup first
    if (userId) {
        const userIdStr = String(userId).trim();
        const nameUserIdKey = `${nameLower}|${userIdStr}`;
        const position = mpPosCache.byNameUserId.get(nameUserIdKey);
        if (position !== undefined) {
            return position;
        }

        // Strict mode when user_id is known: do not fallback to name-only.
        return null;
    }
    
    // Fallback to name-only lookup (for backward compatibility)
    return mpPosCache.byName.get(nameLower) || null;
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
 * @returns {string} Space-separated CSS classes
 */
function getMpPosNameClasses(mpPos, options = { gold: 50, silver: 200, glitter: 10 }) {
    if (mpPos === null || mpPos === undefined) return '';

    const classes = [];
    const highlightClass = getMpPosHighlightClass(mpPos, {
        gold: options.gold,
        silver: options.silver
    });

    if (highlightClass) {
        classes.push(highlightClass);
    }

    if (mpPos <= options.glitter) {
        classes.push('driver-name-top10-glitter');
    }

    return classes.join(' ');
}

// Load mp_pos cache early
loadMpPosCache();
