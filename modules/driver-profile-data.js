/**
 * Driver Profile Data Module
 * Aggregates driver entry data into distributions for charts
 * Single source of truth for driver profile data transformations
 */
(function () {
    'use strict';

    /** Minimum total_entries required for a pole position to count */
    const MIN_ENTRIES_FOR_POLE = 2;
    /** Minimum total_entries required for a podium to count */
    const MIN_ENTRIES_FOR_PODIUM = 4;

    /**
     * Count occurrences of a field across entries
     * @param {Array} entries - Driver leaderboard entries
     * @param {string[]} fieldAliases - Possible field name aliases
     * @returns {Array<{label: string, value: number}>} Sorted label/value pairs
     */
    function countByField(entries, fieldAliases) {
        const counts = new Map();

        entries.forEach(entry => {
            let fieldValue = '';
            for (const alias of fieldAliases) {
                if (entry[alias] !== undefined && entry[alias] !== null && entry[alias] !== '') {
                    fieldValue = String(entry[alias]).trim();
                    break;
                }
            }
            if (!fieldValue) return;

            counts.set(fieldValue, (counts.get(fieldValue) || 0) + 1);
        });

        return Array.from(counts.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
    }

    /**
     * Build car class distribution from driver entries
     * @param {Array} entries - Driver leaderboard entries
     * @returns {Array<{label: string, value: number}>}
     */
    function getCarClassDistribution(entries) {
        return countByField(entries, [
            'car_class', 'CarClass', 'Car Class', 'Class', 'class'
        ]);
    }

    /**
     * Build car (vehicle) distribution from driver entries
     * @param {Array} entries - Driver leaderboard entries
     * @returns {Array<{label: string, value: number}>}
     */
    function getCarDistribution(entries) {
        return countByField(entries, [
            'Car', 'car', 'CarName', 'car_name', 'vehicle'
        ]);
    }

    /**
     * Build track distribution from driver entries, resolving track IDs to labels
     * @param {Array} entries - Driver leaderboard entries
     * @returns {Array<{label: string, value: number}>}
     */
    function getTrackDistribution(entries) {
        const counts = new Map();

        entries.forEach(entry => {
            const trackId = entry.track_id || entry.TrackID || entry.trackId || entry['Track ID'] || '';
            const trackName = entry.Track || entry.track || entry.TrackName || entry.track_name || '';

            let label = '';
            if (trackId && window.R3EUtils && typeof window.R3EUtils.resolveTrackLabel === 'function') {
                label = window.R3EUtils.resolveTrackLabel(trackId, trackName);
            } else {
                label = trackName || String(trackId);
            }

            if (!label) return;

            counts.set(label, (counts.get(label) || 0) + 1);
        });

        return Array.from(counts.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
    }

    /**
     * Build a complete profile summary from a driver result group
     * @param {Object} driverGroup - Driver group from search results
     *   { driver, country, team, rank, avatar, pathId, entries }
     * @returns {Object} Profile data with identity + distributions
     */
    function buildProfileData(driverGroup) {
        const entries = Array.isArray(driverGroup.entries) ? driverGroup.entries : [];
        return {
            name: driverGroup.driver || '',
            country: driverGroup.country || '',
            team: driverGroup.team || '',
            rank: driverGroup.rank || '',
            avatar: driverGroup.avatar || '',
            pathId: driverGroup.pathId || '',
            totalEntries: entries.length,
            carClassDistribution: getCarClassDistribution(entries),
            carDistribution: getCarDistribution(entries),
            trackDistribution: getTrackDistribution(entries)
        };
    }

    /**
     * Build the RaceRoom official profile URL
     * @param {string} pathId - Driver path ID (from metadata)
     * @returns {string} Profile URL
     */
    function getRaceRoomProfileUrl(pathId) {
        if (!pathId) return '';
        return `https://game.raceroom.com/users/${encodeURIComponent(pathId)}`;
    }

    /**
     * Compute per-class stat breakdowns directly from entries.
     * Each entry has position and total_entries, so:
     *   bested = total_entries - position
     *   pole = position === 1 (requires total_entries >= MIN_ENTRIES_FOR_POLE)
     *   podium = position <= 3 (requires total_entries >= MIN_ENTRIES_FOR_PODIUM)
     *   avg_bested = mean of (bested / (total_entries - 1) * 100)
     * @param {Array} entries - Driver leaderboard entries
     * @returns {Object} { bested: [{className, value}], pole: [...], podium: [...], avg_bested: [{className, value, entryCount}] }
     */
    function computeClassBreakdown(entries) {
        const classMap = new Map(); // className → { bested, pole, podium, bestedPcts[], entryCount }

        (entries || []).forEach(entry => {
            const cls = entry.car_class || entry.CarClass || entry.Class || '';
            if (!cls) return;
            const position = Number(entry.position) || 0;
            const total = Number(entry.total_entries) || 0;
            if (position <= 0 || total <= 0) return;

            if (!classMap.has(cls)) classMap.set(cls, { bested: 0, pole: 0, podium: 0, bestedPcts: [], entryCount: 0 });
            const stats = classMap.get(cls);

            stats.entryCount++;
            const bested = total - position;
            stats.bested += bested;
            if (position === 1 && total >= MIN_ENTRIES_FOR_POLE) stats.pole++;
            if (position <= 3 && total >= MIN_ENTRIES_FOR_PODIUM) stats.podium++;
            if (total > 1) stats.bestedPcts.push((bested / (total - 1)) * 100);
        });

        const result = { avg_bested: [], bested: [], pole: [], podium: [] };

        classMap.forEach((stats, className) => {
            if (stats.bested > 0) result.bested.push({ className, value: stats.bested });
            if (stats.pole > 0) result.pole.push({ className, value: stats.pole });
            if (stats.podium > 0) result.podium.push({ className, value: stats.podium });
            if (stats.bestedPcts.length > 0) {
                const avg = stats.bestedPcts.reduce((a, b) => a + b, 0) / stats.bestedPcts.length;
                result.avg_bested.push({ className, value: Math.round(avg * 100) / 100, entryCount: stats.entryCount });
            }
        });

        // Sort each metric descending
        for (const key of Object.keys(result)) {
            result[key].sort((a, b) => b.value - a.value);
        }
        return result;
    }

    /**
     * Build a mapping of car name → car class from entries.
     * A car may appear in multiple classes; uses the most frequent one.
     * @param {Array} entries - Driver leaderboard entries
     * @returns {Map<string, string>} car name → class name
     */
    function getCarToClassMap(entries) {
        const carClassCounts = new Map(); // car → Map<class, count>
        (entries || []).forEach(entry => {
            const car = (entry.Car || entry.car || entry.CarName || entry.car_name || entry.vehicle || '').trim();
            const cls = (entry.car_class || entry.CarClass || entry.Class || '').trim();
            if (!car || !cls) return;
            if (!carClassCounts.has(car)) carClassCounts.set(car, new Map());
            const clsMap = carClassCounts.get(car);
            clsMap.set(cls, (clsMap.get(cls) || 0) + 1);
        });
        const result = new Map();
        carClassCounts.forEach((clsMap, car) => {
            let best = '', bestCount = 0;
            clsMap.forEach((count, cls) => { if (count > bestCount) { best = cls; bestCount = count; } });
            if (best) result.set(car, best);
        });
        return result;
    }

    window.DriverProfileData = {
        MIN_ENTRIES_FOR_POLE,
        MIN_ENTRIES_FOR_PODIUM,
        countByField,
        getCarClassDistribution,
        getCarDistribution,
        getTrackDistribution,
        getCarToClassMap,
        buildProfileData,
        computeClassBreakdown,
        getRaceRoomProfileUrl
    };
})();
