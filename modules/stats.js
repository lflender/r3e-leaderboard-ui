(function () {
    const filterRootId = 'stats-class-filter-ui';
    const poleTitleEl = document.getElementById('stats-pole-title');
    const bestedTitleEl = document.getElementById('stats-bested-title');
    const poleContainer = document.getElementById('stats-pole-table');
    const bestedContainer = document.getElementById('stats-bested-table');
    const selectedClassLogoEl = document.getElementById('stats-selected-class-logo');

    let currentFilter = '';
    let currentRequestId = 0;
    let hasTrackedStatsDisplayed = false;
    let pendingTrackSource = 'initial';

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

    function getStatsData() {
        if (!window.StatsData) {
            throw new Error('StatsData module is not available.');
        }
        return window.StatsData;
    }

    async function ensureMpPosLoaded() {
        if (typeof loadMpPosCache === 'function') {
            try { await loadMpPosCache(); } catch (_) {}
        }
    }

    function getSelectedLabel(value) {
        if (!value) return 'Overall';
        if (value.startsWith('superclass:')) {
            return value.replace('superclass:', '').trim() || 'Overall';
        }
        return value;
    }

    function getFilterType(value) {
        if (!value) return 'overall';
        return value.startsWith('superclass:') ? 'superclass' : 'class';
    }

    function trackStatsFilterChanged(value, source, poleCount, bestedCount) {
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
        R3EAnalytics.track('stats filter changed', {
            filter_value: value || '',
            filter_label: getSelectedLabel(value),
            filter_type: getFilterType(value),
            source: source || 'filter',
            displayed_pole_rows: Number.isFinite(poleCount) ? poleCount : 0,
            displayed_bested_rows: Number.isFinite(bestedCount) ? bestedCount : 0
        });
    }

    function trackStatsDisplayed(value, poleCount, bestedCount) {
        if (hasTrackedStatsDisplayed) return;
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
        R3EAnalytics.track('stats displayed', {
            filter_value: value || '',
            filter_label: getSelectedLabel(value),
            filter_type: getFilterType(value),
            displayed_pole_rows: Number.isFinite(poleCount) ? poleCount : 0,
            displayed_bested_rows: Number.isFinite(bestedCount) ? bestedCount : 0
        });
        hasTrackedStatsDisplayed = true;
    }

    function buildPositionBadge(position) {
        const posClass = position === 1 ? ' pos-1' : position === 2 ? ' pos-2' : position === 3 ? ' pos-3' : '';
        return `<span class="pos-number${posClass}">${position}</span>`;
    }

    function renderSelectedClassLogo(filterValue) {
        if (!selectedClassLogoEl) return;

        const hideLogo = () => {
            selectedClassLogoEl.innerHTML = '';
            selectedClassLogoEl.hidden = true;
        };

        if (!filterValue || filterValue.startsWith('superclass:')) {
            hideLogo();
            return;
        }

        const className = getSelectedLabel(filterValue);
        const classId = typeof window.getCarClassId === 'function'
            ? window.getCarClassId(className)
            : '';

        const logoUrl = window.R3EUtils?.resolveCarClassLogo?.(className, classId) || '';
        if (!logoUrl) {
            hideLogo();
            return;
        }

        selectedClassLogoEl.innerHTML = `<img class="stats-selected-class-logo__img" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(className)} class logo" loading="lazy" decoding="async">`;
        selectedClassLogoEl.hidden = false;
    }

    function buildDriverCell(row) {
        const name = row.name;
        const country = row.country;
        const rank = row.rank;
        const searchUrl = `drivers.html?driver=${encodeURIComponent(`"${name}"`)}`;  

        // MP position and name colouring
        const mpPos = (typeof resolveMpPos === 'function') ? resolveMpPos(name, country) : null;
        const nameClasses = (typeof getMpPosNameClasses === 'function')
              ? getMpPosNameClasses(mpPos) : '';

        // Flag span — before the name, inside the link
        const flagRaw = (window.FlagHelper && typeof window.FlagHelper.countryToFlag === 'function')
            ? window.FlagHelper.countryToFlag(country) : '';
        const flagHtml = flagRaw ? `<span class="country-flag">${flagRaw}</span>` : '';

        // Rank stars (inline small variant, after the name)
        const rankStarsHtml = (window.R3EUtils && typeof window.R3EUtils.renderRankStars === 'function')
            ? window.R3EUtils.renderRankStars(rank, true) : '';

        // MP position badge — just #N, after rank stars
        const mpPosHtml = mpPos ? ` <span class="mp-pos-badge">#${mpPos}</span>` : '';

        // Exact same structure as detail.js line 1399:
        // flagHtml + name + rankStarsHtml + mpPosHtml — all inside the anchor
        const linkClass = nameClasses ? ` class="${nameClasses}"` : '';
        return `<a href="${escapeHtml(searchUrl)}"${linkClass}>${flagHtml}${escapeHtml(name)}${rankStarsHtml}${mpPosHtml}</a>`;
    }

    function renderTable(container, rows, valueTitle) {
        if (!container) return;

        if (!rows.length) {
            container.innerHTML = '<div class="stats-empty">No data available for this filter.</div>';
            return;
        }

        const tableRows = rows
            .map((row, idx) => {
                const position = idx + 1;
                const posBadge = buildPositionBadge(position);
                const driverCell = buildDriverCell(row);
                const formattedValue = Number.isFinite(row.value) ? row.value.toLocaleString() : '0';
                return `<tr><td class="pos-cell">${posBadge}</td><td class="stats-driver-cell">${driverCell}</td><td class="stats-value-cell">${formattedValue}</td></tr>`;
            })
            .join('');

        container.innerHTML = [
            '<table class="results-table stats-table">',
            `<thead><tr><th class="stats-pos-th">#</th><th>Driver</th><th>${escapeHtml(valueTitle)}</th></tr></thead>`,
            `<tbody>${tableRows}</tbody>`,
            '</table>'
        ].join('');
    }

    function renderLoading() {
        const loadingHtml = '<div class="loading">Loading top drivers...</div>';
        if (poleContainer) poleContainer.innerHTML = loadingHtml;
        if (bestedContainer) bestedContainer.innerHTML = loadingHtml;
    }

    function renderError(error) {
        const safeError = escapeHtml(error?.message || 'Unknown error');
        const html = `<div class="error">Failed to load stats: ${safeError}</div>`;
        if (poleContainer) poleContainer.innerHTML = html;
        if (bestedContainer) bestedContainer.innerHTML = html;
    }

    async function fetchAndRender() {
        const requestId = ++currentRequestId;
        renderLoading();
        renderSelectedClassLogo(currentFilter);

        try {
            const statsData = getStatsData();
            const [index] = await Promise.all([
                statsData.loadStatsIndex(),
                ensureMpPosLoaded()
            ]);

            const paths = statsData.getPathsForFilter(index, currentFilter);

            if (!paths || !paths.polePath || !paths.bestedPath) {
                throw new Error('No stats files found for this class filter.');
            }

            const [poleRaw, bestedRaw] = await Promise.all([
                statsData.fetchGzipJson(paths.polePath),
                statsData.fetchGzipJson(paths.bestedPath)
            ]);

            if (requestId !== currentRequestId) return;

            const selectedLabel = getSelectedLabel(currentFilter);
            if (poleTitleEl) {
                poleTitleEl.textContent = `Top 100 Drivers by Pole Position (${selectedLabel})`;
            }
            if (bestedTitleEl) {
                bestedTitleEl.textContent = `Top 100 Drivers by Bested Drivers (${selectedLabel})`;
            }
            renderSelectedClassLogo(currentFilter);

            const poleRows = statsData.normalizeRows(poleRaw, 'pole_positions');
            const bestedRows = statsData.normalizeRows(bestedRaw, 'bested_drivers');

            renderTable(poleContainer, poleRows, 'Poles');
            renderTable(bestedContainer, bestedRows, 'Bested');

            trackStatsDisplayed(currentFilter, poleRows.length, bestedRows.length);
            trackStatsFilterChanged(currentFilter, pendingTrackSource, poleRows.length, bestedRows.length);
            pendingTrackSource = 'filter';
        } catch (error) {
            if (requestId !== currentRequestId) return;
            console.error('Stats page failed to render:', error);
            renderError(error);
        }
    }

    function initFilter() {
        if (typeof window.CustomSelect !== 'function') {
            console.warn('CustomSelect is not available for stats page.');
            return;
        }

        const superclassOptions = window.dataService?.getSuperclassOptions?.() || [];
        const regularClassOptions = window.dataService?.getClassOptionsFromCarsData?.() || [];
        const classOptions = [{ value: '', label: 'All classes' }]
            .concat(superclassOptions)
            .concat(regularClassOptions);

        new window.CustomSelect(filterRootId, classOptions, (value) => {
            currentFilter = value || '';
            pendingTrackSource = 'filter';
            fetchAndRender();
        });
    }

    async function init() {
        if (!poleContainer || !bestedContainer) return;
        initFilter();
        await fetchAndRender();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
