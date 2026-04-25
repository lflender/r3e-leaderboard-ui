import { beforeAll, describe, expect, it } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    window.R3EUtils = {
        escapeHtml: (v) => String(v ?? ''),
        splitCarName: (name) => {
            const parts = (name || '').split(' ');
            return { brand: parts[0] || '', model: parts.slice(1).join(' ') };
        },
        resolveBrandLogoPath: () => ''
    };
    loadBrowserScript('modules/detail-car-dist.js');
});

const SAMPLE_DATA = [
    { Car: 'Audi R8', Position: '1' },
    { Car: 'Audi R8', Position: '2' },
    { Car: 'Audi R8', Position: '3' },
    { Car: 'BMW M4', Position: '1' },
    { Car: 'BMW M4', Position: '5' },
    { Car: 'Ferrari 488', Position: '4' }
];

describe('DetailCarDist.getStats', () => {
    it('returns one entry per unique car', () => {
        const stats = window.DetailCarDist.getStats(SAMPLE_DATA);
        expect(stats).toHaveLength(3);
    });

    it('counts entries correctly', () => {
        const stats = window.DetailCarDist.getStats(SAMPLE_DATA);
        const audi = stats.find(s => s.car === 'Audi R8');
        expect(audi.entries).toBe(3);
    });

    it('sorts by entries descending by default', () => {
        const stats = window.DetailCarDist.getStats(SAMPLE_DATA);
        expect(stats[0].entries).toBeGreaterThanOrEqual(stats[1].entries);
        expect(stats[1].entries).toBeGreaterThanOrEqual(stats[2].entries);
    });

    it('calculates correct percentage', () => {
        const stats = window.DetailCarDist.getStats(SAMPLE_DATA);
        const audi = stats.find(s => s.car === 'Audi R8');
        // 3 out of 6 = 50%
        expect(parseFloat(audi.percentage)).toBe(50.0);
    });

    it('calculates median position for odd-count list', () => {
        const stats = window.DetailCarDist.getStats(SAMPLE_DATA);
        const audi = stats.find(s => s.car === 'Audi R8');
        // positions [1, 2, 3] → median = 2
        expect(audi.medianPosition).toBe(2);
    });

    it('calculates median position for even-count list', () => {
        const stats = window.DetailCarDist.getStats(SAMPLE_DATA);
        const bmw = stats.find(s => s.car === 'BMW M4');
        // positions [1, 5] → median = 3
        expect(bmw.medianPosition).toBe(3);
    });

    it('returns medianPosition 0 when no valid positions', () => {
        const data = [{ Car: 'Test Car', Position: '0' }, { Car: 'Test Car', Position: 'x' }];
        const stats = window.DetailCarDist.getStats(data);
        expect(stats[0].medianPosition).toBe(0);
    });

    it('handles missing Position field gracefully', () => {
        const data = [{ Car: 'Audi R8' }, { Car: 'Audi R8' }];
        const stats = window.DetailCarDist.getStats(data);
        expect(stats[0].entries).toBe(2);
    });

    it('falls back to car/position aliases', () => {
        const data = [{ car: 'Porsche 911', position: '3' }];
        const stats = window.DetailCarDist.getStats(data);
        expect(stats[0].car).toBe('Porsche 911');
        expect(stats[0].medianPosition).toBe(3);
    });

    it('groups missing car names under "Unknown"', () => {
        const data = [{}, {}];
        const stats = window.DetailCarDist.getStats(data);
        expect(stats[0].car).toBe('Unknown');
        expect(stats[0].entries).toBe(2);
    });

    it('returns empty array for empty data', () => {
        expect(window.DetailCarDist.getStats([])).toEqual([]);
    });
});

describe('DetailCarDist.generateHtml', () => {
    it('returns an HTML string', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA);
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(0);
    });

    it('contains car names from data', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA);
        expect(html).toContain('Audi');
        expect(html).toContain('BMW');
    });

    it('renders correct entry counts', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA);
        // Audi has 3 entries, should appear as table cell
        expect(html).toContain('>3<');
    });

    it('marks entries column as sort-active when sortBy=entries', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA, 'entries', 'desc');
        expect(html).toContain('car-dist-entries sort');
        expect(html).toContain('sort-active');
    });

    it('marks median column as sort-active when sortBy=median', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA, 'median', 'asc');
        expect(html).toContain('sort-active');
        expect(html).toContain('data-sort="median"');
    });

    it('sorts by median ascending', () => {
        // Use single-token names so splitCarName keeps full name as brand (no spaces)
        const data = [
            { Car: 'FastCar', Position: '10' },
            { Car: 'FastCar', Position: '10' },
            { Car: 'SlowCar', Position: '1' },
            { Car: 'SlowCar', Position: '1' }
        ];
        const html = window.DetailCarDist.generateHtml(data, 'median', 'asc');
        const slowIdx = html.indexOf('SlowCar');
        const fastIdx = html.indexOf('FastCar');
        // SlowCar (median=1) should appear before FastCar (median=10) in ascending
        expect(slowIdx).toBeLessThan(fastIdx);
    });

    it('does not expand by default', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA);
        expect(html).toContain('aria-expanded="false"');
    });

    it('expands when isExpanded=true', () => {
        const html = window.DetailCarDist.generateHtml(SAMPLE_DATA, 'entries', 'desc', true);
        expect(html).toContain('aria-expanded="true"');
    });

    it('renders dash for zero median position', () => {
        const data = [{ Car: 'No Pos Car', Position: '0' }];
        const html = window.DetailCarDist.generateHtml(data);
        expect(html).toContain('>-<');
    });

    it('generates wrapper HTML even for empty data (empty tbody)', () => {
        // The module renders the container div regardless; tbody is empty
        const html = window.DetailCarDist.generateHtml([]);
        expect(html).toContain('car-dist-summary');
        expect(html).toContain('<tbody></tbody>');
    });
});
