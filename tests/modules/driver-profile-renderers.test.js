import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    document.body.innerHTML = '';
    window.R3EUtils = {
        escapeHtml: (s) => String(s || ''),
        renderRankStars: vi.fn((rank) => `⭐${rank}`),
        resolveBrandLogoPath: vi.fn(() => 'images/brands/logo-bmw.png'),
        splitCarName: vi.fn((name) => {
            const parts = String(name || '').split(' ');
            return { brand: parts[0] || '', model: parts.slice(1).join(' ') || '' };
        }),
        resolveTrackLabelForItem: vi.fn(e => e.Track || '')
    };
    window.FlagHelper = {
        countryToFlag: vi.fn((country) => country ? `🏴${country}` : '')
    };
    window.DriverProfileData = {
        getRaceRoomProfileUrl: vi.fn((pathId) => pathId ? `https://game.raceroom.com/users/${pathId}` : '')
    };
    window.resolveMpPosWithInactive = vi.fn().mockReturnValue({ position: 5, inactive: false });
    window.getMpPosNameClasses = vi.fn().mockReturnValue('driver-name-gold');
    window.DriverStatsService = {
        PROFILE_METRICS: [
            { key: 'avg_bested', label: 'Average Bested %', format: 'percent' },
            { key: 'bested', label: 'Drivers Bested', format: 'number' }
        ],
        formatValue: vi.fn((v, fmt) => fmt === 'percent' ? v.toFixed(1) + '%' : String(v))
    };
    window.PieChart = {
        COLORS: ['#3b82f6', '#22c55e', '#f59e0b']
    };
    window.R3ETrackImages = {
        resolveTrackLogoByLabel: vi.fn(() => 'images/tracks/spa.png')
    };
    window.CARS_DATA = [
        { cars: [{ car: 'BMW M4', thumbnail: 'https://example.com/bmw-m4-image-small.png' }] }
    ];
    window.DetailEntriesDist = {
        parseEntryDate: vi.fn(e => e.date ? new Date(e.date) : null),
        getLocalDateKey: vi.fn(d => d ? d.toISOString().slice(0, 10) : null)
    };
    loadBrowserScript('modules/driver-profile-renderers.js');
});

