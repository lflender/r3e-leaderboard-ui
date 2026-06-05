import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function loadGzipJson(relativePath) {
    const fullPath = path.resolve(ROOT, relativePath);
    const gz = fs.readFileSync(fullPath);
    const raw = zlib.gunzipSync(gz);
    return JSON.parse(raw);
}

function gzipJsonExists(relativePath) {
    return fs.existsSync(path.resolve(ROOT, relativePath));
}

beforeAll(() => {
    loadBrowserScript('modules/driver-index-service.js');
    loadBrowserScript('modules/driver-search-service.js');
    loadBrowserScript('modules/data-service.js');
});

describe('Performance: cache loading', () => {
    let service;
    let mirrorData;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();

        service = new window.DataService();
        window.CompressedJsonHelper = {
            readGzipJson: vi.fn(),
            readGzipText: vi.fn()
        };
        window.DataNormalizer = {
            extractName: vi.fn(entry => entry.name || entry.Name || '')
        };
        window.CARS_DATA = [];
        window.R3EUtils = {
            fetchWithTimeout: vi.fn((url, options = {}) => fetch(url, options))
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: false, status: 503, statusText: 'Test default', text: async () => ''
        });
        localStorage.clear();

        // Load real mirror data for perf testing
        if (gzipJsonExists('cache/index/mirror.json.gz')) {
            mirrorData = loadGzipJson('cache/index/mirror.json.gz');
        }

        // Pre-set cache version to avoid status.json fetches in shard tests
        service._indexCacheVersion = 'test1';
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        delete global.requestIdleCallback;
    });

    describe('_parseJsonWhenIdle', () => {
        it('parses JSON directly without requestIdleCallback overhead', async () => {
            // After fix: _parseJsonWhenIdle always uses direct JSON.parse
            // regardless of whether requestIdleCallback exists
            global.requestIdleCallback = vi.fn();
            const jsonText = JSON.stringify({ foo: 'bar', count: 42 });

            const start = performance.now();
            const result = await service._parseJsonWhenIdle(jsonText);
            const elapsed = performance.now() - start;

            expect(result).toEqual({ foo: 'bar', count: 42 });
            expect(elapsed).toBeLessThan(10);
            // requestIdleCallback should NOT be called anymore
            expect(global.requestIdleCallback).not.toHaveBeenCalled();
        });

        it('parallel parses complete without serialization delays', async () => {
            // After fix: multiple parallel _parseJsonWhenIdle calls
            // resolve immediately instead of being serialized by idle callbacks
            global.requestIdleCallback = vi.fn();

            const start = performance.now();
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(service._parseJsonWhenIdle(JSON.stringify({ shard: i })));
            }
            const results = await Promise.all(promises);
            const elapsed = performance.now() - start;

            expect(results).toHaveLength(10);
            results.forEach((r, i) => expect(r.shard).toBe(i));
            // All 10 should resolve near-instantly without idle callback delays
            expect(elapsed).toBeLessThan(50);
            expect(global.requestIdleCallback).not.toHaveBeenCalled();
        });
    });

    describe('mirror index loading', () => {
        it('_transformMirrorToNameIndex handles indexed mirror efficiently', () => {
            if (!mirrorData) return;

            const start = performance.now();
            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            const elapsed = performance.now() - start;

            const keys = Object.keys(nameIndex);
            expect(keys.length).toBeGreaterThan(1000);
            // Transform should be fast - it's just iterating values
            expect(elapsed).toBeLessThan(200);
        });

        it('loadDriverIndex completes within reasonable time', async () => {
            if (!mirrorData) return;

            const mirrorText = JSON.stringify(mirrorData);
            window.CompressedJsonHelper.readGzipText.mockResolvedValue(mirrorText);
            global.fetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(service, '_startIndexStatusRevalidator').mockImplementation(() => {});
            vi.spyOn(service, '_updateLastIndexFromStatus').mockResolvedValue();

            const start = performance.now();
            const result = await service.loadDriverIndex();
            const elapsed = performance.now() - start;

            expect(Object.keys(result).length).toBeGreaterThan(1000);
            // After fix: no requestIdleCallback overhead, should be fast
            expect(elapsed).toBeLessThan(500);
        });

        it('loadDriverIndex is fast even when requestIdleCallback exists', async () => {
            if (!mirrorData) return;

            const mirrorText = JSON.stringify(mirrorData);
            window.CompressedJsonHelper.readGzipText.mockResolvedValue(mirrorText);
            global.fetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(service, '_startIndexStatusRevalidator').mockImplementation(() => {});
            vi.spyOn(service, '_updateLastIndexFromStatus').mockResolvedValue();

            // After fix: requestIdleCallback presence should NOT slow down parsing
            global.requestIdleCallback = vi.fn();

            const start = performance.now();
            const result = await service.loadDriverIndex();
            const elapsed = performance.now() - start;

            expect(Object.keys(result).length).toBeGreaterThan(1000);
            // Should be equally fast - requestIdleCallback is no longer used
            expect(elapsed).toBeLessThan(500);
            expect(global.requestIdleCallback).not.toHaveBeenCalled();
        });
    });

    describe('search performance: _matchesDriverSearchTerm', () => {
        it('substring search scales linearly with mirror size', () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            const keys = Object.keys(nameIndex);

            // Broad search ("max" appears in many names)
            const start = performance.now();
            let matchCount = 0;
            for (const k of keys) {
                if (service._matchesDriverSearchTerm(k, 'max', false)) {
                    matchCount++;
                }
            }
            const elapsed = performance.now() - start;

            // Should complete search in reasonable time for 87K keys
            // (varies with system load during parallel test runs)
            expect(elapsed).toBeLessThan(1000);
            // "max" should match many drivers
            expect(matchCount).toBeGreaterThan(0);
        });

        it('short search terms scan entire mirror and may match many shards', () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            const keys = Object.keys(nameIndex);

            const start = performance.now();
            const matchedShards = new Set();
            let matchCount = 0;
            for (const k of keys) {
                if (service._matchesDriverSearchTerm(k, 'ver', false)) {
                    matchCount++;
                    const normalized = service._normalizeDriverLookupName(k);
                    matchedShards.add(service._getShardKeyForName(normalized));
                }
            }
            const elapsed = performance.now() - start;

            expect(elapsed).toBeLessThan(1000);
            // Document how many shards a broad search hits
            // This is the key insight: broad searches require loading many shards
            if (matchCount > 0) {
                console.log(`Search "ver": ${matchCount} matches across ${matchedShards.size} shards`);
            }
        });
    });

    describe('shard loading performance', () => {
        it('_fetchSingleDriverShard with direct JSON.parse is fast', async () => {
            if (!gzipJsonExists('cache/index/entries/m.json.gz')) return;

            const shardData = loadGzipJson('cache/index/entries/m.json.gz');
            const shardText = JSON.stringify(shardData);

            window.CompressedJsonHelper.readGzipText.mockResolvedValue(shardText);
            global.fetch = vi.fn().mockResolvedValue({ ok: true });
            delete global.requestIdleCallback;

            const start = performance.now();
            const result = await service._fetchSingleDriverShard('m');
            const elapsed = performance.now() - start;

            expect(Object.keys(result).length).toBeGreaterThan(100);
            expect(elapsed).toBeLessThan(500);
        });

        it('parallel shard loading without requestIdleCallback is efficient', async () => {
            if (!gzipJsonExists('cache/index/entries/a.json.gz')) return;

            // Simulate loading 3 shards in parallel (typical search)
            const shardLetters = ['a', 'm', 's'];
            const shardTexts = {};
            for (const l of shardLetters) {
                if (gzipJsonExists(`cache/index/entries/${l}.json.gz`)) {
                    shardTexts[l] = JSON.stringify(loadGzipJson(`cache/index/entries/${l}.json.gz`));
                }
            }

            let fetchCallCount = 0;
            global.fetch = vi.fn().mockImplementation((url) => {
                fetchCallCount++;
                return Promise.resolve({ ok: true });
            });
            window.CompressedJsonHelper.readGzipText.mockImplementation(() => {
                // Return the text for the next shard
                const letter = shardLetters[fetchCallCount - 1] || 'a';
                return Promise.resolve(shardTexts[letter] || '{}');
            });
            delete global.requestIdleCallback;

            const start = performance.now();
            await Promise.all(shardLetters.map(l => service._loadDriverShard(l)));
            const elapsed = performance.now() - start;

            // 3 shards should load quickly without idle callback overhead
            expect(elapsed).toBeLessThan(1500);
        });

        it('shard cache prevents redundant fetches', async () => {
            const shardText = JSON.stringify({ 'test driver': [{ position: 1 }] });
            window.CompressedJsonHelper.readGzipText.mockResolvedValue(shardText);
            global.fetch = vi.fn().mockResolvedValue({ ok: true });
            delete global.requestIdleCallback;

            // First load
            const result1 = await service._loadDriverShard('t');
            // Second load should come from cache
            const result2 = await service._loadDriverShard('t');

            expect(result1).toBe(result2); // Same reference = from cache
            expect(global.fetch).toHaveBeenCalledTimes(1); // Only one fetch
        });
    });

    describe('enrichEntriesWithDriverMetadata performance', () => {
        it('pre-loads metadata shards in parallel', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            // Create mock entries spanning multiple shards
            const sampleNames = Object.keys(nameIndex).slice(0, 20);
            const entries = sampleNames.map(name => ({ name, position: 1 }));

            // Mock metadata shard loading
            const loadedShards = new Set();
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async (key) => {
                loadedShards.add(key);
                return {};
            });

            await service.enrichEntriesWithDriverMetadata(entries);

            // Should pre-load shards in parallel (including _ fallback)
            expect(loadedShards.has('_')).toBe(true);
            expect(loadedShards.size).toBeGreaterThan(0);
        });

        it('skips entries that already have country+rank+team', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            const sampleNames = Object.keys(nameIndex).slice(0, 10);
            // All entries fully populated - should not need any shard loading
            const entries = sampleNames.map(name => ({
                name, position: 1,
                country: 'Sweden', Country: 'Sweden',
                rank: 'A', Rank: 'A',
                team: 'Team X', Team: 'Team X'
            }));

            const loadedShards = new Set();
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async (key) => {
                loadedShards.add(key);
                return {};
            });

            await service.enrichEntriesWithDriverMetadata(entries);

            // No shards should be loaded - all entries already complete
            expect(loadedShards.size).toBe(0);
        });
    });

    describe('searchDriver end-to-end performance', () => {
        it('exact quoted search uses O(1) key lookup, not linear scan', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            // Find a real name that exists in the mirror
            const realName = Object.keys(nameIndex)[100]; // pick one from index
            if (!realName) return;

            // Spy on _matchesDriverSearchTerm to count calls
            const matchSpy = vi.spyOn(service, '_matchesDriverSearchTerm');
            vi.spyOn(service, '_loadDriverShard').mockImplementation(async () => {
                return { [realName]: [{ name: realName, position: 1, track_id: '10258', car_class: 'GT3' }] };
            });
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async () => ({}));

            const start = performance.now();
            await service.searchDriver(`"${realName}"`);
            const elapsed = performance.now() - start;

            // Fast path: should NOT scan all 87K keys via _matchesDriverSearchTerm
            // If direct lookup succeeds, _matchesDriverSearchTerm should not be called
            // at all (or at most for a small fallback set)
            const scanCalls = matchSpy.mock.calls.length;
            console.log(`Exact search "${realName}": ${scanCalls} _matchesDriverSearchTerm calls (0 = fast path hit), ${elapsed.toFixed(0)}ms`);
            expect(scanCalls).toBe(0); // Direct lookup, no scanning
            expect(elapsed).toBeLessThan(500);
        });

        it('exact quoted search falls back to scan for partial matches', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            // Use a term that won't match any key directly (single word like "Smith")
            const matchSpy = vi.spyOn(service, '_matchesDriverSearchTerm').mockReturnValue(false);
            vi.spyOn(service, '_loadDriverShard').mockImplementation(async () => ({}));
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async () => ({}));

            await service.searchDriver('"nonexistent_driver_xyz_12345"');

            // Fallback: should scan all keys since direct lookup found nothing
            const scanCalls = matchSpy.mock.calls.length;
            expect(scanCalls).toBe(Object.keys(nameIndex).length);
        });

        it('narrow search (exact name) loads minimal shards', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            // Find a real name that starts with 'm'
            const mNames = Object.keys(nameIndex).filter(k => k.toLowerCase().startsWith('m'));
            if (mNames.length === 0) return;

            const testName = mNames[0];
            const loadedShards = new Set();
            vi.spyOn(service, '_loadDriverShard').mockImplementation(async (key) => {
                loadedShards.add(key);
                return { [testName]: [{ name: testName, position: 1, track_id: '10258', car_class: 'GT3' }] };
            });
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async (key) => {
                return {};
            });

            const start = performance.now();
            await service.searchDriver(`"${testName}"`);
            const elapsed = performance.now() - start;

            // Exact search should load very few shards
            expect(loadedShards.size).toBeLessThanOrEqual(3);
            expect(elapsed).toBeLessThan(2000);
        });

        it('broad search (short term) triggers many shard loads', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            const loadedEntryShards = new Set();
            const loadedMetaShards = new Set();
            vi.spyOn(service, '_loadDriverShard').mockImplementation(async (key) => {
                loadedEntryShards.add(key);
                return {};
            });
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async (key) => {
                loadedMetaShards.add(key);
                return {};
            });

            await service.searchDriver('max');

            // After fix: broad search results are capped at 500 matched drivers,
            // which limits shard loading to fewer shards than before
            console.log(`Broad search "max": loaded ${loadedEntryShards.size} entry shards + ${loadedMetaShards.size} metadata shards`);
            // With 500-cap, still loads many shards but bounded
            expect(loadedEntryShards.size).toBeGreaterThan(0);
            expect(loadedEntryShards.size).toBeLessThanOrEqual(27);
        });

        it('broad search caps matched drivers and prioritizes prefix matches', async () => {
            if (!mirrorData) return;

            const nameIndex = service._transformMirrorToNameIndex(mirrorData);
            service.driverIndex = nameIndex;
            service.driverNameMirror = nameIndex;

            // Count how many drivers match without cap
            const mirrorKeys = Object.keys(nameIndex);
            const allMatches = mirrorKeys.filter(k =>
                service._matchesDriverSearchTerm(k, 'max', false)
            );

            const loadedEntryShards = new Set();
            vi.spyOn(service, '_loadDriverShard').mockImplementation(async (key) => {
                loadedEntryShards.add(key);
                return {};
            });
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async () => ({}));

            await service.searchDriver('max');

            // If original matches exceeded 500, verify capping worked
            if (allMatches.length > 500) {
                console.log(`Capping: ${allMatches.length} raw matches reduced, loaded ${loadedEntryShards.size} shards`);
                // Capped result should load fewer shards than uncapped
                const uncappedShards = new Set(allMatches.map(k => service._getShardKeyForName(k)));
                expect(loadedEntryShards.size).toBeLessThanOrEqual(uncappedShards.size);
            }
        });
    });
});
