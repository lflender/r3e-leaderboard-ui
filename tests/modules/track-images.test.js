import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ETrackImages', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/track-images.js');
    });

    beforeEach(() => {
        window.TRACKS_DATA = [];
    });

    test('stores extracted logos by store slug', () => {
        expect(window.TRACK_LOGOS_BY_SLUG['adria-international-raceway-2003']).toBe(
            'images/tracks/VenueLogo_13748_on_dark_small.webp'
        );
        expect(window.TRACK_LOGOS_BY_SLUG['indianapolis-2012']).toBe(
            'images/tracks/VenueLogo_13746_on_dark_small.webp'
        );
    });

    test('resolves logos by local track labels including accented and alias cases', () => {
        expect(window.R3ETrackImages.resolveTrackLogoByLabel('Geller\u00e5sen Arena - Short Circuit')).toBe(
            'images/tracks/VenueLogo_13786_on_dark_small.webp'
        );
        expect(window.R3ETrackImages.resolveTrackLogoByLabel('V\u00e5lerbanen - Full Circuit')).toBe(
            'images/tracks/VenueLogo_13804_on_dark_small.webp'
        );
        expect(window.R3ETrackImages.resolveTrackLogoByLabel('Hockenheimring DMEC - DMEC')).toBe(
            'images/tracks/VenueLogo_13741_on_dark_small.webp'
        );
        expect(window.R3ETrackImages.resolveTrackLogoByLabel('Brands Hatch - Indy')).toBe(
            'images/tracks/VenueLogo_13743_on_dark_small.webp'
        );
        expect(window.R3ETrackImages.resolveTrackLogoByLabel('Brands Hatch')).toBe(
            'images/tracks/VenueLogo_13743_on_dark_small.webp'
        );
    });

    test('builds and resolves logos by track id using TRACKS_DATA labels', () => {
        window.TRACKS_DATA = [
            { id: 10274, label: 'Hockenheimring DMEC - DMEC' },
            { id: 9465, label: 'V\u00e5lerbanen - Full Circuit' }
        ];

        expect(window.R3ETrackImages.resolveTrackLogoById(10274)).toBe(
            'images/tracks/VenueLogo_13741_on_dark_small.webp'
        );
        expect(window.R3ETrackImages.buildTrackLogosById()).toEqual({
            '10274': 'images/tracks/VenueLogo_13741_on_dark_small.webp',
            '9465': 'images/tracks/VenueLogo_13804_on_dark_small.webp'
        });
    });
});

