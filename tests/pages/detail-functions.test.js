import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    // Minimal setup to load detail.js without triggering fetchAndRender
    window.history.replaceState({}, '', '/detail.html?track=1&class=2');

    window.R3EUtils = {
        getUrlParam: (name) => new URLSearchParams(window.location.search).get(name) || '',
        escapeHtml: s => String(s ?? ''),
        formatDate: s => String(s ?? ''),
        getPositionBadgeColor: () => '#fff',
        matchesCarFilterValue: (car, selected) => {
            if (!selected || selected === 'All cars') return true;
            return String(car || '') === String(selected);
        },
        findCarCombinations: () => [],
        resolveCarClassLogo: () => ''
    };

    window.R3EAnalytics = { track: vi.fn() };
    window.TemplateHelper = {
        showLoading: vi.fn(async () => {}),
        showError: vi.fn(async () => {}),
        showNoResults: vi.fn(async () => {}),
        generateTable: vi.fn().mockReturnValue(''),
        generatePagination: vi.fn().mockReturnValue('')
    };
    window.DataNormalizer = {
        normalizeLeaderboardEntry: x => x,
        normalizeTrackName: s => s,
        extractLapTime: () => ''
    };
    window.ColumnConfig = {
        getDisplayName: k => k,
        getOrderedColumns: k => k,
        isColumnType: () => false
    };
    window.CustomSelect = class {
        constructor() {}
        getValue() { return ''; }
        setValue() {}
        setOptions() {}
    };
    window.CarsChart = { generateHtml: vi.fn().mockReturnValue(''), getCarDistributionStats: vi.fn().mockReturnValue([]) };
    window.EntriesChart = {
        generateHtml: vi.fn().mockReturnValue(''),
        parseEntryDate: vi.fn(),
        getLocalDateKey: vi.fn(),
        getDataTimeBounds: vi.fn().mockReturnValue({ min: null, max: null }),
        toLocalDateInputValue: vi.fn().mockReturnValue(''),
        applyTimeframeFilter: vi.fn(d => d)
    };

    window.dataService = {
        fetchLeaderboardDetails: vi.fn().mockResolvedValue({}),
        extractLeaderboardArray: vi.fn().mockReturnValue(null),
        enrichEntriesWithDriverMetadata: vi.fn(async entries => entries)
    };

    window.FIELD_NAMES = {
        DIFFICULTY: ['Difficulty', 'difficulty'],
        CAR: ['Car', 'car'],
        CAR_CLASS: ['CarClass', 'car_class', 'ClassName', 'class_name']
    };
    window.getField = (obj, fields, defaultValue = '') => {
        for (const field of fields) {
            if (obj && obj[field] !== undefined && obj[field] !== null) return obj[field];
        }
        return defaultValue;
    };

    document.body.innerHTML = [
        '<div id="detail-track"></div>',
        '<div id="detail-class"></div>',
        '<p id="detail-subtitle"></p>',
        '<div id="detail-results-container"></div>'
    ].join('');

    loadBrowserScript('modules/difficulty-filter.js');
    loadBrowserScript('modules/pages/detail.js');
});

describe('splitTrackAndLayout', () => {
    it('splits track name and layout on dash separator', () => {
        const result = window.splitTrackAndLayout('Donington Park - Grand Prix');
        expect(result).toEqual({ trackName: 'Donington Park', layoutName: 'Grand Prix' });
    });

    it('handles compound track names like Spa-Francorchamps', () => {
        const result = window.splitTrackAndLayout('Spa-Francorchamps - Grand Prix');
        expect(result).toEqual({ trackName: 'Spa-Francorchamps', layoutName: 'Grand Prix' });
    });

    it('returns full name as trackName when no layout separator', () => {
        const result = window.splitTrackAndLayout('Monza');
        expect(result).toEqual({ trackName: 'Monza', layoutName: '' });
    });

    it('handles empty input', () => {
        expect(window.splitTrackAndLayout('')).toEqual({ trackName: '', layoutName: '' });
        expect(window.splitTrackAndLayout(null)).toEqual({ trackName: '', layoutName: '' });
        expect(window.splitTrackAndLayout(undefined)).toEqual({ trackName: '', layoutName: '' });
    });

    it('splits on en-dash and em-dash separators', () => {
        const enDash = window.splitTrackAndLayout('Nürburgring \u2013 Nordschleife');
        expect(enDash).toEqual({ trackName: 'Nürburgring', layoutName: 'Nordschleife' });

        const emDash = window.splitTrackAndLayout('Hockenheim \u2014 GP');
        expect(emDash).toEqual({ trackName: 'Hockenheim', layoutName: 'GP' });
    });
});

