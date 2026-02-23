/**
 * MP Position Service Module
 * Handles loading and caching of MP (Multiplayer) position data
 * Follows Single Responsibility Principle - only handles MP position operations
 */

let mpPosCache = null;
let mpPosCachePromise = null;

/**
 * Load MP position cache from cache/mp_pos.json
 * Uses single-flight pattern to prevent concurrent fetches
 * @returns {Promise<Map>} Map of driver name (lowercase) -> position
 */
async function loadMpPosCache() {
    if (mpPosCache !== null) return mpPosCache;
    
    // Single-flight protection: reuse ongoing promise if present
    if (mpPosCachePromise) return mpPosCachePromise;
    
    mpPosCachePromise = (async () => {
        try {
            const response = await fetch('cache/mp_pos.json');
            if (!response.ok) throw new Error('Failed to load mp_pos.json');
            const data = await response.json();
            
            // Create a lookup map: driver name (lowercase) -> position
            mpPosCache = new Map();
            if (data.results && Array.isArray(data.results)) {
                data.results.forEach(entry => {
                    if (entry.name && entry.position) {
                        mpPosCache.set(entry.name.toLowerCase(), entry.position);
                    }
                });
            }
            return mpPosCache;
        } catch (err) {
            console.warn('Could not load mp_pos cache:', err);
            mpPosCache = new Map(); // Empty map to prevent retries
            return mpPosCache;
        }
    })();
    
    return mpPosCachePromise;
}

/**
 * Get MP position for a driver
 * @param {string} driverName - Driver name to look up
 * @returns {number|null} MP position or null if not found
 */
function getMpPos(driverName) {
    if (!mpPosCache || !driverName) return null;
    return mpPosCache.get(String(driverName).toLowerCase()) || null;
}

// Load mp_pos cache early
loadMpPosCache();
