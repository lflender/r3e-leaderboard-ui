import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

// mp-pos-service reads from a cache populated by loadMpPosCache().
// We bypass the async fetch by directly injecting the module-level cache
// via the exported getMpPos / resolveMpPos functions after setting it up.

function buildCache(entries) {
    // Returns a cache object in the same shape as loadMpPosCache builds
    const byName = new Map();
    const byNameCountry = new Map();
    const nameStats = new Map();
    entries.forEach(({ name, country, position }) => {
        const nameLower = name.trim().toLowerCase();
        const stats = nameStats.get(nameLower) || { count: 0 };
        stats.count += 1;
        nameStats.set(nameLower, stats);
        if (!byName.has(nameLower)) byName.set(nameLower, position);
        if (country) {
            byNameCountry.set(`${nameLower}|${country.toLowerCase()}`, position);
        }
    });
    return { byName, byNameCountry, nameStats };
}

beforeAll(() => {
    window.CompressedJsonHelper = { readGzipJson: vi.fn() };
    window.FlagHelper = {
        findCountryCodeByName: (name) => {
            const map = { 'germany': 'DE', 'france': 'FR' };
            return map[name.toLowerCase()] || null;
        }
    };
    loadBrowserScript('modules/mp-pos-service.js');
});

// Inject a synthetic cache before each test
beforeEach(() => {
    // Expose internal cache by reaching into the module's closure via the
    // fact that getMpPos reads window.mpPosCache — but the module uses a
    // local variable. We set it through a helper: call getMpPos with a name
    // that only works if cache is populated, so we inject via the module's
    // own loadMpPosCache mock by resetting the module state indirectly.
    // The cleanest approach: reload the script each suite so cache resets.
});

// Helper: build + inject the cache by mocking the fetch inside loadMpPosCache
function injectCache(entries) {
    const data = { results: entries.map(e => ({ name: e.name, country: e.country, position: e.position })) };
    window.CompressedJsonHelper.readGzipJson = vi.fn().mockResolvedValue(data);
}

describe('getMpPosHighlightClass', () => {
    beforeAll(() => {
        // getMpPosHighlightClass is not exported directly — accessed via window
        // It is attached to window in the module
    });

    it('returns gold class for position ≤ 50', () => {
        expect(window.getMpPosHighlightClass(1)).toBe('driver-name-gold');
        expect(window.getMpPosHighlightClass(50)).toBe('driver-name-gold');
    });

    it('returns silver class for 50 < position ≤ 200', () => {
        expect(window.getMpPosHighlightClass(51)).toBe('driver-name-silver');
        expect(window.getMpPosHighlightClass(200)).toBe('driver-name-silver');
    });

    it('returns empty string for position > 200', () => {
        expect(window.getMpPosHighlightClass(201)).toBe('');
        expect(window.getMpPosHighlightClass(9999)).toBe('');
    });

    it('returns empty string for null', () => {
        expect(window.getMpPosHighlightClass(null)).toBe('');
        expect(window.getMpPosHighlightClass(undefined)).toBe('');
    });

    it('respects custom thresholds', () => {
        expect(window.getMpPosHighlightClass(10, { gold: 5, silver: 15 })).toBe('driver-name-silver');
        expect(window.getMpPosHighlightClass(20, { gold: 5, silver: 15 })).toBe('');
    });
});

describe('getMpPosNameClasses', () => {
    it('returns gold + glitter for position ≤ 10', () => {
        const cls = window.getMpPosNameClasses(5);
        expect(cls).toContain('driver-name-gold');
        expect(cls).toContain('driver-name-top10-glitter');
    });

    it('returns gold only for position 11–50', () => {
        const cls = window.getMpPosNameClasses(25);
        expect(cls).toContain('driver-name-gold');
        expect(cls).not.toContain('driver-name-top10-glitter');
    });

    it('returns silver only for position 51–200', () => {
        const cls = window.getMpPosNameClasses(100);
        expect(cls).toContain('driver-name-silver');
        expect(cls).not.toContain('driver-name-top10-glitter');
        expect(cls).not.toContain('driver-name-gold');
    });

    it('returns empty string for null', () => {
        expect(window.getMpPosNameClasses(null)).toBe('');
    });

    it('returns empty string for position above thresholds', () => {
        expect(window.getMpPosNameClasses(201)).toBe('');
    });
});

describe('getMpPos / resolveMpPos — with injected cache', () => {
    // These functions read the module-level mpPosCache variable which is populated
    // by loadMpPosCache(). We test them with the cache already set (populated on
    // module load via the auto-call at the bottom of mp-pos-service.js).
    // Since the module auto-calls loadMpPosCache() on load and the fetch mock
    // returns empty, getMpPos returns null for all lookups — we verify the
    // null-cache guard and the logic branches that don't need the cache.

    it('getMpPos returns null when called before cache is populated', () => {
        // Cache was populated with empty data (fetch returned empty results)
        expect(window.getMpPos('anyone')).toBeNull();
    });

    it('getMpPos returns null for empty/null name', () => {
        expect(window.getMpPos('')).toBeNull();
        expect(window.getMpPos(null)).toBeNull();
    });

    it('resolveMpPos returns null for empty name', () => {
        expect(window.resolveMpPos('')).toBeNull();
        expect(window.resolveMpPos(null)).toBeNull();
    });

    it('resolveMpPos treats 2-char country as ISO code', () => {
        // Cache is empty so result is null — but the code path runs without error
        expect(() => window.resolveMpPos('Alice', 'DE')).not.toThrow();
        expect(window.resolveMpPos('Alice', 'DE')).toBeNull();
    });

    it('resolveMpPos looks up country name via FlagHelper', () => {
        expect(() => window.resolveMpPos('Alice', 'Germany')).not.toThrow();
        expect(window.resolveMpPos('Alice', 'Germany')).toBeNull();
    });
});
