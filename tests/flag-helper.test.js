import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

beforeAll(() => {
    // Provide minimal globals before load; the functions read them at call-time
    window.COUNTRY_NAME_MAP = {};
    window.ISO_COUNTRY_CODES = [];
    loadBrowserScript('modules/flag-helper.js');
});

beforeEach(() => {
    window.COUNTRY_NAME_MAP = {
        'uk': 'GB',
        'usa': 'US',
        'england': 'GB'
    };
    window.ISO_COUNTRY_CODES = ['GB', 'US', 'DE', 'FR', 'IT'];
});

describe('FlagHelper.countryToFlag', () => {
    it('returns empty string for empty string input', () => {
        expect(window.FlagHelper.countryToFlag('')).toBe('');
    });

    it('returns empty string for null and undefined', () => {
        expect(window.FlagHelper.countryToFlag(null)).toBe('');
        expect(window.FlagHelper.countryToFlag(undefined)).toBe('');
    });

    it('returns an <img> tag for "Various" (case-insensitive)', () => {
        const html = window.FlagHelper.countryToFlag('Various');
        expect(html).toContain('<img');
        expect(html).toContain('Various');

        const htmlLower = window.FlagHelper.countryToFlag('various');
        expect(htmlLower).toContain('<img');
    });

    it('extracts code from parentheses notation "Name (XX)"', () => {
        expect(window.FlagHelper.countryToFlag('United Kingdom (GB)')).toBe('<span class="fi fi-gb"></span>');
        expect(window.FlagHelper.countryToFlag('Germany (DE)')).toBe('<span class="fi fi-de"></span>');
    });

    it('resolves country name through COUNTRY_NAME_MAP', () => {
        expect(window.FlagHelper.countryToFlag('uk')).toBe('<span class="fi fi-gb"></span>');
        expect(window.FlagHelper.countryToFlag('england')).toBe('<span class="fi fi-gb"></span>');
    });

    it('treats a raw 2-letter string as an ISO code', () => {
        expect(window.FlagHelper.countryToFlag('DE')).toBe('<span class="fi fi-de"></span>');
        expect(window.FlagHelper.countryToFlag('fr')).toBe('<span class="fi fi-fr"></span>');
    });

    it('returns empty string for unrecognised multi-word name', () => {
        expect(window.FlagHelper.countryToFlag('Neverland Kingdom')).toBe('');
    });
});

describe('FlagHelper.findCountryCodeByName', () => {
    it('returns mapped code from COUNTRY_NAME_MAP (case-insensitive key)', () => {
        expect(window.FlagHelper.findCountryCodeByName('uk')).toBe('GB');
        expect(window.FlagHelper.findCountryCodeByName('UK')).toBe('GB');
        expect(window.FlagHelper.findCountryCodeByName('England')).toBe('GB');
    });

    it('returns null for empty string', () => {
        expect(window.FlagHelper.findCountryCodeByName('')).toBeNull();
    });

    it('returns null for null', () => {
        expect(window.FlagHelper.findCountryCodeByName(null)).toBeNull();
    });

    it('returns null when no mapping and no Intl match exists', () => {
        expect(window.FlagHelper.findCountryCodeByName('Neverland')).toBeNull();
    });
});
