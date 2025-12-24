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
// Load driver index on page load
dataService.loadDriverIndex();
