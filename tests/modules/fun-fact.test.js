import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

// fun-fact.js is an async IIFE – it fires on load and resolves asynchronously.
// Tests set up DOM + fetch mock, load the script, then flush microtasks.

const FACTS_PAYLOAD = { Facts: [{ Fact: 'The sky is blue.' }] };

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function mockFetchOk(payload) {
    window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload)
    });
}

function mockFetchFail() {
    window.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
}

beforeEach(() => {
    // Reset location search (jsdom)
    Object.defineProperty(window, 'location', {
        writable: true,
        value: Object.assign({}, window.location, { search: '' })
    });
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('fun-fact banner — no banner element', () => {
    it('does not throw when #fun-fact-banner is absent', async () => {
        document.body.innerHTML = '';
        mockFetchOk(FACTS_PAYLOAD);
        expect(() => loadBrowserScript('modules/fun-fact.js')).not.toThrow();
        await flushPromises();
    });
});

describe('fun-fact banner — fetch succeeds', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="fun-fact-banner" hidden></div>
            <input id="driver-search" type="text" value="" />
        `;
        mockFetchOk(FACTS_PAYLOAD);
    });

    it('populates banner with fact content', async () => {
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.innerHTML).toContain('The sky is blue.');
    });

    it('makes banner visible when search input is empty', async () => {
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.hidden).toBe(false);
    });

    it('keeps banner hidden when search input has text', async () => {
        document.getElementById('driver-search').value = 'Alice';
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.hidden).toBe(true);
    });

    it('keeps banner hidden when URL has driver param', async () => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: Object.assign({}, window.location, { search: '?driver=Alice' })
        });
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.hidden).toBe(true);
    });

    it('keeps banner hidden when URL has query param', async () => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: Object.assign({}, window.location, { search: '?query=something' })
        });
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.hidden).toBe(true);
    });
});

describe('fun-fact banner — fetch fails', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="fun-fact-banner" hidden></div>`;
        mockFetchFail();
    });

    it('leaves banner empty on HTTP error', async () => {
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.innerHTML).toBe('');
    });
});

describe('fun-fact banner — empty facts array', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="fun-fact-banner" hidden></div>`;
        window.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ Facts: [] })
        });
    });

    it('leaves banner empty when facts array is empty', async () => {
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();
        const banner = document.getElementById('fun-fact-banner');
        expect(banner.innerHTML).toBe('');
    });
});

describe('fun-fact banner — search input changes', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="fun-fact-banner" hidden></div>
            <input id="driver-search" type="text" value="" />
        `;
        mockFetchOk(FACTS_PAYLOAD);
    });

    it('hides banner when search input fires input event after banner shown', async () => {
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();

        const banner = document.getElementById('fun-fact-banner');
        const input = document.getElementById('driver-search');
        expect(banner.hidden).toBe(false);

        input.value = 'Alice';
        input.dispatchEvent(new Event('input'));
        expect(banner.hidden).toBe(true);
    });

    it('shows banner again when search is cleared', async () => {
        loadBrowserScript('modules/fun-fact.js');
        await flushPromises();

        const input = document.getElementById('driver-search');
        const banner = document.getElementById('fun-fact-banner');

        input.value = 'Alice';
        input.dispatchEvent(new Event('input'));
        expect(banner.hidden).toBe(true);

        input.value = '';
        input.dispatchEvent(new Event('input'));
        expect(banner.hidden).toBe(false);
    });
});
