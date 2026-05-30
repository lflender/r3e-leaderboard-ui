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
    loadBrowserScript('modules/tooltip.js');
    loadBrowserScript('modules/charts/pie-chart.js');
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

describe('PieChart.showSliceLabels', () => {
    let chartEl;

    beforeEach(() => {
        document.body.innerHTML = '';
        chartEl = document.createElement('div');
        chartEl.innerHTML = `
            <div class="pie-chart-svg-container" style="position:relative;width:200px;height:200px">
                <svg>
                    <path class="pie-slice pie-slice--active" data-label="Alpha GP" data-mid-angle="0" data-percentage="50"></path>
                    <path class="pie-slice pie-slice--active" data-label="Beta Grand Prix" data-mid-angle="3.14" data-percentage="30"></path>
                    <path class="pie-slice" data-label="Gamma" data-mid-angle="1.57" data-percentage="20"></path>
                </svg>
            </div>`;
        document.body.appendChild(chartEl);
    });

    it('creates labels only for active slices', () => {
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = document.querySelectorAll('.pie-cross-label');
        expect(labels.length).toBe(2);
    });

    it('shortens Grand Prix to GP in labels', () => {
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
        const texts = labels.map(l => l.textContent);
        expect(texts).toContain('Beta GP');
    });

    it('assigns right/left class based on position', () => {
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = document.querySelectorAll('.pie-cross-label');
        const hasRight = Array.from(labels).some(l => l.classList.contains('pie-cross-label--right'));
        const hasLeft = Array.from(labels).some(l => l.classList.contains('pie-cross-label--left'));
        expect(hasRight || hasLeft).toBe(true);
    });

    it('does not create labels when no slices are active', () => {
        chartEl.querySelectorAll('.pie-slice').forEach(s => s.classList.remove('pie-slice--active'));
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        expect(document.querySelectorAll('.pie-cross-label').length).toBe(0);
    });

    it('renders connector lines SVG for active slices', () => {
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const linesSvg = chartEl.querySelector('.pie-connector-lines');
        expect(linesSvg).toBeTruthy();
        expect(linesSvg.querySelectorAll('polyline').length).toBe(2);
    });

    it('positions labels with left and top style percentages', () => {
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = document.querySelectorAll('.pie-cross-label');
        labels.forEach(l => {
            expect(l.style.left).toMatch(/%$/);
            expect(l.style.top).toMatch(/%$/);
        });
    });

    it('places right labels with left > 50% and left labels with left < 50%', () => {
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const right = document.querySelectorAll('.pie-cross-label--right');
        const left = document.querySelectorAll('.pie-cross-label--left');
        right.forEach(l => expect(parseFloat(l.style.left)).toBeGreaterThan(50));
        left.forEach(l => expect(parseFloat(l.style.left)).toBeLessThan(50));
    });

    it('selects bigger slices first when many are active on same side', () => {
        chartEl.innerHTML = `
            <div class="pie-chart-svg-container" style="position:relative;width:200px;height:200px">
                <svg>
                    ${Array.from({ length: 20 }, (_, i) =>
                        `<path class="pie-slice pie-slice--active" data-label="Item${i}" data-mid-angle="${i * 0.1}" data-percentage="${20 - i}"></path>`
                    ).join('')}
                </svg>
            </div>`;
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
        const texts = labels.map(l => l.textContent);
        // Item0 has the biggest pct (20%) — should always be present
        expect(texts).toContain('Item0');
        // Some labels are skipped since there are too many on the same side
        expect(labels.length).toBeLessThan(20);
    });

    it('maintains minimum gap between labels on the same side', () => {
        chartEl.innerHTML = `
            <div class="pie-chart-svg-container" style="position:relative;width:200px;height:200px">
                <svg>
                    ${Array.from({ length: 6 }, (_, i) =>
                        `<path class="pie-slice pie-slice--active" data-label="Car${i}" data-mid-angle="${i * 0.3}" data-percentage="${30 - i * 4}"></path>`
                    ).join('')}
                </svg>
            </div>`;
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = Array.from(document.querySelectorAll('.pie-cross-label--right'));
        const tops = labels.map(l => parseFloat(l.style.top)).sort((a, b) => a - b);
        for (let i = 1; i < tops.length; i++) {
            expect(tops[i] - tops[i - 1]).toBeGreaterThanOrEqual(6.5);
        }
    });

    it('truncates labels longer than 30 characters', () => {
        chartEl.innerHTML = `
            <div class="pie-chart-svg-container" style="position:relative;width:200px;height:200px">
                <svg>
                    <path class="pie-slice pie-slice--active" data-label="This Is A Very Long Label Name That Exceeds Thirty Characters" data-mid-angle="0" data-percentage="100"></path>
                </svg>
            </div>`;
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const label = document.querySelector('.pie-cross-label');
        expect(label.textContent.length).toBeLessThanOrEqual(31); // 30 + ellipsis
        expect(label.textContent).toContain('\u2026');
    });

    it('renders labels in angle order (ascending top values)', () => {
        chartEl.innerHTML = `
            <div class="pie-chart-svg-container" style="position:relative;width:200px;height:200px">
                <svg>
                    <path class="pie-slice pie-slice--active" data-label="Top" data-mid-angle="-1.2" data-percentage="30"></path>
                    <path class="pie-slice pie-slice--active" data-label="Mid" data-mid-angle="0" data-percentage="40"></path>
                    <path class="pie-slice pie-slice--active" data-label="Bot" data-mid-angle="1.2" data-percentage="30"></path>
                </svg>
            </div>`;
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = Array.from(document.querySelectorAll('.pie-cross-label--right'));
        const tops = labels.map(l => parseFloat(l.style.top));
        for (let i = 1; i < tops.length; i++) {
            expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
        }
    });

    it('uses elliptical X offset (further out at middle, closer at top/bottom)', () => {
        chartEl.innerHTML = `
            <div class="pie-chart-svg-container" style="position:relative;width:200px;height:200px">
                <svg>
                    <path class="pie-slice pie-slice--active" data-label="Center" data-mid-angle="0" data-percentage="50"></path>
                    <path class="pie-slice pie-slice--active" data-label="Edge" data-mid-angle="1.5" data-percentage="50"></path>
                </svg>
            </div>`;
        window.PieChart.showSliceLabels(chartEl, chartEl.querySelectorAll('.pie-slice'));
        const labels = Array.from(document.querySelectorAll('.pie-cross-label--right'));
        if (labels.length === 2) {
            const centerX = parseFloat(labels.find(l => l.textContent === 'Center').style.left);
            const edgeX = parseFloat(labels.find(l => l.textContent === 'Edge').style.left);
            // Center label (y~50%) should be further out than edge label (y~92%)
            expect(centerX).toBeGreaterThanOrEqual(edgeX);
        }
    });
});

