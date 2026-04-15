import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    loadBrowserScript('modules/pagination.js');
});

describe('Pagination class – data management', () => {
    it('setData stores data and resets to page 1', () => {
        const p = new window.Pagination({ itemsPerPage: 2 });
        p.setData([1, 2, 3, 4]);
        p.goToPage(2);
        expect(p.currentPage).toBe(2);

        p.setData([10, 20]);
        expect(p.currentPage).toBe(1);
        expect(p.allResults).toEqual([10, 20]);
    });

    it('setData treats non-array argument as empty', () => {
        const p = new window.Pagination({ itemsPerPage: 10 });
        p.setData(null);
        expect(p.allResults).toEqual([]);
    });

    it('getCurrentPageData returns correct slice for each page', () => {
        const p = new window.Pagination({ itemsPerPage: 3 });
        p.setData([1, 2, 3, 4, 5, 6, 7]);
        expect(p.getCurrentPageData()).toEqual([1, 2, 3]);
        p.goToPage(2);
        expect(p.getCurrentPageData()).toEqual([4, 5, 6]);
        p.goToPage(3);
        expect(p.getCurrentPageData()).toEqual([7]);
    });

    it('getPageInfo returns accurate metadata', () => {
        const p = new window.Pagination({ itemsPerPage: 10 });
        p.setData(Array.from({ length: 25 }, (_, i) => i));
        const info = p.getPageInfo();
        expect(info.totalItems).toBe(25);
        expect(info.totalPages).toBe(3);
        expect(info.currentPage).toBe(1);
        expect(info.startIndex).toBe(0);
        expect(info.endIndex).toBe(10);
        expect(info.hasNextPage).toBe(true);
        expect(info.hasPrevPage).toBe(false);
    });
});

describe('Pagination class – navigation', () => {
    it('goToPage rejects page numbers out of range', () => {
        const p = new window.Pagination({ itemsPerPage: 5 });
        p.setData([1, 2, 3]);
        // totalPages = 1 here
        p.goToPage(0);
        expect(p.currentPage).toBe(1);
        p.goToPage(99);
        expect(p.currentPage).toBe(1);
    });

    it('nextPage and prevPage navigate within bounds', () => {
        const p = new window.Pagination({ itemsPerPage: 2 });
        p.setData([1, 2, 3, 4]);

        p.nextPage();
        expect(p.currentPage).toBe(2);

        p.nextPage(); // already last page – should stay
        expect(p.currentPage).toBe(2);

        p.prevPage();
        expect(p.currentPage).toBe(1);

        p.prevPage(); // already first page – should stay
        expect(p.currentPage).toBe(1);
    });

    it('goToPage fires onPageChange with correct page data and info', () => {
        const callback = vi.fn();
        const p = new window.Pagination({ itemsPerPage: 2, onPageChange: callback });
        p.setData([1, 2, 3, 4]);
        p.goToPage(2);

        expect(callback).toHaveBeenCalledOnce();
        const [pageData, info] = callback.mock.calls[0];
        expect(pageData).toEqual([3, 4]);
        expect(info.currentPage).toBe(2);
    });
});

describe('Pagination class – HTML generation', () => {
    it('generateHTML returns empty string when only one page', () => {
        const p = new window.Pagination({ itemsPerPage: 100 });
        p.setData([1, 2, 3]);
        expect(p.generateHTML()).toBe('');
    });

    it('generateHTML shows Showing info and Next on first page', () => {
        const p = new window.Pagination({ itemsPerPage: 2 });
        p.setData([1, 2, 3, 4]);
        const html = p.generateHTML('myPager');
        expect(html).toContain('Showing 1-2 of 4');
        expect(html).toContain('Next');
        expect(html).not.toContain('Previous');
    });

    it('generateHTML shows Previous on last page', () => {
        const p = new window.Pagination({ itemsPerPage: 2 });
        p.setData([1, 2, 3, 4]);
        p.goToPage(2);
        const html = p.generateHTML('myPager');
        expect(html).toContain('Showing 3-4 of 4');
        expect(html).toContain('Previous');
        expect(html).not.toContain('Next');
    });
});

describe('Pagination class – findPageForItem', () => {
    it('returns the correct page number for a matched item', () => {
        const p = new window.Pagination({ itemsPerPage: 3 });
        p.setData(['a', 'b', 'c', 'd', 'e']);
        expect(p.findPageForItem(x => x === 'a')).toBe(1);
        expect(p.findPageForItem(x => x === 'd')).toBe(2);
    });

    it('returns 1 when item is not found', () => {
        const p = new window.Pagination({ itemsPerPage: 3 });
        p.setData(['a', 'b', 'c']);
        expect(p.findPageForItem(x => x === 'z')).toBe(1);
    });
});

describe('generatePaginationHTML (static helper)', () => {
    it('returns empty string when totalPages is 1', () => {
        const result = window.generatePaginationHTML({
            startIndex: 0, endIndex: 5, total: 5,
            currentPage: 1, totalPages: 1, onPageChange: 'go'
        });
        expect(result).toBe('');
    });

    it('includes Showing info and both Previous/Next buttons on a middle page', () => {
        const html = window.generatePaginationHTML({
            startIndex: 10, endIndex: 20, total: 50,
            currentPage: 2, totalPages: 5, onPageChange: 'goToPage'
        });
        expect(html).toContain('Showing 11-20 of 50');
        expect(html).toContain('Previous');
        expect(html).toContain('Next');
    });

    it('shows page 1 and last page buttons with ellipsis for far-middle page', () => {
        const html = window.generatePaginationHTML({
            startIndex: 70, endIndex: 80, total: 200,
            currentPage: 8, totalPages: 20, onPageChange: 'goToPage'
        });
        expect(html).toContain('>1<');
        expect(html).toContain('>20<');
        expect(html).toContain('...');
    });

    it('does not show ellipsis or leading page when start is page 1', () => {
        const html = window.generatePaginationHTML({
            startIndex: 0, endIndex: 10, total: 30,
            currentPage: 1, totalPages: 3, onPageChange: 'goToPage'
        });
        expect(html).not.toContain('...');
        // page 1 is the first page, no separate lead button needed
        expect(html).not.toContain('>1</button></button>');
    });
});

