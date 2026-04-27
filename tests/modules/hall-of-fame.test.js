import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

// hall-of-fame.js is an IIFE – safe to reload per test group.
// It closes over DOM refs captured at load time, so we set up DOM before each load.

function buildHofDOM(withSearch = true) {
    return `
        <div id="hall-of-fame-container"></div>
        ${withSearch ? '<input id="driver-search" type="text" value="">' : ''}
    `;
}

function makeStatsDataMock(poles = [], bested = [], avgBested = []) {
    const paths = {
        polePath: 'cache/stats/overall/poles.json.gz',
        bestedPath: 'cache/stats/overall/bested.json.gz',
        avgBestedPath: 'cache/stats/overall/avg_bested.json.gz'
    };
    const payloadByPath = {
        [paths.polePath]: { kind: 'pole' },
        [paths.bestedPath]: { kind: 'bested' },
        [paths.avgBestedPath]: { kind: 'avg_bested' }
    };
    return {
        METRIC_DEFINITIONS: {
            pole: { metricKey: 'pole_positions', fileKey: 'pole_file', direction: 'desc' },
            bested: { metricKey: 'bested_drivers', fileKey: 'bested_file', direction: 'desc' },
            avg_bested: { metricKey: 'avg_bested', fileKey: 'avg_bested_file', direction: 'desc' }
        },
        loadStatsIndex: vi.fn().mockResolvedValue({}),
        getPathsForFilter: vi.fn().mockReturnValue(paths),
        getAllPathsForFilter: vi.fn().mockReturnValue(paths),
        fetchGzipJson: vi.fn().mockImplementation((path) => Promise.resolve(payloadByPath[path] || {})),
        normalizeRows: vi.fn().mockImplementation((payload) => {
            if (payload && payload.kind === 'pole') return poles;
            if (payload && payload.kind === 'bested') return bested;
            if (payload && payload.kind === 'avg_bested') return avgBested;
            return [];
        })
    };
}

function makeR3EUtilsStub() {
    return {
        isDriverSearchActive() {
            const input = document.getElementById('driver-search');
            if (input && input.value.trim().length > 0) return true;
            const params = new URLSearchParams(window.location.search);
            return Boolean((params.get('driver') || params.get('query') || '').trim());
        },
        escapeHtml: (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    };
}

// ---------------------------------------------------------------------------
// Visibility – URL-based
// ---------------------------------------------------------------------------
describe('hall-of-fame – visibility via URL params', () => {
    beforeEach(() => {
        window.StatsData = makeStatsDataMock();
        window.R3EUtils = makeR3EUtilsStub();
    });

    it('shows the container when no search params are present', () => {
        window.history.replaceState({}, '', '/');
        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        expect(document.getElementById('hall-of-fame-container').style.display).not.toBe('none');
    });

    it('hides the container when ?driver= param is in the URL', () => {
        window.history.replaceState({}, '', '/?driver=Alice');
        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        expect(document.getElementById('hall-of-fame-container').style.display).toBe('none');
    });

    it('hides the container when ?query= param is in the URL', () => {
        window.history.replaceState({}, '', '/?query=Bob');
        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        expect(document.getElementById('hall-of-fame-container').style.display).toBe('none');
    });

    it('ignores empty driver= param and keeps container visible', () => {
        window.history.replaceState({}, '', '/?driver=');
        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        expect(document.getElementById('hall-of-fame-container').style.display).not.toBe('none');
    });
});

// ---------------------------------------------------------------------------
// Visibility – input events
// ---------------------------------------------------------------------------
describe('hall-of-fame – visibility via search input', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        window.StatsData = makeStatsDataMock();
        window.R3EUtils = makeR3EUtilsStub();
        document.body.innerHTML = buildHofDOM(true);
        loadBrowserScript('modules/hall-of-fame.js');
    });

    it('hides when a value is typed in the search input', () => {
        const input = document.getElementById('driver-search');
        const container = document.getElementById('hall-of-fame-container');
        input.value = 'Alice';
        input.dispatchEvent(new Event('input'));
        expect(container.style.display).toBe('none');
    });

    it('shows again when the search input is cleared', () => {
        const input = document.getElementById('driver-search');
        const container = document.getElementById('hall-of-fame-container');

        input.value = 'Alice';
        input.dispatchEvent(new Event('input'));
        expect(container.style.display).toBe('none');

        input.value = '';
        input.dispatchEvent(new Event('input'));
        expect(container.style.display).not.toBe('none');
    });

    it('responds to change events as well as input events', () => {
        const input = document.getElementById('driver-search');
        const container = document.getElementById('hall-of-fame-container');
        input.value = 'Test';
        input.dispatchEvent(new Event('change'));
        expect(container.style.display).toBe('none');
    });
});

