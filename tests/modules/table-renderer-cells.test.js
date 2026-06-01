import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('TableRenderer — cell rendering', () => {
    let renderer;

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
        loadBrowserScript('modules/data-normalizer.js');
        loadBrowserScript('modules/table-renderer.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        window.TRACKS_DATA = [
            { id: 10, label: 'Spa - Grand Prix' },
            { id: 20, label: 'Zolder - Grand Prix' }
        ];
        window.DataNormalizer = window.DataNormalizer || { normalizeTrackName: value => value, extractName: item => item.name || item.Name || '', extractCountry: item => item.country || '', extractRank: item => item.rank || '' };
        window.FlagHelper = { countryToFlag: (c) => c === 'SE' ? '🇸🇪' : '' };
        window.resolveMpPos = undefined;
        window.resolveMpPosWithInactive = () => ({ position: null, inactive: false });
        window.getMpPosNameClasses = () => '';
        renderer = window.tableRenderer;
    });

    // -------------------------------------------------------
    // renderCell dispatch
    // -------------------------------------------------------
    describe('renderCell', () => {
        test('dispatches position column to renderPositionCell', () => {
            const html = renderer.renderCell({ Position: '3', total_entries: '20' }, 'Position');
            expect(html).toContain('pos-cell');
            expect(html).toContain('3');
        });

        test('dispatches car column to renderCarCell', () => {
            const html = renderer.renderCell({ Car: 'BMW M4 GT3' }, 'Car');
            expect(html).toContain('car-cell');
            expect(html).toContain('BMW');
            expect(html).toContain('M4 GT3');
        });

        test('dispatches track column to renderTrackCell', () => {
            const html = renderer.renderCell({ track: 'Spa - Grand Prix', track_id: '10' }, 'track');
            expect(html).toContain('Spa');
        });

        test('dispatches difficulty column to renderDifficultyCell', () => {
            const html = renderer.renderCell({ Difficulty: 'Get Real' }, 'Difficulty');
            expect(html).toContain('difficulty-pill');
            expect(html).toContain('Get Real');
        });

        test('dispatches lap time column to renderLapTimeCell', () => {
            const html = renderer.renderCell({ 'Lap Time': '1m 30.500s' }, 'Lap Time');
            expect(html).toContain('lap-time-cell');
        });

        test('dispatches date column with formatted value', () => {
            const html = renderer.renderCell({ date_time: '2024-01-15T10:30:00Z' }, 'date_time');
            expect(html).toContain('date-cell');
        });

        test('renders car class column with logo and label', () => {
            window.CARS_DATA = [{ class: 'GT3', logo: 'https://cdn/gt3.png' }];
            const html = renderer.renderCell({ CarClass: 'GT3', class_id: '1703' }, 'CarClass');
            expect(html).toContain('car-class-cell');
            expect(html).toContain('GT3');
            expect(html).toContain('table-car-class-logo');
        });

        test('renders generic value when no type matches', () => {
            const html = renderer.renderCell({ SomeField: 'hello' }, 'SomeField');
            expect(html).toContain('<td>hello</td>');
        });

        test('renders generic value with escaping', () => {
            const html = renderer.renderCell({ SomeField: '<b>xss</b>' }, 'SomeField');
            expect(html).toContain('&lt;b&gt;xss&lt;/b&gt;');
            expect(html).not.toContain('<b>xss</b>');
        });

        test('renders dash for null generic value', () => {
            const html = renderer.renderCell({ SomeField: null }, 'SomeField');
            expect(html).toContain('<td>-</td>');
        });
    });

    // -------------------------------------------------------
    // renderPositionCell
    // -------------------------------------------------------
    describe('renderPositionCell', () => {
        test('renders position with total entries', () => {
            const html = renderer.renderPositionCell({ Position: '1', total_entries: '50' });
            expect(html).toContain('pos-cell');
            expect(html).toContain('pos-number');
            expect(html).toContain('1');
            expect(html).toContain('pos-total');
            expect(html).toContain('50');
        });

        test('renders position without total when absent', () => {
            const html = renderer.renderPositionCell({ Position: '5' });
            expect(html).toContain('pos-number');
            expect(html).toContain('5');
            expect(html).not.toContain('pos-total');
        });

        test('applies podium class for top 3 positions when total >= 4', () => {
            const html = renderer.renderPositionCell({ Position: '1', total_entries: '10' });
            expect(html).toContain('pos-1');
        });

        test('does not apply podium class when total < 4', () => {
            const html = renderer.renderPositionCell({ Position: '1', total_entries: '3' });
            expect(html).not.toContain('pos-1');
        });

        test('renders P2 podium class', () => {
            const html = renderer.renderPositionCell({ Position: '2', total_entries: '10' });
            expect(html).toContain('pos-2');
        });

        test('renders P3 podium class', () => {
            const html = renderer.renderPositionCell({ Position: '3', total_entries: '10' });
            expect(html).toContain('pos-3');
        });

        test('does not apply podium class for P4', () => {
            const html = renderer.renderPositionCell({ Position: '4', total_entries: '10' });
            expect(html).not.toContain('pos-4');
        });

        test('includes dynamic background color from getPositionBadgeColor', () => {
            const html = renderer.renderPositionCell({ Position: '1', total_entries: '10' });
            expect(html).toContain('style="background:');
        });
    });

    // -------------------------------------------------------
    // renderDetailPositionCell
    // -------------------------------------------------------
    describe('renderDetailPositionCell', () => {
        test('renders basic position when showAbsolutePosition is false', () => {
            const item = { Position: '5', total_entries: '20' };
            const html = renderer.renderDetailPositionCell(item, { showAbsolutePosition: false });
            expect(html).toContain('pos-cell');
            expect(html).toContain('5');
            expect(html).toContain('20');
        });

        test('renders filtered + absolute position when showAbsolutePosition is true', () => {
            const item = {
                Position: '5', total_entries: '20',
                filteredPosition: '2', filteredTotal: '8',
                absolutePosition: '5', absoluteTotal: '20'
            };
            const html = renderer.renderDetailPositionCell(item, { showAbsolutePosition: true });
            expect(html).toContain('absolute-pos-label');
            expect(html).toContain('2');
            expect(html).toContain('8');
            expect(html).toContain('5');
            expect(html).toContain('20');
        });

        test('falls back to regular position when absolute values missing', () => {
            const item = { Position: '3', total_entries: '15' };
            const html = renderer.renderDetailPositionCell(item, { showAbsolutePosition: true });
            expect(html).not.toContain('absolute-pos-label');
            expect(html).toContain('3');
        });
    });

    // -------------------------------------------------------
    // renderDriverNameCell
    // -------------------------------------------------------
    describe('renderDriverNameCell', () => {
        test('renders driver name as a link', () => {
            const item = { name: 'Max Verstappen', country: 'NL', rank: '' };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('Max Verstappen');
            expect(html).toContain('detail-driver-link');
            expect(html).toContain('href=');
            expect(html).toContain('drivers.html?driver=');
        });

        test('renders flag when FlagHelper returns one', () => {
            window.FlagHelper = { countryToFlag: () => '🇩🇪' };
            const item = { name: 'Mick Schumacher', country: 'DE' };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('country-flag');
            expect(html).toContain('🇩🇪');
        });

        test('renders rank stars when rank is present', () => {
            const item = { name: 'Driver A', country: '', rank: 'A' };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('rank-stars-inline');
            expect(html).toContain('⭐');
        });

        test('renders MP position badge when resolveMpPosWithInactive returns position', () => {
            window.resolveMpPosWithInactive = () => ({ position: 42, inactive: false });
            const item = { name: 'Pro Driver', country: '' };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('mp-pos-badge');
            expect(html).toContain('#42');
        });

        test('renders inactive MP badge class', () => {
            window.resolveMpPosWithInactive = () => ({ position: 100, inactive: true });
            const item = { name: 'Old Driver', country: '' };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('mp-pos-inactive');
        });

        test('renders highlighted driver as span instead of link', () => {
            const item = { name: 'Me', country: '', highlisted: true };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('<span');
            expect(html).not.toContain('<a');
            expect(html).toContain('Me');
        });

        test('includes path_id in driver link when present', () => {
            const item = { name: 'TestDriver', country: '', path_id: '12345' };
            const html = renderer.renderDriverNameCell(item);
            expect(html).toContain('id=12345');
        });
    });

    // -------------------------------------------------------
    // renderLapTimeCell
    // -------------------------------------------------------
    describe('renderLapTimeCell', () => {
        test('renders lap time with main part', () => {
            const html = renderer.renderLapTimeCell('1m 30.500s');
            expect(html).toContain('lap-time-cell');
            expect(html).toContain('lap-main');
            expect(html).toContain('1:30:500s');
        });

        test('renders delta when value contains comma-separated gap', () => {
            const html = renderer.renderLapTimeCell('1m 30.500s, +0.250s');
            expect(html).toContain('lap-main');
            expect(html).toContain('time-delta');
            expect(html).toContain('+0:250s');
        });

        test('omits delta when includeDelta is false', () => {
            const html = renderer.renderLapTimeCell('1m 30.500s, +0.250s', { includeDelta: false });
            expect(html).toContain('lap-main');
            expect(html).not.toContain('time-delta');
        });

        test('handles empty value gracefully', () => {
            const html = renderer.renderLapTimeCell('');
            expect(html).toContain('lap-time-cell');
            expect(html).toContain('lap-main');
        });
    });

    // -------------------------------------------------------
    // renderGapTimeCell
    // -------------------------------------------------------
    describe('renderGapTimeCell', () => {
        test('renders gap delta when present', () => {
            const html = renderer.renderGapTimeCell('1m 30.500s, +0.500s');
            expect(html).toContain('gap-time-cell');
            expect(html).toContain('time-delta');
            expect(html).toContain('+0:500s');
        });

        test('renders empty cell when no gap', () => {
            const html = renderer.renderGapTimeCell('1m 30.500s');
            expect(html).toContain('gap-time-cell');
            expect(html).not.toContain('time-delta');
        });
    });

    // -------------------------------------------------------
    // extractLapAndGapParts
    // -------------------------------------------------------
    describe('extractLapAndGapParts', () => {
        test('splits combined lap + gap string', () => {
            const result = renderer.extractLapAndGapParts('1m 30.500s, +0.250s');
            expect(result.main).toBe('1:30:500s');
            expect(result.gap).toBe('+0:250s');
        });

        test('returns main only when no gap', () => {
            const result = renderer.extractLapAndGapParts('1m 30.500s');
            expect(result.main).toBe('1:30:500s');
            expect(result.gap).toBe('');
        });

        test('handles null/undefined', () => {
            const result = renderer.extractLapAndGapParts(null);
            expect(result.main).toBeDefined();
            expect(result.gap).toBe('');
        });
    });

    // -------------------------------------------------------
    // renderCarCell
    // -------------------------------------------------------
    describe('renderCarCell', () => {
        test('renders brand and model separately', () => {
            const html = renderer.renderCarCell('Porsche 911 GT3 R');
            expect(html).toContain('car-cell');
            expect(html).toContain('car-brand');
            expect(html).toContain('Porsche');
            expect(html).toContain('car-model');
            expect(html).toContain('911 GT3 R');
        });

        test('renders brand logo when available', () => {
            const html = renderer.renderCarCell('Audi R8 LMS');
            expect(html).toContain('table-brand-logo');
            expect(html).toContain('images/brands/logo-audi.png');
        });

        test('renders dash for empty value', () => {
            const html = renderer.renderCarCell('');
            expect(html).toBe('<td>-</td>');
        });

        test('renders dash for null value', () => {
            const html = renderer.renderCarCell(null);
            expect(html).toBe('<td>-</td>');
        });

        test('renders single-word car name as brand only', () => {
            const html = renderer.renderCarCell('RaceRoom');
            expect(html).toContain('car-brand');
            expect(html).not.toContain('car-model-line');
        });

        test('escapes HTML in car name', () => {
            const html = renderer.renderCarCell('<script>alert(1)</script> GT3');
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });
    });

    // -------------------------------------------------------
    // renderTrackCellStatic
    // -------------------------------------------------------
    describe('renderTrackCellStatic', () => {
        test('splits track name and layout by dash', () => {
            const html = TableRenderer.renderTrackCellStatic('Donington Park - Grand Prix');
            expect(html).toContain('Donington Park');
            expect(html).toContain('track-layout');
            expect(html).toContain('Grand Prix');
        });

        test('renders track without layout when no dash separator', () => {
            const html = TableRenderer.renderTrackCellStatic('Monza');
            expect(html).toContain('Monza');
            expect(html).not.toContain('track-layout');
        });

        test('includes track logo when mapping exists', () => {
            const html = TableRenderer.renderTrackCellStatic('Donington Park - Grand Prix');
            expect(html).toContain('table-track-logo');
            expect(html).toContain('donington-park');
        });

        test('applies custom td class', () => {
            const html = TableRenderer.renderTrackCellStatic('Spa - GP', 'custom-class');
            expect(html).toContain('class="custom-class"');
        });

        test('handles empty string', () => {
            const html = TableRenderer.renderTrackCellStatic('');
            expect(html).toContain('<td>');
        });
    });

    // -------------------------------------------------------
    // renderDifficultyCell
    // -------------------------------------------------------
    describe('renderDifficultyCell', () => {
        test('renders Get Real with correct class', () => {
            const html = renderer.renderDifficultyCell('Get Real');
            expect(html).toContain('difficulty-cell');
            expect(html).toContain('difficulty-pill');
            expect(html).toContain('difficulty-get-real');
            expect(html).toContain('Get Real');
            expect(html).toContain('title="Highest realism (gold)"');
        });

        test('renders Amateur with correct class', () => {
            const html = renderer.renderDifficultyCell('Amateur');
            expect(html).toContain('difficulty-amateur');
            expect(html).toContain('title="Intermediate realism (silver)"');
        });

        test('renders Novice with correct class', () => {
            const html = renderer.renderDifficultyCell('Novice');
            expect(html).toContain('difficulty-novice');
            expect(html).toContain('title="Lowest realism (bronze)"');
        });

        test('renders unknown difficulty without specific class', () => {
            const html = renderer.renderDifficultyCell('Custom');
            expect(html).toContain('difficulty-pill');
            expect(html).not.toContain('difficulty-get-real');
            expect(html).not.toContain('difficulty-amateur');
            expect(html).not.toContain('difficulty-novice');
            expect(html).toContain('title="Difficulty"');
        });

        test('handles empty value', () => {
            const html = renderer.renderDifficultyCell('');
            expect(html).toContain('difficulty-cell');
        });
    });

    // -------------------------------------------------------
    // renderGapPercentCell
    // -------------------------------------------------------
    describe('renderGapPercentCell', () => {
        test('renders gap percentage cell', () => {
            const html = renderer.renderGapPercentCell({ LapTime: '1m 30.000s' }, '1m 29.000s');
            expect(html).toContain('gap-percent-cell');
        });

        test('renders with null reference time', () => {
            const html = renderer.renderGapPercentCell({ LapTime: '1m 30.000s' }, null);
            expect(html).toContain('gap-percent-cell');
        });
    });

    // -------------------------------------------------------
    // filterAndSortKeys
    // -------------------------------------------------------
    describe('filterAndSortKeys', () => {
        test('delegates to ColumnConfig.getOrderedColumns', () => {
            const keys = ['Position', 'Car', 'LapTime', 'Track'];
            const result = renderer.filterAndSortKeys(keys);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    // -------------------------------------------------------
    // sortDriverEntries
    // -------------------------------------------------------
    describe('sortDriverEntries', () => {
        test('sorts entries by gap (default)', () => {
            const entries = [
                { lap_time: '1m 31.000s, +1.000s' },
                { lap_time: '1m 30.000s' }
            ];
            renderer.sortDriverEntries(entries, 'gap');
            // Leader (no gap) should come first
            expect(entries[0].lap_time).toBe('1m 30.000s');
        });

        test('does not throw when sortService is null', () => {
            const orig = renderer.sortService;
            renderer.sortService = null;
            expect(() => renderer.sortDriverEntries([], 'gap')).not.toThrow();
            renderer.sortService = orig;
        });
    });
});
