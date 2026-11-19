import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ETrackImages', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/track-images.js');
    });

    beforeEach(() => {
        window.TRACKS_DATA = [];
    });

    test('stores logos by track ID', () => {
        expect(window.TRACK_LOGOS_BY_ID['13352']).toBe(
            'images/tracks/VenueLogo_13748_on_dark_small.webp'
        );
        expect(window.TRACK_LOGOS_BY_ID['2014']).toBe(
            'images/tracks/VenueLogo_13746_on_dark_small.webp'
        );
        expect(window.TRACK_LOGOS_BY_SLUG).toBeUndefined();
    });

    test('resolves logos directly by ID without track-name data', () => {
        expect(window.R3ETrackImages.resolveTrackLogoById(' 5301 ')).toBe(
            'images/tracks/VenueLogo_13784_on_dark_small.webp'
        );
        expect(window.R3ETrackImages.resolveTrackLogoById('unknown')).toBe('');
        expect(window.R3ETrackImages.resolveTrackLogoById('')).toBe('');
        expect(window.R3ETrackImages.resolveTrackLogoByLabel).toBeUndefined();
    });

    test('maps every current track ID to a logo independent of its label', () => {
        loadBrowserScript('modules/data/tracks.js');
        expect(window.TRACKS_DATA.every(track =>
            window.R3ETrackImages.resolveTrackLogoById(track.id)
        )).toBe(true);
    });

    test('resolves logos for tracks whose labels were renamed', () => {
        window.TRACKS_DATA = [{ id: 5301, label: 'A renamed track name' }];
        expect(window.R3ETrackImages.resolveTrackLogoById(5301)).toBe(
            'images/tracks/VenueLogo_13784_on_dark_small.webp'
        );
    });
});

