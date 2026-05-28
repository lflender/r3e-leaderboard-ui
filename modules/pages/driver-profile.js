/**
 * Driver Profile Page Module
 * Handles rendering and interaction for the driver profile page
 */
class DriverProfile {
    constructor() {
        this.elements = {
            profileContainer: document.getElementById('driver-profile-container'),
            profileHeader: document.getElementById('driver-profile-header'),
            chartsContainer: document.getElementById('driver-profile-charts')
        };

        if (!this.elements.profileContainer) return;

        this.init();
    }

    async init() {
        const driverParam = R3EUtils.getUrlParam('driver');
        const idParam = R3EUtils.getUrlParam('id');
        if (!driverParam && !idParam) {
            this.showError('No driver specified. Go to the <a href="drivers.html">Driver Search</a> to find a driver.');
            return;
        }

        await TemplateHelper.showLoading(this.elements.profileContainer, 'Loading driver profile...');

        try {
            const searchTerm = driverParam || `"${idParam}"`;
            const [, , results] = await Promise.all([
                loadMpPosCache(),
                typeof loadMpPosInactiveCache === 'function' ? loadMpPosInactiveCache() : Promise.resolve(),
                dataService.searchDriver(searchTerm, {})
            ]);

            if (!Array.isArray(results) || results.length === 0) {
                const displayName = driverParam ? driverParam.replace(/^"|"$/g, '') : idParam;
                this.showError(`Driver "${R3EUtils.escapeHtml(displayName)}" not found. <a href="drivers.html">Back to search</a>.`);
                return;
            }

            // Select the correct driver group by pathId when available
            const driverGroup = this.findDriverGroup(results, idParam);
            const profileData = DriverProfileData.buildProfileData(driverGroup);

            this.renderProfile(profileData, driverGroup.entries);
            this.trackProfileShown(profileData);
        } catch (error) {
            console.error('Driver profile error:', error);
            this.showError('Failed to load driver profile. Please try again later.');
        }
    }

    /**
     * Find the correct driver group from search results by pathId.
     * Falls back to the first result when no pathId match is found.
     * @param {Array} results - Search result groups
     * @param {string|null} pathId - Target pathId from URL
     * @returns {Object} Matching driver group
     */
    findDriverGroup(results, pathId) {
        if (pathId) {
            const match = results.find(g => String(g.pathId || '') === String(pathId));
            if (match) return match;
        }
        return results[0];
    }

    /**
     * Render the full profile page
     * @param {Object} profile - Profile data from DriverProfileData.buildProfileData
     */
    renderProfile(profile, entries) {
        this.elements.profileContainer.innerHTML =
            '<div id="driver-profile-header"></div>' +
            '<div id="driver-profile-stats"></div>' +
            '<div id="driver-profile-highlights"></div>' +
            '<div id="driver-profile-distributions"></div>' +
            '<div id="driver-profile-charts"></div>';
        this.elements.profileHeader = document.getElementById('driver-profile-header');
        this.elements.statsContainer = document.getElementById('driver-profile-stats');
        this.elements.highlightsContainer = document.getElementById('driver-profile-highlights');
        this.elements.distributionsContainer = document.getElementById('driver-profile-distributions');
        this.elements.chartsContainer = document.getElementById('driver-profile-charts');

        this.renderHeader(profile);
        this.renderStatsPlaceholders();
        this.loadStats(profile.name, profile.pathId);
        this.renderHighlights(profile);
        this.renderDistributions(entries || []);
        this.renderCharts(profile, entries || []);
        this.scheduleClassBreakdowns(entries || []);
    }

    trackProfileShown(profile) {
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
        R3EAnalytics.track('driver profile page shown', {
            driver_name: profile.name || '',
            country: profile.country || '',
            total_entries: profile.totalEntries || 0,
            has_team: !!profile.team,
            has_avatar: !!profile.avatar
        });
    }

