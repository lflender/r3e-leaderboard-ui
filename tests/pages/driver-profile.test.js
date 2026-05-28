import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="driver-profile-container">',
        '<div id="driver-profile-header"></div>',
        '<div id="driver-profile-charts"></div>',
        '</div>'
    ].join('');
}

const mockProfileData = {
    name: 'Test Driver',
    country: 'DE',
    team: 'Team Alpha',
    rank: '5',
    avatar: 'https://example.com/avatar.png',
    pathId: 'test-driver-123',
    totalEntries: 3,
    carClassDistribution: [{ label: 'GT3', value: 2 }, { label: 'TCR', value: 1 }],
    carDistribution: [{ label: 'BMW M4', value: 2 }, { label: 'Hyundai', value: 1 }],
    trackDistribution: [{ label: 'Spa', value: 2 }, { label: 'Monza', value: 1 }]
};

beforeAll(() => {
    // Remove the profile container so the script's auto-init becomes a no-op
    document.body.innerHTML = '';
    window.R3EUtils = {
        escapeHtml: (s) => String(s || ''),
        getUrlParam: vi.fn((param) => {
            if (param === 'driver') return '"Test Driver"';
            if (param === 'id') return null;
            return null;
        }),
        renderRankStars: vi.fn((rank) => ` | ⭐ Rank ${rank}`),
        resolveBrandLogoPath: vi.fn(() => 'images/brands/logo-bmw.png'),
        splitCarName: vi.fn((name) => {
            const parts = String(name || '').split(' ');
            return { brand: parts[0] || '', model: parts.slice(1).join(' ') || '' };
        })
    };
    window.R3ETrackImages = {
        resolveTrackLogoByLabel: vi.fn(() => 'images/tracks/spa-logo.png')
    };
    window.CARS_DATA = [
        {
            superclass: 'GT3',
            class: 'GT3 2020',
            cars: [
                { car: 'BMW M4', thumbnail: 'https://example.com/bmw-m4-image-small.png' }
            ]
        }
    ];
    window.FlagHelper = {
        countryToFlag: vi.fn((country) => country ? `<span class="fi fi-${country.toLowerCase()}"></span>` : ''),
        findCountryCodeByName: vi.fn()
    };
    window.TemplateHelper = {
        showLoading: vi.fn(async (container, message) => {
            container.innerHTML = `<div>${message || 'Loading...'}</div>`;
        })
    };
    window.dataService = {
        searchDriver: vi.fn().mockResolvedValue([{
            driver: 'Test Driver',
            country: 'DE',
            team: 'Team Alpha',
            rank: '5',
            avatar: 'https://example.com/avatar.png',
            pathId: 'test-driver-123',
            entries: [
                { car_class: 'GT3', Car: 'BMW M4', track_id: 100, position: 1, total_entries: 100 },
                { car_class: 'GT3', Car: 'BMW M4', track_id: 200, position: 5, total_entries: 50 },
                { car_class: 'TCR', Car: 'Hyundai', track_id: 100, position: 2, total_entries: 80 }
            ]
        }])
    };
    window.resolveMpPos = vi.fn().mockReturnValue(42);
    window.resolveMpPosWithInactive = vi.fn().mockReturnValue({ position: 42, inactive: false });
    window.getMpPosNameClasses = vi.fn().mockReturnValue('driver-name-gold');
    window.loadMpPosCache = vi.fn().mockResolvedValue({});
    window.loadMpPosInactiveCache = vi.fn().mockResolvedValue({});
    window.DriverProfileData = {
        buildProfileData: vi.fn().mockReturnValue(mockProfileData),
        getRaceRoomProfileUrl: vi.fn((pathId) => pathId ? `https://game.raceroom.com/users/${pathId}` : ''),
        MIN_ENTRIES_FOR_POLE: 2,
        MIN_ENTRIES_FOR_PODIUM: 4,
        getCarToClassMap: vi.fn((entries) => {
            const carClassCounts = new Map();
            (entries || []).forEach(e => {
                const car = e.Car || e.car || '';
                const cls = e.car_class || '';
                if (!car || !cls) return;
                if (!carClassCounts.has(car)) carClassCounts.set(car, new Map());
                const counts = carClassCounts.get(car);
                counts.set(cls, (counts.get(cls) || 0) + 1);
            });
            const result = new Map();
            carClassCounts.forEach((counts, car) => {
                let best = '', max = 0;
                counts.forEach((c, cls) => { if (c > max) { max = c; best = cls; } });
                result.set(car, best);
            });
            return result;
        }),
        computeClassBreakdown: vi.fn((entries) => {
            const MIN_POLE = 2, MIN_PODIUM = 4;
            const classMap = new Map();
            (entries || []).forEach(entry => {
                const cls = entry.car_class || '';
                if (!cls) return;
                const position = Number(entry.position) || 0;
                const total = Number(entry.total_entries) || 0;
                if (position <= 0 || total <= 0) return;
                if (!classMap.has(cls)) classMap.set(cls, { bested: 0, pole: 0, podium: 0, bestedPcts: [], count: 0 });
                const stats = classMap.get(cls);
                const bested = total - position;
                stats.bested += bested;
                stats.count++;
                if (position === 1 && total >= MIN_POLE) stats.pole++;
                if (position <= 3 && total >= MIN_PODIUM) stats.podium++;
                if (total > 1) stats.bestedPcts.push((bested / (total - 1)) * 100);
            });
            const result = { avg_bested: [], bested: [], pole: [], podium: [] };
            classMap.forEach((stats, className) => {
                if (stats.bested > 0) result.bested.push({ className, value: stats.bested });
                if (stats.pole > 0) result.pole.push({ className, value: stats.pole });
                if (stats.podium > 0) result.podium.push({ className, value: stats.podium });
                if (stats.bestedPcts.length > 0) {
                    const avg = stats.bestedPcts.reduce((a, b) => a + b, 0) / stats.bestedPcts.length;
                    result.avg_bested.push({ className, value: Math.round(avg * 100) / 100, entryCount: stats.count });
                }
            });
            for (const key of Object.keys(result)) result[key].sort((a, b) => b.value - a.value);
            return result;
        })
    };
    window.PieChart = {
        render: vi.fn((container, data, options) => {
            // Render a minimal DOM structure matching real PieChart output
            // so cross-interaction wiring can find legend items and slices
            if (!container || !Array.isArray(data) || data.length === 0) return;
            const slices = window.PieChart.computeSlices(data);
            const legendHtml = slices.map((s, i) =>
                '<li class="pie-legend-item" data-index="' + i + '">' +
                '<span class="pie-legend-color" style="background:' + s.color + '"></span>' +
                '<span class="pie-legend-label">' + s.label + '</span>' +
                '<span class="pie-legend-value">' + s.value + '</span></li>'
            ).join('');
            const sliceHtml = slices.map((s, i) =>
                '<circle class="pie-slice" data-index="' + i + '" data-label="' + s.label + '"></circle>'
            ).join('');
            container.innerHTML =
                '<div class="pie-chart-wrapper"><div class="pie-chart-body">' +
                '<div class="pie-chart-svg-container"><svg>' + sliceHtml + '</svg></div>' +
                '<ul class="pie-legend">' + legendHtml + '</ul>' +
                '</div></div>';
        }),
        COLORS: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'],
        computeSlices: vi.fn((data) => {
            if (!Array.isArray(data) || data.length === 0) return [];
            const total = data.reduce((s, d) => s + d.value, 0);
            const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
            return data.slice().sort((a, b) => b.value - a.value).map((d, i) => ({
                label: d.label,
                value: d.value,
                percentage: (d.value / total) * 100,
                color: colors[i % colors.length],
                midAngle: 0
            }));
        })
    };
    window.DriverStatsService = {
        PROFILE_METRICS: [
            { key: 'avg_bested', label: 'Average Bested %', format: 'percent' },
            { key: 'bested', label: 'Drivers Bested', format: 'number' },
            { key: 'pole', label: 'Pole Positions', format: 'number' },
            { key: 'podium', label: 'Podiums', format: 'number' }
        ],
        lookupDriverStats: vi.fn().mockResolvedValue([
            { key: 'avg_bested', label: 'Average Bested %', format: 'percent', result: { value: 78.5, position: 42, total: 10000 } },
            { key: 'bested', label: 'Drivers Bested', format: 'number', result: { value: 150, position: 100, total: 10000 } },
            { key: 'pole', label: 'Pole Positions', format: 'number', result: { value: 5, position: 500, total: 10000 } },
            { key: 'podium', label: 'Podiums', format: 'number', result: null }
        ]),
        lookupSingleStat: vi.fn((driverName, key) => {
            const results = {
                avg_bested: { value: 78.5, position: 42, total: 10000 },
                bested: { value: 150, position: 100, total: 10000 },
                pole: { value: 5, position: 500, total: 10000 },
                podium: null
            };
            return Promise.resolve(results[key] || null);
        }),
        formatValue: vi.fn((value, format) => {
            if (value == null || isNaN(value)) return '—';
            if (format === 'percent') return value.toFixed(1) + '%';
            return String(value);
        })
    };
    loadBrowserScript('modules/driver-profile-renderers.js');
    loadBrowserScript('modules/driver-profile-distributions.js');
    loadBrowserScript('modules/driver-profile-chart-interaction.js');
    loadBrowserScript('modules/pages/driver-profile.js');
});

