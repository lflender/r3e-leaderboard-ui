import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CarRatings', () => {
    beforeAll(() => {
        // Provide empty CARS_DATA so the IIFE's migrateLegacyKeysAdditively() runs cleanly
        window.CARS_DATA = [];
        loadBrowserScript('modules/car-ratings.js');
    });

    beforeEach(() => {
        localStorage.clear();
        window.CARS_DATA = [];
    });

    // ── buildCarId ──────────────────────────────────────────────────

    describe('buildCarId', () => {
        test('returns empty string for falsy input', () => {
            expect(window.CarRatings.buildCarId(null)).toBe('');
            expect(window.CarRatings.buildCarId(undefined)).toBe('');
            expect(window.CarRatings.buildCarId('')).toBe('');
            expect(window.CarRatings.buildCarId(0)).toBe('');
        });

        test('trims and returns string input as-is', () => {
            expect(window.CarRatings.buildCarId('  some-id  ')).toBe('some-id');
        });

        test('builds structured ID from car object', () => {
            const car = { car_class: 'GT3', car: 'BMW M4 GT3', year: '2022', link: '/car/123' };
            expect(window.CarRatings.buildCarId(car)).toBe('GT3||BMW M4 GT3||2022||/car/123');
        });

        test('uses class alias', () => {
            const car = { class: 'GT4', car: 'Porsche 718', year: '2021', link: '/car/5' };
            expect(window.CarRatings.buildCarId(car)).toBe('GT4||Porsche 718||2021||/car/5');
        });

        test('handles missing fields gracefully', () => {
            const car = { car: 'McLaren 720S' };
            expect(window.CarRatings.buildCarId(car)).toBe('||McLaren 720S||||');
        });
    });

    // ── get / set ───────────────────────────────────────────────────

    describe('get and set', () => {
        test('returns 0 for unrated car', () => {
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(0);
        });

        test('stores and retrieves a star rating (1-5)', () => {
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', 4);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(4);
        });

        test('stores and retrieves a favorite (6)', () => {
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', 6);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(6);
        });

        test('clearing a rating (score=0) removes it', () => {
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', 3);
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', 0);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(0);
        });

        test('ignores invalid scores silently', () => {
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', 7);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(0);
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', -1);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(0);
        });

        test('accepts car object as argument', () => {
            const car = { car_class: 'GT3', car: 'BMW M4', year: '2022', link: '/car/1' };
            window.CarRatings.set(car, 5);
            expect(window.CarRatings.get(car)).toBe(5);
        });

        test('returns 0 for empty/null carId', () => {
            expect(window.CarRatings.get(null)).toBe(0);
            expect(window.CarRatings.get('')).toBe(0);
        });

        test('set does nothing for empty carId', () => {
            window.CarRatings.set('', 3);
            expect(localStorage.getItem(window.CarRatings.STORAGE_KEY)).toBeNull();
        });
    });

    // ── legacy link-based fallback ──────────────────────────────────

    describe('legacy link fallback', () => {
        test('get falls back to legacy link-only key', () => {
            const data = { '/car/1': 4 };
            localStorage.setItem(window.CarRatings.STORAGE_KEY, JSON.stringify(data));
            // Querying by structured ID with matching link should find legacy score
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(4);
        });
    });

    // ── getAll ───────────────────────────────────────────────────────

    describe('getAll', () => {
        test('returns empty array when no ratings exist', () => {
            expect(window.CarRatings.getAll()).toEqual([]);
        });

        test('returns all ratings sorted by score descending', () => {
            window.CarRatings.set('GT3||A||2022||/a', 2);
            window.CarRatings.set('GT3||B||2022||/b', 5);
            window.CarRatings.set('GT3||C||2022||/c', 6);
            const all = window.CarRatings.getAll();
            expect(all).toHaveLength(3);
            expect(all[0].score).toBe(6);
            expect(all[1].score).toBe(5);
            expect(all[2].score).toBe(2);
        });
    });

    // ── exportPayload ───────────────────────────────────────────────

    describe('exportPayload', () => {
        test('returns only valid structured entries', () => {
            window.CarRatings.set('GT3||A||2022||/a', 3);
            // Inject an invalid (non-structured) key directly
            const data = JSON.parse(localStorage.getItem(window.CarRatings.STORAGE_KEY));
            data['bad-key'] = 2;
            localStorage.setItem(window.CarRatings.STORAGE_KEY, JSON.stringify(data));

            const payload = window.CarRatings.exportPayload();
            expect(payload['GT3||A||2022||/a']).toBe(3);
            expect(payload['bad-key']).toBeUndefined();
        });

        test('returns empty object when no ratings', () => {
            expect(window.CarRatings.exportPayload()).toEqual({});
        });
    });

    // ── importPayload ───────────────────────────────────────────────

    describe('importPayload', () => {
        test('imports object payload and returns count', () => {
            const payload = {
                ratings: {
                    'GT3||A||2022||/a': 5,
                    'GT3||B||2022||/b': 3
                }
            };
            const count = window.CarRatings.importPayload(payload);
            expect(count).toBe(2);
            expect(window.CarRatings.get('GT3||A||2022||/a')).toBe(5);
        });

        test('imports JSON string payload', () => {
            const json = JSON.stringify({ 'GT3||A||2022||/a': 4 });
            window.CarRatings.importPayload(json);
            expect(window.CarRatings.get('GT3||A||2022||/a')).toBe(4);
        });

        test('throws on invalid payload', () => {
            expect(() => window.CarRatings.importPayload('not json')).toThrow();
            expect(() => window.CarRatings.importPayload(null)).toThrow();
        });

        test('imports legacy link-based keys when CARS_DATA is available', () => {
            window.CARS_DATA = [
                { cars: [{ car_class: 'GT3', car: 'BMW M4', year: '2022', link: '/car/1' }] }
            ];
            const payload = { '/car/1': 5 };
            window.CarRatings.importPayload(payload);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(5);
        });
    });

    // ── replaceAll ──────────────────────────────────────────────────

    describe('replaceAll', () => {
        test('replaces all ratings completely', () => {
            window.CarRatings.set('GT3||A||2022||/a', 3);
            window.CarRatings.replaceAll({ 'GT3||B||2022||/b': 5 });
            expect(window.CarRatings.get('GT3||A||2022||/a')).toBe(0);
            expect(window.CarRatings.get('GT3||B||2022||/b')).toBe(5);
        });

        test('filters out invalid scores', () => {
            window.CarRatings.replaceAll({ 'GT3||A||2022||/a': 7, 'GT3||B||2022||/b': 4 });
            expect(window.CarRatings.get('GT3||A||2022||/a')).toBe(0);
            expect(window.CarRatings.get('GT3||B||2022||/b')).toBe(4);
        });
    });

    // ── corrupted localStorage ──────────────────────────────────────

    describe('corrupted localStorage', () => {
        test('get returns 0 when localStorage contains invalid JSON', () => {
            localStorage.setItem(window.CarRatings.STORAGE_KEY, 'NOT-JSON');
            expect(window.CarRatings.get('GT3||A||2022||/a')).toBe(0);
        });

        test('getAll returns empty when localStorage contains an array', () => {
            localStorage.setItem(window.CarRatings.STORAGE_KEY, '[1,2,3]');
            expect(window.CarRatings.getAll()).toEqual([]);
        });
    });

    // ── normalizeCarName ────────────────────────────────────────────

    describe('normalizeCarName', () => {
        test('removes DTM word (case-insensitive)', () => {
            expect(window.CarRatings.normalizeCarName('BMW M3 DTM')).toBe('bmw m3');
            expect(window.CarRatings.normalizeCarName('BMW M3 dtm')).toBe('bmw m3');
            expect(window.CarRatings.normalizeCarName('DTM BMW M3')).toBe('bmw m3');
        });

        test('collapses extra spaces', () => {
            expect(window.CarRatings.normalizeCarName('BMW  M3   DTM')).toBe('bmw m3');
        });

        test('lowercases entire string', () => {
            expect(window.CarRatings.normalizeCarName('BMW M4 GT3')).toBe('bmw m4 gt3');
        });

        test('returns empty string for falsy input', () => {
            expect(window.CarRatings.normalizeCarName(null)).toBe('');
            expect(window.CarRatings.normalizeCarName('')).toBe('');
        });

        test('does not remove DTM as part of another word', () => {
            expect(window.CarRatings.normalizeCarName('ADTM Car')).toBe('adtm car');
        });
    });

    // ── sibling rating propagation ──────────────────────────────────

    describe('sibling rating propagation', () => {
        test('rating applies to all cars with same normalized name and year', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'DTM 95', car: 'BMW M3 DTM', year: '1995', link: '/car/1' },
                    { car_class: 'Group A', car: 'BMW M3', year: '1995', link: '/car/2' }
                ]}
            ];
            window.CarRatings.set('DTM 95||BMW M3 DTM||1995||/car/1', 4);
            expect(window.CarRatings.get('Group A||BMW M3||1995||/car/2')).toBe(4);
        });

        test('clearing rating clears all siblings', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'DTM 95', car: 'BMW M3 DTM', year: '1995', link: '/car/1' },
                    { car_class: 'Group A', car: 'BMW M3', year: '1995', link: '/car/2' }
                ]}
            ];
            window.CarRatings.set('DTM 95||BMW M3 DTM||1995||/car/1', 4);
            window.CarRatings.set('DTM 95||BMW M3 DTM||1995||/car/1', 0);
            expect(window.CarRatings.get('Group A||BMW M3||1995||/car/2')).toBe(0);
        });

        test('cars with different years are not siblings', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'DTM 95', car: 'BMW M3 DTM', year: '1995', link: '/car/1' },
                    { car_class: 'DTM 00', car: 'BMW M3 DTM', year: '2000', link: '/car/2' }
                ]}
            ];
            window.CarRatings.set('DTM 95||BMW M3 DTM||1995||/car/1', 5);
            expect(window.CarRatings.get('DTM 00||BMW M3 DTM||2000||/car/2')).toBe(0);
        });

        test('get falls back to sibling rating', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'DTM 95', car: 'BMW M3 DTM', year: '1995', link: '/car/1' },
                    { car_class: 'Group A', car: 'BMW M3', year: '1995', link: '/car/2' }
                ]}
            ];
            // Manually store rating for only one sibling
            const data = { 'DTM 95||BMW M3 DTM||1995||/car/1': 3 };
            localStorage.setItem(window.CarRatings.STORAGE_KEY, JSON.stringify(data));
            expect(window.CarRatings.get('Group A||BMW M3||1995||/car/2')).toBe(3);
        });

        test('casing differences are ignored for sibling matching', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'ClassA', car: 'bmw m3', year: '1995', link: '/car/1' },
                    { car_class: 'ClassB', car: 'BMW M3', year: '1995', link: '/car/2' }
                ]}
            ];
            window.CarRatings.set('ClassA||bmw m3||1995||/car/1', 2);
            expect(window.CarRatings.get('ClassB||BMW M3||1995||/car/2')).toBe(2);
        });

        test('spacing differences are ignored for sibling matching', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'ClassA', car: 'BMW  M3', year: '1995', link: '/car/1' },
                    { car_class: 'ClassB', car: 'BMW M3', year: '1995', link: '/car/2' }
                ]}
            ];
            window.CarRatings.set('ClassA||BMW  M3||1995||/car/1', 5);
            expect(window.CarRatings.get('ClassB||BMW M3||1995||/car/2')).toBe(5);
        });

        test('set with car object applies to siblings', () => {
            window.CARS_DATA = [
                { cars: [
                    { car_class: 'DTM 95', car: 'BMW M3 DTM', year: '1995', link: '/car/1' },
                    { car_class: 'Group A', car: 'BMW M3', year: '1995', link: '/car/2' }
                ]}
            ];
            const car = { car_class: 'DTM 95', car: 'BMW M3 DTM', year: '1995', link: '/car/1' };
            window.CarRatings.set(car, 6);
            expect(window.CarRatings.get('Group A||BMW M3||1995||/car/2')).toBe(6);
        });

        test('no CARS_DATA still works for direct rating', () => {
            window.CARS_DATA = undefined;
            window.CarRatings.set('GT3||BMW M4||2022||/car/1', 3);
            expect(window.CarRatings.get('GT3||BMW M4||2022||/car/1')).toBe(3);
        });
    });
});
