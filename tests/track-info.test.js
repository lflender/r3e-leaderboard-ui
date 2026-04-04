import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="track-filter-ui"><button class="custom-select__toggle" aria-expanded="false">All tracks ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<div id="track-class-filter-ui"><button class="custom-select__toggle" aria-expanded="false">All classes ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<select id="class-filter"></select>',
        '<div id="combine-checkbox-container" style="display:none"><input id="combine-checkbox" type="checkbox" /></div>',
        '<div id="track-info"></div>',
        '<div id="track-info-table"></div>'
    ].join('');
}

beforeEach(() => {
    document.body.innerHTML = buildDom();
    window.TRACKS_DATA = [{ id: 10, label: 'Spa - Grand Prix' }];
    window.CARS_DATA = [{ superclass: 'GT3', class: 'GT3' }];
    window.getCarClassId = vi.fn().mockReturnValue(5);
    window.getCarClassName = vi.fn().mockReturnValue('GT3');
    window.R3EAnalytics = { track: vi.fn() };
    window.R3EUtils = {
        escapeHtml: s => String(s),
        formatValue: v => String(v ?? ''),
        formatHeader: s => String(s),
        formatDate: s => String(s)
    };
    window.ColumnConfig = {
        getOrderedColumns: keys => keys,
        getDisplayName: k => String(k),
        isColumnType: () => false
    };
    window.TemplateHelper = {
        showLoading: vi.fn(async (container) => { container.innerHTML = '<div>Loading</div>'; }),
        showNoResults: vi.fn(async (container) => { container.innerHTML = '<div>No results found</div>'; })
    };
    window.dataService = {
        getSuperclassOptions: vi.fn().mockReturnValue([]),
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([]),
        waitForDriverIndex: vi.fn().mockResolvedValue({})
    };

    window.CustomSelect = class {
        constructor(_id, _options, _onChange) {}
    };
});

describe('track-info integration', () => {
    it('renders rows from top combinations payload', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ([
                { track: 'Spa - Grand Prix', track_id: 10, class_name: 'GT3', entry_count: 321 }
            ])
        });

        loadBrowserScript('modules/track-info.js');
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('track-info-table').innerHTML;
        expect(html).toContain('Spa');
        expect(html).toContain('Grand Prix');
        expect(html).toContain('321');
        expect(typeof window.trackInfoGoToPage).toBe('function');
    });

    it('shows no-results state when payload is empty', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ([])
        });

        loadBrowserScript('modules/track-info.js');
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.TemplateHelper.showNoResults).toHaveBeenCalled();
        expect(document.getElementById('track-info-table').innerHTML).toContain('No results found');
    });
});
