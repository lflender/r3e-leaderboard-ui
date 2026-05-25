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
});