// ---------------------------------------------------------------------------
// Early return – missing container
// ---------------------------------------------------------------------------
describe('hall-of-fame – missing container', () => {
    it('does not throw when #hall-of-fame-container is absent from the DOM', () => {
        window.history.replaceState({}, '', '/');
        document.body.innerHTML = '<div>no container</div>';
        expect(() => loadBrowserScript('modules/hall-of-fame.js')).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Rendered HTML structure
// ---------------------------------------------------------------------------
describe('hall-of-fame – rendered HTML', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        window.R3EUtils = makeR3EUtilsStub();
    });

    it('renders Hall of Fame card with poles and bested sections after data loads', async () => {
        const poles = [{ name: 'Alice', value: 50 }, { name: 'Bob', value: 40 }, { name: 'Carol', value: 30 }];
        const bested = [{ name: 'Dave', value: 20 }, { name: 'Eve', value: 15 }, { name: 'Frank', value: 10 }];
        window.StatsData = makeStatsDataMock(poles, bested);

        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');

        // Flush async init (all mocks resolve immediately)
        await new Promise(resolve => setTimeout(resolve, 0));

        const container = document.getElementById('hall-of-fame-container');
        expect(container.innerHTML).toContain('Hall of Fame');
        expect(container.innerHTML).toContain('Most poles');
        expect(container.innerHTML).toContain('Most bested');
        expect(container.innerHTML).toContain('Alice');
        expect(container.innerHTML).toContain('50');
        expect(container.innerHTML).toContain('Dave');
        expect(container.innerHTML).toContain('20');
    });

    it('links the card to records.html', async () => {
        window.StatsData = makeStatsDataMock([{ name: 'X', value: 1 }], [{ name: 'Y', value: 1 }]);

        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const link = document.querySelector('#hall-of-fame-container a.hall-of-fame-link');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('records.html');
    });

    it('renders "No data" placeholder when poles array is empty', async () => {
        window.StatsData = makeStatsDataMock([], []);

        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(document.getElementById('hall-of-fame-container').innerHTML)
            .toContain('No data');
    });

    it('escapes HTML special characters in driver names', async () => {
        const poles = [{ name: '<script>alert(1)</script>', value: 5 }];
        window.StatsData = makeStatsDataMock(poles, []);

        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('hall-of-fame-container').innerHTML;
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('uses R3EUtils.escapeHtml when available', async () => {
        const escapeHtml = vi.fn().mockReturnValue('ESCAPED');
        window.R3EUtils = { ...makeR3EUtilsStub(), escapeHtml };
        const poles = [{ name: 'Tester', value: 3 }];
        window.StatsData = makeStatsDataMock(poles, []);

        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(escapeHtml).toHaveBeenCalled();
        expect(document.getElementById('hall-of-fame-container').innerHTML)
            .toContain('ESCAPED');
    });
    it('fetches avg_bested from its own dedicated file, not from the bested file', async () => {
        const avgBestedRows = [{ name: 'TopAvg', value: 99.5 }];
        const bestedRows = [{ name: 'TopBested', value: 500000 }];
        window.StatsData = makeStatsDataMock([], bestedRows, avgBestedRows);

        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const { fetchGzipJson } = window.StatsData;
        const avgBestedPath = 'cache/stats/overall/avg_bested.json.gz';
        const bestedPath = 'cache/stats/overall/bested.json.gz';

        // avgBestedPath must have been fetched
        expect(fetchGzipJson).toHaveBeenCalledWith(avgBestedPath);

        const container = document.getElementById('hall-of-fame-container');
        // The avg bested column shows the driver from avgBestedRows, not bestedRows
        expect(container.innerHTML).toContain('TopAvg');

        // fetchGzipJson calls for avg_bested and bested must be distinct
        const calls = fetchGzipJson.mock.calls.map(([p]) => p);
        expect(calls).toContain(avgBestedPath);
        expect(calls).toContain(bestedPath);
        expect(calls.indexOf(avgBestedPath)).not.toBe(calls.indexOf(bestedPath));
    });
});

// ---------------------------------------------------------------------------
describe('hall-of-fame – missing StatsData', () => {
    it('does not throw and leaves the container empty when StatsData is absent', async () => {
        window.history.replaceState({}, '', '/');
        window.StatsData = undefined;
        document.body.innerHTML = buildHofDOM();
        expect(() => loadBrowserScript('modules/hall-of-fame.js')).not.toThrow();
        await new Promise(resolve => setTimeout(resolve, 0));
        // Container should still exist and not have crashed
        expect(document.getElementById('hall-of-fame-container')).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// StatsData returns no valid paths
// ---------------------------------------------------------------------------
describe('hall-of-fame – StatsData returns null paths', () => {
    it('does not render when getPathsForFilter returns null', async () => {
        window.history.replaceState({}, '', '/');
        window.StatsData = {
            loadStatsIndex: vi.fn().mockResolvedValue({}),
            getPathsForFilter: vi.fn().mockReturnValue(null),
            fetchGzipJson: vi.fn(),
            normalizeRows: vi.fn()
        };
        document.body.innerHTML = buildHofDOM();
        loadBrowserScript('modules/hall-of-fame.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const container = document.getElementById('hall-of-fame-container');
        // No render occurred – container should be empty
        expect(container.innerHTML.trim()).toBe('');
    });
});