    /**
     * Render the profile header section
     * @param {Object} profile - Profile data
     */
    renderHeader(profile) {
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
            ? `<div class="driver-profile-team">🏁 ${teamPrefix}${escape(profile.team)}</div>`
            : '';

        const raceRoomUrl = DriverProfileData.getRaceRoomProfileUrl(profile.pathId);
        const raceRoomLink = raceRoomUrl
            ? `<a class="driver-profile-raceroom-link" href="${escape(raceRoomUrl)}" target="_blank" rel="noopener noreferrer">View on RaceRoom ↗</a>`
            : '';

        const headerHtml = [
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

        this.elements.profileHeader.innerHTML = headerHtml;
    }

    /**
     * Render placeholder cards for stats while loading
     */
    renderStatsPlaceholders() {
        const metrics = window.DriverStatsService
            ? DriverStatsService.PROFILE_METRICS
            : [];
        if (!metrics.length) return;

        const cards = metrics.map(m =>
            `<div class="driver-stat-card driver-stat-loading" id="stat-${m.key}">` +
            `<div class="driver-stat-label">${R3EUtils.escapeHtml(m.label)}</div>` +
            '<div class="driver-stat-value"><span class="driver-stat-spinner"></span></div>' +
            '<div class="driver-stat-position">Loading\u2026</div>' +
            '<div class="driver-stat-breakdown"></div>' +
            '</div>'
        ).join('');

        this.elements.statsContainer.innerHTML =
            '<div class="driver-stats-grid">' + cards + '</div>';
    }

    /**
     * Asynchronously load stats and update each card independently as data arrives
     * @param {string} driverName - Driver name to look up
     */
    loadStats(driverName, pathId) {
        if (!window.DriverStatsService) return;

        const metrics = DriverStatsService.PROFILE_METRICS;
        metrics.forEach(metric => {
            DriverStatsService.lookupSingleStat(driverName, metric.key, pathId)
                .then(result => {
                    const card = document.getElementById('stat-' + metric.key);
                    if (!card) return;

                    card.classList.remove('driver-stat-loading');

                    const valueEl = card.querySelector('.driver-stat-value');
                    const posEl = card.querySelector('.driver-stat-position');

                    if (result) {
                        valueEl.textContent = DriverStatsService.formatValue(
                            result.value, metric.format
                        );
                        posEl.textContent = '#' + result.position.toLocaleString() +
                            ' of ' + result.total.toLocaleString();
                    } else {
                        card.classList.add('driver-stat-not-ranked');
                        valueEl.textContent = '—';
                        posEl.textContent = 'Not ranked';
                    }
                })
                .catch(() => {
                    const card = document.getElementById('stat-' + metric.key);
                    if (!card) return;
                    card.classList.remove('driver-stat-loading');
                    card.classList.add('driver-stat-not-ranked');
                    const posEl = card.querySelector('.driver-stat-position');
                    if (posEl) posEl.textContent = 'Unavailable';
                });
        });
    }

    /**
     * Compute and render class breakdowns from driver entries.
     * Runs at idle priority so the main profile renders first.
     * @param {Array} entries - Raw driver leaderboard entries
     */
    scheduleClassBreakdowns(entries) {
        if (!window.DriverProfileData || !DriverProfileData.computeClassBreakdown) return;
        if (!entries || entries.length === 0) return;

        const run = () => {
            const results = DriverProfileData.computeClassBreakdown(entries);
            this.renderClassBreakdowns(results);
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run);
        } else {
            setTimeout(run, 0);
        }
    }

    /**
     * Render class breakdown lists into each stat card.
     * Colors match the Car Classes pie chart; hovering cross-highlights.
     * @param {Object} results - { [metricKey]: [{className, value, entryCount?}] }
     */
    renderClassBreakdowns(results) {
        if (!results) return;
        const metrics = (window.DriverStatsService && DriverStatsService.PROFILE_METRICS) || [
            { key: 'avg_bested', label: 'Average Bested %', format: 'percent' },
            { key: 'bested', label: 'Drivers Bested', format: 'number' },
            { key: 'pole', label: 'Pole Positions', format: 'number' },
            { key: 'podium', label: 'Podiums', format: 'number' }
        ];
        const formatValue = (window.DriverStatsService && DriverStatsService.formatValue) ||
            function (v, fmt) { return fmt === 'percent' ? v.toFixed(1) + '%' : Number(v).toLocaleString(); };
        const colorMap = this._classColorMap || new Map();
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

        this._wireBreakdownChartInteraction();
    }

    /**
     * Wire bidirectional hover interaction between stat breakdowns and the
     * Car Classes pie chart so they highlight the same class in sync.
     */
    _wireBreakdownChartInteraction() {
        const chartContainer = document.getElementById('chart-car-class');
        if (!chartContainer) return;

        const chartLegendItems = chartContainer.querySelectorAll('.pie-legend-item');
        const chartSlices = chartContainer.querySelectorAll('.pie-slice');
        const allBreakdownItems = document.querySelectorAll('.driver-stat-breakdown .pie-legend-item');

        // Build label → chart legend element map
        const labelToChartLegend = new Map();
        chartLegendItems.forEach(el => {
            const label = (el.querySelector('.pie-legend-label') || {}).textContent || '';
            if (label) labelToChartLegend.set(label.trim(), el);
        });

        // Stat breakdown → pie chart: dispatch mouseenter/leave on matching legend item
        allBreakdownItems.forEach(el => {
            const label = el.getAttribute('data-class-label');
            const matchingLegend = labelToChartLegend.get(label);

            el.addEventListener('mouseenter', () => {
                el.classList.add('pie-legend-item-active');
                if (matchingLegend) matchingLegend.dispatchEvent(new Event('mouseenter'));
            });
            el.addEventListener('mouseleave', () => {
                el.classList.remove('pie-legend-item-active');
                if (matchingLegend) matchingLegend.dispatchEvent(new Event('mouseleave'));
            });
        });

        // Pie chart legend → stat breakdowns
        chartLegendItems.forEach(el => {
            const label = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            if (!label) return;
            el.addEventListener('mouseenter', () => {
                allBreakdownItems.forEach(bd => {
                    if (bd.getAttribute('data-class-label') === label) bd.classList.add('pie-legend-item-active');
                });
            });
            el.addEventListener('mouseleave', () => {
                allBreakdownItems.forEach(bd => bd.classList.remove('pie-legend-item-active'));
            });
        });

        // Pie chart slices → stat breakdowns
        chartSlices.forEach(el => {
            const label = el.getAttribute('data-label');
            if (!label) return;
            el.addEventListener('mouseenter', () => {
                allBreakdownItems.forEach(bd => {
                    if (bd.getAttribute('data-class-label') === label) bd.classList.add('pie-legend-item-active');
                });
            });
            el.addEventListener('mouseleave', () => {
                allBreakdownItems.forEach(bd => bd.classList.remove('pie-legend-item-active'));
            });
        });

        // Re-wire entries-dist cross-highlighting now that breakdown items exist
        this._wireEntriesDistCrossHighlighting();
    }

