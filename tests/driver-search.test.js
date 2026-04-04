import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

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
        filterAndSortKeys: keys => keys,
        renderDriverGroupedTable: () => '<table><tbody><tr><td>ok</td></tr></tbody></table>'
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

    loadBrowserScript('modules/driver-search.js');
});

beforeEach(() => {
    document.body.innerHTML = buildDom();
    window.R3EUtils.updateUrlParam.mockClear();
    window.dataService.searchDriver.mockReset();
    window.dataService.searchDriver.mockResolvedValue([]);
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
});
