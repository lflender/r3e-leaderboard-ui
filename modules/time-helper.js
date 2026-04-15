/**
 * Time and date utility helpers shared across pages.
 */

function formatClassicLapTime(raw) {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    const m = s.match(/^([+-])?(?:(\d+)m\s*)?(\d+)(?:\.(\d{1,3}))?s$/);
    if (!m) return String(raw);
    const sign = m[1] || '';
    const minutes = parseInt(m[2] || '0', 10);
    const seconds = parseInt(m[3] || '0', 10);
    const millis = (m[4] || '').padEnd(3, '0');
    if (minutes === 0) {
        return `${sign}${seconds}:${millis}s`;
    }
    return `${sign}${minutes}:${String(seconds).padStart(2, '0')}:${millis}s`;
}

function parseGapMillisFromItem(item) {
    if (!item) return 0;
    const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
    const s = String(raw || '');
    if (!s) return 0;
    const parts = s.split(/,\s*/);
    if (parts.length < 2) return 0;
    const gapStr = String(parts.slice(1).join(' ') || '');
    if (!gapStr) return 0;
    const m = gapStr.match(/^([+-])?(?:(\d+)m\s*)?(\d+)(?:\.(\d{1,3}))?s$/);
    if (!m) return Number.MAX_VALUE;
    const sign = m[1] === '-' ? -1 : 1;
    const minutes = parseInt(m[2] || '0', 10);
    const seconds = parseInt(m[3] || '0', 10);
    const millis = parseInt((m[4] || '0').padEnd(3, '0'), 10);
    const total = ((minutes * 60) + seconds) * 1000 + millis;
    return sign * total;
}

function parseLapTimeToMillis(timeStr) {
    if (!timeStr) return 0;
    const s = String(timeStr).trim().replace(/s$/i, '');

    let m = s.match(/^(\d+):(\d+):(\d+)$/);
    if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millis = parseInt(m[3], 10);
        return ((minutes * 60) + seconds) * 1000 + millis;
    }

    m = s.match(/^(\d+):(\d+)\.(\d+)$/);
    if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millis = parseInt((m[3] + '000').substring(0, 3), 10);
        return ((minutes * 60) + seconds) * 1000 + millis;
    }

    m = s.match(/^(\d+)m\s*(\d+)\.(\d+)$/);
    if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millis = parseInt((m[3] + '000').substring(0, 3), 10);
        return ((minutes * 60) + seconds) * 1000 + millis;
    }

    m = s.match(/^(\d+)\.(\d+)$/);
    if (m) {
        const seconds = parseInt(m[1], 10);
        const millis = parseInt((m[2] + '000').substring(0, 3), 10);
        return seconds * 1000 + millis;
    }

    return 0;
}

function calculateGapPercentage(item, referenceTime) {
    if (!item) return '-';

    const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
    const s = String(raw || '');
    if (!s) return '-';

    const parts = s.split(/,\s*/);
    const lapTime = parts[0] || '';
    if (parts.length < 2) return '-';

    const lapMillis = parseLapTimeToMillis(lapTime);
    if (lapMillis === 0) {
        return '-';
    }

    const gapMillis = parseGapMillisFromItem(item);
    if (gapMillis === 0 || gapMillis === Number.MAX_VALUE) {
        return '-';
    }

    const refMillis = lapMillis - gapMillis;
    if (refMillis <= 0) {
        return '-';
    }

    const percentage = (lapMillis / refMillis) * 100;
    return percentage.toFixed(1) + '%';
}

function formatDate(dateTimeString) {
    if (!dateTimeString) return '';
    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) return '';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day} ${month} ${year}`;
    } catch (e) {
        return '';
    }
}

window.R3ETimeUtils = {
    formatClassicLapTime,
    parseGapMillisFromItem,
    parseLapTimeToMillis,
    calculateGapPercentage,
    formatDate
};