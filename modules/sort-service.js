/**
 * Table sort service
 * Encapsulates all driver-entry sort behaviors used by table rendering.
 */

class TableSortService {
    constructor(options = {}) {
        this.resolveTrackLabel = options.resolveTrackLabel || ((item) => String(item?.track || item?.Track || item?.track_name || item?.TrackName || ''));
    }

    sortDriverEntries(entries, sortBy = 'gap') {
        if (!Array.isArray(entries) || entries.length === 0) return;

        try {
            if (sortBy === 'position') {
                this._sortByPosition(entries);
            } else if (sortBy === 'date_time') {
                this._sortByDateTime(entries);
            } else if (sortBy === 'lapTime') {
                this._sortByLapTime(entries);
            } else if (sortBy === 'car_class' || sortBy === 'track') {
                this._sortByTextField(entries, sortBy);
            } else if (sortBy === 'gapPercent') {
                this._sortByGapPercent(entries);
            } else {
                this._sortByGap(entries);
            }
        } catch (e) {
            console.warn('Sort error:', e);
        }
    }

    _sortByPosition(entries) {
        entries.sort((a, b) => {
            const posA = parseInt(this.getFieldValueForSort(a, 'position') || 999999);
            const posB = parseInt(this.getFieldValueForSort(b, 'position') || 999999);
            if (posA !== posB) return posA - posB;
            return R3EUtils.getTotalEntriesCount(b) - R3EUtils.getTotalEntriesCount(a);
        });
    }

    _sortByDateTime(entries) {
        entries.sort((a, b) => {
            const dateA = this.getFieldValueForSort(a, 'date_time');
            const dateB = this.getFieldValueForSort(b, 'date_time');
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;

            const timeA = new Date(dateA).getTime();
            const timeB = new Date(dateB).getTime();
            if (isNaN(timeA) && isNaN(timeB)) return 0;
            if (isNaN(timeA)) return 1;
            if (isNaN(timeB)) return -1;
            return timeB - timeA;
        });
    }

    _sortByLapTime(entries) {
        entries.sort((a, b) => {
            const rawA = a.LapTime || a['Lap Time'] || a.lap_time || a.laptime || a.Time || '';
            const rawB = b.LapTime || b['Lap Time'] || b.lap_time || b.laptime || b.Time || '';
            const lapA = String(rawA).split(/,\s*/)[0] || '';
            const lapB = String(rawB).split(/,\s*/)[0] || '';
            const msA = R3EUtils.parseLapTimeToMillis(lapA) || Number.MAX_VALUE;
            const msB = R3EUtils.parseLapTimeToMillis(lapB) || Number.MAX_VALUE;
            if (msA !== msB) return msA - msB;
            return R3EUtils.getTotalEntriesCount(b) - R3EUtils.getTotalEntriesCount(a);
        });
    }

    _sortByTextField(entries, sortBy) {
        entries.sort((a, b) => {
            const fieldA = String(this.getFieldValueForSort(a, sortBy) || '').toLowerCase();
            const fieldB = String(this.getFieldValueForSort(b, sortBy) || '').toLowerCase();

            if (fieldA < fieldB) return -1;
            if (fieldA > fieldB) return 1;

            const ga = R3EUtils.parseGapMillisFromItem(a);
            const gb = R3EUtils.parseGapMillisFromItem(b);
            if (ga !== gb) return ga - gb;

            const posA = parseInt(this.getFieldValueForSort(a, 'position') || 999999);
            const posB = parseInt(this.getFieldValueForSort(b, 'position') || 999999);
            return posA - posB;
        });
    }

    _sortByGapPercent(entries) {
        const referenceTime = this.extractReferenceTime(entries);
        entries.sort((a, b) => {
            const percentA = this.calculateGapPercentValue(a, referenceTime);
            const percentB = this.calculateGapPercentValue(b, referenceTime);
            if (percentA !== percentB) return percentA - percentB;
            return R3EUtils.getTotalEntriesCount(b) - R3EUtils.getTotalEntriesCount(a);
        });
    }

    _sortByGap(entries) {
        entries.sort((a, b) => {
            const ga = R3EUtils.parseGapMillisFromItem(a);
            const gb = R3EUtils.parseGapMillisFromItem(b);
            if (ga !== gb) return ga - gb;
            return R3EUtils.getTotalEntriesCount(b) - R3EUtils.getTotalEntriesCount(a);
        });
    }

    getSortFieldNames(sortBy) {
        if (typeof window.FIELD_NAMES === 'undefined') return null;

        const fieldMap = {
            'car_class': window.FIELD_NAMES.CAR_CLASS,
            'track': window.FIELD_NAMES.TRACK,
            'position': window.FIELD_NAMES.POSITION,
            'date_time': window.FIELD_NAMES.DATE_TIME
        };

        return fieldMap[sortBy] || null;
    }

    getFieldValueForSort(item, sortBy) {
        if (sortBy === 'track') {
            return this.resolveTrackLabel(item);
        }

        const fieldNames = this.getSortFieldNames(sortBy);
        if (!fieldNames) return null;

        if (typeof window.getField === 'function') {
            return window.getField(item, fieldNames, '');
        }

        for (const field of fieldNames) {
            if (item[field] !== undefined && item[field] !== null) {
                return item[field];
            }
        }
        return '';
    }

    extractReferenceTime(entries) {
        if (!entries || entries.length === 0) return '';

        let minGap = Number.MAX_VALUE;
        let referenceEntry = entries[0];

        entries.forEach(entry => {
            const gap = R3EUtils.parseGapMillisFromItem(entry);
            if (gap < minGap) {
                minGap = gap;
                referenceEntry = entry;
            }
        });

        const raw = referenceEntry.LapTime || referenceEntry['Lap Time'] ||
            referenceEntry.lap_time || referenceEntry.laptime ||
            referenceEntry.Time || '';
        const s = String(raw || '');
        const parts = s.split(/,\s*/);
        return parts[0] || '';
    }

    calculateGapPercentValue(item, referenceTime) {
        if (!item) return 100;

        const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
        const s = String(raw || '');
        if (!s) return 100;

        const parts = s.split(/,\s*/);
        const lapTime = parts[0] || '';

        if (parts.length < 2) return 100;

        const lapMillis = R3EUtils.parseLapTimeToMillis(lapTime);
        if (lapMillis === 0) return 100;

        const gapMillis = R3EUtils.parseGapMillisFromItem(item);
        if (gapMillis === 0 || gapMillis === Number.MAX_VALUE) return 100;

        const refMillis = lapMillis - gapMillis;
        if (refMillis <= 0) return 100;

        return (lapMillis / refMillis) * 100;
    }
}

window.TableSortService = TableSortService;