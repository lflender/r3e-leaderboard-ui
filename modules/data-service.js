/**
 * Data Service Module
 * Centralized data fetching and caching logic
 * Follows Single Responsibility Principle - only handles data operations
 */

class DataService {
    constructor() {
        this.driverIndex = null;
        this.statusCache = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.STATUS_CACHE_KEY = 'r3e_status_cache';
    }
    
    /**
     * Loads driver index with caching
     * @returns {Promise<Object>} Driver index object
     */
    async loadDriverIndex() {
        if (this.driverIndex) {
            return this.driverIndex;
        }
        
        try {
            console.log('Loading driver index from cache/driver_index.json...');
            const timestamp = new Date().getTime();
            const response = await fetch(`cache/driver_index.json?v=${timestamp}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load driver index: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            this.driverIndex = JSON.parse(text);
            console.log('Driver index loaded:', Object.keys(this.driverIndex).length, 'drivers');
            return this.driverIndex;
        } catch (error) {
            console.error('Error loading driver index:', error);
            this.driverIndex = {};
            return {};
        }
    }
    
    /**
     * Waits for driver index to be loaded
     * @param {number} maxAttempts - Maximum number of attempts
     * @returns {Promise<Object>} Driver index
     */
    async waitForDriverIndex(maxAttempts = 50) {
        if (this.driverIndex !== null) {
            return this.driverIndex;
        }
        
        let attempts = 0;
        while (this.driverIndex === null && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        return this.driverIndex || {};
    }
    
    /**
     * Fetches leaderboard details from gzipped cache
     * @param {string|number} trackId - Track ID
     * @param {string|number} classId - Class ID
     * @returns {Promise<Object>} Leaderboard data
     */
    async fetchLeaderboardDetails(trackId, classId) {
        const filePath = `cache/track_${trackId}/class_${classId}.json.gz`;
        console.log('Loading leaderboard data from:', filePath);
        
        const timestamp = new Date().getTime();
        const response = await fetch(`${filePath}?v=${timestamp}`, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        // Check if DecompressionStream is available
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('DecompressionStream is not supported in this browser. Please use a modern browser.');
        }
        
        // Decompress the gzipped response
        const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
        const decompressedResponse = new Response(decompressedStream);
        const text = await decompressedResponse.text();
        
        return JSON.parse(text);
    }
    
    /**
     * Fetches top combinations data
     * @returns {Promise<Array>} Combinations array
     */
    async fetchTopCombinations() {
        const timestamp = new Date().getTime();
        const response = await fetch(`cache/top_combinations.json?v=${timestamp}`, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        let combinations = [];
        if (Array.isArray(data)) {
            combinations = data;
        } else if (data && Array.isArray(data.results)) {
            combinations = data.results;
        } else if (data && Array.isArray(data.data)) {
            combinations = data.data;
        }
        
        return combinations;
    }
    
    /**
     * Calculates status from driver index
     * @returns {Promise<Object>} Status data
     */
    async calculateStatus() {
        const driverIndex = await this.waitForDriverIndex();
        
        if (!driverIndex || Object.keys(driverIndex).length === 0) {
            return null;
        }
        
        const uniqueTracks = new Set();
        const trackClassCombinations = new Set();
        let totalEntries = 0;
        const totalDrivers = Object.keys(driverIndex).length;
        
        for (const [driverKey, entries] of Object.entries(driverIndex)) {
            entries.forEach(entry => {
                const track = entry.track || entry.Track || '';
                const trackId = entry.track_id || entry.TrackID || '';
                const classId = entry.class_id || entry.ClassID || '';
                const carClass = entry.car_class || entry.CarClass || '';
                
                if (track) uniqueTracks.add(track);
                if (trackId && classId) trackClassCombinations.add(`${trackId}-${classId}`);
                else if (track && carClass) trackClassCombinations.add(`${track}-${carClass}`);
                
                totalEntries++;
            });
        }
        
        // Try to fetch status.json to get fetch_in_progress
        let fetchInProgress = false;
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`cache/status.json?v=${timestamp}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
                const statusJson = await response.json();
                fetchInProgress = statusJson.fetch_in_progress === true;
            }
        } catch (error) {
            // If status.json doesn't exist, default to false
            console.log('status.json not available, defaulting fetch_in_progress to false');
        }
        
        return {
            unique_tracks: uniqueTracks.size,
            track_class_combination: trackClassCombinations.size,
            total_entries: totalEntries,
            total_indexed_drivers: totalDrivers,
            fetch_in_progress: fetchInProgress
        };
    }
    
    /**
     * Searches for driver in index
     * @param {string} driverName - Driver name to search
     * @param {Object} filters - Filter options (class, difficulty)
     * @returns {Promise<Array>} Search results
     */
    async searchDriver(driverName, filters = {}) {
        const driverIndex = await this.waitForDriverIndex();
        
        if (!driverIndex || Object.keys(driverIndex).length === 0) {
            throw new Error('Driver index is empty');
        }
        
        const searchTerm = driverName.trim().toLowerCase();
        const results = [];
        
        for (const [driverKey, driverEntries] of Object.entries(driverIndex)) {
            if (!driverKey.toLowerCase().includes(searchTerm)) {
                continue;
            }
            
            let filteredEntries = driverEntries;
            
            // Apply class filter
            if (filters.classId || filters.className) {
                filteredEntries = filteredEntries.filter(entry => {
                    const entryClass = entry.car_class || entry.CarClass || entry['Car Class'] || entry.Class || entry.class || '';
                    if (filters.classId) {
                        return entryClass === filters.classId;
                    }
                    if (filters.className) {
                        return entryClass === filters.className;
                    }
                    return true;
                });
            }
            
            // Apply difficulty filter
            if (filters.difficulty && filters.difficulty !== 'All difficulties') {
                filteredEntries = filteredEntries.filter(entry => {
                    const entryDifficulty = entry.difficulty || entry.Difficulty || entry.driving_model || '';
                    return entryDifficulty === filters.difficulty;
                });
            }
            
            if (filteredEntries.length > 0) {
                results.push({
                    driver: driverEntries[0].name || driverKey,
                    entries: filteredEntries
                });
            }
        }
        
        return results;
    }
    
    /**
     * Populates class filter from cars data
     * @returns {Array<{value: string, label: string}>} Class options
     */
    getClassOptionsFromCarsData() {
        if (!window.CARS_DATA || !Array.isArray(window.CARS_DATA)) {
            return [];
        }
        
        const seen = new Set();
        const options = [];
        
        window.CARS_DATA.forEach(entry => {
            const cls = entry.class || entry.car_class || entry.CarClass || '';
            if (!cls || seen.has(cls)) return;
            seen.add(cls);
            options.push({ value: cls, label: cls });
        });
        
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }
}

// Create singleton instance
const dataService = new DataService();

// Export for use in other modules
window.DataService = DataService;
window.dataService = dataService;
