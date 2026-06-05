import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3EUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/car-helper.js');
        loadBrowserScript('modules/time-helper.js');
        loadBrowserScript('modules/track-helper.js');
        loadBrowserScript('modules/url-helper.js');
        loadBrowserScript('modules/utils.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        delete window.ColumnConfig;
        window.history.replaceState({}, '', '/');
    });

    test('escapes HTML content', () => {
        expect(window.R3EUtils.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('formats headers with generic snake_case conversion when ColumnConfig is absent', () => {
        expect(window.R3EUtils.formatHeader('class_name')).toBe('Class name');
        expect(window.R3EUtils.formatHeader('date_time')).toBe('Date time');
        expect(window.R3EUtils.formatHeader('entry_count')).toBe('Entry count');
    });

    test('formats headers via ColumnConfig when available', () => {
        window.ColumnConfig = { getDisplayName: (k) => ({ class_name: 'Car class', date_time: 'Date', entry_count: 'Entries' }[k] || k) };
        expect(window.R3EUtils.formatHeader('class_name')).toBe('Car class');
        expect(window.R3EUtils.formatHeader('date_time')).toBe('Date');
        expect(window.R3EUtils.formatHeader('entry_count')).toBe('Entries');
    });

    test('formats classic lap times', () => {
        expect(window.R3EUtils.formatClassicLapTime('2m 12.524s')).toBe('2:12:524s');
        expect(window.R3EUtils.formatClassicLapTime('45.281s')).toBe('45:281s');
    });

    test('parses lap times and gap percentages', () => {
        expect(window.R3EUtils.parseLapTimeToMillis('1:23.456s')).toBe(83456);
        expect(window.R3EUtils.parseGapMillisFromItem({ LapTime: '1:24.631s, +1.175s' })).toBe(1175);
        expect(window.R3EUtils.calculateGapPercentage({ LapTime: '1:24.631s, +1.175s' })).toBe('101.4%');
    });

    test('reads and updates URL params', () => {
        window.history.replaceState({}, '', '/?driver=Alex');
        expect(window.R3EUtils.getUrlParam('driver')).toBe('Alex');
        window.R3EUtils.updateUrlParam('driver', 'Sam');
        expect(new URL(window.location.href).searchParams.get('driver')).toBe('Sam');
    });

    test('resolves track labels from TRACKS_DATA by track_id', () => {
        window.TRACKS_DATA = [{ id: 10, label: 'Spa - Grand Prix' }];
        expect(window.R3EUtils.resolveTrackLabel(10)).toBe('Spa - Grand Prix');
        expect(window.R3EUtils.resolveTrackLabelForItem({ track_id: 10 })).toBe('Spa - Grand Prix');
        expect(window.R3EUtils.resolveTrackLabel(999, 'Fallback Track')).toBe('Fallback Track');
    });

    test('re-exports track and class-logo helpers', () => {
        window.CARS_DATA = [{ class: 'GT3', logo: 'https://example.com/gt3-logo.png' }];
        window.CAR_CLASSES_DATA = { 1703: 'GT3' };
        expect(window.R3EUtils.resolveCarClassLogo('GT3', '1703')).toBe('https://example.com/gt3-logo.png');
    });

    test('splits car names into brand and model', () => {
        expect(window.R3EUtils.splitCarName('Audi R8 LMS')).toEqual({ brand: 'Audi', model: 'R8 LMS' });
        expect(window.R3EUtils.splitCarName('Porsche')).toEqual({ brand: 'Porsche', model: '' });
    });

    test('re-exports car combination helpers', () => {
        expect(window.R3EUtils.detectYearSuffix('BMW M4 GT3 2024')).toEqual({
            baseName: 'BMW M4 GT3',
            year: '2024'
        });
        expect(window.R3EUtils.matchesCarFilterValue('BMW M4 GT3 2024', 'COMBINED_YEAR:BMW M4 GT3')).toBe(true);
    });

    test('re-exports time and date helpers', () => {
        expect(window.R3EUtils.formatClassicLapTime('1m 26.693s')).toBe('1:26:693s');
        expect(window.R3EUtils.formatDate('2025-10-06T19:15:20')).toBe('6 Oct 2025');
    });

    describe('fetchWithTimeout', () => {
        let originalFetch;

        beforeEach(() => {
            originalFetch = globalThis.fetch;
        });

        test('returns response on successful fetch', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
            const resp = await window.R3EUtils.fetchWithTimeout('http://example.com/data.json');
            expect(resp).toEqual({ ok: true, status: 200 });
            expect(globalThis.fetch).toHaveBeenCalledOnce();
            // Verify signal was passed
            const callArgs = globalThis.fetch.mock.calls[0];
            expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
            globalThis.fetch = originalFetch;
        });

        test('merges options and passes signal', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
            await window.R3EUtils.fetchWithTimeout('http://example.com', { cache: 'no-store' }, 5000);
            const callArgs = globalThis.fetch.mock.calls[0];
            expect(callArgs[1].cache).toBe('no-store');
            expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
            globalThis.fetch = originalFetch;
        });

        test('aborts fetch when timeout elapses', async () => {
            vi.useFakeTimers();
            globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
                return new Promise((resolve, reject) => {
                    opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                });
            });
            const promise = window.R3EUtils.fetchWithTimeout('http://example.com', {}, 3000);
            vi.advanceTimersByTime(3000);
            await expect(promise).rejects.toThrow();
            globalThis.fetch = originalFetch;
            vi.useRealTimers();
        });
    });

    describe('formatValue', () => {
        test('returns dash for null', () => {
            expect(window.R3EUtils.formatValue(null)).toBe('-');
        });

        test('returns dash for undefined', () => {
            expect(window.R3EUtils.formatValue(undefined)).toBe('-');
        });

        test('returns escaped string for regular values', () => {
            expect(window.R3EUtils.formatValue('hello')).toBe('hello');
        });

        test('escapes HTML in values', () => {
            expect(window.R3EUtils.formatValue('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
        });

        test('converts numbers to string', () => {
            expect(window.R3EUtils.formatValue(42)).toBe('42');
        });

        test('converts zero to string', () => {
            expect(window.R3EUtils.formatValue(0)).toBe('0');
        });
    });

    describe('getTotalEntriesCount', () => {
        test('extracts from total_entries field', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ total_entries: '50' })).toBe(50);
        });

        test('extracts from TotalEntries field', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ TotalEntries: 100 })).toBe(100);
        });

        test('extracts from Total Entries field', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ 'Total Entries': '25' })).toBe(25);
        });

        test('extracts from TotalRacers field', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ TotalRacers: '75' })).toBe(75);
        });

        test('extracts from total_racers field', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ total_racers: 30 })).toBe(30);
        });

        test('strips non-numeric characters', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ total_entries: '50 racers' })).toBe(50);
        });

        test('returns 0 when no field present', () => {
            expect(window.R3EUtils.getTotalEntriesCount({})).toBe(0);
        });

        test('returns 0 for empty string', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ total_entries: '' })).toBe(0);
        });

        test('returns 0 for non-numeric value', () => {
            expect(window.R3EUtils.getTotalEntriesCount({ total_entries: 'abc' })).toBe(0);
        });
    });

    describe('renderRankStars', () => {
        test('returns empty string for falsy rank', () => {
            expect(window.R3EUtils.renderRankStars('')).toBe('');
            expect(window.R3EUtils.renderRankStars(null)).toBe('');
            expect(window.R3EUtils.renderRankStars(undefined)).toBe('');
        });

        test('renders 4 stars for rank A in inline mode', () => {
            const result = window.R3EUtils.renderRankStars('A', true);
            expect(result).toContain('rank-stars-inline');
            expect(result).toContain('⭐⭐⭐⭐');
        });

        test('renders 3 stars for rank B in inline mode', () => {
            const result = window.R3EUtils.renderRankStars('B', true);
            expect(result).toContain('⭐⭐⭐');
            expect(result).not.toContain('⭐⭐⭐⭐');
        });

        test('renders 2 stars for rank C in inline mode', () => {
            const result = window.R3EUtils.renderRankStars('C', true);
            expect(result).toContain('⭐⭐');
            expect(result).not.toContain('⭐⭐⭐');
        });

        test('renders 1 star for rank D in inline mode', () => {
            const result = window.R3EUtils.renderRankStars('D', true);
            expect(result).toContain('⭐');
            expect(result).not.toContain('⭐⭐');
        });

        test('returns empty string for unknown rank in inline mode', () => {
            expect(window.R3EUtils.renderRankStars('X', true)).toBe('');
        });

        test('renders block mode with pipe separator for rank A', () => {
            const result = window.R3EUtils.renderRankStars('A', false);
            expect(result).toContain(' | ');
            expect(result).toContain('⭐⭐⭐⭐');
            expect(result).toContain('Rank A');
        });

        test('renders block mode with rank label for unknown rank', () => {
            const result = window.R3EUtils.renderRankStars('X', false);
            expect(result).toContain(' | ⭐ Rank X');
        });

        test('is case-insensitive', () => {
            const result = window.R3EUtils.renderRankStars('a', true);
            expect(result).toContain('⭐⭐⭐⭐');
        });

        test('trims whitespace from rank', () => {
            const result = window.R3EUtils.renderRankStars('  B  ', true);
            expect(result).toContain('⭐⭐⭐');
        });
    });

    describe('getPositionBadgeColor', () => {
        test('returns default color for NaN position', () => {
            expect(window.R3EUtils.getPositionBadgeColor(NaN, 10)).toBe('var(--color-pos-badge-default)');
        });

        test('returns default color for NaN total', () => {
            expect(window.R3EUtils.getPositionBadgeColor(1, NaN)).toBe('var(--color-pos-badge-default)');
        });

        test('returns default color when total <= 1', () => {
            expect(window.R3EUtils.getPositionBadgeColor(1, 1)).toBe('var(--color-pos-badge-default)');
            expect(window.R3EUtils.getPositionBadgeColor(1, 0)).toBe('var(--color-pos-badge-default)');
        });

        test('returns success color for position 1', () => {
            expect(window.R3EUtils.getPositionBadgeColor(1, 10)).toBe('var(--color-success)');
        });

        test('returns danger color for last position', () => {
            expect(window.R3EUtils.getPositionBadgeColor(10, 10)).toBe('var(--color-danger)');
        });

        test('returns rgb gradient for middle positions', () => {
            const color = window.R3EUtils.getPositionBadgeColor(5, 10);
            expect(color).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
        });
    });

    describe('isDriverSearchActive', () => {
        test('returns false when no search input and no URL params', () => {
            document.body.innerHTML = '';
            window.history.replaceState({}, '', '/');
            expect(window.R3EUtils.isDriverSearchActive()).toBe(false);
        });

        test('returns true when search input has value', () => {
            document.body.innerHTML = '<input id="driver-search" value="Alice" />';
            window.history.replaceState({}, '', '/');
            expect(window.R3EUtils.isDriverSearchActive()).toBe(true);
        });

        test('returns false when search input is empty/whitespace', () => {
            document.body.innerHTML = '<input id="driver-search" value="   " />';
            window.history.replaceState({}, '', '/');
            expect(window.R3EUtils.isDriverSearchActive()).toBe(false);
        });

        test('returns true when URL has driver param', () => {
            document.body.innerHTML = '';
            window.history.replaceState({}, '', '/?driver=Bob');
            expect(window.R3EUtils.isDriverSearchActive()).toBe(true);
        });

        test('returns true when URL has query param', () => {
            document.body.innerHTML = '';
            window.history.replaceState({}, '', '/?query=test');
            expect(window.R3EUtils.isDriverSearchActive()).toBe(true);
        });
    });
});
