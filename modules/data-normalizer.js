/**
 * Data Normalizer Module
 * Centralized logic for extracting and normalizing data fields
 */

/**
 * Normalizes a leaderboard entry to consistent field names
 * @param {Object} entry - Raw entry data
 * @param {Object} data - Parent data object (for track/class info)
 * @param {number} index - Entry index
 * @param {number} totalEntries - Total entries count
 * @returns {Object} Normalized entry
 */
function normalizeLeaderboardEntry(entry, data = {}, index = 0, totalEntries = 0) {
    const position = Number.isFinite(entry.position) && entry.position > 0 
        ? entry.position 
        : (index + 1);
    
    // Extract car class
    let carClass = entry.car_class?.class?.Name || 
                   entry.car_class?.class?.name || 
                   entry.car_class?.Name || 
                   entry.car_class?.name || 
                   getField(entry, FIELD_NAMES.CAR_CLASS);
    
    // Extract car name
    const carName = entry.car_class?.car?.Name || 
                    entry.car_class?.car?.name || 
                    entry.vehicle?.Name || 
                    entry.vehicle?.name || 
                    entry.car?.Name || 
                    entry.car?.name || 
                    getField(entry, FIELD_NAMES.CAR);
    
    // Extract IDs
    const classId = entry.class_id || 
                    entry.ClassID || 
                    entry['Class ID'] || 
                    entry.car_class?.class?.Id || 
                    entry.car_class?.class?.ID || 
                    null;
    
    const trackIdFromEntry = entry.track_id || 
                             entry.TrackID || 
                             entry['Track ID'] || 
                             data.track_info?.Id || 
                             data.track_info?.ID || 
                             null;
    
    // Extract and normalize track name
    const rawTrackName = data.track_info?.Name || data.track_name || '';
    const trackName = normalizeTrackName(rawTrackName);
    
    return {
        Position: position,
        Name: entry.driver?.Name || entry.driver?.name || getField(entry, FIELD_NAMES.NAME, 'Unknown'),
        Country: entry.country?.Name || entry.country?.name || getField(entry, FIELD_NAMES.COUNTRY),
        CarClass: carClass,
        Car: carName,
        LapTime: getField(entry, FIELD_NAMES.LAP_TIME),
        Rank: entry.rank?.Name || entry.rank?.name || getField(entry, FIELD_NAMES.RANK),
        Team: entry.team?.Name || entry.team?.name || getField(entry, FIELD_NAMES.TEAM),
        Difficulty: getField(entry, FIELD_NAMES.DIFFICULTY),
        Track: trackName,
        TotalEntries: totalEntries || getField(entry, FIELD_NAMES.TOTAL_ENTRIES, 0),
        ClassID: classId || undefined,
        TrackID: trackIdFromEntry || undefined,
        class_id: classId || undefined,
        track_id: trackIdFromEntry || undefined,
        date_time: getField(entry, FIELD_NAMES.DATE_TIME)
    };
}

/**
 * Extracts position from various field names
 * @param {Object} item - Data item
 * @returns {string} Position value
 */
function extractPosition(item) {
    return getField(item, FIELD_NAMES.POSITION, '-');
}

/**
 * Extracts name from various field names
 * @param {Object} item - Data item
 * @returns {string} Name value
 */
function extractName(item) {
    return getField(item, FIELD_NAMES.NAME, '-');
}

/**
 * Extracts car from various field names
 * @param {Object} item - Data item
 * @returns {string} Car value
 */
function extractCar(item) {
    return getField(item, FIELD_NAMES.CAR, '-');
}

/**
 * Extracts lap time from various field names
 * @param {Object} item - Data item
 * @returns {string} Lap time value
 */
function extractLapTime(item) {
    return getField(item, FIELD_NAMES.LAP_TIME, '-');
}

/**
 * Extracts difficulty from various field names
 * @param {Object} item - Data item
 * @returns {string} Difficulty value
 */
function extractDifficulty(item) {
    return getField(item, FIELD_NAMES.DIFFICULTY, '-');
}

/**
 * Extracts country from various field names
 * @param {Object} item - Data item
 * @returns {string} Country value
 */
function extractCountry(item) {
    return getField(item, FIELD_NAMES.COUNTRY, '');
}

/**
 * Extracts track ID from various field names
 * @param {Object} item - Data item
 * @returns {string} Track ID value
 */
function extractTrackId(item) {
    return getField(item, FIELD_NAMES.TRACK_ID, '');
}

/**
 * Extracts class ID from various field names
 * @param {Object} item - Data item
 * @returns {string} Class ID value
 */
function extractClassId(item) {
    return getField(item, FIELD_NAMES.CLASS_ID, '');
}

/**
 * Extracts date/time from various field names
 * @param {Object} item - Data item
 * @returns {string} Date/time value
 */
function extractDateTime(item) {
    return getField(item, FIELD_NAMES.DATE_TIME, '');
}

/**
 * Normalizes track names to fix known inconsistencies
 * Handles Brands Hatch naming variations without breaking if source data is corrected
 * @param {string} trackName - Raw track name
 * @returns {string} Normalized track name
 */
function normalizeTrackName(trackName) {
    if (!trackName || typeof trackName !== 'string') {
        return trackName;
    }
    
    // Fix Brands Hatch naming inconsistencies
    // Handle both current incorrect format and prevent double-replacement if already correct
    if (trackName.includes('Brands Hatch')) {
        // Replace 'Brands Hatch Grand Prix - Grand Prix' with 'Brands Hatch - Grand Prix'
        // But don't break 'Brands Hatch - Grand Prix' (already correct)
        trackName = trackName.replace(/^Brands Hatch Grand Prix\s*-\s*Grand Prix$/i, 'Brands Hatch - Grand Prix');
        trackName = trackName.replace(/^Brands Hatch Grand\s+-\s+Grand Prix$/i, 'Brands Hatch - Grand Prix');
        
        // Replace 'Brands Hatch Indy - Indy' with 'Brands Hatch - Indy'
        // But don't break 'Brands Hatch - Indy' (already correct)
        trackName = trackName.replace(/^Brands Hatch Indy\s*-\s*Indy$/i, 'Brands Hatch - Indy');
    }
    
    return trackName;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.DataNormalizer = {
        normalizeLeaderboardEntry,
        extractPosition,
        extractName,
        extractCar,
        extractLapTime,
        extractDifficulty,
        extractCountry,
        extractTrackId,
        extractClassId,
        extractDateTime,
        normalizeTrackName
    };
}
