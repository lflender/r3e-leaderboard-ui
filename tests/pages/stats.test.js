import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="stats-class-filter-ui"></div>',
        '<h3 id="stats-pole-title"></h3>',
        '<h3 id="stats-bested-title"></h3>',
        '<div id="stats-selected-class-logo" hidden></div>',
        '<div id="stats-pole-table"></div>',
        '<div id="stats-bested-table"></div>'
    ].join('');
}

function setupGlobals() {
    window.__statsFilterOnChange = null;

    window.R3EUtils = {
        escapeHtml: value => String(value ?? ''),
        renderRankStars: vi.fn(() => '<span class="rank-stars">***</span>'),
        resolveCarClassLogo: vi.fn((className, classId) => className === 'GT3' && String(classId) === '5' ? '/images/gt3.webp' : '')
    };
    window.FlagHelper = {
        countryToFlag: vi.fn(() => '<span class="fi fi-se"></span>')
    };
    window.R3EAnalytics = {
        track: vi.fn()
    };

    window.loadMpPosCache = vi.fn().mockResolvedValue();
    window.resolveMpPos = vi.fn(() => 7);
    window.getMpPosNameClasses = vi.fn(() => 'mp-highlight');

    window.getCarClassId = vi.fn((className) => className === 'GT3' ? '5' : '');

    window.dataService = {
        getSuperclassOptions: vi.fn().mockReturnValue([{ value: 'superclass:GT3', label: 'Category: GT3', classes: ['GT3'] }]),
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([{ value: 'GT3', label: 'GT3' }])
    };

    window.CustomSelect = class {
        constructor(_rootId, _options, onChange) {
            window.__statsFilterOnChange = onChange;
        }
    };

    window.StatsData = {
        loadStatsIndex: vi.fn().mockResolvedValue({ index: true }),
        getPathsForFilter: vi.fn((_index, filter) => {
            if (filter === 'missing') return null;
            if (filter === 'superclass:GT3') {
                return {
                    polePath: 'stats/classes/gt3/pole.json.gz',
                    bestedPath: 'stats/classes/gt3/bested.json.gz'
                };
            }
            if (filter === 'GT3') {
                return {
                    polePath: 'stats/classes/5/pole.json.gz',
                    bestedPath: 'stats/classes/5/bested.json.gz'
                };
            }
            return {
                polePath: 'stats/overall/pole.json.gz',
                bestedPath: 'stats/overall/bested.json.gz'
            };
        }),
        fetchGzipJson: vi.fn((path) => {
            if (String(path).includes('pole')) {
                return Promise.resolve([{ driver_name: 'Alice', country: 'SE', rank: 'A', pole_positions: 12 }]);
            }
            return Promise.resolve([{ driver_name: 'Bob', country: 'DE', rank: 'B', bested_drivers: 99 }]);
        }),
        normalizeRows: vi.fn((rows, key) => rows.map(row => ({
            name: row.driver_name || row.name,
            country: row.country || '-',
            rank: row.rank || '',
            value: Number(row[key] ?? row.value ?? 0)
        })))
    };
}

beforeEach(() => {
    document.body.innerHTML = buildDom();
    setupGlobals();
});

describe('stats page integration', () => {
    it('renders both stats tables and updates section titles', async () => {
        loadBrowserScript('modules/pages/stats.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const poleTitle = document.getElementById('stats-pole-title').textContent;
        const bestedTitle = document.getElementById('stats-bested-title').textContent;
        const poleHtml = document.getElementById('stats-pole-table').innerHTML;
        const bestedHtml = document.getElementById('stats-bested-table').innerHTML;

        expect(poleTitle).toContain('Overall');
        expect(bestedTitle).toContain('Overall');
        expect(poleHtml).toContain('Alice');
        expect(poleHtml).toContain('12');
        expect(bestedHtml).toContain('Bob');
        expect(bestedHtml).toContain('99');
    });

    it('renders an error state when no stats files are available for the filter', async () => {
        window.StatsData.getPathsForFilter = vi.fn(() => null);

        loadBrowserScript('modules/pages/stats.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const poleHtml = document.getElementById('stats-pole-table').innerHTML;
        const bestedHtml = document.getElementById('stats-bested-table').innerHTML;
        expect(poleHtml).toContain('Failed to load stats');
        expect(bestedHtml).toContain('Failed to load stats');
    });

    it('applies user-selected filters, tracks analytics, and renders class logo', async () => {
        loadBrowserScript('modules/pages/stats.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        window.__statsFilterOnChange('GT3', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 0));

        const logoEl = document.getElementById('stats-selected-class-logo');
        const poleTitle = document.getElementById('stats-pole-title').textContent;

        expect(poleTitle).toContain('GT3');
        expect(logoEl.hidden).toBe(false);
        expect(logoEl.innerHTML).toContain('/images/gt3.webp');

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'stats filter changed',
            expect.objectContaining({
                filter_value: 'GT3',
                filter_type: 'class',
                source: 'filter'
            })
        );
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'stats displayed',
            expect.objectContaining({ filter_value: '' })
        );
    });
});

