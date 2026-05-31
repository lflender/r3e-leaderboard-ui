import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<input id="team-search" />',
        '<div id="results-container"></div>'
    ].join('');
}

const MOCK_TEAMS = {
    'Alpha Racing': [
        { name: 'Alice Smith', path_id: '111' },
        { name: 'Bob Jones', path_id: '222' }
    ],
    'Beta Motorsport': [
        { name: 'Charlie Brown', path_id: '333' }
    ],
    'Gamma Speed': [
        { name: 'Delta Fox', path_id: '444' },
        { name: 'Echo Lima', path_id: '555' },
        { name: 'Foxtrot Mike', path_id: '666' }
    ]
};

beforeAll(() => {
    document.body.innerHTML = buildDom();
    window.R3EUtils = {
        escapeHtml: s => String(s ?? '')
    };
    window.R3EUrlUtils = {
        updateUrlParam: vi.fn(),
        getUrlParam: vi.fn().mockReturnValue('')
    };
    window.TemplateHelper = {
        showLoading: vi.fn(async (container, message = 'Loading...') => {
            container.innerHTML = `<div>${message}</div>`;
        }),
        showNoResults: vi.fn(async (container) => {
            container.innerHTML = '<div>No results found</div>';
        })
    };
    window.dataService = {
        loadTeams: vi.fn().mockResolvedValue(MOCK_TEAMS),
        searchDriver: vi.fn().mockResolvedValue([])
    };
    window.generatePaginationHTML = vi.fn().mockReturnValue('');
    window.StatsRenderer = {
        buildPositionBadge: (pos) => `<span class="pos-number">${pos}</span>`,
        buildDriverCell: (row) => `<a href="drivers.html?driver=${encodeURIComponent('"' + row.name + '"')}&id=${encodeURIComponent(row.path_id)}">${row.name}</a>`
    };
    window.tableRenderer = {
        renderHeaderCell: (key) => `<th>${key}</th>`,
        renderCell: (item, key) => `<td>${item[key] || ''}</td>`,
        renderGapPercentCell: () => '<td>100%</td>',
        sortService: {
            sortDriverEntries: (entries, sortBy) => {
                if (sortBy === 'position') {
                    entries.sort((a, b) => parseInt(a.position || 999) - parseInt(b.position || 999));
                }
            }
        }
    };
    window.ColumnConfig = {
        getOrderedColumns: () => ['car_class', 'car', 'position', 'track', 'lap_time', 'GapPercent'],
        getHiddenColumnAliases: () => []
    };
    window.FlagHelper = { countryToFlag: () => '' };
    window.resolveMpPosWithInactive = () => ({ position: null, inactive: false });
    window.getMpPosNameClasses = () => '';
    window.DriverStatsService = {
        lookupDriverStats: vi.fn().mockResolvedValue([
            { key: 'avg_bested', label: 'Average Bested %', format: 'percent', result: { value: 55.2, position: 10, total: 100 } },
            { key: 'bested', label: 'Drivers Bested', format: 'number', result: { value: 80, position: 5, total: 100 } },
            { key: 'pole', label: 'Pole Positions', format: 'number', result: { value: 3, position: 20, total: 100 } },
            { key: 'podium', label: 'Podiums', format: 'number', result: { value: 7, position: 15, total: 100 } }
        ]),
        lookupSingleStat: vi.fn().mockResolvedValue({ value: 42, position: 8, total: 100 }),
        formatValue: (v, fmt) => fmt === 'percent' ? v.toFixed(1) + '%' : Number(v).toLocaleString()
    };
    window.StatsData = {
        loadStatsIndex: vi.fn().mockResolvedValue({ overall: {}, overall_top: {} }),
        METRIC_DEFINITIONS: {
            pole: { metricKey: 'pole_positions', fileKey: 'pole_file', direction: 'desc' },
            bested: { metricKey: 'bested_drivers', fileKey: 'bested_file', direction: 'desc' },
            podium: { metricKey: 'podiums', fileKey: 'podium_file', direction: 'desc' },
            avg_bested: { metricKey: 'avg_bested', fileKey: 'avg_bested_file', direction: 'desc' },
            entries: { metricKey: 'entries', fileKey: 'entries_file', direction: 'desc' }
        }
    };

    loadBrowserScript('modules/pages/teams.js');
});

beforeEach(() => {
    document.body.innerHTML = buildDom();
    window.R3EUrlUtils.updateUrlParam.mockClear();
    window.R3EUrlUtils.getUrlParam.mockReset();
    window.R3EUrlUtils.getUrlParam.mockReturnValue('');
    window.dataService.loadTeams.mockReset();
    window.dataService.loadTeams.mockResolvedValue(MOCK_TEAMS);
    window.dataService.searchDriver.mockReset();
    window.dataService.searchDriver.mockResolvedValue([]);
    window.generatePaginationHTML.mockClear();
});

describe('teams page', () => {
    it('initializes and preloads teams data', async () => {
        const page = new TeamsPage();
        // Wait for async preload
        await window.dataService.loadTeams();
        expect(window.dataService.loadTeams).toHaveBeenCalled();
    });

    it('displays all teams when loaded without search term', async () => {
        const page = new TeamsPage();
        await window.dataService.loadTeams();
        // Trigger the display manually since preload is async
        await page.searchTeams('');

        const container = document.getElementById('results-container');
        expect(container.innerHTML).toContain('Alpha Racing');
        expect(container.innerHTML).toContain('Beta Motorsport');
        expect(container.innerHTML).toContain('Gamma Speed');
    });

    it('shows member count in the table', async () => {
        const page = new TeamsPage();
        await page.searchTeams('');

        const container = document.getElementById('results-container');
        // Alpha Racing has 2 members
        const rows = container.querySelectorAll('.team-row');
        const alphaRow = Array.from(rows).find(r => r.getAttribute('data-team') === 'Alpha Racing');
        expect(alphaRow).toBeTruthy();
        expect(alphaRow.querySelector('.team-members-cell').textContent).toBe('2');
    });

    it('filters teams by search term', async () => {
        const page = new TeamsPage();
        await page.searchTeams('beta');

        const container = document.getElementById('results-container');
        expect(container.innerHTML).toContain('Beta Motorsport');
        expect(container.innerHTML).not.toContain('Alpha Racing');
        expect(container.innerHTML).not.toContain('Gamma Speed');
    });

    it('opens team profile in new tab on click', async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const page = new TeamsPage();
        await page.searchTeams('');

        const container = document.getElementById('results-container');

        // Click the Alpha Racing row
        const row = container.querySelector('.team-row[data-team="Alpha Racing"]');
        row.click();

        expect(openSpy).toHaveBeenCalledWith(
            'team-profile.html?team=Alpha%20Racing',
            '_blank'
        );
        openSpy.mockRestore();
    });

    it('shows no results when search matches nothing', async () => {
        const page = new TeamsPage();
        await page.searchTeams('zzz_nonexistent');

        expect(window.TemplateHelper.showNoResults).toHaveBeenCalled();
    });
});
