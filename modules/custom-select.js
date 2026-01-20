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
     */
    constructor(elementId, options = [], onChange = null) {
        this.root = document.getElementById(elementId);
        if (!this.root) {
            console.warn(`CustomSelect: element ${elementId} not found`);
            return;
        }
        
        this.toggle = this.root.querySelector('.custom-select__toggle');
        this.menu = this.root.querySelector('.custom-select__menu');
        this.options = options;
        this.onChange = onChange;
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
        this.setValue(''); // Set to first option
    }
    
    /**
     * Builds the dropdown menu from options
     */
    buildMenu() {
        this.menu.innerHTML = this.options.map(opt => {
            const escapedValue = R3EUtils.escapeHtml(opt.value);
            const escapedLabel = R3EUtils.escapeHtml(opt.label);
            
            // Format label with bold prefix for Category: and Combined:
            let formattedLabel = escapedLabel;
            if (escapedLabel.startsWith('Category: ')) {
                formattedLabel = '<strong>Category:</strong> ' + escapedLabel.substring(10);
            } else if (escapedLabel.startsWith('Combined: ')) {
                formattedLabel = '<strong>Combined:</strong> ' + escapedLabel.substring(10);
            }
            
            return `<div class="custom-select__option" data-value="${escapedValue}">${formattedLabel}</div>`;
        }).join('');
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
            this.setValue(value);
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
        this.menu.hidden = false;
        this.toggle.setAttribute('aria-expanded', 'true');
    }
    
    /**
     * Closes the dropdown
     */
    close() {
        this.menu.hidden = true;
        this.toggle.setAttribute('aria-expanded', 'false');
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
    setValue(value) {
        this.currentValue = value;
        const opt = this.options.find(o => o.value === value) || this.options[0];
        
        if (opt) {
            // Format label with bold prefix for Category: and Combined:
            let formattedLabel = opt.label;
            if (formattedLabel.startsWith('Category: ')) {
                formattedLabel = '<strong>Category:</strong> ' + formattedLabel.substring(10);
            } else if (formattedLabel.startsWith('Combined: ')) {
                formattedLabel = '<strong>Combined:</strong> ' + formattedLabel.substring(10);
            }
            
            this.toggle.innerHTML = `${formattedLabel} ▾`;
        }
        
        this.updateSelectedState();
        this.close();
        
        if (this.onChange && typeof this.onChange === 'function') {
            this.onChange(value);
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
