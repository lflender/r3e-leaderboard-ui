/**
 * Field Mappings Module
 * Centralized field name variations for consistent data access
 * 
 * Alias arrays are derived from ColumnConfig (the single source of truth).
 * ColumnConfig is loaded before this module via <script defer> order.
 */

const FIELD_NAMES = (() => {
    const CC = typeof window !== 'undefined' && window.ColumnConfig;
    const col = (key) => CC ? CC.getColumnByKey(key)?.aliases || [key] : [key];

    return {
        POSITION:      col('position'),
        NAME:          col('name'),
        COUNTRY:       col('country'),
        CAR_CLASS:     col('car_class'),
        CAR:           col('car'),
        LAP_TIME:      col('laptime'),
        TRACK:         col('track'),
        DIFFICULTY:    col('difficulty'),
        RANK:          col('rank'),
        TEAM:          col('team'),
        TRACK_ID:      col('track_id'),
        CLASS_ID:      col('class_id'),
        TOTAL_ENTRIES: col('total_entries'),
        DATE_TIME:     col('date_time')
    };
})();

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

// Make available globally
if (typeof window !== 'undefined') {
    window.FIELD_NAMES = FIELD_NAMES;
    window.getField = getField;
}
