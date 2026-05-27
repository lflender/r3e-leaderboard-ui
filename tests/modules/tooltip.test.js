import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/tooltip.js');
});

describe('Tooltip module', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    describe('getOrCreate', () => {
        it('creates a tooltip element if none exists', () => {
            const tooltip = window.Tooltip.getOrCreate(container, 'dist-tooltip');
            expect(tooltip).toBeInstanceOf(HTMLElement);
            expect(tooltip.className).toBe('dist-tooltip');
            expect(container.contains(tooltip)).toBe(true);
        });

        it('returns existing tooltip if one already exists', () => {
            const existing = document.createElement('div');
            existing.className = 'dist-tooltip';
            container.appendChild(existing);

            const tooltip = window.Tooltip.getOrCreate(container, 'dist-tooltip');
            expect(tooltip).toBe(existing);
            expect(container.querySelectorAll('.dist-tooltip').length).toBe(1);
        });

        it('uses dist-tooltip as default class', () => {
            const tooltip = window.Tooltip.getOrCreate(container);
            expect(tooltip.className).toBe('dist-tooltip');
        });

        it('supports custom class names', () => {
            const tooltip = window.Tooltip.getOrCreate(container, 'pie-tooltip');
            expect(tooltip.className).toBe('pie-tooltip');
        });
    });

    describe('show', () => {
        it('makes tooltip visible', () => {
            const tooltip = document.createElement('div');
            tooltip.hidden = true;
            tooltip.style.display = 'none';

            window.Tooltip.show(tooltip);

            expect(tooltip.hidden).toBe(false);
            expect(tooltip.style.display).toBe('block');
        });
    });

    describe('hide', () => {
        it('hides tooltip', () => {
            const tooltip = document.createElement('div');
            tooltip.hidden = false;
            tooltip.style.display = 'block';

            window.Tooltip.hide(tooltip);

            expect(tooltip.hidden).toBe(true);
            expect(tooltip.style.display).toBe('none');
        });
    });

    describe('positionAboveCursor', () => {
        it('positions tooltip centered above cursor', () => {
            const tooltip = document.createElement('div');
            container.style.position = 'relative';
            container.appendChild(tooltip);

            // Mock dimensions
            Object.defineProperty(tooltip, 'offsetWidth', { value: 100, configurable: true });
            Object.defineProperty(tooltip, 'offsetHeight', { value: 30, configurable: true });

            container.getBoundingClientRect = () => ({
                left: 50, top: 100, width: 400, height: 300, right: 450, bottom: 400
            });

            const event = { clientX: 250, clientY: 250 };
            window.Tooltip.positionAboveCursor(event, container, tooltip);

            // x relative to container = 250 - 50 = 200
            // left = 200 - 100/2 = 150
            expect(tooltip.style.left).toBe('150px');
            // top = (250-100) - 30 - 10 = 110
            expect(tooltip.style.top).toBe('110px');
        });

        it('clamps tooltip to left edge of container', () => {
            const tooltip = document.createElement('div');
            container.appendChild(tooltip);

            Object.defineProperty(tooltip, 'offsetWidth', { value: 100, configurable: true });
            Object.defineProperty(tooltip, 'offsetHeight', { value: 30, configurable: true });

            container.getBoundingClientRect = () => ({
                left: 50, top: 100, width: 400, height: 300, right: 450, bottom: 400
            });

            // Cursor very close to left edge: x=60, relative=10, left would be 10-50=-40
            const event = { clientX: 60, clientY: 200 };
            window.Tooltip.positionAboveCursor(event, container, tooltip);

            expect(parseFloat(tooltip.style.left)).toBeGreaterThanOrEqual(0);
        });

        it('clamps tooltip to right edge of container', () => {
            const tooltip = document.createElement('div');
            container.appendChild(tooltip);

            Object.defineProperty(tooltip, 'offsetWidth', { value: 100, configurable: true });
            Object.defineProperty(tooltip, 'offsetHeight', { value: 30, configurable: true });

            container.getBoundingClientRect = () => ({
                left: 50, top: 100, width: 400, height: 300, right: 450, bottom: 400
            });

            // Cursor near right edge: x=440, relative=390, left would be 390-50=340, 340+100=440 > 400
            const event = { clientX: 440, clientY: 200 };
            window.Tooltip.positionAboveCursor(event, container, tooltip);

            expect(parseFloat(tooltip.style.left)).toBeLessThanOrEqual(300); // 400-100=300
        });

        it('respects custom offsetY', () => {
            const tooltip = document.createElement('div');
            container.appendChild(tooltip);

            Object.defineProperty(tooltip, 'offsetWidth', { value: 80, configurable: true });
            Object.defineProperty(tooltip, 'offsetHeight', { value: 20, configurable: true });

            container.getBoundingClientRect = () => ({
                left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400
            });

            const event = { clientX: 300, clientY: 200 };
            window.Tooltip.positionAboveCursor(event, container, tooltip, { offsetY: -20 });

            // top = 200 - 20 + (-20) = 160
            expect(tooltip.style.top).toBe('160px');
        });
    });

    describe('positionNearCursor', () => {
        it('positions tooltip offset from cursor with defaults', () => {
            const tooltip = document.createElement('div');
            container.appendChild(tooltip);

            container.getBoundingClientRect = () => ({
                left: 100, top: 50, width: 400, height: 300, right: 500, bottom: 350
            });

            const event = { clientX: 250, clientY: 150 };
            window.Tooltip.positionNearCursor(event, container, tooltip);

            // x = 250-100=150, left = 150+12=162
            expect(tooltip.style.left).toBe('162px');
            // y = 150-50=100, top = 100+(-8)=92
            expect(tooltip.style.top).toBe('92px');
        });

        it('respects custom offsets', () => {
            const tooltip = document.createElement('div');
            container.appendChild(tooltip);

            container.getBoundingClientRect = () => ({
                left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300
            });

            const event = { clientX: 200, clientY: 100 };
            window.Tooltip.positionNearCursor(event, container, tooltip, { offsetX: 20, offsetY: -15 });

            expect(tooltip.style.left).toBe('220px');
            expect(tooltip.style.top).toBe('85px');
        });
    });

    describe('escapeHtml', () => {
        it('escapes HTML special characters', () => {
            expect(window.Tooltip.escapeHtml('<script>"alert"</script>')).toBe(
                '&lt;script&gt;&quot;alert&quot;&lt;/script&gt;'
            );
        });

        it('escapes ampersands', () => {
            expect(window.Tooltip.escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('handles null and undefined', () => {
            expect(window.Tooltip.escapeHtml(null)).toBe('');
            expect(window.Tooltip.escapeHtml(undefined)).toBe('');
        });

        it('converts non-strings to string', () => {
            expect(window.Tooltip.escapeHtml(42)).toBe('42');
        });
    });
});
