import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ECarUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils-car.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('splits car names including special cases', () => {
        expect(window.R3ECarUtils.splitCarName('Audi R8 LMS')).toEqual({ brand: 'Audi', model: 'R8 LMS' });
        expect(window.R3ECarUtils.splitCarName('E36 V8 JUDD')).toEqual({ brand: 'Judd', model: 'E36 V8' });
    });

    test('detects year and DTM suffixes', () => {
        expect(window.R3ECarUtils.detectYearSuffix('BMW M4 GT3 2023')).toEqual({
            baseName: 'BMW M4 GT3',
            year: '2023'
        });
        expect(window.R3ECarUtils.detectYearSuffix('BMW M4 GT3')).toBeNull();
        expect(window.R3ECarUtils.detectDTMSuffix('Audi TT RS DTM')).toEqual({
            baseName: 'Audi TT RS'
        });
        expect(window.R3ECarUtils.detectDTMSuffix('Audi TT RS')).toBeNull();
    });

    test('builds combination options for year and DTM variants', () => {
        const cars = [
            'Audi TT RS',
            'Audi TT RS DTM',
            'BMW M4 GT3',
            'BMW M4 GT3 2023',
            'BMW M4 GT3 2024'
        ];

        expect(window.R3ECarUtils.findCarCombinations(cars)).toEqual([
            { value: 'COMBINED_DTM:Audi TT RS', label: 'Combined: Audi TT RS + DTM' },
            { value: 'COMBINED_YEAR:BMW M4 GT3', label: 'Combined: BMW M4 GT3' }
        ]);
    });

    test('finds combination placement and matching rules', () => {
        const combinations = [
            { value: 'COMBINED_DTM:Audi TT RS', label: 'Combined: Audi TT RS + DTM' },
            { value: 'COMBINED_YEAR:BMW M4 GT3', label: 'Combined: BMW M4 GT3' }
        ];

        expect(window.R3ECarUtils.findCombinationForCar('Audi TT RS DTM', combinations)).toEqual(combinations[0]);
        expect(window.R3ECarUtils.findCombinationForCar('BMW M4 GT3 2024', combinations)).toEqual(combinations[1]);
        expect(window.R3ECarUtils.findCombinationForCar('BMW M4 GT3', combinations)).toEqual(combinations[1]);

        const groupedCars = ['BMW M4 GT3', 'BMW M4 GT3 2023', 'BMW M4 GT3 2024'];
        expect(window.R3ECarUtils.isLastInCarGroup('BMW M4 GT3', groupedCars, 0)).toBe(false);
        expect(window.R3ECarUtils.isLastInCarGroup('BMW M4 GT3 2024', groupedCars, 2)).toBe(true);

        expect(window.R3ECarUtils.matchesCarFilterValue('Audi TT RS', 'COMBINED_DTM:Audi TT RS')).toBe(true);
        expect(window.R3ECarUtils.matchesCarFilterValue('Audi TT RS DTM', 'COMBINED_DTM:Audi TT RS')).toBe(true);
        expect(window.R3ECarUtils.matchesCarFilterValue('BMW M4 GT3 2023', 'COMBINED_YEAR:BMW M4 GT3')).toBe(true);
        expect(window.R3ECarUtils.matchesCarFilterValue('Ferrari 296 GT3', 'COMBINED_YEAR:BMW M4 GT3')).toBe(false);
    });
});
