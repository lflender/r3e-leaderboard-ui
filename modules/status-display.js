/**
 * Status Display Module
 * Handles fetching and displaying system status information
 */

class StatusDisplay {
    constructor() {
        this.elements = {
            timestamp: document.getElementById('status-timestamp'),
            timestampLabel: document.getElementById('status-timestamp-label'),
            tracks: document.getElementById('status-tracks'),
            combinations: document.getElementById('status-combinations'),
            totalCombinations: document.getElementById('status-total-combinations'),
            entries: document.getElementById('status-entries'),
            drivers: document.getElementById('status-drivers'),
            led: document.getElementById('status-led')
        };
        this.init();
    }

    /**
     * Initialize status display
     */
    async init() {
        await this.fetchAndDisplay();
    }

    /**
     * Fetch and display current status
     */
    async fetchAndDisplayStatus() {
        try {
            const statusData = await dataService.calculateStatus();
            
            if (!statusData) {
                return;
            }
            
            this.displayStatus({ data: statusData });
        } catch (error) {
            console.error('Error calculating status:', error);
        }
    }

    /**
     * Display status information
     * @param {Object} data - Status data
     */
    displayStatus(data) {
        const statusData = data.data || data;
        
        const driversCount = statusData.total_drivers || 0;
        // Check both boolean and string "true" values, default to false
        const fetchInProgress = (statusData.fetch_in_progress === true || statusData.fetch_in_progress === 'true');
        
        // Update timestamp label
        if (this.elements.timestampLabel) {
            this.elements.timestampLabel.textContent = fetchInProgress ? 
                'Last partial update:' : 'Last complete update:';
        }
        
        // Update timestamp
        if (this.elements.timestamp) {
            let timestamp = fetchInProgress ? 
                statusData.last_index_update : statusData.last_scrape_end;
            
            if (timestamp) {
                const date = new Date(timestamp);
                this.elements.timestamp.textContent = date.toLocaleString('en-GB', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                });
            } else {
                this.elements.timestamp.textContent = '-';
            }
        }
        
        // Update counts
        if (this.elements.tracks) {
            this.elements.tracks.textContent = (statusData.total_unique_tracks || 0).toLocaleString();
        }
        if (this.elements.combinations) {
            this.elements.combinations.textContent = (statusData.track_count || 0).toLocaleString();
        }
        if (this.elements.totalCombinations) {
            this.elements.totalCombinations.textContent = (statusData.total_fetched_combinations || 0).toLocaleString();
        }
        if (this.elements.entries) {
            this.elements.entries.textContent = (statusData.total_entries || 0).toLocaleString();
        }
        if (this.elements.drivers) {
            this.elements.drivers.textContent = driversCount.toLocaleString();
        }
        
        // Update status LED
        this.updateStatusLed(statusData, fetchInProgress);
    }

    /**
     * Update status LED indicator
     * @param {Object} statusData - Status data
     * @param {boolean} fetchInProgress - Whether fetch is in progress
     */
    updateStatusLed(statusData, fetchInProgress) {
        if (!this.elements.led) return;

        const uniqueTracks = statusData.total_unique_tracks || 0;
        // Use TRACKS_DATA length if available, otherwise hardcode expected count (177 as of Dec 2025)
        const expectedTracks = (window.TRACKS_DATA && window.TRACKS_DATA.length) || 177;
        
        // Parse last update timestamp
        let lastUpdateTime = null;
        const timestamp = fetchInProgress ? 
            statusData.last_index_update : statusData.last_scrape_end;
        if (timestamp) {
            lastUpdateTime = new Date(timestamp);
        }
        
        // Calculate LED status - RED has HIGHEST PRIORITY
        let ledClass = 'green';
        let ledTitle = 'Ready';
        
        // RED: if unique tracks < expected tracks (HIGHEST PRIORITY - check first)
        if (uniqueTracks < expectedTracks) {
            ledClass = 'red';
            ledTitle = 'Incomplete';
        }
        // YELLOW: if last update > 24 hours ago (only if not red)
        else if (lastUpdateTime) {
            const now = new Date();
            const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
            if (hoursSinceUpdate > 24) {
                ledClass = 'yellow';
                ledTitle = 'Stale';
            }
        }
        
        // Apply LED class and title
        this.elements.led.className = `status-led ${ledClass}`;
        if (fetchInProgress) {
            this.elements.led.classList.add('fetching');
        } else {
            this.elements.led.classList.remove('fetching');
        }
        this.elements.led.title = ledTitle;
    }

    /**
     * Public method alias for backward compatibility
     */
    async fetchAndDisplay() {
        await this.fetchAndDisplayStatus();
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.statusDisplay = new StatusDisplay();
    });
} else {
    window.statusDisplay = new StatusDisplay();
}
