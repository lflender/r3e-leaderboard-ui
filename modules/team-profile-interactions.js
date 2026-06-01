/**
 * Team Profile Interactions Module
 * Handles all cross-highlighting between team charts (entries distribution,
 * performance over time), the members table, and the entries table.
 *
 * All highlighting is driven by driver name, queried dynamically from a root
 * container to avoid stale DOM references after table re-renders.
 */
(function () {
    'use strict';

    /**
     * Highlight all elements for a given driver within the root container.
     * Covers: chart bars, chart points, legend items, table rows.
     * @param {HTMLElement} root - root container to query within
     * @param {string} name - driver name to highlight
     */
    function highlightDriver(root, name) {
        clearHighlights(root);
        if (!name || !root) return;
        const escaped = CSS.escape(name);

        // Table rows
        root.querySelectorAll('tr[data-name="' + escaped + '"]')
            .forEach(r => r.classList.add('driver-row-highlight'));

        // Entries dist bars
        root.querySelectorAll('.entries-dist-bar[data-name="' + escaped + '"]')
            .forEach(b => b.classList.add('entries-dist-bar--active'));

        // Performance points
        root.querySelectorAll('.perf-dist-point[data-name="' + escaped + '"]')
            .forEach(p => p.classList.add('perf-dist-point--active'));

        // Legend items
        root.querySelectorAll('.team-chart-legend-item').forEach(item => {
            const nameEl = item.querySelector('.team-chart-legend-name');
            if (nameEl && nameEl.textContent === name) {
                item.classList.add('team-legend--active');
            }
        });
    }

    /**
     * Clear all driver highlights within the root container.
     * @param {HTMLElement} root
     */
    function clearHighlights(root) {
        if (!root) return;
        root.querySelectorAll('tr.driver-row-highlight')
            .forEach(r => r.classList.remove('driver-row-highlight'));
        root.querySelectorAll('.entries-dist-bar--active')
            .forEach(el => el.classList.remove('entries-dist-bar--active'));
        root.querySelectorAll('.perf-dist-point--active')
            .forEach(el => el.classList.remove('perf-dist-point--active'));
        root.querySelectorAll('.team-legend--active')
            .forEach(el => el.classList.remove('team-legend--active'));
    }

    /**
     * Wire hover on a table's tbody to cross-highlight a driver everywhere.
     * Uses event delegation with mouseenter (capture) + mouseleave.
     * @param {HTMLElement} root - root container for highlighting
     * @param {HTMLElement} tableEl - the table element to wire
     */
    function wireTableHover(root, tableEl) {
        if (!root || !tableEl) return;
        const tbody = tableEl.querySelector('tbody');
        if (!tbody) return;

        let highlightedName = null;
        tbody.addEventListener('mouseenter', (e) => {
            const row = e.target.closest('tr[data-name]');
            if (!row) return;
            const name = row.getAttribute('data-name');
            if (name === highlightedName) return;
            highlightedName = name;
            highlightDriver(root, name);
        }, true);
        tbody.addEventListener('mouseleave', () => {
            highlightedName = null;
            clearHighlights(root);
        });
    }

    /**
     * Wire chart interactions (tooltips + cross-highlighting).
     * Replaces the old TeamCharts.wireInteractions for highlighting concerns,
     * while TeamCharts.wireInteractions still handles tooltip display.
     *
     * This wires the chart highlight/clear callbacks so chart hover propagates
     * to tables and other charts via the root container.
     * @param {HTMLElement} root - root container for highlighting
     * @param {HTMLElement} distContainer - entries distribution chart container
     * @param {HTMLElement} perfContainer - performance chart container
     */
    function wireChartInteractions(root, distContainer, perfContainer) {
        if (!root) return;

        const Tooltip = window.Tooltip;
        if (!Tooltip) return;

        // Performance chart proximity hover
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
                    clearHighlights(root);
                    if (activePoint) { activePoint.classList.remove('perf-dist-point--active'); activePoint = null; }
                    Tooltip.hide(tooltip);
                    return;
                }

                if (activePoint !== nearest) {
                    if (activePoint) activePoint.classList.remove('perf-dist-point--active');
                    nearest.classList.add('perf-dist-point--active');
                    activePoint = nearest;
                    highlightDriver(root, nearest.getAttribute('data-name'));
                }

                const date = nearest.getAttribute('data-date');
                const pct = nearest.getAttribute('data-pct');
                const pos = nearest.getAttribute('data-pos');
                const total = nearest.getAttribute('data-total');
                const info = nearest.getAttribute('data-info');
                const className = nearest.getAttribute('data-class') || '';
                const classId = nearest.getAttribute('data-class-id') || '';
                const logoHtml = window.EntriesChart
                    ? EntriesChart.buildClassLogoHtmlFromValues(className, classId)
                    : '';

                let tipHtml = '<strong>' + date + '</strong>: ' + pct + '% bested';
                if (pos && total) tipHtml += ' (P' + pos + '/' + total + ')';
                if (info) tipHtml += '<div class="dist-tooltip-entry">' + logoHtml + escapeHtml(info) + '</div>';
                tipHtml += '<div class="dist-tooltip-entry" style="color:var(--color-text-secondary)">' + escapeHtml(nearest.getAttribute('data-name')) + '</div>';
                tooltip.innerHTML = tipHtml;
                Tooltip.show(tooltip);
                Tooltip.positionAboveCursor(e, perfChart, tooltip);
            });

            perfChart.addEventListener('mouseleave', () => {
                clearHighlights(root);
                if (activePoint) { activePoint.classList.remove('perf-dist-point--active'); activePoint = null; }
                Tooltip.hide(tooltip);
            });
        }

        // Entries distribution chart bar hover
        const distChartEl = distContainer && distContainer.querySelector('.entries-dist-chart');
        if (distChartEl) {
            const svg = distChartEl.querySelector('svg');
            if (svg) {
                const tooltip = Tooltip.getOrCreate(distChartEl, 'dist-tooltip');
                const bars = Array.from(svg.querySelectorAll('.entries-dist-bar'));

                // Pre-group bars by date for column-based tooltip
                const barsByDate = new Map();
                for (const bar of bars) {
                    const date = bar.getAttribute('data-date');
                    if (!barsByDate.has(date)) barsByDate.set(date, []);
                    barsByDate.get(date).push(bar);
                }

                let activeBar = null;

                svg.addEventListener('mousemove', (e) => {
                    const rect = svg.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const viewBox = svg.viewBox.baseVal;
                    const mouseXRatio = (e.clientX - rect.left) / rect.width;
                    const mouseYRatio = (e.clientY - rect.top) / rect.height;
                    const svgX = mouseXRatio * viewBox.width;
                    const svgY = mouseYRatio * viewBox.height;

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
                        clearHighlights(root);
                        activeBar = null;
                        Tooltip.hide(tooltip);
                        return;
                    }

                    if (activeBar !== nearest) {
                        activeBar = nearest;
                        highlightDriver(root, nearest.getAttribute('data-name'));
                    }

                    // Build tooltip showing ALL entries for this date column
                    const date = nearest.getAttribute('data-date');
                    const dayBars = barsByDate.get(date) || [];
                    const count = dayBars.length;
                    let tipHtml = '<strong>' + date + '</strong>: ' + count + (count === 1 ? ' entry' : ' entries');
                    if (dayBars.length > 0) {
                        tipHtml += '<div class="dist-tooltip-entries">';
                        for (const bar of dayBars) {
                            const name = bar.getAttribute('data-name') || '';
                            const car = bar.getAttribute('data-car') || '';
                            const track = bar.getAttribute('data-track') || '';
                            const className = bar.getAttribute('data-class') || '';
                            const classId = bar.getAttribute('data-class-id') || '';
                            const logoHtml = window.EntriesChart
                                ? EntriesChart.buildClassLogoHtmlFromValues(className, classId)
                                : '';
                            const label = name + (car ? ' \u2014 ' + car : '') + (track ? ' \u2013 ' + track : '');
                            tipHtml += '<div class="dist-tooltip-entry">' + logoHtml + escapeHtml(label) + '</div>';
                        }
                        tipHtml += '</div>';
                    }
                    tooltip.innerHTML = tipHtml;
                    Tooltip.show(tooltip);
                    Tooltip.positionAboveCursor(e, distChartEl, tooltip);
                });

                svg.addEventListener('mouseleave', () => {
                    clearHighlights(root);
                    activeBar = null;
                    Tooltip.hide(tooltip);
                });
            }
        }

        // Legend hover
        const allContainers = [distContainer, perfContainer].filter(Boolean);
        for (const container of allContainers) {
            const legendItems = container.querySelectorAll('.team-chart-legend-item');
            legendItems.forEach(item => {
                const nameEl = item.querySelector('.team-chart-legend-name');
                if (!nameEl) return;
                const driverName = nameEl.textContent;

                item.addEventListener('mouseenter', () => {
                    highlightDriver(root, driverName);
                });
                item.addEventListener('mouseleave', () => {
                    clearHighlights(root);
                });
            });
        }
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const TeamProfileInteractions = {
        highlightDriver,
        clearHighlights,
        wireTableHover,
        wireChartInteractions
    };

    if (typeof window !== 'undefined') window.TeamProfileInteractions = TeamProfileInteractions;
    if (typeof module !== 'undefined') module.exports = TeamProfileInteractions;
}());
