import { beforeAll, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CARS_DATA', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/cars.js');
    });

    test('is exposed on window as an array', () => {
        expect(Array.isArray(window.CARS_DATA)).toBe(true);
        expect(window.CARS_DATA.length).toBeGreaterThan(0);
    });

    test('each entry has a class string (superclass is optional)', () => {
        for (const cls of window.CARS_DATA) {
            expect(typeof cls.class).toBe('string');
            expect(cls.class.length).toBeGreaterThan(0);
            if (cls.superclass !== undefined) {
                expect(typeof cls.superclass).toBe('string');
            }
        }
    });

    test('each entry has a non-empty cars array', () => {
        for (const cls of window.CARS_DATA) {
            expect(Array.isArray(cls.cars)).toBe(true);
            expect(cls.cars.length).toBeGreaterThan(0);
        }
    });

    test('each car has required properties', () => {
        for (const cls of window.CARS_DATA) {
            for (const car of cls.cars) {
                expect(typeof car.car).toBe('string');
                expect(car.car.length).toBeGreaterThan(0);
                expect(typeof car.car_class).toBe('string');
                expect(typeof car.year).toBe('string');
                expect(typeof car.link).toBe('string');
            }
        }
    });

    test('uses current Hillclimb power and driver-weight values', () => {
        const cars = window.CARS_DATA.flatMap(cls => cls.cars);
        const carlsson = cars.find(car => car.car === 'Carlsson SLK 340 JUDD');
        const judd = cars.find(car => car.car === 'BMW 134 Judd V8');

        expect(carlsson.power).toBe('581hp');
        expect(carlsson.weight).toBe('870kg*');
        expect(judd.power).toBe('542hp');
        expect(judd.weight).toBe('870kg*');
        expect(judd.link).toBe('https://game.raceroomracing.com/store/cars/hillclimb-icons/bmw-134-judd-v8/258');
        expect(cars.find(car => car.car === 'BMW E36 V8 JUDD')).toBeDefined();
    });

    test('car links are mostly unique (at most 1 known duplicate)', () => {
        const links = window.CARS_DATA.flatMap(cls => cls.cars.map(c => c.link));
        const uniqueLinks = new Set(links);
        // One known duplicate: Audi R8 LMS Ultra appears in two classes
        expect(links.length - uniqueLinks.size).toBeLessThanOrEqual(1);
    });
});

describe('TRACKS_DATA', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/tracks.js');
    });

    test('is exposed on window as an array', () => {
        expect(Array.isArray(window.TRACKS_DATA)).toBe(true);
        expect(window.TRACKS_DATA.length).toBeGreaterThan(0);
    });

    test('each track has id (number) and label (string)', () => {
        for (const track of window.TRACKS_DATA) {
            expect(typeof track.id).toBe('number');
            expect(typeof track.label).toBe('string');
            expect(track.label.length).toBeGreaterThan(0);
        }
    });

    test('no duplicate track ids', () => {
        const ids = window.TRACKS_DATA.map(t => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
});
