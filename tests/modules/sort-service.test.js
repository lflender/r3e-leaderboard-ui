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
        loadBrowserScript('modules/utils-car.js');
        loadBrowserScript('modules/time-helper.js');
        loadBrowserScript('modules/utils-track.js');
        loadBrowserScript('modules/url-helper.js');
        loadBrowserScript('modules/utils.js');
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
});

