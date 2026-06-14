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
            // Mirror the real parseLapTimeToMillis WITHOUT pre-stripping comma-separated gaps.
            // Entries with embedded gaps like "2m 00.392s, +01.533s" must return 0 here so that
            // _rebuildCombinedLapTimes is required to strip the suffix before calling this function.
            parseLapTimeToMillis: vi.fn((time) => {
                const s = String(time || '').trim().replace(/s$/i, '');
                let m = s.match(/^(\d+):(\d+)\.(\d+)$/);
                if (m) return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + parseInt((m[3] + '000').slice(0, 3));
                m = s.match(/^(\d+)m\s*(\d+)\.(\d+)$/);
                if (m) return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + parseInt((m[3] + '000').slice(0, 3));
                return 0;
            }),
            fetchWithTimeout: vi.fn((url, options = {}) => fetch(url, options))
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
        const indexSpy = vi.spyOn(service, 'loadDriverIndex').mockResolvedValue({ ok: true });
        const searchSpy = vi.spyOn(service, 'searchDriver').mockResolvedValue([]);

        await expect(service.loadDriverIndex()).resolves.toEqual({ ok: true });
        await expect(service.searchDriver('Alice')).resolves.toEqual([]);

        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(searchSpy).toHaveBeenCalledTimes(1);
    });

    it('fetches leaderboard details and top combinations through the compressed helper', async () => {
        // Pre-set cache version to avoid status.json fetch during these calls
        service._indexCacheVersion = 'test1';
        window.CompressedJsonHelper.readGzipJson
            .mockResolvedValueOnce({ leaderboard: [{ id: 1 }] })
            .mockResolvedValueOnce({ results: [{ track_id: 10 }] })
            .mockResolvedValueOnce({ data: [{ track_id: 20 }] });
        global.fetch
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

        await expect(service.fetchLeaderboardDetails(10, 5)).resolves.toEqual({ leaderboard: [{ id: 1 }] });
        // fetchTopCombinations is now cached after first call (single-flight)
        await expect(service.fetchTopCombinations()).resolves.toEqual([{ track_id: 10 }]);
        // Second call returns cached result
        await expect(service.fetchTopCombinations()).resolves.toEqual([{ track_id: 10 }]);
        // fetchAllCombinations uses its own cache
        await expect(service.fetchAllCombinations()).resolves.toEqual([{ track_id: 20 }]);
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

    it('rebuilds combined lap times correctly when cache entries already contain embedded gap suffixes', () => {
        // Real cache format: non-P1 entries store laptime as "2m 00.392s, +01.533s".
        // parseLapTimeToMillis returns 0 for strings with commas, so _rebuildCombinedLapTimes
        // must strip the suffix before parsing — otherwise all non-P1 entries sort incorrectly
        // and gaps render as "+Infinitys".
        const entries = [
            { name: 'C', LapTime: '2m 01.533s, +02.674s' }, // P2 in class 2 (embedded gap)
            { name: 'A', LapTime: '1m 58.859s' },           // P1 in class 1 (clean)
            { name: 'B', LapTime: '2m 00.392s, +01.533s' }  // P2 in class 1 (embedded gap)
        ];
        const rebuilt = service._rebuildCombinedLapTimes(entries);

        // Correct ordering by lap time
        expect(rebuilt[0]).toMatchObject({ name: 'A', Position: 1 });
        expect(rebuilt[1]).toMatchObject({ name: 'B', Position: 2 });
        expect(rebuilt[2]).toMatchObject({ name: 'C', Position: 3 });

        // Gaps must be finite numbers, never "+Infinitys"
        expect(rebuilt[1].LapTime).not.toContain('Infinity');
        expect(rebuilt[2].LapTime).not.toContain('Infinity');

        // Leader has no gap suffix
        expect(rebuilt[0].LapTime).toBe('1m 58.859s');
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

    it('loadTeams fetches, decompresses, and caches teams data', async () => {
        service._indexCacheVersion = 'v1';
        const teamsData = { 'TeamA': { members: ['Alice'] } };
        window.CompressedJsonHelper.readGzipJson.mockResolvedValueOnce(teamsData);
        global.fetch.mockResolvedValueOnce({ ok: true, status: 200 });

        const result = await service.loadTeams();
        expect(result).toEqual(teamsData);
        expect(global.fetch.mock.calls[0][0]).toContain('cache/index/teams.json.gz');

        // Second call returns cached
        const cached = await service.loadTeams();
        expect(cached).toEqual(teamsData);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('loadTeams resets promise on failure for retry', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });

        await expect(service.loadTeams()).rejects.toThrow('HTTP 500');
        // Promise is reset, so next call retries
        expect(service.teamsPromise).toBeNull();
    });

    it('fetchLeaderboardDetails throws on HTTP error', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

        await expect(service.fetchLeaderboardDetails(10, 5)).rejects.toThrow();
    });

    it('fetchTopCombinations resets promise on failure', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' });

        await expect(service.fetchTopCombinations()).rejects.toThrow();
        expect(service.topCombinationsPromise).toBeNull();
    });

    it('fetchAllCombinations resets promise on failure', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' });

        await expect(service.fetchAllCombinations()).rejects.toThrow();
        expect(service.allCombinationsPromise).toBeNull();
    });

    it('calculateStatus returns null when fetch fails with no cache', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network failure'));
        const result = await service.calculateStatus();
        expect(result).toBeNull();
    });

    it('_normalizeLeaderboardEntriesForDetail handles non-array input', () => {
        const result = service._normalizeLeaderboardEntriesForDetail('not-an-array', {});
        expect(result).toEqual([]);
    });

    it('fetchLeaderboardDetails rejects empty IDs after sanitization', async () => {
        service._indexCacheVersion = 'v1';
        await expect(service.fetchLeaderboardDetails('', '5')).rejects.toThrow('Invalid track or class ID');
        await expect(service.fetchLeaderboardDetails('10', '')).rejects.toThrow('Invalid track or class ID');
        await expect(service.fetchLeaderboardDetails('.../', '...')).rejects.toThrow('Invalid track or class ID');
    });

    it('fetchLeaderboardDetails strips path traversal characters from IDs', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValueOnce({ ok: true, status: 200 });
        window.CompressedJsonHelper.readGzipJson.mockResolvedValueOnce({ data: [] });

        // ../../etc -> "etc" after sanitization (dots/slashes stripped)
        await service.fetchLeaderboardDetails('../../10258', '5');
        expect(global.fetch.mock.calls[0][0]).toContain('cache/tracks/track_10258/class_5.json.gz');
    });

    it('buildCombinedLeaderboard caps classSpecs at 20', async () => {
        service._indexCacheVersion = 'v1';
        const manySpecs = Array.from({ length: 50 }, (_, i) => ({ classId: String(i + 1), className: `Class${i}` }));
        const fetchSpy = vi.spyOn(service, 'fetchLeaderboardDetails').mockResolvedValue({ leaderboard: [] });
        vi.spyOn(service, 'extractLeaderboardArray').mockReturnValue([]);

        await service.buildCombinedLeaderboard(10, manySpecs);
        // Should only have fetched 20, not 50
        expect(fetchSpy).toHaveBeenCalledTimes(20);
    });

    it('fetchPoleTime returns P1 entry data with single-flight caching', async () => {
        service._indexCacheVersion = 'v1';
        const shardData = {
            track_info: {
                Data: [
                    { laptime: '1:30.500s', driver: { name: 'Alice', rank: 'A', avatar: 'https://img/alice.png', path: '/users/info/12345/' }, country: { code: 'de' }, date_time: '2026-01-01T10:00:00' },
                    { laptime: '1:31.200s', driver: { name: 'Bob', rank: 'B', avatar: '', path: '/users/info/67890/' }, country: { code: 'uk' }, date_time: '2026-01-02T10:00:00' }
                ]
            }
        };
        global.fetch.mockResolvedValue({ ok: true, status: 200 });
        window.CompressedJsonHelper.readGzipJson.mockResolvedValue(shardData);

        const result = await service.fetchPoleTime(10, 5);
        expect(result).toEqual({
            name: 'Alice',
            country: 'de',
            rank: 'A',
            avatar: 'https://img/alice.png',
            path_id: '12345',
            laptime: '1:30.500s'
        });

        // Second call returns cached result without additional fetch
        const cachedResult = await service.fetchPoleTime(10, 5);
        expect(cachedResult).toEqual(result);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetchPoleTime returns null for empty leaderboard data', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValue({ ok: true, status: 200 });
        window.CompressedJsonHelper.readGzipJson.mockResolvedValue({
            track_info: { Data: [] }
        });

        const result = await service.fetchPoleTime(10, 5);
        expect(result).toBeNull();
    });

    it('fetchPoleTime returns null on fetch error without caching failure', async () => {
        service._indexCacheVersion = 'v1';
        global.fetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

        const result = await service.fetchPoleTime(99, 99);
        expect(result).toBeNull();

        // Promise should be cleared so retry is possible
        expect(service.poleTimePromises.has('99_99')).toBe(false);
    });

    it('fetchPoleTime single-flight: concurrent calls share the same promise', async () => {
        service._indexCacheVersion = 'v1';
        const shardData = {
            track_info: {
                Data: [{ laptime: '2:00.000s', driver: { name: 'Eve', rank: 'B', avatar: '', path: '/users/info/111/' }, country: { code: 'se' }, date_time: '2026-06-01' }]
            }
        };
        global.fetch.mockResolvedValue({ ok: true, status: 200 });
        window.CompressedJsonHelper.readGzipJson.mockResolvedValue(shardData);

        const [r1, r2] = await Promise.all([
            service.fetchPoleTime(10, 5),
            service.fetchPoleTime(10, 5)
        ]);
        expect(r1).toEqual(r2);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
