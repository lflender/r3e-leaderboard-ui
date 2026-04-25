/**
 * Shared utility facade used across the application.
 * Domain-specific utilities are split into dedicated modules and re-exported here.
 */

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatHeader(key) {
    if (typeof window !== 'undefined' && window.ColumnConfig) {
        return window.ColumnConfig.getDisplayName(key);
    }

    // Generic fallback: convert snake_case/camelCase → Title Case
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Returns true when the driver search input or URL params indicate an active search.
 * Shared between hall-of-fame.js and fun-fact.js to avoid duplication.
 */
function isDriverSearchActive() {
    const input = document.getElementById('driver-search');
    if (input && input.value.trim().length > 0) return true;
    const params = new URLSearchParams(window.location.search);
    return Boolean((params.get('driver') || params.get('query') || '').trim());
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '-';
    }
    return escapeHtml(String(value));
}

function getTotalEntriesCount(item) {
    const totalEntries = item.total_entries || item.TotalEntries || item['Total Entries'] || item.TotalRacers || item.total_racers;
    const n = parseInt(String(totalEntries || '').replace(/[^0-9]/g, ''));
    return isNaN(n) ? 0 : n;
}

function renderRankStars(rank, inline = false) {
    if (!rank) return '';
    const normalizedRank = String(rank).trim().toUpperCase();
    const map = { D: 1, C: 2, B: 3, A: 4 };
    const count = map[normalizedRank] || 0;

    if (inline) {
        if (count === 0) return '';
        return '<span class="rank-stars-inline">' + '⭐'.repeat(count) + '</span>';
    }

    if (count === 0) return ` | ⭐ Rank ${escapeHtml(rank)}`;
    return ' | ' + '⭐'.repeat(count) + ` Rank ${escapeHtml(normalizedRank)}`;
}

function getPositionBadgeColor(position, total) {
    if (isNaN(position) || isNaN(total) || total <= 1) {
        return 'rgba(59,130,246,0.18)';
    }

    if (position === 1) {
        return '#22c55e';
    }
    if (position === total) {
        return '#ef4444';
    }

    const t = (position - 1) / (total - 1);
    const r = Math.round(34 + (239 - 34) * t);
    const g = Math.round(197 + (68 - 197) * t);
    const b = Math.round(94 + (68 - 94) * t);
    return `rgb(${r},${g},${b})`;
}

window.R3EUtils = {
    escapeHtml,
    formatHeader,
    formatValue,
    getTotalEntriesCount,
    renderRankStars,
    getPositionBadgeColor,
    isDriverSearchActive,
    ...(window.R3ETimeUtils || {}),
    ...(window.R3ETrackUtils || {}),
    ...(window.R3EUrlUtils || {}),
    ...(window.R3ECarUtils || {})
};
