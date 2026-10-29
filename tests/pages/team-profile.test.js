import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return '<div id="team-profile-container" class="team-profile-container"></div>';
}

const MOCK_TEAMS = {
    'Alpha Racing': {
        country: 'Germany',
        drivers: [
            { name: 'Alice Smith', path_id: '111' },
            { name: 'Bob Jones', path_id: '222' }
        ]
    },
    'Beta Motorsport': {
        country: 'United Kingdom',
        drivers: [
            { name: 'Charlie Brown', path_id: '333' }
        ]
    }
};

beforeAll(() => {
    document.body.innerHTML = buildDom();
    window.R3EUtils = {
        escapeHtml: s => String(s ?? '')
    };
    window.R3EUrlUtils = {
        updateUrlParam: vi.fn(),
        getUrlParam: vi.fn().mockReturnValue('Alpha Racing')
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
        searchDriver: vi.fn().mockResolvedValue([]),
        fetchPoleTime: vi.fn().mockResolvedValue({ laptime: '1:29.000' }),
        enrichLapTimeGaps: vi.fn().mockResolvedValue([]),
        _loadDriverMetadataShard: vi.fn().mockResolvedValue({}),
        _normalizeDriverLookupName: (name) => name.toLowerCase(),
        _getShardKeyForName: (name) => name.charAt(0).toLowerCase(),
        _buildLookupKeyCandidates: (name) => [name.toLowerCase()],
        waitForDriverIndex: vi.fn().mockResolvedValue({})
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
    // localStorage mock
    const store = {};
    window.localStorage = {
        getItem: vi.fn((k) => store[k] || null),
        setItem: vi.fn((k, v) => { store[k] = v; }),
        removeItem: vi.fn((k) => { delete store[k]; })
    };
    // sessionStorage mock
    const sessionStore = {};
    window.sessionStorage = {
        getItem: vi.fn((k) => sessionStore[k] || null),
        setItem: vi.fn((k, v) => { sessionStore[k] = v; }),
        removeItem: vi.fn((k) => { delete sessionStore[k]; }),
        clear: vi.fn(() => { for (const k in sessionStore) delete sessionStore[k]; })
    };

    loadBrowserScript('modules/sort-service.js');
    loadBrowserScript('modules/pages/team-profile.js');
});

beforeEach(() => {
    document.body.innerHTML = buildDom();
    window.sessionStorage.clear();
    window.R3EUrlUtils.getUrlParam.mockReset();
    window.R3EUrlUtils.getUrlParam.mockReturnValue('Alpha Racing');
    window.dataService.loadTeams.mockReset();
    window.dataService.loadTeams.mockResolvedValue(MOCK_TEAMS);
    window.dataService.searchDriver.mockReset();
    window.dataService.searchDriver.mockResolvedValue([]);
    window.dataService.fetchPoleTime.mockReset();
    window.dataService.fetchPoleTime.mockResolvedValue({ laptime: '1:29.000' });
    window.dataService.enrichLapTimeGaps.mockReset();
    window.dataService.enrichLapTimeGaps.mockResolvedValue([]);
    window.DriverStatsService.lookupSingleStat.mockReset();
    window.DriverStatsService.lookupSingleStat.mockResolvedValue({ value: 42, position: 8, total: 100 });
    window.generatePaginationHTML.mockClear();
});

describe('team profile page', () => {
    it('renders team profile with member names', async () => {
        const page = new TeamProfilePage();
        await page.loadTeamProfile('Alpha Racing');

        const container = document.getElementById('team-profile-container');
        expect(container.innerHTML).toContain('Alpha Racing');
        expect(container.innerHTML).toContain('Alice Smith');
        expect(container.innerHTML).toContain('Bob Jones');
    });

    it('links team members to driver profile page', async () => {
        const page = new TeamProfilePage();
        await page.loadTeamProfile('Alpha Racing');

        const container = document.getElementById('team-profile-container');
        const link = container.querySelector('.stats-driver-cell a');
        expect(link).toBeTruthy();
        expect(link.getAttribute('href')).toContain('drivers.html');
        expect(link.getAttribute('href')).toContain('id=');
    });

    it('lazily loads stats and sorts by bested', async () => {
        window.DriverStatsService.lookupSingleStat.mockImplementation(async (name, key) => {
            if (key === 'bested') {
                const bested = name === 'Alice Smith' ? 50 : 80;
                return { value: bested, position: 1, total: 100 };
            }
            if (key === 'avg_bested') return { value: 60.0, position: 1, total: 100 };
            if (key === 'pole') return { value: 2, position: 1, total: 100 };
            if (key === 'podium') return { value: 5, position: 1, total: 100 };
            if (key === 'entries') return { value: 10, position: 1, total: 100 };
            return null;
        });

        const page = new TeamProfilePage();
        await page.loadTeamProfile('Alpha Racing');
        await page._loadMemberStats(page._profileMembers);

        const container = document.getElementById('team-profile-container');
        const rows = container.querySelectorAll('.team-profile-table tbody tr');
        // Bob (80 bested) should be first, Alice (50) second
        expect(rows[0].dataset.pathId).toBe('222');
        expect(rows[1].dataset.pathId).toBe('111');
    });

    it('sorts by column when header is clicked', async () => {
        window.DriverStatsService.lookupSingleStat.mockImplementation(async (name, key) => {
            if (key === 'pole') {
                const pole = name === 'Alice Smith' ? 10 : 2;
                return { value: pole, position: 1, total: 100 };
            }
            if (key === 'avg_bested') return { value: 50, position: 1, total: 100 };
            if (key === 'bested') return { value: 50, position: 1, total: 100 };
            if (key === 'podium') return { value: 5, position: 1, total: 100 };
            if (key === 'entries') return { value: 10, position: 1, total: 100 };
            return null;
        });

        const page = new TeamProfilePage();
        await page.loadTeamProfile('Alpha Racing');
        await page._loadMemberStats(page._profileMembers);

        const container = document.getElementById('team-profile-container');
        const poleHeader = container.querySelector('th[data-sort="pole"]');
        poleHeader.click();

        const rows = container.querySelectorAll('.team-profile-table tbody tr');
        expect(rows[0].dataset.pathId).toBe('111');
        expect(rows[1].dataset.pathId).toBe('222');
    });

    it('displays team totals after stats load', async () => {
        window.DriverStatsService.lookupSingleStat.mockImplementation(async (name, key) => {
            if (key === 'avg_bested') return { value: 60.0, position: 1, total: 100 };
            if (key === 'bested') return { value: 100, position: 1, total: 100 };
            if (key === 'pole') return { value: 5, position: 1, total: 100 };
            if (key === 'podium') return { value: 10, position: 1, total: 100 };
            if (key === 'entries') return { value: 20, position: 1, total: 100 };
            return null;
        });

        const page = new TeamProfilePage();
        await page.loadTeamProfile('Alpha Racing');
        await page._loadMemberStats(page._profileMembers);

        const totals = document.getElementById('team-totals');
        expect(totals.innerHTML).toContain('200'); // bested total
        expect(totals.innerHTML).toContain('10');  // poles total
        expect(totals.innerHTML).toContain('40');  // entries total
    });

    it('loads and displays team entries table', async () => {
        window.dataService.searchDriver.mockImplementation(async (name) => {
            if (name === '"Alice Smith"') {
                return [{ pathId: '111', entries: [
                    { name: 'Alice Smith', path_id: '111', car_class: 'GT3', car: 'Audi', position: '1/10', lap_time: '1:30.000', track_id: '100', difficulty: 'Get Real', date_time: '2024-01-01' }
                ]}];
            }
            if (name === '"Bob Jones"') {
                return [{ pathId: '222', entries: [
                    { name: 'Bob Jones', path_id: '222', car_class: 'GT4', car: 'BMW', position: '3/8', lap_time: '1:32.000', track_id: '100', difficulty: 'Get Real', date_time: '2024-01-02' }
                ]}];
            }
            return [];
        });

        const page = new TeamProfilePage();
        await page.loadTeamProfile('Alpha Racing');
        await page._loadTeamEntries(page._profileMembers);

        const container = document.getElementById('team-profile-container');
        expect(container.innerHTML).toContain('Alice Smith');
        expect(container.innerHTML).toContain('Bob Jones');
        const rows = container.querySelectorAll('.driver-data-row');
        expect(rows.length).toBe(2);
    });

    it('delegates Lap % enrichment to DataService and re-sorts after enrichment', async () => {
        const page = new TeamProfilePage();
        page._entriesSortBy = 'gapPercent';
        page._teamEntries = [];
        page._sortTeamEntries = vi.fn();
        page._renderEntriesTable = vi.fn();
        const container = document.getElementById('team-profile-container');
        container.innerHTML = '<div id="team-entries-container"><table><tr data-trackid="100" data-classid="1703" data-time="1:30.000"><td class="gap-percent-cell">-</td></tr></table></div>';
        const table = container.querySelector('table');
        const entry = {
            track_id: '100',
            class_id: '1703',
            lap_time: '1:30.000'
        };
        window.dataService.enrichLapTimeGaps.mockImplementation(async entries => {
            const originalLapTime = entries[0].lap_time;
            entries[0].lap_time = `${originalLapTime}, +1.000s`;
            return [{ entry: entries[0], originalLapTime }];
        });
        window.tableRenderer.renderGapPercentCell = vi.fn((item, referenceTime) =>
            `<td class="gap-percent-cell">${item.lap_time}</td>`
        );

        await page._populateGapPercentages([entry], table, container);

        expect(window.dataService.enrichLapTimeGaps).toHaveBeenCalledWith([entry]);
        expect(window.tableRenderer.renderGapPercentCell).toHaveBeenCalledWith(entry);
        expect(table.querySelector('.gap-percent-cell').textContent).toBe('1:30.000, +1.000s');
        expect(page._sortTeamEntries).toHaveBeenCalledOnce();
        expect(page._renderEntriesTable).toHaveBeenCalledOnce();
    });

    it('uses the shared gap/lap-time toggle on team entries', () => {
        const page = Object.create(TeamProfilePage.prototype);
        page.elements = { profileContainer: document.getElementById('team-profile-container') };
        page._entriesSortBy = 'gapPercent';
        page._teamEntries = [];
        page._entriesPage = 1;
        page._saveSortPref = vi.fn();
        page._sortTeamEntries = vi.fn();
        page._renderEntriesTable = vi.fn();
        page.elements.profileContainer.innerHTML =
            '<div id="team-entries-container"><table><thead><tr><th data-sort-key="lapTimeToggle"></th></tr></thead></table></div>';

        page._bindEntriesSortHandlers();
        const header = page.elements.profileContainer.querySelector('th');
        header.click();
        expect(page._entriesSortBy).toBe('gap');
        header.click();
        expect(page._entriesSortBy).toBe('lapTime');
    });
});
