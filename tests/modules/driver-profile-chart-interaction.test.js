import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    document.body.innerHTML = '';
    window.R3EUtils = {
        escapeHtml: (s) => String(s || ''),
        resolveTrackLabelForItem: vi.fn(e => e.Track || e.track || '')
    };
    window.DriverProfileData = {
        getCarToClassMap: vi.fn((entries) => {
            const result = new Map();
            (entries || []).forEach(e => {
                const car = e.Car || '';
                const cls = e.car_class || '';
                if (car && cls) result.set(car, cls);
            });
            return result;
        })
    };
    window.DetailEntriesDist = {
        parseEntryDate: vi.fn(e => e.date ? new Date(e.date) : null),
        getLocalDateKey: vi.fn(d => d ? d.toISOString().slice(0, 10) : null)
    };
    loadBrowserScript('modules/tooltip.js');
    loadBrowserScript('modules/pie-chart.js');
    loadBrowserScript('modules/driver-profile-chart-interaction.js');
});

function buildPieChart(id, items) {
    const sliceHtml = items.map((item, i) =>
        `<path class="pie-slice" data-index="${i}" data-label="${item.label}" data-mid-angle="${item.midAngle || 0}" data-percentage="${item.pct || 10}"></path>`
    ).join('');
    const legendHtml = items.map((item, i) =>
        `<li class="pie-legend-item" data-index="${i}"><span class="pie-legend-label">${item.label}</span></li>`
    ).join('');
    return `<div id="${id}" class="driver-profile-chart-card">
        <div class="pie-chart-wrapper"><div class="pie-chart-body">
        <div class="pie-chart-svg-container" style="position:relative"><svg>${sliceHtml}</svg></div>
        <ul class="pie-legend">${legendHtml}</ul>
        </div></div></div>`;
}

