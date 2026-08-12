import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ECarUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils.js');
        loadBrowserScript('modules/car-helper.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('splits car names including special cases', () => {
        expect(window.R3ECarUtils.splitCarName('Audi R8 LMS')).toEqual({ brand: 'Audi', model: 'R8 LMS' });
        expect(window.R3ECarUtils.splitCarName('E36 V8 JUDD')).toEqual({ brand: 'Georg Plasa', model: 'BMW E36 V8' });
        expect(window.R3ECarUtils.splitCarName('BMW E36 V8 JUDD')).toEqual({ brand: 'Georg Plasa', model: 'BMW E36 V8' });
        expect(window.R3ECarUtils.splitCarName('134 Judd V8')).toEqual({ brand: 'Georg Plasa', model: 'BMW 134 V8' });
        expect(window.R3ECarUtils.splitCarName('BMW 134 Judd V8')).toEqual({ brand: 'Georg Plasa', model: 'BMW 134 V8' });
        expect(window.R3ECarUtils.splitCarName('Carlsson SLK 340 JUDD')).toEqual({ brand: 'Carlsson', model: 'Mercedes SLK 340' });
        expect(window.R3ECarUtils.splitCarName('BMW Alpina B6 GT3')).toEqual({ brand: 'BMW Alpina', model: 'B6 GT3' });
        expect(window.R3ECarUtils.splitCarName('DTM Mercedes AMG C-Coupé')).toEqual({ brand: 'Mercedes-AMG', model: 'C-Coupé' });
        expect(window.R3ECarUtils.splitCarName('DTM Mercedes AMG C Coupe 14')).toEqual({ brand: 'Mercedes-AMG', model: 'C Coupe 14' });
    });

    test('resolves local brand logo paths from car names', () => {
        expect(window.R3ECarUtils.resolveBrandLogoPath('Audi R8 LMS')).toBe('images/brands/logo-audi.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('Alfa Romeo 155 V6 TI')).toBe('images/brands/logo-alfaromeo.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('McLaren 720S GT3')).toBe('images/brands/logo-mclaren.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('Lynk & Co 03 TCR')).toBe('images/brands/logo-lynk-co.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('134 Judd V8')).toBe('images/brands/logo-georg-plasa.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('BMW 134 Judd V8')).toBe('images/brands/logo-georg-plasa.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('E36 V8 JUDD')).toBe('images/brands/logo-georg-plasa.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('BMW E36 V8 JUDD')).toBe('images/brands/logo-georg-plasa.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('BMW Alpina B6 GT3')).toBe('images/brands/logo-alpina.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('DTM Mercedes AMG C-Coupé')).toBe('images/brands/logo-mercedes.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('')).toBe('images/brands/logo-raceroom.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('Some Unknown Brand Prototype')).toBe('images/brands/logo-raceroom.png');
    });

    test('resolves Corvette model override regardless of brand', () => {
        expect(window.R3ECarUtils.resolveBrandLogoPath('Chevrolet Corvette C6.R GT2')).toBe('images/brands/logo-corvette.png');
        expect(window.R3ECarUtils.resolveBrandLogoPath('Callaway Corvette C7 GT3-R')).toBe('images/brands/logo-corvette.png');
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

    /* ── badge helpers ───────────────────────────────────── */

    describe('wheelBadge', () => {
        test('returns correct badge for known types', () => {
            expect(window.R3ECarUtils.wheelBadge('gt')).toContain('car-badge--gt');
            expect(window.R3ECarUtils.wheelBadge('round')).toContain('car-badge--round');
            expect(window.R3ECarUtils.wheelBadge('round flat')).toContain('car-badge--round-flat');
            expect(window.R3ECarUtils.wheelBadge('round (flat)')).toContain('car-badge--round-flat');
        });

        test('returns unknown badge for empty or unrecognized', () => {
            expect(window.R3ECarUtils.wheelBadge('')).toContain('car-badge--unknown');
            expect(window.R3ECarUtils.wheelBadge('weird')).toContain('car-badge--unknown');
        });
    });

    describe('transBadge', () => {
        test('returns correct badge for known types', () => {
            expect(window.R3ECarUtils.transBadge('paddles')).toContain('car-badge--trans');
            expect(window.R3ECarUtils.transBadge('sequential')).toContain('car-badge--trans-sequential');
            expect(window.R3ECarUtils.transBadge('h')).toContain('car-badge--trans-h');
        });

        test('returns unknown badge for empty', () => {
            expect(window.R3ECarUtils.transBadge('')).toContain('car-badge--unknown');
        });
    });

    describe('driveBadge', () => {
        test('returns correct badge for known types', () => {
            expect(window.R3ECarUtils.driveBadge('RWD')).toContain('car-badge--drive-rwd');
            expect(window.R3ECarUtils.driveBadge('FWD')).toContain('car-badge--drive-fwd');
            expect(window.R3ECarUtils.driveBadge('4WD')).toContain('car-badge--drive-awd');
            expect(window.R3ECarUtils.driveBadge('AWD')).toContain('car-badge--drive-awd');
        });

        test('returns unknown badge for empty', () => {
            expect(window.R3ECarUtils.driveBadge('')).toContain('car-badge--unknown');
        });
    });

    /* ── yearBadgeColor ──────────────────────────────────── */

    describe('yearBadgeColor', () => {
        test('returns yellow for 1969', () => {
            expect(window.R3ECarUtils.yearBadgeColor('1969')).toBe('rgb(255,214,0)');
        });

        test('returns green for 2025', () => {
            expect(window.R3ECarUtils.yearBadgeColor('2025')).toBe('rgb(0,200,83)');
        });

        test('returns midpoint color for ~1997', () => {
            const color = window.R3ECarUtils.yearBadgeColor('1997');
            expect(color).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
            expect(color).not.toBe('rgb(255,214,0)');
            expect(color).not.toBe('rgb(0,200,83)');
        });

        test('returns fallback for invalid year', () => {
            expect(window.R3ECarUtils.yearBadgeColor('')).toBe('var(--color-badge-unknown-bg)');
            expect(window.R3ECarUtils.yearBadgeColor('abc')).toBe('var(--color-badge-unknown-bg)');
        });

        test('clamps years outside range', () => {
            expect(window.R3ECarUtils.yearBadgeColor('1960')).toBe('rgb(255,214,0)');
            expect(window.R3ECarUtils.yearBadgeColor('2030')).toBe('rgb(0,200,83)');
        });
    });

    /* ── car class logo resolution ───────────────────────── */

    describe('car class logo resolution', () => {
        beforeEach(() => {
            window.CARS_DATA = [{ class: 'GT3', logo: 'https://example.com/gt3-logo.png' }];
            window.CAR_CLASSES_DATA = { 1703: 'GT3' };
        });

        test('resolves class logos by name and id', () => {
            expect(window.R3ECarUtils.resolveCarClassLogoByName('GT3')).toBe('https://example.com/gt3-logo.png');
            expect(window.R3ECarUtils.resolveCarClassLogoById('1703')).toBe('https://example.com/gt3-logo.png');
            expect(window.R3ECarUtils.resolveCarClassLogo('GT3', '1703')).toBe('https://example.com/gt3-logo.png');
        });

        test('builds daily race class logo entries and html', () => {
            const logos = window.R3ECarUtils.resolveDailyRaceClassLogos(
                { category_class_ids: [1703] },
                classId => `Class ${classId}`,
                ''
            );
            expect(logos).toEqual([
                {
                    classId: '1703',
                    className: 'Class 1703',
                    logoUrl: 'https://example.com/gt3-logo.png'
                }
            ]);

            const html = window.R3ECarUtils.getDailyRaceClassLogosHtml(
                { category_class_ids: [1703] },
                classId => `Class ${classId}`,
                ''
            );
            expect(html).toContain('daily-race-class-logo');
            expect(html).toContain('https://example.com/gt3-logo.png');
            expect(html).toContain('Class 1703 class logo');
        });
    });

    /* ── car class logo by car name ──────────────────────── */

    describe('resolveCarClassLogoByCarName', () => {
        beforeEach(() => {
            window.CARS_DATA = [
                {
                    class: 'GT3',
                    logo: 'https://example.com/gt3-logo.png',
                    cars: [
                        { car: 'BMW M4 GT3' },
                        { car: 'Porsche 911 GT3 R' }
                    ]
                },
                {
                    class: 'TCR',
                    logo: 'https://example.com/tcr-logo.png',
                    cars: [
                        { car: 'Hyundai Elantra N TCR' }
                    ]
                }
            ];
        });

        test('resolves class logo from car name', () => {
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName('BMW M4 GT3')).toBe('https://example.com/gt3-logo.png');
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName('Porsche 911 GT3 R')).toBe('https://example.com/gt3-logo.png');
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName('Hyundai Elantra N TCR')).toBe('https://example.com/tcr-logo.png');
        });

        test('returns empty string for unknown car', () => {
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName('Unknown Car')).toBe('');
        });

        test('returns empty string for empty/falsy input', () => {
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName('')).toBe('');
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName(null)).toBe('');
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName(undefined)).toBe('');
        });

        test('handles class entry without cars array', () => {
            window.CARS_DATA = [{ class: 'GT3', logo: 'https://example.com/gt3-logo.png' }];
            expect(window.R3ECarUtils.resolveCarClassLogoByCarName('BMW M4 GT3')).toBe('');
        });
    });
});
