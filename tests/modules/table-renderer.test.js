import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('table-renderer track resolution', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils-car.js');
        loadBrowserScript('modules/utils-time.js');
        loadBrowserScript('modules/utils-track.js');
        loadBrowserScript('modules/utils-url.js');
        loadBrowserScript('modules/utils.js');
        loadBrowserScript('modules/field-mappings.js');
        loadBrowserScript('modules/column-config.js');
        loadBrowserScript('modules/table-sort-service.js');
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

    test('renders car class logo in car class cells when logo mapping exists', () => {
        window.CARS_DATA = [
            { class: 'GT3', logo: 'https://example.com/gt3-logo.png' }
        ];

        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Bob',
                country: 'DE',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', car_class: 'GT3', class_id: '1703' }]
            }
        ], ['car_class'], 'gap');

        expect(html).toContain('table-car-class-logo');
        expect(html).toContain('https://example.com/gt3-logo.png');
        expect(html).toContain('GT3');
    });
});
