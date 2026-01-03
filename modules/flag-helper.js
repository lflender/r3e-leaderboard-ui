/**
 * Flag Helper Module
 * Centralized flag and country code conversion utilities
 */

/**
 * Converts a 2-letter country code to a regional indicator flag emoji
 * @param {string} code - 2-letter country code
 * @returns {string} Flag emoji or empty string
 */
function codeToFlag(code) {
    if (!code || code.length !== 2) return '';
    const A = 'A'.charCodeAt(0);
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + (c.charCodeAt(0) - A)));
}

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
 * Converts a country value (name or code) to a flag emoji
 * @param {string} country - Country name or code
 * @returns {string} Flag emoji with space or empty string
 */
function countryToFlag(country) {
    if (!country) return '';
    const s = String(country).trim();
    
    // If it already contains regional indicator symbols or emoji, return it
    try {
        if (/\p{Regional_Indicator}/u.test(s) || /[\u{1F1E6}-\u{1F1FF}]/u.test(s)) return s + ' ';
    } catch (e) {}

    // If it's a 2-letter code (e.g., GB, US), convert
    if (/^[A-Za-z]{2}$/.test(s)) {
        return codeToFlag(s) + ' ';
    }

    // If value contains a country code in parentheses like "United Kingdom (GB)", extract
    const paren = s.match(/\(([A-Za-z]{2})\)$/);
    if (paren) return codeToFlag(paren[1]) + ' ';

    // Try to map the full country name to an ISO code
    const mapped = findCountryCodeByName(s);
    if (mapped) return codeToFlag(mapped) + ' ';

    // Nothing matched — return empty
    return '';
}

// Make available globally
if (typeof window !== 'undefined') {
    window.FlagHelper = {
        codeToFlag,
        findCountryCodeByName,
        countryToFlag
    };
}
