/**
 * Table Renderer Module
 * Handles table rendering with consistent formatting
 * Uses ColumnConfig for centralized column definitions
 */

class TableRenderer {
    constructor() {
        // Use ColumnConfig for excluded columns - no more duplicate lists!
        this.excludeColumns = window.ColumnConfig ? 
            window.ColumnConfig.getHiddenColumnAliases() : 
            this._getFallbackExcludeColumns();
        this.sortService = window.TableSortService
            ? new window.TableSortService({ resolveTrackLabel: this.resolveTrackLabel.bind(this) })
            : null;
    }
    
    /**
     * Fallback exclude list if ColumnConfig not loaded
     * @private
     */
    _getFallbackExcludeColumns() {
        return [
            'ClassID', 'ClassName', 'TrackID', 'TotalEntries', 
            'Class ID', 'Class Name', 'Track ID', 'Total Entries',
            'class_id', 'class_name', 'track_id', 'total_entries',
            'path_id', 'pathId', 'pathID', 'PathID', 'Path ID',
            'Name', 'name', 'DriverName', 'driver_name',
            'Country', 'country', 'Rank', 'rank', 'Team', 'team',
            'found', 'Found',
            'time_diff', 'timeDiff', 'timeDifference', 
            'time_diff_s', 'time_diff_seconds'
        ];
    }
    
