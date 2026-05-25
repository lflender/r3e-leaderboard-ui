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
            html += '<rect class="entries-dist-bar" x="' + idx + '" y="' + y + '" width="0.9" height="' + h + '" data-date="' + key + '" data-count="' + count + '">';
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

    /**
     * Wire tooltip interactivity for entries distribution bar charts.
     * Uses proximity-based detection for consistent hover behavior.
     * @param {HTMLElement} container - The container that holds the entries-dist-summary element(s)
     * @param {Array} [entries] - Optional raw entries for detailed tooltips (grouped by date)
     */
    function wireTooltips(container, entries) {
        if (!container) return;

        // Pre-group entries by date if provided
        var entriesByDate = null;
        if (Array.isArray(entries) && entries.length > 0) {
            entriesByDate = new Map();
            entries.forEach(entry => {
                const dt = parseEntryDate(entry);
                if (!dt) return;
                const key = getLocalDateKey(dt);
                if (!key) return;
                if (!entriesByDate.has(key)) entriesByDate.set(key, []);
                entriesByDate.get(key).push(entry);
            });
        }

        const charts = container.querySelectorAll('.entries-dist-chart:not(.perf-dist-chart)');
        charts.forEach(chart => {
            const svg = chart.querySelector('svg');
            if (!svg) return;

            let tooltip = chart.querySelector('.dist-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'dist-tooltip';
                chart.appendChild(tooltip);
            }

            const bars = Array.from(svg.querySelectorAll('.entries-dist-bar'));
            if (bars.length === 0) return;

            let activeBar = null;

            svg.addEventListener('mousemove', (e) => {
                const rect = svg.getBoundingClientRect();
                const svgWidth = rect.width;
                if (svgWidth === 0) return;

                const viewBox = svg.viewBox.baseVal;
                const mouseXRatio = (e.clientX - rect.left) / svgWidth;
                const svgX = mouseXRatio * viewBox.width;

                // Find the bar at this x position
                let nearest = null;
                bars.forEach(bar => {
                    const bx = parseFloat(bar.getAttribute('x'));
                    if (svgX >= bx && svgX <= bx + 1) {
                        nearest = bar;
                    }
                });

                if (!nearest) {
                    let minDist = Infinity;
                    bars.forEach(bar => {
                        const bx = parseFloat(bar.getAttribute('x')) + 0.45;
                        const dist = Math.abs(bx - svgX);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = bar;
                        }
                    });
                    if (minDist > 1.5) nearest = null;
                }

                if (!nearest) {
                    if (activeBar) {
                        activeBar.classList.remove('entries-dist-bar-active');
                        activeBar = null;
                    }
                    tooltip.style.display = 'none';
                    return;
                }

                if (activeBar !== nearest) {
                    if (activeBar) activeBar.classList.remove('entries-dist-bar-active');
                    nearest.classList.add('entries-dist-bar-active');
                    activeBar = nearest;
                }

                const date = nearest.getAttribute('data-date');
                const count = nearest.getAttribute('data-count');
                tooltip.innerHTML = buildEntriesTooltip(date, count, entriesByDate);
                tooltip.style.display = 'block';
                positionTooltipFromSvg(e, chart, tooltip);
            });

            svg.addEventListener('mouseleave', () => {
                if (activeBar) {
                    activeBar.classList.remove('entries-dist-bar-active');
                    activeBar = null;
                }
                tooltip.style.display = 'none';
            });
        });
    }

    function buildEntriesTooltip(date, count, entriesByDate) {
        let html = '<strong>' + date + '</strong>: ' + count + (count === '1' ? ' entry' : ' entries');
        if (entriesByDate && entriesByDate.has(date)) {
            const dayEntries = entriesByDate.get(date);
            html += '<div class="dist-tooltip-entries">';
            dayEntries.forEach(entry => {
                const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
                const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                    ? window.R3EUtils.resolveTrackLabelForItem(entry)
                    : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');
                const label = car + (track ? ' – ' + track : '');
                if (label) {
                    const logoHtml = buildClassLogoHtml(entry);
                    html += '<div class="dist-tooltip-entry">' + logoHtml + escapeForTooltip(label) + '</div>';
                }
            });
            html += '</div>';
        }
        return html;
    }

    function buildClassLogoHtml(entry) {
        var className = entry.car_class || entry.CarClass || entry.Class || '';
        var classId = entry.class_id || entry.ClassID || entry.classId || '';
        return buildClassLogoHtmlFromValues(className, classId);
    }

    function buildClassLogoHtmlFromValues(className, classId) {
        if (!window.R3EUtils || typeof window.R3EUtils.resolveCarClassLogo !== 'function') return '';
        var url = window.R3EUtils.resolveCarClassLogo(className, classId);
        if (!url) return '';
        return '<img class="dist-tooltip-class-logo" src="' + escapeForTooltip(url) + '" alt="" />';
    }

    function escapeForTooltip(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * Wire tooltip interactivity for performance distribution scatter charts.
     * Points are HTML elements positioned with CSS percentages.
     * Uses proximity-based detection (nearest point by x) for better UX.
     * @param {HTMLElement} container - The container holding perf-dist-chart element(s)
     */
    function wirePerfTooltips(container) {
        if (!container) return;
        const charts = container.querySelectorAll('.perf-dist-chart');
        charts.forEach(chart => {
            let tooltip = chart.querySelector('.dist-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'dist-tooltip';
                chart.appendChild(tooltip);
            }

            const points = Array.from(chart.querySelectorAll('.perf-dist-point'));
            if (points.length === 0) return;

            let activePoint = null;

            chart.addEventListener('mousemove', (e) => {
                const rect = chart.getBoundingClientRect();
                const chartWidth = rect.width;
                if (chartWidth === 0) return;

                const mouseXPct = ((e.clientX - rect.left) / chartWidth) * 100;

                // Find nearest point by x percentage
                let nearest = null;
                let minDist = Infinity;
                points.forEach(p => {
                    const leftPct = parseFloat(p.style.left);
                    const dist = Math.abs(leftPct - mouseXPct);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = p;
                    }
                });

                // Only show if within reasonable range
                const threshold = Math.max(2, 100 / points.length);
                if (!nearest || minDist > threshold) {
                    if (activePoint) {
                        activePoint.classList.remove('perf-dist-point-active');
                        activePoint = null;
                    }
                    tooltip.style.display = 'none';
                    return;
                }

                if (activePoint !== nearest) {
                    if (activePoint) activePoint.classList.remove('perf-dist-point-active');
                    nearest.classList.add('perf-dist-point-active');
                    activePoint = nearest;
                }

                const date = nearest.getAttribute('data-date');
                const pct = nearest.getAttribute('data-pct');
                const pos = nearest.getAttribute('data-pos');
                const total = nearest.getAttribute('data-total');
                const info = nearest.getAttribute('data-info');
                const className = nearest.getAttribute('data-class') || '';
                const classId = nearest.getAttribute('data-class-id') || '';
                const logoHtml = buildClassLogoHtmlFromValues(className, classId);
                let tipHtml = '<strong>' + date + '</strong>: ' + pct + '% bested';
                if (pos && total) tipHtml += ' (P' + pos + '/' + total + ')';
                if (info) tipHtml += '<div class="dist-tooltip-entry">' + logoHtml + escapeForTooltip(info) + '</div>';
                tooltip.innerHTML = tipHtml;
                tooltip.style.display = 'block';
                positionTooltipFromSvg(e, chart, tooltip);
            });

            chart.addEventListener('mouseleave', () => {
                if (activePoint) {
                    activePoint.classList.remove('perf-dist-point-active');
                    activePoint = null;
                }
                tooltip.style.display = 'none';
            });
        });
    }

    function positionTooltipFromSvg(event, chartEl, tooltip) {
        const rect = chartEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const tipWidth = tooltip.offsetWidth;
        const tipHeight = tooltip.offsetHeight;
        let left = x - tipWidth / 2;
        if (left < 0) left = 0;
        if (left + tipWidth > rect.width) left = rect.width - tipWidth;
        tooltip.style.left = left + 'px';
        tooltip.style.top = (y - tipHeight - 10) + 'px';
    }

    window.DetailEntriesDist = {
        generateHtml: generateEntriesDistributionGraph,
        parseEntryDate,
        getLocalDateKey,
        getDataTimeBounds,
        toLocalDateInputValue,
        applyTimeframeFilter,
        wireTooltips,
        wirePerfTooltips
    };
}());
