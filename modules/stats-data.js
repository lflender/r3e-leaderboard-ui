(function () {
    const TOP_ROWS_DEFAULT = 100;
    let statsIndexCache = null;

    // Single source of truth for all 4 record types.
    // direction: 'desc' = higher value is better; 'asc' = lower value is better.
    const METRIC_DEFINITIONS = {
        pole: { metricKey: 'pole_positions', fileKey: 'pole_file', direction: 'desc' },
        bested: { metricKey: 'bested_drivers', fileKey: 'bested_file', direction: 'desc' },
        podium: { metricKey: 'podiums', fileKey: 'podium_file', direction: 'desc' },
        avg_bested: { metricKey: 'avg_bested', fileKey: 'avg_bested_file', direction: 'desc' },
        entries: { metricKey: 'entries', fileKey: 'entries_file', direction: 'desc' }
    };

    const createCacheBustedUrl = (path) => `${path}?v=${Date.now()}`;

    async function fetchJson(path) {
        const response = await fetch(createCacheBustedUrl(path), { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async function fetchGzipJson(path) {
        const response = await fetch(createCacheBustedUrl(path), { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
        }
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('DecompressionStream is not supported in this browser.');
        }

        const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream).text();
        return JSON.parse(text);
    }

    async function loadStatsIndex() {
        if (statsIndexCache) return statsIndexCache;
        statsIndexCache = await fetchJson('cache/stats/index.json');
        return statsIndexCache;
    }

    function getFilesEntryForFilter(index, filterValue) {
        if (!filterValue) {
            return index.overall || null;
        }

        if (filterValue.startsWith('superclass:')) {
            const superclassName = filterValue.replace('superclass:', '').trim();
            const item = (index.superclasses || []).find((entry) => String(entry.name || entry.id) === superclassName);
            return item ? (item.files || null) : null;
        }

        const classId = window.getCarClassId ? window.getCarClassId(filterValue) : null;
        if (!classId) return null;

        const item = (index.classes || []).find((entry) => String(entry.id) === String(classId));
        return item ? (item.files || null) : null;
    }

    // Backwards-compatible: returns { polePath, bestedPath } only.
    function getPathsForFilter(index, filterValue) {
        const files = getFilesEntryForFilter(index, filterValue);
        if (!files) return null;
        return {
            polePath: files.pole_file,
            bestedPath: files.bested_file
        };
    }

    // Returns paths for all metrics (any may be undefined if missing).
    function getAllPathsForFilter(index, filterValue) {
        const files = getFilesEntryForFilter(index, filterValue);
        if (!files) return null;

        const preferOverallTopFile = (path) => {
            if (!path) return undefined;
            const raw = String(path);
            // Prefer smaller overall_top_* files when available.
            // Example: cache/stats/overall_pole.json.gz -> cache/stats/overall_top_pole.json.gz
            if (!filterValue && raw.includes('/overall_')) {
                return raw.replace('/overall_', '/overall_top_');
            }
            return raw;
        };

        return {
            polePath: preferOverallTopFile(files.pole_file),
            bestedPath: preferOverallTopFile(files.bested_file),
            podiumPath: preferOverallTopFile(files.podium_file),
            avgBestedPath: preferOverallTopFile(files.avg_bested_file),
            entriesPath: preferOverallTopFile(files.entries_file)
        };
    }

    function extractRows(payload) {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.results)) return payload.results;
        return [];
    }

    function normalizeRow(row, metricKey) {
        return {
            name: row?.name || row?.driver_name || row?.driver_key || 'Unknown',
            country: row?.country || '',
            rank: row?.rank || '',
            avatar: row?.avatar || '',
            team: row?.team || '',
            value: Number(row?.[metricKey] || 0)
        };
    }

    function isPayloadPreSorted(payload, metricKey, direction) {
        if (!payload || Array.isArray(payload)) return false;
        const sortBy = String(payload.sort_by || '').trim();
        const sortDirection = String(payload.sort_direction || '').trim().toLowerCase();
        if (sortBy !== metricKey) return false;
        if (!sortDirection) return direction === 'desc';
        return sortDirection === direction;
    }

    function normalizeRows(payload, metricKey, topRows = TOP_ROWS_DEFAULT, options) {
        const rows = extractRows(payload);
        if (!rows.length) return [];

        const direction = (options && options.direction === 'asc') ? 'asc' : 'desc';
        const preFilter = (options && typeof options.preFilter === 'function') ? options.preFilter : null;

        // Fast path: many cache payloads are already sorted by the requested metric.
        // In that case, keep the payload order and stop once we have enough rows.
        if (isPayloadPreSorted(payload, metricKey, direction)) {
            const normalized = [];
            for (const row of rows) {
                if (preFilter && !preFilter(row)) continue;
                normalized.push(normalizeRow(row, metricKey));
                if (normalized.length >= topRows) break;
            }
            return normalized;
        }

        return (preFilter ? rows.filter(preFilter) : rows)
            .map((row) => normalizeRow(row, metricKey))
            .sort((a, b) => direction === 'asc' ? a.value - b.value : b.value - a.value)
            .slice(0, topRows);
    }

    window.StatsData = {
        METRIC_DEFINITIONS,
        fetchJson,
        fetchGzipJson,
        loadStatsIndex,
        getFilesEntryForFilter,
        getPathsForFilter,
        getAllPathsForFilter,
        extractRows,
        normalizeRows
    };
})();
