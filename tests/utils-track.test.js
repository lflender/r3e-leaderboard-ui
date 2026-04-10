import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

describe('R3ETrackUtils', () => {
    beforeAll(() => {
        window.R3EUtils = {
            escapeHtml: value => String(value ?? '')
        };
        loadBrowserScript('modules/utils-track.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        window.TRACKS_DATA = [];
        window.CARS_DATA = [];
        window.CAR_CLASSES_DATA = {};
    });

    test('resolves track labels from TRACKS_DATA', () => {
        window.TRACKS_DATA = [{ id: 10, label: 'Spa - Grand Prix' }];

        expect(window.R3ETrackUtils.resolveTrackLabel(10)).toBe('Spa - Grand Prix');
        expect(window.R3ETrackUtils.resolveTrackLabelForItem({ track_id: 10 })).toBe('Spa - Grand Prix');
        expect(window.R3ETrackUtils.resolveTrackLabel(999, 'Fallback Track')).toBe('Fallback Track');
    });

    test('resolves class logos by name and id', () => {
        window.CARS_DATA = [{ class: 'GT3', logo: 'https://example.com/gt3-logo.png' }];
        window.CAR_CLASSES_DATA = { 1703: 'GT3' };

        expect(window.R3ETrackUtils.resolveCarClassLogoByName('GT3')).toBe('https://example.com/gt3-logo.png');
        expect(window.R3ETrackUtils.resolveCarClassLogoById('1703')).toBe('https://example.com/gt3-logo.png');
        expect(window.R3ETrackUtils.resolveCarClassLogo('GT3', '1703')).toBe('https://example.com/gt3-logo.png');
    });

    test('builds daily race class logo entries and html', () => {
        window.CARS_DATA = [{ class: 'GT3', logo: 'https://example.com/gt3-logo.png' }];
        window.CAR_CLASSES_DATA = { 1703: 'GT3' };

        const logos = window.R3ETrackUtils.resolveDailyRaceClassLogos(
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

        const html = window.R3ETrackUtils.getDailyRaceClassLogosHtml(
            { category_class_ids: [1703] },
            classId => `Class ${classId}`,
            ''
        );
        expect(html).toContain('daily-race-class-logo');
        expect(html).toContain('https://example.com/gt3-logo.png');
        expect(html).toContain('Class 1703 class logo');
    });
});