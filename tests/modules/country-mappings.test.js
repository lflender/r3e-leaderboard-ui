import { beforeAll, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CountryMappings', () => {
    beforeAll(() => {
        loadBrowserScript('modules/data/country-mappings.js');
        loadBrowserScript('modules/flag-helper.js');
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
                ['congo', 'CG'],
                ['dr congo', 'CD'],
                ['falkland islands (malvinas)', 'FK'],
                ['heard island and mcdonald islands', 'HM'],
                ['kosovo', 'XK'],
                ['myanmar', 'MM'],
                ['pitcairn', 'PN'],
                ['saint kitts and nevis', 'KN'],
                ['saint martin', 'MF'],
                ['saint pierre and miquelon', 'PM'],
                ['saint vincent and the grenadines', 'VC'],
                ['south georgia and the south sandwich islands', 'GS'],
                ['turks and caicos islands', 'TC'],
                ['u.s. minor outlying islands', 'UM'],
                ['wallis and futuna', 'WF'],
            ];
            for (const [name, code] of cases) {
                expect(window.COUNTRY_NAME_MAP[name]).toBe(code);
            }
        });

        test('maps special character variants', () => {
            expect(window.COUNTRY_NAME_MAP['türkiye']).toBe('TR');
            expect(window.COUNTRY_NAME_MAP['turkiye']).toBe('TR');
        });

        test('all values are valid 2-letter region codes', () => {
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

        test('every country mapping uses an ISO code or the Kosovo flag-icons code', () => {
            const codeSet = new Set(window.ISO_COUNTRY_CODES);
            for (const code of Object.values(window.COUNTRY_NAME_MAP)) {
                expect(codeSet.has(code) || code === 'XK').toBe(true);
            }
        });
    });

    test('all previously unresolved records country names render flags', () => {
        const cases = [
            ['Congo', 'cg'],
            ['DR Congo', 'cd'],
            ['Falkland Islands (Malvinas)', 'fk'],
            ['Heard Island and McDonald Islands', 'hm'],
            ['Kosovo', 'xk'],
            ['Myanmar', 'mm'],
            ['Pitcairn', 'pn'],
            ['Saint Kitts and Nevis', 'kn'],
            ['Saint Martin', 'mf'],
            ['Saint Pierre and Miquelon', 'pm'],
            ['Saint Vincent and the Grenadines', 'vc'],
            ['South Georgia and the South Sandwich Islands', 'gs'],
            ['Turks and Caicos Islands', 'tc'],
            ['U.S. Minor Outlying Islands', 'um'],
            ['Wallis and Futuna', 'wf']
        ];

        for (const [name, code] of cases) {
            expect(window.FlagHelper.countryToFlag(name), name).toBe(`<span class="fi fi-${code}"></span>`);
        }
    });
});
