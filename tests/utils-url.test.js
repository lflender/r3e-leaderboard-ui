import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

describe('R3EUrlUtils', () => {
    beforeAll(() => {
        loadBrowserScript('modules/utils-url.js');
    });

    beforeEach(() => {
        window.history.replaceState({}, '', '/');
    });

    test('reads query parameters', () => {
        window.history.replaceState({}, '', '/?driver=Alex&track=10');
        expect(window.R3EUrlUtils.getUrlParam('driver')).toBe('Alex');
        expect(window.R3EUrlUtils.getUrlParam('track')).toBe('10');
        expect(window.R3EUrlUtils.getUrlParam('missing')).toBeNull();
    });

    test('updates and removes query parameters', () => {
        window.history.replaceState({}, '', '/?driver=Alex');
        window.R3EUrlUtils.updateUrlParam('driver', 'Sam');
        expect(new URL(window.location.href).searchParams.get('driver')).toBe('Sam');

        window.R3EUrlUtils.updateUrlParam('driver', '');
        expect(new URL(window.location.href).searchParams.get('driver')).toBeNull();
    });
});