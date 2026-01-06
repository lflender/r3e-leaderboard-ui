/**
 * Main script for RaceRoom Leaderboards Explorer
 * Refactored to use modular architecture
 * 
 * This file now serves as the entry point and coordinator,
 * with functionality delegated to specialized modules:
 * - tab-manager.js: Tab switching
 * - status-display.js: Status information display
 * - driver-search.js: Driver search and filtering
 * - navigation.js: Global navigation functions
 */

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
