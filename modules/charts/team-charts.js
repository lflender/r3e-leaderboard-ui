/**
 * Team Charts Module
 * Generates Entries Distribution and Performance Over Time charts
 * for the team profile page, with per-member coloring and cross-highlighting.
 *
 * Reuses the standard chart structures (.perf-dist-chart, .perf-dist-point,
 * .entries-dist-chart, .entries-dist-bar) and their existing CSS from
 * performance-chart.css / entries-chart.css. Extends with per-driver coloring
 * via inline styles and cross-chart driver highlighting.
 */
(function () {
    'use strict';

    // Reuse the shared PieChart palette for consistency across all charts
    const COLORS = window.PieChart && window.PieChart.COLORS
        ? window.PieChart.COLORS
        : [
            '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
            '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
            '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#10b981',
            '#f43f5e', '#7c3aed', '#2dd4bf', '#fb923c', '#818cf8'
        ];

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function parseEntryDate(entry) {
        return window.EntriesChart
            ? EntriesChart.parseEntryDate(entry)
            : null;
    }

    function getLocalDateKey(date) {
        return window.EntriesChart
            ? EntriesChart.getLocalDateKey(date)
            : '';
    }

    /**
     * Build a member-to-color map from entries.
     * @param {Array} entries - team entries with .name
     * @returns {Map<string, string>} memberName → color
     */
    function buildColorMap(entries) {
        const map = new Map();
        let idx = 0;
        for (const e of entries) {
            const name = e.name || e.Name || '';
            if (name && !map.has(name)) {
                map.set(name, COLORS[idx % COLORS.length]);
                idx++;
            }
        }
        return map;
    }

    /**
     * Generate the Entries Distribution chart (stacked bars per day, colored by member).
     * Uses standard .entries-dist-chart / .entries-dist-bar classes.
     * @param {Array} entries
     * @param {Map<string,string>} colorMap
     * @returns {string} HTML
     */
    function generateEntriesDistribution(entries, colorMap) {
        if (!Array.isArray(entries) || entries.length === 0) return '';

        const dayMap = new Map();
        let minDate = null, maxDate = null;

        for (const entry of entries) {
            const dt = parseEntryDate(entry);
            if (!dt) continue;
            const key = getLocalDateKey(dt);
            if (!key) continue;
            if (!dayMap.has(key)) dayMap.set(key, []);
            dayMap.get(key).push(entry);
            if (!minDate || dt < minDate) minDate = dt;
            if (!maxDate || dt > maxDate) maxDate = dt;
        }

        if (!minDate || !maxDate) return '';

        const start = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
        const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

        const dayKeys = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dayKeys.push(getLocalDateKey(d));
        }

        const maxCount = Math.max(1, ...Array.from(dayMap.values()).map(arr => arr.length));
        const chartHeight = 100;
        const chartWidth = Math.max(dayKeys.length, 1);

        let html = '<div class="entries-dist-summary">';
        html += '<button type="button" class="entries-dist-toggle expanded" aria-expanded="true">';
        html += '<span class="entries-dist-toggle__icon">\u25BC</span>';
        html += '<span class="entries-dist-toggle-text">Entries Distribution Graph</span>';
        html += '</button>';
        html += '<div class="entries-dist-content">';
        html += '<div class="entries-dist-chart" role="img" aria-label="Team entries distribution per day">';
        html += '<svg viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '" preserveAspectRatio="none" aria-hidden="true">';

        dayKeys.forEach((key, idx) => {
            const dayEntries = dayMap.get(key) || [];
            let yOffset = chartHeight;
            for (const entry of dayEntries) {
                const name = entry.name || entry.Name || '';
                const color = colorMap.get(name) || '#666';
                const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
                const carClass = entry.car_class || entry.CarClass || entry.Class || '';
                const classId = entry.class_id || entry.ClassID || entry.classId || '';
                const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                    ? window.R3EUtils.resolveTrackLabelForItem(entry)
                    : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');
                const segH = Math.max(0.8, chartHeight / maxCount);
                yOffset -= segH;
                html += '<rect class="entries-dist-bar" x="' + idx + '" y="' + Math.max(0, yOffset).toFixed(2) + '" width="0.9" height="' + segH.toFixed(2) + '" style="fill:' + color + '" data-date="' + key + '" data-name="' + escapeHtml(name) + '" data-car="' + escapeHtml(car) + '" data-track="' + escapeHtml(track) + '" data-class="' + escapeHtml(carClass) + '" data-class-id="' + escapeHtml(String(classId || '')) + '">';
                html += '<title>' + key + ': ' + escapeHtml(name) + '</title>';
                html += '</rect>';
            }
        });

        html += '</svg></div>';
        html += '<div class="entries-dist-axis">';
        html += '<span class="entries-dist-axis-left">' + dayKeys[0] + '</span>';
        html += '<span class="entries-dist-axis-right">' + dayKeys[dayKeys.length - 1] + '</span>';
        html += '</div>';
        html += generateLegend(colorMap);
        html += '</div></div>';

        return html;
    }

    /**
     * Generate Performance Over Time scatter chart (colored by member).
     * Uses standard .perf-dist-chart / .perf-dist-point classes.
     * @param {Array} entries
     * @param {Map<string,string>} colorMap
     * @returns {string} HTML
     */
    function generatePerformanceChart(entries, colorMap) {
        if (!Array.isArray(entries) || entries.length === 0) return '';

        const points = [];
        for (const entry of entries) {
            const dt = parseEntryDate(entry);
            if (!dt) continue;
            const pos = parseInt(entry.position || entry.Position || 0);
            const total = parseInt(entry.total_entries || entry.TotalEntries || 0);
            if (!pos || !total || total < 2) continue;
            const bestedPct = ((total - pos) / (total - 1)) * 100;
            const name = entry.name || entry.Name || '';
            const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
            const carClass = entry.car_class || entry.CarClass || entry.Class || '';
            const classId = entry.class_id || entry.ClassID || entry.classId || '';
            const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                ? window.R3EUtils.resolveTrackLabelForItem(entry)
                : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');
            points.push({ date: dt, bestedPct, name, car, carClass, classId, track, position: pos, total });
        }

        if (points.length === 0) return '';

        points.sort((a, b) => a.date - b.date);

        const escape = R3EUtils.escapeHtml;

        let html = '<div class="entries-dist-summary perf-dist-summary">';
        html += '<button type="button" class="entries-dist-toggle expanded" aria-expanded="true">';
        html += '<span class="entries-dist-toggle__icon">\u25BC</span>';
        html += '<span class="entries-dist-toggle-text">Performance Over Time</span>';
        html += '</button>';
        html += '<div class="entries-dist-content">';
        html += '<div class="perf-dist-chart" role="img" aria-label="Team performance over time">';
        html += '<span class="perf-dist-y-label perf-dist-y-top">100%</span>';
        html += '<span class="perf-dist-y-label perf-dist-y-mid">50%</span>';
        html += '<span class="perf-dist-y-label perf-dist-y-bottom">0%</span>';
        html += '<div class="perf-dist-grid-line" style="top:25%"></div>';
        html += '<div class="perf-dist-grid-line" style="top:50%"></div>';
        html += '<div class="perf-dist-grid-line" style="top:75%"></div>';

        const totalPoints = points.length;
        points.forEach((pt, idx) => {
            const leftPct = ((idx + 0.5) / totalPoints) * 100;
            const topPct = 100 - pt.bestedPct;
            const color = colorMap.get(pt.name) || '#666';
            const dateStr = getLocalDateKey(pt.date);
            const info = pt.car + (pt.track ? ' \u2013 ' + pt.track : '');
            html += '<span class="perf-dist-point" style="left:' + leftPct.toFixed(3) + '%;top:' + topPct.toFixed(3) + '%;background:' + color + '" data-date="' + dateStr + '" data-name="' + escape(pt.name) + '" data-pct="' + pt.bestedPct.toFixed(1) + '" data-pos="' + pt.position + '" data-total="' + pt.total + '" data-info="' + escape(info) + '" data-class="' + escape(pt.carClass) + '" data-class-id="' + escape(String(pt.classId || '')) + '"></span>';
        });

        html += '</div>';
        html += '<div class="entries-dist-axis">';
        html += '<span class="entries-dist-axis-left">' + getLocalDateKey(points[0].date) + '</span>';
        html += '<span class="entries-dist-axis-right">' + getLocalDateKey(points[points.length - 1].date) + '</span>';
        html += '</div>';
        html += generateLegend(colorMap);
        html += '</div></div>';

        return html;
    }

    /**
     * Generate the color legend for team members.
     * @param {Map<string,string>} colorMap
     * @returns {string} HTML
     */
    function generateLegend(colorMap) {
        if (colorMap.size === 0) return '';
        let html = '<div class="team-chart-legend">';
        for (const [name, color] of colorMap) {
            html += '<span class="team-chart-legend-item">';
            html += '<span class="team-chart-legend-dot" style="background:' + color + '"></span>';
            html += '<span class="team-chart-legend-name">' + escapeHtml(name) + '</span>';
            html += '</span>';
        }
        html += '</div>';
        return html;
    }

    /**
     * Wire tooltip and cross-highlighting for team charts.
     * Extends the standard tooltip behavior from EntriesChart with per-driver
     * highlighting across both chart containers and optional table elements.
     * @param {HTMLElement} distContainer - container with the entries dist chart
     * @param {HTMLElement} perfContainer - container with the performance chart
     * @param {Object} [options] - additional elements to cross-highlight
     * @param {HTMLElement[]} [options.tables] - table elements with rows having data-name
     */
    function wireInteractions(distContainer, perfContainer, options) {
        const Tooltip = window.Tooltip;
        if (!Tooltip) return;

        const allContainers = [distContainer, perfContainer].filter(Boolean);
        const tables = (options && options.tables) || [];

        // Wire performance chart (reuses same proximity logic as EntriesChart.wirePerfTooltips)
        const perfChart = perfContainer && perfContainer.querySelector('.perf-dist-chart');
        if (perfChart) {
            const tooltip = Tooltip.getOrCreate(perfChart, 'dist-tooltip');
            const points = Array.from(perfChart.querySelectorAll('.perf-dist-point'));
            let activePoint = null;

            perfChart.addEventListener('mousemove', (e) => {
                const rect = perfChart.getBoundingClientRect();
                if (rect.width === 0) return;
                const mouseXPct = ((e.clientX - rect.left) / rect.width) * 100;

                let nearest = null;
                let minDist = Infinity;
                for (const p of points) {
                    const left = parseFloat(p.style.left);
                    const dist = Math.abs(left - mouseXPct);
                    if (dist < minDist) { minDist = dist; nearest = p; }
                }

                if (!nearest) {
                    clearAllHighlights(allContainers, tables);
                    if (activePoint) { activePoint.classList.remove('perf-dist-point--active'); activePoint = null; }
                    Tooltip.hide(tooltip);
                    return;
                }

                if (activePoint !== nearest) {
                    if (activePoint) activePoint.classList.remove('perf-dist-point--active');
                    nearest.classList.add('perf-dist-point--active');
                    activePoint = nearest;
                    highlightDriver(allContainers, nearest.getAttribute('data-name'), tables);
                }

                // Tooltip format matches EntriesChart.wirePerfTooltips
                const date = nearest.getAttribute('data-date');
                const pct = nearest.getAttribute('data-pct');
                const pos = nearest.getAttribute('data-pos');
                const total = nearest.getAttribute('data-total');
                const info = nearest.getAttribute('data-info');
                const className = nearest.getAttribute('data-class') || '';
                const classId = nearest.getAttribute('data-class-id') || '';
                const logoHtml = EntriesChart.buildClassLogoHtmlFromValues(className, classId);

                let tipHtml = '<strong>' + date + '</strong>: ' + pct + '% bested';
                if (pos && total) tipHtml += ' (P' + pos + '/' + total + ')';
                if (info) tipHtml += '<div class="dist-tooltip-entry">' + logoHtml + escapeHtml(info) + '</div>';
                tipHtml += '<div class="dist-tooltip-entry" style="color:var(--color-text-secondary)">' + escapeHtml(nearest.getAttribute('data-name')) + '</div>';
                tooltip.innerHTML = tipHtml;
                Tooltip.show(tooltip);
                Tooltip.positionAboveCursor(e, perfChart, tooltip);
            });

            perfChart.addEventListener('mouseleave', () => {
                clearAllHighlights(allContainers, tables);
                if (activePoint) { activePoint.classList.remove('perf-dist-point--active'); activePoint = null; }
                Tooltip.hide(tooltip);
            });
        }

        // Wire entries distribution chart — snap to nearest bar, highlight ALL
        // bars + perf points for that player (cross-chart driver highlighting)
        const distChartEl = distContainer && distContainer.querySelector('.entries-dist-chart');
        if (distChartEl) {
            const svg = distChartEl.querySelector('svg');
            if (svg) {
                const tooltip = Tooltip.getOrCreate(distChartEl, 'dist-tooltip');
                const bars = Array.from(svg.querySelectorAll('.entries-dist-bar'));

                let activeBar = null;

                svg.addEventListener('mousemove', (e) => {
                    const rect = svg.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const viewBox = svg.viewBox.baseVal;
                    const mouseXRatio = (e.clientX - rect.left) / rect.width;
                    const mouseYRatio = (e.clientY - rect.top) / rect.height;
                    const svgX = mouseXRatio * viewBox.width;
                    const svgY = mouseYRatio * viewBox.height;

                    // Find the nearest bar by 2D distance (normalized)
                    let nearest = null;
                    let minDist = Infinity;
                    for (const bar of bars) {
                        const bx = parseFloat(bar.getAttribute('x')) + 0.45;
                        const by = parseFloat(bar.getAttribute('y')) + parseFloat(bar.getAttribute('height')) / 2;
                        const dx = (bx - svgX) / viewBox.width;
                        const dy = (by - svgY) / viewBox.height;
                        const dist = dx * dx + dy * dy;
                        if (dist < minDist) { minDist = dist; nearest = bar; }
                    }

                    if (!nearest) {
                        clearAllHighlights(allContainers, tables);
                        activeBar = null;
                        Tooltip.hide(tooltip);
                        return;
                    }

                    if (activeBar !== nearest) {
                        activeBar = nearest;
                        const driverName = nearest.getAttribute('data-name');
                        highlightDriver(allContainers, driverName, tables);
                    }

                    // Build tooltip for the hovered bar
                    const date = nearest.getAttribute('data-date');
                    const name = nearest.getAttribute('data-name');
                    const car = nearest.getAttribute('data-car') || '';
                    const track = nearest.getAttribute('data-track') || '';
                    const className = nearest.getAttribute('data-class') || '';
                    const classId = nearest.getAttribute('data-class-id') || '';
                    const logoHtml = EntriesChart.buildClassLogoHtmlFromValues(className, classId);
                    const label = car + (track ? ' \u2013 ' + track : '');
                    let tipHtml = '<strong>' + date + '</strong>';
                    tipHtml += '<div class="dist-tooltip-entry">' + logoHtml + escapeHtml(name) + (label ? ' — ' + escapeHtml(label) : '') + '</div>';
                    tooltip.innerHTML = tipHtml;
                    Tooltip.show(tooltip);
                    Tooltip.positionAboveCursor(e, distChartEl, tooltip);
                });

                svg.addEventListener('mouseleave', () => {
                    clearAllHighlights(allContainers, tables);
                    activeBar = null;
                    Tooltip.hide(tooltip);
                });
            }
        }

        // Wire legend hover — highlight driver across all charts
        for (const container of allContainers) {
            const legendItems = container.querySelectorAll('.team-chart-legend-item');
            legendItems.forEach(item => {
                const nameEl = item.querySelector('.team-chart-legend-name');
                if (!nameEl) return;
                const driverName = nameEl.textContent;

                item.addEventListener('mouseenter', () => {
                    highlightDriver(allContainers, driverName, tables);
                });
                item.addEventListener('mouseleave', () => {
                    clearAllHighlights(allContainers, tables);
                });
            });
        }
    }

    /**
     * Highlight all points/bars from the given driver across all containers and tables.
     */
    function highlightDriver(containers, driverName, tables) {
        clearAllHighlights(containers, tables);
        if (!driverName) return;
        const escaped = CSS.escape(driverName);
        for (const container of containers) {
            if (!container) continue;
            container.querySelectorAll('.perf-dist-point[data-name="' + escaped + '"]')
                .forEach(p => p.classList.add('perf-dist-point--active'));
            container.querySelectorAll('.entries-dist-bar[data-name="' + escaped + '"]')
                .forEach(b => b.classList.add('entries-dist-bar--active'));
            container.querySelectorAll('.team-chart-legend-item').forEach(item => {
                const nameEl = item.querySelector('.team-chart-legend-name');
                if (nameEl && nameEl.textContent === driverName) {
                    item.classList.add('team-legend--active');
                }
            });
        }
        if (tables) {
            for (const table of tables) {
                if (!table) continue;
                table.querySelectorAll('tr[data-name="' + escaped + '"]')
                    .forEach(r => r.classList.add('driver-row-highlight'));
            }
        }
    }

    function clearAllHighlights(containers, tables) {
        for (const container of containers) {
            if (!container) continue;
            container.querySelectorAll('.perf-dist-point--active').forEach(el => el.classList.remove('perf-dist-point--active'));
            container.querySelectorAll('.entries-dist-bar--active').forEach(el => el.classList.remove('entries-dist-bar--active'));
            container.querySelectorAll('.team-legend--active').forEach(el => el.classList.remove('team-legend--active'));
        }
        if (tables) {
            for (const table of tables) {
                if (!table) continue;
                table.querySelectorAll('tr.driver-row-highlight').forEach(el => el.classList.remove('driver-row-highlight'));
            }
        }
    }

    window.TeamCharts = {
        buildColorMap,
        generateEntriesDistribution,
        generatePerformanceChart,
        wireInteractions
    };
}());
