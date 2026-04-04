import { describe, it, expect, beforeAll } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

beforeAll(() => {
    // field-mappings.js provides FIELD_NAMES and getField as globals
    loadBrowserScript('modules/field-mappings.js');
    loadBrowserScript('modules/data-normalizer.js');
});

// ---------------------------------------------------------------------------
// normalizeTrackName
// ---------------------------------------------------------------------------
describe('DataNormalizer.normalizeTrackName', () => {
    it('returns normal track names unchanged', () => {
        expect(window.DataNormalizer.normalizeTrackName('Spa-Francorchamps')).toBe('Spa-Francorchamps');
        expect(window.DataNormalizer.normalizeTrackName('Nürburgring')).toBe('Nürburgring');
    });

    it('fixes "Brands Hatch Grand Prix - Grand Prix" to canonical form', () => {
        expect(
            window.DataNormalizer.normalizeTrackName('Brands Hatch Grand Prix - Grand Prix')
        ).toBe('Brands Hatch - Grand Prix');
    });

    it('does not modify already-correct Brands Hatch – Grand Prix', () => {
        expect(
            window.DataNormalizer.normalizeTrackName('Brands Hatch - Grand Prix')
        ).toBe('Brands Hatch - Grand Prix');
    });

    it('fixes "Brands Hatch Indy - Indy" to canonical form', () => {
        expect(
            window.DataNormalizer.normalizeTrackName('Brands Hatch Indy - Indy')
        ).toBe('Brands Hatch - Indy');
    });

    it('does not modify already-correct Brands Hatch – Indy', () => {
        expect(
            window.DataNormalizer.normalizeTrackName('Brands Hatch - Indy')
        ).toBe('Brands Hatch - Indy');
    });

    it('returns null unchanged', () => {
        expect(window.DataNormalizer.normalizeTrackName(null)).toBeNull();
    });

    it('returns undefined unchanged', () => {
        expect(window.DataNormalizer.normalizeTrackName(undefined)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// normalizeLeaderboardEntry
// ---------------------------------------------------------------------------
describe('DataNormalizer.normalizeLeaderboardEntry', () => {
    it('uses entry.position when valid', () => {
        const entry = { position: 5, driver: { Name: 'Alice' } };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry, {}, 0, 10);
        expect(result.Position).toBe(5);
    });

    it('falls back to index+1 when entry.position is missing', () => {
        const entry = { driver: { Name: 'Bob' } };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry, {}, 2, 10);
        expect(result.Position).toBe(3);
    });

    it('extracts driver name from nested driver.Name', () => {
        const entry = { driver: { Name: 'Charlie' } };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry);
        expect(result.Name).toBe('Charlie');
    });

    it('extracts car class and car name from nested car_class', () => {
        const entry = {
            driver: { Name: 'Dana' },
            car_class: {
                class: { Name: 'GT3' },
                car: { Name: 'BMW M4 GT3' }
            }
        };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry);
        expect(result.CarClass).toBe('GT3');
        expect(result.Car).toBe('BMW M4 GT3');
    });

    it('extracts track info from parent data object', () => {
        const entry = { driver: { Name: 'Eve' } };
        const data = { track_info: { Name: 'Spa-Francorchamps', Id: 42 } };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry, data, 0, 0);
        expect(result.Track).toBe('Spa-Francorchamps');
        expect(result.TrackID).toBe(42);
    });

    it('propagates TotalEntries from the totalEntries argument', () => {
        const entry = { driver: { Name: 'Frank' } };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry, {}, 0, 999);
        expect(result.TotalEntries).toBe(999);
    });

    it('extracts class_id from entry', () => {
        const entry = { driver: { Name: 'Greta' }, class_id: 7 };
        const result = window.DataNormalizer.normalizeLeaderboardEntry(entry);
        expect(result.ClassID).toBe(7);
        expect(result.class_id).toBe(7);
    });
});

// ---------------------------------------------------------------------------
// Extract helpers
// ---------------------------------------------------------------------------
describe('DataNormalizer extract helpers', () => {
    it('extractName finds name across known field variations', () => {
        expect(window.DataNormalizer.extractName({ Name: 'Alice' })).toBe('Alice');
        expect(window.DataNormalizer.extractName({ name: 'Bob' })).toBe('Bob');
        expect(window.DataNormalizer.extractName({ DriverName: 'Carol' })).toBe('Carol');
        expect(window.DataNormalizer.extractName({})).toBe('-');
    });

    it('extractLapTime finds lap time across known field names', () => {
        expect(window.DataNormalizer.extractLapTime({ LapTime: '1:23.456' })).toBe('1:23.456');
        expect(window.DataNormalizer.extractLapTime({ 'Lap Time': '2:00.000' })).toBe('2:00.000');
        expect(window.DataNormalizer.extractLapTime({ lap_time: '0:58.999' })).toBe('0:58.999');
        expect(window.DataNormalizer.extractLapTime({})).toBe('-');
    });

    it('extractPosition finds position field', () => {
        expect(window.DataNormalizer.extractPosition({ Position: 1 })).toBe(1);
        expect(window.DataNormalizer.extractPosition({ Pos: 3 })).toBe(3);
        expect(window.DataNormalizer.extractPosition({})).toBe('-');
    });

    it('extractCountry defaults to empty string when missing', () => {
        expect(window.DataNormalizer.extractCountry({})).toBe('');
        expect(window.DataNormalizer.extractCountry({ Country: 'DE' })).toBe('DE');
    });

    it('extractRank returns nested rank.Name or rank.name', () => {
        expect(window.DataNormalizer.extractRank({ rank: { Name: 'Pro' } })).toBe('Pro');
        expect(window.DataNormalizer.extractRank({ rank: { name: 'Am' } })).toBe('Am');
        expect(window.DataNormalizer.extractRank({ Rank: 'Silver' })).toBe('Silver');
        expect(window.DataNormalizer.extractRank({})).toBe('');
    });

    it('extractTrackId and extractClassId pull from known field names', () => {
        expect(window.DataNormalizer.extractTrackId({ track_id: 55 })).toBe(55);
        expect(window.DataNormalizer.extractTrackId({ TrackID: 99 })).toBe(99);
        expect(window.DataNormalizer.extractTrackId({})).toBe('');

        expect(window.DataNormalizer.extractClassId({ class_id: 12 })).toBe(12);
        expect(window.DataNormalizer.extractClassId({ ClassID: 8 })).toBe(8);
        expect(window.DataNormalizer.extractClassId({})).toBe('');
    });

    it('extractDifficulty finds driving model field', () => {
        expect(window.DataNormalizer.extractDifficulty({ Difficulty: 'Real' })).toBe('Real');
        expect(window.DataNormalizer.extractDifficulty({ driving_model: 'Casual' })).toBe('Casual');
        expect(window.DataNormalizer.extractDifficulty({})).toBe('-');
    });

    it('extractDateTime finds date field variations', () => {
        expect(window.DataNormalizer.extractDateTime({ date_time: '2025-01-01' })).toBe('2025-01-01');
        expect(window.DataNormalizer.extractDateTime({ Date: '2025-06-15' })).toBe('2025-06-15');
        expect(window.DataNormalizer.extractDateTime({})).toBe('');
    });
});
