/**
 * Daily Races Module
 * Displays daily sprint races information when no search is active
 */

class DailyRaces {
    constructor() {
        this.elements = {
            resultsContainer: document.getElementById('results-container'),
            driverSearch: document.getElementById('driver-search')
        };

        // Check if we're on the driver search page
        this.isDailyRacesPage = this.elements.resultsContainer !== null;
        
        if (!this.isDailyRacesPage) return;

        this.dailyRacesData = null;
        this.lastUpdateTime = null;
        
        this.init();
    }

    /**
     * Initialize daily races functionality
     */
    async init() {
        // Wait a bit for other modules to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Show daily races on page load.
        // If no search input exists, this page is dedicated to daily races.
        const urlDriver = this.getUrlParam('driver') || this.getUrlParam('query');
        const isDedicatedDailyRacesPage = !this.elements.driverSearch;
        if (isDedicatedDailyRacesPage || (!this.elements.driverSearch.value.trim() && !urlDriver)) {
            await this.showDailyRaces();
        }

        // Listen to search input changes
        if (this.elements.driverSearch) {
            this.elements.driverSearch.addEventListener('input', async (e) => {
                const searchTerm = e.target.value.trim();
                // Show daily races if search is cleared
                if (searchTerm.length === 0) {
                    // Small delay to let other handlers complete
                    setTimeout(async () => {
                        if (this.elements.driverSearch.value.trim().length === 0) {
                            await this.showDailyRaces();
                        }
                    }, 50);
                }
            });
        }
    }

