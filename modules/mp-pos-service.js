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
 * Creates a dual-index cache structure:
 * - byName: name -> position (for backward compatibility)
 * - byNameCountry: (name, country) -> position (for new country-aware lookup)
 * - nameStats: name -> occurrence metadata (for safe fallback decisions)
 * @returns {Promise<Object>} Cache object with both index types
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
            
            // Create dual-index cache structure
            mpPosCache = {
                byName: new Map(),      // name (lowercase) -> position (for backward compatibility)
                byNameCountry: new Map(), // (name|country) -> position (new format with country codes)
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
                        
                        // Index by (name|country) if country is provided
                        if (entry.country) {
                            const key = `${nameLower}|${entry.country.toLowerCase()}`;
                            mpPosCache.byNameCountry.set(key, entry.position);
                        }
                    }
                });
            }
            return mpPosCache;
        } catch (err) {
            console.warn('Could not load mp_pos cache:', err);
            mpPosCache = { 
                byName: new Map(), 
                byNameCountry: new Map(),
                nameStats: new Map()
            }; // Empty maps to prevent retries
            return mpPosCache;
        }
    })();
    
    return mpPosCachePromise;
}

/**
 * Get MP position for a driver by name and optional country code.
 * If a country is provided, lookup is strict: it must match (name|country).
 * This prevents incorrect rank assignment for same-name drivers from different countries.
 * @param {string} driverName - Driver name to look up
 * @param {string} countryCode - (Optional) ISO country code (e.g., "DE", "CH")
 * @returns {number|null} MP position or null if not found
 */
function getMpPos(driverName, countryCode) {
    if (!mpPosCache || !driverName) return null;
    
    const nameLower = String(driverName).trim().toLowerCase();
    
    // If country code is provided, try country-aware lookup first
    if (countryCode) {
        const countryLower = String(countryCode).toLowerCase();
        const nameCountryKey = `${nameLower}|${countryLower}`;
        const position = mpPosCache.byNameCountry.get(nameCountryKey);
        if (position !== undefined) {
            return position;
        }

        // Strict mode when country is known: do not fallback to name-only.
        return null;
    }
    
    // Fallback to name-only lookup (for backward compatibility)
    return mpPosCache.byName.get(nameLower) || null;
}

/**
 * Resolve MP position for a driver using either a country name or ISO country code.
 * Falls back to name-only lookup when country information is unavailable.
 * @param {string} driverName - Driver name to look up
 * @param {string} country - Country name or ISO country code
 * @returns {number|null} MP position or null if not found
 */
function resolveMpPos(driverName, country) {
    if (!driverName) return null;

    let countryCode = null;
    if (country) {
        const normalizedCountry = String(country).trim();
        if (normalizedCountry.length === 2) {
            countryCode = normalizedCountry;
        } else if (typeof FlagHelper !== 'undefined' && typeof FlagHelper.findCountryCodeByName === 'function') {
            countryCode = FlagHelper.findCountryCodeByName(normalizedCountry);
        }
    }

    return countryCode ? getMpPos(driverName, countryCode) : getMpPos(driverName);
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

/**
 * Get MP position with country code lookup only (no fallback)
 * @param {string} driverName - Driver name to look up
 * @param {string} countryCode - ISO country code (e.g., "DE", "CH")
 * @returns {number|null} MP position or null if not found
 */
function getMpPosByCountry(driverName, countryCode) {
    if (!mpPosCache || !driverName || !countryCode) return null;
    
    const nameLower = String(driverName).trim().toLowerCase();
    const countryLower = String(countryCode).toLowerCase();
    const key = `${nameLower}|${countryLower}`;
    
    return mpPosCache.byNameCountry.get(key) || null;
}

// Load mp_pos cache early
loadMpPosCache();
