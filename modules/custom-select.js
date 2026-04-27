/**
 * Custom Select Component
 * Reusable dropdown component following Component Pattern
 * Implements OCP (Open/Closed Principle) - open for extension, closed for modification
 */

class CustomSelect {
    /**
     * Creates a custom select component
     * @param {string} elementId - ID of the root element
     * @param {Array<{value: string, label: string}>} options - Dropdown options
     * @param {Function} onChange - Callback when selection changes
     * @param {Object} [opts] - Additional options
     * @param {boolean} [opts.searchable=true] - Whether to show the search input
     */
    constructor(elementId, options = [], onChange = null, opts = {}) {
        this.root = document.getElementById(elementId);
        if (!this.root) {
            console.warn(`CustomSelect: element ${elementId} not found`);
            return;
        }
        
        this.toggle = this.root.querySelector('.custom-select__toggle');
        this.menu = this.root.querySelector('.custom-select__menu');
        this.options = options;
        this.onChange = onChange;
        this.searchable = opts.searchable !== false;
        this.currentValue = '';
        
        this.init();
    }
    
    /**
     * Initializes the component
     */
    init() {
        if (!this.toggle || !this.menu) return;
        
        this.buildMenu();
        this.attachEventListeners();
        // Initialize UI without firing change callbacks.
        this.setValue('', { notify: false, source: 'init' }); // Set to first option
    }
    
    /**
     * Builds the dropdown menu from options
     */
    buildMenu() {
        const searchHtml = this.searchable
            ? `<div class="custom-select__search-wrap">
            <input class="custom-select__search" type="search" placeholder="Search…" autocomplete="off" aria-label="Filter options">
        </div>
        <div class="custom-select__no-results" hidden>No results</div>`
            : '';

        const optionsHtml = this.options.map(opt => {
            const escapedValue = R3EUtils.escapeHtml(opt.value);
            const escapedLabel = R3EUtils.escapeHtml(opt.label);
            
            // Format label with bold prefix for Category: and Combined:
            let formattedLabel = opt.labelHtml || escapedLabel;
            if (!opt.labelHtml) {
                if (escapedLabel.startsWith('Category: ')) {
                    formattedLabel = '<strong>Category:</strong> ' + escapedLabel.substring(10);
                } else if (escapedLabel.startsWith('Combined: ')) {
                    formattedLabel = '<strong>Combined:</strong> ' + escapedLabel.substring(10);
                }
            }

            // Optional car class logo prepended to the option label.
            const logoHtml = opt.logoUrl
                ? `<img class="custom-select__option-logo" src="${R3EUtils.escapeHtml(opt.logoUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`
                : '';
            
            return `<div class="custom-select__option" data-value="${escapedValue}">${logoHtml}${formattedLabel}</div>`;
        }).join('');

        this.menu.innerHTML = searchHtml + `<div class="custom-select__options-list">${optionsHtml}</div>`;
        this.searchInput = this.searchable ? this.menu.querySelector('.custom-select__search') : null;
        this.noResults = this.searchable ? this.menu.querySelector('.custom-select__no-results') : null;
        this.optionsList = this.menu.querySelector('.custom-select__options-list');
    }
    
