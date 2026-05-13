import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    // Provide StatsData dependency
    window.StatsData = {
        METRIC_DEFINITIONS: {
            pole: { metricKey: 'pole_positions', fileKey: 'pole_file', direction: 'desc' },
            bested: { metricKey: 'bested_drivers', fileKey: 'bested_file', direction: 'desc' },
            podium: { metricKey: 'podiums', fileKey: 'podium_file', direction: 'desc' },
            avg_bested: { metricKey: 'avg_bested', fileKey: 'avg_bested_file', direction: 'desc' }
        },
        extractRows: (payload) => {
            if (Array.isArray(payload)) return payload;
            if (payload && Array.isArray(payload.results)) return payload.results;
            return [];
        },
        loadStatsIndex: vi.fn(),
        fetchGzipJson: vi.fn()
    };

    loadBrowserScript('modules/driver-stats-service.js');
});

beforeEach(() => {
    vi.clearAllMocks();
    window.DriverStatsService._fetchPromises.clear();
});

describe('DriverStatsService.findDriverInPayload', () => {
    it('finds a driver by name case-insensitively', () => {
        const payload = {
            results: [
                { name: 'Alice', pole_positions: 10 },
                { name: 'Bob Smith', pole_positions: 5 },
                { name: 'Charlie', pole_positions: 3 }
            ]
        };
        const result = window.DriverStatsService.findDriverInPayload(payload, 'bob smith', 'pole_positions');
        expect(result).toEqual({ value: 5, position: 2, total: 3 });
    });

    it('returns null when driver not found', () => {
        const payload = { results: [{ name: 'Alice', pole_positions: 10 }] };
        const result = window.DriverStatsService.findDriverInPayload(payload, 'nobody', 'pole_positions');
        expect(result).toBeNull();
    });

    it('handles array payloads without results wrapper', () => {
        const payload = [
            { name: 'Alice', bested_drivers: 100 },
            { name: 'Bob', bested_drivers: 50 }
        ];
        const result = window.DriverStatsService.findDriverInPayload(payload, 'Alice', 'bested_drivers');
        expect(result).toEqual({ value: 100, position: 1, total: 2 });
    });

    it('handles driver_name and driver_key aliases', () => {
        const payload = { results: [{ driver_name: 'Alice', podiums: 7 }] };
        expect(window.DriverStatsService.findDriverInPayload(payload, 'alice', 'podiums'))
            .toEqual({ value: 7, position: 1, total: 1 });

        const payload2 = { results: [{ driver_key: 'Bob', avg_bested: 80.5 }] };
        expect(window.DriverStatsService.findDriverInPayload(payload2, 'BOB', 'avg_bested'))
            .toEqual({ value: 80.5, position: 1, total: 1 });
    });

    it('returns null for empty payload', () => {
        expect(window.DriverStatsService.findDriverInPayload({ results: [] }, 'A', 'x')).toBeNull();
        expect(window.DriverStatsService.findDriverInPayload(null, 'A', 'x')).toBeNull();
    });
});

describe('DriverStatsService.formatValue', () => {
    it('formats percent values', () => {
        expect(window.DriverStatsService.formatValue(78.5, 'percent')).toBe('78.5%');
        expect(window.DriverStatsService.formatValue(100, 'percent')).toBe('100.0%');
    });

    it('formats number values with locale', () => {
        const result = window.DriverStatsService.formatValue(1234, 'number');
        // Locale-dependent, just check it contains the digits
        expect(result).toContain('1');
        expect(result).toContain('234');
    });

    it('returns dash for null/NaN', () => {
        expect(window.DriverStatsService.formatValue(null, 'number')).toBe('—');
        expect(window.DriverStatsService.formatValue(NaN, 'percent')).toBe('—');
    });
});

