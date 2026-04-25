/**
 * Template Helper Module
 * Provides helper functions to render common UI components using templates
 */

(function() {
    'use strict';

    /**
     * Show loading message
     * @param {HTMLElement} container - Container element
     * @param {string} message - Loading message (default: "Loading...")
     */
    async function showLoading(container, message = 'Loading...') {
        container.innerHTML = await TemplateLoader.render('loading', { message });
    }

    /**
     * Show no results message
     * @param {HTMLElement} container - Container element
     * @param {string} message - No results message (default: "No results found")
     */
    async function showNoResults(container, message = 'No results found') {
        container.innerHTML = await TemplateLoader.render('no-results', { message });
    }

    /**
     * Show error message
     * @param {HTMLElement} container - Container element
     * @param {string} message - Error message
     * @param {string} [details] - Additional details
     */
    async function showError(container, message, details = '') {
        container.innerHTML = await TemplateLoader.render('error', { message, details });
    }

    /**
     * Generate pagination HTML
     * Delegates to pagination.js module for consistency
     * @param {Object} options - Pagination options
     * @param {number} options.startIndex - Start index (0-based)
     * @param {number} options.endIndex - End index (exclusive)
     * @param {number} options.total - Total items
     * @param {number} options.currentPage - Current page number
     * @param {number} options.totalPages - Total pages
     * @param {string} options.onPageChange - Function name to call on page change (e.g., "goToPage")
     * @returns {string} Pagination HTML
     */
    function generatePagination(options) {
        // Delegate to pagination.js — must be loaded before template-helper.js
        return window.generatePaginationHTML(options);
    }

    /**
     * Generate table HTML
     * @param {string[]} headers - Table headers
     * @param {string} rowsHtml - Table rows HTML
     * @returns {string} Table HTML
     */
    function generateTable(headers, rowsHtml) {
        const headersHtml = headers.map(h => `<th>${h}</th>`).join('');
        return `<table class="results-table">
    <thead>
        <tr>${headersHtml}</tr>
    </thead>
    <tbody>
        ${rowsHtml}
    </tbody>
</table>`;
    }

    // Export to global scope
    window.TemplateHelper = {
        showLoading,
        showNoResults,
        showError,
        generatePagination,
        generateTable
    };

})();
