import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

// analytics.js embeds the PostHog snippet which, during init(), tries to insert
// a <script> tag relative to the first existing <script> element in the page.
// We must add a stub <script> element before loading so jsdom doesn't throw.
// We also stub posthog.capture before load so we can spy on it after.

let captureSpy;

beforeAll(() => {
    const stubScript = document.createElement('script');
    document.head.appendChild(stubScript);

    // Set up a posthog stub that the module's init() will use.
    // The module's inline snippet overwrites window.posthog but calls back into
    // the stub object's capture() when track() runs.
    // We use a vi.fn() on the stub so we can assert calls.
    captureSpy = vi.fn();
    window._testPosthogStub = { capture: captureSpy };

    loadBrowserScript('modules/analytics.js');

    // After load, swap in our spy onto whatever posthog object the module now uses.
    // posthog.capture is called by the module's track() via the global posthog ref.
    if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture = captureSpy;
    }
});

beforeEach(() => {
    captureSpy.mockClear();
});

describe('R3EAnalytics.track', () => {
    it('does not throw for any input', () => {
        expect(() => window.R3EAnalytics.track('test event', { key: 'value' })).not.toThrow();
        expect(() => window.R3EAnalytics.track('test event')).not.toThrow();
        expect(() => window.R3EAnalytics.track()).not.toThrow();
    });

    it('calls posthog.capture when _ready is true', () => {
        window.R3EAnalytics.track('checkout', { item: 'car' });
        expect(captureSpy).toHaveBeenCalledWith('checkout', { item: 'car' });
    });

    it('passes empty object when no properties given', () => {
        window.R3EAnalytics.track('page_viewed');
        expect(captureSpy).toHaveBeenCalledWith('page_viewed', {});
    });

    it('does not throw when posthog.capture throws', () => {
        captureSpy.mockImplementationOnce(() => { throw new Error('SDK fail'); });
        expect(() => window.R3EAnalytics.track('broken', {})).not.toThrow();
    });
});

describe('R3EAnalytics public API shape', () => {
    it('exposes init and track', () => {
        expect(typeof window.R3EAnalytics.init).toBe('function');
        expect(typeof window.R3EAnalytics.track).toBe('function');
    });
});
