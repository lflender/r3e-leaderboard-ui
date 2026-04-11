import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(async () => {
    window.history.replaceState({}, '', '/detail.html?track=10&class=5');
    document.body.innerHTML = [
        '<div id="detail-track"></div>',
        '<div id="detail-class"></div>',
        '<div id="detail-subtitle"></div>',
        '<div id="detail-results-container"></div>'
    ].join('');

    window.R3EAnalytics = { track: vi.fn() };
    window.R3EUtils = {
        getUrlParam: (name) => {
            const params = new URLSearchParams(window.location.search);
            return params.get(name) || '';
        },
        escapeHtml: s => String(s),
        formatDate: s => String(s),
        getPositionBadgeColor: () => '#fff'
    };

    window.TemplateHelper = {
        showLoading: vi.fn(async (container) => {
            container.innerHTML = '<div>Loading...</div>';
        }),
        showError: vi.fn(async (container, message) => {
            container.innerHTML = `<div class="error">${message}</div>`;
        }),
        showNoResults: vi.fn(async (container) => {
            container.innerHTML = '<div>No results</div>';
        }),
        generateTable: vi.fn().mockReturnValue('<table></table>'),
        generatePagination: vi.fn().mockReturnValue('')
    };

    // Return invalid shape to verify error-path wiring (extractLeaderboardArray => null).
    window.dataService = {
        fetchLeaderboardDetails: vi.fn().mockResolvedValue({ bad_payload: true }),
        extractLeaderboardArray: vi.fn().mockReturnValue(null),
        enrichEntriesWithDriverMetadata: vi.fn(async entries => entries)
    };

    window.DataNormalizer = {
        normalizeLeaderboardEntry: x => x,
        extractLapTime: () => '',
        normalizeTrackName: s => s
    };

    window.ColumnConfig = {
        getDisplayName: k => String(k),
        getOrderedColumns: k => k,
        isColumnType: () => false
    };

    window.CustomSelect = class {
        constructor() {}
        getValue() { return ''; }
        setValue() {}
    };

    loadBrowserScript('pages/detail.js');
    await new Promise(resolve => setTimeout(resolve, 0));
});

describe('detail page integration', () => {
    it('requests leaderboard details using URL params', () => {
        expect(window.dataService.fetchLeaderboardDetails).toHaveBeenCalledWith('10', '5');
    });

    it('shows loading and then error UI for invalid payload', () => {
        expect(window.TemplateHelper.showLoading).toHaveBeenCalled();
        expect(window.TemplateHelper.showError).toHaveBeenCalled();
        expect(document.getElementById('detail-results-container').innerHTML).toContain('error');
    });

    it('exposes global goToPage helper', () => {
        expect(typeof window.goToPage).toBe('function');
    });
});

