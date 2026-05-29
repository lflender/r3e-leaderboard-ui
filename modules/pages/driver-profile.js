/**
 * Driver Profile Page Module
 * Orchestrator that coordinates rendering and interaction for the driver profile page.
 * Delegates to:
 * - DriverProfileRenderers (HTML generation)
 * - DriverProfileDistributions (distribution graphs)
 * - DriverProfileChartInteraction (cross-chart highlighting)
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

            const driverGroup = this.findDriverGroup(results, idParam);
            const profileData = DriverProfileData.buildProfileData(driverGroup);

            this.renderProfile(profileData, driverGroup.entries);
            this.trackProfileShown(profileData);
        } catch (error) {
            console.error('Driver profile error:', error);
            this.showError('Failed to load driver profile. Please try again later.');
        }
    }

    findDriverGroup(results, pathId) {
        if (pathId) {
            const match = results.find(g => String(g.pathId || '') === String(pathId));
            if (match) return match;
        }
        return results[0];
    }

    renderProfile(profile, entries) {
        this.elements.profileContainer.innerHTML =
            '<div id="driver-profile-header"></div>' +
            '<div id="driver-profile-highlights"></div>' +
            '<div id="driver-profile-stats"></div>' +
            '<div id="driver-profile-distributions"></div>' +
            '<div id="driver-profile-charts"></div>';
        this.elements.profileHeader = document.getElementById('driver-profile-header');
        this.elements.highlightsContainer = document.getElementById('driver-profile-highlights');
        this.elements.statsContainer = document.getElementById('driver-profile-stats');
        this.elements.distributionsContainer = document.getElementById('driver-profile-distributions');
        this.elements.chartsContainer = document.getElementById('driver-profile-charts');

        this.elements.profileHeader.innerHTML = DriverProfileRenderers.renderHeader(profile);
        this.elements.highlightsContainer.innerHTML = DriverProfileRenderers.renderHighlights(profile);
        this.elements.statsContainer.innerHTML = DriverProfileRenderers.renderStatsPlaceholders();
        this.loadStats(profile.name, profile.pathId);
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
                        valueEl.textContent = '\u2014';
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

    scheduleClassBreakdowns(entries) {
        if (!window.DriverProfileData || !DriverProfileData.computeClassBreakdown) return;
        if (!entries || entries.length === 0) return;

        const run = () => {
            const results = DriverProfileData.computeClassBreakdown(entries);
            DriverProfileRenderers.renderClassBreakdowns(results, this._classColorMap);
            DriverProfileChartInteraction.wireBreakdownChartInteraction();
            DriverProfileChartInteraction.wireEntriesDistCrossHighlighting(
                this._distEntries, this.elements.distributionsContainer
            );
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run);
        } else {
            setTimeout(run, 0);
        }
    }

    renderDistributions(entries) {
        if (!entries || entries.length === 0) {
            this.elements.distributionsContainer.innerHTML = '';
            return;
        }

        this._distEntries = entries;
        this.elements.distributionsContainer.innerHTML = DriverProfileDistributions.render(entries);
        DriverProfileDistributions.wireInteraction(this.elements.distributionsContainer, entries);
    }

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

        DriverProfileChartInteraction.wireCarClassChartInteraction(entries);
        DriverProfileChartInteraction.wirePieChartPerfHighlighting();
        DriverProfileChartInteraction.wireEntriesDistCrossHighlighting(
            this._distEntries, this.elements.distributionsContainer
        );
        DriverProfileChartInteraction.wireDistPerfToPieHighlighting(
            this._distEntries, this.elements.distributionsContainer
        );
    }

    showError(html) {
        this.elements.profileContainer.innerHTML =
            `<div class="driver-profile-error">${html}</div>`;
    }
}

// Expose class for testing and external use
window.DriverProfile = DriverProfile;

document.addEventListener('DOMContentLoaded', () => { new DriverProfile(); }, { once: true });
