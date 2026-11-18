import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('shared database status component', () => {
    beforeAll(async () => {
        document.body.innerHTML = '';
        window.TRACKS_DATA = [{ id: 1 }];
        window.R3EUtils = {
            fetchWithTimeout: vi.fn().mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify({
                    last_scrape_end: '2026-11-18T10:00:00Z',
                    total_unique_tracks: 12,
                    track_count: 34,
                    total_fetched_combinations: 56,
                    total_drivers: 789,
                    total_entries: 1234
                })
            })
        };
        loadBrowserScript('modules/data-service.js');
        loadBrowserScript('modules/status-display.js');
        if (!window.statusDisplay) {
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }
        await window.statusDisplay.ready;
    });

    beforeEach(() => {
        window.R3EUtils.fetchWithTimeout.mockClear();
    });

    it.each([
        ['index.html', 'h2', true],
        ['pages/drivers.html', 'h2', false],
        ['pages/leaderboards.html', 'h3', false],
        ['pages/records.html', 'h3', false]
    ])('renders and populates the shared panel on %s', async (file, heading, beforeAbout) => {
        const html = readFileSync(file, 'utf8');
        const page = new DOMParser().parseFromString(html, 'text/html');
        const scripts = [...page.querySelectorAll('script[src]')].map(script => script.getAttribute('src'));
        const dataServiceScript = scripts.findIndex(src => src.startsWith('modules/data-service.js?'));
        const statusDisplayScript = scripts.findIndex(src => src.startsWith('modules/status-display.js?'));
        expect(dataServiceScript).toBeGreaterThanOrEqual(0);
        expect(statusDisplayScript).toBeGreaterThan(dataServiceScript);

        document.body.innerHTML = page.body.innerHTML;
        const status = document.getElementById('status-container');
        const about = document.querySelector('.seo-content');
        expect(status.hasAttribute('data-status-component')).toBe(true);
        expect(status.children).toHaveLength(0);
        const aboutFollows = Boolean(status.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING);
        expect(aboutFollows).toBe(beforeAbout);

        const display = new window.statusDisplay.constructor();
        await display.ready;

        expect(status.querySelector(heading).textContent).toContain('Database Status');
        expect(document.getElementById('status-entries').textContent).toBe((1234).toLocaleString());
        expect(window.R3EUtils.fetchWithTimeout).toHaveBeenCalledWith(
            expect.stringMatching(/^cache\/status\.json\?v=/),
            expect.any(Object),
            5000
        );
        expect(document.getElementById('status-tracks').textContent).toBe('12');
        expect(document.getElementById('status-combinations').textContent).toBe('34');
        expect(document.getElementById('status-total-combinations').textContent).toBe('56');
        expect(document.getElementById('status-drivers').textContent).toBe('789');
        expect(document.getElementById('status-timestamp').textContent).not.toBe('-');
    });
});
