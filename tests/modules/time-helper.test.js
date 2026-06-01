import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('R3ETimeUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/time-helper.js');
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
        expect(window.R3ETimeUtils.parseLapTimeToMillis('2m03.404s')).toBe(123404); // no space between m and seconds
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

    describe('formatClassicLapTime edge cases', () => {
        test('returns empty string for null/undefined', () => {
            expect(window.R3ETimeUtils.formatClassicLapTime(null)).toBe('');
            expect(window.R3ETimeUtils.formatClassicLapTime(undefined)).toBe('');
        });

        test('returns empty string for empty string', () => {
            expect(window.R3ETimeUtils.formatClassicLapTime('')).toBe('');
        });

        test('returns original value if pattern does not match', () => {
            expect(window.R3ETimeUtils.formatClassicLapTime('invalid')).toBe('invalid');
            expect(window.R3ETimeUtils.formatClassicLapTime('12:34')).toBe('12:34');
        });

        test('formats negative gap times', () => {
            expect(window.R3ETimeUtils.formatClassicLapTime('-0.500s')).toBe('-0:500s');
        });

        test('pads millis to 3 digits', () => {
            expect(window.R3ETimeUtils.formatClassicLapTime('1m 30.5s')).toBe('1:30:500s');
            expect(window.R3ETimeUtils.formatClassicLapTime('45.28s')).toBe('45:280s');
        });

        test('pads seconds to 2 digits when minutes present', () => {
            expect(window.R3ETimeUtils.formatClassicLapTime('1m 5.000s')).toBe('1:05:000s');
        });
    });

    describe('parseLapTimeToMillis all formats', () => {
        test('returns 0 for falsy input', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('')).toBe(0);
            expect(window.R3ETimeUtils.parseLapTimeToMillis(null)).toBe(0);
            expect(window.R3ETimeUtils.parseLapTimeToMillis(undefined)).toBe(0);
        });

        test('parses min:sec:millis format (e.g. 1:30:500s)', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('1:30:500s')).toBe(90500);
            expect(window.R3ETimeUtils.parseLapTimeToMillis('2:05:123s')).toBe(125123);
        });

        test('parses min:sec.millis format (e.g. 1:30.500)', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('1:30.500')).toBe(90500);
            expect(window.R3ETimeUtils.parseLapTimeToMillis('0:45.123')).toBe(45123);
        });

        test('parses XmYY.ZZZ format (e.g. 1m30.500)', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('1m30.500')).toBe(90500);
            expect(window.R3ETimeUtils.parseLapTimeToMillis('2m 05.123')).toBe(125123);
        });

        test('parses seconds-only format (e.g. 45.123)', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('45.123')).toBe(45123);
            expect(window.R3ETimeUtils.parseLapTimeToMillis('0.500')).toBe(500);
        });

        test('returns 0 for unrecognized format', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('invalid')).toBe(0);
            expect(window.R3ETimeUtils.parseLapTimeToMillis('abc:def')).toBe(0);
        });

        test('strips trailing s', () => {
            expect(window.R3ETimeUtils.parseLapTimeToMillis('45.123s')).toBe(45123);
            expect(window.R3ETimeUtils.parseLapTimeToMillis('1:30.500s')).toBe(90500);
        });
    });

    describe('parseGapMillisFromItem edge cases', () => {
        test('returns 0 for null item', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem(null)).toBe(0);
        });

        test('returns 0 when no lap time field exists', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem({})).toBe(0);
        });

        test('returns 0 when no comma-separated gap exists', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem({ LapTime: '1:30.500s' })).toBe(0);
        });

        test('returns MAX_VALUE when gap cannot be parsed', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem({ LapTime: '1:30.500s, invalid' })).toBe(Number.MAX_VALUE);
        });

        test('parses negative gaps', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem({ LapTime: '1:30.500s, -0.200s' })).toBe(-200);
        });

        test('parses gaps with minutes', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem({ LapTime: '2:00.000s, +1m 05.500s' })).toBe(65500);
        });

        test('reads from alternate field names', () => {
            expect(window.R3ETimeUtils.parseGapMillisFromItem({ lap_time: '1:30.000s, +0.750s' })).toBe(750);
            expect(window.R3ETimeUtils.parseGapMillisFromItem({ Time: '1:30.000s, +1.000s' })).toBe(1000);
        });
    });

    describe('calculateGapPercentage edge cases', () => {
        test('returns dash for null item', () => {
            expect(window.R3ETimeUtils.calculateGapPercentage(null)).toBe('-');
        });

        test('returns dash for empty lap time', () => {
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '' })).toBe('-');
        });

        test('returns dash when lap time is zero', () => {
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: 'invalid, +1.000s' })).toBe('-');
        });

        test('returns dash when gap is zero (leader entry)', () => {
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:30.000s, +0.000s' })).toBe('-');
        });

        test('returns dash when gap parse fails', () => {
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:30.000s, invalid' })).toBe('-');
        });

        test('calculates correct percentage for valid gap', () => {
            // Lap = 90s (90000ms), gap = +1s (1000ms), ref = 89s (89000ms)
            // percentage = 90000/89000 * 100 = 101.1%
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:30.000s, +1.000s' })).toBe('101.1%');
        });
    });

    describe('formatDate edge cases', () => {
        test('returns empty for falsy input', () => {
            expect(window.R3ETimeUtils.formatDate('')).toBe('');
            expect(window.R3ETimeUtils.formatDate(null)).toBe('');
            expect(window.R3ETimeUtils.formatDate(undefined)).toBe('');
        });

        test('formats various valid date strings', () => {
            expect(window.R3ETimeUtils.formatDate('2024-12-25T00:00:00Z')).toBe('25 Dec 2024');
            expect(window.R3ETimeUtils.formatDate('2023-01-01')).toBe('1 Jan 2023');
        });

        test('returns empty for invalid date strings', () => {
            expect(window.R3ETimeUtils.formatDate('not-a-date')).toBe('');
            expect(window.R3ETimeUtils.formatDate('9999-99-99')).toBe('');
        });
    });

    describe('calculateGapPercentage refMillis <= 0 branch', () => {
        test('returns dash when gap exceeds lap time (refMillis <= 0)', () => {
            // Gap of 100s with lap of 1:30 (90s) → refMillis = 90000 - 100000 < 0
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:30.000s, +100.000s' })).toBe('-');
        });

        test('returns dash when gap equals lap time exactly', () => {
            // Gap = 90s, lap = 90s → refMillis = 0
            expect(window.R3ETimeUtils.calculateGapPercentage({ LapTime: '1:30.000s, +90.000s' })).toBe('-');
        });
    });
});
