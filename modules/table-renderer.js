/**
 * Table Renderer Module
 * Handles table rendering with consistent formatting
 * Follows Single Responsibility Principle
 */

class TableRenderer {
    constructor() {
        this.excludeColumns = [
            'ClassID', 'ClassName', 'TrackID', 'TotalEntries', 
            'Class ID', 'Class Name', 'Track ID', 'Total Entries',
            'class_id', 'class_name', 'track_id', 'total_entries',
            'Name', 'name', 'DriverName', 'driver_name',
            'Country', 'country', 'Rank', 'rank', 'Team', 'team',
            'found', 'Found',
            'time_diff', 'timeDiff', 'timeDifference', 
            'time_diff_s', 'time_diff_seconds'
        ];
        
        this.columnOrder = [
            'CarClass', 'Car Class', 'car_class', 'Class',
            'Car', 'car', 'CarName',
            'Track', 'track', 'TrackName', 'track_name',
            'LapTime', 'Lap Time', 'lap_time', 'Time',
            'Position', 'position', 'Pos'
        ];
    }
    
    /**
     * Renders a complete results table with driver grouping
     * @param {Array} driverGroups - Array of driver group objects
     * @param {Array} keys - Column keys to display
     * @param {string} sortBy - Optional sort key: 'gap' (default) or 'gapPercent'
     * @returns {string} HTML string
     */
    renderDriverGroupedTable(driverGroups, keys = null, sortBy = 'gap') {
        if (!keys && driverGroups.length > 0 && driverGroups[0].entries && driverGroups[0].entries.length > 0) {
            keys = Object.keys(driverGroups[0].entries[0]);
            keys = this.filterAndSortKeys(keys);
        }
        
        if (!keys || keys.length === 0) {
            return '<div class="no-results">No data to display</div>';
        }
        
        // Add GapPercent column after LapTime if not already present
        const lapTimeIndex = keys.findIndex(k => ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time'].includes(k));
        if (lapTimeIndex !== -1 && !keys.includes('GapPercent')) {
            keys.splice(lapTimeIndex + 1, 0, 'GapPercent');
        }
        
        let html = '<table class="results-table"><thead><tr>';
        
        // Create headers with sorting capability
        keys.forEach(key => {
            const isLapTimeKey = ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time'].includes(key);
            const isGapPercentKey = key === 'GapPercent';
            const isPositionKey = ['Position', 'position', 'Pos'].includes(key);
            
            if (isPositionKey) {
                const activeClass = sortBy === 'position' ? ' sort-active' : '';
                html += `<th class="sortable${activeClass}" onclick="window.sortDriverGroups('position')" title="Click to sort by position">${R3EUtils.formatHeader(key)}</th>`;
            } else if (isLapTimeKey) {
                const activeClass = sortBy === 'gap' ? ' sort-active' : '';
                html += `<th class="sortable${activeClass}" onclick="window.sortDriverGroups('gap')" title="Click to sort by gap time">${R3EUtils.formatHeader(key)}</th>`;
            } else if (isGapPercentKey) {
                const activeClass = sortBy === 'gapPercent' ? ' sort-active' : '';
                html += `<th class="sortable${activeClass}" onclick="window.sortDriverGroups('gapPercent')" title="Click to sort by gap percentage">Gap %</th>`;
            } else {
                html += `<th>${R3EUtils.formatHeader(key)}</th>`;
            }
        });
        
        html += '</tr></thead><tbody>';
        
        // Create grouped rows with driver headers
        driverGroups.forEach(driverObj => {
            const driverResults = Array.isArray(driverObj.entries) ? driverObj.entries : [];
            if (driverResults.length === 0) return;
            
            const firstEntry = driverResults[0] || {};
            
            // Sort entries within group based on sortBy parameter
            this.sortDriverEntries(driverResults, sortBy);
            
            // Get reference time from the first (leader) entry for percentage calculation
            const referenceTime = this.extractReferenceTime(driverResults);
            
            // Render driver header
            html += this.renderDriverHeader(driverObj, firstEntry, keys.length);
            
            // Render data rows for this driver
            driverResults.forEach(item => {
                html += this.renderDataRow(item, keys, firstEntry, referenceTime);
            });
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    /**
     * Renders a simple table without grouping
     * @param {Array} items - Array of data items
     * @param {Array} headers - Header labels
     * @returns {string} HTML string
     */
    renderSimpleTable(items, headers) {
        if (!items || items.length === 0) {
            return '<div class="no-results">No results found</div>';
        }
        
        let html = '<table class="results-table"><thead><tr>';
        
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        items.forEach(item => {
            html += this.renderSimpleRow(item, headers);
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    /**
     * Renders a driver group header row
     * @param {Object} driverObj - Driver object
     * @param {Object} firstEntry - First entry for driver
     * @param {number} colspan - Column span
     * @returns {string} HTML string
     */
    renderDriverHeader(driverObj, firstEntry, colspan) {
        const displayName = firstEntry.name || firstEntry.Name || driverObj.driver || driverObj.name || driverObj.DriverName || 'Unknown';
        const country = firstEntry.country || firstEntry.Country || '-';
        const rank = firstEntry.rank || firstEntry.Rank || '';
        const team = firstEntry.team || firstEntry.Team || '';
        
        const slugSource = driverObj.driver || driverObj.name || firstEntry.name || firstEntry.Name || 'unknown';
        const groupId = `group-${String(slugSource).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase()}`;
        
        const flagHtml = FlagHelper.countryToFlag(country) ? `<span class="country-flag">${FlagHelper.countryToFlag(country)}</span> ` : '';
        const rankHtml = rank ? R3EUtils.renderRankStars(rank) : '';
        const teamHtml = team ? ` | 🏁 Team ${team}` : '';
        
        return `
            <tr class="driver-group-header" data-group="${groupId}" onclick="toggleGroup(this)">
                <td colspan="${colspan}">
                    <span class="toggle-icon">▼</span>
                    <strong>${R3EUtils.escapeHtml(displayName)}</strong>
                    <span class="driver-meta">${flagHtml}${R3EUtils.escapeHtml(country)}${rankHtml}${teamHtml}</span>
                </td>
            </tr>`;
    }
    
    /**
     * Renders a data row
     * @param {Object} item - Data item
     * @param {Array} keys - Column keys
     * @param {Object} firstEntry - First entry for group (for class info)
     * @param {string} referenceTime - Reference lap time for percentage calculation
     * @returns {string} HTML string
     */
    renderDataRow(item, keys, firstEntry, referenceTime = null) {
        const trackId = item.track_id || item.TrackID || item['Track ID'] || '';
        const classId = item.class_id || item.ClassID || item['Class ID'] || '';
        const rawPos = item.position || item.Position || item.Pos || '';
        const numericPos = parseInt(String(rawPos).replace(/[^0-9]/g, '')) || '';
        
        const groupId = this.getGroupIdForItem(firstEntry);
        
        const driverName = firstEntry.name || firstEntry.Name || '';
        const rawLapTime = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
        
        let html = `<tr class="driver-data-row ${groupId}" onclick="openDetailView(event, this)" 
                data-position="${numericPos}" 
                data-trackid="${R3EUtils.escapeHtml(String(trackId))}" 
                data-classid="${R3EUtils.escapeHtml(String(classId))}" 
                data-track="${R3EUtils.escapeHtml(item.track || item.Track || '')}" 
                data-class="${R3EUtils.escapeHtml(firstEntry.car_class || firstEntry.CarClass || firstEntry['Car Class'] || firstEntry.Class || '')}"
                data-name="${R3EUtils.escapeHtml(String(driverName))}"
                data-time="${R3EUtils.escapeHtml(String(rawLapTime))}">`;
        
        keys.forEach(key => {
            if (key === 'GapPercent') {
                html += this.renderGapPercentCell(item, referenceTime);
            } else {
                html += this.renderCell(item, key);
            }
        });
        
        html += '</tr>';
        return html;
    }
    
    /**
     * Renders a simple row (without grouping)
     * @param {Object} item - Data item
     * @param {Array} headers - Header labels
     * @returns {string} HTML string
     */
    renderSimpleRow(item, headers) {
        const trackId = item.track_id || item.TrackID || item.trackId || '';
        const classId = item.class_id || item.ClassID || item.classId || '';
        const pos = item.position || item.Position || item.Pos || '';
        
        let html = `<tr data-trackid="${R3EUtils.escapeHtml(String(trackId))}" 
                       data-classid="${R3EUtils.escapeHtml(String(classId))}" 
                       data-position="${R3EUtils.escapeHtml(String(pos))}">`;
        
        headers.forEach(header => {
            const key = this.headerToKey(header);
            html += this.renderCell(item, key);
        });
        
        html += '</tr>';
        return html;
    }
    
    /**
     * Renders a table cell based on key type
     * @param {Object} item - Data item
     * @param {string} key - Column key
     * @returns {string} HTML string
     */
    renderCell(item, key) {
        const value = item[key];
        const isPositionKey = ['Position', 'position', 'Pos'].includes(key);
        const isCarClassKey = ['CarClass', 'Car Class', 'car_class', 'Class', 'class'].includes(key);
        const isLapTimeKey = ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time'].includes(key);
        const isTrackKey = ['Track', 'track', 'TrackName', 'track_name'].includes(key);
        const isDifficultyKey = ['Difficulty', 'difficulty', 'driving_model'].includes(key);
        
        if (isPositionKey) {
            return this.renderPositionCell(item);
        } else if (isCarClassKey) {
            return `<td class="no-wrap"><strong>${R3EUtils.formatValue(value)}</strong></td>`;
        } else if (isLapTimeKey) {
            return this.renderLapTimeCell(value);
        } else if (isTrackKey) {
            return this.renderTrackCell(value);
        } else if (isDifficultyKey) {
            return this.renderDifficultyCell(value);
        } else {
            return `<td>${R3EUtils.formatValue(value)}</td>`;
        }
    }
    
    /**
     * Renders position cell with badge
     * @param {Object} item - Data item
     * @returns {string} HTML string
     */
    renderPositionCell(item) {
        const totalEntries = R3EUtils.getTotalEntriesCount(item);
        const posNum = String(item.Position || item.position || item.Pos || '').trim();
        const totalNum = totalEntries ? String(totalEntries).trim() : '';
        const pos = parseInt(posNum);
        const total = parseInt(totalNum);
        
        const badgeColor = R3EUtils.getPositionBadgeColor(pos, total);
        const podiumClass = (total >= 4 && (pos === 1 || pos === 2 || pos === 3)) ? ` pos-${pos}` : '';
        
        if (totalNum) {
            return `<td class="pos-cell"><span class="pos-number${podiumClass}" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span><span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(totalNum)}</span></td>`;
        } else {
            return `<td class="pos-cell"><span class="pos-number${podiumClass}" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span></td>`;
        }
    }
    
    /**
     * Renders lap time cell with delta
     * @param {string} value - Lap time value
     * @returns {string} HTML string
     */
    renderLapTimeCell(value) {
        const s = String(value || '');
        const parts = s.split(/,\s*/);
        const mainClassic = R3EUtils.formatClassicLapTime(parts[0] || '');
        const deltaRaw = parts.slice(1).join(' ');
        const deltaClassic = deltaRaw ? R3EUtils.formatClassicLapTime(deltaRaw) : '';
        const escMain = R3EUtils.escapeHtml(String(mainClassic));
        const escDelta = R3EUtils.escapeHtml(String(deltaClassic));
        
        if (escDelta) {
            return `<td class="lap-time-cell">${escMain} <span class="time-delta-inline">${escDelta}</span></td>`;
        } else {
            return `<td class="lap-time-cell">${escMain}</td>`;
        }
    }
    
    /**
     * Renders track cell with word break and styled layout part
     * @param {string} value - Track name
     * @returns {string} HTML string
     */
    renderTrackCell(value) {
        return TableRenderer.renderTrackCellStatic(value);
    }
    
    /**
     * Static method to render track cell (can be used outside of class instances)
     * @param {string} value - Track name
     * @param {string} tdClass - Optional CSS class for td element
     * @returns {string} HTML string
     */
    static renderTrackCellStatic(value, tdClass = '') {
        let trackStr = String(value || '');
        const classAttr = tdClass ? ` class="${tdClass}"` : '';
        
        // Normalize track name to fix known inconsistencies
        if (window.DataNormalizer && window.DataNormalizer.normalizeTrackName) {
            trackStr = window.DataNormalizer.normalizeTrackName(trackStr);
        }
        
        // Split track name and layout (e.g., "Donington Park - Grand Prix")
        const parts = trackStr.split(/\s*[-–—]\s+/);
        if (parts.length >= 2) {
            const trackName = R3EUtils.escapeHtml(parts[0]);
            const layoutName = R3EUtils.escapeHtml(parts.slice(1).join(' - '));
            return `<td${classAttr}>${trackName} <span class="track-layout">${layoutName}</span></td>`;
        } else {
            // No layout part, just return track name with word break
            trackStr = trackStr.replace(/(\s+)([-–—])(\s+)/g, '$1<wbr>$2$3');
            trackStr = R3EUtils.escapeHtml(trackStr).replace(/&lt;wbr&gt;/g, '<wbr>');
            return `<td${classAttr}>${trackStr}</td>`;
        }
    }
    
    /**
     * Renders difficulty cell with pill styling
     * @param {string} value - Difficulty value
     * @returns {string} HTML string
     */
    renderDifficultyCell(value) {
        const diffStr = String(value || '').trim().toLowerCase();
        let diffClass = '';
        
        if (diffStr === 'get real') diffClass = 'difficulty-get-real';
        else if (diffStr === 'amateur') diffClass = 'difficulty-amateur';
        else if (diffStr === 'novice') diffClass = 'difficulty-novice';
        
        const titleMap = {
            'get real': 'Highest realism (gold)',
            'amateur': 'Intermediate realism (silver)',
            'novice': 'Lowest realism (bronze)'
        };
        const titleText = titleMap[diffStr] || 'Difficulty';
        const escVal = R3EUtils.escapeHtml(String(value || ''));
        
        return `<td class="difficulty-cell"><span class="difficulty-pill ${diffClass}" title="${titleText}" aria-label="${titleText}">${escVal}</span></td>`;
    }
    
    /**
     * Filters and sorts column keys
     * @param {Array} keys - Column keys
     * @returns {Array} Filtered and sorted keys
     */
    filterAndSortKeys(keys) {
        // Filter out unwanted columns
        keys = keys.filter(key => !this.excludeColumns.includes(key));
        
        // Sort by custom order
        keys.sort((a, b) => {
            let indexA = this.columnOrder.indexOf(a);
            let indexB = this.columnOrder.indexOf(b);
            
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            
            return indexA - indexB;
        });
        
        return keys;
    }
    
    /**
     * Sorts driver entries by gap time, gap percentage, or position
     * @param {Array} entries - Driver entries
     * @param {string} sortBy - Sort key: 'gap' (default), 'gapPercent', or 'position'
     */
    sortDriverEntries(entries, sortBy = 'gap') {
        try {
            if (sortBy === 'position') {
                // Sort by position
                entries.sort((a, b) => {
                    const posA = parseInt(a.Position || a.position || a.Pos || 999999);
                    const posB = parseInt(b.Position || b.position || b.Pos || 999999);
                    if (posA !== posB) return posA - posB;
                    const ta = R3EUtils.getTotalEntriesCount(a);
                    const tb = R3EUtils.getTotalEntriesCount(b);
                    return tb - ta; // descending
                });
            } else if (sortBy === 'gapPercent') {
                // Sort by gap percentage
                const referenceTime = this.extractReferenceTime(entries);
                entries.sort((a, b) => {
                    const percentA = this.calculateGapPercentValue(a, referenceTime);
                    const percentB = this.calculateGapPercentValue(b, referenceTime);
                    if (percentA !== percentB) return percentA - percentB;
                    const ta = R3EUtils.getTotalEntriesCount(a);
                    const tb = R3EUtils.getTotalEntriesCount(b);
                    return tb - ta; // descending
                });
            } else {
                // Sort by gap time (default)
                entries.sort((a, b) => {
                    const ga = R3EUtils.parseGapMillisFromItem(a);
                    const gb = R3EUtils.parseGapMillisFromItem(b);
                    if (ga !== gb) return ga - gb;
                    const ta = R3EUtils.getTotalEntriesCount(a);
                    const tb = R3EUtils.getTotalEntriesCount(b);
                    return tb - ta; // descending
                });
            }
        } catch (e) {
            // If parsing fails, keep original order
        }
    }
    
    /**
     * Extracts the reference time (fastest lap) from driver entries
     * @param {Array} entries - Driver entries
     * @returns {string} Reference lap time
     */
    extractReferenceTime(entries) {
        if (!entries || entries.length === 0) return '';
        
        // Find the entry with the smallest gap (should be first, but let's be safe)
        let minGap = Number.MAX_VALUE;
        let referenceEntry = entries[0];
        
        entries.forEach(entry => {
            const gap = R3EUtils.parseGapMillisFromItem(entry);
            if (gap < minGap) {
                minGap = gap;
                referenceEntry = entry;
            }
        });
        
        // Extract the lap time (first part before comma)
        const raw = referenceEntry.LapTime || referenceEntry['Lap Time'] || 
                   referenceEntry.lap_time || referenceEntry.laptime || 
                   referenceEntry.Time || '';
        const s = String(raw || '');
        const parts = s.split(/,\s*/);
        return parts[0] || '';
    }
    
    /**
     * Calculates gap percentage as a numeric value for sorting
     * @param {Object} item - Data item
     * @param {string} referenceTime - Not used, kept for API compatibility
     * @returns {number} Percentage value (e.g., 100.5)
     */
    calculateGapPercentValue(item, referenceTime) {
        if (!item) return 100;
        
        const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
        const s = String(raw || '');
        if (!s) return 100;
        
        const parts = s.split(/,\s*/);
        const lapTime = parts[0] || '';
        
        // If this is the reference (no gap), return 100
        if (parts.length < 2) return 100;
        
        const lapMillis = R3EUtils.parseLapTimeToMillis(lapTime);
        if (lapMillis === 0) return 100;
        
        const gapMillis = R3EUtils.parseGapMillisFromItem(item);
        if (gapMillis === 0 || gapMillis === Number.MAX_VALUE) return 100;
        
        // Calculate reference time: reference = lapTime - gap
        const refMillis = lapMillis - gapMillis;
        if (refMillis <= 0) return 100;
        
        return (lapMillis / refMillis) * 100;
    }
    
    /**
     * Renders gap percentage cell
     * @param {Object} item - Data item
     * @param {string} referenceTime - Reference lap time
     * @returns {string} HTML string
     */
    renderGapPercentCell(item, referenceTime) {
        const percentage = R3EUtils.calculateGapPercentage(item, referenceTime);
        return `<td class="gap-percent-cell">${R3EUtils.escapeHtml(percentage)}</td>`;
    }
    
    /**
     * Gets group ID for an item
     * @param {Object} item - Data item
     * @returns {string} Group ID
     */
    getGroupIdForItem(item) {
        const slugSource = item.name || item.Name || item.driver || 'unknown';
        return `group-${String(slugSource).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase()}`;
    }
    
    /**
     * Converts header label to key
     * @param {string} header - Header label
     * @returns {string} Key
     */
    headerToKey(header) {
        // Simple conversion - could be enhanced
        return header.replace(/ /g, '');
    }
}

// Create singleton instance
const tableRenderer = new TableRenderer();

// Export for use in other modules
window.TableRenderer = TableRenderer;
window.tableRenderer = tableRenderer;
