import { beforeAll, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CountryMappings', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/country-mappings.js');
    });

    // ── COUNTRY_NAME_MAP ────────────────────────────────────────────

    describe('COUNTRY_NAME_MAP', () => {
        test('is exposed on window', () => {
            expect(window.COUNTRY_NAME_MAP).toBeDefined();
            expect(typeof window.COUNTRY_NAME_MAP).toBe('object');
        });

        test('maps common country name variations to ISO codes', () => {
            const cases = [
                ['netherlands', 'NL'],
                ['the netherlands', 'NL'],
                ['czech republic', 'CZ'],
                ['czechia', 'CZ'],
                ['united states', 'US'],
                ['usa', 'US'],
                ['united kingdom', 'GB'],
                ['uk', 'GB'],
                ['great britain', 'GB'],
                ['south korea', 'KR'],
                ['korea', 'KR'],
                ['russia', 'RU'],
                ['russian federation', 'RU'],
                ['taiwan', 'TW'],
                ['hong kong', 'HK'],
                ['turkey', 'TR'],
            ];
            for (const [name, code] of cases) {
                expect(window.COUNTRY_NAME_MAP[name]).toBe(code);
            }
        });

        test('maps special character variants', () => {
            expect(window.COUNTRY_NAME_MAP['türkiye']).toBe('TR');
            expect(window.COUNTRY_NAME_MAP['turkiye']).toBe('TR');
        });

        test('all values are valid 2-letter ISO codes', () => {
            for (const [name, code] of Object.entries(window.COUNTRY_NAME_MAP)) {
                expect(code).toMatch(/^[A-Z]{2}$/);
            }
        });

        test('all keys are lowercase', () => {
            for (const key of Object.keys(window.COUNTRY_NAME_MAP)) {
                expect(key).toBe(key.toLowerCase());
            }
        });
    });

    // ── ISO_COUNTRY_CODES ───────────────────────────────────────────

    describe('ISO_COUNTRY_CODES', () => {
        test('is exposed on window as an array', () => {
            expect(Array.isArray(window.ISO_COUNTRY_CODES)).toBe(true);
        });

        test('contains common codes', () => {
            const mustHave = ['US', 'GB', 'DE', 'FR', 'JP', 'SE', 'NL', 'CZ'];
            for (const code of mustHave) {
                expect(window.ISO_COUNTRY_CODES).toContain(code);
            }
        });

        test('all entries are 2-letter uppercase strings', () => {
            for (const code of window.ISO_COUNTRY_CODES) {
                expect(code).toMatch(/^[A-Z]{2}$/);
            }
        });

        test('has no duplicates', () => {
            const set = new Set(window.ISO_COUNTRY_CODES);
            expect(set.size).toBe(window.ISO_COUNTRY_CODES.length);
        });

        test('every COUNTRY_NAME_MAP value is in ISO_COUNTRY_CODES', () => {
            const codeSet = new Set(window.ISO_COUNTRY_CODES);
            for (const code of Object.values(window.COUNTRY_NAME_MAP)) {
                expect(codeSet.has(code)).toBe(true);
            }
        });
    });
});
