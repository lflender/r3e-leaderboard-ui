import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    document.body.innerHTML = '';
    window.R3EUtils = {
        escapeHtml: (s) => String(s || ''),
        resolveTrackLabelForItem: vi.fn(e => e.Track || '')
    };
    window.EntriesChart = {
        generateHtml: vi.fn(() => '<div class="entries-dist-chart"><svg></svg></div>'),
        parseEntryDate: vi.fn(e => e.date ? new Date(e.date) : null),
        getLocalDateKey: vi.fn(d => d ? d.toISOString().slice(0, 10) : ''),
        applyTimeframeFilter: vi.fn((entries) => entries),
        toLocalDateInputValue: vi.fn((d) => d.toISOString().slice(0, 10)),
        wireTooltips: vi.fn(),
        wirePerfTooltips: vi.fn()
    };
    window.DriverProfileRenderers = {
        generatePerformanceGraph: vi.fn(() => '<div class="perf-dist-chart"></div>')
    };
    loadBrowserScript('modules/driver-profile-distributions.js');
});

describe('DriverProfileDistributions', () => {
    describe('render', () => {
        it('returns empty string for empty entries', () => {
            expect(DriverProfileDistributions.render([])).toBe('');
            expect(DriverProfileDistributions.render(null)).toBe('');
        });

        it('renders distributions grid with entries dist and perf graph', () => {
            const html = DriverProfileDistributions.render([{ Car: 'BMW' }]);
            expect(html).toContain('driver-profile-distributions-grid');
            expect(window.EntriesChart.generateHtml).toHaveBeenCalled();
            expect(window.DriverProfileRenderers.generatePerformanceGraph).toHaveBeenCalled();
        });
    });

    describe('wireInteraction', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                '<div id="dist-container">',
                '<div class="entries-dist-summary">',
                '<button class="entries-dist-toggle expanded" aria-expanded="true" aria-controls="test-content">',
                '<span class="entries-dist-toggle__icon">\u25BC</span>',
                '<span class="entries-dist-toggle-text">Entries</span>',
                '</button>',
                '<div id="test-content" class="entries-dist-content"></div>',
                '</div>',
                '</div>'
            ].join('');
        });

        it('wires toggle button to collapse/expand content', () => {
            const container = document.getElementById('dist-container');
            DriverProfileDistributions.wireInteraction(container, []);

            const toggle = container.querySelector('.entries-dist-toggle');
            const content = document.getElementById('test-content');

            toggle.click();
            expect(toggle.getAttribute('aria-expanded')).toBe('false');
            expect(content.style.display).toBe('none');

            toggle.click();
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
            expect(content.style.display).toBe('');
        });

        it('wires tooltips via EntriesChart', () => {
            const container = document.getElementById('dist-container');
            const entries = [{ Car: 'A' }];
            DriverProfileDistributions.wireInteraction(container, entries);

            expect(window.EntriesChart.wireTooltips).toHaveBeenCalledWith(container, entries);
            expect(window.EntriesChart.wirePerfTooltips).toHaveBeenCalledWith(container);
        });

        it('does nothing for null container', () => {
            expect(() => DriverProfileDistributions.wireInteraction(null, [])).not.toThrow();
        });
    });
});
