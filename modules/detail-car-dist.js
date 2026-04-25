/**
 * Car Distribution Summary module for the Detail page.
 * Exposes window.DetailCarDist with functions:
 *   - getStats(data) → sorted stats array
 *   - generateHtml(data, sortBy, sortDir, isExpanded) → HTML string
 */
(function () {
    'use strict';

    function getCarDistributionStats(data) {
        const carStats = {};

        data.forEach(entry => {
            const car = entry.Car || entry.car || 'Unknown';
            const position = parseInt(entry.Position || entry.position || entry.Pos || 0);

            if (!carStats[car]) {
                carStats[car] = { car, positions: [], entries: 0 };
            }
            carStats[car].entries++;
            if (position > 0) {
                carStats[car].positions.push(position);
            }
        });

        const total = data.length;

        const stats = Object.values(carStats).map(stat => {
            const sortedPositions = stat.positions.sort((a, b) => a - b);
            let median = 0;
            if (sortedPositions.length > 0) {
                const mid = Math.floor(sortedPositions.length / 2);
                median = sortedPositions.length % 2 === 0
                    ? (sortedPositions[mid - 1] + sortedPositions[mid]) / 2
                    : sortedPositions[mid];
            }
            return {
                car: stat.car,
                entries: stat.entries,
                percentage: ((stat.entries / total) * 100).toFixed(1),
                medianPosition: median
            };
        });

        stats.sort((a, b) => b.entries - a.entries);
        return stats;
    }

    function generateCarDistributionSummary(data, sortBy = 'entries', sortDir = 'desc', isExpanded = false) {
        let stats = getCarDistributionStats(data);

        if (sortBy === 'entries') {
            stats.sort((a, b) => sortDir === 'desc' ? b.entries - a.entries : a.entries - b.entries);
        } else if (sortBy === 'median') {
            stats.sort((a, b) => {
                const aVal = a.medianPosition > 0 ? a.medianPosition : Infinity;
                const bVal = b.medianPosition > 0 ? b.medianPosition : Infinity;
                return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
            });
        }

        const summaryId = 'car-dist-summary-' + Date.now();
        const utils = window.R3EUtils;

        let html = '<div class="car-dist-summary" data-sort-by="' + sortBy + '" data-sort-dir="' + sortDir + '">';
        html += '<button type="button" class="car-dist-toggle' + (isExpanded ? ' expanded' : '') + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '" aria-controls="' + summaryId + '">';
        html += '<span class="car-dist-toggle-icon">▼</span>';
        html += '<span class="car-dist-toggle-text">Car Distribution Summary</span>';
        html += '</button>';

        html += '<div id="' + summaryId + '" class="car-dist-content" style="display: ' + (isExpanded ? '' : 'none') + ';">';
        html += '<table class="car-dist-table">';
        html += '<thead><tr>';
        html += '<th class="car-dist-car">Car</th>';

        let entriesClass = 'car-dist-entries sortable';
        let entriesIndicator = '⇅';
        if (sortBy === 'entries') { entriesClass += ' sort-active'; entriesIndicator = sortDir === 'desc' ? '▼' : '▲'; }
        html += '<th class="' + entriesClass + '" data-sort="entries"><span class="sort-label">Nb</span><span class="sort-indicator">' + entriesIndicator + '</span></th>';

        html += '<th class="car-dist-percentage">%</th>';

        let medianClass = 'car-dist-median sortable';
        let medianIndicator = '⇅';
        if (sortBy === 'median') { medianClass += ' sort-active'; medianIndicator = sortDir === 'desc' ? '▼' : '▲'; }
        html += '<th class="' + medianClass + '" data-sort="median"><span class="sort-label car-dist-median-label">Median</span><span class="sort-indicator">' + medianIndicator + '</span></th>';

        html += '</tr></thead><tbody>';

        stats.forEach(stat => {
            const { brand: carBrand, model: carModel } = utils.splitCarName(stat.car);
            const brandLogoUrl = (typeof utils.resolveBrandLogoPath === 'function')
                ? utils.resolveBrandLogoPath(stat.car)
                : '';
            const brandLogoHtml = brandLogoUrl
                ? `<img class="car-dist-brand-logo" src="${utils.escapeHtml(brandLogoUrl)}" alt="${utils.escapeHtml(carBrand)} logo" width="36" height="20" loading="lazy" decoding="async" />`
                : '';
            let carHtml = '<span class="car-brand">' + utils.escapeHtml(carBrand) + '</span>';
            if (carModel) { carHtml += ' <span class="car-model">' + utils.escapeHtml(carModel) + '</span>'; }

            html += '<tr>';
            html += '<td class="car-dist-car"><span class="car-dist-car-cell">' + brandLogoHtml + '<span>' + carHtml + '</span></span></td>';
            html += '<td class="car-dist-entries">' + stat.entries + '</td>';
            html += '<td class="car-dist-percentage">' + stat.percentage + '%</td>';
            html += '<td class="car-dist-median">' + (stat.medianPosition > 0 ? Math.round(stat.medianPosition) : '-') + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    window.DetailCarDist = {
        getStats: getCarDistributionStats,
        generateHtml: generateCarDistributionSummary
    };
}());
