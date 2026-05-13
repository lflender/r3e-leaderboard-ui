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
        getUrlParam: vi.fn().mockReturnValue('"Test Driver"'),
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
            entries: [
                { car_class: 'GT3', Car: 'BMW M4', track_id: 100 },
                { car_class: 'GT3', Car: 'BMW M4', track_id: 200 },
                { car_class: 'TCR', Car: 'Hyundai', track_id: 100 }
            ]
        }])
    };
    window.resolveMpPos = vi.fn().mockReturnValue(42);
    window.getMpPosNameClasses = vi.fn().mockReturnValue('driver-name-gold');
    window.loadMpPosCache = vi.fn().mockResolvedValue({});
    window.DriverProfileData = {
        buildProfileData: vi.fn().mockReturnValue(mockProfileData),
        getRaceRoomProfileUrl: vi.fn((pathId) => pathId ? `https://game.raceroom.com/users/${pathId}` : '')
    };
    window.PieChart = {
        render: vi.fn()
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
        formatValue: vi.fn((value, format) => {
            if (value == null || isNaN(value)) return '—';
            if (format === 'percent') return value.toFixed(1) + '%';
            return String(value);
        })
    };
    loadBrowserScript('modules/pages/driver-profile.js');
});

beforeEach(() => {
    document.body.innerHTML = buildDom();
    vi.clearAllMocks();
    window.R3EUtils.getUrlParam.mockReturnValue('"Test Driver"');
    window.dataService.searchDriver.mockResolvedValue([{
        driver: 'Test Driver',
        country: 'DE',
        team: 'Team Alpha',
        rank: '5',
        avatar: 'https://example.com/avatar.png',
        entries: [
            { car_class: 'GT3', Car: 'BMW M4', track_id: 100 },
            { car_class: 'GT3', Car: 'BMW M4', track_id: 200 },
            { car_class: 'TCR', Car: 'Hyundai', track_id: 100 }
        ]
    }]);
    window.DriverProfileData.buildProfileData.mockReturnValue(mockProfileData);
    window.resolveMpPos.mockReturnValue(42);
    window.getMpPosNameClasses.mockReturnValue('driver-name-gold');
    window.loadMpPosCache.mockResolvedValue({});
    window.DriverStatsService.lookupDriverStats.mockResolvedValue([
        { key: 'avg_bested', label: 'Average Bested %', format: 'percent', result: { value: 78.5, position: 42, total: 10000 } },
        { key: 'bested', label: 'Drivers Bested', format: 'number', result: { value: 150, position: 100, total: 10000 } },
        { key: 'pole', label: 'Pole Positions', format: 'number', result: { value: 5, position: 500, total: 10000 } },
        { key: 'podium', label: 'Podiums', format: 'number', result: null }
    ]);
});

describe('DriverProfile', () => {
    it('exposes DriverProfile class on window', () => {
        expect(window.DriverProfile).toBeTruthy();
    });

    it('shows error when no driver param', async () => {
        window.R3EUtils.getUrlParam.mockReturnValue(null);
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

    it('calls lookupDriverStats with driver name', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        // Wait for async stats load to complete
        await vi.waitFor(() => {
            expect(window.DriverStatsService.lookupDriverStats).toHaveBeenCalledWith('Test Driver');
        });
    });

    it('displays stat values after stats load', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverStatsService.lookupDriverStats).toHaveBeenCalled();
        });
        // Allow the loadStats promise to resolve
        await new Promise(r => setTimeout(r, 10));

        const avgCard = document.getElementById('stat-avg_bested');
        expect(avgCard.querySelector('.driver-stat-value').textContent).toBe('78.5%');
        expect(avgCard.querySelector('.driver-stat-position').textContent).toContain('#42');
    });

    it('marks not-ranked cards when result is null', async () => {
        const dp = new window.DriverProfile();
        await dp.init();
        await vi.waitFor(() => {
            expect(window.DriverStatsService.lookupDriverStats).toHaveBeenCalled();
        });
        await new Promise(r => setTimeout(r, 10));

        const podiumCard = document.getElementById('stat-podium');
        expect(podiumCard.classList.contains('driver-stat-not-ranked')).toBe(true);
        expect(podiumCard.querySelector('.driver-stat-position').textContent).toBe('Not ranked');
    });

    it('handles stats service error gracefully', async () => {
        window.DriverStatsService.lookupDriverStats.mockRejectedValue(new Error('Stats error'));
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
});
