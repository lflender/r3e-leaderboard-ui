/**
 * Driver Search Module
 * Handles driver search functionality, filtering, pagination, and results display
 */

class DriverSearch {
    constructor() {
        this.elements = {
            driverSearch: document.getElementById('driver-search'),
            classFilter: document.getElementById('class-filter'),
            classFilterUI: document.getElementById('class-filter-ui'),
            difficultyFilterUI: document.getElementById('difficulty-filter-ui'),
            resultsContainer: document.getElementById('results-container')
        };

        // Check if we're on the driver search page
        this.isDriverSearchPage = this.elements.driverSearch !== null;
        
        if (!this.isDriverSearchPage) return;

        // Pagination state
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.allResults = [];
        
        // Track last search time to prevent premature "no results" display
        this.lastSearchTime = 0;
        
        // Debounce timer for live search
        this.searchDebounceTimer = null;
        this.minSearchLength = 3;

        this.init();
    }

    /**
     * Initialize driver search functionality
     */
    init() {
        this.populateClassFilter();
        this.setupCustomSelects();
        this.setupEventListeners();
        this.handleUrlDriverParam();
        
        // Make goToPage available globally for pagination buttons
        window.goToPage = (page) => this.goToPage(page);
    }

    /**
     * Populate class filter from CARS_DATA
     */
    populateClassFilter() {
        if (!this.elements.classFilter) return;
        
        const classOptions = dataService.getClassOptionsFromCarsData();
        if (classOptions.length === 0) return;
        
        const allOption = '<option value="">All classes</option>';
        const optionsHtml = classOptions.map(o => 
            `<option value="${R3EUtils.escapeHtml(o.value)}">${R3EUtils.escapeHtml(o.label)}</option>`
        ).join('');
        
        this.elements.classFilter.innerHTML = allOption + optionsHtml;
    }

