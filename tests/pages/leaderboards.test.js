import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBrowserScript } from '../helpers/script-loader.js';

it.each(['pages/leaderboards.html', 'pages/drivers.html'])(
    'provides an accessible track alias hint next to the track filter on %s', (file) => {
    const page = new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'text/html');
    const hint = page.querySelector('.search-container .track-alias-info');

    expect(hint.classList.contains('info-icon')).toBe(true);
    expect(hint.getAttribute('title')).toBe('Hold Ctrl to show track name aliases.\nAliases are also searchable.');
    expect(hint.getAttribute('aria-label')).toBe(hint.getAttribute('title'));
    expect(hint.tabIndex).toBe(0);
    expect(hint.previousElementSibling.id).toBe('track-filter-ui');
});

beforeAll(() => {
    loadBrowserScript('modules/track-helper.js');
    loadBrowserScript('modules/data/country-mappings.js');
    loadBrowserScript('modules/flag-helper.js');
});

function buildDom() {
    return [
        '<div id="track-filter-ui"><button class="custom-select__toggle" aria-expanded="false">All tracks ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<div id="track-layout-filter-ui" hidden><button class="custom-select__toggle" aria-expanded="false">All layouts ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<div id="track-class-filter-ui"><button class="custom-select__toggle" aria-expanded="false">All classes ▾</button><div class="custom-select__menu" hidden></div></div>',
        '<select id="class-filter"></select>',
        '<div id="combine-checkbox-container" style="display:none"><input id="combine-checkbox" type="checkbox" /></div>',
        '<div id="leaderboards"></div>',
        '<div id="leaderboards-table"></div>'
    ].join('');
}

