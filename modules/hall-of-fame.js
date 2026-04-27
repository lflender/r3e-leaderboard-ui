(function () {
    const root = document.getElementById('hall-of-fame-container');
    if (!root) return;

    function updateVisibility() {
        root.style.display = window.R3EUtils.isDriverSearchActive() ? 'none' : '';
    }

    const renderList = (rows, metricLabel, valueFormatter) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            return '<li class="hall-of-fame-empty">No data</li>';
        }

        const fmt = typeof valueFormatter === 'function' ? valueFormatter : (v) => v.toLocaleString();
        return rows.map((row, index) => {
            const rank = index + 1;
            const value = Number.isFinite(row.value) ? fmt(row.value) : '0';
            const flagRaw = (window.FlagHelper && typeof window.FlagHelper.countryToFlag === 'function')
                ? window.FlagHelper.countryToFlag(row.country)
                : '';
            const flagHtml = flagRaw ? `<span class="country-flag">${flagRaw}</span>` : '';
            const avatarHtml = row.avatar
                ? `<img class="hall-of-fame-avatar" src="${window.R3EUtils.escapeHtml(row.avatar)}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : '';
            return [
                '<li class="hall-of-fame-item">',
                `<span class="hall-of-fame-rank">${rank}</span>`,
                `<span class="hall-of-fame-name">${flagHtml}${avatarHtml}${window.R3EUtils.escapeHtml(row.name)}</span>`,
                `<span class="hall-of-fame-value">${value} ${metricLabel}</span>`,
                '</li>'
            ].join('');
        }).join('');
    };

    function render(data) {
        root.innerHTML = [
            '<a class="hall-of-fame-link" href="records.html" aria-label="Open Driver Stats page">',
            '<section class="hall-of-fame-card" aria-label="Hall of Fame">',
            '<div class="hall-of-fame-header">',
            '<h3>Hall of Fame</h3>',
            '</div>',
            '<div class="hall-of-fame-grid">',
            '<div class="hall-of-fame-column">',
            '<h4>Avg bested %</h4>',
            `<ol>${renderList(data.avgBested, '%', (v) => v.toFixed(1))}</ol>`,
            '</div>',
            '<div class="hall-of-fame-column">',
            '<h4>Most bested</h4>',
            `<ol>${renderList(data.bested, 'bested')}</ol>`,
            '</div>',
            '<div class="hall-of-fame-column">',
            '<h4>Most poles</h4>',
            `<ol>${renderList(data.poles, 'poles')}</ol>`,
            '</div>',
            '</div>',
            '</section>',
            '</a>'
        ].join('');

        updateVisibility();
    }

    async function init() {
        updateVisibility();

        const driverSearchInput = document.getElementById('driver-search');
        if (driverSearchInput) {
            driverSearchInput.addEventListener('input', updateVisibility);
            driverSearchInput.addEventListener('change', updateVisibility);
        }

        if (!window.StatsData) {
            console.warn('StatsData module is not available for Hall of Fame.');
            return;
        }

        try {
            const index = await window.StatsData.loadStatsIndex();
            const paths = window.StatsData.getAllPathsForFilter(index, '');
            if (!paths || !paths.polePath || !paths.bestedPath || !paths.avgBestedPath) {
                return;
            }

            const defs = window.StatsData.METRIC_DEFINITIONS;
            const [polePayload, bestedPayload, avgBestedPayload] = await Promise.all([
                window.StatsData.fetchGzipJson(paths.polePath),
                window.StatsData.fetchGzipJson(paths.bestedPath),
                window.StatsData.fetchGzipJson(paths.avgBestedPath)
            ]);

            const poles = window.StatsData.normalizeRows(polePayload, defs.pole.metricKey, 5);
            const bested = window.StatsData.normalizeRows(bestedPayload, defs.bested.metricKey, 5);
            const avgBested = window.StatsData.normalizeRows(avgBestedPayload, defs.avg_bested.metricKey, 5);

            render({ poles, bested, avgBested });
        } catch (error) {
            console.error('Hall of Fame failed to render:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
