import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/driver-index-service.js');
    loadBrowserScript('modules/driver-search-service.js');
    loadBrowserScript('modules/data-service.js');
});

describe('DataService core behavior', () => {
    let service;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();

        service = new window.DataService();
        window.CompressedJsonHelper = {
            readGzipJson: vi.fn(),
            readGzipText: vi.fn()
        };
        window.DataNormalizer = {
            normalizeLeaderboardEntry: vi.fn((entry) => ({ ...entry })),
            extractLapTime: vi.fn(entry => entry.LapTime || entry['Lap Time'] || entry.lap_time || '')
        };
        window.R3EUtils = {
            parseLapTimeToMillis: vi.fn((time) => {
                const lap = String(time || '').split(',')[0].trim();
                const match = lap.match(/^(?:(\d+):)?(\d{1,2})\.(\d{3})$/);
                if (!match) {
                    return Number.POSITIVE_INFINITY;
                }
                const minutes = Number(match[1] || 0);
                const seconds = Number(match[2] || 0);
                const millis = Number(match[3] || 0);
                return (minutes * 60 * 1000) + (seconds * 1000) + millis;
            })
        };
        window.CARS_DATA = [];
        window.getCarClassId = vi.fn(name => name === 'GT3' ? 5 : null);
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            statusText: 'Test default',
            text: async () => ''
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('returns the compressed json helper when loaded and throws when missing', () => {
        expect(service._getCompressedJsonHelper()).toBe(window.CompressedJsonHelper);

        delete window.CompressedJsonHelper;
        expect(() => service._getCompressedJsonHelper()).toThrow('CompressedJsonHelper is not loaded.');
    });

    it('delegates driver index and search methods to extracted services', async () => {
        const indexSpy = vi.spyOn(window.R3EDriverIndexService, 'loadDriverIndex').mockResolvedValue({ ok: true });
        const searchSpy = vi.spyOn(window.R3EDriverSearchService, 'searchDriver').mockResolvedValue([]);

        await expect(service.loadDriverIndex()).resolves.toEqual({ ok: true });
        await expect(service.searchDriver('Alice')).resolves.toEqual([]);

        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(searchSpy).toHaveBeenCalledTimes(1);
    });

    it('fetches leaderboard details and top combinations through the compressed helper', async () => {
        window.CompressedJsonHelper.readGzipJson
            .mockResolvedValueOnce({ leaderboard: [{ id: 1 }] })
            .mockResolvedValueOnce({ results: [{ track_id: 10 }] })
            .mockResolvedValueOnce({ data: [{ track_id: 20 }] })
            .mockResolvedValueOnce([{ track_id: 30 }]);
        global.fetch
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

        await expect(service.fetchLeaderboardDetails(10, 5)).resolves.toEqual({ leaderboard: [{ id: 1 }] });
        await expect(service.fetchTopCombinations()).resolves.toEqual([{ track_id: 10 }]);
        await expect(service.fetchTopCombinations()).resolves.toEqual([{ track_id: 20 }]);
        await expect(service.fetchTopCombinations()).resolves.toEqual([{ track_id: 30 }]);
        expect(global.fetch.mock.calls[0][0]).toContain('cache/tracks/track_10/class_5.json.gz');
    });

    it('calculates status with single-flight behavior and cached fallback on invalid JSON', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        let resolveText;
        const textPromise = new Promise(resolve => {
            resolveText = resolve;
        });
        global.fetch.mockResolvedValueOnce({
            ok: true,
            text: () => textPromise
        });

        const first = service.calculateStatus();
        const second = service.calculateStatus();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        resolveText('{"ok":true}');
        await expect(first).resolves.toEqual({ ok: true });
        await expect(second).resolves.toEqual({ ok: true });

        service.statusCache = { cached: true };
        global.fetch.mockResolvedValueOnce({ ok: true, text: async () => '{bad json' });
        await expect(service.calculateStatus()).resolves.toEqual({ cached: true });
        expect(errorSpy).toHaveBeenCalled();
    });

    it('extracts leaderboard arrays from several payload shapes', () => {
        expect(service.extractLeaderboardArray({ track_info: { Data: [{ id: 1 }] } })).toEqual([{ id: 1 }]);
        expect(service.extractLeaderboardArray({ results: [{ id: 2 }] })).toEqual([{ id: 2 }]);
        expect(service.extractLeaderboardArray({ wrapper: { entries: [{ id: 3 }] } })).toEqual([{ id: 3 }]);
        expect(service.extractLeaderboardArray(null)).toEqual([]);
    });

    it('normalizes times and leaderboard entries for detail views', () => {
        expect(service.normalizeTime('1:23.456, +0.120s')).toBe('1:23.456');

        window.DataNormalizer.normalizeLeaderboardEntry = vi.fn((entry, _data, index, total) => ({
            ...entry,
            position: index + 1,
            totalSeen: total
        }));

        const normalized = service._normalizeLeaderboardEntriesForDetail([
            { driver: 'A', car_class: { class: { Name: 'GT3' } } },
            { driver: 'B' }
        ], { track_info: { ClassName: 'Fallback' } });

        expect(normalized[0]).toMatchObject({ position: 1, totalSeen: 2, CarClass: 'GT3' });
        expect(normalized[1]).toMatchObject({ position: 2, totalSeen: 2, CarClass: 'GT3' });
    });

    it('extracts raw lap times and rebuilds combined leaderboard gaps', () => {
        expect(service._extractRawLapTime({ LapTime: '1:22.000' })).toBe('1:22.000');

        const rebuilt = service._rebuildCombinedLapTimes([
            { name: 'B', LapTime: '1:23.000' },
            { name: 'A', LapTime: '1:22.000' }
        ]);

        expect(rebuilt[0]).toMatchObject({ name: 'A', Position: 1, LapTime: '1:22.000' });
        expect(rebuilt[1]).toMatchObject({ name: 'B', Position: 2, LapTime: '1:23.000, +1.000s' });
    });

    it('builds a combined leaderboard from valid class specs only', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(service, 'fetchLeaderboardDetails')
            .mockResolvedValueOnce({ leaderboard: [{ name: 'A', LapTime: '1:22.000' }] })
            .mockRejectedValueOnce(new Error('missing'));
        vi.spyOn(service, 'extractLeaderboardArray').mockImplementation(data => data.leaderboard || []);
        vi.spyOn(service, '_normalizeLeaderboardEntriesForDetail').mockImplementation(entries => entries.map(entry => ({ ...entry })));
        vi.spyOn(service, '_rebuildCombinedLapTimes').mockImplementation(entries => entries);

        const result = await service.buildCombinedLeaderboard(10, [
            { classId: '5', className: 'GT3' },
            { classId: '', className: 'ignore' },
            { classId: '7', className: 'GT4' }
        ]);

        expect(service.fetchLeaderboardDetails).toHaveBeenCalledTimes(2);
        expect(result).toEqual([{ name: 'A', LapTime: '1:22.000', ClassName: 'GT3' }]);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('builds class and superclass options from cars data', () => {
        window.CARS_DATA = [
            { superclass: 'GT3', class: 'GT3' },
            { superclass: 'GT3', class: 'GT3' },
            { superclass: 'Touring', class: 'TCR' },
            { superclass: 'Safety', class: 'Safety Car' }
        ];
        window.getCarClassId = vi.fn(name => {
            if (name === 'GT3') return 5;
            if (name === 'TCR') return 8;
            return null;
        });

        expect(service.getClassOptionsFromCarsData()).toEqual([
            { value: 'GT3', label: 'GT3' },
            { value: 'TCR', label: 'TCR' }
        ]);
        expect(service.getSuperclassOptions()).toEqual([
            { value: 'superclass:GT3', label: 'Category: GT3', classes: ['GT3'] },
            { value: 'superclass:Safety', label: 'Category: Safety', classes: ['Safety Car'] },
            { value: 'superclass:Touring', label: 'Category: Touring', classes: ['TCR'] }
        ]);
    });
});