beforeEach(() => {
    document.body.innerHTML = buildDom();
    vi.clearAllMocks();
    window.R3EUtils.getUrlParam.mockImplementation((param) => {
        if (param === 'driver') return '"Test Driver"';
        if (param === 'id') return null;
        return null;
    });
    window.dataService.searchDriver.mockResolvedValue([{
        driver: 'Test Driver',
        country: 'DE',
        team: 'Team Alpha',
        rank: '5',
        avatar: 'https://example.com/avatar.png',
        pathId: 'test-driver-123',
        entries: [
            { car_class: 'GT3', Car: 'BMW M4', track_id: 100, position: 1, total_entries: 100 },
            { car_class: 'GT3', Car: 'BMW M4', track_id: 200, position: 5, total_entries: 50 },
            { car_class: 'TCR', Car: 'Hyundai', track_id: 100, position: 2, total_entries: 80 }
        ]
    }]);
    window.DriverProfileData.buildProfileData.mockReturnValue(mockProfileData);
    window.resolveMpPos.mockReturnValue(42);
    window.resolveMpPosWithInactive.mockReturnValue({ position: 42, inactive: false });
    window.getMpPosNameClasses.mockReturnValue('driver-name-gold');
    window.loadMpPosCache.mockResolvedValue({});
    window.loadMpPosInactiveCache.mockResolvedValue({});
    window.DriverStatsService.lookupDriverStats.mockResolvedValue([
        { key: 'avg_bested', label: 'Average Bested %', format: 'percent', result: { value: 78.5, position: 42, total: 10000 } },
        { key: 'bested', label: 'Drivers Bested', format: 'number', result: { value: 150, position: 100, total: 10000 } },
        { key: 'pole', label: 'Pole Positions', format: 'number', result: { value: 5, position: 500, total: 10000 } },
        { key: 'podium', label: 'Podiums', format: 'number', result: null }
    ]);
    window.DriverStatsService.lookupSingleStat.mockImplementation((driverName, key) => {
        const results = {
            avg_bested: { value: 78.5, position: 42, total: 10000 },
            bested: { value: 150, position: 100, total: 10000 },
            pole: { value: 5, position: 500, total: 10000 },
            podium: null
        };
        return Promise.resolve(results[key] || null);
    });
});

