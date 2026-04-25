import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="records-class-filter-ui"></div>',
        '<div id="records-tables">',
        '  <section class="records-box" data-record-key="avg_bested">',
        '    <h2 id="records-avg-bested-title"></h2>',
        '    <div class="records-table-container" id="records-avg-bested-table"></div>',
        '    <button class="records-expand-toggle" data-record-key="avg_bested" aria-expanded="false">',
        '      <span class="records-expand-toggle__label">Show top 50</span>',
        '      <span class="records-expand-toggle__icon">▾</span>',
        '    </button>',
        '  </section>',
        '  <section class="records-box" data-record-key="bested">',
        '    <h2 id="records-bested-title"></h2>',
        '    <div class="records-table-container" id="records-bested-table"></div>',
        '    <button class="records-expand-toggle" data-record-key="bested" aria-expanded="false">',
        '      <span class="records-expand-toggle__label">Show top 50</span>',
        '      <span class="records-expand-toggle__icon">▾</span>',
        '    </button>',
        '  </section>',
        '  <section class="records-box" data-record-key="pole">',
        '    <h2 id="records-pole-title"></h2>',
        '    <div class="records-table-container" id="records-pole-table"></div>',
        '    <button class="records-expand-toggle" data-record-key="pole" aria-expanded="false">',
        '      <span class="records-expand-toggle__label">Show top 50</span>',
        '      <span class="records-expand-toggle__icon">▾</span>',
        '    </button>',
        '  </section>',
        '  <section class="records-box" data-record-key="podium">',
        '    <h2 id="records-podium-title"></h2>',
        '    <div class="records-table-container" id="records-podium-table"></div>',
        '    <button class="records-expand-toggle" data-record-key="podium" aria-expanded="false">',
        '      <span class="records-expand-toggle__label">Show top 50</span>',
        '      <span class="records-expand-toggle__icon">▾</span>',
        '    </button>',
        '  </section>',
        '  <section class="records-box" data-record-key="entries">',
        '    <h2 id="records-entries-title"></h2>',
        '    <div class="records-table-container" id="records-entries-table"></div>',
        '    <button class="records-expand-toggle" data-record-key="entries" aria-expanded="false">',
        '      <span class="records-expand-toggle__label">Show top 50</span>',
        '      <span class="records-expand-toggle__icon">▾</span>',
        '    </button>',
        '  </section>',
        '</div>'
    ].join('');
}

function makeDriverList(prefix, count) {
    return Array.from({ length: count }, (_, i) => ({
        name: `${prefix}-${i + 1}`,
        country: 'DE',
        rank: 'A',
        value: count - i
    }));
}

function setupGlobals() {
    window.__recordsFilterOnChange = null;

    window.R3EUtils = {
        escapeHtml: (value) => String(value ?? ''),
        renderRankStars: vi.fn(() => ''),
        resolveCarClassLogo: vi.fn(() => '')
    };
    window.FlagHelper = { countryToFlag: vi.fn(() => '') };
    window.R3EAnalytics = { track: vi.fn() };

    window.loadMpPosCache = vi.fn().mockResolvedValue();
    window.resolveMpPos = vi.fn(() => null);
    window.getMpPosNameClasses = vi.fn(() => '');
    window.getCarClassId = vi.fn(() => '');

    window.dataService = {
        getSuperclassOptions: vi.fn().mockReturnValue([]),
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([])
    };

    window.CustomSelect = class {
        constructor(_rootId, _options, onChange) {
            window.__recordsFilterOnChange = onChange;
        }
    };

    // Pre-built large lists so we can assert top-3 vs top-50 differences.
    const lists = {
        avg_bested: makeDriverList('AVB', 60),
        bested: makeDriverList('BST', 60),
        pole: makeDriverList('POL', 60),
        podium: makeDriverList('POD', 60),
        entries: makeDriverList('ENT', 60)
    };

    window.StatsData = {
        METRIC_DEFINITIONS: {
            avg_bested: { metricKey: 'avg_bested', fileKey: 'bested_file', direction: 'desc' },
            bested: { metricKey: 'bested_drivers', fileKey: 'bested_file', direction: 'desc' },
            pole: { metricKey: 'pole_positions', fileKey: 'pole_file', direction: 'desc' },
            podium: { metricKey: 'podiums', fileKey: 'podium_file', direction: 'desc' },
            entries: { metricKey: 'entries', fileKey: 'entries_file', direction: 'desc' }
        },
        loadStatsIndex: vi.fn().mockResolvedValue({ index: true }),
        getAllPathsForFilter: vi.fn(() => ({
            polePath: 'p.gz',
            bestedPath: 'b.gz',
            podiumPath: 'd.gz',
            avgBestedPath: 'ab.gz',
            entriesPath: 'e.gz'
        })),
        fetchGzipJson: vi.fn((path) => {
            if (path === 'ab.gz') return Promise.resolve({ kind: 'avg_bested' });
            if (path === 'b.gz') return Promise.resolve({ kind: 'bested' });
            if (path === 'p.gz') return Promise.resolve({ kind: 'pole' });
            if (path === 'd.gz') return Promise.resolve({ kind: 'podium' });
            if (path === 'e.gz') return Promise.resolve({ kind: 'entries' });
            return Promise.resolve(null);
        }),
        normalizeRows: vi.fn((payload, _metricKey, topRows) => {
            if (!payload || !payload.kind) return [];
            return lists[payload.kind].slice(0, topRows);
        })
    };
}

