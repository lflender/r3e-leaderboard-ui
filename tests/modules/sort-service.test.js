import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function makeEntry({
    pos = 1,
    lap = '1:30.000',
    track = 'Spa',
    className = 'GT3',
    date = '2026-01-01T00:00:00Z',
    total = 100
} = {}) {
    return {
        Position: String(pos),
        LapTime: lap,
        Track: track,
        CarClass: className,
        date_time: date,
        TotalEntries: total
    };
}

describe('table-sort-service', () => {
    beforeAll(() => {
        loadBrowserScript('modules/car-helper.js');
        loadBrowserScript('modules/time-helper.js');
        loadBrowserScript('modules/track-helper.js');
        loadBrowserScript('modules/url-helper.js');
        loadBrowserScript('modules/utils.js');
        loadBrowserScript('modules/column-config.js');
        loadBrowserScript('modules/field-mappings.js');
        loadBrowserScript('modules/sort-service.js');
    });

    beforeEach(() => {
        window.TRACKS_DATA = [];
    });

    test('sorts by position ascending with total-entries tiebreaker', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ pos: 2, total: 80 }),
            makeEntry({ pos: 1, total: 50 }),
            makeEntry({ pos: 1, total: 120 })
        ];

        service.sortDriverEntries(entries, 'position');

        expect(entries.map(e => Number(e.TotalEntries))).toEqual([120, 50, 80]);
    });

    test('sorts by lap time ascending', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ lap: '1:31.000, +0.500' }),
            makeEntry({ lap: '1:29.500' }),
            makeEntry({ lap: '1:30.000, +0.100' })
        ];

        service.sortDriverEntries(entries, 'lapTime');

        expect(entries.map(e => e.LapTime)).toEqual(['1:29.500', '1:30.000, +0.100', '1:31.000, +0.500']);
    });

    test('sorts by date_time with newest first', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ date: '2026-03-01T00:00:00Z' }),
            makeEntry({ date: '2026-04-01T00:00:00Z' }),
            makeEntry({ date: '2026-02-01T00:00:00Z' })
        ];

        service.sortDriverEntries(entries, 'date_time');

        expect(entries.map(e => e.date_time)).toEqual([
            '2026-04-01T00:00:00Z',
            '2026-03-01T00:00:00Z',
            '2026-02-01T00:00:00Z'
        ]);
    });

    test('sorts by track text and then by gap/position', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ track: 'Monza', lap: '1:31.000, +0.800', pos: 3 }),
            makeEntry({ track: 'Spa', lap: '1:30.000, +0.200', pos: 2 }),
            makeEntry({ track: 'Monza', lap: '1:30.500, +0.300', pos: 1 })
        ];

        service.sortDriverEntries(entries, 'track');

        expect(entries.map(e => e.Track)).toEqual(['Monza', 'Monza', 'Spa']);
        expect(entries[0].Position).toBe('1');
    });

    test('sorts by gap percent and uses total entries as tie-breaker', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ lap: '1:31.000, +1.000', total: 20 }),
            makeEntry({ lap: '1:30.000, +0.000', total: 100 }),
            makeEntry({ lap: '1:30.500, +0.500', total: 50 })
        ];

        service.sortDriverEntries(entries, 'gapPercent');

        expect(entries.map(e => Number(e.TotalEntries))).toEqual([100, 50, 20]);
    });

    test('sorts by gap (default) with total entries tiebreaker', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ lap: '1:31.000, +1.000', total: 20 }),
            makeEntry({ lap: '1:30.000', total: 100 }),
            makeEntry({ lap: '1:30.500, +0.500', total: 50 })
        ];

        service.sortDriverEntries(entries, 'gap');

        // 0 gap first, then +0.500, then +1.000
        expect(entries[0].TotalEntries).toBe(100);
        expect(entries[1].LapTime).toBe('1:30.500, +0.500');
        expect(entries[2].LapTime).toBe('1:31.000, +1.000');
    });

    test('gap sort uses total entries when gaps are equal', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ lap: '1:30.500, +0.500', total: 20 }),
            makeEntry({ lap: '1:30.500, +0.500', total: 80 })
        ];

        service.sortDriverEntries(entries, 'gap');

        // Higher total first when gap is same
        expect(entries[0].TotalEntries).toBe(80);
        expect(entries[1].TotalEntries).toBe(20);
    });

    test('does not throw for empty array', () => {
        const service = new window.TableSortService();
        expect(() => service.sortDriverEntries([], 'gap')).not.toThrow();
    });

    test('does not throw for null entries', () => {
        const service = new window.TableSortService();
        expect(() => service.sortDriverEntries(null, 'gap')).not.toThrow();
    });

    test('sorts by car_class text field', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ className: 'GT4', lap: '1:31.000, +1.000', pos: 2 }),
            makeEntry({ className: 'GT3', lap: '1:30.000, +0.500', pos: 1 }),
            makeEntry({ className: 'GT4', lap: '1:30.500, +0.500', pos: 3 })
        ];

        service.sortDriverEntries(entries, 'car_class');

        expect(entries[0].CarClass).toBe('GT3');
        expect(entries[1].CarClass).toBe('GT4');
        // Within same class, sort by gap then position
    });

    test('date sort handles missing dates', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ date: '' }),
            makeEntry({ date: '2026-03-01T00:00:00Z' }),
            makeEntry({ date: '' })
        ];

        service.sortDriverEntries(entries, 'date_time');

        // Entries with dates come first
        expect(entries[0].date_time).toBe('2026-03-01T00:00:00Z');
    });

    test('date sort handles invalid date strings', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ date: 'not-a-date' }),
            makeEntry({ date: '2026-03-01T00:00:00Z' }),
            makeEntry({ date: 'also-invalid' })
        ];

        service.sortDriverEntries(entries, 'date_time');

        // Valid date should come before invalid ones
        expect(entries[0].date_time).toBe('2026-03-01T00:00:00Z');
    });

    test('position sort handles equal positions with different totals', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ pos: 3, total: 50 }),
            makeEntry({ pos: 3, total: 200 }),
            makeEntry({ pos: 1, total: 10 })
        ];

        service.sortDriverEntries(entries, 'position');

        // P1 first, then P3 with higher total first
        expect(entries[0].Position).toBe('1');
        expect(entries[1].TotalEntries).toBe(200);
        expect(entries[2].TotalEntries).toBe(50);
    });

    test('lapTime sort handles equal lap times with different totals', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ lap: '1:30.000', total: 30 }),
            makeEntry({ lap: '1:30.000', total: 100 }),
            makeEntry({ lap: '1:29.000', total: 10 })
        ];

        service.sortDriverEntries(entries, 'lapTime');

        // Fastest first, then equal times with higher total first
        expect(entries[0].LapTime).toBe('1:29.000');
        expect(entries[1].TotalEntries).toBe(100);
        expect(entries[2].TotalEntries).toBe(30);
    });

    test('extractReferenceTime finds the entry with minimum gap', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ lap: '1:31.000, +1.000' }),
            makeEntry({ lap: '1:30.000' }),
            makeEntry({ lap: '1:30.500, +0.500' })
        ];

        const ref = service.extractReferenceTime(entries);
        expect(ref).toBe('1:30.000');
    });

    test('extractReferenceTime returns empty for empty array', () => {
        const service = new window.TableSortService();
        expect(service.extractReferenceTime([])).toBe('');
    });

    test('calculateGapPercentValue returns 100 for entries without gap', () => {
        const service = new window.TableSortService();
        const item = makeEntry({ lap: '1:30.000' });
        expect(service.calculateGapPercentValue(item, '1:30.000')).toBe(100);
    });

    test('calculateGapPercentValue returns correct percent for valid gap', () => {
        const service = new window.TableSortService();
        const item = makeEntry({ lap: '1:31.000, +1.000s' });
        const result = service.calculateGapPercentValue(item, '1:30.000');
        // 91000 / (91000 - 1000) * 100 = 91000/90000 * 100 = 101.11...
        expect(result).toBeCloseTo(101.11, 1);
    });

    test('calculateGapPercentValue returns 100 for null item', () => {
        const service = new window.TableSortService();
        expect(service.calculateGapPercentValue(null, '1:30.000')).toBe(100);
    });

    test('calculateGapPercentValue returns 100 when lap is unparseable', () => {
        const service = new window.TableSortService();
        const item = { LapTime: 'invalid, +1.000s' };
        expect(service.calculateGapPercentValue(item, '1:30.000')).toBe(100);
    });

    test('getFieldValueForSort uses resolveTrackLabel for track', () => {
        const service = new window.TableSortService({
            resolveTrackLabel: (item) => 'ResolvedTrack'
        });
        const item = makeEntry({ track: 'Spa' });
        expect(service.getFieldValueForSort(item, 'track')).toBe('ResolvedTrack');
    });

    test('getFieldValueForSort reads from FIELD_NAMES mapping', () => {
        window.FIELD_NAMES = { POSITION: ['Position', 'Pos', 'position'] };
        const service = new window.TableSortService();
        const item = { Position: '5' };
        expect(service.getFieldValueForSort(item, 'position')).toBe('5');
        delete window.FIELD_NAMES;
    });

    test('getFieldValueForSort returns value via FIELD_NAMES for date_time', () => {
        const service = new window.TableSortService();
        const item = { date_time: '2026-01-01' };
        expect(service.getFieldValueForSort(item, 'date_time')).toBe('2026-01-01');
    });

    test('getSortFieldNames returns field array from FIELD_NAMES', () => {
        const service = new window.TableSortService();
        const result = service.getSortFieldNames('position');
        expect(Array.isArray(result)).toBe(true);
        expect(result).toContain('Position');
    });

    test('getSortFieldNames returns matching field names', () => {
        window.FIELD_NAMES = { POSITION: ['Position', 'Pos'] };
        const service = new window.TableSortService();
        expect(service.getSortFieldNames('position')).toEqual(['Position', 'Pos']);
        delete window.FIELD_NAMES;
    });

    test('getSortFieldNames returns null for unknown sort key', () => {
        window.FIELD_NAMES = { POSITION: ['Position'] };
        const service = new window.TableSortService();
        expect(service.getSortFieldNames('unknown')).toBeNull();
        delete window.FIELD_NAMES;
    });

    test('getFieldValueForSort falls back to loop when window.getField is absent', () => {
        const savedGetField = window.getField;
        delete window.getField;
        const service = new window.TableSortService();
        const item = { Position: '7', Pos: '8' };
        expect(service.getFieldValueForSort(item, 'position')).toBe('7');
        window.getField = savedGetField;
    });

    test('getFieldValueForSort returns empty string via fallback when no field matches', () => {
        const savedGetField = window.getField;
        delete window.getField;
        const service = new window.TableSortService();
        const item = { unrelated: 'value' };
        expect(service.getFieldValueForSort(item, 'position')).toBe('');
        window.getField = savedGetField;
    });

    test('sortDriverEntries catches errors and does not throw', () => {
        const service = new window.TableSortService();
        // Passing null entries array should trigger catch
        expect(() => service.sortDriverEntries(null, 'position')).not.toThrow();
    });

    test('gapPercent tiebreaker uses TotalEntries when percentages are equal', () => {
        const service = new window.TableSortService();
        const entries = [
            makeEntry({ pos: 2, lap: '1:31.000s, +1.000s', total: 50 }),
            makeEntry({ pos: 3, lap: '1:31.000s, +1.000s', total: 200 })
        ];
        service.sortDriverEntries(entries, 'gapPercent');
        // Higher TotalEntries should sort first on tiebreak
        expect(Number(entries[0].TotalEntries)).toBe(200);
    });
});

