import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

describe('table-renderer track resolution', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils.js');
        loadBrowserScript('modules/field-mappings.js');
        loadBrowserScript('modules/column-config.js');
        loadBrowserScript('modules/table-renderer.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        window.TRACKS_DATA = [
            { id: 10, label: 'Spa - Grand Prix' },
            { id: 20, label: 'Zolder - Grand Prix' }
        ];
        window.DataNormalizer = { normalizeTrackName: value => value };
        window.FlagHelper = { countryToFlag: () => '' };
        window.resolveMpPos = undefined;
        window.getMpPosNameClasses = undefined;
    });

    test('renders the track column from track_id when the track field is absent', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Alice',
                country: 'SE',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', track_id: '10', car_class: 'GT3' }]
            }
        ], ['track', 'position'], 'track');

        expect(html).toContain('Spa');
        expect(html).toContain('Grand Prix');
        expect(html).toContain('data-trackid="10"');
    });

    test('sorts by resolved track label instead of a raw track field', () => {
        const entries = [
            { position: '2', lap_time: '1:31.000', track_id: '20' },
            { position: '1', lap_time: '1:30.000', track_id: '10' }
        ];

        window.tableRenderer.sortDriverEntries(entries, 'track');

        expect(entries.map(entry => entry.track_id)).toEqual(['10', '20']);
    });
});