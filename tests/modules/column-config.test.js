import { beforeAll, describe, expect, it } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/column-config.js');
});

describe('ColumnConfig.getDisplayName', () => {
    it('returns canonical display name for known keys', () => {
        expect(window.ColumnConfig.getDisplayName('LapTime')).toBe('Laptime');
        expect(window.ColumnConfig.getDisplayName('lap_time')).toBe('Laptime');
        expect(window.ColumnConfig.getDisplayName('date_time')).toBe('Date');
        expect(window.ColumnConfig.getDisplayName('car_class')).toBe('Car class');
        expect(window.ColumnConfig.getDisplayName('Difficulty')).toBe('Difficulty');
        expect(window.ColumnConfig.getDisplayName('Position')).toBe('Position');
        expect(window.ColumnConfig.getDisplayName('GapPercent')).toBe('Lap %');
    });

    it('returns aliased keys', () => {
        expect(window.ColumnConfig.getDisplayName('CarClass')).toBe('Car class');
        expect(window.ColumnConfig.getDisplayName('DateTime')).toBe('Date');
        expect(window.ColumnConfig.getDisplayName('Pos')).toBe('Position');
    });

    it('falls back to sentence-cased key for unknown columns', () => {
        // Underscores become spaces, only the first char is uppercased
        expect(window.ColumnConfig.getDisplayName('my_custom_field')).toBe('My custom field');
        // CamelCase words get a space inserted before capitals
        expect(window.ColumnConfig.getDisplayName('someKey')).toBe('Some Key');
    });
});

describe('ColumnConfig.isColumnType', () => {
    // isColumnType(key, COLUMN_CONSTANT_NAME) — second arg is the COLUMNS enum key
    it('identifies known column types by COLUMNS constant name', () => {
        expect(window.ColumnConfig.isColumnType('LapTime', 'LAP_TIME')).toBe(true);
        expect(window.ColumnConfig.isColumnType('lap_time', 'LAP_TIME')).toBe(true);
        expect(window.ColumnConfig.isColumnType('date_time', 'DATE')).toBe(true);
        expect(window.ColumnConfig.isColumnType('GapPercent', 'GAP_PERCENT')).toBe(true);
        expect(window.ColumnConfig.isColumnType('car_class', 'CAR_CLASS')).toBe(true);
        expect(window.ColumnConfig.isColumnType('Position', 'POSITION')).toBe(true);
    });

    it('returns false for mismatched column type', () => {
        expect(window.ColumnConfig.isColumnType('LapTime', 'DATE')).toBe(false);
        expect(window.ColumnConfig.isColumnType('Position', 'LAP_TIME')).toBe(false);
    });

    it('returns false for unknown COLUMNS constant name', () => {
        expect(window.ColumnConfig.isColumnType('LapTime', 'UNKNOWN')).toBe(false);
        expect(window.ColumnConfig.isColumnType('unknown_key', 'LAP_TIME')).toBe(false);
    });
});

describe('ColumnConfig.getOrderedColumns', () => {
    it('filters out hidden columns', () => {
        const keys = ['Name', 'LapTime', 'Car', 'Country'];
        const result = window.ColumnConfig.getOrderedColumns(keys);
        expect(result).not.toContain('Name');
        expect(result).not.toContain('Country');
        expect(result).toContain('LapTime');
        expect(result).toContain('Car');
    });

    it('inserts GapPercent after LapTime', () => {
        const keys = ['Position', 'LapTime', 'Car'];
        const result = window.ColumnConfig.getOrderedColumns(keys);
        const lapIdx = result.indexOf('LapTime');
        const gapIdx = result.indexOf('GapPercent');
        expect(gapIdx).toBe(lapIdx + 1);
    });

    it('does not insert GapPercent twice if already present', () => {
        const keys = ['Position', 'LapTime', 'GapPercent', 'Car'];
        const result = window.ColumnConfig.getOrderedColumns(keys);
        expect(result.filter(k => k === 'GapPercent')).toHaveLength(1);
    });

    it('adds date_time if not present and addSynthetic is true', () => {
        const keys = ['Position', 'LapTime', 'Car'];
        const result = window.ColumnConfig.getOrderedColumns(keys);
        expect(result).toContain('date_time');
    });

    it('does not add date_time when addSynthetic is false', () => {
        const keys = ['Position', 'LapTime', 'Car'];
        const result = window.ColumnConfig.getOrderedColumns(keys, { addSynthetic: false });
        expect(result).not.toContain('date_time');
        expect(result).not.toContain('GapPercent');
    });

    it('preserves correct order (Car < Position < LapTime < Difficulty)', () => {
        // Canonical order: CAR=20, POSITION=30, LAP_TIME=50, DIFFICULTY=70
        const keys = ['Car', 'LapTime', 'Position', 'Difficulty'];
        const result = window.ColumnConfig.getOrderedColumns(keys);
        const carIdx = result.indexOf('Car');
        const posIdx = result.indexOf('Position');
        const lapIdx = result.indexOf('LapTime');
        const diffIdx = result.indexOf('Difficulty');
        expect(carIdx).toBeLessThan(posIdx);
        expect(posIdx).toBeLessThan(lapIdx);
        expect(lapIdx).toBeLessThan(diffIdx);
    });

    it('returns empty array for empty input', () => {
        const result = window.ColumnConfig.getOrderedColumns([]);
        // May contain synthetic date_time when addSynthetic=true, but no data cols
        expect(result.every(k => !['Name', 'Country'].includes(k))).toBe(true);
    });
});

describe('ColumnConfig.formatCellValue', () => {
    it('formats date_time to "D Mon YYYY"', () => {
        const result = window.ColumnConfig.formatCellValue('date_time', '2026-04-15T10:00:00Z');
        expect(result).toMatch(/^\d{1,2} \w{3} \d{4}$/);
        expect(result).toContain('2026');
    });

    it('formats DateTime alias identically', () => {
        const a = window.ColumnConfig.formatCellValue('date_time', '2026-01-01T00:00:00Z');
        const b = window.ColumnConfig.formatCellValue('DateTime', '2026-01-01T00:00:00Z');
        expect(a).toBe(b);
    });

    it('returns em-dash for empty date', () => {
        expect(window.ColumnConfig.formatCellValue('date_time', '')).toBe('—');
        expect(window.ColumnConfig.formatCellValue('date_time', null)).toBe('—');
    });

    it('returns em-dash for invalid date', () => {
        expect(window.ColumnConfig.formatCellValue('date_time', 'not-a-date')).toBe('—');
    });

    it('returns value stringified for columns with no formatter', () => {
        // formatCellValue always returns String(value) when no custom format
        expect(window.ColumnConfig.formatCellValue('Car', 'Audi R8')).toBe('Audi R8');
        expect(window.ColumnConfig.formatCellValue('Position', 5)).toBe('5');
    });

    it('returns em-dash for null/undefined/empty on unformatted columns', () => {
        expect(window.ColumnConfig.formatCellValue('Car', null)).toBe('—');
        expect(window.ColumnConfig.formatCellValue('Car', '')).toBe('—');
    });

    it('returns value stringified for unknown columns', () => {
        expect(window.ColumnConfig.formatCellValue('unknown_col', 'test')).toBe('test');
    });
});
