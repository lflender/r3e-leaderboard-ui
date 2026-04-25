(function () {
    const escapeHtml = (v) => window.R3EUtils.escapeHtml(v);

    function buildPositionBadge(position) {
        const posClass = position === 1 ? ' pos-1'
            : position === 2 ? ' pos-2'
            : position === 3 ? ' pos-3'
            : '';
        return `<span class="pos-number${posClass}">${position}</span>`;
    }

    function buildDriverCell(row) {
        const name = String(row.name || '').trim().replace(/\s+/g, ' ');
        const country = row.country;
        const rank = row.rank;
        const searchUrl = `drivers.html?driver=${encodeURIComponent(`"${name}"`)}`;

        const mpPos = (typeof window.resolveMpPos === 'function') ? window.resolveMpPos(name, country) : null;
        const nameClasses = (typeof window.getMpPosNameClasses === 'function')
            ? window.getMpPosNameClasses(mpPos) : '';

        const flagRaw = (window.FlagHelper && typeof window.FlagHelper.countryToFlag === 'function')
            ? window.FlagHelper.countryToFlag(country) : '';
        const flagHtml = flagRaw ? `<span class="country-flag">${flagRaw}</span>` : '';

        const rankStarsHtml = (window.R3EUtils && typeof window.R3EUtils.renderRankStars === 'function')
            ? window.R3EUtils.renderRankStars(rank, true) : '';

        const mpPosHtml = mpPos ? ` <span class="mp-pos-badge">#${mpPos}</span>` : '';

        const avatarHtml = row.avatar
            ? `<img class="records-driver-avatar" src="${escapeHtml(row.avatar)}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : '';

        const linkClass = nameClasses ? ` class="${nameClasses}"` : '';
        const teamHtml = row.team
            ? ` <span class="records-driver-team">${escapeHtml(row.team)}</span>` : '';
        return `<a href="${escapeHtml(searchUrl)}"${linkClass}>${flagHtml}${avatarHtml}${escapeHtml(name)}${rankStarsHtml}${mpPosHtml}</a>${teamHtml}`;
    }

    function defaultValueFormatter(value) {
        return Number.isFinite(value) ? value.toLocaleString() : '0';
    }

    function renderTable(container, rows, valueTitle, options) {
        if (!container) return;
        const opts = options || {};
        const valueFormatter = typeof opts.valueFormatter === 'function'
            ? opts.valueFormatter
            : defaultValueFormatter;
        const emptyMessage = opts.emptyMessage || 'No data available for this filter.';

        if (!rows || !rows.length) {
            container.innerHTML = `<div class="stats-empty">${escapeHtml(emptyMessage)}</div>`;
            return;
        }

        const tableRows = rows
            .map((row, idx) => {
                const position = (opts.startRank || 1) + idx;
                const posBadge = buildPositionBadge(position);
                const driverCell = buildDriverCell(row);
                const formattedValue = valueFormatter(row.value, row);
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

    window.StatsRenderer = {
        buildPositionBadge,
        buildDriverCell,
        renderTable,
        defaultValueFormatter
    };
})();
