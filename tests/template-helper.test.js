import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

beforeAll(() => {
    // TemplateLoader is accessed at call-time, not load-time; a stub is enough at load
    window.TemplateLoader = { render: vi.fn() };
    window.generatePaginationHTML = undefined;
    loadBrowserScript('modules/template-helper.js');
});

beforeEach(() => {
    window.TemplateLoader = {
        render: vi.fn().mockImplementation(async (name, data) => {
            const msg = data.message || '';
            const det = data.details || '';
            return `<div class="${name}">${msg}${det ? ` – ${det}` : ''}</div>`;
        })
    };
    window.generatePaginationHTML = undefined;
    document.body.innerHTML = '<div id="container"></div>';
});

describe('TemplateHelper.showLoading', () => {
    it('calls TemplateLoader.render with loading template and default message', async () => {
        const container = document.getElementById('container');
        await window.TemplateHelper.showLoading(container);
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('loading', { message: 'Loading...' });
        expect(container.innerHTML).toContain('Loading...');
    });

    it('passes custom message to template', async () => {
        const container = document.getElementById('container');
        await window.TemplateHelper.showLoading(container, 'Fetching data…');
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('loading', { message: 'Fetching data…' });
        expect(container.innerHTML).toContain('Fetching data…');
    });
});

describe('TemplateHelper.showNoResults', () => {
    it('calls TemplateLoader.render with no-results template and default message', async () => {
        const container = document.getElementById('container');
        await window.TemplateHelper.showNoResults(container);
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('no-results', { message: 'No results found' });
    });

    it('passes custom no-results message', async () => {
        const container = document.getElementById('container');
        await window.TemplateHelper.showNoResults(container, 'No drivers match');
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('no-results', { message: 'No drivers match' });
    });
});

describe('TemplateHelper.showError', () => {
    it('calls TemplateLoader.render with error template, message, and details', async () => {
        const container = document.getElementById('container');
        await window.TemplateHelper.showError(container, 'Load failed', 'Network error');
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('error', {
            message: 'Load failed',
            details: 'Network error'
        });
    });

    it('defaults details to empty string when omitted', async () => {
        const container = document.getElementById('container');
        await window.TemplateHelper.showError(container, 'Oops');
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('error', {
            message: 'Oops',
            details: ''
        });
    });
});

describe('TemplateHelper.generateTable', () => {
    it('wraps headers and rows in a results-table', () => {
        const html = window.TemplateHelper.generateTable(
            ['Name', 'Lap Time'],
            '<tr><td>Alice</td><td>1:23.456</td></tr>'
        );
        expect(html).toMatch(/<table class="results-table">/);
        expect(html).toContain('<th>Name</th>');
        expect(html).toContain('<th>Lap Time</th>');
        expect(html).toContain('<tr><td>Alice</td><td>1:23.456</td></tr>');
    });

    it('produces valid thead/tbody structure', () => {
        const html = window.TemplateHelper.generateTable(['A', 'B'], '<tr><td>1</td><td>2</td></tr>');
        expect(html).toContain('<thead>');
        expect(html).toContain('<tbody>');
    });
});

describe('TemplateHelper.generatePagination', () => {
    it('delegates to window.generatePaginationHTML when available', () => {
        window.generatePaginationHTML = vi.fn().mockReturnValue('<div class="pagination">mock</div>');
        const result = window.TemplateHelper.generatePagination({ totalPages: 3, currentPage: 1 });
        expect(window.generatePaginationHTML).toHaveBeenCalledWith({ totalPages: 3, currentPage: 1 });
        expect(result).toContain('pagination');
    });

    it('falls back to inline implementation when generatePaginationHTML is unavailable', () => {
        window.generatePaginationHTML = undefined;
        // totalPages <= 1 → both implementations return ''
        const result = window.TemplateHelper.generatePagination({
            startIndex: 0, endIndex: 5, total: 5,
            currentPage: 1, totalPages: 1, onPageChange: 'go'
        });
        expect(result).toBe('');
    });
});
