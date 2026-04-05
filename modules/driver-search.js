/**
 * Driver Search Module
 * Handles driver search functionality, filtering, pagination, and results display
 */

class DriverSearch {
    constructor() {
        this.elements = {
            driverSearch: document.getElementById('driver-search'),
            trackFilter: document.getElementById('track-filter'),
            trackFilterUI: document.getElementById('track-filter-ui'),
            classFilter: document.getElementById('class-filter'),
            classFilterUI: document.getElementById('track-class-filter-ui') || document.getElementById('class-filter-ui'),
            resultsContainer: document.getElementById('results-container')
        };

        // Check if we're on the driver search page
        this.isDriverSearchPage = this.elements.driverSearch !== null;
        
        if (!this.isDriverSearchPage) return;

        // Pagination state
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.allResults = [];
        
        // Sort state - load from localStorage or default to 'gap'
        this.currentSortBy = this.loadSortPreference() || 'gap'; // 'gap', 'lapTime', or 'gapPercent'
        
        // Track last search time to prevent premature "no results" display
        this.lastSearchTime = 0;
        this.lastSearchTerm = ''; // Store last search term for filter changes
        
        // Filter values
        this.selectedTrack = ''; // Store selected track filter
        this.selectedClass = ''; // Store selected class/superclass filter
        
        // Debounce timer for live search
        this.searchDebounceTimer = null;
        this.minSearchLength = 3;
        
        // Track search requests to prevent race conditions
        this.currentSearchId = 0;

        // Analytics: tracks how the search was triggered
        this._searchSource = 'input';

        this.init();
    }

    /**
     * Initialize driver search functionality
     */
    init() {
        this.populateTrackFilter();
        this.populateClassFilter();
        this.setupCustomSelects();
        this.setupEventListeners();
        this.handleUrlDriverParam();
        
        // Make goToPage available globally for pagination buttons
        window.goToPage = (page) => this.goToPage(page);
        
        // Make sortDriverGroups available globally for sorting
        window.sortDriverGroups = (sortBy) => this.sortDriverGroups(sortBy);
    }

    /**
     * Load sort preference from localStorage
     * @returns {string|null} Sort preference or null if not found
     */
    loadSortPreference() {
        try {
            const saved = localStorage.getItem('driverInfoSortPreference');
            // Validate that it's a known sort key
            if (saved && ['gap', 'lapTime', 'gapPercent', 'position', 'date_time', 'car_class', 'track'].includes(saved)) {
                return saved;
            }
        } catch (e) {
            // localStorage might be disabled or unavailable
            console.warn('localStorage not available:', e);
        }
        return null;
    }

    /**
     * Save sort preference to localStorage
     * @param {string} sortBy - Sort key to save
     */
    saveSortPreference(sortBy) {
        try {
            localStorage.setItem('driverInfoSortPreference', sortBy);
        } catch (e) {
            // localStorage might be full or disabled
            console.warn('Could not save sort preference:', e);
        }
    }

