/**
 * Field Mappings Module
 * Centralized field name variations for consistent data access
 * 
 * NOTE: For column configuration (display names, order, visibility),
 * use ColumnConfig from column-config.js instead.
 * This module is for field value extraction from data objects.
 */

const FIELD_NAMES = {
    // Position fields
    POSITION: ['Position', 'position', 'Pos'],
    
    // Driver/Name fields
    NAME: ['Name', 'name', 'DriverName', 'driver_name'],
    
    // Country fields
    COUNTRY: ['Country', 'country'],
    
    // Car Class fields
    CAR_CLASS: ['CarClass', 'Car Class', 'car_class', 'Class', 'class', 'ClassName', 'className', 'class_name'],
    
    // Car fields
    CAR: ['Car', 'car', 'CarName', 'car_name'],
    
    // Lap Time fields
    LAP_TIME: ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time', 'time'],
    
    // Track fields
    TRACK: ['Track', 'track', 'TrackName', 'track_name'],
    
    // Difficulty fields
    DIFFICULTY: ['Difficulty', 'difficulty', 'driving_model', 'DrivingModel'],
    
    // Rank fields
    RANK: ['Rank', 'rank'],
    
    // Team fields
    TEAM: ['Team', 'team'],
    
    // ID fields
    TRACK_ID: ['track_id', 'TrackID', 'trackId', 'Track ID'],
    CLASS_ID: ['class_id', 'ClassID', 'classId', 'Class ID'],
    
    // Entry count fields
    TOTAL_ENTRIES: ['TotalEntries', 'total_entries', 'entry_count', 'EntryCount'],
    
    // Date/Time fields
    DATE_TIME: ['date_time', 'dateTime', 'Date', 'DateTime']
};

/**
 * Helper function to get first matching field value from an object
 * @param {Object} obj - Object to search
 * @param {Array<string>} fields - Array of field names to try
 * @param {*} defaultValue - Default value if no field found
 * @returns {*} First matching value or default
 */
function getField(obj, fields, defaultValue = '') {
    if (!obj) return defaultValue;
    for (const field of fields) {
        if (obj[field] !== undefined && obj[field] !== null) {
            return obj[field];
        }
    }
    return defaultValue;
}

/**
 * Check if a key matches any of the field variations
 * @param {string} key - Key to check
 * @param {Array<string>} fields - Array of field names to match against
 * @returns {boolean} True if key matches any field
 */
function isField(key, fields) {
    return fields.includes(key);
}

// Make available globally
if (typeof window !== 'undefined') {
    window.FIELD_NAMES = FIELD_NAMES;
    window.getField = getField;
    window.isField = isField;
}
