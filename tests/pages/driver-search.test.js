import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<input id="driver-search" />',
        '<select id="track-filter"></select>',
        '<div id="track-filter-ui"></div>',
        '<select id="class-filter"></select>',
        '<div id="track-class-filter-ui"></div>',
        '<div id="driver-wheel-filter-ui"></div>',
        '<div id="results-container"></div>'
    ].join('');
}

beforeAll(() => {
    document.body.innerHTML = buildDom();
    window.TRACKS_DATA = [{ id: 1, label: 'Spa' }];
    window.CARS_DATA = [
        { class: 'GT3 Class', superclass: 'GT3', cars: [{ car_class: 'GT3 Class', car: 'Car A', wheel_cat: 'round flat' }] },
        { class: 'Touring', superclass: 'Touring', cars: [{ car_class: 'Touring', car: 'Car B', wheel_cat: 'gt' }] },
        { class: 'Open Wheel', superclass: 'Open', cars: [{ car_class: 'Open Wheel', car: 'Car C', wheel_cat: 'round' }] }
    ];
    window.R3ECarUtils = {
        wheelBadge: (cat) => `<span class="car-badge">${cat}</span>`
    };
    window.resolveMpPos = vi.fn().mockReturnValue(null);
    window.CustomSelect = class {
        constructor(_id, _options, _cb) {}
    };
    window.tableRenderer = {
        filterAndSortKeys: vi.fn(keys => keys),
        renderDriverGroupedTable: vi.fn(() => '<table><tbody><tr><td>ok</td></tr></tbody></table>')
    };
    window.TemplateHelper = {
        showLoading: vi.fn(async (container, message = 'Loading...') => {
            container.innerHTML = `<div>${message}</div>`;
        }),
        showNoResults: vi.fn(async (container) => {
            container.innerHTML = '<div>No results found</div>';
        })
    };
    window.R3EUtils = {
        escapeHtml: s => String(s),
        updateUrlParam: vi.fn(),
        getUrlParam: vi.fn().mockReturnValue('')
    };
    window.dataService = {
        searchDriver: vi.fn().mockResolvedValue([])
    };
    window.FilterOptionsService = {
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([]),
        getSuperclassOptions: vi.fn().mockReturnValue([]),
        getTrackOptions: vi.fn().mockReturnValue([{ value: '', label: 'All tracks' }])
    };
    window.R3EAnalytics = { track: vi.fn() };

    window.generatePaginationHTML = vi.fn().mockReturnValue('');

    loadBrowserScript('modules/pages/driver-search.js');
});

beforeEach(() => {
    document.body.innerHTML = buildDom();
    window.localStorage.clear();
    window.R3EUtils.updateUrlParam.mockClear();
    window.dataService.searchDriver.mockReset();
    window.dataService.searchDriver.mockResolvedValue([]);
    window.tableRenderer.filterAndSortKeys.mockClear();
    window.tableRenderer.renderDriverGroupedTable.mockClear();
    delete window.ColumnConfig;
});

