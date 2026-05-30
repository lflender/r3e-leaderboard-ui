import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    window.R3EUtils = {
        escapeHtml: (s) => String(s || ''),
        resolveTrackLabelForItem: vi.fn(e => e.Track || '')
    };
    window.EntriesChart = {
        parseEntryDate: vi.fn(e => e.date ? new Date(e.date) : null),
        getLocalDateKey: vi.fn(d => d ? d.toISOString().slice(0, 10) : null)
    };
    loadBrowserScript('modules/charts/performance-chart.js');
});

describe('PerformanceChart', () => {
    describe('generateHtml', () => {
        it('returns empty string when EntriesChart is not available', () => {
            const original = window.EntriesChart;
            window.EntriesChart = undefined;
            const html = PerformanceChart.generateHtml([{ position: 1, total_entries: 10, date: '2025-06-01' }]);
            expect(html).toBe('');
            window.EntriesChart = original;
        });

        it('returns empty string when no entries have valid dates', () => {
            window.EntriesChart.parseEntryDate.mockReturnValueOnce(null);
            const html = PerformanceChart.generateHtml([{ position: 1, total_entries: 10 }]);
            expect(html).toBe('');
        });

        it('returns empty string for empty array', () => {
            expect(PerformanceChart.generateHtml([])).toBe('');
        });

        it('skips entries with total_entries < 2', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            const html = PerformanceChart.generateHtml([
                { position: 1, total_entries: 1, Car: 'BMW', car_class: 'GT3', date: '2025-06-01' }
            ]);
            expect(html).toBe('');
        });

        it('skips entries without position', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            const html = PerformanceChart.generateHtml([
                { position: 0, total_entries: 10, Car: 'BMW', date: '2025-06-01' }
            ]);
            expect(html).toBe('');
        });

        it('renders chart structure with valid entries', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            const html = PerformanceChart.generateHtml([
                { position: 3, total_entries: 10, Car: 'BMW M4', Track: 'Spa', car_class: 'GT3', date: '2025-06-01' }
            ]);

            expect(html).toContain('perf-dist-chart');
            expect(html).toContain('Performance Over Time');
            expect(html).toContain('perf-dist-point');
            expect(html).toContain('driver-profile-dist-card');
            expect(html).toContain('entries-dist-summary');
        });

        it('renders Y-axis labels', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            const html = PerformanceChart.generateHtml([
                { position: 5, total_entries: 20, Car: 'A', date: '2025-06-01' }
            ]);

            expect(html).toContain('perf-dist-y-top');
            expect(html).toContain('100%');
            expect(html).toContain('perf-dist-y-mid');
            expect(html).toContain('50%');
            expect(html).toContain('perf-dist-y-bottom');
            expect(html).toContain('0%');
        });

        it('renders grid lines at 25%, 50%, 75%', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            const html = PerformanceChart.generateHtml([
                { position: 5, total_entries: 20, Car: 'A', date: '2025-06-01' }
            ]);

            expect(html).toContain('style="top:25%"');
            expect(html).toContain('style="top:50%"');
            expect(html).toContain('style="top:75%"');
        });

        it('calculates bested percentage correctly', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            // position=3, total=10 → bested = (10-3)/(10-1)*100 = 77.8%
            const html = PerformanceChart.generateHtml([
                { position: 3, total_entries: 10, Car: 'BMW', date: '2025-06-01' }
            ]);

            expect(html).toContain('data-pct="77.8"');
        });

        it('places point with correct top percentage (inverted)', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            // bested = 77.8%, top = 100 - 77.8 = 22.2%
            const html = PerformanceChart.generateHtml([
                { position: 3, total_entries: 10, Car: 'BMW', date: '2025-06-01' }
            ]);

            expect(html).toContain('top:22.222%');
        });

        it('distributes points evenly across horizontal axis', () => {
            const dates = ['2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01'];
            window.EntriesChart.parseEntryDate.mockImplementation(e => new Date(e.date));
            window.EntriesChart.getLocalDateKey.mockImplementation(d => d.toISOString().slice(0, 10));

            const entries = dates.map(d => ({
                position: 5, total_entries: 20, Car: 'BMW', date: d
            }));

            const html = PerformanceChart.generateHtml(entries);

            // 4 points: left = (idx+0.5)/4 * 100 → 12.5%, 37.5%, 62.5%, 87.5%
            expect(html).toContain('left:12.500%');
            expect(html).toContain('left:37.500%');
            expect(html).toContain('left:62.500%');
            expect(html).toContain('left:87.500%');
        });

        it('sorts points by date', () => {
            window.EntriesChart.parseEntryDate.mockImplementation(e => new Date(e.date));
            window.EntriesChart.getLocalDateKey.mockImplementation(d => d.toISOString().slice(0, 10));

            const entries = [
                { position: 1, total_entries: 10, Car: 'Late', date: '2025-06-01' },
                { position: 5, total_entries: 10, Car: 'Early', date: '2025-01-01' }
            ];

            const html = PerformanceChart.generateHtml(entries);

            // First point (left:12.5%) should be the earlier date entry (Early)
            const firstPoint = html.match(/perf-dist-point[^>]*data-info="([^"]+)"/);
            expect(firstPoint[1]).toContain('Early');
        });

        it('renders date axis with first and last dates', () => {
            window.EntriesChart.parseEntryDate.mockImplementation(e => new Date(e.date));
            window.EntriesChart.getLocalDateKey.mockImplementation(d => d.toISOString().slice(0, 10));

            const entries = [
                { position: 3, total_entries: 10, Car: 'A', date: '2025-01-15' },
                { position: 5, total_entries: 10, Car: 'B', date: '2025-06-20' }
            ];

            const html = PerformanceChart.generateHtml(entries);

            expect(html).toContain('entries-dist-axis-left');
            expect(html).toContain('2025-01-15');
            expect(html).toContain('entries-dist-axis-right');
            expect(html).toContain('2025-06-20');
        });

        it('includes car and track info in data attributes', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');
            window.R3EUtils.resolveTrackLabelForItem.mockReturnValue('Spa');

            const html = PerformanceChart.generateHtml([
                { position: 2, total_entries: 5, Car: 'BMW M4', Track: 'Spa', car_class: 'GT3', class_id: 1923, date: '2025-06-01' }
            ]);

            expect(html).toContain('data-class="GT3"');
            expect(html).toContain('data-class-id="1923"');
            expect(html).toContain('data-pos="2"');
            expect(html).toContain('data-total="5"');
        });

        it('renders toggle button with aria attributes', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            const html = PerformanceChart.generateHtml([
                { position: 3, total_entries: 10, Car: 'A', date: '2025-06-01' }
            ]);

            expect(html).toContain('aria-expanded="true"');
            expect(html).toContain('aria-controls=');
            expect(html).toContain('entries-dist-toggle');
        });

        it('handles entries with alternative field names', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');
            window.R3EUtils.resolveTrackLabelForItem.mockReturnValue('');

            const html = PerformanceChart.generateHtml([
                { position: 2, total_entries: 8, car: 'Audi R8', track: 'Nurburgring', CarClass: 'GT3', ClassID: 999, date: '2025-06-01' }
            ]);

            expect(html).toContain('perf-dist-point');
            expect(html).toContain('data-class="GT3"');
            expect(html).toContain('data-class-id="999"');
        });

        it('renders accessible chart container', () => {
            window.EntriesChart.parseEntryDate.mockReturnValue(new Date('2025-06-01'));
            window.EntriesChart.getLocalDateKey.mockReturnValue('2025-06-01');

            const html = PerformanceChart.generateHtml([
                { position: 3, total_entries: 10, Car: 'A', date: '2025-06-01' }
            ]);

            expect(html).toContain('role="img"');
            expect(html).toContain('aria-label="Performance over time showing bested percentage for each entry"');
        });
    });
});
