import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    window.R3EUtils = {
        escapeHtml: (s) => String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    };
    loadBrowserScript('modules/pie-chart.js');
});

describe('PieChart.computeSlices', () => {
    it('returns empty array for empty input', () => {
        expect(window.PieChart.computeSlices([])).toEqual([]);
    });

    it('returns empty array for null input', () => {
        expect(window.PieChart.computeSlices(null)).toEqual([]);
    });

    it('returns empty array when total is 0', () => {
        expect(window.PieChart.computeSlices([{ label: 'A', value: 0 }])).toEqual([]);
    });

    it('computes correct percentages for single item', () => {
        const slices = window.PieChart.computeSlices([{ label: 'A', value: 10 }]);
        expect(slices).toHaveLength(1);
        expect(slices[0].label).toBe('A');
        expect(slices[0].value).toBe(10);
        expect(slices[0].percentage).toBeCloseTo(100);
        expect(slices[0].color).toBeTruthy();
    });

    it('computes correct percentages for multiple items', () => {
        const data = [
            { label: 'A', value: 50 },
            { label: 'B', value: 30 },
            { label: 'C', value: 20 }
        ];
        const slices = window.PieChart.computeSlices(data);
        expect(slices).toHaveLength(3);
        // Sorted descending by value
        expect(slices[0].label).toBe('A');
        expect(slices[0].percentage).toBeCloseTo(50);
        expect(slices[1].label).toBe('B');
        expect(slices[1].percentage).toBeCloseTo(30);
        expect(slices[2].label).toBe('C');
        expect(slices[2].percentage).toBeCloseTo(20);
    });

    it('renders all items without grouping', () => {
        const data = [];
        for (let i = 0; i < 30; i++) {
            data.push({ label: `Item ${i}`, value: 10 });
        }
        const slices = window.PieChart.computeSlices(data);
        expect(slices).toHaveLength(30);
        expect(slices.every(s => s.label !== 'Other')).toBe(true);
    });

    it('includes midAngle for each slice', () => {
        const data = [
            { label: 'A', value: 50 },
            { label: 'B', value: 50 }
        ];
        const slices = window.PieChart.computeSlices(data);
        slices.forEach(s => {
            expect(typeof s.midAngle).toBe('number');
            expect(Number.isFinite(s.midAngle)).toBe(true);
        });
    });

    it('assigns unique colors to slices', () => {
        const data = [
            { label: 'A', value: 50 },
            { label: 'B', value: 30 },
            { label: 'C', value: 20 }
        ];
        const slices = window.PieChart.computeSlices(data);
        const colors = slices.map(s => s.color);
        expect(new Set(colors).size).toBe(3);
    });

    it('sorts slices by value descending', () => {
        const data = [
            { label: 'Small', value: 5 },
            { label: 'Big', value: 50 },
            { label: 'Medium', value: 20 }
        ];
        const slices = window.PieChart.computeSlices(data);
        expect(slices[0].label).toBe('Big');
        expect(slices[1].label).toBe('Medium');
        expect(slices[2].label).toBe('Small');
    });
});

describe('PieChart.render', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders empty message for no data', () => {
        window.PieChart.render(container, []);
        expect(container.querySelector('.pie-chart-empty')).toBeTruthy();
        expect(container.querySelector('.pie-chart-empty').textContent).toBe('No data');
    });

    it('renders SVG with correct number of slices', () => {
        const data = [
            { label: 'A', value: 50 },
            { label: 'B', value: 30 },
            { label: 'C', value: 20 }
        ];
        window.PieChart.render(container, data, { title: 'Test Chart' });
        const svg = container.querySelector('.pie-chart-svg');
        expect(svg).toBeTruthy();
        const slices = container.querySelectorAll('.pie-slice');
        expect(slices.length).toBe(3);
    });

    it('renders a title when provided', () => {
        window.PieChart.render(container, [{ label: 'X', value: 1 }], { title: 'My Chart' });
        const title = container.querySelector('.pie-chart-title');
        expect(title).toBeTruthy();
        expect(title.textContent).toBe('My Chart');
    });

    it('renders legend items matching slices', () => {
        const data = [
            { label: 'Alpha', value: 10 },
            { label: 'Beta', value: 20 }
        ];
        window.PieChart.render(container, data);
        const legendItems = container.querySelectorAll('.pie-legend-item');
        expect(legendItems.length).toBe(2);
        // Beta should be first (sorted by value)
        expect(legendItems[0].querySelector('.pie-legend-label').textContent).toBe('Beta');
        expect(legendItems[1].querySelector('.pie-legend-label').textContent).toBe('Alpha');
    });

    it('renders a tooltip element (hidden initially)', () => {
        window.PieChart.render(container, [{ label: 'X', value: 1 }]);
        const tooltip = container.querySelector('.pie-tooltip');
        expect(tooltip).toBeTruthy();
        expect(tooltip.hidden).toBe(true);
    });

    it('renders a full circle for 100% single item', () => {
        window.PieChart.render(container, [{ label: 'Only', value: 100 }]);
        const circle = container.querySelector('circle.pie-slice');
        expect(circle).toBeTruthy();
    });

    it('escapes HTML in labels', () => {
        window.PieChart.render(container, [{ label: '<script>alert(1)</script>', value: 1 }]);
        // Legend text content must be escaped
        const legendLabel = container.querySelector('.pie-legend-label');
        expect(legendLabel.textContent).toContain('<script>');
        // No actual script element rendered
        expect(container.querySelector('script')).toBeNull();
    });
});
