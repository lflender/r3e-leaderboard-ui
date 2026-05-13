/**
 * Driver Profile Data Module
 * Aggregates driver entry data into distributions for charts
 * Single source of truth for driver profile data transformations
 */
(function () {
    'use strict';

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

    window.DriverProfileData = {
        countByField,
        getCarClassDistribution,
        getCarDistribution,
        getTrackDistribution,
        buildProfileData,
        getRaceRoomProfileUrl
    };
})();