describe('driver-search integration', () => {
    it('auto-initializes and exposes pagination/sort handlers', () => {
        expect(window.driverSearch).toBeTruthy();
        const ds = new window.driverSearch.constructor();
        expect(typeof window.goToPage).toBe('function');
        expect(typeof window.sortDriverGroups).toBe('function');
        expect(ds.isDriverSearchPage).toBe(true);
    });

    it('clears results when input length is below minimum', () => {
        const ds = new window.driverSearch.constructor();
        const input = document.getElementById('driver-search');
        const results = document.getElementById('results-container');
        results.innerHTML = 'old content';

        input.value = 'ab';
        input.dispatchEvent(new Event('input'));

        expect(results.innerHTML).toBe('');
    });

    it('enter key triggers immediate search and URL update', async () => {
        const ds = new window.driverSearch.constructor();
        const input = document.getElementById('driver-search');
        window.dataService.searchDriver.mockResolvedValueOnce([]);

        input.value = 'Alice';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(window.R3EUtils.updateUrlParam).toHaveBeenCalledWith('driver', 'Alice');
        expect(window.dataService.searchDriver).toHaveBeenCalledWith('Alice', {
            trackId: '',
            className: ''
        });
        expect(ds.lastSearchTerm).toBe('Alice');
    });

    it('re-renders current results when a sort header changes', async () => {
        const ds = new window.driverSearch.constructor();
        ds.currentSearchId = 1;
        ds.allResults = [{
            driver: 'Alice',
            entries: [{ position: '1', lap_time: '1:30.000', track: 'Spa', car_class: 'GT3' }]
        }];

        await ds.sortDriverGroups('position');

        expect(window.tableRenderer.renderDriverGroupedTable).toHaveBeenCalledTimes(1);
        expect(window.tableRenderer.renderDriverGroupedTable).toHaveBeenLastCalledWith(
            ds.allResults,
            ['position', 'lap_time', 'track', 'car_class'],
            'position'
        );
    });

    it('re-renders current results when pagination changes', async () => {
        const ds = new window.driverSearch.constructor();
        ds.currentSearchId = 2;
        ds.itemsPerPage = 1;
        ds.allResults = [
            { driver: 'Alice', entries: [{ position: '1', lap_time: '1:30.000', track: 'Spa', car_class: 'GT3' }] },
            { driver: 'Bob', entries: [{ position: '2', lap_time: '1:31.000', track: 'Monza', car_class: 'GT3' }] }
        ];
        document.getElementById('results-container').scrollIntoView = vi.fn();

        await ds.goToPage(2);

        expect(window.tableRenderer.renderDriverGroupedTable).toHaveBeenCalledTimes(1);
        expect(window.tableRenderer.renderDriverGroupedTable).toHaveBeenLastCalledWith(
            [ds.allResults[1]],
            ['position', 'lap_time', 'track', 'car_class'],
            'gap'
        );
    });

    it('adds a synthetic track column when results only contain track_id', async () => {
        window.ColumnConfig = {
            getOrderedColumns: vi.fn(keys => keys),
            isColumnType: vi.fn((key, type) => type === 'TRACK' && ['Track', 'track', 'TrackName', 'track_name'].includes(key))
        };

        const ds = new window.driverSearch.constructor();
        ds.currentSearchId = 3;
        ds.allResults = [{
            driver: 'Alice',
            entries: [{ position: '1', lap_time: '1:30.000', track_id: '10', car_class: 'GT3' }]
        }];

        await ds.displayResults(ds.allResults);

        expect(window.ColumnConfig.getOrderedColumns).toHaveBeenCalledWith(
            ['position', 'lap_time', 'track_id', 'car_class', 'track'],
            { addSynthetic: true }
        );
    });

    it('filters results by pathId from URL id param', async () => {
        window.R3EUtils.getUrlParam.mockImplementation((param) => {
            if (param === 'driver') return '"Alex Fernandez"';
            if (param === 'id') return '99999';
            return '';
        });
        window.dataService.searchDriver.mockResolvedValueOnce([
            { driver: 'Alex Fernandez', pathId: '11111', entries: [{ position: '1' }] },
            { driver: 'Alex Fernandez', pathId: '99999', entries: [{ position: '5' }] }
        ]);

        const ds = new window.driverSearch.constructor();
        // Wait for URL-triggered search
        await new Promise(r => setTimeout(r, 100));

        expect(ds.allResults).toHaveLength(1);
        expect(ds.allResults[0].pathId).toBe('99999');
    });

    it('shows all results when URL id param does not match any pathId', async () => {
        window.R3EUtils.getUrlParam.mockImplementation((param) => {
            if (param === 'driver') return '"Alex Fernandez"';
            if (param === 'id') return 'nonexistent';
            return '';
        });
        window.dataService.searchDriver.mockResolvedValueOnce([
            { driver: 'Alex Fernandez', pathId: '11111', entries: [{ position: '1' }] },
            { driver: 'Alex Fernandez', pathId: '99999', entries: [{ position: '5' }] }
        ]);

        const ds = new window.driverSearch.constructor();
        await new Promise(r => setTimeout(r, 100));

        expect(ds.allResults).toHaveLength(2);
    });

    it('debounced input triggers search after delay for terms >= 3 chars', async () => {
        vi.useFakeTimers();
        const ds = new window.driverSearch.constructor();
        const input = document.getElementById('driver-search');

        window.dataService.searchDriver.mockResolvedValueOnce([
            { driver: 'Alice Smith', entries: [{ position: '1', lap_time: '1:30.000', track: 'Spa', car_class: 'GT3' }] }
        ]);

        input.value = 'Ali';
        input.dispatchEvent(new Event('input'));

        // Should not have searched immediately
        expect(window.dataService.searchDriver).not.toHaveBeenCalled();

        // Advance timers past debounce (300ms)
        await vi.advanceTimersByTimeAsync(400);

        expect(window.dataService.searchDriver).toHaveBeenCalledWith('Ali', expect.any(Object));
        vi.useRealTimers();
    });

    it('tracks analytics when search is performed', async () => {
        const ds = new window.driverSearch.constructor();
        const input = document.getElementById('driver-search');
        window.R3EAnalytics.track.mockClear();

        window.dataService.searchDriver.mockResolvedValueOnce([
            { driver: 'Bob', entries: [{ position: '1', lap_time: '1:25.000', track: 'Monza', car_class: 'GT3' }] }
        ]);

        input.value = 'Bob';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'driver search performed',
            expect.objectContaining({ search_term: 'Bob' })
        );
    });

    it('discards stale results when a newer search supersedes', async () => {
        const ds = new window.driverSearch.constructor();
        const input = document.getElementById('driver-search');

        // First search — delay resolution
        let resolveFirst;
        window.dataService.searchDriver.mockImplementationOnce(() =>
            new Promise(r => { resolveFirst = r; })
        );
        // Second search — resolves immediately
        window.dataService.searchDriver.mockResolvedValueOnce([
            { driver: 'Carol', entries: [{ position: '1', lap_time: '1:22.000', track: 'Spa', car_class: 'GT3' }] }
        ]);

        input.value = 'Alice';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));

        // Immediately start a second search
        input.value = 'Carol';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        // Now resolve the first (stale) search
        resolveFirst([{ driver: 'Alice', entries: [{ position: '2', lap_time: '1:30.000', track: 'Monza', car_class: 'GT4' }] }]);
        await new Promise(r => setTimeout(r, 50));

        // Stale results from first search should have been discarded
        // Only the second search (Carol) or empty should remain - not Alice
        const html = document.getElementById('results-container').innerHTML;
        expect(html).not.toContain('Alice');
    });

    it('sort toggle between gap and lapTime', async () => {
        const ds = new window.driverSearch.constructor();
        ds.currentSearchId = 5;
        ds.allResults = [{
            driver: 'Dave',
            entries: [{ position: '1', lap_time: '1:30.000', gap: '+0.500', track: 'Spa', car_class: 'GT3' }]
        }];

        // Default sort is gap
        expect(ds.currentSortBy).toBe('gap');

        // Toggle lapTime
        await ds.sortDriverGroups('lapTimeToggle');
        expect(ds.currentSortBy).toBe('lapTime');

        // Toggle back to gap
        await ds.sortDriverGroups('lapTimeToggle');
        expect(ds.currentSortBy).toBe('gap');
    });

    it('tracks analytics on sort change', async () => {
        const ds = new window.driverSearch.constructor();
        ds.currentSearchId = 6;
        ds.allResults = [{
            driver: 'Eve',
            entries: [{ position: '1', lap_time: '1:28.000', track: 'Spa', car_class: 'GT3' }]
        }];
        window.R3EAnalytics.track.mockClear();

        await ds.sortDriverGroups('position');

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'driver sort changed',
            expect.objectContaining({ sort_by: 'position' })
        );
    });

    it('tracks analytics on pagination change', async () => {
        const ds = new window.driverSearch.constructor();
        ds.currentSearchId = 7;
        ds.itemsPerPage = 1;
        ds.allResults = [
            { driver: 'A', entries: [{ position: '1', lap_time: '1:30.000', track: 'Spa', car_class: 'GT3' }] },
            { driver: 'B', entries: [{ position: '2', lap_time: '1:31.000', track: 'Spa', car_class: 'GT3' }] }
        ];
        document.getElementById('results-container').scrollIntoView = vi.fn();
        window.R3EAnalytics.track.mockClear();

        await ds.goToPage(2);

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'driver pagination changed',
            expect.objectContaining({ page_number: 2 })
        );
    });

    it('wheel filter removes entries that do not match the selected wheel type', async () => {
        window.R3EUtils.getUrlParam.mockReturnValue('');
        const ds = new window.driverSearch.constructor();
        ds.selectedWheel = 'gt';

        window.dataService.searchDriver.mockResolvedValueOnce([
            {
                driver: 'Alice',
                entries: [
                    { position: '1', lap_time: '1:30.000', car_class: 'GT3 Class' },
                    { position: '2', lap_time: '1:31.000', car_class: 'Touring' }
                ]
            }
        ]);

        const input = document.getElementById('driver-search');
        input.value = 'Alice';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        // Only the Touring entry (wheel_cat: 'gt') should remain
        expect(ds.allResults).toHaveLength(1);
        expect(ds.allResults[0].entries).toHaveLength(1);
        expect(ds.allResults[0].entries[0].car_class).toBe('Touring');
    });

    it('wheel filter removes entire driver group when no entries match', async () => {
        window.R3EUtils.getUrlParam.mockReturnValue('');
        const ds = new window.driverSearch.constructor();
        ds.selectedWheel = 'round';

        window.dataService.searchDriver.mockResolvedValueOnce([
            { driver: 'Bob', entries: [{ position: '1', lap_time: '1:28.000', car_class: 'Touring' }] }
        ]);

        const input = document.getElementById('driver-search');
        input.value = 'Bob';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        // Touring is 'gt', doesn't match 'round' — group is removed
        expect(ds.allResults).toHaveLength(0);
    });

    it('wheel filter round_and_roundflat matches both round and round flat', async () => {
        window.R3EUtils.getUrlParam.mockReturnValue('');
        const ds = new window.driverSearch.constructor();
        ds.selectedWheel = 'round_and_roundflat';

        window.dataService.searchDriver.mockResolvedValueOnce([
            {
                driver: 'Carol',
                entries: [
                    { position: '1', lap_time: '1:30.000', car_class: 'GT3 Class' },
                    { position: '2', lap_time: '1:31.000', car_class: 'Open Wheel' },
                    { position: '3', lap_time: '1:32.000', car_class: 'Touring' }
                ]
            }
        ]);

        const input = document.getElementById('driver-search');
        input.value = 'Carol';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        // GT3 Class = round flat, Open Wheel = round — both match; Touring = gt — excluded
        expect(ds.allResults[0].entries).toHaveLength(2);
        expect(ds.allResults[0].entries.map(e => e.car_class)).toEqual(['GT3 Class', 'Open Wheel']);
    });

    it('no wheel filter returns all entries unfiltered', async () => {
        window.R3EUtils.getUrlParam.mockReturnValue('');
        const ds = new window.driverSearch.constructor();
        ds.selectedWheel = '';

        window.dataService.searchDriver.mockResolvedValueOnce([
            {
                driver: 'Dave',
                entries: [
                    { position: '1', lap_time: '1:30.000', car_class: 'GT3 Class' },
                    { position: '2', lap_time: '1:31.000', car_class: 'Touring' }
                ]
            }
        ]);

        const input = document.getElementById('driver-search');
        input.value = 'Dave';
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        expect(ds.allResults[0].entries).toHaveLength(2);
    });
});
