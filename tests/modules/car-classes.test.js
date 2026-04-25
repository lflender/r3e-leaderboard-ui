import { beforeAll, describe, expect, it } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/data/car-classes.js');
});

describe('CAR_CLASSES_DATA', () => {
    it('is defined on window', () => {
        expect(window.CAR_CLASSES_DATA).toBeDefined();
    });

    it('is a plain object', () => {
        expect(typeof window.CAR_CLASSES_DATA).toBe('object');
        expect(Array.isArray(window.CAR_CLASSES_DATA)).toBe(false);
    });

    it('has at least 10 entries', () => {
        expect(Object.keys(window.CAR_CLASSES_DATA).length).toBeGreaterThanOrEqual(10);
    });

    it('uses string keys', () => {
        Object.keys(window.CAR_CLASSES_DATA).forEach(key => {
            expect(typeof key).toBe('string');
        });
    });

    it('maps keys to non-empty string values', () => {
        Object.entries(window.CAR_CLASSES_DATA).forEach(([key, value]) => {
            expect(typeof value).toBe('string');
            expect(value.trim().length).toBeGreaterThan(0);
        });
    });

    it('contains well-known class names', () => {
        const values = Object.values(window.CAR_CLASSES_DATA);
        // GTR and GT3 are common classes in the data
        const hasGt3 = values.some(v => v.includes('GT3') || v.includes('GT 3') || v.toLowerCase().includes('gt3'));
        const hasGtr = values.some(v => v.includes('GTR') || v.toLowerCase().includes('gtr'));
        expect(hasGt3 || hasGtr).toBe(true);
    });
});