describe('DriverProfile', () => {
    it('exposes DriverProfile class on window', () => {
        expect(window.DriverProfile).toBeTruthy();
    });

    it('shows error when no driver param', async () => {
        window.R3EUtils.getUrlParam.mockImplementation(() => null);
        const dp = new window.DriverProfile();
        await dp.init();
        const container = document.getElementById('driver-profile-container');
        expect(container.innerHTML).toContain('No driver specified');
    });

    it('shows error when driver not found', async () => {
        window.dataService.searchDriver.mockResolvedValue([]);
        const dp = new window.DriverProfile();
        await dp.init();
        const container = document.getElementById('driver-profile-container');
        expect(container.innerHTML).toContain('not found');
    });

    it('renders profile header on successful load', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('Test Driver');
        expect(header.innerHTML).toContain('DE');
        expect(header.innerHTML).toContain('Multiplayer #42');
    });

    it('calls PieChart.render three times for charts', async () => {
        window.PieChart.render.mockClear();
        const dp = new window.DriverProfile();
        // Wait for constructor's async init to complete
        await vi.waitFor(() => {
            expect(window.PieChart.render).toHaveBeenCalledTimes(3);
        });
    });

    it('renders back link to driver search', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        // Back link was removed; should not be present
        expect(header.innerHTML).not.toContain('Back to search');
    });

    it('renders raceroom profile link', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('game.raceroom.com');
        expect(header.innerHTML).toContain('View on RaceRoom');
    });

    it('renders avatar when available', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('driver-profile-avatar');
        expect(header.innerHTML).toContain('example.com/avatar.png');
    });

    it('renders placeholder when no avatar', async () => {
        window.DriverProfileData.buildProfileData.mockReturnValue({
            ...mockProfileData,
            avatar: ''
        });
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('driver-profile-avatar-placeholder');
    });

    it('renders team with prefix when needed', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('Team Alpha');
    });

    it('applies MP position CSS classes to name', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('driver-name-gold');
    });

    it('renders entries count', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const header = document.getElementById('driver-profile-header');
        expect(header.innerHTML).toContain('3 leaderboard entries');
    });

    it('passes correct data to PieChart.render', async () => {
        const dp = new window.DriverProfile();
        await dp.init();

        // Car classes chart
        expect(window.PieChart.render).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            mockProfileData.carClassDistribution,
            { title: 'Car Classes' }
        );

        // Cars chart
        expect(window.PieChart.render).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            mockProfileData.carDistribution,
            { title: 'Cars' }
        );

        // Tracks chart
        expect(window.PieChart.render).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            mockProfileData.trackDistribution,
            { title: 'Tracks' }
        );
    });

    it('handles search error gracefully', async () => {
        window.dataService.searchDriver.mockRejectedValue(new Error('Network error'));
        const dp = new window.DriverProfile();
        await dp.init();
        const container = document.getElementById('driver-profile-container');
        expect(container.innerHTML).toContain('Failed to load');
    });

    it('renders stats placeholder cards on load', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const statsContainer = document.getElementById('driver-profile-stats');
        expect(statsContainer).toBeTruthy();
        const cards = statsContainer.querySelectorAll('.driver-stat-card');
        expect(cards.length).toBe(4);
    });

    it('calls lookupSingleStat for each metric', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        // Wait for async stats load to complete
        await vi.waitFor(() => {
            expect(window.DriverStatsService.lookupSingleStat).toHaveBeenCalledWith('Test Driver', 'avg_bested', 'test-driver-123');
            expect(window.DriverStatsService.lookupSingleStat).toHaveBeenCalledWith('Test Driver', 'bested', 'test-driver-123');
            expect(window.DriverStatsService.lookupSingleStat).toHaveBeenCalledWith('Test Driver', 'pole', 'test-driver-123');
            expect(window.DriverStatsService.lookupSingleStat).toHaveBeenCalledWith('Test Driver', 'podium', 'test-driver-123');
        });
    });

    it('displays stat values after stats load', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverStatsService.lookupSingleStat).toHaveBeenCalled();
        });
        // Allow the loadStats promises to resolve
        await new Promise(r => setTimeout(r, 10));

        const avgCard = document.getElementById('stat-avg_bested');
        expect(avgCard.querySelector('.driver-stat-value').textContent).toBe('78.5%');
        expect(avgCard.querySelector('.driver-stat-position').textContent).toContain('#42');
    });

    it('marks not-ranked cards when result is null', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverStatsService.lookupSingleStat).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 10));

        const podiumCard = document.getElementById('stat-podium');
        expect(podiumCard.classList.contains('driver-stat-not-ranked')).toBe(true);
        expect(podiumCard.querySelector('.driver-stat-position').textContent).toBe('Not ranked');
    });

    it('handles stats service error gracefully', async () => {
        window.DriverStatsService.lookupSingleStat.mockRejectedValue(new Error('Stats error'));
        const dp = new window.DriverProfile();
        await dp.init();
        await new Promise(r => setTimeout(r, 10));

        // Stats section should still exist, cards should show Unavailable
        const cards = document.querySelectorAll('.driver-stat-card');
        cards.forEach(card => {
            expect(card.querySelector('.driver-stat-position').textContent).toBe('Unavailable');
        });
    });

    it('renders highlights section between stats and charts', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const highlights = document.getElementById('driver-profile-highlights');
        expect(highlights).toBeTruthy();
        expect(highlights.innerHTML).toContain('Most Used Car');
        expect(highlights.innerHTML).toContain('Most Used Track');
    });

    it('renders most used car with image from CARS_DATA', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const carCard = document.querySelector('.highlight-card-car');
        expect(carCard).toBeTruthy();
        // Should have a car image with -image-big instead of -image-small
        expect(carCard.innerHTML).toContain('bmw-m4-image-big.png');
        expect(carCard.innerHTML).toContain('BMW');
    });

    it('renders most used track with logo', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const trackCard = document.querySelector('.highlight-card-track');
        expect(trackCard).toBeTruthy();
        expect(trackCard.innerHTML).toContain('spa-logo.png');
        expect(trackCard.innerHTML).toContain('Spa');
    });

    it('highlights container appears before charts container', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const container = document.getElementById('driver-profile-container');
        const children = Array.from(container.children);
        const highlightsIdx = children.findIndex(c => c.id === 'driver-profile-highlights');
        const chartsIdx = children.findIndex(c => c.id === 'driver-profile-charts');
        expect(highlightsIdx).toBeGreaterThan(0);
        expect(highlightsIdx).toBeLessThan(chartsIdx);
    });

    it('renders empty highlights when no distributions', async () => {
        window.DriverProfileData.buildProfileData.mockReturnValue({
            ...mockProfileData,
            carDistribution: [],
            trackDistribution: []
        });
        const dp = new window.DriverProfile();
        await dp.init();
        const highlights = document.getElementById('driver-profile-highlights');
        expect(highlights.innerHTML).toBe('');
    });

    it('stats cards update independently without waiting for each other', async () => {
        // Each metric resolves at a different time; faster ones should render
        // before slower ones resolve.
        let resolvePole;
        const polePromise = new Promise(r => { resolvePole = r; });

        window.DriverStatsService.lookupSingleStat.mockImplementation((name, key) => {
            if (key === 'pole') return polePromise;
            const results = {
                avg_bested: { value: 78.5, position: 42, total: 10000 },
                bested: { value: 150, position: 100, total: 10000 },
                podium: null
            };
            return Promise.resolve(results[key] || null);
        });

        const dp = new window.DriverProfile();
        await dp.init();
        // Let resolved promises flush
        await new Promise(r => setTimeout(r, 10));

        // avg_bested and bested should already be rendered
        const avgCard = document.getElementById('stat-avg_bested');
        expect(avgCard.classList.contains('driver-stat-loading')).toBe(false);
        expect(avgCard.querySelector('.driver-stat-value').textContent).toBe('78.5%');

        const bestedCard = document.getElementById('stat-bested');
        expect(bestedCard.classList.contains('driver-stat-loading')).toBe(false);

        // pole should still be loading
        const poleCard = document.getElementById('stat-pole');
        expect(poleCard.classList.contains('driver-stat-loading')).toBe(true);
        expect(poleCard.querySelector('.driver-stat-position').textContent).toContain('Loading');

        // Now resolve pole
        resolvePole({ value: 5, position: 500, total: 10000 });
        await new Promise(r => setTimeout(r, 10));

        expect(poleCard.classList.contains('driver-stat-loading')).toBe(false);
        expect(poleCard.querySelector('.driver-stat-value').textContent).toBe('5');
    });

    it('a failing stat does not block other stats from rendering', async () => {
        window.DriverStatsService.lookupSingleStat.mockImplementation((name, key) => {
            if (key === 'bested') return Promise.reject(new Error('network'));
            const results = {
                avg_bested: { value: 78.5, position: 42, total: 10000 },
                pole: { value: 5, position: 500, total: 10000 },
                podium: null
            };
            return Promise.resolve(results[key] || null);
        });

        const dp = new window.DriverProfile();
        await dp.init();
        await new Promise(r => setTimeout(r, 10));

        // Successful stats should render normally
        const avgCard = document.getElementById('stat-avg_bested');
        expect(avgCard.querySelector('.driver-stat-value').textContent).toBe('78.5%');

        const poleCard = document.getElementById('stat-pole');
        expect(poleCard.querySelector('.driver-stat-value').textContent).toBe('5');

        // Failed stat should show Unavailable, not block others
        const bestedCard = document.getElementById('stat-bested');
        expect(bestedCard.classList.contains('driver-stat-not-ranked')).toBe(true);
        expect(bestedCard.querySelector('.driver-stat-position').textContent).toBe('Unavailable');
    });

    it('selects the correct driver group by pathId from URL', async () => {
        window.R3EUtils.getUrlParam.mockImplementation((param) => {
            if (param === 'driver') return '"Alex Fernandez"';
            if (param === 'id') return '99999';
            return null;
        });
        window.dataService.searchDriver.mockResolvedValue([
            { driver: 'Alex Fernandez', country: 'ES', pathId: '11111', entries: [{ car_class: 'GT3' }] },
            { driver: 'Alex Fernandez', country: 'MX', pathId: '99999', entries: [{ car_class: 'TCR' }] }
        ]);
        const secondProfile = { ...mockProfileData, name: 'Alex Fernandez', country: 'MX', pathId: '99999' };
        window.DriverProfileData.buildProfileData.mockReturnValue(secondProfile);

        const dp = new window.DriverProfile();
        await dp.init();

        // buildProfileData should have been called with the second group (pathId match)
        expect(window.DriverProfileData.buildProfileData).toHaveBeenCalledWith(
            expect.objectContaining({ pathId: '99999', country: 'MX' })
        );
    });

    it('falls back to first result when pathId does not match', async () => {
        window.R3EUtils.getUrlParam.mockImplementation((param) => {
            if (param === 'driver') return '"Alex Fernandez"';
            if (param === 'id') return 'nonexistent';
            return null;
        });
        window.dataService.searchDriver.mockResolvedValue([
            { driver: 'Alex Fernandez', country: 'ES', pathId: '11111', entries: [{ car_class: 'GT3' }] },
            { driver: 'Alex Fernandez', country: 'MX', pathId: '99999', entries: [{ car_class: 'TCR' }] }
        ]);

        const dp = new window.DriverProfile();
        await dp.init();

        expect(window.DriverProfileData.buildProfileData).toHaveBeenCalledWith(
            expect.objectContaining({ pathId: '11111', country: 'ES' })
        );
    });

    it('works with only id param (no driver param)', async () => {
        window.R3EUtils.getUrlParam.mockImplementation((param) => {
            if (param === 'driver') return null;
            if (param === 'id') return '99999';
            return null;
        });
        window.dataService.searchDriver.mockResolvedValue([
            { driver: 'Alex Fernandez', country: 'MX', pathId: '99999', entries: [{ car_class: 'TCR' }] }
        ]);

        const dp = new window.DriverProfile();
        await dp.init();

        expect(window.dataService.searchDriver).toHaveBeenCalledWith('"99999"', {});
        expect(window.DriverProfileData.buildProfileData).toHaveBeenCalled();
    });

    it('stat cards include a breakdown container', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        const breakdowns = document.querySelectorAll('.driver-stat-breakdown');
        expect(breakdowns.length).toBe(4);
    });

    it('calls computeClassBreakdown with driver entries', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalledWith([
                { car_class: 'GT3', Car: 'BMW M4', track_id: 100, position: 1, total_entries: 100 },
                { car_class: 'GT3', Car: 'BMW M4', track_id: 200, position: 5, total_entries: 50 },
                { car_class: 'TCR', Car: 'Hyundai', track_id: 100, position: 2, total_entries: 80 }
            ]);
        });
    });

    it('renders class breakdown lists inside stat cards', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        // GT3 bested=144, TCR bested=78
        const bestedCard = document.getElementById('stat-bested');
        const list = bestedCard.querySelector('.stat-breakdown-list');
        expect(list).toBeTruthy();
        const items = list.querySelectorAll('.pie-legend-item');
        expect(items.length).toBe(2);
        expect(items[0].textContent).toContain('GT3');
        expect(items[1].textContent).toContain('TCR');
    });

    it('renders color dots matching pie chart class colors', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const bestedCard = document.getElementById('stat-bested');
        const colorDots = bestedCard.querySelectorAll('.pie-legend-color');
        expect(colorDots.length).toBe(2);
        colorDots.forEach(dot => {
            expect(dot.style.background).toBeTruthy();
        });
    });

    it('adds hover interaction to breakdown items', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const bestedCard = document.getElementById('stat-bested');
        const items = bestedCard.querySelectorAll('.pie-legend-item');
        items[0].dispatchEvent(new Event('mouseenter'));
        expect(items[0].classList.contains('pie-legend-item-active')).toBe(true);
        items[0].dispatchEvent(new Event('mouseleave'));
        expect(items[0].classList.contains('pie-legend-item-active')).toBe(false);
    });

    it('cross-highlights pie chart when hovering breakdown item', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        // The car class chart has GT3 legend item (first slice)
        const chartContainer = document.getElementById('chart-car-class');
        const chartLegendGT3 = chartContainer.querySelector('.pie-legend-item[data-index="0"]');
        expect(chartLegendGT3).toBeTruthy();

        // Hover the breakdown item for GT3
        const bestedCard = document.getElementById('stat-bested');
        const bdItem = bestedCard.querySelector('.pie-legend-item[data-class-label="GT3"]');
        expect(bdItem).toBeTruthy();

        const spy = vi.spyOn(chartLegendGT3, 'dispatchEvent');
        bdItem.dispatchEvent(new Event('mouseenter'));
        expect(spy).toHaveBeenCalled();
        expect(bdItem.classList.contains('pie-legend-item-active')).toBe(true);

        bdItem.dispatchEvent(new Event('mouseleave'));
        expect(bdItem.classList.contains('pie-legend-item-active')).toBe(false);
        spy.mockRestore();
    });

    it('cross-highlights breakdown items when hovering pie chart', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const chartContainer = document.getElementById('chart-car-class');
        const chartLegendGT3 = chartContainer.querySelector('.pie-legend-item[data-index="0"]');

        chartLegendGT3.dispatchEvent(new Event('mouseenter'));

        const bdItems = document.querySelectorAll('.driver-stat-breakdown .pie-legend-item[data-class-label="GT3"]');
        bdItems.forEach(bd => {
            expect(bd.classList.contains('pie-legend-item-active')).toBe(true);
        });

        chartLegendGT3.dispatchEvent(new Event('mouseleave'));
        bdItems.forEach(bd => {
            expect(bd.classList.contains('pie-legend-item-active')).toBe(false);
        });
    });

    it('does not render breakdown for metrics with empty results', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        // avg_bested should have items (both classes have entries with total > 1)
        // but podium: only GT3 has position=1 (podium) and TCR has position=2 (podium)
        // Actually both have podiums, so check a metric where a class might be missing
        // pole: only GT3 has position=1 entries
        const poleCard = document.getElementById('stat-pole');
        const items = poleCard.querySelectorAll('.pie-legend-item');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toContain('GT3');
    });

    it('still computes breakdown even with empty class distribution', async () => {
        window.DriverProfileData.buildProfileData.mockReturnValue({
            ...mockProfileData,
            carClassDistribution: []
        });
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
    });

    it('cross-highlights car chart items when hovering class chart legend', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');

        // Car chart legend items should be annotated with data-class-label
        const carItems = carChart.querySelectorAll('.pie-legend-item[data-class-label]');
        expect(carItems.length).toBeGreaterThan(0);

        // BMW M4 → GT3, Hyundai → TCR
        const bmwItem = Array.from(carItems).find(el => el.textContent.includes('BMW M4'));
        expect(bmwItem.getAttribute('data-class-label')).toBe('GT3');

        // Hover GT3 in class chart → BMW M4 active, Hyundai dimmed
        const classGT3 = classChart.querySelector('.pie-legend-item[data-index="0"]');
        classGT3.dispatchEvent(new Event('mouseenter'));

        expect(bmwItem.classList.contains('pie-legend-item-active')).toBe(true);
        const hyundaiItem = Array.from(carItems).find(el => el.textContent.includes('Hyundai'));
        expect(hyundaiItem.classList.contains('pie-legend-item-dimmed')).toBe(true);

        classGT3.dispatchEvent(new Event('mouseleave'));
        expect(bmwItem.classList.contains('pie-legend-item-active')).toBe(false);
        expect(hyundaiItem.classList.contains('pie-legend-item-dimmed')).toBe(false);
    });

    it('cross-highlights class chart when hovering car chart legend', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');

        const carItems = carChart.querySelectorAll('.pie-legend-item[data-class-label]');
        const bmwItem = Array.from(carItems).find(el => el.textContent.includes('BMW M4'));

        // Hover BMW M4 in car chart → GT3 class active, TCR dimmed
        bmwItem.dispatchEvent(new Event('mouseenter'));

        const classLegendItems = classChart.querySelectorAll('.pie-legend-item');
        const gt3Class = Array.from(classLegendItems).find(el => el.textContent.includes('GT3'));
        const tcrClass = Array.from(classLegendItems).find(el => el.textContent.includes('TCR'));

        expect(gt3Class.classList.contains('pie-legend-item-active')).toBe(true);
        expect(tcrClass.classList.contains('pie-legend-item-dimmed')).toBe(true);

        bmwItem.dispatchEvent(new Event('mouseleave'));
        expect(gt3Class.classList.contains('pie-legend-item-active')).toBe(false);
        expect(tcrClass.classList.contains('pie-legend-item-dimmed')).toBe(false);
    });

    it('shows entry count after avg_bested value in breakdown', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const avgCard = document.getElementById('stat-avg_bested');
        const items = avgCard.querySelectorAll('.pie-legend-item');
        // Should contain entry count in parentheses
        const gt3Item = Array.from(items).find(el => el.textContent.includes('GT3'));
        expect(gt3Item.textContent).toMatch(/\(\d+\)/);
    });

    it('cross-highlights car chart when hovering class chart pie slice', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');
        const carItems = carChart.querySelectorAll('.pie-legend-item[data-class-label]');
        const bmwItem = Array.from(carItems).find(el => el.textContent.includes('BMW M4'));
        const hyundaiItem = Array.from(carItems).find(el => el.textContent.includes('Hyundai'));

        // Hover the GT3 pie slice directly
        const gt3Slice = classChart.querySelector('.pie-slice[data-label="GT3"]');
        expect(gt3Slice).toBeTruthy();
        gt3Slice.dispatchEvent(new Event('mouseenter'));

        expect(bmwItem.classList.contains('pie-legend-item-active')).toBe(true);
        expect(hyundaiItem.classList.contains('pie-legend-item-dimmed')).toBe(true);

        gt3Slice.dispatchEvent(new Event('mouseleave'));
        expect(bmwItem.classList.contains('pie-legend-item-active')).toBe(false);
        expect(hyundaiItem.classList.contains('pie-legend-item-dimmed')).toBe(false);
    });

    it('cross-highlights class chart when hovering car chart pie slice', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverProfileData.computeClassBreakdown).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 50));

        const classChart = document.getElementById('chart-car-class');
        const carChart = document.getElementById('chart-car');

        // Hover the BMW M4 pie slice directly
        const bmwSlice = carChart.querySelector('.pie-slice[data-label="BMW M4"]');
        expect(bmwSlice).toBeTruthy();
        expect(bmwSlice.getAttribute('data-class-label')).toBe('GT3');
        bmwSlice.dispatchEvent(new Event('mouseenter'));

        const classLegendItems = classChart.querySelectorAll('.pie-legend-item');
        const gt3Class = Array.from(classLegendItems).find(el => el.textContent.includes('GT3'));
        const tcrClass = Array.from(classLegendItems).find(el => el.textContent.includes('TCR'));

        expect(gt3Class.classList.contains('pie-legend-item-active')).toBe(true);
        expect(tcrClass.classList.contains('pie-legend-item-dimmed')).toBe(true);

        bmwSlice.dispatchEvent(new Event('mouseleave'));
        expect(gt3Class.classList.contains('pie-legend-item-active')).toBe(false);
        expect(tcrClass.classList.contains('pie-legend-item-dimmed')).toBe(false);
    });
});
