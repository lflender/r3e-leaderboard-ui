/**
 * Performance Chart Module
 * Generates the "Performance Over Time" scatter chart for the driver profile page.
 */
const PerformanceChart = (() => {
    'use strict';

    /**
     * Generate performance distribution graph HTML.
     * @param {Array} entries - Raw driver leaderboard entries
     * @returns {string} HTML string
     */
    function generateHtml(entries) {
        const parseDate = window.EntriesChart ? EntriesChart.parseEntryDate : null;
        if (!parseDate) return '';

        const points = [];
        entries.forEach(entry => {
            const dt = parseDate(entry);
            if (!dt) return;
            const pos = entry.position;
            const total = entry.total_entries;
            if (!pos || !total || total < 2) return;
            const bestedPct = ((total - pos) / (total - 1)) * 100;
            const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
            const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                ? window.R3EUtils.resolveTrackLabelForItem(entry)
                : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');
            const carClass = entry.car_class || entry.CarClass || entry.Class || '';
            const classId = entry.class_id || entry.ClassID || entry.classId || '';
            points.push({ date: dt, bestedPct, car, track, carClass, classId, position: pos, total });
        });

        if (points.length === 0) return '';

        points.sort((a, b) => a.date - b.date);

        const summaryId = 'perf-dist-summary-' + Date.now();
        const escape = R3EUtils.escapeHtml;

        let html = '<div class="driver-profile-dist-card">';
        html += '<div class="entries-dist-summary perf-dist-summary">';
        html += '<button type="button" class="entries-dist-toggle expanded" aria-expanded="true" aria-controls="' + summaryId + '">';
        html += '<span class="entries-dist-toggle__icon">\u25BC</span>';
        html += '<span class="entries-dist-toggle-text">Performance Over Time</span>';
        html += '</button>';

        html += '<div id="' + summaryId + '" class="entries-dist-content">';

        html += '<div class="perf-dist-chart" role="img" aria-label="Performance over time showing bested percentage for each entry">';
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
            const dateStr = EntriesChart.getLocalDateKey(pt.date);
            const info = pt.car + (pt.track ? ' \u2013 ' + pt.track : '');
            html += '<span class="perf-dist-point" style="left:' + leftPct.toFixed(3) + '%;top:' + topPct.toFixed(3) + '%" data-date="' + dateStr + '" data-pct="' + pt.bestedPct.toFixed(1) + '" data-pos="' + pt.position + '" data-total="' + pt.total + '" data-info="' + escape(info) + '" data-class="' + escape(pt.carClass) + '" data-class-id="' + escape(String(pt.classId || '')) + '"></span>';
        });

        html += '</div>';

        const firstDate = EntriesChart.getLocalDateKey(points[0].date);
        const lastDate = EntriesChart.getLocalDateKey(points[points.length - 1].date);
        html += '<div class="entries-dist-axis">';
        html += '<span class="entries-dist-axis-left">' + firstDate + '</span>';
        html += '<span class="entries-dist-axis-right">' + lastDate + '</span>';
        html += '</div>';

        html += '</div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    return { generateHtml };
})();

if (typeof window !== 'undefined') window.PerformanceChart = PerformanceChart;
if (typeof module !== 'undefined') module.exports = PerformanceChart;
