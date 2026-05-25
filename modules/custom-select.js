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
     * Builds logo HTML from a logos array or single logoUrl.
     * @param {Object} opt - Option object with optional logos[] or logoUrl
     * @returns {string} HTML string for logos
     */
    static buildLogosHtml(opt) {
        if (opt.logos && opt.logos.length > 0) {
            const imgs = opt.logos.map(url =>
                `<img class="custom-select__option-logo" src="${R3EUtils.escapeHtml(url)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`
            ).join('');
            return `<span class="custom-select__logos-group">${imgs}</span>`;
        }
        if (opt.logoUrl) {
            return `<img class="custom-select__option-logo" src="${R3EUtils.escapeHtml(opt.logoUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
        }
        return '';
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

            const logoHtml = CustomSelect.buildLogosHtml(opt);
            
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
        this.menu.style.left = '';
        this.menu.style.right = '';
        this.toggle.setAttribute('aria-expanded', 'true');
        this.root.classList.add('is-open');
        // Keep menu inside viewport: shift left first, then clamp width
        this.menu.style.maxWidth = '';
        this._clampToViewport();
        // Reset search and focus input
        if (this.searchInput) {
            this.searchInput.value = '';
            this._filterOptions('');
            // Only auto-focus on desktop to avoid mobile keyboard popping up
            if (window.matchMedia('(min-width: 1001px)').matches) {
                requestAnimationFrame(() => this.searchInput.focus());
            }
        }
    }

    /**
     * Clamps the dropdown menu within the viewport using a double-rAF
     * to ensure layout is computed on mobile devices. Uses visualViewport
     * API when available to handle pinch-zoom correctly.
     */
    _clampToViewport() {
        // Double-rAF: first rAF ensures the element is in the render tree,
        // second rAF ensures layout has been computed (needed on mobile).
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.menu.hidden) return;
                const vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
                const pad = 8;
                const rect = this.menu.getBoundingClientRect();
                if (!rect.width) return; // not laid out yet
                // 1. Shift left so the right edge fits in the viewport
                if (rect.right > vw - pad) {
                    this.menu.style.left = -(rect.right - vw + pad) + 'px';
                }
                // 2. If that pushed past the left edge, pin to left edge
                const afterRect = this.menu.getBoundingClientRect();
                if (afterRect.left < pad) {
                    this.menu.style.left = -(this.root.getBoundingClientRect().left - pad) + 'px';
                    // 3. Clamp width to remaining viewport space
                    this.menu.style.maxWidth = (vw - pad * 2) + 'px';
                }
            });
        });
    }
    
    /**
     * Closes the dropdown
     */
    close() {
        this.menu.hidden = true;
        this.menu.style.left = '';
        this.menu.style.right = '';
        this.menu.style.maxWidth = '';
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

            // Mirror the logo(s) into the toggle button so the selected class is visible when closed.
            const logoHtml = CustomSelect.buildLogosHtml(opt);
            
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

// Export for use in other modules
window.CustomSelect = CustomSelect;
