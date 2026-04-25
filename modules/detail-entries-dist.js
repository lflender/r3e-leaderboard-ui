/**
 * Entries Distribution Graph module for the Detail page.
 * Exposes window.DetailEntriesDist with:
 *   - generateHtml(data, isExpanded, startValue, endValue, boundsData, timeframeState) → HTML string
 *   - parseEntryDate(entry) → Date|null
 *   - getLocalDateKey(date) → string
 *   - getDataTimeBounds(data) → {min, max}|null
 *   - toLocalDateInputValue(date) → string
 *   - applyTimeframeFilter(data, startValue, endValue) → Array
 */
(function () {
    'use strict';

    function parseEntryDate(entry) {
        const raw = entry.date_time || entry.dateTime || entry.Date || entry.DateTime || '';
        if (!raw) return null;
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getLocalDateKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return local.toISOString().slice(0, 10);
    }

    function getDataTimeBounds(data) {
        if (!Array.isArray(data) || data.length === 0) return null;
        let min = null;
        let max = null;
        data.forEach(entry => {
            const dt = parseEntryDate(entry);
            if (!dt) return;
            if (!min || dt < min) min = dt;
            if (!max || dt > max) max = dt;
        });
        if (!min || !max) return null;
        return { min, max };
    }

    function toLocalDateInputValue(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return getLocalDateKey(date);
    }

    function applyTimeframeFilter(data, startValue, endValue) {
        if (!Array.isArray(data) || data.length === 0) return [];
        if (!startValue && !endValue) return data;
        return data.filter(entry => {
            const dt = parseEntryDate(entry);
            if (!dt) return false;
            const dayKey = getLocalDateKey(dt);
            if (!dayKey) return false;
            if (startValue && dayKey < startValue) return false;
            if (endValue && dayKey > endValue) return false;
            return true;
        });
    }

    /**
     * @param {Array} data - filtered dataset
     * @param {boolean} isExpanded
     * @param {string|null} startValue
     * @param {string|null} endValue
     * @param {Array} boundsData - unfiltered dataset for reference line
     * @param {{timeframeStart: string|null, timeframeEnd: string|null}} timeframeState
     */
    function generateEntriesDistributionGraph(data, isExpanded = false, startValue = null, endValue = null, boundsData = [], timeframeState = {}) {
        const graphData = Array.isArray(data) ? data : [];
        const rangeSourceData = (Array.isArray(boundsData) && boundsData.length > 0) ? boundsData : graphData;
        if (!Array.isArray(rangeSourceData) || rangeSourceData.length === 0) return '';

        const utils = window.R3EUtils;

        const dayCounts = new Map();
        const fullRangeDayCounts = new Map();
        let minDate = null;
        let maxDate = null;

        graphData.forEach(entry => {
            const d = parseEntryDate(entry);
            if (!d) return;
            const dayKey = getLocalDateKey(d);
            dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        });

        rangeSourceData.forEach(entry => {
            const d = parseEntryDate(entry);
            if (!d) return;
            const dayKey = getLocalDateKey(d);
            fullRangeDayCounts.set(dayKey, (fullRangeDayCounts.get(dayKey) || 0) + 1);
        });

        if (!minDate || !maxDate) {
            rangeSourceData.forEach(entry => {
                const d = parseEntryDate(entry);
                if (!d) return;
                if (!minDate || d < minDate) minDate = d;
                if (!maxDate || d > maxDate) maxDate = d;
            });
            if (!minDate || !maxDate) return '';
        }

        const start = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
        const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

        const dayKeys = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dayKeys.push(getLocalDateKey(d));
        }

        const counts = dayKeys.map(k => dayCounts.get(k) || 0);
        const maxCount = Math.max(1, ...Array.from(fullRangeDayCounts.values()));

        const chartHeight = 100;
        const chartWidth = Math.max(dayKeys.length, 1);

        const summaryId = 'entries-dist-summary-' + Date.now();
        const startInputValue = startValue || timeframeState.timeframeStart || toLocalDateInputValue(start);
        const endInputValue = endValue || timeframeState.timeframeEnd || toLocalDateInputValue(end);

        let html = '<div class="entries-dist-summary">';
        html += '<button type="button" class="entries-dist-toggle' + (isExpanded ? ' expanded' : '') + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '" aria-controls="' + summaryId + '">';
        html += '<span class="entries-dist-toggle-icon">▼</span>';
        html += '<span class="entries-dist-toggle-text">Entries Distribution Graph</span>';
        html += '</button>';

        html += '<div id="' + summaryId + '" class="entries-dist-content" style="display: ' + (isExpanded ? '' : 'none') + ';">';
        html += '<div class="entries-dist-max-label">' + maxCount + '</div>';
        html += '<div class="entries-dist-chart" role="img" aria-label="Entries per day from ' + dayKeys[0] + ' to ' + dayKeys[dayKeys.length - 1] + '">';
        html += '<svg viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '" preserveAspectRatio="none" aria-hidden="true">';

        dayKeys.forEach((key, idx) => {
            const count = counts[idx];
            const h = Math.max(1, Math.round((count / maxCount) * chartHeight));
            const y = chartHeight - h;
            html += '<rect class="entries-dist-bar" x="' + idx + '" y="' + y + '" width="0.9" height="' + h + '">';
            html += '<title>' + key + ': ' + count + ' entries</title>';
            html += '</rect>';
        });

        html += '</svg>';
        html += '<div class="entries-dist-max-line-overlay" aria-hidden="true"></div>';
        html += '</div>';
        html += '<div class="entries-dist-axis">';
        html += '<span class="entries-dist-axis-left">' + dayKeys[0] + '</span>';
        html += '<span class="entries-dist-axis-right">' + dayKeys[dayKeys.length - 1] + '</span>';
        html += '</div>';
        if (graphData.length === 0) {
            html += '<div class="entries-dist-empty">No entries in the selected timeframe.</div>';
        }
        html += '<div class="entries-timeframe-controls">';
        html += '<label class="entries-timeframe-field"><span>Start</span><input type="date" class="entries-timeframe-input entries-timeframe-start" value="' + utils.escapeHtml(startInputValue) + '"></label>';
        html += '<button type="button" class="entries-timeframe-last-week">Last week</button>';
        html += '<label class="entries-timeframe-field"><span>End</span><input type="date" class="entries-timeframe-input entries-timeframe-end" value="' + utils.escapeHtml(endInputValue) + '"></label>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    window.DetailEntriesDist = {
        generateHtml: generateEntriesDistributionGraph,
        parseEntryDate,
        getLocalDateKey,
        getDataTimeBounds,
        toLocalDateInputValue,
        applyTimeframeFilter
    };
}());
