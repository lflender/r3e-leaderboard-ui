import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3EUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils-car.js');
        loadBrowserScript('modules/time-helper.js');
        loadBrowserScript('modules/utils-track.js');
        loadBrowserScript('modules/url-helper.js');
        loadBrowserScript('modules/utils.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        delete window.ColumnConfig;
        window.history.replaceState({}, '', '/');
    });

    test('escapes HTML content', () => {
        expect(window.R3EUtils.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('formats headers with special cases', () => {
        expect(window.R3EUtils.formatHeader('class_name')).toBe('Car class');
        expect(window.R3EUtils.formatHeader('date_time')).toBe('Date');
        expect(window.R3EUtils.formatHeader('entry_count')).toBe('Entries');
    });

    test('formats classic lap times', () => {
        expect(window.R3EUtils.formatClassicLapTime('2m 12.524s')).toBe('2:12:524s');
        expect(window.R3EUtils.formatClassicLapTime('45.281s')).toBe('45:281s');
    });

    test('parses lap times and gap percentages', () => {
        expect(window.R3EUtils.parseLapTimeToMillis('1:23.456s')).toBe(83456);
        expect(window.R3EUtils.parseGapMillisFromItem({ LapTime: '1:24.631s, +1.175s' })).toBe(1175);
        expect(window.R3EUtils.calculateGapPercentage({ LapTime: '1:24.631s, +1.175s' })).toBe('101.4%');
    });

    test('reads and updates URL params', () => {
        window.history.replaceState({}, '', '/?driver=Alex');
        expect(window.R3EUtils.getUrlParam('driver')).toBe('Alex');
        window.R3EUtils.updateUrlParam('driver', 'Sam');
        expect(new URL(window.location.href).searchParams.get('driver')).toBe('Sam');
    });

    test('resolves track labels from TRACKS_DATA by track_id', () => {
        window.TRACKS_DATA = [{ id: 10, label: 'Spa - Grand Prix' }];
        expect(window.R3EUtils.resolveTrackLabel(10)).toBe('Spa - Grand Prix');
        expect(window.R3EUtils.resolveTrackLabelForItem({ track_id: 10 })).toBe('Spa - Grand Prix');
        expect(window.R3EUtils.resolveTrackLabel(999, 'Fallback Track')).toBe('Fallback Track');
    });

    test('re-exports track and class-logo helpers', () => {
        window.CARS_DATA = [{ class: 'GT3', logo: 'https://example.com/gt3-logo.png' }];
        window.CAR_CLASSES_DATA = { 1703: 'GT3' };
        expect(window.R3EUtils.resolveCarClassLogo('GT3', '1703')).toBe('https://example.com/gt3-logo.png');
    });

    test('splits car names into brand and model', () => {
        expect(window.R3EUtils.splitCarName('Audi R8 LMS')).toEqual({ brand: 'Audi', model: 'R8 LMS' });
        expect(window.R3EUtils.splitCarName('Porsche')).toEqual({ brand: 'Porsche', model: '' });
    });

    test('re-exports car combination helpers', () => {
        expect(window.R3EUtils.detectYearSuffix('BMW M4 GT3 2024')).toEqual({
            baseName: 'BMW M4 GT3',
            year: '2024'
        });
        expect(window.R3EUtils.matchesCarFilterValue('BMW M4 GT3 2024', 'COMBINED_YEAR:BMW M4 GT3')).toBe(true);
    });

    test('re-exports time and date helpers', () => {
        expect(window.R3EUtils.formatClassicLapTime('1m 26.693s')).toBe('1:26:693s');
        expect(window.R3EUtils.formatDate('2025-10-06T19:15:20')).toBe('6 Oct 2025');
    });
});
