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
    const HARDCORE_LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes
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
    let lastTrackBaseResult = null;  // { trackBase, trackLogo }

    // Cached rendered HTML for each granularity level
    let carClassHtml = '';
    let carDetailHtml = '';
    let trackBaseHtml = '';
    let trackLayoutHtml = '';

    let groupByCategory = false;
    let hardcoreMode = false;
    let hardcoreCb, hardcoreLabel;

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

    function renderCarClassResult(result) {
        if (!result) return '<span>No car data available</span>';

        // When grouped by category and the pick has a superclass, show category with all class logos
        if (groupByCategory && result.superclass) {
            return renderCategoryClassResult(result);
        }

        const logo = result.classLogo
            ? `<img class="challenge-result-class__logo" src="${escapeHtml(result.classLogo)}" alt="${escapeHtml(result.className)} logo" loading="lazy">`
            : '';
        return `<div class="challenge-result-class">${logo}<span>${escapeHtml(result.className)}</span></div>`;
    }

    function renderCategoryClassResult(result) {
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
                logosHtml += `<img class="challenge-category-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(uniqueClasses[i])} logo" loading="lazy" decoding="async">`;
            }
        }
        logosHtml += '</div>';
        return `<div class="challenge-result-class challenge-result-category"><span>${escapeHtml(result.superclass)}</span>${logosHtml}</div>`;
    }

    function renderCarResult(result) {
        if (!result) return '<span>No car data available</span>';
        let html = renderCarClassResult(result);
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

        html += `<article class="car-tile challenge-car-tile">
          <div class="car-tile-link">
            <div class="car-tile-name">${carNameWrapped}</div>
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
        if (window.R3ECarUtils && window.R3ECarUtils.attachRatingHandlers) {
            window.R3ECarUtils.attachRatingHandlers(carResult);
        }
        if (window.R3ECarUtils && window.R3ECarUtils.attachBrandLogoHandlers) {
            window.R3ECarUtils.attachBrandLogoHandlers(carResult);
        }
    }

    function doPickCar() {
        const rawCarsData = Array.isArray(window.CARS_DATA) ? window.CARS_DATA : [];
        const svc = window.ChallengePickerService;
        const rng = Math.random;
        const filters = { era: filterEra, wheel: filterWheel, trans: filterTrans, rating: filterRating };
        const carsData = svc.filterCarsData(rawCarsData, filters);

        if (carsData.length === 0) {
            carClassHtml = '<span>No cars match the current filters</span>';
            carDetailHtml = '';
            lastCarClassResult = null;
        } else {
            const pickOpts = groupByCategory ? { groupByCategory: true } : undefined;
            // Always pick a full car result (class + car)
            const result = svc.pickCar(carsData, resolveClassLogo, resolveBrandLogo, rng, pickOpts);
            lastCarClassResult = result ? { className: result.className, classLogo: result.classLogo } : null;
            carClassHtml = renderCarClassResult(result);
            carDetailHtml = renderCarResult(result);
        }

        const html = carGranularity === GRANULARITY_CAR ? carDetailHtml || carClassHtml : carClassHtml;
        animateResult(carResult, html);
        attachCarHandlers();
    }

    function doPickTrack() {
        const tracksData = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        const svc = window.ChallengePickerService;
        const rng = Math.random;

        // Always pick a full layout result (base + layout)
        const result = svc.pickLayout(tracksData, resolveTrackLogo, rng);
        lastTrackBaseResult = result ? { trackBase: result.trackBase, trackLogo: result.trackLogo } : null;
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
            doPickTrack();
        }
        updateRepickButtons();

        if (hardcoreMode) {
            activateHardcoreLock();
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
    }

    function repickTrack() {
        if (!repickTrackBtn || repickTrackBtn.disabled) return;
        doPickTrack();
        repickTrackBtn.disabled = true;
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
        lastTrackBaseResult = null;
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

        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (isHardcoreLocked()) return;
                currentMode = btn.dataset.mode;
                activateButton(modeButtons, btn);
                updatePickerVisibility();
                updateRepickButtons();
                ssSet('mode', currentMode);
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
            });
        }

        hardcoreCb = document.getElementById('challenge-hardcore-cb');
        hardcoreLabel = document.getElementById('challenge-hardcore-label');
        if (hardcoreCb) {
            hardcoreCb.addEventListener('change', () => {
                hardcoreMode = hardcoreCb.checked;
                pickBtn.classList.toggle('challenge-pick-btn--hardcore', hardcoreMode);
            });
        }

        initFilters();

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
    }

    /* ── auto-start ───────────────────────────────────────── */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.ChallengePicker = { init, doPick };
})();
