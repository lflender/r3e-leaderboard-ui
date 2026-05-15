import { beforeAll, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('FieldMappings', () => {
    beforeAll(() => {
        loadBrowserScript('modules/field-mappings.js');
    });

    // ── FIELD_NAMES structure ───────────────────────────────────────

    describe('FIELD_NAMES', () => {
        test('is exposed on window', () => {
            expect(window.FIELD_NAMES).toBeDefined();
            expect(typeof window.FIELD_NAMES).toBe('object');
        });

        test('contains expected field categories', () => {
            const expected = [
                'POSITION', 'NAME', 'COUNTRY', 'CAR_CLASS', 'CAR',
                'LAP_TIME', 'TRACK', 'DIFFICULTY', 'RANK', 'TEAM',
                'TRACK_ID', 'CLASS_ID', 'TOTAL_ENTRIES', 'DATE_TIME'
            ];
            for (const key of expected) {
                expect(window.FIELD_NAMES[key]).toBeDefined();
                expect(Array.isArray(window.FIELD_NAMES[key])).toBe(true);
                expect(window.FIELD_NAMES[key].length).toBeGreaterThan(0);
            }
        });

        test('each field array contains only strings', () => {
            for (const [key, variants] of Object.entries(window.FIELD_NAMES)) {
                for (const v of variants) {
                    expect(typeof v).toBe('string');
                }
            }
        });
    });

    // ── getField helper ─────────────────────────────────────────────

    describe('getField', () => {
        test('is exposed on window', () => {
            expect(typeof window.getField).toBe('function');
        });

        test('returns first matching field value', () => {
            const obj = { Position: 1, Pos: 2 };
            expect(window.getField(obj, ['Position', 'Pos'])).toBe(1);
        });

        test('falls through to next variant when first is missing', () => {
            const obj = { Pos: 5 };
            expect(window.getField(obj, ['Position', 'Pos'])).toBe(5);
        });

        test('returns default when no field matches', () => {
            const obj = { other: 'value' };
            expect(window.getField(obj, ['Position', 'Pos'])).toBe('');
            expect(window.getField(obj, ['Position'], 'N/A')).toBe('N/A');
        });

        test('returns default for null/undefined object', () => {
            expect(window.getField(null, ['Position'])).toBe('');
            expect(window.getField(undefined, ['Position'], 0)).toBe(0);
        });

        test('returns value even if it is falsy (0, empty string)', () => {
            expect(window.getField({ Position: 0 }, ['Position'], 99)).toBe(0);
            expect(window.getField({ Name: '' }, ['Name'], 'default')).toBe('');
        });

        test('works with FIELD_NAMES constants', () => {
            const row = { DriverName: 'Alice', country: 'SE' };
            expect(window.getField(row, window.FIELD_NAMES.NAME)).toBe('Alice');
            expect(window.getField(row, window.FIELD_NAMES.COUNTRY)).toBe('SE');
        });
    });
});