    /**
     * Renders a complete results table* grouping
     * @param {Array} driverGroups - Array of driver group objects
     * @param {Array} keys - Column keys to display
    * @param {string} sortBy - Optional sort key: 'gap' (default), 'lapTime', or 'gapPercent'
     * @returns {string} HTML string
     */
    renderDriverGroupedTable(driverGroups, keys = null, sortBy = 'gap') {
        // Get keys from first entry if not provided
        if (!keys && driverGroups.length > 0 && driverGroups[0].entries && driverGroups[0].entries.length > 0) {
            const dataKeys = Object.keys(driverGroups[0].entries[0]);
            
            // Use ColumnConfig if available, otherwise fallback to manual filtering
            if (window.ColumnConfig) {
                keys = window.ColumnConfig.getOrderedColumns(dataKeys, { addSynthetic: true });
            } else {
                // Fallback: manual filtering and sorting
                keys = this.filterAndSortKeys(dataKeys);
                if (!keys.includes('Date') && !keys.includes('date_time')) {
                    keys.push('Date');
                }
                const lapTimeIndex = keys.findIndex(k => ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time'].includes(k));
                if (lapTimeIndex !== -1 && !keys.includes('GapPercent')) {
                    keys.splice(lapTimeIndex + 1, 0, 'GapPercent');
                }
            }
        }
        
        if (!keys || keys.length === 0) {
            return '<div class="no-results">No data to display</div>';
        }
        
        let html = '<table class="results-table"><thead><tr>';
        
        // Create headers using ColumnConfig for display names and sort info
        keys.forEach(key => {
            html += this.renderHeaderCell(key, sortBy);
        });
        
        html += '</tr></thead><tbody>';
        
        // Create grouped rows* headers
        driverGroups.forEach(driverObj => {
            const driverResults = Array.isArray(driverObj.entries) ? driverObj.entries : [];
            if (driverResults.length === 0) return;
            
            const firstEntry = driverResults[0] || {};
            
            // Sort entries within group based on sortBy parameter
            this.sortDriverEntries(driverResults, sortBy);
            
            // Get reference time from the first (leader) entry for percentage calculation
            const referenceTime = this.sortService
                ? this.sortService.extractReferenceTime(driverResults)
                : '';
            
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
        const country = driverObj.country || firstEntry.country || firstEntry.Country || '-';
        const rank = driverObj.rank || firstEntry.rank || firstEntry.Rank || '';
        const team = driverObj.team || firstEntry.team || firstEntry.Team || '';
        const avatar = driverObj.avatar || firstEntry.avatar || firstEntry.Avatar || '';
        const pathId = driverObj.pathId || driverObj.path_id || firstEntry.path_id || firstEntry.pathId || firstEntry.PathID || firstEntry['Path ID'] || '';
        
        // Use a shared group ID builder so header and data rows always match.
        const slugSource = driverObj.driver || driverObj.name || firstEntry.name || firstEntry.Name || 'unknown';
        const groupId = this.buildGroupId(slugSource, country, team, pathId);
        
        const flagHtml = FlagHelper.countryToFlag(country) ? `<span class="country-flag">${FlagHelper.countryToFlag(country)}</span>` : '';
        const rankHtml = rank ? R3EUtils.renderRankStars(rank) : '';
        const avatarHtml = avatar
            ? `<img src="${R3EUtils.escapeHtml(String(avatar))}" alt="${R3EUtils.escapeHtml(`${displayName} avatar`)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="width:31px;height:31px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;position:relative;top:-2px;background:#1f232a;" />`
            : '';
        
        // Get multiplayer position if available
        const mpPos = typeof resolveMpPos === 'function' ? resolveMpPos(displayName, country) : null;
        const mpPosHtml = mpPos ? ` | Multiplayer #${mpPos}` : '';
        
        const nameClasses = typeof getMpPosNameClasses === 'function' ? getMpPosNameClasses(mpPos) : '';
        const driverNameClass = nameClasses ? ` class="${nameClasses}"` : '';
        
        // Only add "Team" prefix if the team name doesn't already contain "team"
        const teamPrefix = team && !String(team).toLowerCase().includes('team') ? 'Team ' : '';
        const teamHtml = team ? ` | 🏁 ${teamPrefix}${team}` : '';
        
        return `
            <tr class="driver-group-header" data-group="${groupId}" onclick="toggleGroup(this)">
                <td colspan="${colspan}">
                    <span class="toggle-icon">▼</span>
                    <strong${driverNameClass}>${avatarHtml}${R3EUtils.escapeHtml(displayName)}</strong>
                    <span class="driver-meta">${flagHtml}${R3EUtils.escapeHtml(country)}${rankHtml}${mpPosHtml}${teamHtml}</span>
                </td>
            </tr>`;
    }
    
    /**
     * Renders a table header cell
     * Uses ColumnConfig for display name and sortability
     * @param {string} key - Column key
     * @param {string} sortBy - Current sort key
     * @returns {string} HTML string
     */
    renderHeaderCell(key, sortBy) {
        // Get display name from ColumnConfig or fallback to formatHeader
        const displayName = window.ColumnConfig ? 
            window.ColumnConfig.getDisplayName(key) : 
            R3EUtils.formatHeader(key);
        
        // Check if this is a sortable column using ColumnConfig
        const sortConfig = window.ColumnConfig ? 
            window.ColumnConfig.getSortConfig(key) : null;
        const isLapTimeKey = window.ColumnConfig ? 
            window.ColumnConfig.isColumnType(key, 'LAP_TIME') : 
            ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time', 'time'].includes(key);
        
        if (sortConfig) {
            if (isLapTimeKey) {
                const activeClass = (sortBy === 'gap' || sortBy === 'lapTime') ? ' sort-active' : '';
                let title = 'Click to sort by gap time';
                if (sortBy === 'gap') {
                    title = 'Click to sort by lap time';
                } else if (sortBy === 'lapTime') {
                    title = 'Click to sort by gap time';
                }
                return `<th class="sortable${activeClass}" onclick="window.sortDriverGroups('lapTimeToggle')" title="${title}">${displayName}</th>`;
            }
            const sortKey = sortConfig.sortKey;
            const activeClass = sortBy === sortKey ? ' sort-active' : '';
            const title = `Click to sort by ${displayName.toLowerCase()}`;
            
            return `<th class="sortable${activeClass}" onclick="window.sortDriverGroups('${sortKey}')" title="${title}">${displayName}</th>`;
        } else {
            return `<th>${displayName}</th>`;
        }
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
        const resolvedTrackName = this.resolveTrackLabel(item);
        
        let html = `<tr class="driver-data-row ${groupId}" onclick="openDetailView(event, this)" 
                data-position="${numericPos}" 
                data-trackid="${R3EUtils.escapeHtml(String(trackId))}" 
                data-classid="${R3EUtils.escapeHtml(String(classId))}" 
            data-track="${R3EUtils.escapeHtml(resolvedTrackName)}" 
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

    renderDetailSections(resultsContainer, summaryHTML, entriesDistHTML, paginationHTML, tableWrapperHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `${summaryHTML || ''}${entriesDistHTML || ''}${paginationHTML || ''}${tableWrapperHTML || ''}${paginationHTML || ''}`;
        resultsContainer.innerHTML = tempDiv.innerHTML;
    }

    renderDetailRow(item, options = {}) {
        const isCombinedView = !!options.isCombinedView;
        const allResultsLength = Number(options.allResultsLength || 0);
        const trackParam = options.trackParam || '';
        const DataNormalizerRef = options.DataNormalizer || window.DataNormalizer;
        const utils = options.R3EUtils || window.R3EUtils;
        const renderer = options.tableRenderer || this;
        const showAbsolutePosition = !!options.showAbsolutePosition;

        const position = isCombinedView
            ? (item.Position || item.position || DataNormalizerRef.extractPosition(item))
            : DataNormalizerRef.extractPosition(item);
        const name = DataNormalizerRef.extractName(item);
        const country = DataNormalizerRef.extractCountry(item);
        const car = DataNormalizerRef.extractCar(item);
        const difficulty = DataNormalizerRef.extractDifficulty(item);
        const lapTime = DataNormalizerRef.extractLapTime(item);

        const totalEntries = isCombinedView
            ? allResultsLength
            : utils.getTotalEntriesCount(item);
        const rowTrackId = DataNormalizerRef.extractTrackId(item) || trackParam || '';
        const rowClassId = DataNormalizerRef.extractClassId(item) || '';
        const detailRowItem = {
            ...item,
            Position: position,
            position: position,
            Pos: position,
            TotalEntries: totalEntries,
            total_entries: totalEntries,
            Name: name,
            name: name,
            Country: country,
            country: country,
            Car: car,
            car: car,
            Difficulty: difficulty,
            difficulty: difficulty,
            LapTime: lapTime,
            'Lap Time': lapTime,
            lap_time: lapTime,
            filteredPosition: item.filteredPosition,
            filteredTotal: item.filteredTotal,
            absolutePosition: item.absolutePosition,
            absoluteTotal: item.absoluteTotal
        };

        if (isCombinedView) {
            detailRowItem.CarClass = item.ClassName || item.class_name || item.CarClass || item.car_class || '';
        }

        let html = `<tr data-trackid="${utils.escapeHtml(String(rowTrackId))}" data-classid="${utils.escapeHtml(String(rowClassId))}" data-name="${utils.escapeHtml(String(name))}" data-time="${utils.escapeHtml(String(lapTime))}">`;

        html += renderer.renderDetailPositionCell(detailRowItem, { showAbsolutePosition });
        html += renderer.renderDriverNameCell(detailRowItem, {
            driverLinkClass: 'detail-driver-link',
            driverLinkBase: 'drivers.html?driver='
        });
        html += renderer.renderLapTimeCell(detailRowItem.LapTime, { includeDelta: false });
        html += renderer.renderGapTimeCell(detailRowItem.LapTime);
        html += renderer.renderGapPercentCell(detailRowItem, null);

        if (isCombinedView) {
            html += renderer.renderCell(detailRowItem, 'CarClass');
        }

        html += renderer.renderCell(detailRowItem, 'Car');
        html += renderer.renderCell(detailRowItem, 'Difficulty');
        html += renderer.renderCell(detailRowItem, 'date_time');

        html += '</tr>';
        return html;
    }
    
    /**
     * Renders a table cell based on key type
     * Uses ColumnConfig for column type detection and formatting
     * @param {Object} item - Data item
     * @param {string} key - Column key
     * @returns {string} HTML string
     */
    renderCell(item, key) {
        const value = item[key];
        
        // Use ColumnConfig for type checking if available
        const CC = window.ColumnConfig;
        const isPositionKey = CC ? CC.isColumnType(key, 'POSITION') : ['Position', 'position', 'Pos'].includes(key);
        const isCarClassKey = CC ? CC.isColumnType(key, 'CAR_CLASS') : ['CarClass', 'Car Class', 'car_class', 'Class', 'class'].includes(key);
        const isCarKey = CC ? CC.isColumnType(key, 'CAR') : ['Car', 'car', 'CarName', 'car_name'].includes(key);
        const isLapTimeKey = CC ? CC.isColumnType(key, 'LAP_TIME') : ['LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time'].includes(key);
        const isTrackKey = CC ? CC.isColumnType(key, 'TRACK') : ['Track', 'track', 'TrackName', 'track_name'].includes(key);
        const isDifficultyKey = CC ? CC.isColumnType(key, 'DIFFICULTY') : ['Difficulty', 'difficulty', 'driving_model'].includes(key);
        const isDateKey = CC ? CC.isColumnType(key, 'DATE') : ['Date', 'date_time', 'dateTime'].includes(key);
        
        if (isDateKey) {
            // Try multiple field sources for date data
            const dateValue = value || item.date_time || item.dateTime || item.Date;
            // Use ColumnConfig formatter if available
            const formattedDate = CC ? CC.formatCellValue(key, dateValue, item) : 
                (dateValue ? R3EUtils.formatDate(dateValue) : '—');
            return `<td class="date-cell">${R3EUtils.escapeHtml(formattedDate)}</td>`;
        } else if (isPositionKey) {
            return this.renderPositionCell(item);
        } else if (isCarClassKey) {
            const classNameRaw = value || item.CarClass || item['Car Class'] || item.car_class || item.Class || item.class || '';
            const className = String(classNameRaw || '').trim();
            const classId = item.class_id || item.ClassID || item['Class ID'] || item.classId || '';
            const classLogoUrl = (window.R3EUtils && typeof window.R3EUtils.resolveCarClassLogo === 'function')
                ? window.R3EUtils.resolveCarClassLogo(className, classId)
                : '';
            const classLogoHtml = classLogoUrl
                ? `<img class="table-car-class-logo" src="${R3EUtils.escapeHtml(classLogoUrl)}" alt="${R3EUtils.escapeHtml(className || 'Car class')} class logo" loading="lazy" decoding="async" />`
                : '';
            const classTextHtml = className ? R3EUtils.escapeHtml(className) : '—';
            return `<td class="car-class-cell"><strong>${classLogoHtml}${classTextHtml}</strong></td>`;
        } else if (isCarKey) {
            return this.renderCarCell(value);
        } else if (isLapTimeKey) {
            return this.renderLapTimeCell(value);
        } else if (isTrackKey) {
            return this.renderTrackCell(item, value);
        } else if (isDifficultyKey) {
            return this.renderDifficultyCell(value);
        } else {
            return `<td>${R3EUtils.formatValue(value)}</td>`;
        }
    }
    
    /**
     * Renders position cell with badge
     * Note: Uses inline style for dynamic background color based on position/total ratio
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
            return `<td class="pos-cell"><span class="pos-number${podiumClass}" data-color="${badgeColor}" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span><span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(totalNum)}</span></td>`;
        } else {
            return `<td class="pos-cell"><span class="pos-number${podiumClass}" data-color="${badgeColor}" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span></td>`;
        }
    }

    renderDetailPositionCell(item, options = {}) {
        const showAbsolutePosition = !!options.showAbsolutePosition;
        const totalEntries = R3EUtils.getTotalEntriesCount(item);
        const posNum = String(item.Position || item.position || item.Pos || '').trim();
        const totalNum = totalEntries ? String(totalEntries).trim() : '';
        const badgeColor = R3EUtils.getPositionBadgeColor(parseInt(posNum), parseInt(totalNum));

        const filteredPos = item.filteredPosition ? String(item.filteredPosition).trim() : '';
        const filteredTotal = item.filteredTotal ? String(item.filteredTotal).trim() : '';
        const absolutePos = item.absolutePosition ? String(item.absolutePosition).trim() : '';
        const absoluteTotal = item.absoluteTotal ? String(item.absoluteTotal).trim() : '';

        let html = '<td class="pos-cell">';

        if (showAbsolutePosition && filteredPos && filteredTotal) {
            html += `<span class="absolute-pos-label">${R3EUtils.escapeHtml(filteredPos)}/${R3EUtils.escapeHtml(filteredTotal)}</span> `;
        }

        if (showAbsolutePosition && absolutePos && absoluteTotal) {
            const absoluteBadgeColor = R3EUtils.getPositionBadgeColor(parseInt(absolutePos), parseInt(absoluteTotal));
            const absolutePosNum = parseInt(absolutePos);
            const absoluteTotalNum = parseInt(absoluteTotal);
            const podiumClass = (absoluteTotalNum >= 4 && (absolutePosNum === 1 || absolutePosNum === 2 || absolutePosNum === 3))
                ? ` pos-${absolutePosNum}`
                : '';
            html += `<span class="pos-number${podiumClass}" data-color="${absoluteBadgeColor}" style="background:${absoluteBadgeColor}">${R3EUtils.escapeHtml(absolutePos)}</span>`;
            html += `<span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(absoluteTotal)}</span>`;
        } else {
            const pos = parseInt(posNum);
            const total = parseInt(totalNum);
            const podiumClass = (total >= 4 && (pos === 1 || pos === 2 || pos === 3)) ? ` pos-${pos}` : '';
            html += `<span class="pos-number${podiumClass}" data-color="${badgeColor}" style="background:${badgeColor}">${R3EUtils.escapeHtml(posNum)}</span>`;
            if (totalNum) {
                html += `<span class="pos-sep">/</span><span class="pos-total">${R3EUtils.escapeHtml(totalNum)}</span>`;
            }
        }

        html += '</td>';
        return html;
    }

    renderDriverNameCell(item, options = {}) {
        const name = window.DataNormalizer && typeof window.DataNormalizer.extractName === 'function'
            ? window.DataNormalizer.extractName(item)
            : (item.name || item.Name || '');
        const country = window.DataNormalizer && typeof window.DataNormalizer.extractCountry === 'function'
            ? window.DataNormalizer.extractCountry(item)
            : (item.country || item.Country || '');
        const rank = window.DataNormalizer && typeof window.DataNormalizer.extractRank === 'function'
            ? window.DataNormalizer.extractRank(item)
            : (item.rank || item.Rank || '');
        const highlisted = item.highlisted || item.Highlisted || false;
        const flag = FlagHelper.countryToFlag(country);
        const flagHtml = flag ? `<span class="country-flag">${flag}</span>` : '';
        const rankStarsHtml = rank ? R3EUtils.renderRankStars(rank, true) : '';
        const mpPos = typeof resolveMpPos === 'function' ? resolveMpPos(name, country) : null;
        const mpPosHtml = mpPos ? ` <span class="mp-pos-badge">#${mpPos}</span>` : '';
        const driverLinkClass = options.driverLinkClass || 'detail-driver-link';
        const encodedDriver = encodeURIComponent(`"${String(name)}"`);
        const driverHref = `${options.driverLinkBase || 'drivers.html?driver='}${encodedDriver}`;

        if (!highlisted) {
            let linkClasses = driverLinkClass;
            if (typeof getMpPosNameClasses === 'function') {
                const nameClasses = getMpPosNameClasses(mpPos);
                if (nameClasses) {
                    linkClasses += ` ${nameClasses}`;
                }
            }
            return `<td><a class="${linkClasses}" href="${driverHref}">${flagHtml}${R3EUtils.escapeHtml(String(name))}${rankStarsHtml}${mpPosHtml}</a></td>`;
        }

        const highlightThresholds = options.highlightedMpPosThresholds || { gold: 10, silver: 100, glitter: 10 };
        const highlightedClasses = typeof getMpPosNameClasses === 'function'
            ? getMpPosNameClasses(mpPos, highlightThresholds)
            : '';
        const classAttr = highlightedClasses ? ` class="${highlightedClasses}"` : '';
        return `<td><span${classAttr}>${flagHtml}${R3EUtils.escapeHtml(String(name))}${rankStarsHtml}${mpPosHtml}</span></td>`;
    }
    
    /**
     * Renders lap time cell with delta
     * @param {string} value - Lap time value
     * @returns {string} HTML string
     */
    renderLapTimeCell(value, options = {}) {
        const includeDelta = options.includeDelta !== false;
        const parts = this.extractLapAndGapParts(value);
        const mainClassic = parts.main;
        const deltaClassic = parts.gap;
        const escMain = R3EUtils.escapeHtml(String(mainClassic));
        const escDelta = R3EUtils.escapeHtml(String(deltaClassic));

        if (includeDelta && escDelta) {
            return `<td class="lap-time-cell"><span class="lap-main">${escMain}</span><span class="time-delta">${escDelta}</span></td>`;
        } else {
            return `<td class="lap-time-cell"><span class="lap-main">${escMain}</span></td>`;
        }
    }

    renderGapTimeCell(value) {
        const parts = this.extractLapAndGapParts(value);
        const deltaClassic = parts.gap;
        const escDelta = R3EUtils.escapeHtml(String(deltaClassic));
        if (!escDelta) {
            return '<td class="gap-time-cell"></td>';
        }
        return `<td class="gap-time-cell"><span class="time-delta">${escDelta}</span></td>`;
    }

    extractLapAndGapParts(value) {
        const s = String(value || '');
        const parts = s.split(/,\s*/);
        const mainRaw = parts[0] || '';
        const gapRaw = parts.slice(1).join(' ');

        return {
            main: R3EUtils.formatClassicLapTime(mainRaw),
            gap: gapRaw ? R3EUtils.formatClassicLapTime(gapRaw) : ''
        };
    }
    
    /**
     * Renders track cell with word break and styled layout part
     * @param {string} value - Track name
     * @returns {string} HTML string
     */
    renderTrackCell(item, value) {
        return TableRenderer.renderTrackCellStatic(this.resolveTrackLabel(item, value));
    }

    resolveTrackLabel(item, fallback = '') {
        if (window.R3EUtils && typeof window.R3EUtils.resolveTrackLabelForItem === 'function') {
            return window.R3EUtils.resolveTrackLabelForItem(item, fallback);
        }

        return String(fallback || item?.track || item?.Track || item?.track_name || item?.TrackName || '');
    }
    
    /**
     * Renders car cell with brand in normal styling and model in secondary styling
     * @param {string} value - Car name
     * @returns {string} HTML string
     */
    renderCarCell(value) {
        if (!value) return '<td>-</td>';
        
        const { brand, model } = R3EUtils.splitCarName(value);
        const escBrand = R3EUtils.escapeHtml(brand);
        const escModel = R3EUtils.escapeHtml(model);
        const brandLogoUrl = (window.R3EUtils && typeof window.R3EUtils.resolveBrandLogoPath === 'function')
            ? window.R3EUtils.resolveBrandLogoPath(value)
            : '';
        const brandLogoClass = brandLogoUrl.includes('logo-raceroom.png')
            ? 'table-brand-logo table-brand-logo-raceroom'
            : 'table-brand-logo';
        const brandLogoHtml = brandLogoUrl
            ? `<span class="table-brand-logo-slot"><img class="${brandLogoClass}" src="${R3EUtils.escapeHtml(brandLogoUrl)}" alt="${escBrand || 'Car brand'} logo" loading="lazy" decoding="async" onload='const renderedWidth = this.getBoundingClientRect().width || this.width || 22; const slotWidth = (this.parentElement && this.parentElement.getBoundingClientRect().width) || 22; const offsetX = (slotWidth - renderedWidth) / 2; this.style.marginLeft = offsetX + "px";' onerror='if (this.parentElement) { this.parentElement.remove(); } else { this.remove(); }' /></span>`
            : '';
        
        if (model) {
            return `<td class="car-cell"><span class="car-cell-stack">${brandLogoHtml}<span class="car-text-stack"><span class="car-brand">${escBrand}</span><span class="car-model-line"><span class="car-model">${escModel}</span></span></span></span></td>`;
        } else {
            return `<td class="car-cell"><span class="car-cell-stack">${brandLogoHtml}<span class="car-text-stack"><span class="car-brand">${escBrand}</span></span></span></td>`;
        }
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
        // Use ColumnConfig if available (preferred)
        if (window.ColumnConfig) {
            return window.ColumnConfig.getOrderedColumns(keys, { addSynthetic: false });
        }
        
        // Fallback: manual filtering
        keys = keys.filter(key => !this.excludeColumns.includes(key));
        
        // Fallback column order (deprecated - use ColumnConfig instead)
        const fallbackOrder = [
            'CarClass', 'Car Class', 'car_class', 'Class',
            'Car', 'car', 'CarName',
            'Track', 'track', 'TrackName', 'track_name',
            'Position', 'position', 'Pos',
            'LapTime', 'Lap Time', 'lap_time', 'laptime', 'Time',
            'GapPercent',
            'Difficulty', 'difficulty',
            'Date', 'date_time', 'dateTime'
        ];
        
        keys.sort((a, b) => {
            let indexA = fallbackOrder.indexOf(a);
            let indexB = fallbackOrder.indexOf(b);
            
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            
            return indexA - indexB;
        });
        
        return keys;
    }
    
    /**
     * Sorts driver entries by gap time, lap time, gap percentage, car class, track, position, or date
     * @param {Array} entries - Driver entries
     * @param {string} sortBy - Sort key: 'gap' (default), 'lapTime', 'gapPercent', 'car_class', 'track', 'position', or 'date_time'
     */
    sortDriverEntries(entries, sortBy = 'gap') {
        if (!this.sortService) return;
        this.sortService.sortDriverEntries(entries, sortBy);
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
        const country = item.country || item.Country || '';
        const team = item.team || item.Team || '';
        const pathId = item.path_id || item.pathId || item.pathID || item.PathID || item['Path ID'] || '';
        return this.buildGroupId(slugSource, country, team, pathId);
    }

    /**
     * Build a stable group ID for a driver row/header pair.
     * Includes country/team to distinguish duplicate names.
     * @param {string} name - Driver name
     * @param {string} country - Driver country
     * @param {string} team - Driver team
     * @param {string} pathId - Driver path ID
     * @returns {string} Group ID
     */
    buildGroupId(name, country = '', team = '', pathId = '') {
        const base = String(name || 'unknown')
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9\-]/g, '')
            .toLowerCase();
        const countrySlug = country && country !== '-'
            ? `-${String(country).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase()}`
            : '';
        const teamSlug = team && team !== '-'
            ? `-${String(team).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase()}`
            : '';
        const pathIdSlug = pathId
            ? `-${String(pathId).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase()}`
            : '';
        return `group-${base}${countrySlug}${teamSlug}${pathIdSlug}`;
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
