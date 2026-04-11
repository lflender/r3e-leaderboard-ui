import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ETimeUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils-time.js');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('formats classic lap time strings', () => {
        expect(window.R3ETimeUtils.formatClassicLapTime('2m 12.524s')).toBe('2:12:524s');
        expect(window.R3ETimeUtils.formatClassicLapTime('+1.782s')).toBe('+1:782s');
    });

    test('parses lap and gap times', () => {
        expect(window.R3ETimeUtils.parseLapTimeToMillis('1:23.456s')).toBe(83456);
        expect(window.R3ETimeUtils.parseLapTimeToMillis('2m 03.404s')).toBe(123404);
        expect(window.R3ETimeUtils.parseGapMillisFromItem({ LapTime: '1:24.631s, +1.175s' })).toBe(1175);
    });

    test('calculates gap percentage', () => {
        expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:24.631s, +1.175s' })).toBe('101.4%');
        expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:23.456s' })).toBe('-');
    });

    test('formats ISO dates for display', () => {
        expect(window.R3ETimeUtils.formatDate('2025-10-06T19:15:20')).toBe('6 Oct 2025');
        expect(window.R3ETimeUtils.formatDate('bad-date')).toBe('');
    });
});
