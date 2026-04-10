import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

beforeEach(() => {
    document.body.innerHTML = '<div id="news-content"></div>';
    window.R3EUtils = {
        escapeHtml: s => String(s)
    };
});

describe('news integration', () => {
    it('renders fetched Steam news items and footer link', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        title: 'Patch Notes 1.2',
                        link: 'https://example.com/post-1',
                        pubDate: '2025-07-01T12:00:00Z',
                        description: '<p>Line 1</p><p>Line 2</p>',
                        content: '<img src="https://example.com/img.jpg" />',
                        categories: ['patch notes']
                    }
                ]
            })
        });

        loadBrowserScript('pages/news.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('news-content').innerHTML;
        expect(html).toContain('Patch Notes 1.2');
        expect(html).toContain('Read on Steam');
        expect(html).toContain('More on Steam');
    });

    it('shows fallback error UI when fetch fails', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

        loadBrowserScript('pages/news.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('news-content').innerHTML;
        expect(html).toContain('Unable to load Steam news in-page.');
        expect(html).toContain('Open Steam News');
    });

    it('returns early with no-op when #news-content is missing', () => {
        document.body.innerHTML = '<div id="other"></div>';
        global.fetch = vi.fn();

        expect(() => loadBrowserScript('pages/news.js')).not.toThrow();
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