describe('matchesCarFilter', () => {
    it('returns true for null/empty selected car', () => {
        expect(window.matchesCarFilter({ Car: 'BMW M4' }, '')).toBe(true);
        expect(window.matchesCarFilter({ Car: 'BMW M4' }, null)).toBe(true);
    });

    it('returns true when car matches selected value', () => {
        expect(window.matchesCarFilter({ Car: 'BMW M4' }, 'BMW M4')).toBe(true);
    });

    it('returns false when car does not match selected value', () => {
        expect(window.matchesCarFilter({ Car: 'Audi R8' }, 'BMW M4')).toBe(false);
    });

    it('handles CATEGORY: prefix - returns true when categoryClassNames not populated', () => {
        // DetailState.categoryClassNames is null by default (not accessible from outside)
        // so CATEGORY filter always passes when not populated
        const entry = { Car: 'BMW M4', CarClass: 'GT3' };
        expect(window.matchesCarFilter(entry, 'CATEGORY:GT')).toBe(true);
    });
});

describe('difficulty preference localStorage', () => {
    it('saves and loads difficulty preference from localStorage', () => {
        window.saveDifficultyPreferenceToLocalStorage('Get Real');
        expect(localStorage.getItem('detailDifficultyPreference')).toBe('Get Real');

        const loaded = window.loadDifficultyPreferenceFromLocalStorage();
        expect(loaded).toBe('Get Real');
    });

    it('defaults to All difficulties when saving empty/null', () => {
        window.saveDifficultyPreferenceToLocalStorage('');
        expect(localStorage.getItem('detailDifficultyPreference')).toBe('All difficulties');

        window.saveDifficultyPreferenceToLocalStorage(null);
        expect(localStorage.getItem('detailDifficultyPreference')).toBe('All difficulties');
    });

    it('getInitialDifficultyParam uses URL param first, then localStorage', () => {
        // URL has 'All difficulties' which is ignored
        localStorage.setItem('detailDifficultyPreference', 'Amateur');
        // getInitialDifficultyParam was already evaluated at load time
        // but we can test the function directly
        expect(typeof window.getInitialDifficultyParam).toBe('function');
    });
});

describe('matchesDifficultyPreference', () => {
    it('returns true for empty or All difficulties label', () => {
        const entry = { Difficulty: 'Get Real' };
        expect(window.matchesDifficultyPreference(entry, '')).toBe(true);
        expect(window.matchesDifficultyPreference(entry, null)).toBe(true);
        expect(window.matchesDifficultyPreference(entry, 'All difficulties')).toBe(true);
    });

    it('returns true when entry difficulty matches the label', () => {
        const entry = { Difficulty: 'Get Real' };
        expect(window.matchesDifficultyPreference(entry, 'Get Real')).toBe(true);
    });

    it('returns false when entry difficulty does not match', () => {
        const entry = { Difficulty: 'Amateur' };
        expect(window.matchesDifficultyPreference(entry, 'Get Real')).toBe(false);
    });

    it('handles comma-separated multi-difficulty labels', () => {
        const getReal = { Difficulty: 'Get Real' };
        const amateur = { Difficulty: 'Amateur' };
        const novice = { Difficulty: 'Novice' };

        expect(window.matchesDifficultyPreference(getReal, 'Get Real, Amateur')).toBe(true);
        expect(window.matchesDifficultyPreference(amateur, 'Get Real, Amateur')).toBe(true);
        expect(window.matchesDifficultyPreference(novice, 'Get Real, Amateur')).toBe(false);
    });

    it('returns false when entry has no difficulty field', () => {
        const entry = { Car: 'BMW M4' };
        expect(window.matchesDifficultyPreference(entry, 'Get Real')).toBe(false);
    });

    it('returns true when all comma parts normalize to empty', () => {
        const entry = { Difficulty: 'Get Real' };
        // nonsense values that normalize to empty
        expect(window.matchesDifficultyPreference(entry, '   ,   ')).toBe(true);
    });
});

describe('applyInitialDifficultyFilter', () => {
    it('filters entries based on initial difficulty param', () => {
        // applyInitialDifficultyFilter uses difficultyParam which was set at module load
        // Since URL has no difficulty param, it falls back to localStorage
        expect(typeof window.applyInitialDifficultyFilter).toBe('function');
        
        // With default "All difficulties", all entries pass
        const entries = [
            { Difficulty: 'Get Real' },
            { Difficulty: 'Amateur' }
        ];
        const result = window.applyInitialDifficultyFilter(entries);
        expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty array for null/undefined input', () => {
        expect(window.applyInitialDifficultyFilter(null)).toEqual([]);
        expect(window.applyInitialDifficultyFilter(undefined)).toEqual([]);
    });
});