describe('DriverProfileChartInteraction', () => {
    describe('showSliceLabels', () => {
        beforeEach(() => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'GT3', midAngle: 0, pct: 50 },
                { label: 'TCR', midAngle: 1.57, pct: 30 },
                { label: 'GT4', midAngle: 3.14, pct: 20 }
            ]);
        });

        it('creates labels for active slices', () => {
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices[0].classList.add('pie-slice--active');
            slices[2].classList.add('pie-slice--active');

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = document.querySelectorAll('.pie-cross-label');
            expect(labels.length).toBe(2);
            expect(labels[0].textContent).toBe('GT3');
            expect(labels[1].textContent).toBe('GT4');
        });

        it('does not create labels for dimmed slices', () => {
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices[0].classList.add('pie-slice--dimmed');

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            expect(document.querySelectorAll('.pie-cross-label').length).toBe(0);
        });

        it('shortens Grand Prix to GP and truncates at 30 characters', () => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'Circuit de Barcelona-Catalunya Grand Prix', midAngle: 0, pct: 50 }
            ]);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices[0].classList.add('pie-slice--active');

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const label = document.querySelector('.pie-cross-label');
            // "Grand Prix" → "GP" makes it "Circuit de Barcelona-Catalunya GP" (34 → 30 after GP but still >30? No: 'Circuit de Barcelona-Catalunya GP' = 34 chars → truncated at 30)
            expect(label.textContent).toBe('Circuit de Barcelona-Catalunya\u2026');
        });

        it('caps labels per side at LABEL_MAX_PER_SIDE (11)', () => {
            const items = Array.from({ length: 20 }, (_, i) => ({
                label: 'Class' + i, midAngle: i * 0.3, pct: 20 - i * 0.5
            }));
            document.body.innerHTML = buildPieChart('chart-test', items);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = document.querySelectorAll('.pie-cross-label');
            expect(labels.length).toBeGreaterThan(0);
            expect(labels.length).toBeLessThanOrEqual(22); // max 11 per side
        });

        it('prioritizes bigger slices when selecting labels', () => {
            // Mix of big and small slices on the same side (midAngle ~0 = right side)
            const items = [
                { label: 'Tiny1', midAngle: 0.1, pct: 2 },
                { label: 'Tiny2', midAngle: 0.2, pct: 2 },
                { label: 'Big', midAngle: 0.3, pct: 50 },
                { label: 'Medium', midAngle: 0.5, pct: 20 },
                { label: 'Tiny3', midAngle: 0.7, pct: 2 }
            ];
            document.body.innerHTML = buildPieChart('chart-test', items);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
            const texts = labels.map(l => l.textContent);
            // Big and Medium must be present since they're the largest
            expect(texts).toContain('Big');
            expect(texts).toContain('Medium');
        });

        it('outputs labels in angle order (top to bottom) regardless of pct', () => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'Top', midAngle: -1.2, pct: 10 },
                { label: 'Middle', midAngle: 0, pct: 50 },
                { label: 'Bottom', midAngle: 1.2, pct: 30 }
            ]);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
            // All on the right side (cos >= 0 for -1.2, 0, 1.2)
            // Should be sorted by idealY which is sin(midAngle)*42+50
            const tops = labels.map(l => parseFloat(l.style.top));
            for (let i = 1; i < tops.length; i++) {
                expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
            }
        });
    });

    describe('clearSliceLabels', () => {
        it('removes all pie-cross-label elements', () => {
            document.body.innerHTML = '<span class="pie-cross-label">A</span><span class="pie-cross-label">B</span>';
            DriverProfileChartInteraction.clearSliceLabels();
            expect(document.querySelectorAll('.pie-cross-label').length).toBe(0);
        });
    });

    describe('highlightSlices', () => {
        beforeEach(() => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'A', midAngle: 0, pct: 50 },
                { label: 'B', midAngle: 1.57, pct: 50 }
            ]);
        });

        it('adds pie-slice--active to matching slices', () => {
            const slices = document.querySelectorAll('.pie-slice');
            DriverProfileChartInteraction.highlightSlices(slices, s => s.getAttribute('data-label') === 'A');
            expect(slices[0].classList.contains('pie-slice--active')).toBe(true);
            expect(slices[1].classList.contains('pie-slice--dimmed')).toBe(true);
        });

        it('sets transform on active slices', () => {
            const slices = document.querySelectorAll('.pie-slice');
            // midAngle=0 means cos=1, sin=0, so translate(8px, 0px)
            DriverProfileChartInteraction.highlightSlices(slices, s => s.getAttribute('data-label') === 'A');
            expect(slices[0].style.transform).toContain('translate');
        });
    });

    describe('highlightLegend', () => {
        it('adds active/dimmed classes based on predicate', () => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'X', midAngle: 0, pct: 50 },
                { label: 'Y', midAngle: 1, pct: 50 }
            ]);
            const items = document.querySelectorAll('.pie-legend-item');
            DriverProfileChartInteraction.highlightLegend(items, el => {
                const lbl = el.querySelector('.pie-legend-label').textContent;
                return lbl === 'X';
            });
            expect(items[0].classList.contains('pie-legend-item--active')).toBe(true);
            expect(items[1].classList.contains('pie-legend-item--dimmed')).toBe(true);
        });
    });

    describe('clearSlices', () => {
        it('removes active/dimmed classes and resets transform', () => {
            document.body.innerHTML = buildPieChart('chart-test', [{ label: 'A', midAngle: 0, pct: 100 }]);
            const slices = document.querySelectorAll('.pie-slice');
            slices[0].classList.add('pie-slice--active');
            slices[0].style.transform = 'translate(8px, 0px)';

            DriverProfileChartInteraction.clearSlices(slices);

            expect(slices[0].classList.contains('pie-slice--active')).toBe(false);
            expect(slices[0].style.transform).toBe('');
        });
    });

    describe('clearLegend', () => {
        it('removes active/dimmed classes from legend items', () => {
            document.body.innerHTML = buildPieChart('chart-test', [{ label: 'A', midAngle: 0, pct: 100 }]);
            const items = document.querySelectorAll('.pie-legend-item');
            items[0].classList.add('pie-legend-item--active');

            DriverProfileChartInteraction.clearLegend(items);

            expect(items[0].classList.contains('pie-legend-item--active')).toBe(false);
        });
    });

    describe('wireCarClassChartInteraction', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                buildPieChart('chart-car-class', [
                    { label: 'GT3', midAngle: 0, pct: 60 },
                    { label: 'TCR', midAngle: 2, pct: 40 }
                ]),
                buildPieChart('chart-car', [
                    { label: 'BMW M4', midAngle: 0, pct: 50 },
                    { label: 'Hyundai', midAngle: 2, pct: 50 }
                ]),
                buildPieChart('chart-track', [
                    { label: 'Spa', midAngle: 0, pct: 60 },
                    { label: 'Monza', midAngle: 2, pct: 40 }
                ])
            ].join('');
        });

        const entries = [
            { car_class: 'GT3', Car: 'BMW M4', Track: 'Spa' },
            { car_class: 'GT3', Car: 'BMW M4', Track: 'Monza' },
            { car_class: 'TCR', Car: 'Hyundai', Track: 'Spa' }
        ];

        it('annotates car slices with data-class-label', () => {
            DriverProfileChartInteraction.wireCarClassChartInteraction(entries);

            const carSlices = document.querySelectorAll('#chart-car .pie-slice');
            expect(carSlices[0].getAttribute('data-class-label')).toBe('GT3');
            expect(carSlices[1].getAttribute('data-class-label')).toBe('TCR');
        });

        it('annotates track elements with data-class-labels', () => {
            DriverProfileChartInteraction.wireCarClassChartInteraction(entries);

            const trackSlices = document.querySelectorAll('#chart-track .pie-slice');
            expect(trackSlices[0].getAttribute('data-class-labels')).toContain('GT3');
            expect(trackSlices[0].getAttribute('data-class-labels')).toContain('TCR');
        });

        it('highlights car slices on class legend hover', () => {
            DriverProfileChartInteraction.wireCarClassChartInteraction(entries);

            const classLegend = document.querySelector('#chart-car-class .pie-legend-item');
            classLegend.dispatchEvent(new Event('mouseenter'));

            const carSlices = document.querySelectorAll('#chart-car .pie-slice');
            expect(carSlices[0].classList.contains('pie-slice--active')).toBe(true);
            expect(carSlices[1].classList.contains('pie-slice--dimmed')).toBe(true);
        });

        it('clears highlights on mouseleave', () => {
            DriverProfileChartInteraction.wireCarClassChartInteraction(entries);

            const classLegend = document.querySelector('#chart-car-class .pie-legend-item');
            classLegend.dispatchEvent(new Event('mouseenter'));
            classLegend.dispatchEvent(new Event('mouseleave'));

            const carSlices = document.querySelectorAll('#chart-car .pie-slice');
            expect(carSlices[0].classList.contains('pie-slice--active')).toBe(false);
            expect(carSlices[1].classList.contains('pie-slice--dimmed')).toBe(false);
        });

        it('highlights class chart on car legend hover', () => {
            DriverProfileChartInteraction.wireCarClassChartInteraction(entries);

            const carLegend = document.querySelector('#chart-car .pie-legend-item');
            carLegend.dispatchEvent(new Event('mouseenter'));

            const classSlices = document.querySelectorAll('#chart-car-class .pie-slice');
            expect(classSlices[0].classList.contains('pie-slice--active')).toBe(true);
            expect(classSlices[1].classList.contains('pie-slice--dimmed')).toBe(true);
        });

        it('highlights class and car charts on track legend hover', () => {
            DriverProfileChartInteraction.wireCarClassChartInteraction(entries);

            const trackLegend = document.querySelector('#chart-track .pie-legend-item');
            trackLegend.dispatchEvent(new Event('mouseenter'));

            const classSlices = document.querySelectorAll('#chart-car-class .pie-slice');
            const carSlices = document.querySelectorAll('#chart-car .pie-slice');
            // Spa has GT3 and TCR entries
            expect(classSlices[0].classList.contains('pie-slice--active')).toBe(true);
            expect(classSlices[1].classList.contains('pie-slice--active')).toBe(true);
            // BMW M4 and Hyundai both driven at Spa
            expect(carSlices[0].classList.contains('pie-slice--active')).toBe(true);
            expect(carSlices[1].classList.contains('pie-slice--active')).toBe(true);
        });
    });

    describe('wirePieChartPerfHighlighting', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                buildPieChart('chart-car-class', [{ label: 'GT3', midAngle: 0, pct: 100 }]),
                '<div class="perf-dist-chart">',
                '<span class="perf-dist-point" data-class="GT3" data-info="BMW M4 \u2013 Spa"></span>',
                '<span class="perf-dist-point" data-class="TCR" data-info="Hyundai \u2013 Monza"></span>',
                '</div>'
            ].join('');
        });

        it('highlights matching perf dots on pie legend hover', () => {
            DriverProfileChartInteraction.wirePieChartPerfHighlighting();

            const legend = document.querySelector('#chart-car-class .pie-legend-item');
            legend.dispatchEvent(new Event('mouseenter'));

            const points = document.querySelectorAll('.perf-dist-point');
            expect(points[0].classList.contains('perf-dist-point--active')).toBe(true);
            expect(points[1].classList.contains('perf-dist-point--active')).toBe(false);
        });

        it('clears perf dot highlights on mouseleave', () => {
            DriverProfileChartInteraction.wirePieChartPerfHighlighting();

            const legend = document.querySelector('#chart-car-class .pie-legend-item');
            legend.dispatchEvent(new Event('mouseenter'));
            legend.dispatchEvent(new Event('mouseleave'));

            const points = document.querySelectorAll('.perf-dist-point');
            expect(points[0].classList.contains('perf-dist-point--active')).toBe(false);
        });
    });

    describe('wireEntriesDistCrossHighlighting', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                buildPieChart('chart-car-class', [{ label: 'GT3', midAngle: 0, pct: 100 }]),
                '<div id="dist-container">',
                '<div class="entries-dist-chart"><svg>',
                '<rect class="entries-dist-bar" data-date="2025-01-01"></rect>',
                '<rect class="entries-dist-bar" data-date="2025-01-02"></rect>',
                '</svg></div>',
                '</div>'
            ].join('');
        });

        it('highlights bars matching class dates on pie hover', () => {
            const entries = [
                { car_class: 'GT3', Car: 'BMW', Track: 'Spa', date: '2025-01-01' }
            ];
            const container = document.getElementById('dist-container');
            DriverProfileChartInteraction.wireEntriesDistCrossHighlighting(entries, container);

            const legend = document.querySelector('#chart-car-class .pie-legend-item');
            legend.dispatchEvent(new Event('mouseenter'));

            const bars = document.querySelectorAll('.entries-dist-bar');
            expect(bars[0].classList.contains('entries-dist-bar--active')).toBe(true);
            expect(bars[1].classList.contains('entries-dist-bar--active')).toBe(false);
        });
    });

    describe('wireBreakdownChartInteraction', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                buildPieChart('chart-car-class', [
                    { label: 'GT3', midAngle: 0, pct: 60 },
                    { label: 'TCR', midAngle: 2, pct: 40 }
                ]),
                '<div class="driver-stat-breakdown">',
                '<li class="pie-legend-item" data-class-label="GT3"><span class="pie-legend-label">GT3</span></li>',
                '<li class="pie-legend-item" data-class-label="TCR"><span class="pie-legend-label">TCR</span></li>',
                '</div>'
            ].join('');
        });

        it('highlights matching pie legend on breakdown hover', () => {
            DriverProfileChartInteraction.wireBreakdownChartInteraction();

            const breakdownItem = document.querySelector('.driver-stat-breakdown .pie-legend-item');
            breakdownItem.dispatchEvent(new Event('mouseenter'));

            expect(breakdownItem.classList.contains('pie-legend-item--active')).toBe(true);
        });

        it('highlights breakdown items on pie chart legend hover', () => {
            DriverProfileChartInteraction.wireBreakdownChartInteraction();

            const pieLegend = document.querySelector('#chart-car-class .pie-legend-item');
            pieLegend.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

            const bd = document.querySelector('.driver-stat-breakdown .pie-legend-item[data-class-label="GT3"]');
            expect(bd.classList.contains('pie-legend-item--active')).toBe(true);
        });
    });

    describe('showSliceLabels overlap resolution', () => {
        it('nudges labels apart when they share same vertical position', () => {
            // All labels at same midAngle = same y position
            const items = Array.from({ length: 4 }, (_, i) => ({
                label: 'Item' + i, midAngle: 0, pct: 40 - i * 10
            }));
            document.body.innerHTML = buildPieChart('chart-test', items);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
            expect(labels.length).toBe(4);
            // Verify that labels have distinct y positions (not all same)
            const tops = labels.map(l => parseFloat(l.style.top));
            const uniqueTops = new Set(tops.map(t => t.toFixed(0)));
            expect(uniqueTops.size).toBeGreaterThan(1);
        });

        it('skips labels that would be displaced too far from their ideal position', () => {
            // Many labels crammed on the same side at the same angle
            const items = Array.from({ length: 20 }, (_, i) => ({
                label: 'Crowded' + i, midAngle: 0, pct: 20 - i * 0.5
            }));
            document.body.innerHTML = buildPieChart('chart-test', items);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = document.querySelectorAll('.pie-cross-label');
            // Not all 20 can fit — some get skipped due to displacement limit
            expect(labels.length).toBeLessThan(20);
            expect(labels.length).toBeGreaterThan(0);
        });

        it('ensures minimum gap between adjacent labels', () => {
            const items = Array.from({ length: 5 }, (_, i) => ({
                label: 'Gap' + i, midAngle: i * 0.3, pct: 30 - i * 5
            }));
            document.body.innerHTML = buildPieChart('chart-test', items);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
            const tops = labels.map(l => parseFloat(l.style.top)).sort((a, b) => a - b);
            for (let i = 1; i < tops.length; i++) {
                expect(tops[i] - tops[i - 1]).toBeGreaterThanOrEqual(6.5); // ~7% gap
            }
        });

        it('handles labels on both sides independently', () => {
            // Two on the right (midAngle=0), two on the left (midAngle=PI)
            const items = [
                { label: 'Right1', midAngle: 0, pct: 40 },
                { label: 'Right2', midAngle: 0.1, pct: 30 },
                { label: 'Left1', midAngle: Math.PI, pct: 20 },
                { label: 'Left2', midAngle: Math.PI + 0.1, pct: 10 }
            ];
            document.body.innerHTML = buildPieChart('chart-test', items);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const labels = Array.from(document.querySelectorAll('.pie-cross-label'));
            expect(labels.length).toBe(4);
        });

        it('renders connector lines for placed labels', () => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'A', midAngle: 0, pct: 50 },
                { label: 'B', midAngle: 2, pct: 50 }
            ]);
            const chart = document.getElementById('chart-test');
            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const linesSvg = chart.querySelector('.pie-connector-lines');
            expect(linesSvg).toBeTruthy();
            const polylines = linesSvg.querySelectorAll('polyline');
            expect(polylines.length).toBe(2);
        });

        it('includes logo when logoResolver is set on container', () => {
            document.body.innerHTML = buildPieChart('chart-test', [
                { label: 'Ferrari 488', midAngle: 0, pct: 100 }
            ]);
            const chart = document.getElementById('chart-test');
            chart._pieLogoResolver = (name) => name === 'Ferrari 488' ? '/images/ferrari.png' : '';

            const slices = chart.querySelectorAll('.pie-slice');
            slices.forEach(s => s.classList.add('pie-slice--active'));

            DriverProfileChartInteraction.showSliceLabels(chart, slices);

            const logo = chart.querySelector('.pie-cross-label__logo');
            expect(logo).toBeTruthy();
            expect(logo.src).toContain('ferrari.png');
        });
    });

    describe('wireDistPerfToPieHighlighting', () => {
        beforeEach(() => {
            document.body.innerHTML = [
                buildPieChart('chart-car-class', [
                    { label: 'GT3', midAngle: 0, pct: 60 },
                    { label: 'TCR', midAngle: 2, pct: 40 }
                ]),
                buildPieChart('chart-car', [
                    { label: 'BMW M4', midAngle: 0, pct: 60 },
                    { label: 'Hyundai', midAngle: 2, pct: 40 }
                ]),
                buildPieChart('chart-track', [
                    { label: 'Spa', midAngle: 0, pct: 60 },
                    { label: 'Monza', midAngle: 2, pct: 40 }
                ]),
                '<div id="dist-container">',
                '<div class="entries-dist-chart"><svg viewBox="0 0 10 5">',
                '<rect class="entries-dist-bar" x="0" data-date="2025-01-01" data-count="2"></rect>',
                '<rect class="entries-dist-bar" x="2" data-date="2025-01-02" data-count="1"></rect>',
                '</svg></div>',
                '<div class="perf-dist-chart" style="width:100px;height:50px;position:relative">',
                '<span class="perf-dist-point" style="left:10%" data-date="2025-01-01" data-class="GT3"></span>',
                '<span class="perf-dist-point" style="left:80%" data-date="2025-01-02" data-class="TCR"></span>',
                '</div>',
                '</div>',
                '<div class="driver-stat-breakdown">',
                '<li class="pie-legend-item" data-class-label="GT3"><span class="pie-legend-label">GT3</span></li>',
                '</div>'
            ].join('');
        });

        const entries = [
            { car_class: 'GT3', Car: 'BMW M4', Track: 'Spa', date: '2025-01-01' },
            { car_class: 'GT3', Car: 'BMW M4', Track: 'Monza', date: '2025-01-01' },
            { car_class: 'TCR', Car: 'Hyundai', Track: 'Spa', date: '2025-01-02' }
        ];

        it('does nothing if container is null', () => {
            expect(() => DriverProfileChartInteraction.wireDistPerfToPieHighlighting(entries, null)).not.toThrow();
        });

        it('does nothing if entries are empty', () => {
            const container = document.getElementById('dist-container');
            expect(() => DriverProfileChartInteraction.wireDistPerfToPieHighlighting([], container)).not.toThrow();
        });

        it('wires without error', () => {
            const container = document.getElementById('dist-container');
            expect(() => DriverProfileChartInteraction.wireDistPerfToPieHighlighting(entries, container)).not.toThrow();
        });
    });
});
