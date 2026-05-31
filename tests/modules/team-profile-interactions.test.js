import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('TeamProfileInteractions', () => {
    let root;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        root = document.createElement('div');
        document.body.appendChild(root);

        // Minimal mocks
        window.CSS = { escape: (s) => s.replace(/([^\w-])/g, '\\$1') };

        // Tooltip mock
        window.Tooltip = {
            getOrCreate: () => {
                const el = document.createElement('div');
                el.className = 'dist-tooltip';
                return el;
            },
            show: vi.fn(),
            hide: vi.fn(),
            positionAboveCursor: vi.fn()
        };

        // EntriesChart mock
        window.EntriesChart = {
            buildClassLogoHtmlFromValues: () => ''
        };

        loadBrowserScript('modules/team-profile-interactions.js');
    });

    describe('highlightDriver', () => {
        it('adds driver-row-highlight to matching table rows', () => {
            root.innerHTML = `
                <table><tbody>
                    <tr data-name="Alice"><td>Alice</td></tr>
                    <tr data-name="Bob"><td>Bob</td></tr>
                    <tr data-name="Alice"><td>Alice</td></tr>
                </tbody></table>
            `;
            TeamProfileInteractions.highlightDriver(root, 'Alice');

            const rows = root.querySelectorAll('tr.driver-row-highlight');
            expect(rows.length).toBe(2);
            expect(rows[0].getAttribute('data-name')).toBe('Alice');
            expect(rows[1].getAttribute('data-name')).toBe('Alice');
        });

        it('adds entries-dist-bar--active to matching bars', () => {
            root.innerHTML = `
                <svg>
                    <rect class="entries-dist-bar" data-name="Alice"></rect>
                    <rect class="entries-dist-bar" data-name="Bob"></rect>
                </svg>
            `;
            TeamProfileInteractions.highlightDriver(root, 'Alice');

            expect(root.querySelector('[data-name="Alice"]').classList.contains('entries-dist-bar--active')).toBe(true);
            expect(root.querySelector('[data-name="Bob"]').classList.contains('entries-dist-bar--active')).toBe(false);
        });

        it('adds perf-dist-point--active to matching points', () => {
            root.innerHTML = `
                <span class="perf-dist-point" data-name="Alice"></span>
                <span class="perf-dist-point" data-name="Bob"></span>
            `;
            TeamProfileInteractions.highlightDriver(root, 'Alice');

            expect(root.querySelector('[data-name="Alice"]').classList.contains('perf-dist-point--active')).toBe(true);
            expect(root.querySelector('[data-name="Bob"]').classList.contains('perf-dist-point--active')).toBe(false);
        });

        it('adds team-legend--active to matching legend items', () => {
            root.innerHTML = `
                <span class="team-chart-legend-item"><span class="team-chart-legend-name">Alice</span></span>
                <span class="team-chart-legend-item"><span class="team-chart-legend-name">Bob</span></span>
            `;
            TeamProfileInteractions.highlightDriver(root, 'Alice');

            const items = root.querySelectorAll('.team-legend--active');
            expect(items.length).toBe(1);
        });

        it('clears previous highlights before applying new ones', () => {
            root.innerHTML = `
                <table><tbody>
                    <tr data-name="Alice"><td>Alice</td></tr>
                    <tr data-name="Bob"><td>Bob</td></tr>
                </tbody></table>
            `;
            TeamProfileInteractions.highlightDriver(root, 'Alice');
            TeamProfileInteractions.highlightDriver(root, 'Bob');

            const aliceRows = root.querySelectorAll('tr[data-name="Alice"].driver-row-highlight');
            const bobRows = root.querySelectorAll('tr[data-name="Bob"].driver-row-highlight');
            expect(aliceRows.length).toBe(0);
            expect(bobRows.length).toBe(1);
        });

        it('does nothing with null/empty name', () => {
            root.innerHTML = '<table><tbody><tr data-name="Alice"><td>A</td></tr></tbody></table>';
            TeamProfileInteractions.highlightDriver(root, '');
            expect(root.querySelectorAll('.driver-row-highlight').length).toBe(0);
            TeamProfileInteractions.highlightDriver(root, null);
            expect(root.querySelectorAll('.driver-row-highlight').length).toBe(0);
        });
    });

    describe('clearHighlights', () => {
        it('removes all highlight classes', () => {
            root.innerHTML = `
                <table><tbody><tr data-name="Alice" class="driver-row-highlight"><td>A</td></tr></tbody></table>
                <span class="perf-dist-point perf-dist-point--active" data-name="Alice"></span>
                <rect class="entries-dist-bar entries-dist-bar--active" data-name="Alice"></rect>
                <span class="team-chart-legend-item team-legend--active"><span class="team-chart-legend-name">Alice</span></span>
            `;
            TeamProfileInteractions.clearHighlights(root);

            expect(root.querySelectorAll('.driver-row-highlight').length).toBe(0);
            expect(root.querySelectorAll('.perf-dist-point--active').length).toBe(0);
            expect(root.querySelectorAll('.entries-dist-bar--active').length).toBe(0);
            expect(root.querySelectorAll('.team-legend--active').length).toBe(0);
        });
    });

    describe('wireTableHover', () => {
        it('highlights driver on mouseenter and clears on mouseleave', () => {
            root.innerHTML = `
                <table class="test-table"><tbody>
                    <tr data-name="Alice"><td>Alice</td></tr>
                    <tr data-name="Bob"><td>Bob</td></tr>
                    <tr data-name="Alice"><td>Alice 2</td></tr>
                </tbody></table>
                <span class="perf-dist-point" data-name="Alice"></span>
            `;
            const table = root.querySelector('.test-table');
            TeamProfileInteractions.wireTableHover(root, table);

            const tbody = table.querySelector('tbody');
            const firstRow = tbody.querySelector('tr[data-name="Alice"]');

            // Simulate mouseenter on a row
            const enterEvent = new MouseEvent('mouseenter', { bubbles: true });
            Object.defineProperty(enterEvent, 'target', { value: firstRow.querySelector('td') });
            tbody.dispatchEvent(enterEvent);

            expect(root.querySelectorAll('tr.driver-row-highlight').length).toBe(2);
            expect(root.querySelector('.perf-dist-point').classList.contains('perf-dist-point--active')).toBe(true);

            // Simulate mouseleave
            const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
            tbody.dispatchEvent(leaveEvent);

            expect(root.querySelectorAll('tr.driver-row-highlight').length).toBe(0);
            expect(root.querySelector('.perf-dist-point').classList.contains('perf-dist-point--active')).toBe(false);
        });

        it('does not crash with null table', () => {
            expect(() => TeamProfileInteractions.wireTableHover(root, null)).not.toThrow();
        });
    });

    describe('wireChartInteractions', () => {
        it('wires legend hover to highlight driver', () => {
            root.innerHTML = `
                <div id="dist">
                    <div class="entries-dist-chart"><svg></svg></div>
                    <span class="team-chart-legend-item"><span class="team-chart-legend-name">Alice</span></span>
                </div>
                <div id="perf">
                    <div class="perf-dist-chart"></div>
                    <span class="team-chart-legend-item"><span class="team-chart-legend-name">Bob</span></span>
                </div>
                <table><tbody>
                    <tr data-name="Alice"><td>A</td></tr>
                    <tr data-name="Bob"><td>B</td></tr>
                </tbody></table>
            `;
            const dist = root.querySelector('#dist');
            const perf = root.querySelector('#perf');
            TeamProfileInteractions.wireChartInteractions(root, dist, perf);

            // Hover Alice legend
            const aliceLegend = dist.querySelector('.team-chart-legend-item');
            aliceLegend.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

            expect(root.querySelectorAll('tr.driver-row-highlight').length).toBe(1);
            expect(root.querySelector('tr.driver-row-highlight').getAttribute('data-name')).toBe('Alice');

            // Leave
            aliceLegend.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            expect(root.querySelectorAll('tr.driver-row-highlight').length).toBe(0);
        });
    });
});
