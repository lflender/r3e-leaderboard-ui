/**
 * Driver Stats Service
 * Looks up a driver's ranking across overall stats leaderboards.
 * Fetches the smaller overall_top files first, falling back to full files.
 * Uses single-flight promise deduplication for concurrent safety.
 */
(function () {
    'use strict';

    /** Metrics displayed on the driver profile */
    const PROFILE_METRICS = [
        { key: 'avg_bested', label: 'Average Bested %', format: 'percent' },
        { key: 'bested', label: 'Drivers Bested', format: 'number' },
        { key: 'pole', label: 'Pole Positions', format: 'number' },
        { key: 'podium', label: 'Podiums', format: 'number' }
    ];

    /** Single-flight promise cache — prevents duplicate fetches of the same file */
    const _fetchPromises = new Map();

    /** Cache for total_drivers from status.json */
    let _totalDriversPromise = null;

    function _getTotalDrivers() {
        if (_totalDriversPromise) return _totalDriversPromise;
        _totalDriversPromise = window.dataService.calculateStatus()
            .then(s => (s && s.total_drivers) ? s.total_drivers : null)
            .catch(() => null);
        return _totalDriversPromise;
    }

    function _fetchWithDedup(path) {
        if (_fetchPromises.has(path)) return _fetchPromises.get(path);
        const promise = window.StatsData.fetchGzipJson(path).finally(() => {
            _fetchPromises.delete(path);
        });
        _fetchPromises.set(path, promise);
        return promise;
    }

    /**
     * Search a stats payload for a driver.
     * When pathId is provided, matches only by driver_key for accuracy
     * (avoids returning a different driver with the same name).
     * Without pathId, falls back to name matching (case-insensitive).
     * Returns { value, position, total } or null.
     */
    function findDriverInPayload(payload, driverName, metricKey, pathId) {
        const rows = window.StatsData.extractRows(payload);

        // When pathId is available, match exclusively by driver_key
        if (pathId) {
            const searchId = pathId.toLowerCase().trim();
            for (let i = 0; i < rows.length; i++) {
                const rowKey = (rows[i]?.driver_key || '').toLowerCase().trim();
                if (rowKey && rowKey === searchId) {
                    return {
                        value: Number(rows[i]?.[metricKey] || 0),
                        position: i + 1,
                        total: rows.length
                    };
                }
            }
            return null;
        }

        // No pathId — match by name
        const searchName = driverName.toLowerCase().trim();
        for (let i = 0; i < rows.length; i++) {
            const rowName = (rows[i]?.name || rows[i]?.driver_name || rows[i]?.driver_key || '')
                .toLowerCase().trim();
            if (rowName === searchName) {
                return {
                    value: Number(rows[i]?.[metricKey] || 0),
                    position: i + 1,
                    total: rows.length
                };
            }
        }
        return null;
    }

    /**
     * Look up a single metric for a driver.
     * Tries the top (smaller) file first, then falls back to the full file.
     * When found in the top file and skipFullTotal is false, the full file is
     * still used to get the authoritative total (the top file only has a subset).
     * When skipFullTotal is true, the top file total is kept (caller will
     * override it with the status total_drivers count).
     */
    async function lookupMetric(driverName, metricKey, topPath, fullPath, skipFullTotal, pathId) {
        if (topPath) {
            try {
                const topPayload = await _fetchWithDedup(topPath);
                const found = findDriverInPayload(topPayload, driverName, metricKey, pathId);
                if (found) {
                    // Get accurate total from full file unless caller will provide it
                    if (!skipFullTotal && fullPath) {
                        try {
                            const fullPayload = await _fetchWithDedup(fullPath);
                            found.total = window.StatsData.extractRows(fullPayload).length;
                        } catch (_) { /* keep top file total */ }
                    }
                    return found;
                }
            } catch (_) { /* top file unavailable, try full */ }
        }

        if (fullPath) {
            try {
                const fullPayload = await _fetchWithDedup(fullPath);
                return findDriverInPayload(fullPayload, driverName, metricKey, pathId);
            } catch (_) { /* full file also unavailable */ }
        }

        return null;
    }

    /**
     * Look up all profile metrics for a driver, in parallel.
     * Each result is { key, label, format, result: { value, position, total } | null }.
     *
     * For avg_bested and bested, total comes from status.json total_drivers
     * (avoids fetching the large full files). Other metrics (pole, podium)
     * keep their own totals from their full files.
     */
    async function lookupDriverStats(driverName, pathId) {
        const index = await window.StatsData.loadStatsIndex();
        const topFiles = index.overall_top || {};
        const fullFiles = index.overall || {};
        const defs = window.StatsData.METRIC_DEFINITIONS;

        // Get total driver count from status.json (lightweight).
        const totalPromise = _getTotalDrivers();

        // Look up all metrics in parallel.
        const [rawResults, bestedTotal] = await Promise.all([
            Promise.all(PROFILE_METRICS.map(async (metric) => {
                const def = defs[metric.key];
                if (!def) return { ...metric, result: null };

                const topPath = topFiles[def.fileKey] || '';
                const fullPath = fullFiles[def.fileKey] || '';
                // Skip full file fetch for total on bested metrics — status provides it
                const skipFull = metric.key === 'avg_bested' || metric.key === 'bested';
                const result = await lookupMetric(driverName, def.metricKey, topPath, fullPath, skipFull, pathId);
                return { ...metric, result };
            })),
            totalPromise
        ]);

        // Apply status total_drivers to avg_bested and bested metrics.
        // Pole and podium keep their own totals from their own files.
        if (bestedTotal != null) {
            for (const r of rawResults) {
                if ((r.key === 'avg_bested' || r.key === 'bested') && r.result) {
                    r.result.total = bestedTotal;
                }
            }
        }

        return rawResults;
    }

    /**
     * Format a stat value for display.
     */
    function formatValue(value, format) {
        if (value == null || isNaN(value)) return '—';
        if (format === 'percent') return value.toFixed(1) + '%';
        return Number(value).toLocaleString();
    }

    /**
     * Look up a single stat metric for a driver independently.
     * For avg_bested and bested, total comes from status.json total_drivers.
     * @param {string} driverName
     * @param {string} metricKey - One of the PROFILE_METRICS keys
     * @returns {Promise<{value, position, total}|null>}
     */
    async function lookupSingleStat(driverName, metricKey, pathId) {
        const index = await window.StatsData.loadStatsIndex();
        const topFiles = index.overall_top || {};
        const fullFiles = index.overall || {};
        const defs = window.StatsData.METRIC_DEFINITIONS;

        const def = defs[metricKey];
        if (!def) return null;

        const topPath = topFiles[def.fileKey] || '';
        const fullPath = fullFiles[def.fileKey] || '';
        const skipFull = metricKey === 'avg_bested' || metricKey === 'bested';

        const result = await lookupMetric(driverName, def.metricKey, topPath, fullPath, skipFull, pathId);
        if (!result) return null;

        // For avg_bested and bested, use total_drivers from status.json
        if (metricKey === 'avg_bested' || metricKey === 'bested') {
            const statusTotal = await _getTotalDrivers();
            if (statusTotal != null) {
                result.total = statusTotal;
            }
        }

        return result;
    }

    window.DriverStatsService = {
        PROFILE_METRICS,
        lookupDriverStats,
        lookupSingleStat,
        findDriverInPayload,
        formatValue,
        _fetchWithDedup,
        _fetchPromises,
        _getTotalDrivers,
        _resetTotalDriversCache() { _totalDriversPromise = null; }
    };
})();
