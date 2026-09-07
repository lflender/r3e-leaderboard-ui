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

    it('supports folded matching for common european special letters', () => {
        expect(service._matchesDriverSearchTerm('Bruno Bæ', 'bruno bae', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('Søren', 'soren', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('François L\'Œuf', "francois l'oeuf", false)).toBe(true);
        expect(service._matchesDriverSearchTerm('Groß', 'gross', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('Łukasz', 'lukasz', false)).toBe(true);
        expect(service._matchesDriverSearchTerm('Þórður', 'thordur', false)).toBe(true);
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

    it('matches all layouts for a selected base track when the filter value points at one layout', () => {
        window.TRACKS_DATA = [
            { id: 10, label: 'Spa - Grand Prix' },
            { id: 11, label: 'Spa - Indy' },
            { id: 20, label: 'Monza - GP' }
        ];

        const filtered = service._filterDriverEntries([
            { track_id: 10, Class: 5, difficulty: 'Get Real' },
            { track_id: 11, Class: 5, difficulty: 'Get Real' },
            { track_id: 20, Class: 5, difficulty: 'Get Real' }
        ], {
            trackId: 10,
            classId: 5,
            difficulty: 'Get Real'
        });

        expect(filtered).toEqual([
            { track_id: 10, Class: 5, difficulty: 'Get Real' },
            { track_id: 11, Class: 5, difficulty: 'Get Real' }
        ]);
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

    it('searchDriver exact quoted search matches names with non-decomposable european characters', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'bruno bae': 'bruno bae'
        });

        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'bruno bae': [
                { name: 'Bruno Bæ', path_id: '100', Class: 5, track_id: 10, difficulty: 'Get Real' },
                { name: 'Bruno Bae', path_id: '200', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });

        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'bruno bae': [
                { name: 'Bruno Bæ', path_id: '100', country: 'Denmark', team: 'Nordic', rank: 'B' },
                { name: 'Bruno Bae', path_id: '200', country: 'Germany', team: 'Berlin', rank: 'C' }
            ]
        });

        const result = await service.searchDriver('"Bruno Bæ"', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            driver: 'Bruno Bæ',
            pathId: '100',
            country: 'Denmark',
            team: 'Nordic',
            rank: 'B'
        });
        expect(result.find((row) => row.driver === 'Bruno Bae')).toBeUndefined();
    });

    it('searchDriver resolves mirror/shard key mismatches for european special characters', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'bruno bæ': 'bruno bæ'
        });

        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'bruno ba': [
                { name: 'Bruno Bæ', path_id: '300', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });

        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'bruno ba': [
                { name: 'Bruno Bæ', path_id: '300', country: 'Denmark', team: 'Nordic Legacy', rank: 'A' }
            ]
        });

        const result = await service.searchDriver('"Bruno Bæ"', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            driver: 'Bruno Bæ',
            pathId: '300',
            country: 'Denmark',
            team: 'Nordic Legacy',
            rank: 'A'
        });
    });

    it('searchDriver deduplicates same driver when literal and normalized mirror keys share the same path_id', async () => {
        vi.spyOn(service, 'waitForDriverIndex').mockResolvedValue({
            'jonas spätig': 'jonas spätig',
            'jonas spatig': 'jonas spatig'
        });

        vi.spyOn(service, '_loadDriverShard').mockResolvedValue({
            'jonas spätig': [
                { name: 'Jonas Spätig', path_id: '4057', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ],
            'jonas spatig': [
                { name: 'Jonas Spätig', path_id: '4057', Class: 5, track_id: 10, difficulty: 'Get Real' }
            ]
        });

        vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({
            'jonas spätig': [
                { name: 'Jonas Spätig', path_id: '4057', country: 'Switzerland', team: '', rank: 'C' }
            ],
            'jonas spatig': [
                { name: 'Jonas Spätig', path_id: '4057', country: 'Switzerland', team: '', rank: 'C' }
            ]
        });

        const result = await service.searchDriver('"Jonas Spätig"', { classId: 5, trackId: 10, difficulty: 'Get Real' });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            driver: 'Jonas Spätig',
            pathId: '4057',
            country: 'Switzerland',
            rank: 'C'
        });
        expect(result[0].entries).toHaveLength(1);
    });
});

