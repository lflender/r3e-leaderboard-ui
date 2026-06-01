import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('TeamCharts', () => {
    let tooltipEl;

    beforeEach(() => {
        document.body.innerHTML = '';
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'dist-tooltip';

        window.R3EUtils = { escapeHtml: (v) => String(v ?? ''), resolveTrackLabelForItem: (e) => e.Track || '' };
        window.CSS = { escape: (s) => s.replace(/([^\w-])/g, '\\$1') };
        window.PieChart = { COLORS: ['#aaa', '#bbb', '#ccc', '#ddd'] };
        window.EntriesChart = {
            parseEntryDate: (e) => {
                const raw = e.date_time || e.dateTime || e.Date || '';
                if (!raw) return null;
                const d = new Date(raw);
                return isNaN(d.getTime()) ? null : d;
            },
            getLocalDateKey: (d) => {
                if (!d || isNaN(d.getTime())) return '';
                return d.getFullYear() + '-' +
                    String(d.getMonth() + 1).padStart(2, '0') + '-' +
                    String(d.getDate()).padStart(2, '0');
            },
            buildClassLogoHtmlFromValues: () => ''
        };
        window.Tooltip = {
            getOrCreate: () => tooltipEl,
            show: vi.fn(),
            hide: vi.fn(),
            positionAboveCursor: vi.fn()
        };

        loadBrowserScript('modules/charts/team-charts.js');
    });

    describe('generateEntriesDistribution', () => {
        it('generates bars for each entry per day', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa' },
                { name: 'Bob', date_time: '2026-01-15T11:00:00Z', Car: 'GT4', Track: 'Monza' },
                { name: 'Alice', date_time: '2026-01-16T10:00:00Z', Car: 'GT3', Track: 'Nords' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const html = window.TeamCharts.generateEntriesDistribution(entries, colorMap);

            // Should have 3 bars total (2 on day 1, 1 on day 2)
            const matches = html.match(/class="entries-dist-bar"/g);
            expect(matches.length).toBe(3);
        });

        it('each bar has data-date, data-name, data-car, data-track attributes', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const html = window.TeamCharts.generateEntriesDistribution(entries, colorMap);

            expect(html).toContain('data-date="2026-01-15"');
            expect(html).toContain('data-name="Alice"');
            expect(html).toContain('data-car="GT3"');
            expect(html).toContain('data-track="Spa"');
        });
    });

    describe('wireInteractions - entries dist tooltip', () => {
        function buildDistChart(entries, colorMap) {
            const html = window.TeamCharts.generateEntriesDistribution(entries, colorMap);
            const container = document.createElement('div');
            container.innerHTML = html;
            document.body.appendChild(container);
            return container;
        }

        function simulateMouseMove(svg, clientX, clientY) {
            const rect = { left: 0, top: 0, width: 200, height: 100 };
            svg.getBoundingClientRect = () => rect;
            const event = new MouseEvent('mousemove', {
                clientX,
                clientY,
                bubbles: true
            });
            svg.dispatchEvent(event);
        }

        it('tooltip shows all entries for the hovered date column', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa' },
                { name: 'Bob', date_time: '2026-01-15T11:00:00Z', Car: 'GT4', Track: 'Monza' },
                { name: 'Alice', date_time: '2026-01-16T10:00:00Z', Car: 'LMP2', Track: 'Nords' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const distContainer = buildDistChart(entries, colorMap);
            const perfContainer = document.createElement('div');

            window.TeamCharts.wireInteractions(distContainer, perfContainer);

            const svg = distContainer.querySelector('svg');

            // Hover over the first column (day 1 has 2 entries)
            simulateMouseMove(svg, 10, 50);

            // Tooltip should contain "2 entries" for that date
            expect(tooltipEl.innerHTML).toContain('2 entries');
            expect(tooltipEl.innerHTML).toContain('Alice');
            expect(tooltipEl.innerHTML).toContain('Bob');
            expect(tooltipEl.innerHTML).toContain('2026-01-15');
        });

        it('tooltip shows "1 entry" for a single-entry day', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa' },
                { name: 'Bob', date_time: '2026-01-16T10:00:00Z', Car: 'GT4', Track: 'Monza' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const distContainer = buildDistChart(entries, colorMap);
            const perfContainer = document.createElement('div');

            window.TeamCharts.wireInteractions(distContainer, perfContainer);

            const svg = distContainer.querySelector('svg');

            // Hover over the first column (day 1 has 1 entry)
            simulateMouseMove(svg, 10, 50);

            expect(tooltipEl.innerHTML).toContain('1 entry');
            expect(tooltipEl.innerHTML).not.toContain('1 entries');
        });

        it('tooltip includes car and track details for each entry', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3 RS', Track: 'Spa' },
                { name: 'Bob', date_time: '2026-01-15T11:00:00Z', Car: 'M4 GT4', Track: 'Monza' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const distContainer = buildDistChart(entries, colorMap);
            const perfContainer = document.createElement('div');

            window.TeamCharts.wireInteractions(distContainer, perfContainer);

            const svg = distContainer.querySelector('svg');
            simulateMouseMove(svg, 10, 50);

            expect(tooltipEl.innerHTML).toContain('GT3 RS');
            expect(tooltipEl.innerHTML).toContain('Spa');
            expect(tooltipEl.innerHTML).toContain('M4 GT4');
            expect(tooltipEl.innerHTML).toContain('Monza');
        });

        it('tooltip hides on mouseleave', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const distContainer = buildDistChart(entries, colorMap);
            const perfContainer = document.createElement('div');

            window.TeamCharts.wireInteractions(distContainer, perfContainer);

            const svg = distContainer.querySelector('svg');
            simulateMouseMove(svg, 10, 50);

            expect(window.Tooltip.show).toHaveBeenCalled();

            svg.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            expect(window.Tooltip.hide).toHaveBeenCalled();
        });
    });

    describe('generatePerformanceChart', () => {
        it('returns empty string for empty entries', () => {
            const colorMap = new Map();
            expect(window.TeamCharts.generatePerformanceChart([], colorMap)).toBe('');
        });

        it('returns empty string for non-array entries', () => {
            const colorMap = new Map();
            expect(window.TeamCharts.generatePerformanceChart(null, colorMap)).toBe('');
            expect(window.TeamCharts.generatePerformanceChart(undefined, colorMap)).toBe('');
        });

        it('returns empty string when all entries lack position/total data', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            // No position/total_entries fields
            expect(window.TeamCharts.generatePerformanceChart(entries, colorMap)).toBe('');
        });

        it('generates performance chart with valid entries', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', Car: 'GT3', Track: 'Spa', position: 2, total_entries: 10, car_class: 'GT3', class_id: '5' },
                { name: 'Bob', date_time: '2026-01-16T10:00:00Z', Car: 'GT4', Track: 'Monza', Position: 1, TotalEntries: 5, CarClass: 'GT4' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const html = window.TeamCharts.generatePerformanceChart(entries, colorMap);

            expect(html).toContain('perf-dist-chart');
            expect(html).toContain('perf-dist-point');
            expect(html).toContain('Performance Over Time');
            expect(html).toContain('data-name="Alice"');
            expect(html).toContain('data-name="Bob"');
        });

        it('skips entries with total < 2', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', position: 1, total_entries: 1 },
                { name: 'Bob', date_time: '2026-01-16T10:00:00Z', position: 2, total_entries: 5, Car: 'GT3' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const html = window.TeamCharts.generatePerformanceChart(entries, colorMap);

            // Should only have one point (Bob), Alice has total=1
            expect(html).toContain('data-name="Bob"');
            expect(html).not.toContain('data-name="Alice"');
        });

        it('includes legend in output', () => {
            const entries = [
                { name: 'Alice', date_time: '2026-01-15T10:00:00Z', position: 3, total_entries: 10, Car: 'GT3' }
            ];
            const colorMap = window.TeamCharts.buildColorMap(entries);
            const html = window.TeamCharts.generatePerformanceChart(entries, colorMap);
            expect(html).toContain('team-chart-legend');
        });
    });
});
