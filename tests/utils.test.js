import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

describe('R3EUtils', () => {
    beforeAll(() => {
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

    test('splits car names into brand and model', () => {
        expect(window.R3EUtils.splitCarName('Audi R8 LMS')).toEqual({ brand: 'Audi', model: 'R8 LMS' });
        expect(window.R3EUtils.splitCarName('Porsche')).toEqual({ brand: 'Porsche', model: '' });
    });
});