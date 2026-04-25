import { beforeEach, describe, expect, test } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('StatsRenderer', () => {
    beforeEach(() => {
        delete window.StatsRenderer;
        delete window.FlagHelper;
        delete window.resolveMpPos;
        delete window.getMpPosNameClasses;
        window.R3EUtils = {
            escapeHtml: (v) => String(v == null ? '' : v)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        };
        document.body.innerHTML = '<div id="container"></div>';
        loadBrowserScript('modules/stats-renderer.js');
    });

    test('renders an empty state when rows are missing', () => {
        const container = document.getElementById('container');
        window.StatsRenderer.renderTable(container, [], 'Poles');
        expect(container.innerHTML).toContain('stats-empty');
        expect(container.innerHTML).toContain('No data available');
    });

    test('renders rows using the default formatter (toLocaleString)', () => {
        const container = document.getElementById('container');
        window.StatsRenderer.renderTable(container, [
            { name: 'Alice', country: 'SE', rank: 'A', value: 1234 },
            { name: 'Bob', country: 'DE', rank: 'B', value: 99 }
        ], 'Poles');

        const html = container.innerHTML;
        expect(html).toContain('<table class="results-table stats-table">');
        expect(html).toContain('Alice');
        expect(html).toContain('Bob');
        // 1234 should be locale-formatted (e.g. 1,234 in en-US). At minimum it must contain the digits.
        expect(html).toMatch(/1[\s.,]?234/);
        // Position badges
        expect(html).toContain('pos-1');
        expect(html).toContain('pos-2');
    });

    test('uses a custom valueFormatter when provided (percentile with 2 decimals)', () => {
        const container = document.getElementById('container');
        window.StatsRenderer.renderTable(container, [
            { name: 'Alice', country: 'SE', rank: 'A', value: 12.5 }
        ], 'Avg %', { valueFormatter: (v) => v.toFixed(2) });

        expect(container.innerHTML).toContain('12.50');
    });

    test('escapes HTML in value title and driver name', () => {
        const container = document.getElementById('container');
        window.StatsRenderer.renderTable(container, [
            { name: '<script>x</script>', country: '', rank: '', value: 1 }
        ], '<bad>');

        expect(container.innerHTML).not.toContain('<script>x</script>');
        expect(container.innerHTML).toContain('&lt;script&gt;');
        expect(container.innerHTML).toContain('&lt;bad&gt;');
    });
});
