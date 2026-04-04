(function () {
    const TOP_ROWS_DEFAULT = 100;
    let statsIndexCache = null;

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

    function getPathsForFilter(index, filterValue) {
        if (!filterValue) {
            return {
                polePath: index.overall?.pole_file,
                bestedPath: index.overall?.bested_file
            };
        }

        if (filterValue.startsWith('superclass:')) {
            const superclassName = filterValue.replace('superclass:', '').trim();
            const item = (index.superclasses || []).find((entry) => String(entry.name || entry.id) === superclassName);
            if (!item) return null;
            return {
                polePath: item.files?.pole_file,
                bestedPath: item.files?.bested_file
            };
        }

        const classId = window.getCarClassId ? window.getCarClassId(filterValue) : null;
        if (!classId) return null;

        const item = (index.classes || []).find((entry) => String(entry.id) === String(classId));
        if (!item) return null;

        return {
            polePath: item.files?.pole_file,
            bestedPath: item.files?.bested_file
        };
    }

    function extractRows(payload) {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.results)) return payload.results;
        return [];
    }

    function normalizeRows(payload, metricKey, topRows = TOP_ROWS_DEFAULT) {
        const rows = extractRows(payload);
        if (!rows.length) return [];

        return rows
            .map((row) => ({
                name: row?.name || row?.driver_name || row?.driver_key || 'Unknown',
                country: row?.country || '',
                rank: row?.rank || '',
                value: Number(row?.[metricKey] || 0)
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, topRows);
    }

    window.StatsData = {
        fetchJson,
        fetchGzipJson,
        loadStatsIndex,
        getPathsForFilter,
        extractRows,
        normalizeRows
    };
})();