describe('DriverProfileRenderers', () => {
    describe('renderHeader', () => {
        it('renders driver name', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Max Speed', country: 'DE', pathId: 'max-123', totalEntries: 10
            });
            expect(html).toContain('Max Speed');
        });

        it('renders avatar image when provided', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', avatar: 'https://example.com/pic.png',
                pathId: 'test-1', totalEntries: 5
            });
            expect(html).toContain('driver-profile-avatar');
            expect(html).toContain('https://example.com/pic.png');
        });

        it('renders placeholder when no avatar', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', pathId: 'test-1', totalEntries: 5
            });
            expect(html).toContain('driver-profile-avatar-placeholder');
        });

        it('renders rank stars when rank provided', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', rank: '5', pathId: 'test-1', totalEntries: 5
            });
            expect(window.R3EUtils.renderRankStars).toHaveBeenCalledWith('5');
        });

        it('renders team with prefix', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', team: 'Alpha Racing',
                pathId: 'test-1', totalEntries: 5
            });
            expect(html).toContain('Team Alpha Racing');
        });

        it('does not add prefix if team already contains "Team"', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', team: 'Team Beta',
                pathId: 'test-1', totalEntries: 5
            });
            expect(html).not.toContain('Team Team Beta');
            expect(html).toContain('Team Beta');
        });

        it('renders MP position', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', pathId: 'test-1', totalEntries: 5
            });
            expect(html).toContain('Multiplayer #5');
        });

        it('renders entry count link', () => {
            const html = DriverProfileRenderers.renderHeader({
                name: 'Test', country: 'US', pathId: 'test-1', totalEntries: 42
            });
            expect(html).toContain('42 leaderboard entries');
        });
    });

    describe('renderStatsPlaceholders', () => {
        it('renders a card for each metric', () => {
            const html = DriverProfileRenderers.renderStatsPlaceholders();
            expect(html).toContain('stat-avg_bested');
            expect(html).toContain('stat-bested');
            expect(html).toContain('driver-stat-card--loading');
        });

        it('returns empty string when no metrics available', () => {
            const orig = window.DriverStatsService;
            window.DriverStatsService = { PROFILE_METRICS: [] };
            const html = DriverProfileRenderers.renderStatsPlaceholders();
            expect(html).toBe('');
            window.DriverStatsService = orig;
        });
    });

    describe('renderHighlights', () => {
        it('renders most used car card', () => {
            const html = DriverProfileRenderers.renderHighlights({
                carDistribution: [{ label: 'BMW M4', value: 10 }],
                trackDistribution: []
            });
            expect(html).toContain('Most Used Car');
            expect(html).toContain('BMW M4');
            expect(html).toContain('10 leaderboard entries');
        });

        it('renders most used track card', () => {
            const html = DriverProfileRenderers.renderHighlights({
                carDistribution: [],
                trackDistribution: [{ label: 'Spa - Grand Prix', value: 7 }]
            });
            expect(html).toContain('Most Used Track');
            expect(html).toContain('Spa');
        });

        it('returns empty string when no distributions', () => {
            const html = DriverProfileRenderers.renderHighlights({
                carDistribution: [],
                trackDistribution: []
            });
            expect(html).toBe('');
        });

        it('uses singular "entry" for count of 1', () => {
            const html = DriverProfileRenderers.renderHighlights({
                carDistribution: [{ label: 'Audi', value: 1 }],
                trackDistribution: []
            });
            expect(html).toContain('1 leaderboard entry');
        });
    });

    describe('generatePerformanceGraph', () => {
        it('returns empty string when no entries have valid dates', () => {
            window.DetailEntriesDist.parseEntryDate.mockReturnValue(null);
            const html = DriverProfileRenderers.generatePerformanceGraph([{ position: 1, total_entries: 10 }]);
            expect(html).toBe('');
        });

        it('renders performance points for valid entries', () => {
            const date = new Date('2025-06-01');
            window.DetailEntriesDist.parseEntryDate.mockReturnValue(date);
            window.DetailEntriesDist.getLocalDateKey.mockReturnValue('2025-06-01');

            const html = DriverProfileRenderers.generatePerformanceGraph([
                { position: 3, total_entries: 10, Car: 'BMW', Track: 'Spa', car_class: 'GT3', date: '2025-06-01' }
            ]);
            expect(html).toContain('perf-dist-point');
            expect(html).toContain('Performance Over Time');
        });

        it('skips entries with total_entries < 2', () => {
            window.DetailEntriesDist.parseEntryDate.mockReturnValue(new Date());
            const html = DriverProfileRenderers.generatePerformanceGraph([
                { position: 1, total_entries: 1, Car: 'A', car_class: 'GT3' }
            ]);
            expect(html).toBe('');
        });
    });

    describe('renderClassBreakdowns', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                '<div class="driver-stat-card" id="stat-avg_bested"><div class="driver-stat-breakdown"></div></div>',
                '<div class="driver-stat-card" id="stat-bested"><div class="driver-stat-breakdown"></div></div>'
            ].join('');
        });

        it('renders breakdown items into stat cards', () => {
            const results = {
                avg_bested: [{ className: 'GT3', value: 85.5, entryCount: 10 }],
                bested: [{ className: 'GT3', value: 200 }]
            };
            const colorMap = new Map([['GT3', '#ff0000']]);

            DriverProfileRenderers.renderClassBreakdowns(results, colorMap);

            const card = document.getElementById('stat-avg_bested');
            expect(card.querySelector('.driver-stat-breakdown').innerHTML).toContain('GT3');
            expect(card.querySelector('.driver-stat-breakdown').innerHTML).toContain('85.5%');
        });

        it('shows entry count for avg_bested metric', () => {
            const results = {
                avg_bested: [{ className: 'TCR', value: 60.0, entryCount: 5 }],
                bested: []
            };
            DriverProfileRenderers.renderClassBreakdowns(results, new Map());

            const card = document.getElementById('stat-avg_bested');
            expect(card.querySelector('.driver-stat-breakdown').innerHTML).toContain('(5)');
        });
    });
});
