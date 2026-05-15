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

            this.renderProfile(profileData);
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
    renderProfile(profile) {
        this.elements.profileContainer.innerHTML =
            '<div id="driver-profile-header"></div>' +
            '<div id="driver-profile-stats"></div>' +
            '<div id="driver-profile-highlights"></div>' +
            '<div id="driver-profile-charts"></div>';
        this.elements.profileHeader = document.getElementById('driver-profile-header');
        this.elements.statsContainer = document.getElementById('driver-profile-stats');
        this.elements.highlightsContainer = document.getElementById('driver-profile-highlights');
        this.elements.chartsContainer = document.getElementById('driver-profile-charts');

        this.renderHeader(profile);
        this.renderStatsPlaceholders();
        this.loadStats(profile.name, profile.pathId);
        this.renderHighlights(profile);
        this.renderCharts(profile);
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
            `<h2 class="driver-profile-name${nameClass}"><a href="drivers.html?driver=${encodeURIComponent('"' + profile.name + '"')}${profile.pathId ? '&id=' + encodeURIComponent(profile.pathId) : ''}" class="driver-profile-name-link">${escape(profile.name)}</a></h2>`,
            '<div class="driver-profile-meta">',
            `<span class="driver-profile-country">${flagHtml} ${escape(profile.country)}</span>`,
            rankHtml ? `<span class="driver-profile-rank">${rankHtml}</span>` : '',
            mpPosHtml,
            '</div>',
            teamHtml,
            raceRoomLink,
            `<div class="driver-profile-entries-count">${profile.totalEntries} leaderboard entries</div>`,
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
     * Render the charts section
     * @param {Object} profile - Profile data
     */
    renderCharts(profile) {
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
