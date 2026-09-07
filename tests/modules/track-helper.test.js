import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ETrackUtils', () => {
    beforeAll(() => {
        window.R3EUtils = {
            escapeHtml: value => String(value ?? '')
        };
        loadBrowserScript('modules/track-helper.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        window.TRACKS_DATA = [];
    });

    test('resolves track labels from TRACKS_DATA', () => {
        window.TRACKS_DATA = [{ id: 10, label: 'Spa - Grand Prix' }];

        expect(window.R3ETrackUtils.resolveTrackLabel(10)).toBe('Spa - Grand Prix');
        expect(window.R3ETrackUtils.resolveTrackLabelForItem({ track_id: 10 })).toBe('Spa - Grand Prix');
        expect(window.R3ETrackUtils.resolveTrackLabel(999, 'Fallback Track')).toBe('Fallback Track');
    });

    test('returns layouts and filters IDs for a selected layout', () => {
        window.TRACKS_DATA = [
            { id: 10, label: 'Donington Park - National' },
            { id: 11, label: 'Donington Park - Grand Prix' },
            { id: 20, label: 'Monza - Grand Prix' }
        ];

        expect(window.R3ETrackUtils.getTrackLayoutOptionsForFilterValue('10')).toEqual([
            { value: '10', label: 'National' },
            { value: '11', label: 'Grand Prix' }
        ]);
        expect(window.R3ETrackUtils.getTrackIdsForFilterValue('10')).toEqual(['10', '11']);
        expect(window.R3ETrackUtils.getTrackIdsForFilterValue('10', '11')).toEqual(['11']);
    });

    test('groups Adria International Raceway 2003 and 2021 by the shared base label', () => {
        window.TRACKS_DATA = [
            { id: 13352, label: 'Adria International Raceway 2003 - Full Circuit' },
            { id: 13425, label: 'Adria International Raceway 2021 - Full Circuit' }
        ];

        expect(window.R3ETrackUtils.getTrackBaseLabel(window.TRACKS_DATA[0].label))
            .toBe('Adria International Raceway');
        expect(window.R3ETrackUtils.getTrackBaseLabel(window.TRACKS_DATA[1].label))
            .toBe('Adria International Raceway');
        expect(window.R3ETrackUtils.getTrackIdsForFilterValue('13352'))
            .toEqual(['13352', '13425']);
    });
});
