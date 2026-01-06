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
        // Delegate to pagination module if available
        if (typeof window.generatePaginationHTML === 'function') {
            return window.generatePaginationHTML(options);
        }
        
        // Fallback implementation (should not be reached if pagination.js is loaded)
        console.warn('pagination.js not loaded, using fallback pagination');
        const { startIndex, endIndex, total, currentPage, totalPages, onPageChange } = options;
        
        if (totalPages <= 1) return '';
        
        const info = `Showing ${startIndex + 1}-${endIndex} of ${total}`;
        let buttons = '';
        
        if (currentPage > 1) {
            buttons += `<button onclick="${onPageChange}(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
        }
        
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            buttons += `<button onclick="${onPageChange}(1)" class="page-btn">1</button>`;
            if (startPage > 2) {
                buttons += '<span class="page-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            buttons += `<button onclick="${onPageChange}(${i})" class="page-btn ${activeClass}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                buttons += '<span class="page-ellipsis">...</span>';
            }
            buttons += `<button onclick="${onPageChange}(${totalPages})" class="page-btn">${totalPages}</button>`;
        }
        
        if (currentPage < totalPages) {
            buttons += `<button onclick="${onPageChange}(${currentPage + 1})" class="page-btn">Next ›</button>`;
        }
        
        return `<div class="pagination">
    <div class="pagination-info">${info}</div>
    <div class="pagination-buttons">${buttons}</div>
</div>`;
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
