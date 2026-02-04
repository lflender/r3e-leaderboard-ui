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
        
        // Show daily races on page load (when search is empty and no URL param)
        const urlDriver = this.getUrlParam('driver') || this.getUrlParam('query');
        if (this.elements.driverSearch && !this.elements.driverSearch.value.trim() && !urlDriver) {
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
            const response = await fetch(`cache/daily_races.json?v=${timestamp}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load daily races: ${response.status}`);
            }
            
            this.dailyRacesData = await response.json();
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
     * Resolve car class ID to name by scanning driver_index
     */
    async resolveCarClassName(classId) {
        if (!classId) return '';
        
        // Try to load driver index
        let idx = null;
        try {
            if (window.dataService) {
                idx = await window.dataService.loadDriverIndex();
            }
        } catch (error) {
            console.error('Error loading driver index for class resolution:', error);
            return classId; // Return ID as fallback
        }
        
        if (!idx) return classId;
        
        const targetId = Number(classId);
        const counts = new Map(); // Map<className, count>
        
        // Scan driver index to find the most common class_name for this class_id
        for (const driverKey of Object.keys(idx)) {
            const entries = idx[driverKey] || [];
            for (const e of entries) {
                const cid = e.class_id || e.ClassID || e.classId;
                if (Number(cid) === targetId) {
                    let cname = e.class_name || e.ClassName;
                    if (!cname && e.car_class) {
                        cname = typeof e.car_class === 'string' ? e.car_class : (e.car_class.class?.Name || e.car_class.class?.name);
                    }
                    cname = cname || e.Class || e.class || '';
                    if (cname) {
                        const key = String(cname).trim();
                        counts.set(key, (counts.get(key) || 0) + 1);
                    }
                }
            }
        }
        
        // Return the most common class name for this ID
        let bestName = null;
        let bestCount = 0;
        for (const [name, count] of counts) {
            if (count > bestCount) {
                bestCount = count;
                bestName = name;
            }
        }
        
        return bestName || classId; // Return ID if name not found
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
     * Format timestamp to readable format
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        
        try {
            const date = new Date(timestamp);
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
            
            const formatted = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `${formatted} (${relativeTime})`;
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

        // Build HTML
        let html = '<div class="daily-races-container">';
        
        // Header
        html += '<div class="daily-races-header">';
        html += '<h2>📅 This Week in Ranked Multiplayer</h2>';
        html += '<h3>Daily Sprint Races (15 min)</h3>';
        html += '<p class="daily-races-cta">Enter the leaderboards to secure your qualification!</p>';
        if (updateTime) {
            html += `<p class="daily-races-update">Last cache update: ${this.formatTimestamp(updateTime)}</p>`;
        }
        html += '</div>';

        // Races grid
        html += '<div class="daily-races-grid">';
        
        // Resolve all car class names first
        const classNamePromises = racesData.races.map(race => 
            this.resolveCarClassName(race.car_class_id)
        );
        const resolvedClassNames = await Promise.all(classNamePromises);
        
        for (let i = 0; i < racesData.races.length; i++) {
            const race = racesData.races[i];
            const carClassName = resolvedClassNames[i];
            const trackName = this.resolveTrackName(race.track_id);
            const isFree = race.is_free_to_play;
            const freeIcon = '🆓';
            
            // Create link to detail page
            const detailLink = `detail.html?track=${race.track_id}&class=${race.car_class_id}`;
            
            html += `<a href="${detailLink}" target="_blank" class="daily-race-card-link">`;
            html += '<div class="daily-race-card">';
            if (isFree) {
                html += `<div class="daily-race-badge free">${freeIcon}</div>`;
            }
            html += '<div class="daily-race-content">';
            html += `<div class="daily-race-class">${R3EUtils.escapeHtml(carClassName)}</div>`;
            
            // Split track name on dash for better formatting
            const trackParts = trackName.split(' - ');
            const trackMain = trackParts[0];
            const trackLayout = trackParts.length > 1 ? trackParts.slice(1).join(' - ') : '';
            
            html += '<div class="daily-race-track">';
            html += R3EUtils.escapeHtml(trackMain);
            if (trackLayout) {
                html += `<br><span class="daily-race-track-layout">${R3EUtils.escapeHtml(trackLayout)}</span>`;
            }
            html += '</div>';
            if (race.schedule) {
                html += `<div class="daily-race-schedule">⏱️ ${R3EUtils.escapeHtml(race.schedule)}</div>`;
            }
            html += '</div>';
            html += '</div>';
            html += '</a>';
        }
        
        html += '</div>'; // daily-races-grid
        
        // Footer note
        html += '<div class="daily-races-footer">';
        html += '<p>Start typing a driver name above to search leaderboards</p>';
        html += '</div>';
        
        html += '</div>'; // daily-races-container

        this.elements.resultsContainer.innerHTML = html;
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.dailyRaces = new DailyRaces();
    });
} else {
    window.dailyRaces = new DailyRaces();
}
