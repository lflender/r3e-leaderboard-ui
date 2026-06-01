import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

describe('script.js — badge dismissal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        // Reset location to a non-records page
        window.history.replaceState({}, '', '/index.html');
        // Provide dataService stub
        window.dataService = { loadDriverIndex: vi.fn() };
        window.requestIdleCallback = vi.fn((cb) => cb());
    });

    test('hides badges immediately when already on records page', () => {
        document.body.innerHTML = '<a href="records.html"><span class="tab-badge">NEW!</span></a>';
        window.history.replaceState({}, '', '/records.html');

        loadBrowserScript('script.js');

        const badge = document.querySelector('.tab-badge');
        expect(badge.hidden).toBe(true);
        expect(localStorage.getItem('records_new_badge_dismissed')).toBe('1');
    });

    test('hides badges immediately when already dismissed in localStorage', () => {
        localStorage.setItem('records_new_badge_dismissed', '1');
        document.body.innerHTML = '<a href="records.html"><span class="tab-badge">NEW!</span></a>';

        loadBrowserScript('script.js');

        const badge = document.querySelector('.tab-badge');
        expect(badge.hidden).toBe(true);
    });

    test('binds click handler to dismiss badges on first click', () => {
        document.body.innerHTML = '<a href="records.html"><span class="tab-badge">NEW!</span></a>';

        loadBrowserScript('script.js');

        const badge = document.querySelector('.tab-badge');
        expect(badge.hidden).not.toBe(true);

        // Simulate click
        const link = document.querySelector('a[href="records.html"]');
        link.click();

        expect(badge.hidden).toBe(true);
        expect(localStorage.getItem('records_new_badge_dismissed')).toBe('1');
    });
});

describe('script.js — driver index preload', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        // Already dismissed so badge IIFE exits early via return
        localStorage.setItem('records_new_badge_dismissed', '1');
        window.history.replaceState({}, '', '/index.html');
        window.dataService = { loadDriverIndex: vi.fn() };
        window.requestIdleCallback = undefined;
    });

    test('preloads driver index immediately on driver search page', () => {
        document.body.innerHTML = '<div id="driver-search"></div>';
        window.requestIdleCallback = vi.fn();

        loadBrowserScript('script.js');

        expect(window.dataService.loadDriverIndex).toHaveBeenCalled();
        expect(window.requestIdleCallback).not.toHaveBeenCalled();
    });

    test('defers driver index preload via requestIdleCallback on other pages', () => {
        document.body.innerHTML = '<div id="some-other-content"></div>';
        const idleCb = vi.fn((cb) => cb());
        window.requestIdleCallback = idleCb;

        loadBrowserScript('script.js');

        expect(idleCb).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
        expect(window.dataService.loadDriverIndex).toHaveBeenCalled();
    });

    test('falls back to setTimeout when requestIdleCallback is unavailable', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="some-other-content"></div>';
        window.requestIdleCallback = undefined;

        loadBrowserScript('script.js');

        expect(window.dataService.loadDriverIndex).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(window.dataService.loadDriverIndex).toHaveBeenCalled();
        vi.useRealTimers();
    });

    test('does not throw when dataService.loadDriverIndex throws', () => {
        document.body.innerHTML = '<div id="driver-search"></div>';
        window.dataService = { loadDriverIndex: vi.fn(() => { throw new Error('fail'); }) };

        expect(() => loadBrowserScript('script.js')).not.toThrow();
    });
});
