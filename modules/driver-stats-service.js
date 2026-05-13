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

    function _fetchWithDedup(path) {
        if (_fetchPromises.has(path)) return _fetchPromises.get(path);
        const promise = window.StatsData.fetchGzipJson(path).finally(() => {
            _fetchPromises.delete(path);
        });
        _fetchPromises.set(path, promise);
        return promise;
    }

    /**
     * Search a stats payload for a driver by name (case-insensitive).
     * Returns { value, position, total } or null.
     */
    function findDriverInPayload(payload, driverName, metricKey) {
        const rows = window.StatsData.extractRows(payload);
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
     * When found in the top file, the full file is still used to get the
     * authoritative total count (the top file only has a subset of drivers).
     */
    async function lookupMetric(driverName, metricKey, topPath, fullPath) {
        if (topPath) {
            try {
                const topPayload = await _fetchWithDedup(topPath);
                const found = findDriverInPayload(topPayload, driverName, metricKey);
                if (found) {
                    // Get accurate total from full file
                    if (fullPath) {
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
                return findDriverInPayload(fullPayload, driverName, metricKey);
            } catch (_) { /* full file also unavailable */ }
        }

        return null;
    }

    /**
     * Look up all profile metrics for a driver, in parallel.
     * Each result is { key, label, format, result: { value, position, total } | null }.
     *
     * The avg_bested full file is always fetched to get the true total driver
     * count. That total is applied to both avg_bested and bested (since drivers
     * who never bested anyone don't appear in the bested cache). Other metrics
     * (pole, podium) keep their own totals from their own files.
     */
    async function lookupDriverStats(driverName) {
        const index = await window.StatsData.loadStatsIndex();
        const topFiles = index.overall_top || {};
        const fullFiles = index.overall || {};
        const defs = window.StatsData.METRIC_DEFINITIONS;

        // Kick off fetching the avg_bested full file in parallel to get
        // the authoritative total driver count for bested metrics.
        const avgBestedDef = defs.avg_bested;
        const avgBestedFullPath = avgBestedDef ? (fullFiles[avgBestedDef.fileKey] || '') : '';
        const totalPromise = avgBestedFullPath
            ? _fetchWithDedup(avgBestedFullPath)
                .then(p => window.StatsData.extractRows(p).length)
                .catch(() => null)
            : Promise.resolve(null);

        // Look up all metrics in parallel.
        const [rawResults, bestedTotal] = await Promise.all([
            Promise.all(PROFILE_METRICS.map(async (metric) => {
                const def = defs[metric.key];
                if (!def) return { ...metric, result: null };

                const topPath = topFiles[def.fileKey] || '';
                const fullPath = fullFiles[def.fileKey] || '';

                const result = await lookupMetric(driverName, def.metricKey, topPath, fullPath);
                return { ...metric, result };
            })),
            totalPromise
        ]);

        // Apply avg_bested total only to avg_bested and bested metrics.
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
     * For avg_bested and bested, applies the authoritative total from the full avg_bested file.
     * @param {string} driverName
     * @param {string} metricKey - One of the PROFILE_METRICS keys
     * @returns {Promise<{value, position, total}|null>}
     */
    async function lookupSingleStat(driverName, metricKey) {
        const index = await window.StatsData.loadStatsIndex();
        const topFiles = index.overall_top || {};
        const fullFiles = index.overall || {};
        const defs = window.StatsData.METRIC_DEFINITIONS;

        const def = defs[metricKey];
        if (!def) return null;

        const topPath = topFiles[def.fileKey] || '';
        const fullPath = fullFiles[def.fileKey] || '';

        const result = await lookupMetric(driverName, def.metricKey, topPath, fullPath);
        if (!result) return null;

        // For avg_bested and bested, get authoritative total from the avg_bested full file
        if (metricKey === 'avg_bested' || metricKey === 'bested') {
            const avgBestedDef = defs.avg_bested;
            const avgBestedFullPath = avgBestedDef ? (fullFiles[avgBestedDef.fileKey] || '') : '';
            if (avgBestedFullPath) {
                try {
                    const fullPayload = await _fetchWithDedup(avgBestedFullPath);
                    result.total = window.StatsData.extractRows(fullPayload).length;
                } catch (_) { /* keep existing total */ }
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
        _fetchPromises
    };
})();
