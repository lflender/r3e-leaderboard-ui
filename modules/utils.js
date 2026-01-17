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

/**
 * Parses a lap time string and returns milliseconds
 * Supports formats: "1:59:530s", "55.395s", "1:23.456s", "1m 26.693s"
 * @param {string} timeStr - Lap time string
 * @returns {number} Time in milliseconds
 */
function parseLapTimeToMillis(timeStr) {
    if (!timeStr) return 0;
    const s = String(timeStr).trim().replace(/s$/i, '');
    
    // Format 1: minutes:seconds:milliseconds (e.g., "1:59:530" or "2:00:705")
    let m = s.match(/^(\d+):(\d+):(\d+)$/);
    if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millis = parseInt(m[3], 10);
        return ((minutes * 60) + seconds) * 1000 + millis;
    }
    
    // Format 2: minutes:seconds.milliseconds (e.g., "1:23.456")
    m = s.match(/^(\d+):(\d+)\.(\d+)$/);
    if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millis = parseInt((m[3] + '000').substring(0, 3), 10);
        return ((minutes * 60) + seconds) * 1000 + millis;
    }
    
    // Format 3: Xm Y.Zs (e.g., "1m 26.693" or "2m 03.404")
    m = s.match(/^(\d+)m\s+(\d+)\.(\d+)$/);
    if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millis = parseInt((m[3] + '000').substring(0, 3), 10);
        return ((minutes * 60) + seconds) * 1000 + millis;
    }
    
    // Format 4: seconds.milliseconds (e.g., "55.395")
    m = s.match(/^(\d+)\.(\d+)$/);
    if (m) {
        const seconds = parseInt(m[1], 10);
        const millis = parseInt((m[2] + '000').substring(0, 3), 10);
        return seconds * 1000 + millis;
    }
    
    return 0;
}

/**
 * Calculates the gap percentage between a lap time and reference time
 * @param {Object} item - Data item containing lap time with gap
 * @param {string} referenceTime - Not used, kept for API compatibility
 * @returns {string} Percentage string (e.g., "101.0%" or "-" for reference)
 */
function calculateGapPercentage(item, referenceTime) {
    if (!item) return '-';
    
    const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
    const s = String(raw || '');
    if (!s) return '-';
    
    // Parse the lap time (first part before comma) and gap (after comma)
    const parts = s.split(/,\s*/);
    const lapTime = parts[0] || '';
    
    // If this is the reference (no gap), return "-"
    if (parts.length < 2) return '-';
    
    const lapMillis = parseLapTimeToMillis(lapTime);
    if (lapMillis === 0) {
        console.log('Failed to parse lap time:', lapTime);
        return '-';
    }
    
    // Parse the gap time (e.g., "+1.175s" or "+0m 1.175s")
    const gapMillis = parseGapMillisFromItem(item);
    
    if (gapMillis === 0 || gapMillis === Number.MAX_VALUE) {
        console.log('Invalid gap:', gapMillis, 'for item:', s);
        return '-';
    }
    
    // Calculate reference time: reference = lapTime - gap
    const refMillis = lapMillis - gapMillis;
    if (refMillis <= 0) {
        console.log('Invalid refMillis:', refMillis);
        return '-';
    }
    
    // Calculate percentage: (lapTime / refTime) * 100
    const percentage = (lapMillis / refMillis) * 100;
    
    // Round to 1 decimal place
    return percentage.toFixed(1) + '%';
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

// Make utilities available globally
window.R3EUtils = {
    escapeHtml,
    formatHeader,
    formatValue,
    formatClassicLapTime,
    parseGapMillisFromItem,
    getTotalEntriesCount,
    parseLapTimeToMillis,
    calculateGapPercentage,
    renderRankStars,
    getPositionBadgeColor,
    getUrlParam,
    updateUrlParam
};
