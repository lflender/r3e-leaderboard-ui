/**
 * Data Service Module
 * Centralized data fetching and caching logic
 * Follows Single Responsibility Principle - only handles data operations
 */

class DataService {
    constructor() {
        this.driverIndex = null;
        // Disable status caching: status.json is precomputed and should be fetched fresh
        this.statusCache = null;
        this.CACHE_DURATION = 0;
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
     * Fetches status from server-provided cache/status.json
     * @returns {Promise<Object>} Status data
     */
    async calculateStatus() {
        // Always fetch fresh status.json without caching
        try {
            const response = await fetch(`cache/status.json?v=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (!response.ok) {
                console.error('Failed to fetch status.json:', response.status, response.statusText);
                return null;
            }

            // Use text + JSON.parse to avoid potential BOM/issues
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Invalid JSON in status.json:', e);
                return null;
            }
        } catch (error) {
            console.error('Error fetching status.json:', error);
            return null;
        }
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
        
        let searchTerm = driverName.trim();
        let isExactSearch = false;
        
        // Check if search term is wrapped in quotes for exact matching
        if ((searchTerm.startsWith('"') && searchTerm.endsWith('"')) ||
            (searchTerm.startsWith("'") && searchTerm.endsWith("'"))) {
            isExactSearch = true;
            searchTerm = searchTerm.slice(1, -1).trim(); // Remove quotes
        }
        
        const searchLower = searchTerm.toLowerCase();
        const results = [];
        
        for (const [driverKey, driverEntries] of Object.entries(driverIndex)) {
            const driverLower = driverKey.toLowerCase();
            let matches = false;
            
            if (isExactSearch) {
                // Exact word/phrase matching with word boundaries
                const words = searchLower.split(/\s+/);
                if (words.length === 1) {
                    // Single word: match as whole word using word boundary
                    const wordRegex = new RegExp(`\\b${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    matches = wordRegex.test(driverKey);
                } else {
                    // Multiple words: each word must be complete, in order, with any amount of space between
                    const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const pattern = escapedWords.map(w => `\\b${w}\\b`).join('\\s+');
                    const phraseRegex = new RegExp(pattern, 'i');
                    matches = phraseRegex.test(driverKey);
                }
            } else {
                // Partial matching (current behavior)
                matches = driverLower.includes(searchLower);
            }
            
            if (!matches) {
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
