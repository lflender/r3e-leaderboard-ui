import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeEach(() => {
    sessionStorage.clear();
    loadBrowserScript('modules/filter-state.js');
});

describe('PageFilterState', () => {
    it('stores filters by page and merges updates', () => {
        window.PageFilterState.write('cars', 'wheel', 'round');
        window.PageFilterState.write('cars', 'class', 'GT3');
        window.PageFilterState.write('drivers', 'wheel', 'gt');

        expect(window.PageFilterState.read('cars')).toEqual({ wheel: 'round', class: 'GT3' });
        expect(window.PageFilterState.read('drivers')).toEqual({ wheel: 'gt' });
    });

    it('isolates state by page context', () => {
        window.PageFilterState.write('detail', 'car', 'BMW M4', 'track-1-class-2');

        expect(window.PageFilterState.read('detail', 'track-1-class-2')).toEqual({ car: 'BMW M4' });
        expect(window.PageFilterState.read('detail', 'track-3-class-4')).toEqual({});
    });

    it('ignores malformed saved data and reports it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        sessionStorage.setItem('r3e-page-filter-state:cars:', '{bad json');

        expect(window.PageFilterState.read('cars')).toEqual({});
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
