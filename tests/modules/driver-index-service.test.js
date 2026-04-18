import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/driver-index-service.js');
    loadBrowserScript('modules/driver-search-service.js');
    loadBrowserScript('modules/data-service.js');
});

describe('Driver index service', () => {
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
            extractName: vi.fn(entry => entry.name || entry.Name || '')
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            statusText: 'Test default',
            text: async () => ''
        });
        localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        delete global.requestIdleCallback;
    });

    it('exposes extracted module and data-service wrappers', () => {
        expect(window.R3EDriverIndexService).toBeTruthy();
        expect(typeof window.R3EDriverIndexService.loadDriverIndex).toBe('function');
        expect(typeof service.loadDriverIndex).toBe('function');
        expect(typeof service._fetchDriverMirrorData).toBe('function');
    });

    it('loads from cached index and starts background refresh/revalidation', async () => {
        vi.useFakeTimers();
        service.ENABLE_INDEX_LOCAL_CACHE = true;
        service._saveDriverIndexToCache({ alice: { name: 'Alice' } });
        const refreshSpy = vi.spyOn(service, '_refreshDriverIndexInBackground').mockResolvedValue();
        const updateSpy = vi.spyOn(service, '_updateLastIndexFromStatus').mockResolvedValue();
        const revalidatorSpy = vi.spyOn(service, '_startIndexStatusRevalidator').mockImplementation(() => {});

        const result = await service.loadDriverIndex();

        expect(result).toEqual({ alice: { name: 'Alice' } });
        expect(revalidatorSpy).toHaveBeenCalledTimes(1);
        expect(refreshSpy).not.toHaveBeenCalled();

        await vi.runAllTimersAsync();
        expect(refreshSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('transforms indexed mirror to name-keyed lookup', () => {
        const indexed = { '0': 'alice smith', '1': 'bob jones' };
        const result = service._transformMirrorToNameIndex(indexed);
        expect(result).toEqual({ 'alice smith': 'alice smith', 'bob jones': 'bob jones' });

        // Already name-keyed data passes through unchanged
        const nameKeyed = { 'alice smith': { name: 'Alice Smith' } };
        expect(service._transformMirrorToNameIndex(nameKeyed)).toBe(nameKeyed);
    });

    it('loads index from mirror fetch, transforms and caches it', async () => {
        vi.spyOn(service, '_fetchDriverMirrorData').mockResolvedValue({ '0': 'alice smith' });
        const saveSpy = vi.spyOn(service, '_saveDriverIndexToCache');
        const revalidatorSpy = vi.spyOn(service, '_startIndexStatusRevalidator').mockImplementation(() => {});
        vi.spyOn(service, '_updateLastIndexFromStatus').mockResolvedValue();

        const result = await service.loadDriverIndex();

        expect(result).toEqual({ 'alice smith': 'alice smith' });
        expect(service.driverNameMirror).toEqual({ 'alice smith': 'alice smith' });
        expect(saveSpy).toHaveBeenCalledWith({ 'alice smith': 'alice smith' });
        expect(revalidatorSpy).toHaveBeenCalledTimes(1);
    });

    it('deduplicates in-flight index load requests', async () => {
        let resolver;
        const pending = new Promise(resolve => {
            resolver = resolve;
        });
        const fetchSpy = vi.spyOn(service, '_fetchDriverMirrorData').mockReturnValue(pending);
        vi.spyOn(service, '_startIndexStatusRevalidator').mockImplementation(() => {});
        vi.spyOn(service, '_updateLastIndexFromStatus').mockResolvedValue();

        const first = service.loadDriverIndex();
        const second = service.loadDriverIndex();
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        resolver({ alice: { name: 'Alice' } });
        await expect(first).resolves.toEqual({ alice: { name: 'Alice' } });
        await expect(second).resolves.toEqual({ alice: { name: 'Alice' } });
    });

    it('parses shard and mirror payloads via compressed helper', async () => {
        window.CompressedJsonHelper.readGzipText
            .mockResolvedValueOnce('{"alice":[{"name":"Alice"}]}')
            .mockResolvedValueOnce('{"alice":{"name":"Alice"}}');
        vi.spyOn(service, '_parseJsonWhenIdle')
            .mockResolvedValueOnce({ alice: [{ name: 'Alice' }] })
            .mockResolvedValueOnce({ alice: { name: 'Alice' } });
        global.fetch
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
            .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

        await expect(service._fetchSingleDriverShard('a')).resolves.toEqual({ alice: [{ name: 'Alice' }] });
        await expect(service._fetchDriverMirrorData()).resolves.toEqual({ alice: { name: 'Alice' } });
    });

    it('deduplicates shard loading and waits for index', async () => {
        vi.spyOn(service, '_fetchSingleDriverShard').mockResolvedValue({ alice: [{ name: 'Alice' }] });
        const first = service._loadDriverShard('a');
        const second = service._loadDriverShard('a');
        await expect(first).resolves.toEqual({ alice: [{ name: 'Alice' }] });
        await expect(second).resolves.toEqual({ alice: [{ name: 'Alice' }] });

        vi.spyOn(service, '_fetchSingleDriverMetadataShard').mockResolvedValue({ alice: { name: 'Alice', country: 'SE' } });
        const m1 = service._loadDriverMetadataShard('a');
        const m2 = service._loadDriverMetadataShard('a');
        await expect(m1).resolves.toEqual({ alice: { name: 'Alice', country: 'SE' } });
        await expect(m2).resolves.toEqual({ alice: { name: 'Alice', country: 'SE' } });

        service.driverIndex = null;
        vi.spyOn(service, 'loadDriverIndex').mockResolvedValue({ ready: true });
        await expect(service.waitForDriverIndex(1)).resolves.toEqual({ ready: true });
    });

    it('extracts metadata from shards and enriches entries', async () => {
        expect(service._getShardKeyForName('Alice')).toBe('a');
        expect(service._normalizeDriverLookupName('  Alice   Smith ')).toBe('alice smith');

        // Mirror now just has names (no metadata)
        service.driverIndex = { 'alice smith': 'alice smith' };

        // Metadata comes from per-letter shards
        const metadataShard = {
            'alice smith': { name: 'Alice Smith', country: 'SE', team: 'Blue', rank: 'Pro' }
        };
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue(metadataShard);

        const meta = await service.getDriverMetadata('Alice Smith');
        expect(meta).toMatchObject({ displayName: 'Alice Smith', country: 'SE', hasMetadata: true });

        // Pre-populate metadata shard cache for enrichment
        service.driverMetadataShardCache.set('a', metadataShard);
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue(service.driverIndex);
        const rows = [{ name: 'Alice Smith' }];
        await service.enrichEntriesWithDriverMetadata(rows);
        expect(rows[0]).toMatchObject({ Country: 'SE', Team: 'Blue', Rank: 'Pro' });
    });

    it('parses JSON at idle, handles timeout helper, and updates index timestamp', async () => {
        global.requestIdleCallback = (cb) => {
            cb();
            return 1;
        };

        await expect(service._parseJsonWhenIdle('{"ok":true}')).resolves.toEqual({ ok: true });

        vi.useFakeTimers();
        const timeoutExpectation = expect(service._withTimeout(new Promise(() => {}), 10)).rejects.toThrow('Timeout');
        await vi.advanceTimersByTimeAsync(10);
        await timeoutExpectation;
        vi.useRealTimers();

        vi.spyOn(service, 'calculateStatus').mockResolvedValue({ last_index_update: '2026-04-11T00:00:00Z' });
        await service._updateLastIndexFromStatus();
        expect(service.lastIndexUpdate).toBe('2026-04-11T00:00:00Z');
    });

    it('starts status revalidator once and can refresh on change', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.spyOn(service, 'calculateStatus').mockResolvedValue({ last_index_update: 'new-value' });
        const refreshSpy = vi.spyOn(service, '_refreshDriverIndexInBackground').mockResolvedValue();

        service.lastIndexUpdate = 'old-value';
        service._startIndexStatusRevalidator();
        service._startIndexStatusRevalidator();

        await vi.advanceTimersByTimeAsync(2000);
        expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
});

