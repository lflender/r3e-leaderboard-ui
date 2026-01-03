/**
 * Shared utility functions used across the application
 * Following SRP (Single Responsibility Principle) from SOLID
 */

// ========================================
// HTML & String Utilities
// ========================================

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe string
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Formats a camelCase or snake_case key into Title Case
 * @param {string} key - Key to format
 * @returns {string} Formatted header
 */
function formatHeader(key) {
    // Special case for class_name
    if (key === 'class_name' || key === 'className' || key === 'ClassName') {
        return 'Car class';
    }
    // Normalize known entry count fields to a concise label
    const lower = String(key || '').toLowerCase();
    if (lower === 'entry_count' || lower === 'total_entries' || lower === 'totalracers' || lower === 'total_racers') {
        return 'Entries';
    }
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Formats a value for display, handling null/undefined
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    return escapeHtml(String(value));
}

// ========================================
// Time & Lap Time Utilities
// ========================================

/**
 * Converts raw lap times like "2m 12.524s" or "45.281s" to classic format "2:12:524s"
 * @param {string} raw - Raw lap time string
 * @returns {string} Formatted lap time
 */
function formatClassicLapTime(raw) {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    // Handle optional +/- prefix for gap times
    const m = s.match(/^([+-])?(?:(\d+)m\s*)?(\d+)(?:\.(\d{1,3}))?s$/);
    if (!m) return String(raw); // fallback if pattern doesn't match
    const sign = m[1] || '';
    const minutes = parseInt(m[2] || '0', 10);
    const seconds = parseInt(m[3] || '0', 10);
    const millis = (m[4] || '').padEnd(3, '0');
    // Omit minutes if 0
    if (minutes === 0) {
        return `${sign}${seconds}:${millis}s`;
    }
    return `${sign}${minutes}:${String(seconds).padStart(2, '0')}:${millis}s`;
}

/**
 * Parses gap time in milliseconds from an item's lap time field
 * @param {Object} item - Data item containing lap time
 * @returns {number} Gap time in milliseconds
 */
function parseGapMillisFromItem(item) {
    if (!item) return 0;
    const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
    const s = String(raw || '');
    if (!s) return 0;
    const parts = s.split(/,\s*/);
    if (parts.length < 2) return 0; // leader row or missing gap
    const gapStr = String(parts.slice(1).join(' ') || '');
    if (!gapStr) return 0;
    // Patterns supported: "+1.234s", "+0m 1.234s", "-0.500s" (optional sign), with optional minutes
    const m = gapStr.match(/^([+-])?(?:(\d+)m\s*)?(\d+)(?:\.(\d{1,3}))?s$/);
    if (!m) return Number.MAX_VALUE; // push unknown gaps to the end
    const sign = m[1] === '-' ? -1 : 1;
    const minutes = parseInt(m[2] || '0', 10);
    const seconds = parseInt(m[3] || '0', 10);
    const millis = parseInt((m[4] || '0').padEnd(3, '0'), 10);
    const total = ((minutes * 60) + seconds) * 1000 + millis;
    return sign * total;
}

/**
 * Extracts total entries count from various possible fields
 * @param {Object} item - Data item
 * @returns {number} Total entries count
 */
function getTotalEntriesCount(item) {
    const totalEntries = item.total_entries || item.TotalEntries || item['Total Entries'] || item.TotalRacers || item.total_racers;
    const n = parseInt(String(totalEntries || '').replace(/[^0-9]/g, ''));
    return isNaN(n) ? 0 : n;
}

// ========================================
// Country & Flag Utilities
// ========================================

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
 * ISO 3166-1 alpha-2 country codes
 */
const ISO_COUNTRY_CODES = [
    'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY','HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM','JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU','VE','VN','VG','VI','WF','EH','YE','ZM','ZW'
];

/**
 * Manual country name to ISO code mappings for special cases
 */
