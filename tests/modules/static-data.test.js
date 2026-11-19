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

    test('resolves renamed tracks and their layouts to the original metadata by ID', () => {
        const cases = [
            [[5301, 6164], 'anderstorp-motorbana'],
            [[2024, 12318], 'autodromo-fernanda-pires-da-silva'],
            [[1784, 1778, 1783, 1785], 'autodromo-internacional-do-algarve'],
            [[1850], 'autodromo-internazionale-enzo-e-dino-ferrari'],
            [[10463], 'autodromo-jose-carlos-pace'],
            [[10392, 10258, 9659, 12573], 'circuit-paul-armagnac'],
            [[2123], 'guia-circuit'],
            [[1846], 'mount-panorama-circuit']
        ];
        for (const [ids, urlPart] of cases) {
            for (const id of ids) {
                expect(window.TRACKS_META[id].url).toContain(urlPart);
                expect(window.TRACKS_META[id].description).toBeTruthy();
            }
        }
    });

    test('keeps metadata for historical track versions separate', () => {
        expect(window.TRACKS_META[12112].url).toContain('/2001/');
        expect(window.TRACKS_META[1693].url).toContain('/modern/');
        expect(window.TRACKS_META[13428].url).toContain('/1995/');
        expect(window.TRACKS_META[13256].url).toContain('/modern/');
        expect(window.TRACKS_META[13533].url).toContain('/1987/');
        expect(window.TRACKS_META[1856].url).toContain('/modern/');
    });

    test('includes the Glasbachrennen store link and description', () => {
        expect(window.TRACKS_META[13632]).toMatchObject({
            url: 'https://game.raceroomracing.com/store/tracks/glasbachrennen/glasbachrennen/13631',
            description: 'The Glasbachrennen climbs the L1027 through the Thuringian Forest from Steinbach, near Bad Liebenstein. It was first run in 1974, in what was then East Germany, and is now a round of the FIA European Hill Climb Championship. The RaceRoom road is just over 5 km long, narrow, and climbs 223 m through the forest. It was built for the final of the 2026 FIA Esports European Hill Climb Cup. In multiplayer each driver runs alone against the clock, with the others shown as ghosts.'
        });
        expect(window.TRACKS_META[13632].location).toBe('Bad Liebenstein, Germany');
        expect(window.TRACKS_META[13632].trackType).toBe('Hillclimb');
        expect(window.TRACKS_META[13632].opened).toBe('1974');
        expect(window.TRACKS_META[13632].racedHere).toBeUndefined();
    });

    test('includes the store details for Laguna Seca and its historic version', () => {
        expect(window.TRACKS_META[1856]).toMatchObject({
            location: 'Monterey, California, USA, United States',
            trackType: 'Road Course',
            opened: '1996',
            racedHere: 'IMSA GT Championship, American Le Mans Series, Mazda MX-5 Cup, IMSA and 4 more'
        });
        expect(window.TRACKS_META[13533]).toMatchObject({
            trackType: 'Road Course · historic',
            opened: '1957–1995',
            racedHere: 'IMSA GT Championship, Trans-Am'
        });
    });

    test('each track location resolves to a flag through the country helper', () => {
        loadBrowserScript('modules/data/country-mappings.js');
        loadBrowserScript('modules/flag-helper.js');
        for (const meta of new Set(Object.values(window.TRACKS_META))) {
            if (meta.location) {
                const country = meta.location.split(',').pop().trim();
                expect(window.FlagHelper.countryToFlag(country), meta.location).toContain('fi-');
            }
        }
    });

    test('metadata keys refer to known layout IDs and cover every available track group', () => {
        const ids = new Set(window.TRACKS_DATA.map(track => String(track.id)));
        expect(Object.keys(window.TRACKS_META).every(id => ids.has(id))).toBe(true);

        const noMetadata = window.TRACKS_DATA.filter(track => !window.TRACKS_META[track.id]);
        expect(noMetadata).toEqual([]);
    });
});
