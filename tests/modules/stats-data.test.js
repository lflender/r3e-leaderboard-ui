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
            { name: 'A', country: 'FR', rank: 'B', value: 9 },
            { name: 'B', country: 'DE', rank: 'A', value: 4 }
        ]);
    });
});
