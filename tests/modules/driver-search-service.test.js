import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/driver-index-service.js');
    loadBrowserScript('modules/driver-search-service.js');
    loadBrowserScript('modules/data-service.js');
});

describe('DataService driver-search module', () => {
    let service;

    beforeEach(() => {
        service = new window.DataService();
        window.CARS_DATA = [];
    });

    it('exposes the dedicated driver-search module and service wrappers', () => {
        expect(window.R3EDriverSearchService).toBeTruthy();
        expect(typeof window.R3EDriverSearchService.searchDriver).toBe('function');
        expect(typeof service.searchDriver).toBe('function');
        expect(typeof service._filterDriverEntries).toBe('function');
    });

    it('matches partial and exact driver terms', () => {
        expect(service._matchesDriverSearchTerm('Alice Smith', 'alice', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('Alice Smith', 'ali', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('Alice Smith', 'alice smith', true)).toBe(true);
        expect(service._matchesDriverSearchTerm('Alice Smith', 'alice sm', true)).toBe(false);
    });

    it('filters entries by track, class (numeric), and difficulty', () => {
        const filtered = service._filterDriverEntries([
            { track_id: 10, Class: 5, difficulty: 'Get Real' },
            { track_id: 10, Class: 6, difficulty: 'Get Real' },
            { track_id: 11, Class: 5, difficulty: 'Get Real' },
            { track_id: 10, Class: 5, difficulty: 'Amateur' }
        ], {
            trackId: 10,
            classId: 5,
            difficulty: 'Get Real'
        });

        expect(filtered).toEqual([{ track_id: 10, Class: 5, difficulty: 'Get Real' }]);
    });

    it('filters entries by superclass', () => {
        window.CARS_DATA = [
            { superclass: 'GT3', class: 'GT3' },
            { superclass: 'GT3', class: 'GTR3' },
            { superclass: 'Touring', class: 'TCR' }
        ];

        const filtered = service._filterDriverEntries([
            { car_class: 'GT3' },
            { car_class: 'GTR3' },
            { car_class: 'TCR' }
        ], {
            className: 'superclass:GT3'
        });

        expect(filtered).toEqual([{ car_class: 'GT3' }, { car_class: 'GTR3' }]);
    });

    it('builds metadata and legacy search result groups', () => {
        const metadataResult = service._buildMetadataSearchResult(
            [{ track_id: 10 }],
            { displayName: 'Alice Smith', country: 'SE', team: 'Blue', rank: 'Pro' },
            'alice smith',
            [{ name: 'Alice Smith' }]
        );
        expect(metadataResult.driver).toBe('Alice Smith');
        expect(metadataResult.entries[0]).toMatchObject({ Country: 'SE', Team: 'Blue', Rank: 'Pro' });

        const legacyGroups = service._buildLegacySearchResults([
            { country: 'SE', team: 'Alpha', rank: 'A' },
            { country: 'SE', team: 'Beta', rank: 'B' }
        ], {
            displayName: 'Alice Smith'
        }, 'alice smith', [{ name: 'Alice Smith' }]);

        expect(legacyGroups).toHaveLength(2);
        expect(legacyGroups.map(group => group.team)).toEqual(['Alpha', 'Beta']);
    });

    it('searchDriver returns metadata-enriched results', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'alice smith': 'alice smith'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'alice smith': [{ name: 'Alice Smith', Class: 5, track_id: 10, difficulty: 'Get Real' }]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'alice smith': { name: 'Alice Smith', country: 'SE', team: 'Blue', rank: 'Pro' }
        });

        const result = await service.searchDriver('Alice', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ driver: 'Alice Smith', country: 'SE', team: 'Blue', rank: 'Pro' });
        expect(result[0].entries[0]).toMatchObject({ Country: 'SE', Team: 'Blue', Rank: 'Pro' });
    });

    it('searchDriver supports exact quoted search with legacy grouping', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'alice smith': 'alice smith'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'alice smith': [
                { name: 'Alice Smith', car_class: 'GT3', difficulty: 'Get Real', country: 'SE', team: 'Alpha' },
                { name: 'Alice Smith', car_class: 'GT3', difficulty: 'Get Real', country: 'SE', team: 'Beta' }
            ]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({});

        const result = await service.searchDriver('"Alice Smith"', { difficulty: 'Get Real' });

        expect(result).toHaveLength(2);
        expect(result.map(group => group.team)).toEqual(['Alpha', 'Beta']);
    });

    it('searchDriver throws when driver index is unavailable', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({});

        await expect(service.searchDriver('Alice')).rejects.toThrow('Driver index is loading or unavailable');
    });

    it('searchDriver falls back to _ shards for diacritical names', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'oscar domingo': 'oscar domingo'
        });

        // _ metadata shard has original key with search_name alias already built
        const underscoreMetadata = {
            'óscar domingo': { name: 'Óscar Domingo', country: 'Spain', team: 'RRSL1', rank: '', search_name: 'oscar domingo', _originalKey: 'óscar domingo' },
            'oscar domingo': null // alias will be set below
        };
        underscoreMetadata['oscar domingo'] = underscoreMetadata['óscar domingo'];

        vi.spyOn(service, '_loadDriverShard').mockImplementation(async (key) => {
            if (key === '_') return { 'óscar domingo': [{ name: 'Óscar Domingo', track_id: 10, Class: 5, difficulty: 'Get Real' }] };
            return {};
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async (key) => {
            if (key === '_') return underscoreMetadata;
            return {};
        });

        const result = await service.searchDriver('oscar', { trackId: 10 });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ driver: 'Óscar Domingo', country: 'Spain', team: 'RRSL1' });
    });
});

