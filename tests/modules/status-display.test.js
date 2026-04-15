import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

// StatusDisplay auto-inits on load and does NOT export the class to window.
// Load once with DOM in place; subsequent tests get the constructor from the
// auto-created instance via window.statusDisplay.constructor.
beforeAll(() => {
    window.dataService = { calculateStatus: vi.fn().mockResolvedValue(null) };
    window.TRACKS_DATA = null;
    document.body.innerHTML = buildStatusDOM();
    loadBrowserScript('modules/status-display.js');
    // window.statusDisplay is now set; .constructor is the StatusDisplay class
});

beforeEach(() => {
    window.dataService = { calculateStatus: vi.fn().mockResolvedValue(null) };
    window.TRACKS_DATA = null;
    document.body.innerHTML = buildStatusDOM();
});

function buildStatusDOM() {
    return `
        <span id="status-timestamp"></span>
        <span id="status-timestamp-label"></span>
        <span id="status-tracks"></span>
        <span id="status-combinations"></span>
        <span id="status-total-combinations"></span>
        <span id="status-entries"></span>
        <span id="status-drivers"></span>
        <span id="status-led" class="status-led"></span>
    `;
}

function makeInstance() {
    // Use .constructor from the auto-init instance to create fresh instances
    return new window.statusDisplay.constructor();
}

// ---------------------------------------------------------------------------
// displayStatus – timestamp label
// ---------------------------------------------------------------------------
describe('StatusDisplay.displayStatus – timestamp label', () => {
    it('shows "Last complete update:" when fetch is not in progress', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: false } });
        expect(document.getElementById('status-timestamp-label').textContent)
            .toBe('Last complete update:');
    });

    it('shows "Last partial update:" when fetch is in progress (boolean)', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: true } });
        expect(document.getElementById('status-timestamp-label').textContent)
            .toBe('Last partial update:');
    });

    it('shows "Last partial update:" when fetch_in_progress is the string "true"', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: 'true' } });
        expect(document.getElementById('status-timestamp-label').textContent)
            .toBe('Last partial update:');
    });
});

// ---------------------------------------------------------------------------
// displayStatus – timestamp value
// ---------------------------------------------------------------------------
describe('StatusDisplay.displayStatus – timestamp value', () => {
    it('formats last_scrape_end when not fetching', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: false, last_scrape_end: '2025-06-15T14:00:00Z' } });
        const text = document.getElementById('status-timestamp').textContent;
        // Locale format is locale-dependent; just assert it's not empty or '-'
        expect(text).not.toBe('');
        expect(text).not.toBe('-');
    });

    it('formats last_index_update when fetching', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: true, last_index_update: '2025-06-15T08:00:00Z' } });
        const text = document.getElementById('status-timestamp').textContent;
        expect(text).not.toBe('');
        expect(text).not.toBe('-');
    });

    it('shows "-" when relevant timestamp is missing', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: false } });
        expect(document.getElementById('status-timestamp').textContent).toBe('-');
    });
});

// ---------------------------------------------------------------------------
// displayStatus – counts
// ---------------------------------------------------------------------------
describe('StatusDisplay.displayStatus – count fields', () => {
    it('displays all numeric stats', () => {
        const sd = makeInstance();
        sd.displayStatus({
            data: {
                total_unique_tracks: 177,
                track_count: 500,
                total_fetched_combinations: 1200,
                total_entries: 999999,
                total_drivers: 42000,
                fetch_in_progress: false
            }
        });
        // toLocaleString() separator varies by Node/jsdom locale (',' or '\u202f' etc.)
        // Strip non-digits and compare the raw number to stay locale-agnostic.
        const stripSep = s => s.replace(/\D/g, '');
        expect(stripSep(document.getElementById('status-tracks').textContent)).toBe('177');
        expect(stripSep(document.getElementById('status-combinations').textContent)).toBe('500');
        expect(stripSep(document.getElementById('status-total-combinations').textContent)).toBe('1200');
        expect(stripSep(document.getElementById('status-entries').textContent)).toBe('999999');
        expect(stripSep(document.getElementById('status-drivers').textContent)).toBe('42000');
    });

    it('defaults to 0 when counts are missing', () => {
        const sd = makeInstance();
        sd.displayStatus({ data: { fetch_in_progress: false } });
        expect(document.getElementById('status-tracks').textContent).toBe('0');
        expect(document.getElementById('status-drivers').textContent).toBe('0');
    });

    it('accepts flat data without nested "data" property', () => {
        const sd = makeInstance();
        sd.displayStatus({ total_unique_tracks: 42, total_drivers: 7, fetch_in_progress: false });
        expect(document.getElementById('status-tracks').textContent).toBe('42');
        expect(document.getElementById('status-drivers').textContent).toBe('7');
    });
});

// ---------------------------------------------------------------------------
// updateStatusLed
// ---------------------------------------------------------------------------
describe('StatusDisplay.updateStatusLed – LED colour logic', () => {
    function ledClass() {
        return document.getElementById('status-led').className;
    }
    function ledTitle() {
        return document.getElementById('status-led').title;
    }

    it('sets green when track count is sufficient and update is recent', () => {
        const sd = makeInstance();
        const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
        sd.updateStatusLed({ total_unique_tracks: 177, last_scrape_end: recent }, false);
        expect(ledClass()).toContain('green');
        expect(ledTitle()).toBe('Ready');
    });

    it('sets red when track count is below expected (highest priority)', () => {
        const sd = makeInstance();
        const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        sd.updateStatusLed({ total_unique_tracks: 100, last_scrape_end: recent }, false);
        expect(ledClass()).toContain('red');
        expect(ledTitle()).toBe('Incomplete');
    });

    it('sets yellow when update is older than 24 hours and tracks are full', () => {
        const sd = makeInstance();
        const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
        sd.updateStatusLed({ total_unique_tracks: 177, last_scrape_end: stale }, false);
        expect(ledClass()).toContain('yellow');
        expect(ledTitle()).toBe('Stale');
    });

    it('red takes priority over stale: red even when stale if tracks are incomplete', () => {
        const sd = makeInstance();
        const stale = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        sd.updateStatusLed({ total_unique_tracks: 50, last_scrape_end: stale }, false);
        expect(ledClass()).toContain('red');
        expect(ledTitle()).toBe('Incomplete');
    });

    it('adds "fetching" class when fetch_in_progress is true', () => {
        const sd = makeInstance();
        const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        sd.updateStatusLed(
            { total_unique_tracks: 177, last_index_update: recent },
            true
        );
        expect(ledClass()).toContain('fetching');
    });

    it('does NOT add "fetching" class when fetch_in_progress is false', () => {
        const sd = makeInstance();
        const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        sd.updateStatusLed({ total_unique_tracks: 177, last_scrape_end: recent }, false);
        expect(ledClass()).not.toContain('fetching');
    });

    it('uses window.TRACKS_DATA.length when available', () => {
        window.TRACKS_DATA = Array(200).fill(null); // expect 200 tracks
        const sd = makeInstance();
        const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        // 177 tracks but 200 expected → should be red
        sd.updateStatusLed({ total_unique_tracks: 177, last_scrape_end: recent }, false);
        expect(ledClass()).toContain('red');
        window.TRACKS_DATA = null;
    });
});