describe('PieChart.clearSliceLabels', () => {
    it('removes all pie-cross-label elements', () => {
        document.body.innerHTML = '<span class="pie-cross-label">A</span><span class="pie-cross-label">B</span>';
        window.PieChart.clearSliceLabels();
        expect(document.querySelectorAll('.pie-cross-label').length).toBe(0);
    });

    it('removes connector line SVGs', () => {
        document.body.innerHTML = '<svg class="pie-connector-lines"><polyline/></svg><span class="pie-cross-label">X</span>';
        window.PieChart.clearSliceLabels();
        expect(document.querySelectorAll('.pie-connector-lines').length).toBe(0);
        expect(document.querySelectorAll('.pie-cross-label').length).toBe(0);
    });
});

describe('PieChart.render legend scroll', () => {
    it('scrolls legend into view when slice is highlighted', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const data = Array.from({ length: 20 }, (_, i) => ({ label: `Item${i}`, value: 20 - i }));
        window.PieChart.render(container, data, { title: 'Scroll Test' });

        const legend = container.querySelector('.pie-legend');
        // Mock scrollTo
        legend.scrollTo = vi.fn();
        // Simulate getBoundingClientRect for overflow
        const origGetBCR = HTMLElement.prototype.getBoundingClientRect;
        legend.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100 });
        const items = container.querySelectorAll('.pie-legend-item');
        // Make last item appear below viewport
        items[items.length - 1].getBoundingClientRect = () => ({ top: 150, bottom: 170, left: 0, right: 200, width: 200, height: 20 });

        // Trigger highlight on last slice
        const slices = container.querySelectorAll('.pie-slice');
        if (slices.length > 0) {
            slices[slices.length - 1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        }

        expect(legend.scrollTo).toHaveBeenCalled();
    });
});