    /**
     * Sort search results by driver name (alphabetically), then by MP position
     * This handles multiple drivers with the same name from different countries/teams
     * @param {Array} results - Search results to sort in-place
     */
    sortResultsByMpPosition(results) {
        if (!Array.isArray(results) || results.length <= 1) return;
        
        results.sort((a, b) => {
            // Primary sort: driver name (case-insensitive, alphabetically)
            const nameA = String(a.driver || '').toLowerCase();
            const nameB = String(b.driver || '').toLowerCase();
            const nameCompare = nameA.localeCompare(nameB);
            if (nameCompare !== 0) return nameCompare;
            
            // Secondary sort: country (alphabetically)
            const countryA = String(a.country || '-').toLowerCase();
            const countryB = String(b.country || '-').toLowerCase();
            const countryCompare = countryA.localeCompare(countryB);
            if (countryCompare !== 0) return countryCompare;
            
            // Tertiary sort: team (alphabetically)
            const teamA = String(a.team || '-').toLowerCase();
            const teamB = String(b.team || '-').toLowerCase();
            const teamCompare = teamA.localeCompare(teamB);
            if (teamCompare !== 0) return teamCompare;
            
            // Final tiebreaker: MP position (ascending - lower position is better)
            const mpPosA = typeof resolveMpPos === 'function' ? resolveMpPos(a.driver, a.country) : null;
            const mpPosB = typeof resolveMpPos === 'function' ? resolveMpPos(b.driver, b.country) : null;
            
            // null values (not in leaderboard) go to the end
            if (mpPosA === null && mpPosB === null) return 0;
            if (mpPosA === null) return 1;
            if (mpPosB === null) return -1;
            return mpPosA - mpPosB;
        });
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
     * Populate track filter from TRACKS_DATA
     */
    populateTrackFilter() {
        if (!this.elements.trackFilter) return;

        const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        if (tracks.length === 0) return;

        const allOption = '<option value="">All tracks</option>';
        const optionsHtml = tracks.map(t =>
            `<option value="${R3EUtils.escapeHtml(String(t.id))}">${R3EUtils.escapeHtml(t.label)}</option>`
        ).join('');

        this.elements.trackFilter.innerHTML = allOption + optionsHtml;
    }

    /**
     * Setup custom select components
     */
    setupCustomSelects() {
        // Track filter custom select
        if (this.elements.trackFilterUI) {
            const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
            const trackOptions = [{ value: '', label: 'All tracks' }]
                .concat(tracks.map(t => ({ value: String(t.id), label: t.label })));

            new CustomSelect('track-filter-ui', trackOptions, async (value) => {
                this.selectedTrack = value;
                if (this.elements.trackFilter) {
                    this.elements.trackFilter.value = value;
                }
                if (this.lastSearchTerm) {
                    this._searchSource = 'filter';
                    await this.searchDriver(this.lastSearchTerm);
                    this.trackDriverFilterUsage('track', value || '', this.allResults.length);
                }
            });
        }

        // Class filter custom select
        if (this.elements.classFilter && this.elements.classFilterUI) {
            // Get superclass options first
            const superclassOptions = dataService.getSuperclassOptions();
            
            // Get regular class options
            const classOptions = dataService.getClassOptionsFromCarsData();
            
            // Combine: All classes, then Category: superclass entries, then regular classes
            const allOptions = [{ value: '', label: 'All classes' }]
                .concat(superclassOptions)
                .concat(classOptions);
            
            const classFilterElementId = document.getElementById('track-class-filter-ui')
                ? 'track-class-filter-ui'
                : 'class-filter-ui';

            new CustomSelect(classFilterElementId, allOptions, async (value) => {
                this.selectedClass = value; // Store directly in the class property
                // Re-search with the last search term if we have one
                if (this.lastSearchTerm) {
                    this._searchSource = 'filter';
                    await this.searchDriver(this.lastSearchTerm);
                    this.trackDriverFilterUsage('class', value || '', this.allResults.length);
                }
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
                this._searchSource = 'input';
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
                
                this._searchSource = 'enter';
                R3EUtils.updateUrlParam('driver', searchTerm);
                await this.searchDriver(searchTerm);
            }
        });

        // Class filter change handler
        if (this.elements.classFilter) {
            this.elements.classFilter.addEventListener('change', async () => {
                const searchTerm = this.elements.driverSearch.value.trim();
                if (!searchTerm) return;
                this._searchSource = 'filter';
                await this.searchDriver(searchTerm);
                this.trackDriverFilterUsage('class', this.selectedClass || this.elements.classFilter.value || '', this.allResults.length);
            });
        }

        // Track filter change handler
        if (this.elements.trackFilter) {
            this.elements.trackFilter.addEventListener('change', async () => {
                const searchTerm = this.elements.driverSearch.value.trim();
                if (!searchTerm) return;
                this._searchSource = 'filter';
                await this.searchDriver(searchTerm);
                this.trackDriverFilterUsage('track', this.selectedTrack || this.elements.trackFilter.value || '', this.allResults.length);
            });
        }
    }

    /**
     * Track explicit filter usage on Driver Info page.
     * @param {string} filterName - Changed filter name
     * @param {string} filterValue - Selected filter value
     * @param {number} resultCount - Result count after filter application
     */
    trackDriverFilterUsage(filterName, filterValue, resultCount) {
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;

        R3EAnalytics.track('driver info filter changed', {
            filter_name: filterName,
            filter_value: filterValue || '',
            track_filter: this.selectedTrack || '',
            class_filter: this.selectedClass || '',
            search_term: this.lastSearchTerm || '',
            result_count: resultCount || 0,
            has_search_term: !!this.lastSearchTerm
        });
    }

    /**
     * Handle URL driver parameter on page load
     */
    handleUrlDriverParam() {
        const driver = R3EUtils.getUrlParam('driver') || R3EUtils.getUrlParam('query');
        if (driver && this.elements.driverSearch) {
            this.elements.driverSearch.value = driver;
            this._searchSource = 'url';
            setTimeout(() => { this.searchDriver(driver); }, 50);
        }
    }

    /**
     * Search for driver in the leaderboards
     * @param {string} driverName - Driver name to search
     */
    async searchDriver(driverName) {
        this.lastSearchTime = Date.now();
        this.lastSearchTerm = driverName; // Store the search term
        
        // Increment search ID to track this request and discard outdated results
        const searchId = ++this.currentSearchId;
        
        await TemplateHelper.showLoading(this.elements.resultsContainer, 'Searching...');
        
        try {
            // Get current filters
            const selectedTrack = this.selectedTrack || '';
            const selectedClass = this.selectedClass || '';
            
            // Search using data service
            const results = await dataService.searchDriver(driverName, {
                trackId: selectedTrack,
                className: selectedClass
            });
            
            // Discard results if a newer search has started
            if (searchId !== this.currentSearchId) {
                return;
            }
            
            // Sort results by MP position (ascending) when multiple drivers have the same name
            this.sortResultsByMpPosition(results);
            
            this.allResults = results;
            this.currentPage = 1;
            this.displayResults(results, searchId);

            // Analytics: track the completed search
            if (typeof R3EAnalytics !== 'undefined') {
                const isExact = (driverName.startsWith('"') && driverName.endsWith('"')) ||
                                (driverName.startsWith("'") && driverName.endsWith("'"));
                R3EAnalytics.trackSearch(driverName, results.length, {
                    trackFilter: selectedTrack,
                    classFilter: selectedClass,
                    source: this._searchSource || 'input',
                    isExact: isExact
                });
            }
        } catch (error) {
            console.error('Search error:', error);
            this.displayError(error.message);
        }
    }

    /**
     * Display search results
     * @param {Array} data - Search results
     * @param {number} searchId - Search request ID to verify this is the latest search
     */
    async displayResults(data, searchId) {
        const activeSearchId = typeof searchId === 'number' ? searchId : this.currentSearchId;

        // Discard results if a newer search has started
        if (activeSearchId !== this.currentSearchId) {
            return;
        }
        
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
            const dataKeys = Object.keys(paginatedDrivers[0].entries[0]);
            // Use ColumnConfig if available for proper column ordering
            if (window.ColumnConfig) {
                keys = window.ColumnConfig.getOrderedColumns(dataKeys, { addSynthetic: true });
            } else {
                // Fallback to tableRenderer method
                keys = tableRenderer.filterAndSortKeys(dataKeys);
            }
        }
        
        // Render table
        const tableHTML = tableRenderer.renderDriverGroupedTable(paginatedDrivers, keys, this.currentSortBy);
        
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
    
    /**
     * Sort driver groups by gap time, lap time, gap percentage, position, or date
     * @param {string} sortBy - Sort key: 'gap', 'lapTime', 'gapPercent', 'position', or 'date_time'
     */
    sortDriverGroups(sortBy) {
        if (sortBy === 'lapTimeToggle') {
            if (this.currentSortBy === 'gap') {
                sortBy = 'lapTime';
            } else if (this.currentSortBy === 'lapTime') {
                sortBy = 'gap';
            } else {
                sortBy = 'gap';
            }
        }
        if (this.currentSortBy === sortBy) return; // Already sorted by this
        this.currentSortBy = sortBy;
        this.saveSortPreference(sortBy); // Save preference to localStorage
        this.displayResults(this.allResults);
    }
}

// Auto-initialize when DOM is fully ready.
// With deferred scripts, readyState can be 'interactive' before dependent data scripts run.
if (document.readyState === 'complete') {
    window.driverSearch = new DriverSearch();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        window.driverSearch = new DriverSearch();
    }, { once: true });
}
