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

    it('matches accentuated driver names with accentuated and unaccentuated search terms', () => {
        // User searches with accents - should match accentuated driver name
        expect(service._matchesDriverSearchTerm('ömer binikli', 'ömer bi', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('ömer binikli', 'ömer', false)).toBe(true);
        // Unaccentuated search should also match accentuated driver name (normalized)
        expect(service._matchesDriverSearchTerm('ömer binikli', 'omer bi', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('ömer binikli', 'omer', false)).toBe(true);
        // Exact match with accents
        expect(service._matchesDriverSearchTerm('ömer binikli', 'ömer binikli', true)).toBe(true);
        // Exact match normalized
        expect(service._matchesDriverSearchTerm('ömer binikli', 'omer binikli', true)).toBe(true);
    });

    it('matches exact search with punctuation', () => {
        // Exact match with period - simple string equality after normalization
        expect(service._matchesDriverSearchTerm('Sven B.', 'Sven B.', true)).toBe(true);
        // Should not match when punctuation differs
        expect(service._matchesDriverSearchTerm('Sven B', 'Sven B.', true)).toBe(false);
        // Case-insensitive exact match with punctuation
        expect(service._matchesDriverSearchTerm('sven b.', 'Sven B.', true)).toBe(true);
    });

    it('matches exact search normalization at pre-filter stage', () => {
        // Pre-filter exact match remains normalized to allow shard lookup on normalized keys.
        expect(service._matchesDriverSearchTerm('José', 'josé', true)).toBe(true);
        expect(service._matchesDriverSearchTerm('Jose', 'josé', true)).toBe(true);
        // Exact search without accent should match both (normalized comparison)
        expect(service._matchesDriverSearchTerm('José', 'jose', true)).toBe(true);
        expect(service._matchesDriverSearchTerm('Jose', 'jose', true)).toBe(true);
        // Multi-word exact searches are normalized at this stage as well.
        expect(service._matchesDriverSearchTerm('José Silva', 'josé silva', true)).toBe(true);
        expect(service._matchesDriverSearchTerm('Jose Silva', 'josé silva', true)).toBe(true);
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

    it('searchDriver groups same-name metadata results by path_id', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'tobias naumann': 'tobias naumann'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'tobias naumann': [
                { name: 'Tobias Naumann', path_id: '1001', Class: 5, track_id: 10, difficulty: 'Get Real' },
                { name: 'Tobias Naumann', path_id: '1002', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'tobias naumann': [
                { name: 'Tobias Naumann', path_id: '1001', country: 'Germany', team: 'Alpha', rank: 'B', avatar: 'https://example.com/avatar-1001.png' },
                { name: 'Tobias Naumann', path_id: '1002', country: 'Austria', team: 'Beta', rank: 'A', avatar: 'https://example.com/avatar-1002.png' }
            ]
        });

        const result = await service.searchDriver('Tobias Naumann', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        expect(result).toHaveLength(2);
        expect(result.map(group => group.pathId).sort()).toEqual(['1001', '1002']);
        expect(result.find(group => group.pathId === '1001')).toMatchObject({
            country: 'Germany',
            team: 'Alpha',
            rank: 'B',
            avatar: 'https://example.com/avatar-1001.png'
        });
        expect(result.find(group => group.pathId === '1002')).toMatchObject({
            country: 'Austria',
            team: 'Beta',
            rank: 'A',
            avatar: 'https://example.com/avatar-1002.png'
        });
    });

    it('searchDriver exact accent search returns only accentuated metadata name matches', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'jose': 'jose'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            jose: [
                { name: 'Jose', path_id: '100', Class: 5, track_id: 10, difficulty: 'Get Real' },
                { name: 'José', path_id: '200', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            jose: [
                { name: 'Jose', path_id: '100', country: 'Spain', team: 'A', rank: '' },
                { name: 'José', path_id: '200', country: 'Portugal', team: 'B', rank: 'C' }
            ]
        });

        const result = await service.searchDriver('"josé"', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            driver: 'José',
            pathId: '200',
            country: 'Portugal',
            team: 'B',
            rank: 'C'
        });
        expect(result[0].entries.every(entry => entry.path_id === '200')).toBe(true);
    });

    it('searchDriver exact accent search matches partial first name in full display name', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'jose lopez': 'jose lopez'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'jose lopez': [
                { path_id: '5696169', Class: 5, track_id: 10, difficulty: 'Get Real' },
                { path_id: '8221896', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'jose lopez': [
                { name: 'José López', path_id: '5696169', country: 'Spain', team: '', rank: 'C' },
                { name: 'jose lopez', path_id: '8221896', country: 'Peru', team: '', rank: '' }
            ]
        });

        const result = await service.searchDriver('"josé"', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        // Only José López should be returned — "josé" is an accent-exact word match
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            driver: 'José López',
            pathId: '5696169',
            country: 'Spain',
            rank: 'C'
        });
        // jose lopez (no accent) must NOT appear
        expect(result.find(r => r.driver === 'jose lopez')).toBeUndefined();
    });

    it('searchDriver exact non-accent search excludes accentuated metadata name matches', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'jose lopez': 'jose lopez'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'jose lopez': [
                { path_id: '5696169', Class: 5, track_id: 10, difficulty: 'Get Real' },
                { path_id: '8221896', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'jose lopez': [
                { name: 'José López', path_id: '5696169', country: 'Spain', team: '', rank: 'C' },
                { name: 'jose lopez', path_id: '8221896', country: 'Peru', team: '', rank: '' }
            ]
        });

        const result = await service.searchDriver('"Jose"', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        // Only jose lopez (no accent) should be returned
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            driver: 'jose lopez',
            pathId: '8221896',
            country: 'Peru'
        });
        // José López (with accent) must NOT appear
        expect(result.find(r => r.driver === 'José López')).toBeUndefined();
    });

    it('searchDriver partial accent search returns only accented matches and excludes non-accented', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'jose lopez': 'jose lopez',
            'joseph martin': 'joseph martin'
        });
        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'jose lopez': [
                { path_id: '5696169', Class: 5, track_id: 10, difficulty: 'Get Real' },
                { path_id: '8221896', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ],
            'joseph martin': [
                { path_id: '9999999', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });
        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'jose lopez': [
                { name: 'José López', path_id: '5696169', country: 'Spain', team: '', rank: 'C' },
                { name: 'jose lopez', path_id: '8221896', country: 'Peru', team: '', rank: '' }
            ],
            'joseph martin': [
                { name: 'Joseph Martin', path_id: '9999999', country: 'France', team: '', rank: '' }
            ]
        });

        const result = await service.searchDriver('josé', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        // Only José López should appear — unquoted accent search filters out jose/joseph
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ driver: 'José López', pathId: '5696169' });
        expect(result.find(r => r.driver === 'jose lopez')).toBeUndefined();
        expect(result.find(r => r.driver === 'Joseph Martin')).toBeUndefined();
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

