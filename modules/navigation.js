/**
 * Navigation Module
 * Handles global navigation functions (toggle groups, open detail view)
 */

class Navigation {
    constructor() {
        this.init();
    }

    /**
     * Initialize navigation
     */
    init() {
        // Make functions globally accessible for onclick handlers
        window.toggleGroup = (target) => this.toggleGroup(target);
        window.openDetailView = (event, row) => this.openDetailView(event, row);
    }

    /**
     * Toggle driver group visibility
     * @param {HTMLElement|string} target - Header element or group ID
     */
    toggleGroup(target) {
        let headerElem = null;
        let group = null;
        
        if (target && typeof target === 'object' && target.dataset) {
            headerElem = target;
            group = target.dataset.group;
        } else if (typeof target === 'string') {
            group = target;
        } else {
            return;
        }
        
        if (!group) return;
        
        const rows = document.querySelectorAll(`.${group}`);
        const icon = headerElem ? headerElem.querySelector('.toggle-icon') : null;
        
        rows.forEach(row => {
            if (row.style.display === 'none') {
                row.style.display = '';
                if (icon) icon.textContent = '▼';
            } else {
                row.style.display = 'none';
                if (icon) icon.textContent = '▶';
            }
        });
    }

    /**
     * Open detail view for a leaderboard entry
     * Works on both Driver and Track pages
     * @param {Event} event - Click event
     * @param {HTMLElement} row - Table row element
     */
    openDetailView(event, row) {
        if (event && event.target && event.target.closest && event.target.closest('.driver-group-header')) {
            return;
        }

        const trackId = row?.dataset?.trackid;
        const classId = row?.dataset?.classid;
        const superclass = row?.dataset?.superclass; // For combined mode
        const track = row?.dataset?.track;
        const carClass = row?.dataset?.class;
        const pos = row?.dataset?.position;
        const driverName = row?.dataset?.name || row?.dataset?.driver || '';
        const lapTime = row?.dataset?.time || '';

        const difficultyToggle = document.querySelector('#difficulty-filter-ui .custom-select__toggle');
        const selectedDifficulty = difficultyToggle ?
            difficultyToggle.textContent.replace(' ▾', '').trim() : 'All difficulties';

        let url = '';
        // If superclass is set, use it instead of classId (for combined view)
        if (trackId && superclass) {
            url = `detail.html?track=${encodeURIComponent(trackId)}&superclass=${encodeURIComponent(superclass)}`;
        } else if (trackId && classId) {
            url = `detail.html?track=${encodeURIComponent(trackId)}&class=${encodeURIComponent(classId)}`;
        } else if (track && carClass) {
            url = `detail.html?track=${encodeURIComponent(track)}&class=${encodeURIComponent(carClass)}`;
        }

        if (url) {
            if (pos) url += `&pos=${encodeURIComponent(pos)}`;
            if (driverName) url += `&driver=${encodeURIComponent(driverName)}`;
            if (lapTime) url += `&time=${encodeURIComponent(lapTime)}`;
            if (selectedDifficulty !== 'All difficulties') {
                url += `&difficulty=${encodeURIComponent(selectedDifficulty)}`;
            }
            window.open(url, '_blank');
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.navigation = new Navigation();
    });
} else {
    window.navigation = new Navigation();
}
