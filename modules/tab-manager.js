/**
 * Tab Manager Module
 * Handles tab switching functionality across the application
 */

class TabManager {
    constructor() {
        this.tabButtons = Array.from(document.querySelectorAll('.tab-button')).filter(b => b.dataset && b.dataset.tab);
        this.tabPanels = document.querySelectorAll('.tab-panel');
        this.init();
    }

    /**
     * Initialize tab event listeners
     */
    init() {
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });
    }

    /**
     * Switch to a specific tab
     * @param {string} targetTab - The tab ID to switch to
     */
    switchTab(targetTab) {
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        this.tabPanels.forEach(panel => panel.classList.remove('active'));
        
        const activeButton = this.tabButtons.find(btn => btn.dataset.tab === targetTab);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        const activePanel = document.getElementById(targetTab);
        if (activePanel) {
            activePanel.classList.add('active');
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.tabManager = new TabManager();
    });
} else {
    window.tabManager = new TabManager();
}
