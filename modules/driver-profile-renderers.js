/**
 * Driver Profile Renderers Module
 * Pure rendering functions that take data and return HTML strings.
 */
const DriverProfileRenderers = (() => {

    /**
     * Render the profile header HTML.
     * @param {Object} profile - Profile data with name, country, rank, team, avatar, pathId, totalEntries
     * @returns {string} HTML string
     */
    function renderHeader(profile) {
        const escape = R3EUtils.escapeHtml;
        const flagHtml = FlagHelper.countryToFlag(profile.country)
            ? `<span class="country-flag">${FlagHelper.countryToFlag(profile.country)}</span>`
            : '';

        const avatarHtml = profile.avatar
            ? `<img class="driver-profile-avatar" src="${escape(profile.avatar)}" alt="${escape(profile.name)} avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
            : '<div class="driver-profile-avatar-placeholder"></div>';

        const mpResult = typeof resolveMpPosWithInactive === 'function' ? resolveMpPosWithInactive(profile.name, profile.pathId) : { position: null, inactive: false };
        const mpPos = mpResult.position;
        const mpPosInactive = mpResult.inactive;
        const inactiveLabel = mpPosInactive ? ' (inactive)' : '';
        const mpPosCssClass = mpPosInactive ? 'driver-profile-mp-pos-inactive' : 'driver-profile-mp-pos';
        const mpPosHtml = mpPos !== null
            ? `<span class="${mpPosCssClass}">Multiplayer #${mpPos}${inactiveLabel}</span>`
            : '';
        const nameClasses = typeof getMpPosNameClasses === 'function' ? getMpPosNameClasses(mpPos, { inactive: mpPosInactive }) : '';
        const nameClass = nameClasses ? ` ${nameClasses}` : '';

        const rankHtml = profile.rank ? R3EUtils.renderRankStars(profile.rank) : '';

        const teamPrefix = profile.team && !String(profile.team).toLowerCase().includes('team') ? 'Team ' : '';
        const teamHtml = profile.team
            ? `<div class="driver-profile-team">\uD83C\uDFC1 ${teamPrefix}${escape(profile.team)}</div>`
            : '';

        const raceRoomUrl = DriverProfileData.getRaceRoomProfileUrl(profile.pathId);
        const raceRoomLink = raceRoomUrl
            ? `<a class="driver-profile-raceroom-link" href="${escape(raceRoomUrl)}" target="_blank" rel="noopener noreferrer">View on RaceRoom \u2197</a>`
            : '';

        return [
            '<div class="driver-profile-header">',
            '<div class="driver-profile-identity">',
            avatarHtml,
            '<div class="driver-profile-info">',
            `<h2 class="driver-profile-name${nameClass}">${escape(profile.name)}</h2>`,
            '<div class="driver-profile-meta">',
            `<span class="driver-profile-country">${flagHtml} ${escape(profile.country)}</span>`,
            rankHtml ? `<span class="driver-profile-rank">${rankHtml}</span>` : '',
            mpPosHtml,
            '</div>',
            teamHtml,
            raceRoomLink,
            `<div class="driver-profile-entries-count"><a href="drivers.html?driver=${encodeURIComponent('"' + profile.name + '"')}${profile.pathId ? '&id=' + encodeURIComponent(profile.pathId) : ''}" class="driver-profile-entries-link">${profile.totalEntries} leaderboard entries</a></div>`,
            '</div>',
            '</div>',
            '</div>'
        ].join('');
    }

    /**
     * Render placeholder stat cards while loading.
     * @returns {string} HTML string
     */
    function renderStatsPlaceholders() {
        const metrics = window.DriverStatsService
            ? DriverStatsService.PROFILE_METRICS
            : [];
        if (!metrics.length) return '';

        const cards = metrics.map(m =>
            `<div class="driver-stat-card driver-stat-loading" id="stat-${m.key}">` +
            `<div class="driver-stat-label">${R3EUtils.escapeHtml(m.label)}</div>` +
            '<div class="driver-stat-value"><span class="driver-stat-spinner"></span></div>' +
            '<div class="driver-stat-position">Loading\u2026</div>' +
            '<div class="driver-stat-breakdown"></div>' +
            '</div>'
        ).join('');

        return '<div class="driver-stats-grid">' + cards + '</div>';
    }

    /**
     * Render the highlights section (most used car / track).
     * @param {Object} profile - Profile data with carDistribution, trackDistribution
     * @returns {string} HTML string
     */
    function renderHighlights(profile) {
        const carDist = profile.carDistribution;
        const trackDist = profile.trackDistribution;
        if ((!carDist || carDist.length === 0) && (!trackDist || trackDist.length === 0)) {
            return '';
        }

        const escape = R3EUtils.escapeHtml;
        const cards = [];

        if (carDist && carDist.length > 0) {
            const topCar = carDist[0];
            const carName = topCar.label;
            const carCount = topCar.value;

            let thumbnailUrl = '';
            if (window.CARS_DATA && Array.isArray(window.CARS_DATA)) {
                const nameLower = carName.toLowerCase();
                for (const cls of window.CARS_DATA) {
                    if (!cls.cars) continue;
                    const match = cls.cars.find(c => (c.car || '').toLowerCase() === nameLower);
                    if (match && match.thumbnail) {
                        thumbnailUrl = match.thumbnail.replace('-image-small.', '-image-big.');
                        break;
                    }
                }
            }

            const brandLogoUrl = (typeof R3EUtils !== 'undefined' && R3EUtils.resolveBrandLogoPath)
                ? R3EUtils.resolveBrandLogoPath(carName)
                : '';
            const { brand, model } = (typeof R3EUtils !== 'undefined' && R3EUtils.splitCarName)
                ? R3EUtils.splitCarName(carName)
                : { brand: carName, model: '' };
            const isDefault = brandLogoUrl.includes('logo-raceroom');
            const brandLogoHtml = brandLogoUrl
                ? `<img class="highlight-brand-logo${isDefault ? ' table-brand-logo-raceroom' : ''}" src="${escape(brandLogoUrl)}" alt="${escape(brand)} logo" loading="lazy" decoding="async" />`
                : '';

            const imgHtml = thumbnailUrl
                ? `<div class="highlight-image-wrap"><img class="highlight-car-image" src="${escape(thumbnailUrl)}" alt="${escape(carName)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></div>`
                : '';

            cards.push([
                '<div class="highlight-card highlight-card-car" data-car-label="' + escape(carName) + '">',
                '<div class="highlight-card-label">Most Used Car</div>',
                '<div class="highlight-card-body">',
                imgHtml,
                '<div class="highlight-card-info">',
                `<div class="highlight-card-name">${brandLogoHtml}<span class="highlight-car-text"><span class="car-brand">${escape(brand)}</span> <span class="car-model">${escape(model)}</span></span></div>`,
                `<div class="highlight-card-count">${carCount} leaderboard ${carCount === 1 ? 'entry' : 'entries'}</div>`,
                '</div>',
                '</div>',
                '</div>'
            ].join(''));
        }

        if (trackDist && trackDist.length > 0) {
            const topTrack = trackDist[0];
            const trackName = topTrack.label;
            const trackCount = topTrack.value;

            const resolveTrackLogo = (typeof window.R3ETrackImages !== 'undefined' && window.R3ETrackImages.resolveTrackLogoByLabel)
                ? window.R3ETrackImages.resolveTrackLogoByLabel
                : () => '';
            const trackLogoUrl = resolveTrackLogo(trackName);
            const trackLogoHtml = trackLogoUrl
                ? `<img class="highlight-track-logo" src="${escape(trackLogoUrl)}" alt="${escape(trackName)} logo" loading="lazy" decoding="async" />`
                : '';

            const trackParts = trackName.split(' - ');
            const trackMain = trackParts[0] || trackName;
            const trackLayout = trackParts.length > 1 ? trackParts.slice(1).join(' - ') : '';

            cards.push([
                '<div class="highlight-card highlight-card-track" data-track-label="' + escape(trackName) + '">',
                '<div class="highlight-card-label">Most Used Track</div>',
                '<div class="highlight-card-body">',
                trackLogoUrl ? `<div class="highlight-image-wrap"><div class="highlight-track-logo-wrap">${trackLogoHtml}</div></div>` : '',
                '<div class="highlight-card-info">',
                `<div class="highlight-card-name"><span class="highlight-track-text">${escape(trackMain)}${trackLayout ? ` <span class="track-layout">${escape(trackLayout)}</span>` : ''}</span></div>`,
                `<div class="highlight-card-count">${trackCount} leaderboard ${trackCount === 1 ? 'entry' : 'entries'}</div>`,
                '</div>',
                '</div>',
                '</div>'
            ].join(''));
        }

        return [
            '<div class="driver-profile-highlights-grid">',
            cards.join(''),
            '</div>'
        ].join('');
    }

    /**
     * Generate performance distribution graph HTML.
     * @param {Array} entries - Raw driver leaderboard entries
     * @returns {string} HTML string
     */
    function generatePerformanceGraph(entries) {
        const parseDate = window.DetailEntriesDist ? DetailEntriesDist.parseEntryDate : null;
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
        html += '<span class="entries-dist-toggle-icon">\u25BC</span>';
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
            const dateStr = DetailEntriesDist.getLocalDateKey(pt.date);
            const info = pt.car + (pt.track ? ' \u2013 ' + pt.track : '');
            html += '<span class="perf-dist-point" style="left:' + leftPct.toFixed(3) + '%;top:' + topPct.toFixed(3) + '%" data-date="' + dateStr + '" data-pct="' + pt.bestedPct.toFixed(1) + '" data-pos="' + pt.position + '" data-total="' + pt.total + '" data-info="' + escape(info) + '" data-class="' + escape(pt.carClass) + '" data-class-id="' + escape(String(pt.classId || '')) + '"></span>';
        });

        html += '</div>';

        const firstDate = DetailEntriesDist.getLocalDateKey(points[0].date);
        const lastDate = DetailEntriesDist.getLocalDateKey(points[points.length - 1].date);
        html += '<div class="entries-dist-axis">';
        html += '<span class="entries-dist-axis-left">' + firstDate + '</span>';
        html += '<span class="entries-dist-axis-right">' + lastDate + '</span>';
        html += '</div>';

        html += '</div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Render class breakdown lists into stat cards.
     * @param {Object} results - { [metricKey]: [{className, value, entryCount?}] }
     * @param {Map} classColorMap - Map of className → CSS color string
     * @returns {void} Mutates DOM directly (inserts into .driver-stat-breakdown elements)
     */
    function renderClassBreakdowns(results, classColorMap) {
        if (!results) return;
        const metrics = (window.DriverStatsService && DriverStatsService.PROFILE_METRICS) || [
            { key: 'avg_bested', label: 'Average Bested %', format: 'percent' },
            { key: 'bested', label: 'Drivers Bested', format: 'number' },
            { key: 'pole', label: 'Pole Positions', format: 'number' },
            { key: 'podium', label: 'Podiums', format: 'number' }
        ];
        const formatValue = (window.DriverStatsService && DriverStatsService.formatValue) ||
            function (v, fmt) { return fmt === 'percent' ? v.toFixed(1) + '%' : Number(v).toLocaleString(); };
        const colorMap = classColorMap || new Map();
        const fallbackColors = (window.PieChart && PieChart.COLORS) || [];

        metrics.forEach(metric => {
            const items = results[metric.key];
            const card = document.getElementById('stat-' + metric.key);
            if (!card) return;
            const container = card.querySelector('.driver-stat-breakdown');
            if (!container) return;

            if (!items || items.length === 0) return;

            const listItems = items.map((item, i) => {
                let displayValue = formatValue(item.value, metric.format);
                if (metric.key === 'avg_bested' && item.entryCount) {
                    displayValue += ' (' + item.entryCount + ')';
                }
                const color = colorMap.get(item.className) || fallbackColors[i % fallbackColors.length] || 'var(--color-text-muted)';
                return '<li class="pie-legend-item" data-class-label="' + R3EUtils.escapeHtml(item.className) + '">' +
                    '<span class="pie-legend-color" style="background:' + color + '"></span>' +
                    '<span class="pie-legend-label">' + R3EUtils.escapeHtml(item.className) + '</span>' +
                    '<span class="pie-legend-value">' + displayValue + '</span>' +
                    '</li>';
            }).join('');

            container.innerHTML = '<ul class="pie-legend stat-breakdown-list">' + listItems + '</ul>';
        });
    }

    return {
        renderHeader,
        renderStatsPlaceholders,
        renderHighlights,
        generatePerformanceGraph,
        renderClassBreakdowns
    };
})();

if (typeof window !== 'undefined') window.DriverProfileRenderers = DriverProfileRenderers;
if (typeof module !== 'undefined') module.exports = DriverProfileRenderers;
