import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('table-renderer track resolution', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/track-images.js');
        loadBrowserScript('modules/car-helper.js');
        loadBrowserScript('modules/time-helper.js');
        loadBrowserScript('modules/track-helper.js');
        loadBrowserScript('modules/url-helper.js');
        loadBrowserScript('modules/utils.js');
        loadBrowserScript('modules/field-mappings.js');
        loadBrowserScript('modules/column-config.js');
        loadBrowserScript('modules/sort-service.js');
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
        window.resolveMpPosWithInactive = undefined;
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

    test('calculates grouped lap percentages from each entry gap, not another track entry', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Alice',
                country: 'SE',
                team: '',
                entries: [
                    { position: 1, LapTime: '1:30.000', track_id: '10' },
                    { position: 2, LapTime: '1:31.000, +1.000s', track_id: '20' }
                ]
            }
        ], ['GapPercent'], 'gap');

        expect(html).toContain('>-</td>');
        expect(html).toContain('>101.1%</td>');
    });

    test('renders a track logo before the resolved track label when a mapping exists', () => {
        window.TRACKS_DATA = [
            { id: 1852, label: 'Indianapolis 2012 - Grand Prix' }
        ];

        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Alice',
                country: 'SE',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', track_id: '1852', car_class: 'GT3' }]
            }
        ], ['track'], 'track');

        expect(html).toContain('table-track-logo');
        expect(html).toContain('images/tracks/indianapolis-2012-1851-logo-original.png');
        expect(html).toContain('Indianapolis 2012');
    });

    test('sorts by resolved track label instead of a raw track field', () => {
        const entries = [
            { position: '2', lap_time: '1:31.000', track_id: '20' },
            { position: '1', lap_time: '1:30.000', track_id: '10' }
        ];

        window.tableRenderer.sortDriverEntries(entries, 'track');

        expect(entries.map(entry => entry.track_id)).toEqual(['10', '20']);
    });

    test('renders new backend lap times in actual ascending order', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([{
            driver: 'Alice',
            entries: [
                { position: 1, laptime: '0:56.543', track_id: '10' },
                { position: 1, laptime: '1:05.103', track_id: '20' },
                { position: 1, laptime: '0:31.738', track_id: '30' }
            ]
        }], ['laptime'], 'lapTime');
        const table = document.createElement('table');
        table.innerHTML = html;

        expect(Array.from(table.querySelectorAll('tr.driver-data-row'), row =>
            row.getAttribute('data-time')
        )).toEqual(['0:31.738', '0:56.543', '1:05.103']);
    });

    test('sorts Lap % numerically and places unavailable percentages last', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([{
            driver: 'Alice',
            entries: [
                { position: 2, laptime: '1:31.000, +1.000s', track_id: '10' },
                { position: 3, laptime: '1:30.500, +0.500s', track_id: '20' },
                { position: 1, laptime: '1:30.000', track_id: '30' }
            ]
        }], ['GapPercent'], 'gapPercent');
        const table = document.createElement('table');
        table.innerHTML = html;

        expect(Array.from(table.querySelectorAll('tr.driver-data-row'), row =>
            row.getAttribute('data-time')
        )).toEqual(['1:30.000', '1:30.500, +0.500s', '1:31.000, +1.000s']);
    });

    test('shows the next gap/lap-time sort action in the header tooltip', () => {
        const gapHeader = window.tableRenderer.renderHeaderCell('laptime', 'gap');
        const lapHeader = window.tableRenderer.renderHeaderCell('laptime', 'lapTime');
        const percentHeader = window.tableRenderer.renderHeaderCell('laptime', 'gapPercent');

        expect(gapHeader).toContain('title="Click to sort by lap time"');
        expect(lapHeader).toContain('title="Click to sort by gap time"');
        expect(percentHeader).toContain('title="Click to sort by gap time"');
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

    test('renders brand logo before car name in car cells', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Chris',
                country: 'SE',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', car: 'Audi R8 LMS' }]
            }
        ], ['car'], 'gap');

        expect(html).toContain('table-brand-logo');
        expect(html).toContain('images/brands/logo-audi.png');
        expect(html).toContain('Audi');
    });

    test('renders driver avatar in group header before the name when available', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Kostya Guzyuk',
                country: 'Ukraine',
                team: '',
                avatar: 'https://game.raceroom.com/assets/user-avatars/helmets/helmet-8.png',
                entries: [{ position: '1', lap_time: '1:30.000', car: 'Audi R8 LMS' }]
            }
        ], ['car'], 'gap');

        expect(html).toContain('assets/user-avatars/helmets/helmet-8.png');
        expect(html).toContain('Kostya Guzyuk avatar');
    });

    test('resolveTrackLabel falls back to item fields when R3EUtils helper is absent', () => {
        const savedFn = window.R3EUtils.resolveTrackLabelForItem;
        delete window.R3EUtils.resolveTrackLabelForItem;

        const label = window.tableRenderer.resolveTrackLabel({ track: 'Fallback Track' });
        expect(label).toBe('Fallback Track');

        const labelFromTrackName = window.tableRenderer.resolveTrackLabel({ track_name: 'Alt Name' });
        expect(labelFromTrackName).toBe('Alt Name');

        const labelFromFallback = window.tableRenderer.resolveTrackLabel({ track_id: '99' }, 'My Fallback');
        expect(labelFromFallback).toBe('My Fallback');

        window.R3EUtils.resolveTrackLabelForItem = savedFn;
    });

    test('renders raceroom-specific brand logo class for RaceRoom cars', () => {
        const savedResolve = window.R3EUtils.resolveBrandLogoPath;
        window.R3EUtils.resolveBrandLogoPath = () => 'images/brands/logo-raceroom.png';

        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Test Driver',
                country: 'SE',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', car: 'RaceRoom P1' }]
            }
        ], ['car'], 'gap');

        expect(html).toContain('table-brand-logo-raceroom');
        window.R3EUtils.resolveBrandLogoPath = savedResolve;
    });

    test('renders MP position name classes on non-highlighted driver links', () => {
        window.resolveMpPosWithInactive = (name) => ({ position: 5, inactive: false });
        window.getMpPosNameClasses = (pos, opts) => pos <= 10 ? 'mp-gold' : '';

        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Gold Driver',
                country: 'SE',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', car: 'BMW M4' }]
            }
        ], ['car'], 'gap');

        expect(html).toContain('mp-gold');
        expect(html).toContain('#5');

        window.resolveMpPosWithInactive = undefined;
        window.getMpPosNameClasses = undefined;
    });

    test('renders inactive MP position badge with inactive class', () => {
        window.resolveMpPosWithInactive = () => ({ position: 42, inactive: true });
        window.getMpPosNameClasses = () => '';

        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'Inactive Driver',
                country: 'DE',
                team: '',
                entries: [{ position: '1', lap_time: '1:25.000', car: 'Porsche 911' }]
            }
        ], ['car'], 'gap');

        expect(html).toContain('mp-pos-inactive');
        expect(html).toContain('#42');

        window.resolveMpPosWithInactive = undefined;
        window.getMpPosNameClasses = undefined;
    });

    test('renders car cell with only brand when model is empty', () => {
        const html = window.tableRenderer.renderDriverGroupedTable([
            {
                driver: 'X',
                country: '',
                team: '',
                entries: [{ position: '1', lap_time: '1:30.000', car: 'Ferrari' }]
            }
        ], ['car'], 'gap');

        expect(html).toContain('car-brand');
        // No car-model-line when there's no model part
        expect(html).not.toContain('car-model-line');
    });
});
