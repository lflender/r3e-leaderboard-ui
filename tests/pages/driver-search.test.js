import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<input id="driver-search" />',
        '<select id="track-filter"></select>',
        '<div id="track-filter-ui"></div>',
        '<select id="class-filter"></select>',
        '<div id="track-class-filter-ui"></div>',
        '<div id="results-container"></div>'
    ].join('');
}

beforeAll(() => {
    document.body.innerHTML = buildDom();
    window.TRACKS_DATA = [{ id: 1, label: 'Spa' }];
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
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([]),
        getSuperclassOptions: vi.fn().mockReturnValue([]),
        searchDriver: vi.fn().mockResolvedValue([])
    };
    window.R3EAnalytics = { trackSearch: vi.fn(), track: vi.fn() };

    loadBrowserScript('pages/driver-search.js');
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
});