describe('DriverStatsService.lookupDriverStats', () => {
    const makeIndex = () => ({
        overall_top: {
            avg_bested_file: 'cache/stats/overall_top_avg_bested.json.gz',
            bested_file: 'cache/stats/overall_top_bested.json.gz',
            pole_file: 'cache/stats/overall_top_pole.json.gz',
            podium_file: 'cache/stats/overall_top_podium.json.gz'
        },
        overall: {
            avg_bested_file: 'cache/stats/overall_avg_bested.json.gz',
            bested_file: 'cache/stats/overall_bested.json.gz',
            pole_file: 'cache/stats/overall_pole.json.gz',
            podium_file: 'cache/stats/overall_podium.json.gz'
        }
    });

    it('returns results for all 4 metrics', async () => {
        window.StatsData.loadStatsIndex.mockResolvedValue(makeIndex());
        window.StatsData.fetchGzipJson.mockResolvedValue({
            results: [
                { name: 'Test Driver', pole_positions: 5, bested_drivers: 100, podiums: 10, avg_bested: 75.3 }
            ]
        });

        const results = await window.DriverStatsService.lookupDriverStats('Test Driver');
        expect(results).toHaveLength(4);
        expect(results.map(r => r.key)).toEqual(['avg_bested', 'bested', 'pole', 'podium']);
    });

    it('finds driver in top files and uses avg_bested total for bested only', async () => {
        window.StatsData.loadStatsIndex.mockResolvedValue(makeIndex());
        window.StatsData.fetchGzipJson.mockImplementation(async (path) => {
            if (path.includes('overall_top_')) {
                return { results: [
                    { name: 'Leader', pole_positions: 50, bested_drivers: 999, podiums: 80, avg_bested: 99.0 },
                    { name: 'Test Driver', pole_positions: 20, bested_drivers: 80, podiums: 5, avg_bested: 60.0 }
                ]};
            }
            // Full files have many more entries
            const bigList = [];
            for (let i = 0; i < 10000; i++) {
                bigList.push({ name: `Driver ${i}`, pole_positions: 0, bested_drivers: 0, podiums: 0, avg_bested: 0 });
            }
            bigList[42] = { name: 'Test Driver', pole_positions: 20, bested_drivers: 80, podiums: 5, avg_bested: 60.0 };
            return { results: bigList };
        });

        const results = await window.DriverStatsService.lookupDriverStats('Test Driver');
        // Bested and avg_bested use the avg_bested full file total
        const bested = results.find(r => r.key === 'bested');
        expect(bested.result.total).toBe(10000);
        const avgBested = results.find(r => r.key === 'avg_bested');
        expect(avgBested.result.total).toBe(10000);
        // Pole gets full file total even though found in top file
        const pole = results.find(r => r.key === 'pole');
        expect(pole.result.position).toBe(2);
        expect(pole.result.total).toBe(10000);
    });

    it('only bested uses avg_bested total, pole keeps own total', async () => {
        const index = makeIndex();
        window.StatsData.loadStatsIndex.mockResolvedValue(index);

        window.StatsData.fetchGzipJson.mockImplementation(async (path) => {
            if (path.includes('overall_top_')) {
                return { results: [
                    { name: 'My Driver', pole_positions: 1, podiums: 2, avg_bested: 50.0, bested_drivers: 100 }
                ]};
            }
            // avg_bested full file has 5000 entries
            if (path.includes('avg_bested')) {
                const list = [];
                for (let i = 0; i < 5000; i++) list.push({ name: `Driver ${i}`, avg_bested: 0 });
                list[0] = { name: 'My Driver', avg_bested: 50.0 };
                return { results: list };
            }
            // pole/podium/bested full files have 3000 entries
            const list = [];
            for (let i = 0; i < 3000; i++) list.push({ name: `Driver ${i}`, pole_positions: 0, podiums: 0, bested_drivers: 0 });
            list[0] = { name: 'My Driver', pole_positions: 1, podiums: 2, bested_drivers: 100 };
            return { results: list };
        });

        const results = await window.DriverStatsService.lookupDriverStats('My Driver');
        // Bested uses avg_bested total (5000)
        const bested = results.find(r => r.key === 'bested');
        expect(bested.result.total).toBe(5000);
        // Pole keeps its own full file total (3000)
        const pole = results.find(r => r.key === 'pole');
        expect(pole.result.total).toBe(3000);
        // Podium keeps its own full file total (3000)
        const podium = results.find(r => r.key === 'podium');
        expect(podium.result.total).toBe(3000);
    });

    it('returns null result when driver not found anywhere', async () => {
        window.StatsData.loadStatsIndex.mockResolvedValue(makeIndex());
        window.StatsData.fetchGzipJson.mockResolvedValue({ results: [{ name: 'Someone Else', pole_positions: 10 }] });

        const results = await window.DriverStatsService.lookupDriverStats('Ghost Driver');
        results.forEach(r => {
            // Some metrics may find "Ghost Driver" or not — check pole specifically
            if (r.key === 'pole') {
                expect(r.result).toBeNull();
            }
        });
    });

    it('handles fetch errors gracefully', async () => {
        window.StatsData.loadStatsIndex.mockResolvedValue(makeIndex());
        window.StatsData.fetchGzipJson.mockRejectedValue(new Error('Network error'));

        const results = await window.DriverStatsService.lookupDriverStats('Test');
        results.forEach(r => {
            expect(r.result).toBeNull();
        });
    });
});

describe('DriverStatsService._fetchWithDedup', () => {
    it('deduplicates concurrent fetches for the same path', async () => {
        let resolvePromise;
        window.StatsData.fetchGzipJson.mockImplementation(() =>
            new Promise((resolve) => { resolvePromise = resolve; })
        );

        const p1 = window.DriverStatsService._fetchWithDedup('test.json.gz');
        const p2 = window.DriverStatsService._fetchWithDedup('test.json.gz');

        // Should be the same promise
        expect(p1).toBe(p2);
        expect(window.StatsData.fetchGzipJson).toHaveBeenCalledTimes(1);

        resolvePromise({ results: [] });
        await p1;
    });

    it('clears cache after promise resolves', async () => {
        window.StatsData.fetchGzipJson.mockResolvedValue({ results: [] });

        await window.DriverStatsService._fetchWithDedup('test.json.gz');
        expect(window.DriverStatsService._fetchPromises.size).toBe(0);

        // Second call creates a new fetch
        await window.DriverStatsService._fetchWithDedup('test.json.gz');
        expect(window.StatsData.fetchGzipJson).toHaveBeenCalledTimes(2);
    });

    it('clears cache even on rejection', async () => {
        window.StatsData.fetchGzipJson.mockRejectedValue(new Error('fail'));

        await expect(window.DriverStatsService._fetchWithDedup('test.json.gz')).rejects.toThrow('fail');
        expect(window.DriverStatsService._fetchPromises.size).toBe(0);
    });
});

describe('DriverStatsService.PROFILE_METRICS', () => {
    it('defines exactly 4 metrics', () => {
        expect(window.DriverStatsService.PROFILE_METRICS).toHaveLength(4);
    });

    it('all metric keys exist in StatsData.METRIC_DEFINITIONS', () => {
        window.DriverStatsService.PROFILE_METRICS.forEach(m => {
            expect(window.StatsData.METRIC_DEFINITIONS).toHaveProperty(m.key);
        });
    });
});
