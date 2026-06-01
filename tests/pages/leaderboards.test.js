import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="track-filter-ui"><button class="custom-select__toggle" aria-expanded="false">All tracks ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<div id="track-class-filter-ui"><button class="custom-select__toggle" aria-expanded="false">All classes ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<select id="class-filter"></select>',
        '<div id="combine-checkbox-container" style="display:none"><input id="combine-checkbox" type="checkbox" /></div>',
        '<div id="leaderboards"></div>',
        '<div id="leaderboards-table"></div>'
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
        formatDate: s => String(s),
        resolveTrackLabel: (trackId, fallback = '') => {
            const match = window.TRACKS_DATA.find(track => String(track.id) === String(trackId));
            return match ? match.label : fallback || String(trackId || '');
        },
        resolveTrackLabelForItem: (item, fallback = '') => {
            const trackId = item?.track_id || item?.TrackID || item?.trackId || item?.['Track ID'] || '';
            return window.R3EUtils.resolveTrackLabel(trackId, fallback || item?.track || item?.Track || '');
        },
        fetchWithTimeout: (url, options = {}) => fetch(url, options)
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
        waitForDriverIndex: vi.fn().mockResolvedValue({}),
        fetchTopCombinations: vi.fn().mockResolvedValue([]),
        fetchAllCombinations: vi.fn().mockResolvedValue([])
    };
    window.FilterOptionsService = {
        getSuperclassOptions: vi.fn().mockReturnValue([]),
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([]),
        getTrackOptions: vi.fn().mockReturnValue([{ value: '', label: 'All tracks' }])
    };

    window.CustomSelect = class {
        constructor(_id, _options, _onChange) {}
    };

    global.Response = class Response {
        constructor(value) {
            this.value = value;
        }

        async text() {
            return this.value;
        }
    };

    global.DecompressionStream = class DecompressionStream {
        constructor() {}
    };
});

describe('leaderboards integration', () => {
    it('renders rows from top combinations payload', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 321 }
        ]);

        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            body: {
                pipeThrough: vi.fn().mockReturnValue(JSON.stringify([
                    { track_id: 10, class_name: 'GT3', entry_count: 321 }
                ]))
            }
        });

        loadBrowserScript('modules/compressed-json-helper.js');
        loadBrowserScript('modules/pages/leaderboards.js');
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('Spa');
        expect(html).toContain('Grand Prix');
        expect(html).toContain('321');
        expect(typeof window.trackInfoGoToPage).toBe('function');
    });

    it('shows no-results state when payload is empty', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            body: {
                pipeThrough: vi.fn().mockReturnValue(JSON.stringify([]))
            }
        });

        loadBrowserScript('modules/compressed-json-helper.js');
        loadBrowserScript('modules/pages/leaderboards.js');
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.TemplateHelper.showNoResults).toHaveBeenCalled();
        expect(document.getElementById('leaderboards-table').innerHTML).toContain('No results found');
    });
});