    /**
     * Get URL parameter value
     */
    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    /**
     * Load daily races data from cache
     */
    async loadDailyRaces() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`cache/daily_races.json.gz?v=${timestamp}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load daily races: ${response.status}`);
            }

            if (!window.CompressedJsonHelper || typeof window.CompressedJsonHelper.readGzipJson !== 'function') {
                throw new Error('CompressedJsonHelper is not loaded.');
            }

            this.dailyRacesData = await window.CompressedJsonHelper.readGzipJson(response);
            return this.dailyRacesData;
        } catch (error) {
            console.error('Error loading daily races:', error);
            return null;
        }
    }

    /**
     * Load last update timestamp from status.json
     */
    async loadLastUpdateTime() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`cache/status.json?v=${timestamp}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                return null;
            }
            
            const status = await response.json();
            return status.last_daily_race_refresh;
        } catch (error) {
            console.error('Error loading status:', error);
            return null;
        }
    }

    /**
     * Resolve car class ID to name using mapping table
     */
    resolveCarClassName(classId) {
        if (!classId) return '';
        
        // Use the fast mapping from car-classes.js
        if (window.getCarClassName) {
            return window.getCarClassName(classId);
        }
        
        // Fallback to ID if mapping not loaded
        return String(classId);
    }

    /**
     * Resolve track ID to name
     */
    resolveTrackName(trackId) {
        if (!window.TRACKS_DATA) return trackId;
        
        const track = window.TRACKS_DATA.find(t => String(t.id) === String(trackId));
        return track ? track.label : trackId;
    }

    /**
     * Resolve category_class_ids to their superclass
     * Given a list of class IDs, finds the common superclass from CARS_DATA
     * @param {string[]} categoryClassIds - Array of class IDs (e.g., ["4680", "5726"])
     * @returns {string|null} The superclass name if found, null otherwise
     */
    resolveCategoryToSuperclass(categoryClassIds) {
        if (!categoryClassIds || !Array.isArray(categoryClassIds) || categoryClassIds.length === 0) {
            return null;
        }

        if (!window.CAR_CLASSES_DATA || !window.CARS_DATA) {
            return null;
        }

        // Resolve all class IDs to their class names
        const classNames = categoryClassIds.map(id => {
            const className = window.CAR_CLASSES_DATA[String(id)];
            return className || null;
        }).filter(name => name !== null);

        if (classNames.length === 0) {
            return null;
        }

        // Find superclass for each class name
        const superclasses = new Set();
        classNames.forEach(className => {
            const carEntry = window.CARS_DATA.find(entry => {
                const entryClass = entry.class || entry.car_class || entry.CarClass || '';
                return String(entryClass).trim().toLowerCase() === String(className).trim().toLowerCase();
            });
            
            if (carEntry && carEntry.superclass) {
                superclasses.add(carEntry.superclass);
            }
        });

        // If all class IDs resolve to the same superclass, return it
        if (superclasses.size === 1) {
            return Array.from(superclasses)[0];
        }

        // If multiple different superclasses found, return null (incompatible combination)
        return null;
    }

    /**
     * Map combo class strings to their display names
     * @param {string} comboString - The combo string from daily races (e.g., "PCCD + PCCNA")
     * @returns {string} The mapped display name or original string if no mapping found
     */
    mapComboClassName(comboString) {
        if (!comboString) return '';

        const upperString = String(comboString).trim().toUpperCase();
        
        // Define mappings for combo strings to their display names
        const comboMappings = {
            'PCCD + PCCNA': 'Porsche Cup',
            'PCCNA + PCCD': 'Porsche Cup',
            // Add more mappings as needed
        };

        return comboMappings[upperString] || comboString;
    }

    /**
     * Resolve the race car class as displayed on the tile
     */
    resolveRaceCarClassName(race) {
        // For category races, use the provided class label directly.
        // For regular races, resolve class ID to display name.
        let carClassName = (race.category_class_ids && Array.isArray(race.category_class_ids) && race.category_class_ids.length > 0)
            ? race.car_class
            : this.resolveCarClassName(race.car_class_id);

        return this.mapComboClassName(carClassName);
    }

    /**
     * Detect if any race tile appears to have missing parser fields
     */
    hasScheduleParsingError(races) {
        if (!Array.isArray(races) || races.length === 0) {
            return false;
        }

        return races.some(race => {
            const carClassName = this.resolveRaceCarClassName(race);
            const trackName = this.resolveTrackName(race.track_id);

            const isClassMissing = !carClassName || String(carClassName).trim() === '';
            const isTrackMissing = !trackName || String(trackName).trim() === '';

            return isClassMissing || isTrackMissing;
        });
    }

    /**
     * Build the schedule parser warning banner
     */
    getScheduleParsingErrorBannerHtml() {
        const message = 'Automated schedule parsing error detected, please allow me a few hours to fix it, thank you';
        return `<p style="margin: 0.5rem auto 0; max-width: 760px; padding: 0.65rem 0.9rem; border: 1px solid rgba(220, 38, 38, 0.35); border-left: 4px solid #dc2626; border-radius: 8px; background: rgba(220, 38, 38, 0.08); color: var(--text-primary); font-size: 0.95rem;">${R3EUtils.escapeHtml(message)}</p>`;
    }

    /**
     * Format timestamp to readable format
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        
        try {
            const date = new Date(timestamp);
            if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1) {
                return '-';
            }
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            let relativeTime = '';
            if (diffMins < 1) {
                relativeTime = 'just now';
            } else if (diffMins < 60) {
                relativeTime = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            } else if (diffHours < 24) {
                relativeTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
                relativeTime = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            }
            
            const formatted = date.toLocaleString('en-GB', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            return `${formatted} <span style="white-space: nowrap;">(${relativeTime})</span>`;
        } catch (error) {
            return timestamp;
        }
    }

    /**
     * Show daily races in the results container
     */
    async showDailyRaces() {
        if (!this.elements.resultsContainer) return;

        // Show loading state
        this.elements.resultsContainer.innerHTML = `
            <div class="daily-races-loading">
                <div class="loading-spinner"></div>
                <p>Loading daily races...</p>
            </div>
        `;

        // Load data
        const [racesData, updateTime] = await Promise.all([
            this.loadDailyRaces(),
            this.loadLastUpdateTime()
        ]);

        if (!racesData || !racesData.races || racesData.races.length === 0) {
            this.elements.resultsContainer.innerHTML = `
                <div class="daily-races-error">
                    <h3>Daily Races</h3>
                    <p>Unable to load daily races information. Please try again later.</p>
                </div>
            `;
            return;
        }

        const buildRaceCards = (races, options = {}) => {
            const { centerFourthOnDesktop = false } = options;
            const gridClasses = ['daily-races-grid'];
            if (centerFourthOnDesktop && races.length === 4) {
                gridClasses.push('daily-races-grid--center-fourth');
            }

            let cardsHtml = `<div class="${gridClasses.join(' ')}">`;

            for (const race of races) {
                const carClassName = this.resolveRaceCarClassName(race);
                
                const trackName = this.resolveTrackName(race.track_id);
                const isFree = race.is_free_to_play;
                const freeIcon = '🆓';

                // Create link to detail page
                // If this is a category with multiple class IDs, pass them as a comma-separated list
                let detailLink;
                if (race.category_class_ids && Array.isArray(race.category_class_ids) && race.category_class_ids.length > 0) {
                    // Use specific class IDs for multi-class categories
                    const classIds = race.category_class_ids.join(',');
                    detailLink = `detail.html?track=${race.track_id}&classes=${classIds}`;
                } else {
                    detailLink = `detail.html?track=${race.track_id}&class=${race.car_class_id}`;
                }

                cardsHtml += `<a href="${detailLink}" target="_blank" class="daily-race-card-link">`;
                cardsHtml += '<div class="daily-race-card">';
                if (isFree) {
                    cardsHtml += `<div class="daily-race-badge free">${freeIcon}</div>`;
                }
                cardsHtml += '<div class="daily-race-content">';
                cardsHtml += `<div class="daily-race-class">${R3EUtils.escapeHtml(carClassName)}</div>`;

                // Split track name on dash for better formatting
                const trackParts = trackName.split(' - ');
                const trackMain = trackParts[0];
                const trackLayout = trackParts.length > 1 ? trackParts.slice(1).join(' - ') : '';

                cardsHtml += '<div class="daily-race-track">';
                cardsHtml += R3EUtils.escapeHtml(trackMain);
                if (trackLayout) {
                    cardsHtml += `<br><span class="daily-race-track-layout">${R3EUtils.escapeHtml(trackLayout)}</span>`;
                }
                cardsHtml += '</div>';
                const cleanedSchedule = race.schedule
                    ? String(race.schedule).replace(/`/g, '').trim()
                    : '';
                if (cleanedSchedule) {
                    cardsHtml += `<div class="daily-race-schedule">⏱️ ${R3EUtils.escapeHtml(cleanedSchedule)}</div>`;
                }
                cardsHtml += '</div>';
                cardsHtml += '</div>';
                cardsHtml += '</a>';
            }

            cardsHtml += '</div>';
            return cardsHtml;
        };

        // Build HTML
        let html = '<div class="daily-races-container">';
        
        // Header
        html += '<div class="daily-races-header">';
        html += '<h2>📅 This Week in Ranked Multiplayer</h2>';
        html += '<p class="daily-races-cta">Enter the leaderboards to secure your qualification!</p>';
        if (updateTime) {
            html += `<p class="daily-races-update">Last cache update: ${this.formatTimestamp(updateTime)}</p><br/>`;
        }
        html += '</div>';

        html += '<div class="daily-races-section-header">';
        html += '<h3 class="daily-races-section-title">Daily Sprint Races (15 min)</h3>';
        if (this.hasScheduleParsingError(racesData.races)) {
            html += this.getScheduleParsingErrorBannerHtml();
        }
        html += '</div>';

        // Races grid
        html += buildRaceCards(racesData.races, { centerFourthOnDesktop: true });

        const featureRaces = racesData['feature-races'];
        if (Array.isArray(featureRaces) && featureRaces.length > 0) {
            html += '<div class="daily-races-feature">';
            html += '<div class="daily-races-section-header">';
            html += '<h3 class="daily-races-section-title">Daily Feature Races (30 min)</h3>';
            if (this.hasScheduleParsingError(featureRaces)) {
                html += this.getScheduleParsingErrorBannerHtml();
            }
            html += '</div>';
            html += buildRaceCards(featureRaces);
            html += '</div>';
        }
        
        html += '</div>'; // daily-races-container

        this.elements.resultsContainer.innerHTML = html;
    }
}

// Auto-initialize when DOM is fully ready.
// With deferred scripts, readyState can be 'interactive' before dependent data scripts run.
if (document.readyState === 'complete') {
    window.dailyRaces = new DailyRaces();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        window.dailyRaces = new DailyRaces();
    }, { once: true });
}
