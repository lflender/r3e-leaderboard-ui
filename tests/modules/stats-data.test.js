import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('StatsData', () => {
    beforeEach(() => {
        delete window.StatsData;
        delete window.getCarClassId;
        global.fetch = vi.fn();
        global.Response = class Response {
            constructor(value) {
                this.value = value;
            }

            async text() {
                return this.value;
            }
        };
        global.DecompressionStream = class DecompressionStream {
            constructor() {}
        };
        loadBrowserScript('modules/stats-data.js');
    });

    test('loads and caches stats index', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ overall: { pole_file: 'pole.gz', bested_file: 'bested.gz' } }) });

        const first = await window.StatsData.loadStatsIndex();
        const second = await window.StatsData.loadStatsIndex();

        expect(first).toEqual(second);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('resolves paths for overall, superclass, and class filters', () => {
        window.getCarClassId = vi.fn(() => '1703');
        const index = {
            overall: { pole_file: 'overall-pole.gz', bested_file: 'overall-bested.gz' },
            superclasses: [{ name: 'GT3', files: { pole_file: 'gt3-pole.gz', bested_file: 'gt3-bested.gz' } }],
            classes: [{ id: '1703', files: { pole_file: 'class-pole.gz', bested_file: 'class-bested.gz' } }]
        };

        expect(window.StatsData.getPathsForFilter(index, '')).toEqual({ polePath: 'overall-pole.gz', bestedPath: 'overall-bested.gz' });
        expect(window.StatsData.getPathsForFilter(index, 'superclass:GT3')).toEqual({ polePath: 'gt3-pole.gz', bestedPath: 'gt3-bested.gz' });
        expect(window.StatsData.getPathsForFilter(index, 'GTR 3')).toEqual({ polePath: 'class-pole.gz', bestedPath: 'class-bested.gz' });
    });

    test('normalizes and sorts stats rows', () => {
        const rows = window.StatsData.normalizeRows([
            { name: 'B', pole_positions: 4, country: 'DE', rank: 'A' },
            { driver_name: 'A', pole_positions: 9, country: 'FR', rank: 'B' },
            { driver_key: 'C', pole_positions: 1 }
        ], 'pole_positions', 2);

        expect(rows).toEqual([
            { name: 'A', country: 'FR', rank: 'B', avatar: '', team: '', value: 9 },
            { name: 'B', country: 'DE', rank: 'A', avatar: '', team: '', value: 4 }
        ]);
    });

    test('exposes METRIC_DEFINITIONS for the record types with correct directions', () => {
        const defs = window.StatsData.METRIC_DEFINITIONS;
        expect(defs.pole).toEqual({ metricKey: 'pole_positions', fileKey: 'pole_file', direction: 'desc' });
        expect(defs.bested).toEqual({ metricKey: 'bested_drivers', fileKey: 'bested_file', direction: 'desc' });
        expect(defs.podium).toEqual({ metricKey: 'podiums', fileKey: 'podium_file', direction: 'desc' });
        expect(defs.avg_bested).toEqual({ metricKey: 'avg_bested', fileKey: 'avg_bested_file', direction: 'desc' });
        expect(defs.entries).toEqual({ metricKey: 'entries', fileKey: 'entries_file', direction: 'desc' });
    });

    test('getAllPathsForFilter returns all file paths for overall/superclass/class', () => {
        window.getCarClassId = vi.fn(() => '1703');
        const index = {
            overall: {
                pole_file: 'overall-pole.gz',
                bested_file: 'overall-bested.gz',
                podium_file: 'overall-podium.gz',
                entries_file: 'overall-entries.gz'
            },
            superclasses: [{
                name: 'GT3',
                files: {
                    pole_file: 'gt3-pole.gz',
                    bested_file: 'gt3-bested.gz',
                    podium_file: 'gt3-podium.gz',
                    entries_file: 'gt3-entries.gz'
                }
            }],
            classes: [{
                id: '1703',
                files: {
                    pole_file: 'class-pole.gz',
                    bested_file: 'class-bested.gz',
                    podium_file: 'class-podium.gz',
                    entries_file: 'class-entries.gz'
                }
            }]
        };

        expect(window.StatsData.getAllPathsForFilter(index, '')).toEqual({
            polePath: 'overall-pole.gz',
            bestedPath: 'overall-bested.gz',
            podiumPath: 'overall-podium.gz',
            avgBestedPath: undefined,
            entriesPath: 'overall-entries.gz'
        });

        const cacheStyleIndex = {
            overall: {
                pole_file: 'cache/stats/overall_pole.json.gz',
                bested_file: 'cache/stats/overall_bested.json.gz',
                podium_file: 'cache/stats/overall_podium.json.gz',
                entries_file: 'cache/stats/overall_entries.json.gz',
                avg_bested_file: 'cache/stats/overall_avg_bested.json.gz'
            }
        };
        expect(window.StatsData.getAllPathsForFilter(cacheStyleIndex, '')).toEqual({
            polePath: 'cache/stats/overall_top_pole.json.gz',
            bestedPath: 'cache/stats/overall_top_bested.json.gz',
            podiumPath: 'cache/stats/overall_top_podium.json.gz',
            avgBestedPath: 'cache/stats/overall_top_avg_bested.json.gz',
            entriesPath: 'cache/stats/overall_top_entries.json.gz'
        });
        expect(window.StatsData.getAllPathsForFilter(index, 'superclass:GT3')).toEqual({
            polePath: 'gt3-pole.gz',
            bestedPath: 'gt3-bested.gz',
            podiumPath: 'gt3-podium.gz',
            avgBestedPath: undefined,
            entriesPath: 'gt3-entries.gz'
        });
        expect(window.StatsData.getAllPathsForFilter(index, 'GTR 3')).toEqual({
            polePath: 'class-pole.gz',
            bestedPath: 'class-bested.gz',
            podiumPath: 'class-podium.gz',
            avgBestedPath: undefined,
            entriesPath: 'class-entries.gz'
        });
    });

    test('each metric definition uses a unique fileKey — no two metrics share the same source file', () => {
        const defs = window.StatsData.METRIC_DEFINITIONS;
        const fileKeys = Object.values(defs).map((d) => d.fileKey);
        const unique = new Set(fileKeys);
        expect(unique.size).toBe(fileKeys.length);
    });

    test('getAllPathsForFilter uses avg_bested_file when present, returns undefined avgBestedPath when absent', () => {
        window.getCarClassId = vi.fn(() => '1703');

        // Overall: dedicated avg_bested_file present → should use it
        const indexWithDedicated = {
            overall: {
                pole_file: 'overall-pole.gz',
                bested_file: 'overall-bested.gz',
                podium_file: 'overall-podium.gz',
                entries_file: 'overall-entries.gz',
                avg_bested_file: 'overall-avg-bested.gz'
            }
        };
        expect(window.StatsData.getAllPathsForFilter(indexWithDedicated, '').avgBestedPath)
            .toBe('overall-avg-bested.gz');

        // Superclass: dedicated avg_bested_file present → should use it
        const indexWithSuperclassDedicated = {
            superclasses: [{
                name: 'GT3',
                files: {
                    pole_file: 'gt3-pole.gz',
                    bested_file: 'gt3-bested.gz',
                    podium_file: 'gt3-podium.gz',
                    entries_file: 'gt3-entries.gz',
                    avg_bested_file: 'gt3-avg-bested.gz'
                }
            }]
        };
        expect(window.StatsData.getAllPathsForFilter(indexWithSuperclassDedicated, 'superclass:GT3').avgBestedPath)
            .toBe('gt3-avg-bested.gz');

        // Class: no dedicated avg_bested_file → avgBestedPath is undefined (no fallback)
        const indexWithoutDedicated = {
            classes: [{
                id: '1703',
                files: {
                    pole_file: 'class-pole.gz',
                    bested_file: 'class-bested.gz',
                    podium_file: 'class-podium.gz',
                    entries_file: 'class-entries.gz'
                }
            }]
        };
        expect(window.StatsData.getAllPathsForFilter(indexWithoutDedicated, 'GTR 3').avgBestedPath)
            .toBeUndefined();
    });

    test('normalizeRows supports ascending direction (lower value is better)', () => {
        const rows = window.StatsData.normalizeRows([
            { name: 'A', avg_percentile: 12.5, country: 'DE', rank: 'A' },
            { name: 'B', avg_percentile: 1.5, country: 'FR', rank: 'B' },
            { name: 'C', avg_percentile: 7.0, country: 'IT', rank: 'C' }
        ], 'avg_percentile', 2, { direction: 'asc' });

        expect(rows.map((r) => r.name)).toEqual(['B', 'C']);
        expect(rows[0].value).toBe(1.5);
    });

    test('getPathsForFilter remains backward compatible (only pole/bested)', () => {
        const index = {
            overall: {
                pole_file: 'overall-pole.gz',
                bested_file: 'overall-bested.gz',
                podium_file: 'overall-podium.gz',
                percentile_file: 'overall-percentile.gz'
            }
        };
        expect(window.StatsData.getPathsForFilter(index, '')).toEqual({
            polePath: 'overall-pole.gz',
            bestedPath: 'overall-bested.gz'
        });
    });
});
