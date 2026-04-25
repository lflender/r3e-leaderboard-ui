import { beforeAll, describe, expect, it } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/data/car-images.js');
});

describe('CAR_IMAGES_BY_LINK', () => {
    it('is defined on window', () => {
        expect(window.CAR_IMAGES_BY_LINK).toBeDefined();
    });

    it('is a plain object', () => {
        expect(typeof window.CAR_IMAGES_BY_LINK).toBe('object');
        expect(Array.isArray(window.CAR_IMAGES_BY_LINK)).toBe(false);
    });

    it('has at least 1 entry', () => {
        expect(Object.keys(window.CAR_IMAGES_BY_LINK).length).toBeGreaterThan(0);
    });

    it('uses store URL strings as keys', () => {
        Object.keys(window.CAR_IMAGES_BY_LINK).forEach(key => {
            expect(typeof key).toBe('string');
            expect(key).toMatch(/^https?:\/\//);
        });
    });

    it('maps keys to arrays of image URL strings', () => {
        Object.values(window.CAR_IMAGES_BY_LINK).forEach(images => {
            expect(Array.isArray(images)).toBe(true);
            expect(images.length).toBeGreaterThan(0);
            images.forEach(url => {
                expect(typeof url).toBe('string');
                expect(url).toMatch(/^https?:\/\//);
            });
        });
    });

    it('image URLs end with a recognised image extension or pattern', () => {
        const allUrls = Object.values(window.CAR_IMAGES_BY_LINK).flat();
        const imagePattern = /\.(png|jpg|jpeg|webp|gif)(-\w+)?$/i;
        const hasImageUrls = allUrls.some(url => imagePattern.test(url));
        expect(hasImageUrls).toBe(true);
    });

    it('all image arrays contain strings with no empty entries', () => {
        Object.values(window.CAR_IMAGES_BY_LINK).forEach(images => {
            images.forEach(url => {
                expect(url.trim().length).toBeGreaterThan(0);
            });
        });
    });
});
