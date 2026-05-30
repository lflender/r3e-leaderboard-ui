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
        window.openDriverProfile = (headerEl) => this.openDriverProfile(headerEl);
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
        if (!rows.length) return;
        
        const isCurrentlyHidden = rows[0].style.display === 'none';
        
        rows.forEach((row, i) => {
            if (isCurrentlyHidden) {
                const delay = i * 0.02;
                setTimeout(function() {
                    row.style.opacity = '0';
                    row.style.display = '';
                    row.classList.add('group-row-enter');
                    row.addEventListener('animationend', function handler() {
                        row.classList.remove('group-row-enter');
                        row.style.opacity = '';
                        row.removeEventListener('animationend', handler);
                    });
                }, delay * 1000);
            } else {
                row.style.animationDelay = (i * 0.02) + 's';
                row.classList.add('group-row-exit');
                row.addEventListener('animationend', function handler() {
                    row.classList.remove('group-row-exit');
                    row.style.display = 'none';
                    row.style.animationDelay = '';
                    row.removeEventListener('animationend', handler);
                });
            }
        });

        if (headerElem) {
            if (isCurrentlyHidden) {
                headerElem.classList.remove('collapsed');
            } else {
                headerElem.classList.add('collapsed');
            }
        }
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

            // Determine whether click originated from driver-search or track-info page.
            const sourcePage = document.getElementById('driver-search')
                ? 'driver'
                : document.getElementById('track-info-table')
                    ? 'track'
                    : 'unknown';

            if (typeof R3EAnalytics !== 'undefined' && typeof R3EAnalytics.track === 'function') {
                try {
                    R3EAnalytics.track('leaderboard row opened', {
                        track_id: trackId || track || '',
                        class_id: classId || carClass || '',
                        superclass: superclass || '',
                        position: pos || '',
                        has_driver_name: !!driverName,
                        source_page: sourcePage,
                        is_combined_view: !!superclass
                    });
                } catch (_) { /* never block navigation */ }
            }

            window.open(url, '_blank');
        }
    }

    /**
     * Open driver profile page for a driver group header
     * @param {HTMLElement} headerEl - Driver group header row element
     */
    openDriverProfile(headerEl) {
        const driverName = headerEl?.dataset?.driverName;
        if (!driverName) return;

        const pathId = headerEl?.dataset?.pathId || '';
        const encodedDriver = encodeURIComponent(`"${driverName}"`);
        let url = `profile.html?driver=${encodedDriver}`;
        if (pathId) {
            url += `&id=${encodeURIComponent(pathId)}`;
        }
        window.open(url, '_blank');
    }
}

// Auto-initialize when DOM is fully ready.
if (document.readyState === 'complete') {
    window.navigation = new Navigation();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        window.navigation = new Navigation();
    }, { once: true });
}
