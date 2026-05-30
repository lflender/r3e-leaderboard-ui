import { beforeAll, describe, expect, it } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    window.R3EUtils = { escapeHtml: (v) => String(v ?? '') };
    loadBrowserScript('modules/charts/entries-chart.js');
});

const D = window.EntriesChart;

// Helper: build an entry with a date_time string
function entry(isoDate) {
    return { date_time: isoDate };
}

describe('EntriesChart.parseEntryDate', () => {
    it('parses date_time field', () => {
        const e = { date_time: '2026-04-15T10:00:00Z' };
        const d = window.EntriesChart.parseEntryDate(e);
        expect(d).toBeInstanceOf(Date);
        expect(d.getFullYear()).toBe(2026);
    });

    it('falls back to dateTime alias', () => {
        const e = { dateTime: '2025-01-01T00:00:00Z' };
        const d = window.EntriesChart.parseEntryDate(e);
        expect(d).toBeInstanceOf(Date);
    });

    it('falls back to Date alias', () => {
        const e = { Date: '2025-06-01T00:00:00Z' };
        const d = window.EntriesChart.parseEntryDate(e);
        expect(d).toBeInstanceOf(Date);
    });

    it('returns null for missing date', () => {
        expect(window.EntriesChart.parseEntryDate({})).toBeNull();
        expect(window.EntriesChart.parseEntryDate({ date_time: '' })).toBeNull();
    });

    it('returns null for invalid date string', () => {
        expect(window.EntriesChart.parseEntryDate({ date_time: 'not-a-date' })).toBeNull();
    });
});

describe('EntriesChart.getLocalDateKey', () => {
    it('returns YYYY-MM-DD string for a valid Date', () => {
        const d = new Date('2026-04-15T12:00:00Z');
        const key = window.EntriesChart.getLocalDateKey(d);
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns empty string for null', () => {
        expect(window.EntriesChart.getLocalDateKey(null)).toBe('');
    });

    it('returns empty string for invalid Date', () => {
        expect(window.EntriesChart.getLocalDateKey(new Date('invalid'))).toBe('');
    });

    it('returns empty string for non-Date values', () => {
        expect(window.EntriesChart.getLocalDateKey('2026-04-15')).toBe('');
    });
});

describe('EntriesChart.getDataTimeBounds', () => {
    it('returns null for empty array', () => {
        expect(window.EntriesChart.getDataTimeBounds([])).toBeNull();
    });

    it('returns null for null', () => {
        expect(window.EntriesChart.getDataTimeBounds(null)).toBeNull();
    });

    it('returns null when no entries have valid dates', () => {
        const data = [{ date_time: '' }, {}];
        expect(window.EntriesChart.getDataTimeBounds(data)).toBeNull();
    });

    it('returns same date for both min and max in single-entry array', () => {
        const data = [entry('2026-04-15T00:00:00Z')];
        const bounds = window.EntriesChart.getDataTimeBounds(data);
        expect(bounds).not.toBeNull();
        expect(bounds.min.toISOString()).toBe(bounds.max.toISOString());
    });

    it('identifies correct min and max across multiple entries', () => {
        const data = [
            entry('2026-04-15T00:00:00Z'),
            entry('2025-01-01T00:00:00Z'),
            entry('2026-12-31T00:00:00Z')
        ];
        const bounds = window.EntriesChart.getDataTimeBounds(data);
        expect(bounds.min.getFullYear()).toBe(2025);
        expect(bounds.max.getFullYear()).toBe(2026);
        expect(bounds.max.getMonth()).toBe(11); // December
    });
});

describe('EntriesChart.toLocalDateInputValue', () => {
    it('returns YYYY-MM-DD for a valid Date', () => {
        const d = new Date('2026-04-15T00:00:00Z');
        const val = window.EntriesChart.toLocalDateInputValue(d);
        expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns empty string for null', () => {
        expect(window.EntriesChart.toLocalDateInputValue(null)).toBe('');
    });

    it('returns empty string for invalid Date', () => {
        expect(window.EntriesChart.toLocalDateInputValue(new Date('bad'))).toBe('');
    });
});

describe('EntriesChart.applyTimeframeFilter', () => {
    const data = [
        entry('2026-01-01T00:00:00Z'),
        entry('2026-03-15T00:00:00Z'),
        entry('2026-06-01T00:00:00Z'),
        entry('2026-12-31T00:00:00Z')
    ];

    it('returns all entries when no start/end provided', () => {
        expect(window.EntriesChart.applyTimeframeFilter(data, null, null)).toHaveLength(4);
    });

    it('returns all entries when start/end are empty strings', () => {
        expect(window.EntriesChart.applyTimeframeFilter(data, '', '')).toHaveLength(4);
    });

    it('filters by start date', () => {
        const result = window.EntriesChart.applyTimeframeFilter(data, '2026-03-15', null);
        expect(result).toHaveLength(3);
        result.forEach(e => {
            const key = window.EntriesChart.getLocalDateKey(
                window.EntriesChart.parseEntryDate(e)
            );
            expect(key >= '2026-03-15').toBe(true);
        });
    });

    it('filters by end date', () => {
        const result = window.EntriesChart.applyTimeframeFilter(data, null, '2026-03-15');
        expect(result).toHaveLength(2);
    });

    it('filters by both start and end', () => {
        const result = window.EntriesChart.applyTimeframeFilter(data, '2026-03-15', '2026-06-01');
        expect(result).toHaveLength(2);
    });

    it('returns empty array when no entries match the filter', () => {
        const result = window.EntriesChart.applyTimeframeFilter(data, '2027-01-01', '2027-12-31');
        expect(result).toHaveLength(0);
    });

    it('excludes entries with no date', () => {
        const mixed = [...data, {}];
        const result = window.EntriesChart.applyTimeframeFilter(mixed, '2026-01-01', '2026-12-31');
        expect(result).toHaveLength(4); // the dateless entry is excluded
    });

    it('returns empty array for empty input', () => {
        expect(window.EntriesChart.applyTimeframeFilter([], '2026-01-01', null)).toHaveLength(0);
    });
});

describe('EntriesChart.generateHtml', () => {
    const data = [
        entry('2026-01-01T00:00:00Z'),
        entry('2026-01-02T00:00:00Z'),
        entry('2026-01-03T00:00:00Z')
    ];

    it('returns a non-empty HTML string', () => {
        const html = window.EntriesChart.generateHtml(data);
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(0);
    });

    it('contains the chart SVG', () => {
        const html = window.EntriesChart.generateHtml(data);
        expect(html).toContain('<svg');
    });

    it('contains date inputs', () => {
        const html = window.EntriesChart.generateHtml(data);
        expect(html).toContain('type="date"');
    });

    it('is collapsed by default', () => {
        const html = window.EntriesChart.generateHtml(data);
        expect(html).toContain('aria-expanded="false"');
    });

    it('is expanded when isExpanded=true', () => {
        const html = window.EntriesChart.generateHtml(data, true);
        expect(html).toContain('aria-expanded="true"');
    });

    it('returns empty string when data has no parseable dates', () => {
        const result = window.EntriesChart.generateHtml([{}, {}]);
        expect(result).toBe('');
    });

    it('returns empty string for empty data', () => {
        expect(window.EntriesChart.generateHtml([])).toBe('');
    });
});