describe('Extracted searchDriver helper methods', () => {
    let service;

    beforeEach(() => {
        service = new window.DataService();
        window.CARS_DATA = [];
    });

    describe('_parseSearchInput', () => {
        it('returns plain search context for unquoted input', () => {
            const ctx = service._parseSearchInput('Alice Smith');
            expect(ctx.searchTerm).toBe('Alice Smith');
            expect(ctx.searchLower).toBe('alice smith');
            expect(ctx.isExactSearch).toBe(false);
            expect(ctx.accentSearch).toBe(false);
            expect(ctx.exactAccentSearch).toBe(false);
            expect(ctx.partialAccentSearch).toBe(false);
            expect(ctx.accentSearchTerm).toBe('');
        });

        it('detects double-quoted exact search', () => {
            const ctx = service._parseSearchInput('"Alice Smith"');
            expect(ctx.searchTerm).toBe('Alice Smith');
            expect(ctx.isExactSearch).toBe(true);
            expect(ctx.accentSearch).toBe(false);
        });

        it('detects single-quoted exact search', () => {
            const ctx = service._parseSearchInput("'Bob'");
            expect(ctx.searchTerm).toBe('Bob');
            expect(ctx.isExactSearch).toBe(true);
        });

        it('detects accent search for accented input', () => {
            const ctx = service._parseSearchInput('José');
            expect(ctx.accentSearch).toBe(true);
            expect(ctx.partialAccentSearch).toBe(true);
            expect(ctx.exactAccentSearch).toBe(false);
            expect(ctx.accentSearchTerm).toBe('josé');
        });

        it('detects exact accent search for quoted accented input', () => {
            const ctx = service._parseSearchInput('"José"');
            expect(ctx.isExactSearch).toBe(true);
            expect(ctx.accentSearch).toBe(true);
            expect(ctx.exactAccentSearch).toBe(true);
            expect(ctx.partialAccentSearch).toBe(false);
        });

        it('trims whitespace from input', () => {
            const ctx = service._parseSearchInput('  Alice  ');
            expect(ctx.searchTerm).toBe('Alice');
        });
    });

    describe('_findMatchedMirrorKeys', () => {
        it('returns direct O(1) lookup matches for exact search', () => {
            const mirror = { 'alice smith': true, 'bob jones': true, 'alice jones': true };
            const ctx = service._parseSearchInput('"Alice Smith"');
            const keys = service._findMatchedMirrorKeys(mirror, ctx);
            expect(keys).toContain('alice smith');
            expect(keys).not.toContain('bob jones');
        });

        it('falls back to linear scan when no direct match in exact mode', () => {
            const mirror = { 'alice smith': true, 'bob smith': true };
            const ctx = service._parseSearchInput('"Smith"');
            const keys = service._findMatchedMirrorKeys(mirror, ctx);
            expect(keys).toContain('alice smith');
            expect(keys).toContain('bob smith');
        });

        it('returns substring matches for partial search', () => {
            const mirror = { 'alice smith': true, 'bob jones': true, 'alice jones': true };
            const ctx = service._parseSearchInput('alice');
            const keys = service._findMatchedMirrorKeys(mirror, ctx);
            expect(keys).toContain('alice smith');
            expect(keys).toContain('alice jones');
            expect(keys).not.toContain('bob jones');
        });

        it('returns empty array when no keys match', () => {
            const mirror = { 'alice smith': true };
            const ctx = service._parseSearchInput('zzz');
            const keys = service._findMatchedMirrorKeys(mirror, ctx);
            expect(keys).toHaveLength(0);
        });
    });

    describe('_capAndSortMirrorKeys', () => {
        it('returns keys unchanged when below the cap', () => {
            const keys = ['alice', 'bob', 'charlie'];
            const result = service._capAndSortMirrorKeys(keys, 'alice');
            expect(result).toEqual(['alice', 'bob', 'charlie']);
        });

        it('caps at 500 and prioritizes prefix matches', () => {
            const keys = [];
            for (let i = 0; i < 600; i++) {
                keys.push(`driver_${String(i).padStart(4, '0')}`);
            }
            keys.push('max_short');
            keys.push('max_longer_name');
            const result = service._capAndSortMirrorKeys(keys, 'max');
            expect(result).toHaveLength(500);
            expect(result[0]).toBe('max_short');
            expect(result[1]).toBe('max_longer_name');
        });
    });

    describe('_loadShardsForKeys', () => {
        it('loads shards and metadata for matched keys', async () => {
            vi.spyOn(service, '_getShardKeyForName').mockReturnValue('a');
            vi.spyOn(service, '_loadDriverShard').mockResolvedValue({ 'alice': [{ name: 'Alice' }] });
            vi.spyOn(service, '_loadDriverMetadataShard').mockResolvedValue({ 'alice': { name: 'Alice', country: 'SE' } });

            const ctx = await service._loadShardsForKeys(['alice']);
            expect(ctx.shardDataByKey.get('a')).toEqual({ 'alice': [{ name: 'Alice' }] });
            expect(ctx.metadataByKey.get('a')).toEqual({ 'alice': { name: 'Alice', country: 'SE' } });
        });

        it('provides lazy fallback loading', async () => {
            vi.spyOn(service, '_getShardKeyForName').mockReturnValue('a');
            vi.spyOn(service, '_loadDriverShard').mockImplementation(async (key) => {
                if (key === '_') return { 'special': [{ name: 'Special' }] };
                return {};
            });
            vi.spyOn(service, '_loadDriverMetadataShard').mockImplementation(async (key) => {
                if (key === '_') return { 'special': { name: 'Special' } };
                return {};
            });

            const ctx = await service._loadShardsForKeys(['alice']);
            // Fallback not loaded yet
            expect(ctx.getFallback().fallbackShard).toBeNull();
            // Trigger lazy load
            await ctx.ensureFallbackData();
            expect(ctx.getFallback().fallbackShard).toEqual({ 'special': [{ name: 'Special' }] });
        });
    });

    describe('_resolveDriverData', () => {
        it('resolves metadata and entries from primary shard', async () => {
            vi.spyOn(service, '_getShardKeyForName').mockReturnValue('a');
            const shardCtx = {
                shardDataByKey: new Map([['a', { 'alice smith': [{ name: 'Alice Smith', track_id: 10 }] }]]),
                metadataByKey: new Map([['a', { 'alice smith': { name: 'Alice Smith', country: 'SE' } }]]),
                ensureFallbackData: vi.fn(),
                getFallback: () => ({ fallbackShard: null, fallbackMetadata: null })
            };

            const result = await service._resolveDriverData('alice smith', shardCtx);
            expect(result.metaEntry).toEqual({ name: 'Alice Smith', country: 'SE' });
            expect(result.driverEntries).toEqual([{ name: 'Alice Smith', track_id: 10 }]);
        });

        it('falls back to _ shard when primary has no data', async () => {
            vi.spyOn(service, '_getShardKeyForName').mockReturnValue('o');
            const shardCtx = {
                shardDataByKey: new Map([['o', {}]]),
                metadataByKey: new Map([['o', {}]]),
                ensureFallbackData: vi.fn(),
                getFallback: () => ({
                    fallbackShard: { 'oscar': [{ name: 'Óscar', track_id: 5 }] },
                    fallbackMetadata: { 'oscar': { name: 'Óscar', country: 'Spain' } }
                })
            };

            const result = await service._resolveDriverData('oscar', shardCtx);
            expect(shardCtx.ensureFallbackData).toHaveBeenCalled();
            expect(result.metaEntry).toEqual({ name: 'Óscar', country: 'Spain' });
            expect(result.driverEntries).toEqual([{ name: 'Óscar', track_id: 5 }]);
        });
    });

    describe('_filterMetadataExact', () => {
        it('filters metadata candidates by exact word match', () => {
            const candidates = [
                { name: 'José López', path_id: '1' },
                { name: 'jose lopez', path_id: '2' }
            ];
            const ctx = service._parseSearchInput('"José"');
            const result = service._filterMetadataExact(candidates, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('José López');
        });

        it('returns empty when no candidates match', () => {
            const candidates = [{ name: 'Alice Smith', path_id: '1' }];
            const ctx = service._parseSearchInput('"Bob"');
            const result = service._filterMetadataExact(candidates, ctx);
            expect(result).toHaveLength(0);
        });

        it('falls back to folded matching for special european letters', () => {
            const candidates = [{ name: 'Bruno Bæ', path_id: '1' }];
            const ctx = service._parseSearchInput('"Bruno Bæ"');
            const result = service._filterMetadataExact(candidates, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Bruno Bæ');
        });
    });

    describe('_filterMetadataPartialAccent', () => {
        it('includes candidates whose name contains accented search term', () => {
            const candidates = [
                { name: 'José López', path_id: '1' },
                { name: 'jose plain', path_id: '2' }
            ];
            const ctx = service._parseSearchInput('José');
            const result = service._filterMetadataPartialAccent(candidates, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('José López');
        });

        it('uses folded matching for special european letters', () => {
            const candidates = [
                { name: 'Søren Hansen', path_id: '1' },
                { name: 'Sven Hansen', path_id: '2' }
            ];
            const ctx = service._parseSearchInput('Søren');
            const result = service._filterMetadataPartialAccent(candidates, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Søren Hansen');
        });
    });

    describe('_filterEntriesByPathIds', () => {
        it('filters entries to those matching allowed path_ids', () => {
            const entries = [
                { path_id: '100', track_id: 10 },
                { path_id: '200', track_id: 10 },
                { path_id: '300', track_id: 10 }
            ];
            const metaCandidates = [
                { path_id: '100' },
                { path_id: '300' }
            ];
            const result = service._filterEntriesByPathIds(entries, metaCandidates);
            expect(result).toHaveLength(2);
            expect(result.map(e => e.path_id)).toEqual(['100', '300']);
        });

        it('returns all entries when metadata has no path_ids', () => {
            const entries = [{ track_id: 10 }, { track_id: 11 }];
            const metaCandidates = [{ name: 'Alice' }];
            const result = service._filterEntriesByPathIds(entries, metaCandidates);
            expect(result).toHaveLength(2);
        });
    });

    describe('_filterLegacyEntriesExact', () => {
        it('filters entries by exact name match', () => {
            const entries = [
                { name: 'Alice Smith', track_id: 10 },
                { name: 'Alice Jones', track_id: 11 }
            ];
            const ctx = service._parseSearchInput('"Alice Smith"');
            const result = service._filterLegacyEntriesExact(entries, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alice Smith');
        });

        it('falls back to folded matching for european letters', () => {
            const entries = [
                { name: 'Bruno Bæ', track_id: 10 },
                { name: 'Bruno Bae', track_id: 11 }
            ];
            const ctx = service._parseSearchInput('"Bruno Bæ"');
            const result = service._filterLegacyEntriesExact(entries, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Bruno Bæ');
        });
    });

    describe('_filterLegacyEntriesPartialAccent', () => {
        it('filters entries whose name contains the accented term', () => {
            const entries = [
                { name: 'José López', track_id: 10 },
                { name: 'Joseph Martin', track_id: 11 }
            ];
            const ctx = service._parseSearchInput('José');
            const result = service._filterLegacyEntriesPartialAccent(entries, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('José López');
        });

        it('uses folded matching for special european letters', () => {
            const entries = [
                { name: 'Łukasz Nowak', track_id: 10 },
                { name: 'Luke Smith', track_id: 11 }
            ];
            const ctx = service._parseSearchInput('Łukasz');
            const result = service._filterLegacyEntriesPartialAccent(entries, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Łukasz Nowak');
        });
    });

    describe('_buildResultsForMirrorKey', () => {
        it('returns metadata-based results when metadata candidates exist', () => {
            const entries = [{ name: 'Alice', path_id: '100', track_id: 10 }];
            const metaEntry = { name: 'Alice Smith', path_id: '100', country: 'SE', team: 'A', rank: 'B' };
            const ctx = service._parseSearchInput('Alice');
            const result = service._buildResultsForMirrorKey(entries, metaEntry, 'alice smith', entries, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].driver).toBe('Alice Smith');
            expect(result[0].country).toBe('SE');
        });

        it('returns legacy results when no metadata exists', () => {
            const entries = [{ name: 'Alice Smith', country: 'SE', team: 'Alpha', track_id: 10 }];
            const ctx = service._parseSearchInput('Alice');
            const result = service._buildResultsForMirrorKey(entries, null, 'alice smith', entries, ctx);
            expect(result).toHaveLength(1);
            expect(result[0].driver).toBe('Alice Smith');
            expect(result[0].country).toBe('SE');
            expect(result[0].team).toBe('Alpha');
        });

        it('returns null for exact search when no metadata candidates match', () => {
            const entries = [{ name: 'Bob Jones', path_id: '100', track_id: 10 }];
            const metaEntry = { name: 'Bob Jones', path_id: '100', country: 'US' };
            const ctx = service._parseSearchInput('"Alice"');
            const result = service._buildResultsForMirrorKey(entries, metaEntry, 'bob jones', entries, ctx);
            expect(result).toBeNull();
        });

        it('returns null for exact legacy search when no entries match', () => {
            const entries = [{ name: 'Bob Jones', track_id: 10 }];
            const ctx = service._parseSearchInput('"Alice"');
            const result = service._buildResultsForMirrorKey(entries, null, 'bob jones', entries, ctx);
            expect(result).toBeNull();
        });
    });

    describe('_deduplicateResults', () => {
        it('merges results with the same pathId', () => {
            const results = [
                { driver: 'Alice', pathId: '100', country: 'SE', team: '', rank: '', entries: [{ track_id: 10, path_id: '100' }] },
                { driver: 'Alice', pathId: '100', country: '', team: 'Alpha', rank: 'A', entries: [{ track_id: 11, path_id: '100' }] }
            ];
            const deduped = service._deduplicateResults(results);
            expect(deduped).toHaveLength(1);
            expect(deduped[0].entries).toHaveLength(2);
            expect(deduped[0].country).toBe('SE');
            expect(deduped[0].team).toBe('Alpha');
            expect(deduped[0].rank).toBe('A');
        });

        it('keeps distinct results separate', () => {
            const results = [
                { driver: 'Alice', pathId: '100', country: 'SE', entries: [{ track_id: 10 }] },
                { driver: 'Bob', pathId: '200', country: 'US', entries: [{ track_id: 11 }] }
            ];
            const deduped = service._deduplicateResults(results);
            expect(deduped).toHaveLength(2);
        });

        it('deduplicates legacy results by driver+country+team', () => {
            const results = [
                { driver: 'Alice', country: 'SE', team: 'Alpha', entries: [{ track_id: 10, car_class: 'GT3', difficulty: 'Get Real', lap_time: '1:30' }] },
                { driver: 'Alice', country: 'SE', team: 'Alpha', entries: [{ track_id: 10, car_class: 'GT3', difficulty: 'Get Real', lap_time: '1:30' }] }
            ];
            const deduped = service._deduplicateResults(results);
            expect(deduped).toHaveLength(1);
            expect(deduped[0].entries).toHaveLength(1);
        });

        it('removes duplicate entries within a merged result', () => {
            const results = [
                { driver: 'Alice', pathId: '100', entries: [{ path_id: '100', track_id: 10, car_class: 'GT3', difficulty: 'X', lap_time: '1:30' }] },
                { driver: 'Alice', pathId: '100', entries: [{ path_id: '100', track_id: 10, car_class: 'GT3', difficulty: 'X', lap_time: '1:30' }] }
            ];
            const deduped = service._deduplicateResults(results);
            expect(deduped).toHaveLength(1);
            expect(deduped[0].entries).toHaveLength(1);
        });
    });
});
