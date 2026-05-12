/**
 * Main script for RaceRoom Leaderboards Explorer
 * Refactored to use modular architecture
 * 
 * This file now serves as the entry point and coordinator,
 * with functionality delegated to specialized modules:
 * - tab-manager.js: Tab switching
 * - status-display.js: Status information display
 * - modules/pages/driver-search.js: Driver search and filtering
 * - navigation.js: Global navigation functions
 * - mp-pos-service.js: MP position data loading and caching
 */

// ===========================================
// NEW! badge dismissal
// ===========================================
// Hide the NEW! badge on the Records link once the user has clicked it.
// Persists via localStorage so it stays hidden across all pages and sessions.
// Note: this script runs deferred so the DOM is already ready — no DOMContentLoaded needed.
(() => {
    const BADGE_KEY = 'records_new_badge_dismissed';
    const hideBadges = () => {
        document.querySelectorAll('a[href="records.html"] .tab-badge, a[href*="records.html"] .tab-badge')
            .forEach(b => { b.hidden = true; });
    };
    const dismiss = () => {
        try { localStorage.setItem(BADGE_KEY, '1'); } catch (_) {}
        hideBadges();
    };
    // If already on records page, dismiss immediately.
    if (window.location.pathname.endsWith('records.html')) {
        dismiss();
        return;
    }
    // Already dismissed — hide immediately.
    try {
        if (localStorage.getItem(BADGE_KEY)) {
            hideBadges();
            return;
        }
    } catch (_) {}
    // Bind click to dismiss on first visit.
    document.querySelectorAll('a[href="records.html"], a[href*="records.html"]').forEach(link => {
        link.addEventListener('click', dismiss, { once: true });
    });
})();

// ===========================================
// Initialize Data Service
// ===========================================
// Load driver index with page-aware, idle scheduling to avoid UI stutter
(() => {
	const isDriverPage = !!document.getElementById('driver-search');
	const preload = () => {
		try { dataService.loadDriverIndex(); } catch (_) {}
	};
	if (isDriverPage) {
		// Driver Search needs index ASAP
		preload();
	} else {
		// Other pages (e.g., Track Info): defer to idle time
		if (typeof requestIdleCallback === 'function') {
			requestIdleCallback(preload, { timeout: 3000 });
		} else {
			setTimeout(preload, 1000);
		}
	}
})();
