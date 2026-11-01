(function () {
    const escapeHtml = (v) => window.R3EUtils.escapeHtml(v);
    const LEGACY_AVATAR_URL_PATTERN = /^https:\/\/game\.raceroom\.com\/storage\/user-avatars\/[^/?#]+(?:[?#].*)?$/i;

    function resolveAvatarUrl(avatar, pathId) {
        const source = String(avatar || '');
        const driverId = String(pathId || '').trim();
        if (LEGACY_AVATAR_URL_PATTERN.test(source) && /^\d+$/.test(driverId)) {
            return `https://game.raceroomracing.com/game/user_avatar/${encodeURIComponent(driverId)}`;
        }
        return source;
    }

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
        const pathId = row.path_id || '';
        const idSuffix = pathId ? `&id=${encodeURIComponent(pathId)}` : '';
        const searchUrl = `drivers.html?driver=${encodeURIComponent(`"${name}"`)}${idSuffix}`;
        const driverKey = encodeURIComponent(String(pathId || name));

        const mpResult = (typeof window.resolveMpPosWithInactive === 'function')
            ? window.resolveMpPosWithInactive(name) : { position: null, inactive: false };
        const effectiveMpPos = mpResult.position;
        const nameClasses = (typeof window.getMpPosNameClasses === 'function')
            ? window.getMpPosNameClasses(effectiveMpPos, { inactive: mpResult.inactive }) : '';

        const flagRaw = (window.FlagHelper && typeof window.FlagHelper.countryToFlag === 'function')
            ? window.FlagHelper.countryToFlag(country) : '';
        const flagHtml = flagRaw ? `<span class="country-flag">${flagRaw}</span>` : '';

        const rankStarsHtml = (window.R3EUtils && typeof window.R3EUtils.renderRankStars === 'function')
            ? window.R3EUtils.renderRankStars(rank, true) : '';

        const mpPosBadgeClass = mpResult.inactive ? 'mp-pos-badge mp-pos-inactive' : 'mp-pos-badge';
        const mpPosHtml = effectiveMpPos ? ` <span class="${mpPosBadgeClass}">#${effectiveMpPos}</span>` : '';

        const avatarUrl = resolveAvatarUrl(row.avatar, pathId);
        const avatarHtml = avatarUrl
            ? `<img class="records-driver-avatar" src="${escapeHtml(avatarUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';

        const linkClass = nameClasses ? ` class="${nameClasses}"` : '';
        const teamHtml = row.team
            ? ` <span class="records-driver-team">${escapeHtml(row.team)}</span>` : '';
        return `<a href="${escapeHtml(searchUrl)}" data-driver-key="${escapeHtml(driverKey)}"${linkClass}>${flagHtml}${avatarHtml}${escapeHtml(name)}${rankStarsHtml}${mpPosHtml}</a>${teamHtml}`;
    }

    function updateDriverAvatars(container, rows) {
        if (!container || !Array.isArray(rows)) return;

        const avatarsByKey = new Map(rows
            .filter(row => row?.avatar)
            .map(row => [encodeURIComponent(String(row.path_id || row.name || '')), row]));
        if (avatarsByKey.size === 0) return;

        container.querySelectorAll('a[data-driver-key]').forEach(anchor => {
            const row = avatarsByKey.get(anchor.dataset.driverKey);
            if (!row || anchor.querySelector('.records-driver-avatar')) return;

            const image = document.createElement('img');
            image.className = 'records-driver-avatar';
            image.src = resolveAvatarUrl(row.avatar, row.path_id || row.pathId || row.driver_key);
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            image.loading = 'lazy';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            const flag = anchor.querySelector('.country-flag');
            if (flag) {
                flag.after(image);
            } else {
                anchor.insertBefore(image, anchor.firstChild);
            }
        });
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
        updateDriverAvatars,
        renderTable,
        defaultValueFormatter
    };
})();
