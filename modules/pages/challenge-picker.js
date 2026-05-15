/**
 * Challenge Picker Page
 *
 * Wires DOM controls to ChallengePickerService.
 * Responsibilities: toggle state, rendering results, animation.
 */
(function () {
    'use strict';

    /* ── constants ────────────────────────────────────────── */

    const MODE_BOTH = 'both';
    const MODE_CAR  = 'car';
    const MODE_TRACK = 'track';

    const GRANULARITY_CLASS  = 'class';
    const GRANULARITY_CAR    = 'car';
    const GRANULARITY_TRACK  = 'track';
    const GRANULARITY_LAYOUT = 'layout';

    const SPIN_CLASS = 'challenge-picker__result--spinning';
    const HARDCORE_LOCKOUT_MINUTES = 15;
    const HARDCORE_LOCKOUT_MS = HARDCORE_LOCKOUT_MINUTES * 60 * 1000;
    const SS_PREFIX = 'challenge-';

    /* ── sessionStorage helpers ────────────────────────────── */

    function ssGet(key) {
        try { return sessionStorage.getItem(SS_PREFIX + key); } catch (_) { return null; }
    }
    function ssSet(key, val) {
        try { sessionStorage.setItem(SS_PREFIX + key, val); } catch (_) { /* ignored */ }
    }
    function ssRemove(key) {
        try { sessionStorage.removeItem(SS_PREFIX + key); } catch (_) { /* ignored */ }
    }

    /* ── state ────────────────────────────────────────────── */

    let currentMode = MODE_BOTH;
    let carGranularity = GRANULARITY_CLASS;
    let trackGranularity = GRANULARITY_TRACK;

    let filterEra = '';
    let filterWheel = '';
    let filterTrans = '';
    let filterRating = '';

    // Last picked results for granularity refinement
    let lastCarClassResult = null;   // { className, classLogo }
    let lastCarPickResult = null;    // full pick result for re-rendering
    let lastTrackBaseResult = null;  // { trackBase, trackLogo }
    let lastPickedClassName = null;  // for track stats class ID lookup
    let lastPickedSuperclass = null; // for combined category stats
    let lastPickedLayoutId = null;   // for track stats track ID

    // Cached rendered HTML for each granularity level
    let carClassHtml = '';
    let carDetailHtml = '';
    let trackBaseHtml = '';
    let trackLayoutHtml = '';

    let groupByCategory = false;
    let hardcoreMode = false;
    let hardcoreCb, hardcoreLabel;

    // Track stats
    let trackStatsContainer;
    const leaderboardPromises = new Map(); // single-flight promise cache

    // Valid combinations index: classId → Set of trackId strings
    let validTracksByClass = null; // null = not loaded yet
    let combinationsIndexPromise = null;

    async function loadCombinationsIndex() {
        if (validTracksByClass) return;
        if (combinationsIndexPromise) return combinationsIndexPromise;
        combinationsIndexPromise = (async () => {
            try {
                const ds = window.dataService;
                if (!ds) return;
                const combos = await ds.fetchAllCombinations();
                const map = new Map();
                for (const c of combos) {
                    const cid = String(c.class_id);
                    const tid = String(c.track_id);
                    if (!map.has(cid)) map.set(cid, new Set());
                    map.get(cid).add(tid);
                }
                validTracksByClass = map;
            } catch (_) { /* index unavailable – pick without filtering */ }
        })();
        return combinationsIndexPromise;
    }

    function getValidTracksForClass(classId) {
        if (!validTracksByClass || !classId) return null; // null = no filtering
        return validTracksByClass.get(String(classId)) || new Set();
    }

    /* ── selectors (cached once on init) ──────────────────── */

    let modeButtons, carGranularityButtons, trackGranularityButtons;
    let carPicker, trackPicker, carResult, trackResult, pickBtn;
    let repickCarBtn, repickTrackBtn;

    /* ── helpers ──────────────────────────────────────────── */

    function escapeHtml(text) {
        return window.R3EUtils && typeof window.R3EUtils.escapeHtml === 'function'
            ? window.R3EUtils.escapeHtml(text)
            : String(text ?? '');
    }

    function resolveClassLogo(className) {
        return window.R3ETrackUtils ? window.R3ETrackUtils.resolveCarClassLogoByName(className) : '';
    }

    function resolveTrackLogo(label) {
        return window.R3ETrackImages ? window.R3ETrackImages.resolveTrackLogoByLabel(label) : '';
    }

    function resolveBrandLogo(carName) {
        return window.R3ECarUtils ? window.R3ECarUtils.resolveBrandLogoPath(carName) : '';
    }

    /* ── class ID reverse-lookup ──────────────────────────── */

    function resolveClassId(className) {
        const map = window.CAR_CLASSES_DATA;
        if (!map || !className) return null;
        for (const [id, name] of Object.entries(map)) {
            if (name === className) return id;
        }
        return null;
    }

    /* ── track stats (leaderboard fetch) ──────────────────── */

    function fetchLeaderboard(trackId, classId) {
        const key = `${trackId}_${classId}`;
        if (leaderboardPromises.has(key)) return leaderboardPromises.get(key);

        const promise = (async () => {
            try {
                const ds = window.dataService;
                if (!ds) return null;
                const data = await ds.fetchLeaderboardDetails(trackId, classId);
                return ds.extractLeaderboardArray(data);
            } catch (_) {
                return null;
            } finally {
                leaderboardPromises.delete(key);
            }
        })();
        leaderboardPromises.set(key, promise);
        return promise;
    }

    function extractLapTimeRaw(item) {
        const raw = item.LapTime || item['Lap Time'] || item.lap_time || item.laptime || item.Time || '';
        // Strip gap portion: "1m 23.456s, +01.533s" → "1m 23.456s"
        return String(raw).split(',')[0].trim();
    }

    function formatLapTime(raw) {
        if (window.R3ETimeUtils && window.R3ETimeUtils.formatClassicLapTime) {
            return window.R3ETimeUtils.formatClassicLapTime(raw);
        }
        return raw;
    }

    function extractDriverName(item) {
        // Raw cache entries have nested driver.Name
        const nested = item.driver?.Name || item.driver?.name;
        if (nested) return nested;
        return window.DataNormalizer ? window.DataNormalizer.extractName(item) : (item.Name || item.name || '-');
    }

    function extractDriverCountry(item) {
        // Raw cache entries have nested country.Name
        const nested = item.country?.Name || item.country?.name;
        if (nested) return nested;
        return window.DataNormalizer ? window.DataNormalizer.extractCountry(item) : (item.Country || item.country || '');
    }

    function extractDriverRank(item) {
        if (item.rank && typeof item.rank === 'object') return item.rank.Name || item.rank.name || '';
        if (item.Rank && typeof item.Rank === 'object') return item.Rank.Name || item.Rank.name || '';
        return item.Rank || item.rank || '';
    }

    function buildTrackStats(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return null;
        const first = entries[0];
        const last = entries[entries.length - 1];
        return {
            count: entries.length,
            bestTime: extractLapTimeRaw(first),
            worstTime: extractLapTimeRaw(last),
            topDriver: extractDriverName(first),
            topCountry: extractDriverCountry(first),
            topRank: extractDriverRank(first)
        };
    }

    function getCategoryClassSpecs(superclass) {
        const rawCarsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
        const classNames = rawCarsData
            .filter(entry => (entry.superclass || '') === superclass)
            .map(entry => entry.class || '');
        const unique = [...new Set(classNames)];
        return unique
            .map(name => ({ classId: resolveClassId(name), className: name }))
            .filter(spec => spec.classId != null);
    }

    function buildCombinedStats(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return null;
        const first = entries[0];
        const last = entries[entries.length - 1];
        // Combined entries are normalized — use flat fields
        const name = first.Name || extractDriverName(first);
        const country = first.Country || extractDriverCountry(first);
        const bestRaw = first.LapTime || first['Lap Time'] || '';
        const worstRaw = last.LapTime || last['Lap Time'] || '';
        return {
            count: entries.length,
            bestTime: String(bestRaw).split(',')[0].trim(),
            worstTime: String(worstRaw).split(',')[0].trim(),
            topDriver: name,
            topCountry: country,
            topRank: first.Rank || extractDriverRank(first)
        };
    }

    function renderDriverHtml(driverName, countryName, rank) {
        const FH = typeof FlagHelper !== 'undefined' ? FlagHelper : null;
        const flag = FH && FH.countryToFlag ? FH.countryToFlag(countryName) : '';
        const flagHtml = flag ? `<span class="challenge-stats-flag">${flag}</span>` : '';
        const driverHref = `drivers.html?driver=${encodeURIComponent('"' + driverName + '"')}`;

        const rankStarsHtml = (window.R3EUtils && typeof window.R3EUtils.renderRankStars === 'function')
            ? window.R3EUtils.renderRankStars(rank, true) : '';

        const getMpPos = typeof window.getMpPos === 'function' ? window.getMpPos : null;
        const getMpPosNameCls = typeof window.getMpPosNameClasses === 'function' ? window.getMpPosNameClasses : null;
        const countryCode = FH && FH.findCountryCodeByName ? FH.findCountryCodeByName(countryName) : '';
        const mpPos = getMpPos ? getMpPos(driverName, countryCode) : null;
        const nameClasses = getMpPosNameCls && mpPos ? getMpPosNameCls(mpPos) : '';
        const linkClasses = ['challenge-stats-driver', nameClasses].filter(Boolean).join(' ');

        return `<a class="${linkClasses}" href="${escapeHtml(driverHref)}">${flagHtml}${escapeHtml(driverName)}${rankStarsHtml}</a>`;
    }

    function renderTrackStatsHtml(stats, trackId, classId, combinedStats, superclass, combinedOnly) {
        if (!stats && !combinedStats) return '';
        const detailHref = `detail.html?track=${encodeURIComponent(trackId)}&class=${encodeURIComponent(classId)}`;

        let rows = '';

        if (combinedStats && superclass && combinedOnly) {
            // Combined-only view (Class granularity): show only combined stats
            const combiDetailHref = `detail.html?track=${encodeURIComponent(trackId)}&superclass=${encodeURIComponent(superclass)}`;
            const combiLast = combinedStats.count > 1 ? `
                <span class="challenge-stats-label">Last</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--last">${escapeHtml(formatLapTime(combinedStats.worstTime))}</span>` : '';
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">Entries</span>
                <span class="challenge-stats-value">${combinedStats.count}</span>
                <span class="challenge-stats-label">Best</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--best">${escapeHtml(formatLapTime(combinedStats.bestTime))}</span>${combiLast}
            </div>`;

            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">#1</span>
                <span class="challenge-stats-value">${renderDriverHtml(combinedStats.topDriver, combinedStats.topCountry, combinedStats.topRank)}</span>
            </div>`;
            rows += `<div class="challenge-stats-row challenge-stats-row--link">
                <a class="challenge-stats-detail-link" href="${escapeHtml(combiDetailHref)}">View full leaderboard →</a>
            </div>`;
        } else if (combinedStats && superclass) {
            // Full view: class row + combined row + both drivers + both links
            const combiDetailHref = `detail.html?track=${encodeURIComponent(trackId)}&superclass=${encodeURIComponent(superclass)}`;

            const classLast = stats.count > 1 ? `
                <span class="challenge-stats-label">Last</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--last">${escapeHtml(formatLapTime(stats.worstTime))}</span>` : '';
            const combiLast2 = combinedStats.count > 1 ? `
                <span class="challenge-stats-label">Last</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--last">${escapeHtml(formatLapTime(combinedStats.worstTime))}</span>` : '';
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">Entries</span>
                <span class="challenge-stats-value">${stats.count}</span>
                <span class="challenge-stats-label">Best</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--best">${escapeHtml(formatLapTime(stats.bestTime))}</span>${classLast}
            </div>`;
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">Combined</span>
                <span class="challenge-stats-value">${combinedStats.count}</span>
                <span class="challenge-stats-label">Best</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--best">${escapeHtml(formatLapTime(combinedStats.bestTime))}</span>${combiLast2}
            </div>`;

            // #1 class driver
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">#1 class</span>
                <span class="challenge-stats-value">${renderDriverHtml(stats.topDriver, stats.topCountry, stats.topRank)}</span>
            </div>`;

            // #1 combined driver
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">#1 ${escapeHtml(superclass)}</span>
                <span class="challenge-stats-value">${renderDriverHtml(combinedStats.topDriver, combinedStats.topCountry, combinedStats.topRank)}</span>
            </div>`;

            rows += `<div class="challenge-stats-row challenge-stats-row--link">
                <a class="challenge-stats-detail-link" href="${escapeHtml(detailHref)}">Class leaderboard →</a>
                <a class="challenge-stats-detail-link" href="${escapeHtml(combiDetailHref)}">Combined leaderboard →</a>
            </div>`;
        } else if (stats) {
            // Single-class view (no combined)
            const singleLast = stats.count > 1 ? `
                <span class="challenge-stats-label">Last</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--last">${escapeHtml(formatLapTime(stats.worstTime))}</span>` : '';
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">Entries</span>
                <span class="challenge-stats-value">${stats.count}</span>
                <span class="challenge-stats-label">Best</span>
                <span class="challenge-stats-value challenge-stats-time challenge-stats-time--best">${escapeHtml(formatLapTime(stats.bestTime))}</span>${singleLast}
            </div>`;
            rows += `<div class="challenge-stats-row">
                <span class="challenge-stats-label">#1</span>
                <span class="challenge-stats-value">${renderDriverHtml(stats.topDriver, stats.topCountry, stats.topRank)}</span>
            </div>`;
            rows += `<div class="challenge-stats-row challenge-stats-row--link">
                <a class="challenge-stats-detail-link" href="${escapeHtml(detailHref)}">View full leaderboard →</a>
            </div>`;
        }

        return `<div class="challenge-track-stats">${rows}</div>`;
    }

    async function showTrackStats(trackId, classId) {
        if (!trackStatsContainer) return;
        if (currentMode !== MODE_BOTH || !trackId || !classId) {
            trackStatsContainer.innerHTML = '';
            return;
        }
        trackStatsContainer.innerHTML = '<div class="challenge-stats-loading">Loading stats…</div>';

        // Fetch single-class stats
        const entries = await fetchLeaderboard(trackId, classId);
        const stats = buildTrackStats(entries);
        if (!stats) {
            trackStatsContainer.innerHTML = '';
            return;
        }

        // If grouped by category, also fetch combined stats
        const showCombinedOnly = groupByCategory && lastPickedSuperclass && carGranularity === GRANULARITY_CLASS;
        let combinedStats = null;
        if (groupByCategory && lastPickedSuperclass) {
            if (!showCombinedOnly) {
                trackStatsContainer.innerHTML = renderTrackStatsHtml(stats, trackId, classId)
                    + '<div class="challenge-stats-loading">Loading combined stats…</div>';
            }
            try {
                const classSpecs = getCategoryClassSpecs(lastPickedSuperclass);
                if (classSpecs.length > 1 && window.dataService) {
                    const combined = await window.dataService.buildCombinedLeaderboard(trackId, classSpecs);
                    combinedStats = buildCombinedStats(combined);
                }
            } catch (_) { /* ignore */ }
        }

        trackStatsContainer.innerHTML = renderTrackStatsHtml(stats, trackId, classId, combinedStats, lastPickedSuperclass, showCombinedOnly);
    }

    /* ── toggle helpers ───────────────────────────────────── */

    function activateButton(buttons, activeBtn) {
        buttons.forEach(btn => {
            btn.classList.toggle('is-active', btn === activeBtn);
            btn.setAttribute('aria-checked', btn === activeBtn ? 'true' : 'false');
        });
    }

    function updatePickerVisibility() {
        carPicker.classList.toggle('challenge-picker--hidden', currentMode === MODE_TRACK);
        trackPicker.classList.toggle('challenge-picker--hidden', currentMode === MODE_CAR);
        const filtersEl = document.getElementById('challenge-filters');
        if (filtersEl) {
            filtersEl.classList.toggle('challenge-filters--hidden', currentMode === MODE_TRACK);
        }
    }

    /* ── rendering ────────────────────────────────────────── */

    function renderCarClassResult(result, showSpecificClass) {
        if (!result) return '<span>No car data available</span>';

        // When grouped by category and the pick has a superclass, show category with all class logos
        if (groupByCategory && result.superclass) {
            return renderCategoryClassResult(result, showSpecificClass);
        }

        const logo = result.classLogo
            ? `<img class="challenge-result-class__logo" src="${escapeHtml(result.classLogo)}" alt="${escapeHtml(result.className)} logo" loading="lazy">`
            : '';
        return `<div class="challenge-result-class">${logo}<span>${escapeHtml(result.className)}</span></div>`;
    }

    function renderCategoryClassResult(result, showSpecificClass) {
        const rawCarsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
        const classesInCategory = rawCarsData
            .filter(entry => (entry.superclass || '') === result.superclass)
            .map(entry => entry.class || '');
        const uniqueClasses = [...new Set(classesInCategory)];

        const ROW_SIZE = 6;
        let logosHtml = '<div class="challenge-category-logos">';
        for (let i = 0; i < uniqueClasses.length; i++) {
            if (i > 0 && i % ROW_SIZE === 0) {
                logosHtml += '<span class="challenge-category-break"></span>';
            }
            const logo = resolveClassLogo(uniqueClasses[i]);
            if (logo) {
                logosHtml += `<img class="challenge-category-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(uniqueClasses[i])} logo" title="${escapeHtml(uniqueClasses[i])}" loading="lazy" decoding="async">`;
            }
        }
        logosHtml += '</div>';
        const displayName = showSpecificClass && result.className && result.className !== result.superclass
            ? `${result.className} - ${result.superclass}`
            : result.superclass;
        return `<div class="challenge-result-class challenge-result-category"><span>${escapeHtml(displayName)}</span>${logosHtml}</div>`;
    }

    function renderCarResult(result) {
        if (!result) return '<span>No car data available</span>';
        let html = renderCarClassResult(result, true);
        if (!result.carName) return html;

        const car = result.carData || {};
        const CU = window.R3ECarUtils || {};
        const wbFn = CU.wheelBadge || (() => '');
        const tbFn = CU.transBadge || (() => '');
        const dbFn = CU.driveBadge || (() => '');

        const flag = (typeof FlagHelper !== 'undefined' && FlagHelper.countryToFlag)
            ? FlagHelper.countryToFlag(car.country || '') : '';
        const flagHtml = flag ? `<span class="car-tile-flag-overlay">${flag}</span>` : '';

        // Rating
        let ratingHtml = '';
        if (typeof CarRatings !== 'undefined' && CU.buildRatingHtml) {
            const carId = CarRatings.buildCarId(car);
            const currentRating = CarRatings.get(carId) || 0;
            ratingHtml = CU.buildRatingHtml(carId, currentRating, 'tile');
        }

        const carNameHtml = CU.renderCarDisplayHtml
            ? CU.renderCarDisplayHtml(result.carName, { className: 'cars-page-car-name cars-page-car-name-tile' })
            : escapeHtml(result.carName);

        const carLink = car.link || '';
        const carNameWrapped = carLink
            ? `<a class="challenge-car-link" href="${escapeHtml(carLink)}" target="_blank" rel="noopener noreferrer">${carNameHtml}</a>`
            : carNameHtml;

        const imageUrl = escapeHtml(result.thumbnail || '');
        const carNameAttr = escapeHtml(result.carName);
        const yearColor = CU.yearBadgeColor ? CU.yearBadgeColor(car.year) : '#e0e0e0';
        const yearHtml = car.year
            ? `<span class="car-tile-year-overlay car-badge year-badge" style="background:${yearColor}">${escapeHtml(car.year)}</span>`
            : '';

        // Assists
        const assistBadges = [
            car.TC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--tc">TC</span>' : '',
            car.ABS === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--abs">ABS</span>' : '',
            car.LC === 'true' ? '<span class="car-tile-assist-badge car-tile-assist--lc">Launch Control</span>' : ''
        ].filter(Boolean).join('');
        const assistsHtml = assistBadges ? `<div class="car-tile-assists-row">${assistBadges}</div>` : '';

        const weightDisplay = (car.weight || '—').replace(/kg\*$/, 'kg with driver');

        const classLogoHtml = (groupByCategory && result.superclass && result.classLogo)
            ? `<img class="challenge-car-class-logo" src="${escapeHtml(result.classLogo)}" alt="${escapeHtml(result.className)} logo" title="${escapeHtml(result.className)}" loading="lazy" decoding="async">`
            : '';

        html += `<article class="car-tile challenge-car-tile">
          <div class="car-tile-link">
            <div class="car-tile-name">${classLogoHtml}${carNameWrapped}</div>
            ${imageUrl ? `<div class="car-tile-image-wrap">
              <div class="car-tile-top-row">${flagHtml}${ratingHtml}</div>
              ${assistsHtml}
              <img class="car-tile-image" src="${imageUrl}" alt="${carNameAttr}" loading="lazy" decoding="async">
              ${yearHtml}
            </div>` : ''}
          </div>
          <div class="car-tile-meta">
            <span>${wbFn(car.wheel_cat)}</span>
            <span>${tbFn(car.transmission_cat)}</span>
            <span>${dbFn(car.drive)}</span>
            <div class="car-tile-specs">${escapeHtml(car.power || '—')} • ${escapeHtml(weightDisplay)} • ${escapeHtml(car.engine || '—')}</div>
          </div>
        </article>`;
        return html;
    }

    function renderTrackResult(result) {
        if (!result) return '<span>No track data available</span>';
        const logo = result.trackLogo
            ? `<img class="challenge-result-track__logo" src="${escapeHtml(result.trackLogo)}" alt="${escapeHtml(result.trackBase)} logo" loading="lazy">`
            : '';
        const meta = window.TRACKS_META && window.TRACKS_META[result.trackBase];
        const nameHtml = meta && meta.url
            ? `<a class="challenge-track-link" href="${escapeHtml(meta.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.trackBase)}</a>`
            : `<span>${escapeHtml(result.trackBase)}</span>`;
        let html = `<div class="challenge-result-track">${logo}${nameHtml}</div>`;
        if (result.layoutLabel) {
            html += `<div class="challenge-result-layout"><span class="track-layout">${escapeHtml(result.layoutLabel)}</span></div>`;
        }
        if (meta && meta.description) {
            html += `<div class="challenge-track-description">${escapeHtml(meta.description)}</div>`;
        }
        return html;
    }

    function animateResult(container, html) {
        container.classList.remove(SPIN_CLASS);
        container.innerHTML = html;
        // Force reflow so re-adding the class triggers the animation
        void container.offsetWidth;
        container.classList.add(SPIN_CLASS);
    }

    /* ── pick action ──────────────────────────────────────── */

    function attachCarHandlers() {
        if (window.R3ECarUtils && window.R3ECarUtils.attachBrandLogoHandlers) {
            window.R3ECarUtils.attachBrandLogoHandlers(carResult);
        }
    }

    function doPickCar() {
        const rawCarsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
        const svc = window.ChallengePickerService;
        const rng = Math.random;
        const filters = { era: filterEra, wheel: filterWheel, trans: filterTrans, rating: filterRating };
        let carsData = svc.filterCarsData(rawCarsData, filters);
        carsData = getExcludedCarsFilter(carsData);

        if (carsData.length === 0) {
            carClassHtml = '<span>No cars match the current filters</span>';
            carDetailHtml = '';
            lastCarClassResult = null;
            lastCarPickResult = null;
            lastPickedClassName = null;
            lastPickedSuperclass = null;
        } else {
            const pickOpts = groupByCategory ? { groupByCategory: true } : undefined;
            // Always pick a full car result (class + car)
            const result = svc.pickCar(carsData, resolveClassLogo, resolveBrandLogo, rng, pickOpts);
            lastCarClassResult = result ? { className: result.className, classLogo: result.classLogo } : null;
            lastCarPickResult = result;
            lastPickedClassName = result ? result.className : null;
            lastPickedSuperclass = result ? result.superclass : null;
            carClassHtml = renderCarClassResult(result);
            carDetailHtml = renderCarResult(result);
        }

        const html = carGranularity === GRANULARITY_CAR ? carDetailHtml || carClassHtml : carClassHtml;
        animateResult(carResult, html);
        attachCarHandlers();
    }

    function doPickTrack(validTrackIds) {
        let tracksData = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        tracksData = filterTracksWithExclusions(tracksData);
        if (validTrackIds) {
            tracksData = tracksData.filter(t => validTrackIds.has(String(t.id)));
        }
        const svc = window.ChallengePickerService;
        const rng = Math.random;

        // Always pick a full layout result (base + layout)
        const result = svc.pickLayout(tracksData, resolveTrackLogo, rng);
        lastTrackBaseResult = result ? { trackBase: result.trackBase, trackLogo: result.trackLogo } : null;
        lastPickedLayoutId = result ? result.layoutId : null;
        trackBaseHtml = renderTrackResult(lastTrackBaseResult);
        trackLayoutHtml = renderTrackResult(result);

        const html = trackGranularity === GRANULARITY_LAYOUT ? trackLayoutHtml : trackBaseHtml;
        animateResult(trackResult, html);
    }

    function doPick() {
        if (isHardcoreLocked()) return;

        if (currentMode !== MODE_TRACK) {
            doPickCar();
        }
        if (currentMode !== MODE_CAR) {
            // Filter tracks to those with entries for the picked class
            const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
            const validIds = (currentMode === MODE_BOTH) ? getValidTracksForClass(classId) : null;
            doPickTrack(validIds);
        }
        updateRepickButtons();

        // Show track stats when we have both a car class and a track
        const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
        if (lastPickedLayoutId && classId) {
            showTrackStats(lastPickedLayoutId, classId);
        } else if (trackStatsContainer) {
            trackStatsContainer.innerHTML = '';
        }

        if (hardcoreMode) {
            activateHardcoreLock();
        }

        // Analytics
        if (window.R3EAnalytics) {
            R3EAnalytics.track('challenge pick clicked', {
                mode: currentMode,
                car_granularity: carGranularity,
                track_granularity: trackGranularity,
                group_by_category: groupByCategory,
                hardcore: hardcoreMode,
                picked_class: lastPickedClassName || '',
                picked_superclass: lastPickedSuperclass || '',
                picked_track: lastTrackBaseResult ? lastTrackBaseResult.trackBase : '',
                picked_layout_id: lastPickedLayoutId || '',
                exclusions: totalExclusions()
            });
        }
    }

    /* ── hardcore lockout ─────────────────────────────────── */

    function isHardcoreLocked() {
        const until = ssGet('hardcore-until');
        if (!until) return false;
        return Date.now() < Number(until);
    }

    function hardcoreRemainingMs() {
        const until = ssGet('hardcore-until');
        if (!until) return 0;
        return Math.max(0, Number(until) - Date.now());
    }

    function activateHardcoreLock() {
        const until = Date.now() + HARDCORE_LOCKOUT_MS;
        ssSet('hardcore-until', until);
        ssSet('hardcore-car-html', carResult.innerHTML);
        ssSet('hardcore-track-html', trackResult.innerHTML);
        ssSet('hardcore-mode', currentMode);
        applyHardcoreLockUI();
    }

    function applyHardcoreLockUI() {
        pickBtn.classList.add('challenge-pick-btn--locked');
        if (repickCarBtn) repickCarBtn.disabled = true;
        if (repickTrackBtn) repickTrackBtn.disabled = true;
        if (hardcoreCb) hardcoreCb.disabled = true;

        const remaining = hardcoreRemainingMs();
        if (remaining > 0) {
            updateLockTimer();
        }
    }

    function updateLockTimer() {
        const remaining = hardcoreRemainingMs();
        if (remaining <= 0) {
            clearHardcoreLock();
            return;
        }
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        pickBtn.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        setTimeout(updateLockTimer, 1000);
    }

    function clearHardcoreLock() {
        ssRemove('hardcore-until');
        ssRemove('hardcore-car-html');
        ssRemove('hardcore-track-html');
        ssRemove('hardcore-mode');
        pickBtn.classList.remove('challenge-pick-btn--locked', 'challenge-pick-btn--hardcore');
        pickBtn.textContent = 'Pick!';
        if (hardcoreCb) {
            hardcoreCb.checked = false;
            hardcoreCb.disabled = false;
        }
        if (hardcoreLabel) hardcoreLabel.classList.remove('is-active');
        hardcoreMode = false;
        updateRepickButtons();
    }

    function restoreHardcorePick() {
        if (!isHardcoreLocked()) return false;
        const savedMode = ssGet('hardcore-mode') || MODE_BOTH;
        const savedCarHtml = ssGet('hardcore-car-html') || '';
        const savedTrackHtml = ssGet('hardcore-track-html') || '';

        currentMode = savedMode;
        // Activate the matching mode button
        modeButtons.forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.mode === savedMode);
            btn.setAttribute('aria-checked', btn.dataset.mode === savedMode ? 'true' : 'false');
        });
        updatePickerVisibility();

        if (savedCarHtml) carResult.innerHTML = savedCarHtml;
        if (savedTrackHtml) trackResult.innerHTML = savedTrackHtml;
        attachCarHandlers();

        hardcoreMode = true;
        if (hardcoreCb) hardcoreCb.checked = true;
        if (hardcoreLabel) hardcoreLabel.classList.add('is-active');
        pickBtn.classList.add('challenge-pick-btn--hardcore');
        applyHardcoreLockUI();
        return true;
    }

    /* ── granularity toggle (show/hide only) ──────────────── */

    function refineCarGranularity(newGranularity) {
        if (newGranularity === carGranularity) return;
        carGranularity = newGranularity;

        // Only swap if we have cached results
        if (!carClassHtml || !carResult.innerHTML.trim()) return;

        const html = newGranularity === GRANULARITY_CAR ? (carDetailHtml || carClassHtml) : carClassHtml;
        animateResult(carResult, html);
        attachCarHandlers();

        // Refresh track stats to reflect combined-only vs full view
        const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
        if (lastPickedLayoutId && classId) {
            showTrackStats(lastPickedLayoutId, classId);
        }
    }

    function refineTrackGranularity(newGranularity) {
        if (newGranularity === trackGranularity) return;
        trackGranularity = newGranularity;

        // Only swap if we have cached results
        if (!trackBaseHtml || !trackResult.innerHTML.trim()) return;

        const html = newGranularity === GRANULARITY_LAYOUT ? trackLayoutHtml : trackBaseHtml;
        animateResult(trackResult, html);
    }

    /* ── re-pick buttons ──────────────────────────────────── */

    function updateRepickButtons() {
        if (repickCarBtn) {
            repickCarBtn.disabled = !lastCarClassResult || currentMode === MODE_TRACK;
        }
        if (repickTrackBtn) {
            repickTrackBtn.disabled = !lastTrackBaseResult || currentMode === MODE_CAR;
        }
    }

    function repickCar() {
        if (!repickCarBtn || repickCarBtn.disabled) return;
        doPickCar();
        repickCarBtn.disabled = true;

        const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
        // If current track has no entries for the new class, repick track too
        const validIds = getValidTracksForClass(classId);
        if (validIds && lastPickedLayoutId && !validIds.has(String(lastPickedLayoutId))) {
            doPickTrack(validIds);
        }

        // Refresh track stats
        const cid = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
        if (lastPickedLayoutId && cid) {
            showTrackStats(lastPickedLayoutId, cid);
        } else if (trackStatsContainer) {
            trackStatsContainer.innerHTML = '';
        }
    }

    function repickTrack() {
        if (!repickTrackBtn || repickTrackBtn.disabled) return;
        // Filter tracks to those with entries for the current class
        const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
        const validIds = getValidTracksForClass(classId);
        doPickTrack(validIds);
        repickTrackBtn.disabled = true;
        // Refresh track stats with new track
        if (lastPickedLayoutId && classId) {
            showTrackStats(lastPickedLayoutId, classId);
        } else if (trackStatsContainer) {
            trackStatsContainer.innerHTML = '';
        }
    }

    /* ── filter definitions ───────────────────────────────── */

    function wb(cat) { return window.R3ECarUtils ? window.R3ECarUtils.wheelBadge(cat) : cat; }
    function tb(cat) { return window.R3ECarUtils ? window.R3ECarUtils.transBadge(cat) : cat; }

    const ERA_OPTIONS = [
        { value: '', label: 'All years' },
        { value: 'oldies', label: 'Oldies (1969–1999)' },
        { value: 'recent', label: 'Recent (2000–2015)' },
        { value: 'modern', label: 'Modern (2016-2026)' }
    ];

    const WHEEL_OPTIONS = [
        { value: '', label: 'All wheels' },
        { value: 'gt', label: 'GT', labelHtml: wb('gt') },
        { value: 'round', label: 'Round', labelHtml: wb('round') },
        { value: 'round flat', label: 'Round flat', labelHtml: wb('round flat') },
        { value: 'round_and_roundflat', label: 'Round & Round flat', labelHtml: `${wb('round')} + ${wb('round flat')}` }
    ];

    const TRANS_OPTIONS = [
        { value: '', label: 'All transmissions' },
        { value: 'paddles', label: 'Paddles', labelHtml: tb('paddles') },
        { value: 'sequential', label: 'Sequential', labelHtml: tb('sequential') },
        { value: 'h', label: 'H', labelHtml: tb('h') }
    ];

    function ratingLabel(stars, options) {
        const heart = (options && options.heart)
            ? '<span class="cars-rating-filter-heart">♥</span>'
            : '';
        return `<span class="cars-rating-filter-label"><span class="cars-rating-filter-symbols">${stars}${heart}</span></span>`;
    }

    const RATING_OPTIONS = [
        { value: '', label: 'All ratings' },
        { value: '0', label: 'Unrated', labelHtml: ratingLabel('☆') },
        { value: '1', label: '1+ stars', labelHtml: ratingLabel('★+') },
        { value: '2', label: '2+ stars', labelHtml: ratingLabel('★★+') },
        { value: '3', label: '3+ stars', labelHtml: ratingLabel('★★★+') },
        { value: '4', label: '4+ stars', labelHtml: ratingLabel('★★★★+') },
        { value: '5', label: '5 stars', labelHtml: ratingLabel('★★★★★+') },
        { value: '6', label: 'Favorites', labelHtml: ratingLabel('★★★★★', { heart: true }) }
    ];

    function initFilters() {
        if (typeof CustomSelect !== 'function') return;

        new CustomSelect('challenge-era-filter', ERA_OPTIONS, (v) => {
            filterEra = v;
        }, { searchable: false });

        new CustomSelect('challenge-wheel-filter', WHEEL_OPTIONS, (v) => {
            filterWheel = v;
        }, { searchable: false });

        new CustomSelect('challenge-trans-filter', TRANS_OPTIONS, (v) => {
            filterTrans = v;
        }, { searchable: false });

        new CustomSelect('challenge-rating-filter', RATING_OPTIONS, (v) => {
            filterRating = v;
        }, { searchable: false });
    }

    /* ── exclusions ───────────────────────────────────────── */

    let excludedTracks = new Set();   // track base names
    let excludedClasses = new Set();  // class names
    let excludedCars = new Set();     // "ClassName|||CarName" compound keys

    const EXCL_MIN_TRACKS = 10;
    const EXCL_MIN_CLASSES = 10;

    function loadExclusions() {
        excludedTracks = new Set();
        excludedClasses = new Set();
        excludedCars = new Set();
        try {
            const t = ssGet('excl-tracks');
            if (t) excludedTracks = new Set(JSON.parse(t));
            const c = ssGet('excl-classes');
            if (c) excludedClasses = new Set(JSON.parse(c));
            const cr = ssGet('excl-cars');
            if (cr) excludedCars = new Set(JSON.parse(cr));
        } catch (_) { /* ignore corrupt data */ }
    }

    function saveExclusions() {
        ssSet('excl-tracks', JSON.stringify([...excludedTracks]));
        ssSet('excl-classes', JSON.stringify([...excludedClasses]));
        ssSet('excl-cars', JSON.stringify([...excludedCars]));
        updateExclusionBadge();
        updateExclusionLimits();
    }

    function totalExclusions() {
        return excludedTracks.size + excludedClasses.size + excludedCars.size;
    }

    function updateExclusionBadge() {
        const badge = document.getElementById('challenge-exclusions-badge');
        if (!badge) return;
        const count = totalExclusions();
        badge.textContent = count > 0 ? `(${count})` : '';
        const resetBtn = document.getElementById('challenge-exclusions-reset');
        if (resetBtn) resetBtn.hidden = count === 0;
    }

    /**
     * Enforce minimum remaining tracks/classes by disabling unchecked
     * checkboxes when the limit is reached.
     */
    function updateExclusionLimits() {
        const tracksContainer = document.getElementById('challenge-exclusions-tracks');
        const carsContainer = document.getElementById('challenge-exclusions-cars');
        if (!tracksContainer || !carsContainer) return;

        // Count totals — only enforce limit when there are more items than the minimum
        const totalTracks = tracksContainer.querySelectorAll('.challenge-exclusions__item').length;
        const remainingTracks = totalTracks - excludedTracks.size;
        const atTrackLimit = totalTracks > EXCL_MIN_TRACKS && remainingTracks <= EXCL_MIN_TRACKS;

        tracksContainer.querySelectorAll('.challenge-exclusions__item input[type="checkbox"]').forEach(cb => {
            cb.disabled = atTrackLimit && !cb.checked;
        });

        const totalClasses = carsContainer.querySelectorAll('.challenge-exclusions__class').length;
        const remainingClasses = totalClasses - excludedClasses.size;
        const atClassLimit = totalClasses > EXCL_MIN_CLASSES && remainingClasses <= EXCL_MIN_CLASSES;

        carsContainer.querySelectorAll('.challenge-exclusions__class').forEach(classDiv => {
            const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
            if (classCb) classCb.disabled = atClassLimit && !classCb.checked;
            // Also disable individual car checkboxes if class limit reached and class isn't excluded
            if (atClassLimit && classCb && !classCb.checked) {
                classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]').forEach(carCb => {
                    carCb.disabled = true;
                });
            } else {
                classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]').forEach(carCb => {
                    carCb.disabled = false;
                });
            }
        });
    }

    function resetExclusions() {
        excludedTracks.clear();
        excludedClasses.clear();
        excludedCars.clear();
        saveExclusions();

        // Reset all checkboxes in the UI
        const tracksContainer = document.getElementById('challenge-exclusions-tracks');
        if (tracksContainer) {
            tracksContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.disabled = false; });
            tracksContainer.querySelectorAll('.challenge-exclusions__item--excluded').forEach(el => el.classList.remove('challenge-exclusions__item--excluded'));
        }
        const carsContainer = document.getElementById('challenge-exclusions-cars');
        if (carsContainer) {
            carsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.disabled = false; cb.indeterminate = false; });
            carsContainer.querySelectorAll('.challenge-exclusions__class-header--excluded').forEach(el => el.classList.remove('challenge-exclusions__class-header--excluded'));
            carsContainer.querySelectorAll('.challenge-exclusions__car-item--excluded').forEach(el => el.classList.remove('challenge-exclusions__car-item--excluded'));
        }
    }

    function getExcludedTracksData() {
        // Filter TRACKS_DATA removing excluded base tracks
        if (excludedTracks.size === 0) return null; // null = no filtering
        return excludedTracks;
    }

    function getExcludedCarsFilter(carsData) {
        // Returns filtered carsData with excluded classes/cars removed
        if (excludedClasses.size === 0 && excludedCars.size === 0) return carsData;
        if (!Array.isArray(carsData)) return carsData;

        const result = [];
        for (const classEntry of carsData) {
            const className = classEntry.class || '';
            if (excludedClasses.has(className)) continue;

            // Filter individual cars
            if (excludedCars.size > 0) {
                const cars = Array.isArray(classEntry.cars) ? classEntry.cars : [];
                const filtered = cars.filter(car => {
                    const key = className + '|||' + (car.car || '');
                    return !excludedCars.has(key);
                });
                if (filtered.length === 0) continue;
                if (filtered.length !== cars.length) {
                    result.push({ ...classEntry, cars: filtered });
                    continue;
                }
            }
            result.push(classEntry);
        }
        return result;
    }

    function filterTracksWithExclusions(tracksData) {
        if (excludedTracks.size === 0) return tracksData;
        return tracksData.filter(entry => {
            const label = entry.label || '';
            const sepIdx = label.indexOf(' - ');
            const base = sepIdx !== -1 ? label.substring(0, sepIdx).trim() : label.trim();
            return !excludedTracks.has(base);
        });
    }

    function buildExclusionsPanel() {
        const tracksContainer = document.getElementById('challenge-exclusions-tracks');
        const carsContainer = document.getElementById('challenge-exclusions-cars');
        if (!tracksContainer || !carsContainer) return;

        // ── Build tracks list ──
        const tracksData = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        const svc = window.ChallengePickerService;
        const grouped = svc ? svc.groupTracksByBase(tracksData) : new Map();
        const baseNames = Array.from(grouped.keys()).sort();

        let tracksHtml = '';
        for (const base of baseNames) {
            const layouts = grouped.get(base);
            const logoLabel = layouts[0]?.label || base;
            const logoUrl = resolveTrackLogo(logoLabel);
            const checked = excludedTracks.has(base) ? 'checked' : '';
            const excludedCls = excludedTracks.has(base) ? ' challenge-exclusions__item--excluded' : '';
            const logoImg = logoUrl
                ? `<img class="challenge-exclusions__item-logo" src="${escapeHtml(logoUrl)}" alt="" loading="lazy" decoding="async">`
                : '';
            tracksHtml += `<label class="challenge-exclusions__item${excludedCls}" data-track="${escapeHtml(base)}">
                <input type="checkbox" ${checked}>
                ${logoImg}
                <span class="challenge-exclusions__item-label">${escapeHtml(base)}</span>
            </label>`;
        }
        tracksContainer.innerHTML = tracksHtml;

        tracksContainer.addEventListener('change', (e) => {
            const cb = e.target;
            if (cb.type !== 'checkbox') return;
            const item = cb.closest('.challenge-exclusions__item');
            if (!item) return;
            const trackBase = item.dataset.track;
            if (cb.checked) {
                excludedTracks.add(trackBase);
                item.classList.add('challenge-exclusions__item--excluded');
            } else {
                excludedTracks.delete(trackBase);
                item.classList.remove('challenge-exclusions__item--excluded');
            }
            saveExclusions();
        });

        // ── Build car classes list ──
        const carsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
        const SKIP_CLASSES = ['Safety Car', 'Shopping Cart'];
        const sortedClasses = carsData
            .filter(entry => !SKIP_CLASSES.includes(entry.class || ''))
            .sort((a, b) => (a.class || '').localeCompare(b.class || ''));

        let carsHtml = '';
        for (const classEntry of sortedClasses) {
            const className = classEntry.class || '';
            const classLogo = classEntry.logo || resolveClassLogo(className);
            const classChecked = excludedClasses.has(className) ? 'checked' : '';
            const classExcludedCls = excludedClasses.has(className) ? ' challenge-exclusions__class-header--excluded' : '';

            const logoImg = classLogo
                ? `<img class="challenge-exclusions__class-logo" src="${escapeHtml(classLogo)}" alt="" loading="lazy" decoding="async">`
                : '';

            const cars = Array.isArray(classEntry.cars) ? classEntry.cars : [];
            const isSingle = cars.length <= 1;
            const singleCls = isSingle ? ' challenge-exclusions__class--single' : '';

            let carsListHtml = '';
            if (!isSingle) {
                for (const car of cars) {
                    const carName = car.car || '';
                    const carKey = className + '|||' + carName;
                    const carChecked = excludedCars.has(carKey) ? 'checked' : '';
                    const carExcludedCls = excludedCars.has(carKey) ? ' challenge-exclusions__car-item--excluded' : '';
                    carsListHtml += `<label class="challenge-exclusions__car-item${carExcludedCls}" data-car-key="${escapeHtml(carKey)}">
                    <input type="checkbox" ${carChecked}>
                    <span class="challenge-exclusions__car-label">${escapeHtml(carName)}</span>
                </label>`;
                }
            }

            carsHtml += `<div class="challenge-exclusions__class${singleCls}" data-class="${escapeHtml(className)}">
                <div class="challenge-exclusions__class-header${classExcludedCls}">
                    <input type="checkbox" class="challenge-exclusions__class-cb" ${classChecked}>
                    <span class="challenge-exclusions__class-arrow">&#9654;</span>
                    ${logoImg}
                    <span class="challenge-exclusions__class-name">${escapeHtml(className)}</span>
                </div>
                ${carsListHtml ? `<div class="challenge-exclusions__cars">${carsListHtml}</div>` : ''}
            </div>`;
        }
        carsContainer.innerHTML = carsHtml;

        // Set indeterminate state for classes with partial car exclusions
        carsContainer.querySelectorAll('.challenge-exclusions__class').forEach(classDiv => {
            const carCbs = classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]');
            if (carCbs.length === 0) return;
            const allChecked = Array.from(carCbs).every(c => c.checked);
            const anyChecked = Array.from(carCbs).some(c => c.checked);
            const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
            if (classCb && !allChecked && anyChecked) {
                classCb.indeterminate = true;
            }
        });

        // Event: toggle class expander or toggle checkbox for single-car classes
        carsContainer.addEventListener('click', (e) => {
            const header = e.target.closest('.challenge-exclusions__class-header');
            if (!header) return;
            // Don't handle when clicking the checkbox itself
            if (e.target.type === 'checkbox') return;
            const classDiv = header.closest('.challenge-exclusions__class');
            if (!classDiv) return;
            if (classDiv.classList.contains('challenge-exclusions__class--single')) {
                // Toggle the checkbox for single-car classes
                const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
                if (classCb && !classCb.disabled) {
                    classCb.checked = !classCb.checked;
                    classCb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                classDiv.classList.toggle('is-open');
            }
        });

        // Event: class checkbox
        carsContainer.addEventListener('change', (e) => {
            const cb = e.target;
            if (cb.type !== 'checkbox') return;

            // Class-level checkbox
            if (cb.classList.contains('challenge-exclusions__class-cb')) {
                const classDiv = cb.closest('.challenge-exclusions__class');
                if (!classDiv) return;
                const className = classDiv.dataset.class;
                const header = classDiv.querySelector('.challenge-exclusions__class-header');
                cb.indeterminate = false;
                if (cb.checked) {
                    excludedClasses.add(className);
                    if (header) header.classList.add('challenge-exclusions__class-header--excluded');
                    // Also check all car checkboxes in this class
                    classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]').forEach(carCb => {
                        carCb.checked = true;
                        const carItem = carCb.closest('.challenge-exclusions__car-item');
                        if (carItem) {
                            carItem.classList.add('challenge-exclusions__car-item--excluded');
                            excludedCars.add(carItem.dataset.carKey);
                        }
                    });
                } else {
                    excludedClasses.delete(className);
                    if (header) header.classList.remove('challenge-exclusions__class-header--excluded');
                    // Also uncheck all car checkboxes in this class
                    classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]').forEach(carCb => {
                        carCb.checked = false;
                        const carItem = carCb.closest('.challenge-exclusions__car-item');
                        if (carItem) {
                            carItem.classList.remove('challenge-exclusions__car-item--excluded');
                            excludedCars.delete(carItem.dataset.carKey);
                        }
                    });
                }
                saveExclusions();
                return;
            }

            // Car-level checkbox
            const carItem = cb.closest('.challenge-exclusions__car-item');
            if (carItem) {
                const carKey = carItem.dataset.carKey;
                if (cb.checked) {
                    excludedCars.add(carKey);
                    carItem.classList.add('challenge-exclusions__car-item--excluded');
                } else {
                    excludedCars.delete(carKey);
                    carItem.classList.remove('challenge-exclusions__car-item--excluded');
                }
                // Update class-level checkbox state (checked / indeterminate / unchecked)
                const classDiv = carItem.closest('.challenge-exclusions__class');
                if (classDiv) {
                    const allCarCbs = classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]');
                    const allChecked = Array.from(allCarCbs).every(c => c.checked);
                    const anyChecked = Array.from(allCarCbs).some(c => c.checked);
                    const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
                    const header = classDiv.querySelector('.challenge-exclusions__class-header');
                    if (classCb) {
                        classCb.checked = allChecked;
                        classCb.indeterminate = !allChecked && anyChecked;
                    }
                    if (allChecked) {
                        excludedClasses.add(classDiv.dataset.class);
                        if (header) header.classList.add('challenge-exclusions__class-header--excluded');
                    } else {
                        excludedClasses.delete(classDiv.dataset.class);
                        if (header) header.classList.remove('challenge-exclusions__class-header--excluded');
                    }
                }
                saveExclusions();
            }
        });

        updateExclusionBadge();
        updateExclusionLimits();
    }

    function initExclusions() {
        loadExclusions();

        const toggle = document.getElementById('challenge-exclusions-toggle');
        const container = document.getElementById('challenge-exclusions');
        if (!toggle || !container) return;

        // Reset built state so panel is rebuilt on next open
        delete container.dataset.built;
        container.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');

        toggle.addEventListener('click', (e) => {
            // Don't toggle when clicking the reset button
            if (e.target.closest('.challenge-exclusions__reset')) return;
            const isOpen = container.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            // Build panel on first open
            if (isOpen && !container.dataset.built) {
                buildExclusionsPanel();
                container.dataset.built = '1';
            }
        });

        const resetBtn = document.getElementById('challenge-exclusions-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resetExclusions();
            });
        }

        updateExclusionBadge();
    }

    /* ── init ─────────────────────────────────────────────── */

    function init() {
        const panel = document.getElementById('challenge-panel');
        if (!panel) return;

        // Reset state from DOM active buttons
        currentMode = MODE_BOTH;
        carGranularity = GRANULARITY_CLASS;
        trackGranularity = GRANULARITY_TRACK;
        filterEra = '';
        filterWheel = '';
        filterTrans = '';
        filterRating = '';
        lastCarClassResult = null;
        lastCarPickResult = null;
        lastTrackBaseResult = null;
        lastPickedClassName = null;
        lastPickedSuperclass = null;
        lastPickedLayoutId = null;
        carClassHtml = '';
        carDetailHtml = '';
        trackBaseHtml = '';
        trackLayoutHtml = '';
        groupByCategory = false;

        // Reset pick history so re-init doesn't carry stale state
        if (window.ChallengePickerService && window.ChallengePickerService.history) {
            window.ChallengePickerService.history.clear();
        }

        modeButtons = Array.from(panel.querySelectorAll('.challenge-mode-btn'));
        carGranularityButtons = Array.from(
            document.querySelector('#challenge-car-picker .challenge-picker__options')?.querySelectorAll('.challenge-granularity-btn') || []
        );
        trackGranularityButtons = Array.from(
            document.querySelector('#challenge-track-picker .challenge-picker__options')?.querySelectorAll('.challenge-granularity-btn') || []
        );
        carPicker = document.getElementById('challenge-car-picker');
        trackPicker = document.getElementById('challenge-track-picker');
        carResult = document.getElementById('challenge-car-result');
        trackResult = document.getElementById('challenge-track-result');
        pickBtn = document.getElementById('challenge-pick-btn');
        repickCarBtn = document.getElementById('repick-car-btn');
        repickTrackBtn = document.getElementById('repick-track-btn');
        trackStatsContainer = document.getElementById('challenge-track-stats');

        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (isHardcoreLocked()) return;
                currentMode = btn.dataset.mode;
                activateButton(modeButtons, btn);
                updatePickerVisibility();
                updateRepickButtons();
                ssSet('mode', currentMode);
                // Show/hide stats based on mode
                if (currentMode === MODE_BOTH) {
                    const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
                    if (lastPickedLayoutId && classId) {
                        showTrackStats(lastPickedLayoutId, classId);
                    }
                } else if (trackStatsContainer) {
                    trackStatsContainer.innerHTML = '';
                }
            });
        });

        carGranularityButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const newGranularity = btn.dataset.granularity;
                activateButton(carGranularityButtons, btn);
                refineCarGranularity(newGranularity);
                ssSet('car-gran', carGranularity);
            });
        });

        trackGranularityButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const newGranularity = btn.dataset.granularity;
                activateButton(trackGranularityButtons, btn);
                refineTrackGranularity(newGranularity);
                ssSet('track-gran', trackGranularity);
            });
        });

        pickBtn.addEventListener('click', doPick);
        if (repickCarBtn) repickCarBtn.addEventListener('click', repickCar);
        if (repickTrackBtn) repickTrackBtn.addEventListener('click', repickTrack);

        const groupCb = document.getElementById('challenge-group-category-cb');
        if (groupCb) {
            const stored = ssGet('group-cat');
            groupByCategory = stored === 'true';
            groupCb.checked = groupByCategory;
            groupCb.addEventListener('change', () => {
                groupByCategory = groupCb.checked;
                ssSet('group-cat', groupCb.checked);
                // Re-render current car display with updated grouping
                if (lastCarPickResult) {
                    carClassHtml = renderCarClassResult(lastCarPickResult);
                    carDetailHtml = renderCarResult(lastCarPickResult);
                    const html = carGranularity === GRANULARITY_CAR ? carDetailHtml || carClassHtml : carClassHtml;
                    animateResult(carResult, html);
                    attachCarHandlers();
                    // Refresh stats for new superclass state
                    const classId = lastPickedClassName ? resolveClassId(lastPickedClassName) : null;
                    if (lastPickedLayoutId && classId) {
                        showTrackStats(lastPickedLayoutId, classId);
                    }
                }
            });
        }

        hardcoreCb = document.getElementById('challenge-hardcore-cb');
        hardcoreLabel = document.getElementById('challenge-hardcore-label');
        const hardcoreInfo = document.getElementById('challenge-hardcore-info');
        if (hardcoreInfo) {
            hardcoreInfo.title = 'You will not be able to pick again for ' + HARDCORE_LOCKOUT_MINUTES + ' minutes';
        }
        if (hardcoreCb) {
            hardcoreCb.addEventListener('change', () => {
                hardcoreMode = hardcoreCb.checked;
                pickBtn.classList.toggle('challenge-pick-btn--hardcore', hardcoreMode);
                if (hardcoreLabel) hardcoreLabel.classList.toggle('is-active', hardcoreMode);
            });
        }

        initFilters();
        initExclusions();

        // Pre-load valid combinations index (async, non-blocking)
        loadCombinationsIndex();

        // Restore toggle states from session
        const savedMode = ssGet('mode');
        if (savedMode && [MODE_CAR, MODE_BOTH, MODE_TRACK].includes(savedMode)) {
            currentMode = savedMode;
            modeButtons.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.mode === savedMode);
                btn.setAttribute('aria-checked', btn.dataset.mode === savedMode ? 'true' : 'false');
            });
        }
        const savedCarGran = ssGet('car-gran');
        if (savedCarGran && [GRANULARITY_CLASS, GRANULARITY_CAR].includes(savedCarGran)) {
            carGranularity = savedCarGran;
            carGranularityButtons.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.granularity === savedCarGran);
                btn.setAttribute('aria-checked', btn.dataset.granularity === savedCarGran ? 'true' : 'false');
            });
        }
        const savedTrackGran = ssGet('track-gran');
        if (savedTrackGran && [GRANULARITY_TRACK, GRANULARITY_LAYOUT].includes(savedTrackGran)) {
            trackGranularity = savedTrackGran;
            trackGranularityButtons.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.granularity === savedTrackGran);
                btn.setAttribute('aria-checked', btn.dataset.granularity === savedTrackGran ? 'true' : 'false');
            });
        }

        updatePickerVisibility();

        // Restore hardcore lock if active
        if (!restoreHardcorePick()) {
            // No active lock — normal state
        }

        // Analytics
        if (window.R3EAnalytics) {
            R3EAnalytics.track('challenge page shown', {
                mode: currentMode,
                car_granularity: carGranularity,
                track_granularity: trackGranularity,
                group_by_category: groupByCategory,
                hardcore: hardcoreMode,
                exclusions: totalExclusions()
            });
        }
    }

    /* ── auto-start ───────────────────────────────────────── */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.ChallengePicker = { init, doPick };
})();