    /**
     * Render the highlights section: most used car and most used track
     * @param {Object} profile - Profile data
     */
    renderHighlights(profile) {
        const carDist = profile.carDistribution;
        const trackDist = profile.trackDistribution;
        if ((!carDist || carDist.length === 0) && (!trackDist || trackDist.length === 0)) {
            this.elements.highlightsContainer.innerHTML = '';
            return;
        }

        const escape = R3EUtils.escapeHtml;
        const cards = [];

        // Most used car card
        if (carDist && carDist.length > 0) {
            const topCar = carDist[0];
            const carName = topCar.label;
            const carCount = topCar.value;

            // Resolve car thumbnail from CARS_DATA
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
                '<div class="highlight-card highlight-card-car">',
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

        // Most used track card
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

            // Split track name for main + layout
            const trackParts = trackName.split(' - ');
            const trackMain = trackParts[0] || trackName;
            const trackLayout = trackParts.length > 1 ? trackParts.slice(1).join(' - ') : '';

            cards.push([
                '<div class="highlight-card highlight-card-track">',
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

        this.elements.highlightsContainer.innerHTML = [
            '<div class="driver-profile-highlights-grid">',
            cards.join(''),
            '</div>'
        ].join('');
    }

    /**
     * Render the distributions section: entries over time + performance over time
     * @param {Array} entries - Raw driver leaderboard entries
     */
    renderDistributions(entries) {
        if (!entries || entries.length === 0) {
            this.elements.distributionsContainer.innerHTML = '';
            return;
        }

        this._distEntries = entries;
        let html = '<div class="driver-profile-distributions-grid">';

        // Entries distribution graph (reuses DetailEntriesDist module)
        if (window.DetailEntriesDist) {
            const entriesDistHtml = DetailEntriesDist.generateHtml(entries, true, null, null, entries, {});
            if (entriesDistHtml) {
                html += '<div class="driver-profile-dist-card">' + entriesDistHtml + '</div>';
            }
        }

        // Performance distribution graph (bested % over time)
        html += this._generatePerformanceGraph(entries);

        html += '</div>';
        this.elements.distributionsContainer.innerHTML = html;
        this._wireEntriesDistInteraction();
    }

    /**
     * Generate the performance distribution graph HTML.
     * Each entry becomes a point representing its bested % position.
     * #1 = 100%, last = 0%.
     * @param {Array} entries - Raw driver leaderboard entries
     * @returns {string} HTML string
     */
    _generatePerformanceGraph(entries) {
        const parseDate = window.DetailEntriesDist ? DetailEntriesDist.parseEntryDate : null;
        if (!parseDate) return '';

        // Build data points: [{date, bestedPct, carClass, car, position, total}] sorted by date
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

        // Grid lines as divs
        html += '<div class="perf-dist-grid-line" style="top:25%"></div>';
        html += '<div class="perf-dist-grid-line" style="top:50%"></div>';
        html += '<div class="perf-dist-grid-line" style="top:75%"></div>';

        // Draw points as HTML elements positioned by percentage
        const totalPoints = points.length;
        const escape = R3EUtils.escapeHtml;
        points.forEach((pt, idx) => {
            const leftPct = ((idx + 0.5) / totalPoints) * 100;
            const topPct = 100 - pt.bestedPct;
            const dateStr = DetailEntriesDist.getLocalDateKey(pt.date);
            const info = pt.car + (pt.track ? ' – ' + pt.track : '');
            html += '<span class="perf-dist-point" style="left:' + leftPct.toFixed(3) + '%;top:' + topPct.toFixed(3) + '%" data-date="' + dateStr + '" data-pct="' + pt.bestedPct.toFixed(1) + '" data-pos="' + pt.position + '" data-total="' + pt.total + '" data-info="' + escape(info) + '" data-class="' + escape(pt.carClass) + '" data-class-id="' + escape(String(pt.classId || '')) + '"></span>';
        });

        html += '</div>';

        // X-axis dates
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
     * Wire toggle interaction for distribution graphs on the profile page
     */
    _wireEntriesDistInteraction() {
        const container = this.elements.distributionsContainer;
        if (!container) return;

        container.querySelectorAll('.entries-dist-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                const contentId = toggle.getAttribute('aria-controls');
                const content = document.getElementById(contentId);
                if (!content) return;
                toggle.setAttribute('aria-expanded', String(!expanded));
                toggle.classList.toggle('expanded', !expanded);
                content.style.display = expanded ? 'none' : '';
            });
        });

        // Wire timeframe controls for entries distribution (same as detail page)
        const entriesDistEl = container.querySelector('.entries-dist-summary:not(.perf-dist-summary)');
        if (entriesDistEl && window.DetailEntriesDist) {
            const startInput = entriesDistEl.querySelector('.entries-timeframe-start');
            const endInput = entriesDistEl.querySelector('.entries-timeframe-end');
            const lastWeekBtn = entriesDistEl.querySelector('.entries-timeframe-last-week');

            if (startInput && endInput) {
                const refresh = () => {
                    const parent = entriesDistEl.closest('.driver-profile-dist-card');
                    if (!parent) return;
                    const allEntries = this._distEntries;
                    if (!allEntries) return;
                    const filtered = DetailEntriesDist.applyTimeframeFilter(allEntries, startInput.value, endInput.value);
                    const newHtml = DetailEntriesDist.generateHtml(filtered, true, startInput.value, endInput.value, allEntries, {
                        timeframeStart: startInput.value,
                        timeframeEnd: endInput.value
                    });
                    parent.innerHTML = newHtml;
                    // Re-wire toggle
                    const newToggle = parent.querySelector('.entries-dist-toggle');
                    if (newToggle) {
                        newToggle.addEventListener('click', () => {
                            const exp = newToggle.getAttribute('aria-expanded') === 'true';
                            const cId = newToggle.getAttribute('aria-controls');
                            const c = document.getElementById(cId);
                            if (!c) return;
                            newToggle.setAttribute('aria-expanded', String(!exp));
                            newToggle.classList.toggle('expanded', !exp);
                            c.style.display = exp ? 'none' : '';
                        });
                    }
                    // Re-wire timeframe controls
                    this._wireEntriesDistInteraction();
                };
                startInput.addEventListener('change', refresh);
                endInput.addEventListener('change', refresh);
                if (lastWeekBtn) {
                    lastWeekBtn.addEventListener('click', () => {
                        const now = new Date();
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        startInput.value = DetailEntriesDist.toLocalDateInputValue(weekAgo);
                        endInput.value = DetailEntriesDist.toLocalDateInputValue(now);
                        refresh();
                    });
                }
            }
        }

        // Wire tooltips for both graph types
        if (window.DetailEntriesDist) {
            DetailEntriesDist.wireTooltips(container, this._distEntries);
            DetailEntriesDist.wirePerfTooltips(container);
        }
    }

    /**
     * Render the charts section
     * @param {Object} profile - Profile data
     */
    renderCharts(profile, entries) {
        this.elements.chartsContainer.innerHTML = [
            '<div class="driver-profile-charts-grid">',
            '<div id="chart-car-class" class="driver-profile-chart-card"></div>',
            '<div id="chart-car" class="driver-profile-chart-card"></div>',
            '<div id="chart-track" class="driver-profile-chart-card"></div>',
            '</div>'
        ].join('');

        PieChart.render(
            document.getElementById('chart-car-class'),
            profile.carClassDistribution,
            { title: 'Car Classes' }
        );

        // Build class→color map from the pie chart slices so breakdowns match
        if (PieChart.computeSlices) {
            const slices = PieChart.computeSlices(profile.carClassDistribution);
            this._classColorMap = new Map(slices.map(s => [s.label, s.color]));
        }

        PieChart.render(
            document.getElementById('chart-car'),
            profile.carDistribution,
            { title: 'Cars' }
        );

        PieChart.render(
            document.getElementById('chart-track'),
            profile.trackDistribution,
            { title: 'Tracks' }
        );

        // Wire car chart ↔ class chart cross-highlighting
        this._wireCarClassChartInteraction(entries);

        // Wire pie charts → performance graph dot highlighting
        this._wirePieChartPerfHighlighting();

        // Wire pie charts + perf dots → entries distribution bar highlighting
        this._wireEntriesDistCrossHighlighting();
    }

    /**
     * Wire pie chart hover → performance graph dot cross-highlighting.
     * Hovering a pie slice or legend item highlights matching dots on the perf graph.
     */
    _wirePieChartPerfHighlighting() {
        const perfChart = document.querySelector('.perf-dist-chart');
        if (!perfChart) return;

        const perfPoints = Array.from(perfChart.querySelectorAll('.perf-dist-point'));
        if (perfPoints.length === 0) return;

        let highlightedPoints = [];

        function highlightPoints(matchFn) {
            clearPoints();
            highlightedPoints = perfPoints.filter(matchFn);
            highlightedPoints.forEach(p => p.classList.add('perf-dist-point-active'));
        }

        function clearPoints() {
            highlightedPoints.forEach(p => p.classList.remove('perf-dist-point-active'));
            highlightedPoints = [];
        }

        // Helper: attach hover listeners to all slices + legend items in a chart
        function wireChart(chartId, matchFn) {
            const chart = document.getElementById(chartId);
            if (!chart) return;

            chart.querySelectorAll('.pie-slice').forEach(el => {
                const label = (el.getAttribute('data-label') || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightPoints(p => matchFn(p, label)));
                el.addEventListener('mouseleave', clearPoints);
            });

            chart.querySelectorAll('.pie-legend-item').forEach(el => {
                const labelEl = el.querySelector('.pie-legend-label');
                const label = (labelEl ? labelEl.textContent : '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightPoints(p => matchFn(p, label)));
                el.addEventListener('mouseleave', clearPoints);
            });
        }

        // Car Classes pie: match data-class on perf points
        wireChart('chart-car-class', (point, label) =>
            point.getAttribute('data-class') === label
        );

        // Cars pie: match car name (first part of data-info before " – ")
        wireChart('chart-car', (point, label) => {
            const info = point.getAttribute('data-info') || '';
            const car = info.split(' \u2013 ')[0];
            return car === label;
        });

        // Tracks pie: match track name (second part of data-info after " – ")
        wireChart('chart-track', (point, label) => {
            const info = point.getAttribute('data-info') || '';
            const parts = info.split(' \u2013 ');
            return parts.length > 1 && parts[1] === label;
        });
    }

    /**
     * Wire hover on pie charts, perf dots, and stat class breakdowns
     * to cross-highlight matching bars in the Entries Distribution Graph.
     */
    _wireEntriesDistCrossHighlighting() {
        const entries = this._distEntries;
        if (!entries || entries.length === 0) return;
        if (!window.DetailEntriesDist) return;

        const container = this.elements.distributionsContainer;
        if (!container) return;

        const svg = container.querySelector('.entries-dist-chart svg');
        if (!svg) return;

        const bars = Array.from(svg.querySelectorAll('.entries-dist-bar'));
        if (bars.length === 0) return;

        // Build a date→bar map for fast lookup
        const barByDate = new Map();
        bars.forEach(bar => {
            const d = bar.getAttribute('data-date');
            if (d) barByDate.set(d, bar);
        });

        // Build reverse lookups: class→dates, car→dates, track→dates
        const classDates = new Map();
        const carDates = new Map();
        const trackDates = new Map();

        entries.forEach(entry => {
            const dt = DetailEntriesDist.parseEntryDate(entry);
            if (!dt) return;
            const dateKey = DetailEntriesDist.getLocalDateKey(dt);
            if (!dateKey) return;

            const cls = entry.car_class || entry.CarClass || entry.Class || '';
            const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
            const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                ? window.R3EUtils.resolveTrackLabelForItem(entry)
                : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');

            if (cls) {
                if (!classDates.has(cls)) classDates.set(cls, new Set());
                classDates.get(cls).add(dateKey);
            }
            if (car) {
                if (!carDates.has(car)) carDates.set(car, new Set());
                carDates.get(car).add(dateKey);
            }
            if (track) {
                if (!trackDates.has(track)) trackDates.set(track, new Set());
                trackDates.get(track).add(dateKey);
            }
        });

        let highlightedBars = [];

        function highlightBars(dates) {
            clearBars();
            if (!dates) return;
            dates.forEach(d => {
                const bar = barByDate.get(d);
                if (bar) {
                    bar.classList.add('entries-dist-bar-active');
                    highlightedBars.push(bar);
                }
            });
        }

        function clearBars() {
            highlightedBars.forEach(b => b.classList.remove('entries-dist-bar-active'));
            highlightedBars = [];
        }

        // Helper: attach hover listeners to slices + legend items in a pie chart
        function wirePieChart(chartId, dateMap) {
            const chart = document.getElementById(chartId);
            if (!chart) return;

            chart.querySelectorAll('.pie-slice').forEach(el => {
                const label = (el.getAttribute('data-label') || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightBars(dateMap.get(label)));
                el.addEventListener('mouseleave', clearBars);
            });

            chart.querySelectorAll('.pie-legend-item').forEach(el => {
                const labelEl = el.querySelector('.pie-legend-label');
                const label = (labelEl ? labelEl.textContent : '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightBars(dateMap.get(label)));
                el.addEventListener('mouseleave', clearBars);
            });
        }

        // Pie charts → entries-dist bars
        wirePieChart('chart-car-class', classDates);
        wirePieChart('chart-car', carDates);
        wirePieChart('chart-track', trackDates);

        // Performance dots → entries-dist bars (by matching date)
        const perfChart = container.querySelector('.perf-dist-chart');
        if (perfChart) {
            perfChart.addEventListener('mousemove', () => {
                const activePoint = perfChart.querySelector('.perf-dist-point-active');
                if (activePoint) {
                    const date = activePoint.getAttribute('data-date');
                    if (date) highlightBars(new Set([date]));
                } else {
                    clearBars();
                }
            });
            perfChart.addEventListener('mouseleave', clearBars);
        }

        // Stats class breakdown items → entries-dist bars
        document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(el => {
            const cls = el.getAttribute('data-class-label') || '';
            if (!cls) return;
            el.addEventListener('mouseenter', () => highlightBars(classDates.get(cls)));
            el.addEventListener('mouseleave', clearBars);
        });
    }

    /**
     * Wire bidirectional hover between the Car Classes chart and the Cars chart.
     * Hovering a class highlights all cars belonging to that class (and vice versa).
     */
    _wireCarClassChartInteraction(entries) {
        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');
        const trackChart = document.getElementById('chart-track');
        if (!classChart || !carChart) return;

        // Build car→class mapping
        const carToClass = (window.DriverProfileData && DriverProfileData.getCarToClassMap)
            ? DriverProfileData.getCarToClassMap(entries)
            : new Map();

        const classLegendItems = classChart.querySelectorAll('.pie-legend-item');
        const carLegendItems = carChart.querySelectorAll('.pie-legend-item');
        const carSlices = carChart.querySelectorAll('.pie-slice');

        // Annotate car legend items with their class
        carLegendItems.forEach(el => {
            const label = (el.querySelector('.pie-legend-label') || {}).textContent || '';
            const cls = carToClass.get(label.trim()) || '';
            if (cls) el.setAttribute('data-class-label', cls);
        });

        // Annotate car slices with their class
        carSlices.forEach(el => {
            const label = el.getAttribute('data-label') || '';
            const cls = carToClass.get(label.trim()) || '';
            if (cls) el.setAttribute('data-class-label', cls);
        });

        // Build track→classes, car→tracks, and track→cars mappings from entries
        const trackToClasses = new Map();
        const classToTracks = new Map();
        const carToTracks = new Map();
        const trackToCars = new Map();
        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                const cls = entry.car_class || entry.CarClass || entry.Class || '';
                const car = entry.Car || entry.car || entry.CarName || entry.car_name || '';
                const track = (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function')
                    ? window.R3EUtils.resolveTrackLabelForItem(entry)
                    : (entry.Track || entry.track || entry.TrackName || entry.track_name || '');
                if (cls && track) {
                    if (!trackToClasses.has(track)) trackToClasses.set(track, new Set());
                    trackToClasses.get(track).add(cls);
                    if (!classToTracks.has(cls)) classToTracks.set(cls, new Set());
                    classToTracks.get(cls).add(track);
                }
                if (car && track) {
                    if (!carToTracks.has(car)) carToTracks.set(car, new Set());
                    carToTracks.get(car).add(track);
                    if (!trackToCars.has(track)) trackToCars.set(track, new Set());
                    trackToCars.get(track).add(car);
                }
            });
        }

        // Track chart elements
        const trackLegendItems = trackChart ? trackChart.querySelectorAll('.pie-legend-item') : [];
        const trackSlices = trackChart ? trackChart.querySelectorAll('.pie-slice') : [];

        // Annotate track elements with their classes
        trackLegendItems.forEach(el => {
            const label = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            const classes = trackToClasses.get(label);
            if (classes) el.setAttribute('data-class-labels', Array.from(classes).join('|'));
        });
        trackSlices.forEach(el => {
            const label = (el.getAttribute('data-label') || '').trim();
            const classes = trackToClasses.get(label);
            if (classes) el.setAttribute('data-class-labels', Array.from(classes).join('|'));
        });

        const classSlices = classChart.querySelectorAll('.pie-slice');

        const POP_DISTANCE = 8;
        const LABEL_RADIUS_PCT = 58; // % from center to place labels

        const MAX_LABELS = 10;
        const LABEL_MAX_CHARS = 22;

        // Show labels on highlighted slices within a chart
        function showSliceLabels(chartEl, slices) {
            const svgContainer = chartEl.querySelector('.pie-chart-svg-container');
            if (!svgContainer) return;
            // Collect active slices
            const active = [];
            slices.forEach(slice => {
                if (!slice.classList.contains('pie-slice-active')) return;
                const label = slice.getAttribute('data-label') || '';
                if (!label) return;
                const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                if (isNaN(midAngle)) return;
                const pct = parseFloat(slice.getAttribute('data-percentage')) || 0;
                active.push({ label, midAngle, pct });
            });
            if (active.length === 0) return;
            // Sort by percentage descending, keep only the top N
            active.sort((a, b) => b.pct - a.pct);
            const shown = active.slice(0, MAX_LABELS);
            shown.forEach(({ label, midAngle }) => {
                const x = 50 + Math.cos(midAngle) * LABEL_RADIUS_PCT;
                const y = 50 + Math.sin(midAngle) * LABEL_RADIUS_PCT;
                const el = document.createElement('span');
                el.className = 'pie-cross-label';
                el.textContent = label.length > LABEL_MAX_CHARS ? label.slice(0, LABEL_MAX_CHARS) + '…' : label;
                el.style.left = x.toFixed(1) + '%';
                el.style.top = y.toFixed(1) + '%';
                svgContainer.appendChild(el);
            });
        }

        function clearSliceLabels() {
            document.querySelectorAll('.pie-cross-label').forEach(el => el.remove());
        }

        // Helpers to apply / clear cross-chart highlighting
        function highlightCarsByClass(classLabel, { fromClassChart = false } = {}) {
            // Highlight the source class slice itself (useful when triggered from breakdown)
            classSlices.forEach(slice => {
                if ((slice.getAttribute('data-label') || '') === classLabel) {
                    slice.classList.add('pie-slice-active');
                    const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                    if (!isNaN(midAngle)) {
                        const tx = Math.cos(midAngle) * POP_DISTANCE;
                        const ty = Math.sin(midAngle) * POP_DISTANCE;
                        slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                    }
                } else {
                    slice.classList.add('pie-slice-dimmed');
                    slice.style.transform = '';
                }
            });
            carLegendItems.forEach(carEl => {
                if (carEl.getAttribute('data-class-label') === classLabel) {
                    carEl.classList.add('pie-legend-item-active');
                } else {
                    carEl.classList.add('pie-legend-item-dimmed');
                }
            });
            carSlices.forEach(slice => {
                if (slice.getAttribute('data-class-label') === classLabel) {
                    slice.classList.add('pie-slice-active');
                    const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                    if (!isNaN(midAngle)) {
                        const tx = Math.cos(midAngle) * POP_DISTANCE;
                        const ty = Math.sin(midAngle) * POP_DISTANCE;
                        slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                    }
                } else {
                    slice.classList.add('pie-slice-dimmed');
                    slice.style.transform = '';
                }
            });
            // Highlight matching tracks (tracks that have entries with this class)
            trackLegendItems.forEach(el => {
                const classes = (el.getAttribute('data-class-labels') || '').split('|');
                if (classes.includes(classLabel)) {
                    el.classList.add('pie-legend-item-active');
                } else {
                    el.classList.add('pie-legend-item-dimmed');
                }
            });
            trackSlices.forEach(slice => {
                const classes = (slice.getAttribute('data-class-labels') || '').split('|');
                if (classes.includes(classLabel)) {
                    slice.classList.add('pie-slice-active');
                    const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                    if (!isNaN(midAngle)) {
                        const tx = Math.cos(midAngle) * POP_DISTANCE;
                        const ty = Math.sin(midAngle) * POP_DISTANCE;
                        slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                    }
                } else {
                    slice.classList.add('pie-slice-dimmed');
                    slice.style.transform = '';
                }
            });
            if (!fromClassChart) showSliceLabels(classChart, classSlices);
            showSliceLabels(carChart, carSlices);
            if (trackChart) showSliceLabels(trackChart, trackSlices);
        }
        function clearCarHighlights() {
            clearSliceLabels();
            classSlices.forEach(slice => {
                slice.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                slice.style.transform = '';
            });
            carLegendItems.forEach(carEl => {
                carEl.classList.remove('pie-legend-item-active', 'pie-legend-item-dimmed');
            });
            carSlices.forEach(slice => {
                slice.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                slice.style.transform = '';
            });
            trackLegendItems.forEach(el => {
                el.classList.remove('pie-legend-item-active', 'pie-legend-item-dimmed');
            });
            trackSlices.forEach(slice => {
                slice.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                slice.style.transform = '';
            });
        }
        function highlightClassByCar(cls, carLabel, { fromCarChart = false } = {}) {
            classLegendItems.forEach(clsEl => {
                const clsLabel = ((clsEl.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                if (clsLabel === cls) {
                    clsEl.classList.add('pie-legend-item-active');
                } else {
                    clsEl.classList.add('pie-legend-item-dimmed');
                }
            });
            classSlices.forEach(slice => {
                if ((slice.getAttribute('data-label') || '') === cls) {
                    slice.classList.add('pie-slice-active');
                    const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                    if (!isNaN(midAngle)) {
                        const tx = Math.cos(midAngle) * POP_DISTANCE;
                        const ty = Math.sin(midAngle) * POP_DISTANCE;
                        slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                    }
                } else {
                    slice.classList.add('pie-slice-dimmed');
                    slice.style.transform = '';
                }
            });
            // Highlight tracks driven by this car
            const tracks = carLabel ? carToTracks.get(carLabel) : null;
            trackLegendItems.forEach(el => {
                const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                if (tracks && tracks.has(lbl)) {
                    el.classList.add('pie-legend-item-active');
                } else {
                    el.classList.add('pie-legend-item-dimmed');
                }
            });
            trackSlices.forEach(slice => {
                const lbl = (slice.getAttribute('data-label') || '').trim();
                if (tracks && tracks.has(lbl)) {
                    slice.classList.add('pie-slice-active');
                    const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                    if (!isNaN(midAngle)) {
                        const tx = Math.cos(midAngle) * POP_DISTANCE;
                        const ty = Math.sin(midAngle) * POP_DISTANCE;
                        slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                    }
                } else {
                    slice.classList.add('pie-slice-dimmed');
                    slice.style.transform = '';
                }
            });
            // Query breakdown items lazily — they are rendered asynchronously
            document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(bd => {
                if (bd.getAttribute('data-class-label') === cls) {
                    bd.classList.add('pie-legend-item-active');
                }
            });
            showSliceLabels(classChart, classSlices);
            if (trackChart) showSliceLabels(trackChart, trackSlices);
            if (!fromCarChart) showSliceLabels(carChart, carSlices);
        }
        function clearClassHighlights() {
            clearSliceLabels();
            classLegendItems.forEach(clsEl => {
                clsEl.classList.remove('pie-legend-item-active', 'pie-legend-item-dimmed');
            });
            classSlices.forEach(slice => {
                slice.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                slice.style.transform = '';
            });
            trackLegendItems.forEach(el => {
                el.classList.remove('pie-legend-item-active', 'pie-legend-item-dimmed');
            });
            trackSlices.forEach(slice => {
                slice.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                slice.style.transform = '';
            });
            document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(bd => {
                bd.classList.remove('pie-legend-item-active');
            });
        }

        // Class chart legend + slices → highlight matching cars
        classLegendItems.forEach(el => {
            const classLabel = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            if (!classLabel) return;
            el.addEventListener('mouseenter', (e) => highlightCarsByClass(classLabel, { fromClassChart: e.isTrusted }));
            el.addEventListener('mouseleave', clearCarHighlights);
        });
        classSlices.forEach(el => {
            const classLabel = (el.getAttribute('data-label') || '').trim();
            if (!classLabel) return;
            el.addEventListener('mouseenter', () => highlightCarsByClass(classLabel, { fromClassChart: true }));
            el.addEventListener('mouseleave', clearCarHighlights);
        });

        // Car chart legend + slices → highlight matching class + tracks
        carLegendItems.forEach(el => {
            const cls = el.getAttribute('data-class-label') || '';
            const carLabel = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
            if (!cls) return;
            el.addEventListener('mouseenter', () => highlightClassByCar(cls, carLabel, { fromCarChart: true }));
            el.addEventListener('mouseleave', clearClassHighlights);
        });
        carSlices.forEach(el => {
            const cls = el.getAttribute('data-class-label') || '';
            const carLabel = (el.getAttribute('data-label') || '').trim();
            if (!cls) return;
            el.addEventListener('mouseenter', () => highlightClassByCar(cls, carLabel, { fromCarChart: true }));
            el.addEventListener('mouseleave', clearClassHighlights);
        });

        // Track chart → highlight matching classes, cars, and breakdowns
        if (trackChart) {
            function highlightByTrack(trackLabel, { fromTrackChart = false } = {}) {
                const classes = trackToClasses.get(trackLabel);
                if (!classes) return;
                classLegendItems.forEach(el => {
                    const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                    if (classes.has(lbl)) {
                        el.classList.add('pie-legend-item-active');
                    } else {
                        el.classList.add('pie-legend-item-dimmed');
                    }
                });
                classSlices.forEach(slice => {
                    const lbl = (slice.getAttribute('data-label') || '').trim();
                    if (classes.has(lbl)) {
                        slice.classList.add('pie-slice-active');
                        const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                        if (!isNaN(midAngle)) {
                            const tx = Math.cos(midAngle) * POP_DISTANCE;
                            const ty = Math.sin(midAngle) * POP_DISTANCE;
                            slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                        }
                    } else {
                        slice.classList.add('pie-slice-dimmed');
                        slice.style.transform = '';
                    }
                });
                // Highlight only cars actually driven on this track
                const cars = trackToCars.get(trackLabel);
                carLegendItems.forEach(el => {
                    const lbl = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                    if (cars && cars.has(lbl)) {
                        el.classList.add('pie-legend-item-active');
                    } else {
                        el.classList.add('pie-legend-item-dimmed');
                    }
                });
                carSlices.forEach(slice => {
                    const lbl = (slice.getAttribute('data-label') || '').trim();
                    if (cars && cars.has(lbl)) {
                        slice.classList.add('pie-slice-active');
                        const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
                        if (!isNaN(midAngle)) {
                            const tx = Math.cos(midAngle) * POP_DISTANCE;
                            const ty = Math.sin(midAngle) * POP_DISTANCE;
                            slice.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                        }
                    } else {
                        slice.classList.add('pie-slice-dimmed');
                        slice.style.transform = '';
                    }
                });
                // Highlight class breakdowns
                document.querySelectorAll('.driver-stat-breakdown .pie-legend-item').forEach(bd => {
                    const bdClass = bd.getAttribute('data-class-label') || '';
                    if (classes.has(bdClass)) {
                        bd.classList.add('pie-legend-item-active');
                    }
                });
                showSliceLabels(classChart, classSlices);
                showSliceLabels(carChart, carSlices);
                if (!fromTrackChart) showSliceLabels(trackChart, trackSlices);
            }
            function clearTrackHighlights() {
                clearClassHighlights();
                clearCarHighlights();
            }

            trackLegendItems.forEach(el => {
                const label = ((el.querySelector('.pie-legend-label') || {}).textContent || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightByTrack(label, { fromTrackChart: true }));
                el.addEventListener('mouseleave', clearTrackHighlights);
            });
            trackSlices.forEach(el => {
                const label = (el.getAttribute('data-label') || '').trim();
                if (!label) return;
                el.addEventListener('mouseenter', () => highlightByTrack(label, { fromTrackChart: true }));
                el.addEventListener('mouseleave', clearTrackHighlights);
            });
        }
    }

    /**
     * Show error message in the profile container
     * @param {string} html - Error message (may contain HTML links)
     */
    showError(html) {
        this.elements.profileContainer.innerHTML =
            `<div class="driver-profile-error">${html}</div>`;
    }
}

// Expose class for testing and external use
window.DriverProfile = DriverProfile;

// Auto-initialize
if (document.readyState === 'complete') {
    window.driverProfile = new DriverProfile();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        window.driverProfile = new DriverProfile();
    }, { once: true });
}
