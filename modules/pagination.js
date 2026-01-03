/**
 * Pagination Component
 * Reusable pagination component following DRY principle
 * Handles pagination logic and UI rendering
 */

class Pagination {
    /**
     * Creates a pagination component
     * @param {Object} config - Configuration object
     * @param {number} config.itemsPerPage - Items per page
     * @param {Function} config.onPageChange - Callback when page changes
     * @param {HTMLElement} config.scrollTarget - Element to scroll to on page change
     */
    constructor(config = {}) {
        this.itemsPerPage = config.itemsPerPage || 100;
        this.onPageChange = config.onPageChange || null;
        this.scrollTarget = config.scrollTarget || null;
        this.currentPage = 1;
        this.allResults = [];
    }
    
    /**
     * Sets the data to paginate
     * @param {Array} data - Array of items
     */
    setData(data) {
        this.allResults = Array.isArray(data) ? data : [];
        this.currentPage = 1; // Reset to first page
    }
    
    /**
     * Gets current page data
     * @returns {Array} Paginated data
     */
    getCurrentPageData() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.allResults.length);
        return this.allResults.slice(startIndex, endIndex);
    }
    
    /**
     * Gets pagination info
     * @returns {Object} Pagination metadata
     */
    getPageInfo() {
        const totalItems = this.allResults.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        
        return {
            totalItems,
            totalPages,
            currentPage: this.currentPage,
            startIndex,
            endIndex,
            hasNextPage: this.currentPage < totalPages,
            hasPrevPage: this.currentPage > 1
        };
    }
    
    /**
     * Goes to specific page
     * @param {number} page - Page number
     */
    goToPage(page) {
        const info = this.getPageInfo();
        
        if (page < 1 || page > info.totalPages) {
            console.warn(`Invalid page number: ${page}`);
            return;
        }
        
        this.currentPage = page;
        
        // Scroll to target if specified
        if (this.scrollTarget) {
            this.scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Call callback
        if (this.onPageChange && typeof this.onPageChange === 'function') {
            this.onPageChange(this.getCurrentPageData(), this.getPageInfo());
        }
    }
    
    /**
     * Goes to next page
     */
    nextPage() {
        const info = this.getPageInfo();
        if (info.hasNextPage) {
            this.goToPage(this.currentPage + 1);
        }
    }
    
    /**
     * Goes to previous page
     */
    prevPage() {
        const info = this.getPageInfo();
        if (info.hasPrevPage) {
            this.goToPage(this.currentPage - 1);
        }
    }
    
    /**
     * Generates HTML for pagination controls
     * @param {string} paginationId - Unique ID for this pagination instance
     * @returns {string} HTML string
     */
    generateHTML(paginationId = 'pagination') {
        const info = this.getPageInfo();
        
        if (info.totalPages <= 1) {
            return ''; // No pagination needed
        }
        
        let html = '<div class="pagination">';
        html += `<div class="pagination-info">Showing ${info.startIndex + 1}-${info.endIndex} of ${info.totalItems}</div>`;
        html += '<div class="pagination-buttons">';
        
        // Previous button
        if (info.hasPrevPage) {
            html += `<button onclick="window.${paginationId}.prevPage()" class="page-btn">‹ Previous</button>`;
        }
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(info.totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            html += `<button onclick="window.${paginationId}.goToPage(1)" class="page-btn">1</button>`;
            if (startPage > 2) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            html += `<button onclick="window.${paginationId}.goToPage(${i})" class="page-btn ${activeClass}">${i}</button>`;
        }
        
        if (endPage < info.totalPages) {
            if (endPage < info.totalPages - 1) {
                html += '<span class="page-ellipsis">...</span>';
            }
            html += `<button onclick="window.${paginationId}.goToPage(${info.totalPages})" class="page-btn">${info.totalPages}</button>`;
        }
        
        // Next button
        if (info.hasNextPage) {
            html += `<button onclick="window.${paginationId}.nextPage()" class="page-btn">Next ›</button>`;
        }
        
        html += '</div></div>';
        
        return html;
    }
    
    /**
     * Finds page number for a specific item matching a predicate
     * @param {Function} predicate - Function to test each item
     * @returns {number} Page number or 1 if not found
     */
    findPageForItem(predicate) {
        const index = this.allResults.findIndex(predicate);
        if (index === -1) return 1;
        
        return Math.floor(index / this.itemsPerPage) + 1;
    }
}

/**
 * Static helper to generate pagination HTML without creating an instance
 * @param {Object} options - Pagination options
 * @param {number} options.startIndex - Start index (0-based)
 * @param {number} options.endIndex - End index (exclusive)
 * @param {number} options.total - Total items
 * @param {number} options.currentPage - Current page number
 * @param {number} options.totalPages - Total pages
 * @param {string} options.onPageChange - Function name to call on page change (e.g., "goToPage")
 * @returns {string} Pagination HTML
 */
function generatePaginationHTML(options) {
    const { startIndex, endIndex, total, currentPage, totalPages, onPageChange } = options;
    
    if (totalPages <= 1) return '';
    
    // Build info text
    const info = `Showing ${startIndex + 1}-${endIndex} of ${total}`;
    
    // Build buttons HTML
    let buttons = '';
    
    // Previous button
    if (currentPage > 1) {
        buttons += `<button onclick="${onPageChange}(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
    }
    
    // Page number buttons
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // First page + ellipsis
    if (startPage > 1) {
        buttons += `<button onclick="${onPageChange}(1)" class="page-btn">1</button>`;
        if (startPage > 2) {
            buttons += '<span class="page-ellipsis">...</span>';
        }
    }
    
    // Page number range
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        buttons += `<button onclick="${onPageChange}(${i})" class="page-btn ${activeClass}">${i}</button>`;
    }
    
    // Ellipsis + last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            buttons += '<span class="page-ellipsis">...</span>';
        }
        buttons += `<button onclick="${onPageChange}(${totalPages})" class="page-btn">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        buttons += `<button onclick="${onPageChange}(${currentPage + 1})" class="page-btn">Next ›</button>`;
    }
    
    return `<div class="pagination">
    <div class="pagination-info">${info}</div>
    <div class="pagination-buttons">${buttons}</div>
</div>`;
}

/**
 * Legacy helper function - creates pagination and returns goToPage function
 * @param {Array} data - Data to paginate
 * @param {number} itemsPerPage - Items per page
 * @param {Function} displayCallback - Callback to display results
 * @param {HTMLElement} scrollTarget - Element to scroll to
 * @returns {Function} goToPage function
 */
function createPagination(data, itemsPerPage, displayCallback, scrollTarget) {
    const pagination = new Pagination({
        itemsPerPage,
        onPageChange: (pageData, info) => {
            if (displayCallback) {
                displayCallback(data); // Call original display function with full data
            }
        },
        scrollTarget
    });
    
    pagination.setData(data);
    
    return function goToPage(page) {
        pagination.goToPage(page);
    };
}

// Export for use in other modules
window.Pagination = Pagination;
window.createPagination = createPagination;
window.generatePaginationHTML = generatePaginationHTML;
