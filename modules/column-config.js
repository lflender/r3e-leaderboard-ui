/**
 * Column Configuration Module
 * 
 * SINGLE SOURCE OF TRUTH for all table column definitions.
 * 
 * When adding a new column:
 * 1. Add it to COLUMNS object below with all properties
 * 2. That's it! The column will automatically:
 *    - Appear in the correct position
 *    - Have the correct header name
 *    - Be formatted correctly
 *    - Be excluded/included based on settings
 * 
 * Column properties:
 * - id: Unique identifier for the column
 * - aliases: All possible field names that map to this column
 * - displayName: Header text shown in table
 * - order: Sort order (lower = earlier in table)
 * - visible: Whether to show in tables (default: true)
 * - sortable: Whether column supports sorting
 * - sortKey: Key used for sorting (if different from id)
 * - format: Optional formatting function (value, item) => string
 */

const COLUMNS = {
    // ==========================================
    // VISIBLE COLUMNS (in display order)
    // ==========================================
    
    CAR_CLASS: {
        id: 'car_class',
        aliases: ['CarClass', 'Car Class', 'car_class', 'Class', 'class', 'ClassName', 'className', 'class_name'],
        displayName: 'Car class',
        order: 10,
        visible: true
    },
    
    CAR: {
        id: 'car',
        aliases: ['Car', 'car', 'CarName', 'car_name'],
        displayName: 'Car',
        order: 20,
        visible: true
    },
    
    TRACK: {
        id: 'track',
        aliases: ['Track', 'track', 'TrackName', 'track_name'],
        displayName: 'Track',
        order: 30,
        visible: true
    },
    
    POSITION: {
        id: 'position',
        aliases: ['Position', 'position', 'Pos'],
        displayName: 'Position',
        order: 40,
        visible: true,
        sortable: true,
        sortKey: 'position'
    },
    
    LAP_TIME: {
        id: 'laptime',
        aliases: ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time', 'time'],
        displayName: 'Laptime',
        order: 50,
        visible: true,
        sortable: true,
        sortKey: 'gap'
    },
    
    GAP_PERCENT: {
        id: 'GapPercent',
        aliases: ['GapPercent', 'gap_percent', 'gapPercent'],
        displayName: 'Lap %',
        order: 60,
        visible: true,
        sortable: true,
        sortKey: 'gapPercent',
        synthetic: true  // This column is calculated, not from data
    },
    
    DIFFICULTY: {
        id: 'difficulty',
        aliases: ['Difficulty', 'difficulty', 'driving_model', 'DrivingModel'],
        displayName: 'Difficulty',
        order: 70,
        visible: true
    },
    
    DATE: {
        id: 'date_time',
        aliases: ['date_time', 'dateTime', 'Date', 'DateTime'],
        displayName: 'Date',
        order: 80,
        visible: true,
        sortable: true,
        sortKey: 'date_time',
        // Format ISO date to "DD MMM YYYY"
        format: (value) => {
            if (!value) return '—';
            try {
                const date = new Date(value);
                if (isNaN(date.getTime())) return '—';
                const day = date.getDate();
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = months[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            } catch (e) {
                return '—';
            }
        }
    },
    
    // ==========================================
    // HIDDEN COLUMNS (data fields not displayed)
    // ==========================================
    
    NAME: {
        id: 'name',
        aliases: ['Name', 'name', 'DriverName', 'driver_name'],
        displayName: 'Name',
        order: 0,
        visible: false  // Shown in driver header, not as column
    },
    
    COUNTRY: {
        id: 'country',
        aliases: ['Country', 'country'],
        displayName: 'Country',
        order: 0,
        visible: false  // Shown in driver header
    },
    
    RANK: {
        id: 'rank',
        aliases: ['Rank', 'rank'],
        displayName: 'Rank',
        order: 0,
        visible: false  // Shown in driver header
    },
    
    TEAM: {
        id: 'team',
        aliases: ['Team', 'team'],
        displayName: 'Team',
        order: 0,
        visible: false  // Shown in driver header
    },
    
    // ID fields - never displayed
    TRACK_ID: {
        id: 'track_id',
        aliases: ['track_id', 'TrackID', 'trackId', 'Track ID'],
        displayName: 'Track ID',
        order: 0,
        visible: false
    },
    
    CLASS_ID: {
        id: 'class_id',
        aliases: ['class_id', 'ClassID', 'classId', 'Class ID'],
        displayName: 'Class ID',
        order: 0,
        visible: false
    },
    
    TOTAL_ENTRIES: {
        id: 'total_entries',
        aliases: ['TotalEntries', 'total_entries', 'entry_count', 'EntryCount'],
        displayName: 'Entries',
        order: 35,
        visible: false
    },
    
    TIME_DIFF: {
        id: 'time_diff',
        aliases: ['time_diff', 'timeDiff', 'timeDifference', 'time_diff_s', 'time_diff_seconds'],
        displayName: 'Time Diff',
        order: 0,
        visible: false
    },
    
    FOUND: {
        id: 'found',
        aliases: ['found', 'Found'],
        displayName: 'Found',
        order: 0,
        visible: false
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get column config by any of its aliases
 * @param {string} key - Field name to look up
 * @returns {Object|null} Column config or null if not found
 */
function getColumnByKey(key) {
    for (const col of Object.values(COLUMNS)) {
        if (col.aliases.includes(key) || col.id === key) {
            return col;
        }
    }
    return null;
}

/**
 * Get display name for a field key
 * @param {string} key - Field name
 * @returns {string} Display name for header
 */
function getDisplayName(key) {
    const col = getColumnByKey(key);
    if (col) return col.displayName;
    
    // Fallback: convert snake_case/camelCase to Title Case
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Check if a column should be visible in tables
 * @param {string} key - Field name
 * @returns {boolean} True if column should be displayed
 */
function isColumnVisible(key) {
    const col = getColumnByKey(key);
    return col ? col.visible !== false : true;
}

/**
 * Get ordered list of visible column keys from data keys
 * @param {Array<string>} dataKeys - Keys from data object
 * @param {Object} options - Options: { addSynthetic: true } to add GapPercent, Date
 * @returns {Array<string>} Ordered, filtered column keys
 */
function getOrderedColumns(dataKeys, options = {}) {
    const { addSynthetic = true } = options;
    
    // Start with data keys, add synthetic columns
    let keys = [...dataKeys];
    
    if (addSynthetic) {
        // Add Date if not present
        if (!keys.some(k => COLUMNS.DATE.aliases.includes(k))) {
            keys.push(COLUMNS.DATE.id);
        }
    }
    
    // Filter to visible columns only
    keys = keys.filter(isColumnVisible);
    
    // Sort by column order
    keys.sort((a, b) => {
        const colA = getColumnByKey(a);
        const colB = getColumnByKey(b);
        const orderA = colA ? colA.order : 999;
        const orderB = colB ? colB.order : 999;
        return orderA - orderB;
    });
    
    // Add GapPercent after LapTime if not present
    if (addSynthetic && !keys.includes('GapPercent')) {
        const lapTimeIndex = keys.findIndex(k => COLUMNS.LAP_TIME.aliases.includes(k));
        if (lapTimeIndex !== -1) {
            keys.splice(lapTimeIndex + 1, 0, 'GapPercent');
        }
    }
    
    return keys;
}

/**
 * Format a cell value using column-specific formatter if available
 * @param {string} key - Column key
 * @param {*} value - Cell value
 * @param {Object} item - Full row data (for complex formatters)
 * @returns {string} Formatted value
 */
function formatCellValue(key, value, item = {}) {
    const col = getColumnByKey(key);
    if (col && col.format) {
        return col.format(value, item);
    }
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    return String(value);
}

/**
 * Check if a key matches a specific column type
 * @param {string} key - Key to check
 * @param {string} columnId - Column ID (e.g., 'LAP_TIME', 'POSITION')
 * @returns {boolean} True if key matches that column type
 */
function isColumnType(key, columnId) {
    const col = COLUMNS[columnId];
    if (!col) return false;
    return col.aliases.includes(key) || col.id === key;
}

/**
 * Get column config for sortable columns
 * @param {string} key - Column key
 * @returns {Object|null} { sortable, sortKey } or null
 */
function getSortConfig(key) {
    const col = getColumnByKey(key);
    if (!col || !col.sortable) return null;
    return {
        sortable: true,
        sortKey: col.sortKey || col.id
    };
}

/**
 * Get all aliases for hidden columns (for filtering)
 * @returns {Array<string>} All field names that should be excluded from tables
 */
function getHiddenColumnAliases() {
    const hidden = [];
    for (const col of Object.values(COLUMNS)) {
        if (col.visible === false) {
            hidden.push(...col.aliases);
        }
    }
    return hidden;
}

// ==========================================
// EXPORTS
// ==========================================

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.ColumnConfig = {
        COLUMNS,
        getColumnByKey,
        getDisplayName,
        isColumnVisible,
        getOrderedColumns,
        formatCellValue,
        isColumnType,
        getSortConfig,
        getHiddenColumnAliases
    };
}

// ES Module export (if supported)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COLUMNS,
        getColumnByKey,
        getDisplayName,
        isColumnVisible,
        getOrderedColumns,
        formatCellValue,
        isColumnType,
        getSortConfig,
        getHiddenColumnAliases
    };
}
