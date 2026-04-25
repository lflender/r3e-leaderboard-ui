(function () {
    const root = document.getElementById('hall-of-fame-container');
    const driverSearchInput = document.getElementById('driver-search');
    if (!root) return;

    function isSearchActive() {
        if (driverSearchInput && driverSearchInput.value.trim().length > 0) {
            return true;
        }

        const params = new URLSearchParams(window.location.search);
        return Boolean((params.get('driver') || params.get('query') || '').trim());
    }

    function updateVisibility() {
        root.style.display = isSearchActive() ? 'none' : '';
    }

    const escapeHtml = (value) => {
        if (window.R3EUtils && typeof window.R3EUtils.escapeHtml === 'function') {
            return window.R3EUtils.escapeHtml(value);
        }
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const renderList = (rows, metricLabel) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            return '<li class="hall-of-fame-empty">No data</li>';
        }

        return rows.map((row, index) => {
            const rank = index + 1;
            const value = Number.isFinite(row.value) ? row.value.toLocaleString() : '0';
            const flagRaw = (window.FlagHelper && typeof window.FlagHelper.countryToFlag === 'function')
                ? window.FlagHelper.countryToFlag(row.country)
                : '';
            const flagHtml = flagRaw ? `<span class="country-flag">${flagRaw}</span>` : '';
            return [
                '<li class="hall-of-fame-item">',
                `<span class="hall-of-fame-rank">${rank}</span>`,
                `<span class="hall-of-fame-name">${flagHtml}${escapeHtml(row.name)}</span>`,
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
            '<h4>Most poles</h4>',
            `<ol>${renderList(data.poles, 'poles')}</ol>`,
            '</div>',
            '<div class="hall-of-fame-column">',
            '<h4>Most bested</h4>',
            `<ol>${renderList(data.bested, 'bested')}</ol>`,
            '</div>',
            '</div>',
            '</section>',
            '</a>'
        ].join('');

        updateVisibility();
    }

    async function init() {
        updateVisibility();

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
            const paths = window.StatsData.getPathsForFilter(index, '');
            if (!paths || !paths.polePath || !paths.bestedPath) {
                return;
            }

            const [polePayload, bestedPayload] = await Promise.all([
                window.StatsData.fetchGzipJson(paths.polePath),
                window.StatsData.fetchGzipJson(paths.bestedPath)
            ]);

            const poles = window.StatsData.normalizeRows(polePayload, 'pole_positions', 5);
            const bested = window.StatsData.normalizeRows(bestedPayload, 'bested_drivers', 5);

            render({ poles, bested });
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