beforeEach(() => {
    document.body.innerHTML = buildDom();
    setupGlobals();
    loadBrowserScript('modules/stats-renderer.js');
});

async function loadAndWait() {
    loadBrowserScript('modules/pages/records.js');
    // Wait for two microtask ticks to ensure all promises in fetchAndRender resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('records page integration', () => {
    it('renders all 4 sections with top 3 rows by default', async () => {
        await loadAndWait();

        for (const key of ['avg_bested', 'bested', 'pole', 'podium', 'entries']) {
            const tableId = `records-${key.replace(/_/g, '-')}-table`;
            const html = document.getElementById(tableId).innerHTML;
            const rowCount = (html.match(/<tr>/g) || []).length;
            // 1 header row + 3 data rows = 4
            expect(rowCount, `${key} should render 3 data rows`).toBe(4);
        }
    });

    it('expands a section to top 50 when its toggle is clicked', async () => {
        await loadAndWait();

        const toggle = document.querySelector('.records-expand-toggle[data-record-key="avg_bested"]');
        toggle.click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const avgBestedRows = (document.getElementById('records-avg-bested-table').innerHTML.match(/<tr>/g) || []).length;
        expect(avgBestedRows).toBe(51); // 1 header + 50 data
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.classList.contains('is-expanded')).toBe(true);

        // Other sections still show top 3
        const poleRows = (document.getElementById('records-pole-table').innerHTML.match(/<tr>/g) || []).length;
        expect(poleRows).toBe(4);
    });

    it('collapses the previously expanded section when another toggle is clicked', async () => {
        await loadAndWait();

        const bestedToggle = document.querySelector('.records-expand-toggle[data-record-key="bested"]');
        const podiumToggle = document.querySelector('.records-expand-toggle[data-record-key="podium"]');

        bestedToggle.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(bestedToggle.getAttribute('aria-expanded')).toBe('true');

        podiumToggle.click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(bestedToggle.getAttribute('aria-expanded')).toBe('false');
        expect(podiumToggle.getAttribute('aria-expanded')).toBe('true');

        const bestedRows = (document.getElementById('records-bested-table').innerHTML.match(/<tr>/g) || []).length;
        const podiumRows = (document.getElementById('records-podium-table').innerHTML.match(/<tr>/g) || []).length;
        expect(bestedRows).toBe(4);
        expect(podiumRows).toBe(51);
    });

    it('collapses a section when its own toggle is clicked twice', async () => {
        await loadAndWait();

        const toggle = document.querySelector('.records-expand-toggle[data-record-key="avg_bested"]');
        toggle.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        toggle.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        const rows = (document.getElementById('records-avg-bested-table').innerHTML.match(/<tr>/g) || []).length;
        expect(rows).toBe(4);
    });

    it('updates section titles to reflect the selected filter', async () => {
        await loadAndWait();

        window.__recordsFilterOnChange('GT3', { source: 'user' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        for (const key of ['avg_bested', 'bested', 'pole', 'podium', 'entries']) {
            const titleId = `records-${key.replace(/_/g, '-')}-title`;
            expect(document.getElementById(titleId).textContent).toContain('GT3');
        }
    });

    it('renders an error state when no stats files are available', async () => {
        window.StatsData.getAllPathsForFilter = vi.fn(() => null);

        await loadAndWait();

        for (const key of ['avg_bested', 'bested', 'pole', 'podium', 'entries']) {
            const tableId = `records-${key.replace(/_/g, '-')}-table`;
            expect(document.getElementById(tableId).innerHTML).toContain('Failed to load records');
        }
    });
});