    /**
     * Setup custom select components
     */
    setupCustomSelects() {
        // Class filter custom select
        if (this.elements.classFilter && this.elements.classFilterUI) {
            const classOptions = [{ value: '', label: 'All classes' }].concat(
                dataService.getClassOptionsFromCarsData()
            );
            
            new CustomSelect('class-filter-ui', classOptions, async (value) => {
                this.elements.classFilter.value = value;
                const searchTerm = this.elements.driverSearch.value.trim();
                if (searchTerm) await this.searchDriver(searchTerm);
            });
        }

        // Difficulty filter custom select
        if (this.elements.difficultyFilterUI) {
            const difficultyOptions = [
                { value: '', label: 'All difficulties' },
                { value: 'Get Real', label: 'Get Real' },
                { value: 'Amateur', label: 'Amateur' },
                { value: 'Novice', label: 'Novice' }
            ];
            
            new CustomSelect('difficulty-filter-ui', difficultyOptions, async (value) => {
                const searchTerm = this.elements.driverSearch.value.trim();
                if (searchTerm) await this.searchDriver(searchTerm);
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Live search as user types (with debounce)
        this.elements.driverSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            
            // Clear previous timer
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            // Clear results if less than minimum length
            if (searchTerm.length < this.minSearchLength) {
                this.elements.resultsContainer.innerHTML = '';
                return;
            }
            
            // Debounce: wait 300ms after user stops typing
            this.searchDebounceTimer = setTimeout(async () => {
                R3EUtils.updateUrlParam('driver', searchTerm);
                await this.searchDriver(searchTerm);
            }, 300);
        });
        
        // Search input enter key (immediate search, no debounce)
        this.elements.driverSearch.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const searchTerm = this.elements.driverSearch.value.trim();
                if (searchTerm.length < this.minSearchLength) return;
                
                // Cancel debounced search
                if (this.searchDebounceTimer) {
                    clearTimeout(this.searchDebounceTimer);
                }
                
                // Close keyboard on mobile
                e.target.blur();
                
                R3EUtils.updateUrlParam('driver', searchTerm);
                await this.searchDriver(searchTerm);
            }
        });

        // Class filter change handler
        if (this.elements.classFilter) {
            this.elements.classFilter.addEventListener('change', async () => {
                const searchTerm = this.elements.driverSearch.value.trim();
                if (!searchTerm) return;
                await this.searchDriver(searchTerm);
            });
        }
    }

    /**
     * Handle URL driver parameter on page load
     */
    handleUrlDriverParam() {
        const driver = R3EUtils.getUrlParam('driver') || R3EUtils.getUrlParam('query');
        if (driver && this.elements.driverSearch) {
            this.elements.driverSearch.value = driver;
            setTimeout(() => { this.searchDriver(driver); }, 50);
        }
    }

    /**
     * Search for driver in the leaderboards
     * @param {string} driverName - Driver name to search
     */
    async searchDriver(driverName) {
        this.lastSearchTime = Date.now();
        await TemplateHelper.showLoading(this.elements.resultsContainer, 'Searching...');
        
        try {
            // Get current filters
            const selectedClass = this.elements.classFilter ? this.elements.classFilter.value : '';
            const difficultyToggle = document.querySelector('#difficulty-filter-ui .custom-select__toggle');
            const selectedDifficulty = difficultyToggle ? 
                difficultyToggle.textContent.replace(' ▾', '').trim() : 'All difficulties';
            
            // Search using data service
            const results = await dataService.searchDriver(driverName, {
                className: selectedClass,
                difficulty: selectedDifficulty
            });
            
            this.allResults = results;
            this.currentPage = 1;
            this.displayResults(results);
        } catch (error) {
            console.error('Search error:', error);
            this.displayError(error.message);
        }
    }

    /**
     * Display search results
     * @param {Array} data - Search results
     */
    async displayResults(data) {
        if (!Array.isArray(data)) {
            this.displayError('Invalid response format');
            return;
        }
        
        if (data.length === 0) {
            // Only show "no results" if enough time has passed since last search
            const timeSinceSearch = Date.now() - this.lastSearchTime;
            if (timeSinceSearch < 500) {
                await TemplateHelper.showLoading(this.elements.resultsContainer);
                // Schedule showing "no results" after the delay
                setTimeout(async () => {
                    if (this.elements.resultsContainer.innerHTML.includes('Loading')) {
                        await TemplateHelper.showNoResults(this.elements.resultsContainer);
                    }
                }, 500 - timeSinceSearch);
                return;
            }
            await TemplateHelper.showNoResults(this.elements.resultsContainer);
            return;
        }
        
        // Paginate driver groups
        const totalDrivers = data.length;
        const totalPages = Math.ceil(totalDrivers / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalDrivers);
        const paginatedDrivers = data.slice(startIndex, endIndex);
        
        // Calculate total entries shown
        let totalEntriesShown = 0;
        paginatedDrivers.forEach(g => { 
            totalEntriesShown += Array.isArray(g.entries) ? g.entries.length : 0; 
        });
        
        // Get keys from first entry
        let keys = [];
        if (paginatedDrivers.length > 0 && 
            Array.isArray(paginatedDrivers[0].entries) && 
            paginatedDrivers[0].entries.length > 0) {
            keys = Object.keys(paginatedDrivers[0].entries[0]);
            keys = tableRenderer.filterAndSortKeys(keys);
        }
        
        // Render table
        const tableHTML = tableRenderer.renderDriverGroupedTable(paginatedDrivers, keys);
        
        // Generate pagination HTML
        let paginationHTML = '';
        if (totalPages > 1) {
            paginationHTML = this.generatePaginationHTML(
                startIndex, endIndex, totalDrivers, totalEntriesShown, 
                this.currentPage, totalPages
            );
        }
        
        this.elements.resultsContainer.innerHTML = tableHTML + paginationHTML;
    }

    /**
     * Generate pagination HTML
     */
    generatePaginationHTML(startIndex, endIndex, totalDrivers, totalEntriesShown, currentPage, totalPages) {
        let html = '<div class="pagination">';
        html += `<div class="pagination-info">Showing drivers ${startIndex + 1}-${endIndex} of ${totalDrivers} (${totalEntriesShown} total entries)</div>`;
        html += '<div class="pagination-buttons">';
        
        if (currentPage > 1) {
            html += `<button onclick="goToPage(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
        }
        
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            html += `<button onclick="goToPage(1)" class="page-btn">1</button>`;
            if (startPage > 2) html += '<span class="page-ellipsis">...</span>';
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `<button onclick="goToPage(${i})" class="page-btn ${activeClass}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="page-ellipsis">...</span>';
            html += `<button onclick="goToPage(${totalPages})" class="page-btn">${totalPages}</button>`;
        }
        
        if (currentPage < totalPages) {
            html += `<button onclick="goToPage(${currentPage + 1})" class="page-btn">Next ›</button>`;
        }
        
        html += '</div></div>';
        return html;
    }

    /**
     * Display error message
     * @param {string} message - Error message
     */
    displayError(message) {
        this.elements.resultsContainer.innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }

    /**
     * Go to specific page
     * @param {number} page - Page number
     */
    goToPage(page) {
        this.currentPage = page;
        this.displayResults(this.allResults);
        this.elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.driverSearch = new DriverSearch();
    });
} else {
    window.driverSearch = new DriverSearch();
}
