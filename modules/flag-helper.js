/**
 * Flag Helper Module
 * Centralized flag and country code conversion utilities
 */

/**
 * Resolves a country name to an ISO code using manual mappings and Intl.DisplayNames
 * @param {string} name - Country name
 * @returns {string|null} Country code or null
 */
function findCountryCodeByName(name) {
    if (!name) return null;
    const nm = String(name).trim().toLowerCase();
    
    // Check manual mappings first (loaded from country-mappings.js)
    if (typeof window.COUNTRY_NAME_MAP !== 'undefined' && window.COUNTRY_NAME_MAP[nm]) {
        return window.COUNTRY_NAME_MAP[nm];
    }
    
    // Use ISO_COUNTRY_CODES from country-mappings.js
    const codes = typeof window.ISO_COUNTRY_CODES !== 'undefined' ? window.ISO_COUNTRY_CODES : [];
    
    try {
        const disp = new Intl.DisplayNames(['en'], { type: 'region' });
        for (const code of codes) {
            const display = disp.of(code);
            if (!display) continue;
            const d = String(display).toLowerCase();
            // Use exact match only to avoid false positives
            if (d === nm) return code;
        }
    } catch (e) {
        // Intl or DisplayNames not available
    }
    return null;
}

/**
 * Converts a country value (name or code) to a flag HTML element using CSS flag icons
 * @param {string} country - Country name or code
 * @returns {string} Flag HTML element or empty string
 */
function countryToFlag(country) {
    if (!country) return '';
    const s = String(country).trim();
    
    // Special case for "Various" - use custom RaceRoom icon
    if (s.toLowerCase() === 'various') {
        return `<img src="https://s1.cdn.autoevolution.com/images/news/race-flags-indy-racing-league-8367_12.jpg" alt="Various" class="various-flag-icon" style="width: 1.3em; height: 1em; vertical-align: middle; display: inline-block;">`;
    }
    
    let code = null;
    
    // First, check if value contains a country code in parentheses like "United Kingdom (GB)"
    const paren = s.match(/\(([A-Za-z]{2})\)$/);
    if (paren) {
        code = paren[1].toLowerCase();
    }
    // Try to map the country name/alias to an ISO code (handles UK→GB, USA→US, etc.)
    else {
        const mapped = findCountryCodeByName(s);
        if (mapped) {
            code = mapped.toLowerCase();
        }
        // If no mapping found and it's a 2-letter code, assume it's already a valid ISO code
        else if (/^[A-Za-z]{2}$/.test(s)) {
            code = s.toLowerCase();
        }
    }
    
    if (code) {
        return `<span class="fi fi-${code}"></span>`;
    }
    
    return '';
}

// Make available globally
if (typeof window !== 'undefined') {
    window.FlagHelper = {
        findCountryCodeByName,
        countryToFlag
    };
}
