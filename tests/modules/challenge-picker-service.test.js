import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('ChallengePickerService', () => {
    beforeAll(() => {
        window.R3ETrackUtils = {
            resolveCarClassLogoByName: (name) => name ? `logo://${name}` : ''
        };
        window.R3ECarUtils = {
            resolveBrandLogoPath: (carName) => carName ? `brand://${carName}` : ''
        };
        window.R3ETrackImages = {
            resolveTrackLogoByLabel: (label) => label ? `track://${label}` : ''
        };
        loadBrowserScript('modules/challenge-picker-service.js');
    });

    beforeEach(() => {
        window.CARS_DATA = [];
        window.TRACKS_DATA = [];
        window.ChallengePickerService.history.clear();
    });

    const alwaysFirst = () => 0;        // always picks index 0
    const alwaysLast = (len) => {        // returns fn that picks last
        let callCount = 0;
        return () => {
            // Returns 0.999... so floor(0.999 * n) = n-1
            return 0.999;
        };
    };

    /* ── pickClass ───────────────────────────────────────── */

    describe('pickClass', () => {
        test('returns null for empty data', () => {
            const result = window.ChallengePickerService.pickClass(
                [], () => '', alwaysFirst
            );
            expect(result).toBeNull();
        });

        test('returns null for non-array data', () => {
            const result = window.ChallengePickerService.pickClass(
                null, () => '', alwaysFirst
            );
            expect(result).toBeNull();
        });

        test('picks class with logo', () => {
            const data = [
                { class: 'GT3', logo: 'http://gt3.png', cars: [] },
                { class: 'DTM 2023', logo: 'http://dtm.png', cars: [] }
            ];
            const resolve = (name) => `resolved://${name}`;
            const result = window.ChallengePickerService.pickClass(data, resolve, alwaysFirst);
            expect(result).toEqual({
                className: 'GT3',
                classLogo: 'resolved://GT3'
            });
        });

        test('uses randomFn to select index', () => {
            const data = [
                { class: 'A', cars: [] },
                { class: 'B', cars: [] },
                { class: 'C', cars: [] }
            ];
            // Return 0.5 → floor(0.5*3) = 1
            const result = window.ChallengePickerService.pickClass(data, () => '', () => 0.5);
            expect(result.className).toBe('B');
        });
    });

    /* ── pickCar ─────────────────────────────────────────── */

    describe('pickCar', () => {
        test('returns null for empty data', () => {
            expect(window.ChallengePickerService.pickCar([], () => '', () => '', alwaysFirst)).toBeNull();
        });

        test('picks car with all details', () => {
            const data = [
                {
                    class: 'GT3',
                    logo: 'http://gt3.png',
                    cars: [
                        { car: 'BMW M4 GT3', thumbnail: 'http://bmw.png' },
                        { car: 'Porsche 911 GT3 R', thumbnail: 'http://porsche.png' }
                    ]
                }
            ];
            const result = window.ChallengePickerService.pickCar(
                data,
                (name) => `class://${name}`,
                (carName) => `brand://${carName}`,
                alwaysFirst
            );
            expect(result).toEqual({
                className: 'GT3',
                classLogo: 'class://GT3',
                superclass: '',
                carName: 'BMW M4 GT3',
                brandLogo: 'brand://BMW M4 GT3',
                thumbnail: 'http://bmw.png',
                carData: { car: 'BMW M4 GT3', thumbnail: 'http://bmw.png' }
            });
        });

        test('handles class with empty cars array', () => {
            const data = [{ class: 'Empty Class', cars: [] }];
            const result = window.ChallengePickerService.pickCar(
                data, () => 'logo', () => '', alwaysFirst
            );
            expect(result.className).toBe('Empty Class');
            expect(result.carName).toBeNull();
        });

        test('handles class with no cars property', () => {
            const data = [{ class: 'No Cars' }];
            const result = window.ChallengePickerService.pickCar(
                data, () => '', () => '', alwaysFirst
            );
            expect(result.className).toBe('No Cars');
            expect(result.carName).toBeNull();
        });
    });

    /* ── groupTracksByBase ───────────────────────────────── */

    describe('groupTracksByBase', () => {
        test('groups tracks by base name before separator', () => {
            const tracks = [
                { id: 1, label: 'Spa - Grand Prix' },
                { id: 2, label: 'Spa - Moto' },
                { id: 3, label: 'Monza - Grand Prix' }
            ];
            const grouped = window.ChallengePickerService.groupTracksByBase(tracks);
            expect(grouped.size).toBe(2);
            expect(grouped.get('Spa')).toHaveLength(2);
            expect(grouped.get('Monza')).toHaveLength(1);
        });

        test('handles tracks without separator', () => {
            const tracks = [
                { id: 1, label: 'Imola' },
                { id: 2, label: 'Macau' }
            ];
            const grouped = window.ChallengePickerService.groupTracksByBase(tracks);
            expect(grouped.size).toBe(2);
            expect(grouped.get('Imola')).toHaveLength(1);
        });

        test('skips entries with empty labels', () => {
            const tracks = [
                { id: 1, label: '' },
                { id: 2, label: 'Spa - GP' }
            ];
            const grouped = window.ChallengePickerService.groupTracksByBase(tracks);
            expect(grouped.size).toBe(1);
        });
    });

    /* ── pickTrack ───────────────────────────────────────── */

    describe('pickTrack', () => {
        test('returns null for empty data', () => {
            expect(window.ChallengePickerService.pickTrack([], () => '', alwaysFirst)).toBeNull();
        });

        test('picks track base with equal probability', () => {
            const tracks = [
                { id: 1, label: 'Spa - Grand Prix' },
                { id: 2, label: 'Spa - Moto' },
                { id: 3, label: 'Spa - Classic' },
                { id: 4, label: 'Spa - Combined' },
                { id: 10, label: 'Monza - Grand Prix' }
            ];
            // With alwaysFirst (returns 0), picks first base alphabetically
            // Map iteration order is insertion order, so Spa comes first
            const result = window.ChallengePickerService.pickTrack(
                tracks, (label) => `logo://${label}`, alwaysFirst
            );
            expect(result.trackBase).toBe('Spa');
            expect(result.trackLogo).toBe('logo://Spa - Grand Prix');
        });

        test('each base track has equal chance regardless of layout count', () => {
            const tracks = [
                { id: 1, label: 'A - Layout 1' },
                { id: 2, label: 'A - Layout 2' },
                { id: 3, label: 'A - Layout 3' },
                { id: 10, label: 'B - Layout 1' }
            ];
            // With rng returning 0.5, floor(0.5 * 2) = 1 → picks 'B'
            const result = window.ChallengePickerService.pickTrack(
                tracks, () => '', () => 0.5
            );
            expect(result.trackBase).toBe('B');
        });
    });

    /* ── pickLayout ──────────────────────────────────────── */

    describe('pickLayout', () => {
        test('returns null for empty data', () => {
            expect(window.ChallengePickerService.pickLayout([], () => '', alwaysFirst)).toBeNull();
        });

        test('picks track then layout within it', () => {
            const tracks = [
                { id: 1, label: 'Spa - Grand Prix' },
                { id: 2, label: 'Spa - Moto' },
                { id: 10, label: 'Monza - Grand Prix' }
            ];
            const result = window.ChallengePickerService.pickLayout(
                tracks, (l) => `logo://${l}`, alwaysFirst
            );
            expect(result.trackBase).toBe('Spa');
            expect(result.layoutLabel).toBe('Grand Prix');
            expect(result.layoutId).toBe(1);
            expect(result.trackLogo).toBe('logo://Spa - Grand Prix');
        });

        test('selects second layout when randomFn returns 0.5', () => {
            const tracks = [
                { id: 1, label: 'Spa - Grand Prix' },
                { id: 2, label: 'Spa - Moto' }
            ];
            // First call picks base (only 1 base, so always Spa)
            // Second call picks layout: floor(0.5 * 2) = 1 → Moto
            const result = window.ChallengePickerService.pickLayout(
                tracks, () => '', () => 0.5
            );
            expect(result.layoutLabel).toBe('Moto');
            expect(result.layoutId).toBe(2);
        });

        test('layout without separator uses full label', () => {
            const tracks = [{ id: 42, label: 'Macau' }];
            const result = window.ChallengePickerService.pickLayout(
                tracks, () => '', alwaysFirst
            );
            expect(result.trackBase).toBe('Macau');
            expect(result.layoutLabel).toBe('Macau');
            expect(result.layoutId).toBe(42);
        });
    });

    /* ── history / no-repeat ─────────────────────────────── */

    describe('history', () => {
        test('pickClass avoids recently picked classes', () => {
            const data = [
                { class: 'A', cars: [] },
                { class: 'B', cars: [] },
                { class: 'C', cars: [] }
            ];
            // Always pick index 0; first call gets A
            const r1 = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r1.className).toBe('A');
            // Second call: A is excluded, candidates are [B, C], index 0 → B
            const r2 = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r2.className).toBe('B');
            // Third call: A,B excluded, candidates are [C], index 0 → C
            const r3 = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r3.className).toBe('C');
        });

        test('pickCar avoids recently picked car names', () => {
            const data = [
                {
                    class: 'GT3',
                    cars: [
                        { car: 'Car1', thumbnail: '' },
                        { car: 'Car2', thumbnail: '' },
                        { car: 'Car3', thumbnail: '' }
                    ]
                }
            ];
            const r1 = window.ChallengePickerService.pickCar(data, () => '', () => '', alwaysFirst);
            expect(r1.carName).toBe('Car1');
            const r2 = window.ChallengePickerService.pickCar(data, () => '', () => '', alwaysFirst);
            expect(r2.carName).toBe('Car2');
            const r3 = window.ChallengePickerService.pickCar(data, () => '', () => '', alwaysFirst);
            expect(r3.carName).toBe('Car3');
        });

        test('pickTrack avoids recently picked track bases', () => {
            const tracks = [
                { id: 1, label: 'Spa - GP' },
                { id: 2, label: 'Monza - GP' },
                { id: 3, label: 'Imola - GP' }
            ];
            const r1 = window.ChallengePickerService.pickTrack(tracks, () => '', alwaysFirst);
            expect(r1.trackBase).toBe('Spa');
            const r2 = window.ChallengePickerService.pickTrack(tracks, () => '', alwaysFirst);
            expect(r2.trackBase).toBe('Monza');
            const r3 = window.ChallengePickerService.pickTrack(tracks, () => '', alwaysFirst);
            expect(r3.trackBase).toBe('Imola');
        });

        test('pickLayout avoids recently picked track bases', () => {
            const tracks = [
                { id: 1, label: 'Spa - GP' },
                { id: 2, label: 'Spa - Moto' },
                { id: 10, label: 'Monza - GP' }
            ];
            const r1 = window.ChallengePickerService.pickLayout(tracks, () => '', alwaysFirst);
            expect(r1.trackBase).toBe('Spa');
            const r2 = window.ChallengePickerService.pickLayout(tracks, () => '', alwaysFirst);
            expect(r2.trackBase).toBe('Monza');
        });

        test('falls back to full list when single candidate is in history', () => {
            const data = [
                { class: 'Only', cars: [] }
            ];
            // Pick the only class twice; second call should still succeed
            const r1 = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r1.className).toBe('Only');
            const r2 = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r2.className).toBe('Only');
        });

        test('avoids back-to-back repeat when all candidates are in history', () => {
            const data = [
                { class: 'A', cars: [] },
                { class: 'B', cars: [] }
            ];
            // Fill history with both
            window.ChallengePickerService.pickClass(data, () => '', alwaysFirst); // A
            window.ChallengePickerService.pickClass(data, () => '', alwaysFirst); // B (A excluded)
            // Now both A and B are in history; next pick should avoid B (most recent)
            const r = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r.className).toBe('A');
        });

        test('history expires after 5 picks', () => {
            const data = [];
            for (let i = 0; i < 7; i++) {
                data.push({ class: `Class${i}`, cars: [] });
            }
            // Pick 6 times (always index 0, history excludes previous)
            for (let i = 0; i < 6; i++) {
                const r = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
                expect(r.className).toBe(`Class${i}`);
            }
            // 7th pick: history has [Class1..Class5] (Class0 expired), so Class0 is available again
            const r7 = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r7.className).toBe('Class0');
        });

        test('clear resets history', () => {
            const data = [
                { class: 'A', cars: [] },
                { class: 'B', cars: [] }
            ];
            window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(window.ChallengePickerService.history.keys('class')).toEqual(['A']);
            window.ChallengePickerService.history.clear();
            expect(window.ChallengePickerService.history.keys('class')).toEqual([]);
            // After clear, A is available again
            const r = window.ChallengePickerService.pickClass(data, () => '', alwaysFirst);
            expect(r.className).toBe('A');
        });

        test('separate categories do not interfere', () => {
            const classData = [
                { class: 'GT3', cars: [] },
                { class: 'DTM', cars: [] }
            ];
            const trackData = [
                { id: 1, label: 'GT3 - GP' },
                { id: 2, label: 'Monza - GP' }
            ];
            // Pick class "GT3"
            window.ChallengePickerService.pickClass(classData, () => '', alwaysFirst);
            // Track named "GT3" should still be available (different category)
            const t = window.ChallengePickerService.pickTrack(trackData, () => '', alwaysFirst);
            expect(t.trackBase).toBe('GT3');
        });
    });

    /* ── filterCarsData ──────────────────────────────────── */

    describe('filterCarsData', () => {
        const makeCar = (name, opts = {}) => ({
            car: name,
            wheel_cat: opts.wheel || 'round',
            transmission_cat: opts.trans || 'paddles',
            year: 'year' in opts ? opts.year : '2020',
            thumbnail: ''
        });

        const makeClass = (name, cars) => ({
            class: name,
            logo: '',
            cars
        });

        test('returns original data when no filters set', () => {
            const data = [makeClass('GT3', [makeCar('BMW')])];
            expect(window.ChallengePickerService.filterCarsData(data, {})).toEqual(data);
            expect(window.ChallengePickerService.filterCarsData(data, null)).toEqual(data);
            expect(window.ChallengePickerService.filterCarsData(data, { era: '', wheel: '', trans: '' })).toEqual(data);
        });

        test('filters by era modern (2016+)', () => {
            const data = [makeClass('Mixed', [
                makeCar('New', { year: '2020' }),
                makeCar('Old', { year: '1995' }),
                makeCar('Mid', { year: '2010' }),
                makeCar('Boundary', { year: '2015' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { era: 'modern' });
            expect(result).toHaveLength(1);
            expect(result[0].cars).toHaveLength(1);
            expect(result[0].cars[0].car).toBe('New');
        });

        test('filters by era recent (2000-2015)', () => {
            const data = [makeClass('Mixed', [
                makeCar('A', { year: '2000' }),
                makeCar('B', { year: '2015' }),
                makeCar('C', { year: '2016' }),
                makeCar('D', { year: '1999' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { era: 'recent' });
            expect(result[0].cars.map(c => c.car)).toEqual(['A', 'B']);
        });

        test('filters by era oldies (1969-1999)', () => {
            const data = [makeClass('Mixed', [
                makeCar('A', { year: '1969' }),
                makeCar('B', { year: '1999' }),
                makeCar('C', { year: '2000' }),
                makeCar('D', { year: '1968' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { era: 'oldies' });
            expect(result[0].cars.map(c => c.car)).toEqual(['A', 'B']);
        });

        test('filters by wheel type', () => {
            const data = [makeClass('GT3', [
                makeCar('A', { wheel: 'gt' }),
                makeCar('B', { wheel: 'round' }),
                makeCar('C', { wheel: 'round flat' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { wheel: 'gt' });
            expect(result[0].cars).toHaveLength(1);
            expect(result[0].cars[0].car).toBe('A');
        });

        test('filters by combined round_and_roundflat', () => {
            const data = [makeClass('GT3', [
                makeCar('A', { wheel: 'gt' }),
                makeCar('B', { wheel: 'round' }),
                makeCar('C', { wheel: 'round flat' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { wheel: 'round_and_roundflat' });
            expect(result[0].cars.map(c => c.car)).toEqual(['B', 'C']);
        });

        test('filters by transmission', () => {
            const data = [makeClass('GT3', [
                makeCar('A', { trans: 'paddles' }),
                makeCar('B', { trans: 'sequential' }),
                makeCar('C', { trans: 'h' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { trans: 'sequential' });
            expect(result[0].cars).toHaveLength(1);
            expect(result[0].cars[0].car).toBe('B');
        });

        test('combines multiple filters', () => {
            const data = [makeClass('Mixed', [
                makeCar('Modern+Paddles', { year: '2020', wheel: 'gt', trans: 'paddles' }),
                makeCar('Modern+H', { year: '2020', wheel: 'gt', trans: 'h' }),
                makeCar('Old+Paddles', { year: '1990', wheel: 'gt', trans: 'paddles' })
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { era: 'modern', trans: 'paddles' });
            expect(result[0].cars).toHaveLength(1);
            expect(result[0].cars[0].car).toBe('Modern+Paddles');
        });

        test('removes classes with no matching cars', () => {
            const data = [
                makeClass('AllOld', [makeCar('Old1', { year: '1990' })]),
                makeClass('AllNew', [makeCar('New1', { year: '2020' })])
            ];
            const result = window.ChallengePickerService.filterCarsData(data, { era: 'modern' });
            expect(result).toHaveLength(1);
            expect(result[0].class).toBe('AllNew');
        });

        test('returns empty array when nothing matches', () => {
            const data = [makeClass('GT3', [makeCar('A', { year: '2020' })])];
            const result = window.ChallengePickerService.filterCarsData(data, { era: 'oldies' });
            expect(result).toHaveLength(0);
        });

        test('cars with missing year are treated as modern', () => {
            const data = [makeClass('GT3', [
                makeCar('NoYear', { year: '' }),
                makeCar('HasYear', { year: '2020' })
            ])];
            const modern = window.ChallengePickerService.filterCarsData(data, { era: 'modern' });
            expect(modern[0].cars).toHaveLength(2);

            const oldies = window.ChallengePickerService.filterCarsData(data, { era: 'oldies' });
            expect(oldies).toHaveLength(0);
        });

        test('cars with missing transmission are treated as paddles', () => {
            const data = [makeClass('GT3', [
                makeCar('NoTrans', { trans: '' }),
                makeCar('Sequential', { trans: 'sequential' })
            ])];
            const paddles = window.ChallengePickerService.filterCarsData(data, { trans: 'paddles' });
            expect(paddles[0].cars).toHaveLength(1);
            expect(paddles[0].cars[0].car).toBe('NoTrans');

            const seq = window.ChallengePickerService.filterCarsData(data, { trans: 'sequential' });
            expect(seq[0].cars).toHaveLength(1);
            expect(seq[0].cars[0].car).toBe('Sequential');
        });

        test('filters by rating (unrated)', () => {
            window.CarRatings = {
                buildCarId: (car) => car.car,
                get: (id) => id === 'Rated3' ? 3 : 0
            };
            const data = [makeClass('GT3', [
                makeCar('Rated3'),
                makeCar('Unrated')
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { rating: '0' });
            expect(result[0].cars).toHaveLength(1);
            expect(result[0].cars[0].car).toBe('Unrated');
            delete window.CarRatings;
        });

        test('filters by rating (minimum stars)', () => {
            window.CarRatings = {
                buildCarId: (car) => car.car,
                get: (id) => ({ Low: 1, Mid: 3, High: 5 })[id] || 0
            };
            const data = [makeClass('GT3', [
                makeCar('Low'),
                makeCar('Mid'),
                makeCar('High')
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { rating: '3' });
            expect(result[0].cars.map(c => c.car)).toEqual(['Mid', 'High']);
            delete window.CarRatings;
        });

        test('filters by rating (favorites)', () => {
            window.CarRatings = {
                buildCarId: (car) => car.car,
                get: (id) => id === 'Fav' ? 6 : 5
            };
            const data = [makeClass('GT3', [
                makeCar('Fav'),
                makeCar('FiveStar')
            ])];
            const result = window.ChallengePickerService.filterCarsData(data, { rating: '6' });
            expect(result[0].cars).toHaveLength(1);
            expect(result[0].cars[0].car).toBe('Fav');
            delete window.CarRatings;
        });
    });
});