const COUNTRY_NAME_MAP = {
    'netherlands': 'NL',
    'netherland': 'NL',
    'the netherlands': 'NL',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'antigua and barbuda': 'AG',
    'antigua & barbuda': 'AG',
    'romania': 'RO',
    'bosnia and herzegovina': 'BA',
    'bosnia & herzegovina': 'BA',
    'moldova': 'MD',
    'moldova, republic of': 'MD',
    'republic of moldova': 'MD',
    'bolivia': 'BO',
    'bolivia, plurinational state of': 'BO',
    'brunei': 'BN',
    'brunei darussalam': 'BN',
    'iran': 'IR',
    'iran, islamic republic of': 'IR',
    'islamic republic of iran': 'IR',
    'trinidad and tobago': 'TT',
    'trinidad & tobago': 'TT',
    'sint maarten': 'SX',
    'sint maarten (dutch part)': 'SX',
    'taiwan': 'TW',
    'taiwan, province of china': 'TW',
    'chinese taipei': 'TW',
    'hong kong': 'HK',
    'hongkong': 'HK',
    'venezuela': 'VE',
    'venezuela, bolivarian republic of': 'VE',
    'bolivarian republic of venezuela': 'VE',
    'swaziland': 'SZ',
    'eswatini': 'SZ',
    'turkey': 'TR',
    'türkiye': 'TR',
    'turkiye': 'TR',
    'palestine': 'PS',
    'palestine, state of': 'PS',
    'state of palestine': 'PS',
    'vietnam': 'VN',
    'korea, democratic people\'s republic of': 'KP',
    'democratic people\'s republic of korea': 'KP',
    'viet nam': 'VN',
    'united states': 'US',
    'usa': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'great britain': 'GB',
    'korea': 'KR',
    'south korea': 'KR',
    'republic of korea': 'KR',
    'korea, republic of': 'KR',
    'north korea': 'KP',
    'russia': 'RU',
    'russian federation': 'RU'
};

/**
 * Resolves a country name to an ISO code using Intl.DisplayNames
 * @param {string} name - Country name
 * @returns {string|null} Country code or null
 */
function findCountryCodeByName(name) {
    if (!name) return null;
    const nm = String(name).trim().toLowerCase();
    
    // Check manual mappings first
    if (COUNTRY_NAME_MAP[nm]) return COUNTRY_NAME_MAP[nm];
    
    try {
        const disp = new Intl.DisplayNames(['en'], { type: 'region' });
        for (const code of ISO_COUNTRY_CODES) {
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

// ========================================
// UI & Display Utilities
// ========================================

/**
 * Renders rank as stars: D -> 1, C -> 2, B -> 3, A -> 4
 * @param {string} rank - Rank letter
 * @returns {string} HTML string with stars
 */
function renderRankStars(rank) {
    if (!rank) return '';
    const r = String(rank).trim().toUpperCase();
    const map = { 'D': 1, 'C': 2, 'B': 3, 'A': 4 };
    const count = map[r] || 0;
    if (count === 0) return ` | ⭐ Rank ${escapeHtml(rank)}`;
    return ' | ' + '⭐'.repeat(count) + ` Rank ${escapeHtml(r)}`;
}

/**
 * Calculates position badge color based on rank
 * @param {number} position - Position number
 * @param {number} total - Total entries
 * @returns {string} CSS color value
 */
function getPositionBadgeColor(position, total) {
    if (isNaN(position) || isNaN(total) || total <= 1) {
        return 'rgba(59,130,246,0.18)'; // fallback blue
    }
    
    if (position === 1) {
        return '#22c55e'; // bright green
    } else if (position === total) {
        return '#ef4444'; // bright red
    } else {
        // Interpolate between green and red
        const t = (position - 1) / (total - 1);
        // Green: 34,197,94  Red: 239,68,68
        const r = Math.round(34 + (239-34)*t);
        const g = Math.round(197 + (68-197)*t);
        const b = Math.round(94 + (68-94)*t);
        return `rgb(${r},${g},${b})`;
    }
}

// ========================================
// Data Utilities
// ========================================

/**
 * Safely parses a URL parameter
 * @param {string} paramName - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getUrlParam(paramName) {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get(paramName);
    } catch (e) {
        return null;
    }
}

/**
 * Updates URL parameter without reloading the page
 * @param {string} paramName - Parameter name
 * @param {string} value - Parameter value
 */
function updateUrlParam(paramName, value) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set(paramName, value);
        window.history.replaceState({}, '', url);
    } catch (e) {
        // ignore URL update errors
    }
}

// ========================================
// Export utilities for use in other modules
// ========================================

// Make utilities available globally for backward compatibility
window.R3EUtils = {
    escapeHtml,
    formatHeader,
    formatValue,
    formatClassicLapTime,
    parseGapMillisFromItem,
    getTotalEntriesCount,
    codeToFlag,
    findCountryCodeByName,
    countryToFlag,
    renderRankStars,
    getPositionBadgeColor,
    getUrlParam,
    updateUrlParam
};