    /**
     * Attaches event listeners
     */
    attachEventListeners() {
        // Toggle dropdown
        this.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen() ? this.close() : this.open();
        });
        
        // Select option
        this.menu.addEventListener('click', (e) => {
            const opt = e.target.closest('.custom-select__option');
            if (!opt) return;
            const value = opt.dataset.value;
            this.setValue(value, { source: 'user' });
        });

        // Live search filter
        this.menu.addEventListener('input', (e) => {
            if (e.target !== this.searchInput) return;
            this._filterOptions(e.target.value);
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.root.contains(e.target)) {
                this.close();
            }
        });
    }
    
    /**
     * Opens the dropdown
     */
    open() {
        document.querySelectorAll('.custom-select').forEach((el) => {
            if (el !== this.root) {
                el.classList.remove('is-open');
                const menu = el.querySelector('.custom-select__menu');
                const toggle = el.querySelector('.custom-select__toggle');
                if (menu) menu.hidden = true;
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
        this.menu.hidden = false;
        this.toggle.setAttribute('aria-expanded', 'true');
        this.root.classList.add('is-open');
        // Reset search and focus input
        if (this.searchInput) {
            this.searchInput.value = '';
            this._filterOptions('');
            // Defer focus so the menu is visible first
            requestAnimationFrame(() => this.searchInput.focus());
        }
    }
    
    /**
     * Closes the dropdown
     */
    close() {
        this.menu.hidden = true;
        this.toggle.setAttribute('aria-expanded', 'false');
        this.root.classList.remove('is-open');
        // Reset search state
        if (this.searchInput) {
            this.searchInput.value = '';
            this._filterOptions('');
        }
    }
    
    /**
     * Checks if dropdown is open
     * @returns {boolean}
     */
    isOpen() {
        return !this.menu.hidden;
    }
    
    /**
     * Sets the selected value
     * @param {string} value - Value to select
     */
    setValue(value, options = {}) {
        const notify = options.notify !== false;
        const source = options.source || 'programmatic';

        this.currentValue = value;
        const opt = this.options.find(o => o.value === value) || this.options[0];
        
        if (opt) {
            // Format label with bold prefix for Category: and Combined:
            let formattedLabel = opt.labelHtml || opt.label;
            if (!opt.labelHtml) {
                if (formattedLabel.startsWith('Category: ')) {
                    formattedLabel = '<strong>Category:</strong> ' + formattedLabel.substring(10);
                } else if (formattedLabel.startsWith('Combined: ')) {
                    formattedLabel = '<strong>Combined:</strong> ' + formattedLabel.substring(10);
                }
            }

            // Mirror the logo into the toggle button so the selected class is visible when closed.
            const logoHtml = opt.logoUrl
                ? `<img class="custom-select__option-logo" src="${R3EUtils.escapeHtml(opt.logoUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`
                : '';
            
            this.toggle.innerHTML = `${logoHtml}${formattedLabel} ▾`;
        }
        
        this.updateSelectedState();
        this.close();
        
        if (notify && this.onChange && typeof this.onChange === 'function') {
            this.onChange(value, { source });
        }
    }
    
    /**
     * Gets the current value
     * @returns {string}
     */
    getValue() {
        return this.currentValue;
    }
    
    /**
     * Updates the selected state in menu
     */
    updateSelectedState() {
        const menuOptions = this.menu.querySelectorAll('.custom-select__option');
        menuOptions.forEach(opt => {
            if (opt.dataset.value === this.currentValue) {
                opt.setAttribute('aria-selected', 'true');
            } else {
                opt.removeAttribute('aria-selected');
            }
        });
    }

    /**
     * Filters visible options by query string
     * @param {string} query
     */
    _filterOptions(query) {
        const q = query.trim().toLowerCase();
        const allOptions = this.menu.querySelectorAll('.custom-select__option');
        let visibleCount = 0;
        allOptions.forEach(opt => {
            const label = (opt.dataset.value === '' ? 'all' : '') + (opt.textContent || '').toLowerCase();
            const matches = !q || label.includes(q);
            opt.hidden = !matches;
            if (matches) visibleCount++;
        });
        if (this.noResults) {
            this.noResults.hidden = visibleCount > 0;
        }
    }
    
    /**
     * Updates the options list
     * @param {Array<{value: string, label: string}>} newOptions - New options
     */
    setOptions(newOptions) {
        this.options = newOptions;
        this.buildMenu();
        this.updateSelectedState();
    }
}

/**
 * Legacy helper function for backward compatibility
 * Sets up a custom select using the same pattern as original code
 * @param {string} id - Element ID
 * @param {Array<{value: string, label: string}>} options - Options array
 * @param {Function} onChange - Change callback
 * @returns {CustomSelect} Instance
 */
function setupCustomSelect(id, options, onChange) {
    return new CustomSelect(id, options, onChange);
}

// Export for use in other modules
window.CustomSelect = CustomSelect;
window.setupCustomSelect = setupCustomSelect;
