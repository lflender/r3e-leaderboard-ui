import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('FilterOptionsService', () => {
    beforeEach(() => {
        delete window.FilterOptionsService;
        window.R3EUtils = {
            escapeHtml: s => String(s),
            resolveCarClassLogo: vi.fn().mockReturnValue(''),
            resolveCarClassLogoByName: vi.fn().mockReturnValue('')
        };
        window.R3ETrackImages = {
            resolveTrackLogoByLabel: vi.fn().mockReturnValue('')
        };
        window.CARS_DATA = [];
        window.TRACKS_DATA = [];
        window.getCarClassId = vi.fn().mockReturnValue(null);
        window.getCarClassName = vi.fn(id => id);
        loadBrowserScript('modules/filter-options-service.js');
    });

    // ── getClassOptionsFromCarsData ─────────────────────────────────

    describe('getClassOptionsFromCarsData', () => {
        test('returns empty array when CARS_DATA is missing', () => {
            delete window.CARS_DATA;
            expect(window.FilterOptionsService.getClassOptionsFromCarsData()).toEqual([]);
        });

        test('returns empty array when CARS_DATA is empty', () => {
            window.CARS_DATA = [];
            expect(window.FilterOptionsService.getClassOptionsFromCarsData()).toEqual([]);
        });

        test('filters out classes without leaderboard data', () => {
            window.CARS_DATA = [
                { class: 'GT3' },
                { class: 'Safety Car' }
            ];
            window.getCarClassId = vi.fn(name => name === 'GT3' ? 5 : null);

            const result = window.FilterOptionsService.getClassOptionsFromCarsData();
            expect(result).toEqual([
                { value: 'GT3', label: 'GT3', logoUrl: '' }
            ]);
        });

        test('deduplicates classes', () => {
            window.CARS_DATA = [
                { class: 'GT3' },
                { class: 'GT3' },
                { class: 'TCR' }
            ];
            window.getCarClassId = vi.fn(() => 1);

            const result = window.FilterOptionsService.getClassOptionsFromCarsData();
            expect(result).toHaveLength(2);
            expect(result[0].value).toBe('GT3');
            expect(result[1].value).toBe('TCR');
        });

        test('sorts alphabetically', () => {
            window.CARS_DATA = [
                { class: 'TCR' },
                { class: 'GT3' },
                { class: 'DTM' }
            ];
            window.getCarClassId = vi.fn(() => 1);

            const result = window.FilterOptionsService.getClassOptionsFromCarsData();
            expect(result.map(o => o.value)).toEqual(['DTM', 'GT3', 'TCR']);
        });

        test('resolves logo URLs', () => {
            window.CARS_DATA = [{ class: 'GT3' }];
            window.getCarClassId = vi.fn(() => 5);
            window.R3EUtils.resolveCarClassLogo = vi.fn().mockReturnValue('https://example.com/gt3.png');

            const result = window.FilterOptionsService.getClassOptionsFromCarsData();
            expect(result[0].logoUrl).toBe('https://example.com/gt3.png');
        });
    });

    // ── getTrackOptions ─────────────────────────────────────────────

    describe('getTrackOptions', () => {
        test('returns only "All tracks" when TRACKS_DATA is empty', () => {
            window.TRACKS_DATA = [];
            const result = window.FilterOptionsService.getTrackOptions();
            expect(result).toEqual([{ value: '', label: 'All tracks' }]);
        });

        test('returns "All tracks" when TRACKS_DATA is missing', () => {
            delete window.TRACKS_DATA;
            const result = window.FilterOptionsService.getTrackOptions();
            expect(result).toEqual([{ value: '', label: 'All tracks' }]);
        });

        test('includes tracks with string IDs and logo URLs', () => {
            window.TRACKS_DATA = [
                { id: 10, label: 'Spa' },
                { id: 20, label: 'Monza' }
            ];
            window.R3ETrackImages.resolveTrackLogoByLabel = vi.fn(label =>
                label === 'Spa' ? 'spa.png' : ''
            );

            const result = window.FilterOptionsService.getTrackOptions();
            expect(result).toHaveLength(3); // All tracks + 2
            expect(result[0]).toEqual({ value: '', label: 'All tracks' });
            expect(result[1]).toEqual({ value: '10', label: 'Spa', logoUrl: 'spa.png' });
            expect(result[2]).toEqual({ value: '20', label: 'Monza', logoUrl: '' });
        });
    });

    // ── getSuperclassOptions ────────────────────────────────────────

    describe('getSuperclassOptions', () => {
        test('returns empty array when CARS_DATA is missing', () => {
            delete window.CARS_DATA;
            expect(window.FilterOptionsService.getSuperclassOptions()).toEqual([]);
        });

        test('groups classes by superclass', () => {
            window.CARS_DATA = [
                { superclass: 'GT', class: 'GT3' },
                { superclass: 'GT', class: 'GT4' },
                { superclass: 'Touring', class: 'TCR' }
            ];

            const result = window.FilterOptionsService.getSuperclassOptions();
            expect(result).toHaveLength(2);

            const gt = result.find(o => o.value === 'superclass:GT');
            expect(gt.classes).toEqual(['GT3', 'GT4']);
            expect(gt.label).toBe('GT');

            const touring = result.find(o => o.value === 'superclass:Touring');
            expect(touring.classes).toEqual(['TCR']);
        });

        test('skips entries without superclass', () => {
            window.CARS_DATA = [
                { class: 'GT3' }, // no superclass
                { superclass: 'GT', class: 'GT4' }
            ];

            const result = window.FilterOptionsService.getSuperclassOptions();
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe('superclass:GT');
        });

        test('collects unique logo URLs per superclass', () => {
            window.CARS_DATA = [
                { superclass: 'GT', class: 'GT3' },
                { superclass: 'GT', class: 'GT4' }
            ];
            window.R3EUtils.resolveCarClassLogoByName = vi.fn(cls =>
                cls === 'GT3' ? 'gt3.png' : 'gt4.png'
            );

            const result = window.FilterOptionsService.getSuperclassOptions();
            expect(result[0].logos).toEqual(['gt3.png', 'gt4.png']);
        });

        test('deduplicates logo URLs within a superclass', () => {
            window.CARS_DATA = [
                { superclass: 'GT', class: 'GT3' },
                { superclass: 'GT', class: 'GT3 2024' }
            ];
            window.R3EUtils.resolveCarClassLogoByName = vi.fn().mockReturnValue('shared.png');

            const result = window.FilterOptionsService.getSuperclassOptions();
            expect(result[0].logos).toEqual(['shared.png']);
        });

        test('sorts alphabetically by label', () => {
            window.CARS_DATA = [
                { superclass: 'Touring', class: 'TCR' },
                { superclass: 'GT', class: 'GT3' }
            ];

            const result = window.FilterOptionsService.getSuperclassOptions();
            expect(result[0].label).toBe('GT');
            expect(result[1].label).toBe('Touring');
        });
    });

    // ── getCategoryOptionsForClassIds ────────────────────────────────

    describe('getCategoryOptionsForClassIds', () => {
        test('returns empty array for fewer than 2 class IDs', () => {
            expect(window.FilterOptionsService.getCategoryOptionsForClassIds([])).toEqual([]);
            expect(window.FilterOptionsService.getCategoryOptionsForClassIds(['1'])).toEqual([]);
        });

        test('returns empty when all classes belong to same superclass', () => {
            window.CARS_DATA = [
                { class: 'GT3', superclass: 'GT' },
                { class: 'GT4', superclass: 'GT' }
            ];
            window.getCarClassName = vi.fn(id => id === '1' ? 'GT3' : 'GT4');

            const result = window.FilterOptionsService.getCategoryOptionsForClassIds(['1', '2']);
            expect(result).toEqual([]);
        });

        test('groups class IDs by superclass when 2+ categories exist', () => {
            window.CARS_DATA = [
                { class: 'GT3', superclass: 'GT' },
                { class: 'TCR', superclass: 'Touring' }
            ];
            window.getCarClassName = vi.fn(id => id === '5' ? 'GT3' : 'TCR');

            const result = window.FilterOptionsService.getCategoryOptionsForClassIds(['5', '8']);
            expect(result).toHaveLength(2);

            const gt = result.find(o => o.value === 'CATEGORY:GT');
            expect(gt.label).toBe('GT');
            expect(gt.classNames).toEqual([{ classId: '5', className: 'GT3' }]);

            const touring = result.find(o => o.value === 'CATEGORY:Touring');
            expect(touring.classNames).toEqual([{ classId: '8', className: 'TCR' }]);
        });

        test('falls back to className as superclass when no CARS_DATA match', () => {
            window.CARS_DATA = [];
            window.getCarClassName = vi.fn(id => `Class_${id}`);

            const result = window.FilterOptionsService.getCategoryOptionsForClassIds(['1', '2']);
            expect(result).toHaveLength(2);
            expect(result[0].value).toBe('CATEGORY:Class_1');
            expect(result[1].value).toBe('CATEGORY:Class_2');
        });

        test('collects unique logos per category', () => {
            window.CARS_DATA = [
                { class: 'GT3', superclass: 'GT' },
                { class: 'TCR', superclass: 'Touring' }
            ];
            window.getCarClassName = vi.fn(id => id === '5' ? 'GT3' : 'TCR');
            window.R3EUtils.resolveCarClassLogo = vi.fn((name, id) =>
                name === 'GT3' ? 'gt3.png' : 'tcr.png'
            );

            const result = window.FilterOptionsService.getCategoryOptionsForClassIds(['5', '8']);
            const gt = result.find(o => o.value === 'CATEGORY:GT');
            expect(gt.logos).toEqual(['gt3.png']);
        });
    });
});