beforeEach(() => {
    document.body.innerHTML = buildDom();
    sessionStorage.clear();
    window.customSelects = {};
    loadBrowserScript('modules/filter-state.js');
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
        isColumnType: (k, type) => {
            if (type === 'TOTAL_ENTRIES') return k === 'entry_count';
            return false;
        }
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
        constructor(id, options, onChange) {
            this.options = options;
            this.onChange = onChange;
            this.currentValue = '';
            window.customSelects = window.customSelects || {};
            window.customSelects[id] = this;
        }

        setValue(value, options = {}) {
            this.currentValue = value;
            if (options.notify !== false && this.onChange) {
                this.onChange(value, { source: options.source || 'programmatic' });
            }
        }

        setOptions(options) {
            this.options = options;
        }
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
    it('restores saved track, category, and combine filters', async () => {
        window.FilterOptionsService.getTrackOptions.mockReturnValue([
            { value: '', label: 'All tracks' },
            { value: '10', label: 'Spa - Grand Prix' }
        ]);
        window.FilterOptionsService.getSuperclassOptions.mockReturnValue([
            { value: 'superclass:GT3', label: 'Category: GT3' }
        ]);
        window.PageFilterState.write('leaderboards', 'track', '10');
        window.PageFilterState.write('leaderboards', 'class', 'superclass:GT3');
        window.PageFilterState.write('leaderboards', 'combine', true);

        loadBrowserScript('modules/compressed-json-helper.js');
        loadBrowserScript('modules/pages/leaderboards.js');
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.customSelects['track-filter-ui'].currentValue).toBe('10');
        expect(window.customSelects['track-class-filter-ui'].currentValue).toBe('superclass:GT3');
        expect(document.getElementById('combine-checkbox').checked).toBe(true);
        expect(document.getElementById('combine-checkbox-container').style.display).toBe('flex');
    });

    it('keeps the layout filter hidden until a track has multiple layouts', async () => {
        loadBrowserScript('modules/compressed-json-helper.js');
        loadBrowserScript('modules/pages/leaderboards.js');
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(document.getElementById('track-layout-filter-ui').hidden).toBe(true);
    });

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

    it('uses fetchAllCombinations when a track filter is selected and includes all layouts for that base track', async () => {
        window.TRACKS_DATA = [
            { id: 10, label: 'Spa - Grand Prix' },
            { id: 11, label: 'Spa - Indy' },
            { id: 20, label: 'Monza - GP' }
        ];
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 100 },
            { track_id: 11, class_name: 'GT3', entry_count: 75 },
            { track_id: 20, class_name: 'GT3', entry_count: 50 }
        ]);
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([]);

        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_name: 'GT3', entry_count: 100 },
            { track_id: 11, class_name: 'GT3', entry_count: 75 },
            { track_id: 20, class_name: 'GT4', entry_count: 50 }
        ]);
        trackFilterOnChange('10', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(window.dataService.fetchAllCombinations).toHaveBeenCalled();
        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('100');
        expect(html).toContain('75');
        expect(html).not.toContain('50');
    });

    it('shows layout options and filters to one selected layout', async () => {
        window.TRACKS_DATA = [
            { id: 10, label: 'Donington Park - National' },
            { id: 11, label: 'Donington Park - Grand Prix' }
        ];
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([
            { track_id: 10, class_name: 'GT3', entry_count: 100 },
            { track_id: 11, class_name: 'GT3', entry_count: 75 }
        ]);

        let trackFilterOnChange;
        let layoutFilterOnChange;
        let layoutOptions = [];
        window.CustomSelect = class {
            constructor(id, options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
                if (id === 'track-layout-filter-ui') {
                    layoutOptions = options;
                    layoutFilterOnChange = onChange;
                }
            }

            setOptions(options) {
                layoutOptions = options;
            }

            setValue() {}
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        trackFilterOnChange('10', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const layoutFilter = document.getElementById('track-layout-filter-ui');
        expect(layoutFilter.hidden).toBe(false);
        expect(layoutOptions.map(option => option.label)).toEqual(['All layouts', 'National', 'Grand Prix']);

        layoutFilterOnChange('11', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('75');
        expect(html).not.toContain('100');
    });

    it('keeps the layout selector hidden for a single-layout track', async () => {
        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        trackFilterOnChange('10', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(document.getElementById('track-layout-filter-ui').hidden).toBe(true);
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
        document.body.innerHTML = buildDom() + '<a id="track-description" target="_blank" rel="noopener noreferrer" hidden></a>';
        window.TRACKS_META = { 10: {
            description: 'Famous Belgian circuit',
            url: 'https://example.com/spa',
            location: 'Francorchamps, Belgium',
            trackType: 'Permanent Circuit',
            opened: '2022',
            racedHere: 'DTM and 17 more'
        } };

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
        expect(descEl.href).toBe('https://example.com/spa');
        expect(descEl.target).toBe('_blank');
        expect(descEl.rel).toBe('noopener noreferrer');
        const details = Array.from(descEl.querySelectorAll('dl > div')).map(item => [
            item.querySelector('dt').textContent,
            item.querySelector('dd').textContent
        ]);
        expect(details).toEqual([
            ['Location:', 'Francorchamps, Belgium'],
            ['Track:', 'Permanent Circuit'],
            ['Opened:', '2022'],
            ['Raced here:', 'DTM and 17 more']
        ]);
        const flag = descEl.querySelector('.track-description__flag');
        expect(flag.querySelector('.fi-be')).not.toBeNull();
        expect(flag.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows the description for WeatherTech Raceway Laguna Seca 1987', async () => {
        document.body.innerHTML = buildDom() + '<a id="track-description" hidden></a>';
        loadBrowserScript('modules/data/tracks.js');

        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };

        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValue([]);
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([
            { track_id: 13533, class_name: 'GT3', entry_count: 50 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        trackFilterOnChange('13533', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const descEl = document.getElementById('track-description');
        expect(descEl.hidden).toBe(false);
        expect(descEl.textContent).toContain('Laguna Seca as it was until 1988');
    });

    it('shows metadata by ID even when the displayed track name changes', async () => {
        document.body.innerHTML = buildDom() + '<a id="track-description" hidden></a>';
        loadBrowserScript('modules/data/tracks.js');
        window.TRACKS_DATA.find(track => track.id === 2024).label = 'Renamed circuit - Grand Prix';
        let trackFilterOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'track-filter-ui') trackFilterOnChange = onChange;
            }
        };
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));
        trackFilterOnChange('2024', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const descEl = document.getElementById('track-description');
        expect(descEl.hidden).toBe(false);
        expect(descEl.textContent).toContain('Estoril');
    });

    it('hides track description when no track filter is active', async () => {
        document.body.innerHTML = buildDom() + '<a id="track-description" hidden></a>';
        window.TRACKS_META = {
            10: { description: 'Famous Belgian circuit', url: 'https://example.com/spa', location: 'Belgium' },
            11: { description: 'Track without a link', trackType: '<Hillclimb>' }
        };

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

        const descEl = document.getElementById('track-description');
        expect(descEl.getAttribute('href')).toBe('https://example.com/spa');

        trackFilterOnChange('11', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(descEl.hidden).toBe(false);
        expect(descEl.textContent).toBe('Track without a linkTrack:<Hillclimb>');
        expect(descEl.querySelectorAll('dl > div')).toHaveLength(1);
        expect(descEl.querySelector('dd').textContent).toBe('<Hillclimb>');
        expect(descEl.querySelector('dd').children).toHaveLength(0);
        expect(descEl.querySelector('.track-description__flag')).toBeNull();
        expect(descEl.hasAttribute('href')).toBe(false);
        expect(descEl.hasAttribute('title')).toBe(false);

        trackFilterOnChange('', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(descEl.hidden).toBe(true);
        expect(descEl.textContent).toBe('');
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

    it('renders pole column header and placeholder cells', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_id: 5, class_name: 'GT3', entry_count: 100 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).toContain('Pole');
        expect(html).toContain('pole-cell');
        expect(html).toContain('data-pole-track="10"');
        expect(html).toContain('data-pole-class="5"');
        expect(html).toContain('pole-placeholder');
    });

    it('lazily populates pole cells with driver data via buildDriverCell', async () => {
        window.StatsRenderer = {
            buildDriverCell: vi.fn((row) => `<a>${row.name}</a>`)
        };
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 10, class_id: 5, class_name: 'GT3', entry_count: 100 }
        ]);
        window.dataService.fetchPoleTime = vi.fn().mockResolvedValueOnce({
            name: 'Max Speed',
            country: 'de',
            rank: 'A',
            avatar: 'https://img/max.png',
            path_id: '12345',
            laptime: '1:45.200s'
        });

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 50));

        const cell = document.querySelector('td[data-pole-track="10"][data-pole-class="5"]');
        expect(cell).not.toBeNull();
        expect(cell.innerHTML).toContain('Max Speed');
        expect(cell.classList.contains('pole-loaded')).toBe(true);
        expect(window.StatsRenderer.buildDriverCell).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Max Speed',
            country: 'de',
            rank: 'A'
        }));
    });

    it('shows dash in pole cell when fetch returns null', async () => {
        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValueOnce([
            { track_id: 99, class_id: 99, class_name: 'GT4', entry_count: 10 }
        ]);
        window.dataService.fetchPoleTime = vi.fn().mockResolvedValueOnce(null);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 50));

        const cell = document.querySelector('td[data-pole-track="99"][data-pole-class="99"]');
        expect(cell).not.toBeNull();
        expect(cell.innerHTML).toContain('pole-no-data');
    });

    it('does not render pole column in combine mode', async () => {
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

        window.dataService.fetchTopCombinations = vi.fn().mockResolvedValue([]);
        window.dataService.fetchAllCombinations = vi.fn().mockResolvedValue([
            { track_id: 10, class_name: 'GT3', entry_count: 200 },
            { track_id: 10, class_name: 'GT4', entry_count: 80 }
        ]);

        loadLeaderboards();
        await new Promise(resolve => setTimeout(resolve, 20));

        // Select superclass and enable combine mode
        classFilterOnChange('superclass:GT', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 20));

        const combineCheckbox = document.getElementById('combine-checkbox');
        combineCheckbox.checked = true;
        combineCheckbox.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 20));

        const html = document.getElementById('leaderboards-table').innerHTML;
        expect(html).not.toContain('data-pole-track');
        // The header should not have Pole column in combine mode
        const headers = document.querySelectorAll('#leaderboards-table th');
        const poleHeader = Array.from(headers).find(th => th.textContent === 'Pole');
        expect(poleHeader).toBeUndefined();
    });
});