describe('leaderboards fetchTopCombinations pipeline', () => {
    function loadLeaderboards() {
        loadBrowserScript('modules/compressed-json-helper.js');
        loadBrowserScript('modules/pages/leaderboards.js');
    }

    it('uses fetchAllCombinations when a track filter is selected', async () => {
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 100 },
            { track_id: 20, class_name: 'GT3', entry_count: 50 }
        ]);
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([]);

        // Capture the CustomSelect onChange for track filter
        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        // Now trigger a track filter change
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 100 },
            { track_id: 20, class_name: 'GT4', entry_count: 50 }
        ]);
        trackFilterOnChange('10', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.dataService.fetchAllCombinations).toHaveBeenCalled();
        const html = document.getElementById('leaderboards-table').innerHTML;
        // Only track 10 rows should appear
        expect(html).toContain('100');
        expect(html).not.toContain('50');
    });

    it('filters by class name when a regular class is selected', async () => {
        let classFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-class-filter-ui') classFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 200 },
            { track_id: 10, class_name: 'GT4', entry_count: 80 },
            { track_id: 20, class_name: 'GT3', entry_count: 150 }
        ]);
        classFilterOnChange('GT3', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('200');
        expect(html).toContain('150');
        expect(html).not.toContain('80');
    });

    it('filters by superclass expanding all matching classes', async () => {
        window.CARS_DATA = [
            { superclass: 'GT', class: 'GT3' },
            { superclass: 'GT', class: 'GT4' },
            { superclass: 'Touring', class: 'WTCR' }
        ];

        let classFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-class-filter-ui') classFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 200 },
            { track_id: 10, class_name: 'GT4', entry_count: 80 },
            { track_id: 10, class_name: 'WTCR', entry_count: 50 }
        ]);
        classFilterOnChange('superclass:GT', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('200');
        expect(html).toContain('80');
        expect(html).not.toContain('50');
    });

    it('sorts results by entry_count descending', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT4', entry_count: 50 },
            { track_id: 20, class_name: 'GT3', entry_count: 300 },
            { track_id: 30, class_name: 'GT3', entry_count: 150 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const rows = document.querySelectorAll('#leaderboards-table .driver-data-row');
        expect(rows.length).toBe(3);
        // First row should have the highest entry_count
        expect(rows[0].textContent).toContain('300');
        expect(rows[2].textContent).toContain('50');
    });

    it('combine mode collapses per-class rows into per-track totals', async () => {
        window.CARS_DATA = [
            { superclass: 'GT', class: 'GT3' },
            { superclass: 'GT', class: 'GT4' }
        ];

        let classFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-class-filter-ui') classFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        // Select superclass filter
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([
            { track_id: 10, class_name: 'GT3', entry_count: 200 },
            { track_id: 10, class_name: 'GT4', entry_count: 80 },
            { track_id: 20, class_name: 'GT3', entry_count: 100 }
        ]);
        classFilterOnChange('superclass:GT', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        // Now enable combine mode
        const combineCheckbox = document.getElementById('combine-checkbox');
        combineCheckbox.checked = true;
        combineCheckbox.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        // Track 10 should show combined 280 (200 + 80)
        expect(html).toContain('280');
        // Track 20 should show 100
        expect(html).toContain('100');
    });

    it('shows combine checkbox only for superclass filters', async () => {
        let classFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-class-filter-ui') classFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const container = document.getElementById('combine-checkbox-container');
        expect(container.style.display).toBe('none');

        // Select a superclass
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([]);
        classFilterOnChange('superclass:GT', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(container.style.display).toBe('flex');

        // Switch to a regular class
        classFilterOnChange('GT3', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(container.style.display).toBe('none');
    });

    it('paginates results at 100 items per page', async () => {
        const items = Array.from({ length: 150 }, (_, i) => ({
            track_id: i + 1, class_name: 'GT3', entry_count: 1000 - i
        }));
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce(items);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const rows = document.querySelectorAll('#leaderboards-table .driver-data-row');
        expect(rows.length).toBe(100);
        expect(document.getElementById('leaderboards-table').innerHTML).toContain('pagination');

        // Stub scrollIntoView for jsdom
        const el = document.getElementById('leaderboards');
        if (el) el.scrollIntoView = vi.fn();

        // Go to page 2
        window.trackInfoGoToPage(2);
        await new Promise(resolve => setTimeout(resolve, 20));

        const page2Rows = document.querySelectorAll('#leaderboards-table .driver-data-row');
        expect(page2Rows.length).toBe(50);
    });

    it('tracks analytics on filter change', async () => {
        let classFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-class-filter-ui') classFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([]);
        classFilterOnChange('GT3', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith('leaderboards filter changed', expect.objectContaining({
            filter_name: 'class',
            filter_value: 'GT3'
        }));
    });

    it('fires leaderboards page shown analytics once on initial render', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 100 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith('leaderboards page shown', expect.objectContaining({
            displayed_rows: 1
        }));
    });

    it('updates track description when a track filter with matching TRACKS_META is active', async () => {
        document.body.innerHTML = buildDom() + '<div id="track-description" hidden></div>';
        window.TRACKS_META = { 'Spa': { description: 'Famous Belgian circuit' } };

        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };

        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValue([]);
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([
            { track_id: 10, class_name: 'GT3', entry_count: 50 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        trackFilterOnChange('10', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const descEl = document.getElementById('track-description');
        expect(descEl.hidden).toBe(false);
        expect(descEl.innerHTML).toContain('Famous Belgian circuit');
    });

    it('hides track description when no track filter is active', async () => {
        document.body.innerHTML = buildDom() + '<div id="track-description" hidden></div>';
        window.TRACKS_META = { 'Spa': { description: 'Famous Belgian circuit' } };

        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };

        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValue([]);
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        // Select a track then deselect
        trackFilterOnChange('10', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        trackFilterOnChange('', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const descEl = document.getElementById('track-description');
        expect(descEl.hidden).toBe(true);
    });

    it('renders table with track name split into name and layout parts', async () => {
        window.TRACKS_DATA = [{ id: 10, label: 'Donington Park - Grand Prix' }];
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 200 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('Donington Park');
        expect(html).toContain('track-layout');
        expect(html).toContain('Grand Prix');
    });

    it('renders class logo when resolveCarClassLogo returns a URL', async () => {
        window.R3EUtils.resolveCarClassLogo = vi.fn().mockReturnValue('/images/gt3.webp');
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 150 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('table-car-class-logo');
        expect(html).toContain('/images/gt3.webp');
    });

    it('uses fallback column ordering when ColumnConfig is undefined', async () => {
        delete window.ColumnConfig;
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 100 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        // Should still render table even without ColumnConfig
        expect(html).toContain('results-table');
        expect(html).toContain('100');

        // Restore for other tests
        window.ColumnConfig = {
            getOrderedColumns: keys => keys,
            getDisplayName: k => String(k),
            isColumnType: () => false
        };
    });

    it('re-inserts entry_count column after TRACK when ColumnConfig filters it out', async () => {
        window.ColumnConfig = {
            getOrderedColumns: (keys) => keys.filter(k => k !== 'entry_count'),
            getDisplayName: k => k === 'entry_count' ? 'Entries' : String(k),
            isColumnType: (k, type) => {
                if (type === 'TOTAL_ENTRIES') return k === 'entry_count';
                if (type === 'TRACK') return k === 'track';
                return false;
            }
        };
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 250 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('entries-cell');
        expect(html).toContain('250');

        // Restore default mock
        window.ColumnConfig = {
            getOrderedColumns: keys => keys,
            getDisplayName: k => String(k),
            isColumnType: () => false
        };
    });

    it('renders date column using formatDate', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 50, date_time: '2026-03-15T12:00:00Z' }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('date-cell');
        expect(html).toContain('2026-03-15T12:00:00Z');
    });

    it('renders lap time with delta portion when present', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 50, LapTime: '1:30.000, +1.500' }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('time-delta-inline');
        expect(html).toContain('+1.500');
    });

    it('renders position cell with pos-number span', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 50, Position: '3' }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('pos-cell');
        expect(html).toContain('pos-number');
        expect(html).toContain('3');
    });
});

