(function () {
    const FILTER_ROOT_ID = 'records-class-filter-ui';
    const TABLES_ROOT_ID = 'records-tables';
    const COLLAPSED_ROWS = 3;
    const PAGE_SIZE = 50;      // rows shown per expanded page
    const MAX_FETCH_ROWS = 500; // rows fetched upfront for pagination

    // Single source of truth for the 4 record sections, in display order.
    // Each entry maps to a key understood by StatsData.METRIC_DEFINITIONS plus UI-specific labels.
    const RECORD_SECTIONS = [
        {
            key: 'avg_bested',
            titleBuilder: (label) => `Top Drivers by Average Bested % (${label})`,
            infoText: 'Average percentage of opponents beaten per leaderboard entry. Higher is better. Overall: min 5 entries and 100 bested drivers. Class filter: min 2 entries.',
            valueTitle: 'Avg %',
            valueFormatter: (value) => Number.isFinite(value) ? value.toFixed(1) + '%' : '0.0%',
            // Returns the row predicate appropriate for the active filter.
            // Overall (no filter): strict thresholds to exclude low-volume drivers.
            // Class filter active: relaxed to min 2 entries since class pools are smaller.
            preFilter: (filterValue) => !filterValue
                ? (row) => (row.entries || 0) >= 5 && (row.bested_drivers || 0) >= 100
                : (row) => (row.entries || 0) >= 2,
            containerId: 'records-avg-bested-table',
            titleId: 'records-avg-bested-title'
        },
        {
            key: 'bested',
            titleBuilder: (label) => `Top Drivers by Bested Drivers (${label})`,
            infoText: 'Total number of opponents a driver has outperformed across leaderboard entries. Higher is better.',
            valueTitle: 'Bested',
            containerId: 'records-bested-table',
            titleId: 'records-bested-title'
        },
        {
            key: 'pole',
            titleBuilder: (label) => `Top Drivers by Pole Positions (${label})`,
            infoText: 'Count of entries where the driver qualified or finished in P1. Higher is better.',
            valueTitle: 'Poles',
            containerId: 'records-pole-table',
            titleId: 'records-pole-title'
        },
        {
            key: 'podium',
            titleBuilder: (label) => `Top Drivers by Podiums (${label})`,
            infoText: 'Count of entries where the driver finished in the top 3 positions. Higher is better.',
            valueTitle: 'Podiums',
            containerId: 'records-podium-table',
            titleId: 'records-podium-title'
        },
        {
            key: 'entries',
            titleBuilder: (label) => `Top Drivers by Number of Entries (${label})`,
            infoText: 'Total number of leaderboard entries submitted across all tracks and car classes. Higher is better.',
            valueTitle: 'Entries',
            valueFormatter: (value) => Number.isFinite(value) ? String(Math.round(value)) : '0',
            containerId: 'records-entries-table',
            titleId: 'records-entries-title'
        }
    ];

    const tablesRoot = document.getElementById(TABLES_ROOT_ID);

    let currentFilter = '';
    let currentRequestId = 0;
    let expandedKey = null;
    // Cache of full normalized rows per metric key for the current filter.
    let rowsByKey = {};
    // Current pagination page (0-indexed) per section key.
    let pageByKey = {};
    let hasTrackedDisplayed = false;
    let pendingTrackSource = 'initial';
    // Fixed prev/next nav buttons (created once, updated dynamically).
    let navPrevBtn = null;
    let navNextBtn = null;

    function getStatsData() {
        if (!window.StatsData) throw new Error('StatsData module is not available.');
        return window.StatsData;
    }

    function getStatsRenderer() {
        if (!window.StatsRenderer) throw new Error('StatsRenderer module is not available.');
        return window.StatsRenderer;
    }

    const escapeHtml = (value) => getStatsRenderer().escapeHtml(value);

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

    function trackRecordsDisplayed(value, counts) {
        if (hasTrackedDisplayed) return;
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
        R3EAnalytics.track('records displayed', {
            filter_value: value || '',
            filter_label: getSelectedLabel(value),
            filter_type: getFilterType(value),
            ...counts
        });
        hasTrackedDisplayed = true;
    }

    function trackRecordsFilterChanged(value, source, counts) {
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
        R3EAnalytics.track('records filter changed', {
            filter_value: value || '',
            filter_label: getSelectedLabel(value),
            filter_type: getFilterType(value),
            source: source || 'filter',
            ...counts
        });
    }

    function trackRecordsExpand(key, value) {
        if (typeof R3EAnalytics === 'undefined' || typeof R3EAnalytics.track !== 'function') return;
        R3EAnalytics.track('records section expanded', {
            section: key,
            filter_value: value || '',
            filter_label: getSelectedLabel(value),
            filter_type: getFilterType(value)
        });
    }

    function getSection(key) {
        return RECORD_SECTIONS.find((s) => s.key === key) || null;
    }

    /**
     * Return the visible rows for a section.
     *
     * IMPORTANT: Both expanded and collapsed views are page-aware.
     * The collapsed preview shows the first COLLAPSED_ROWS rows of the
     * *current* page (not the global first rows). This keeps the preview
     * consistent with whatever page the user was viewing before folding.
     *
     * Single source of truth for page index: `pageByKey[section.key]`.
     */
    function getPageRows(section, expanded) {
        const allRows = rowsByKey[section.key] || [];
        const page = pageByKey[section.key] || 0;
        const offset = page * PAGE_SIZE;
        if (!expanded) {
            return allRows.slice(offset, offset + COLLAPSED_ROWS);
        }
        return allRows.slice(offset, offset + PAGE_SIZE);
    }

    /**
     * Render a section's table into `el`.
     *
     * Page-aware: both expanded and collapsed views use the current page
     * stored in `pageByKey` so that rows and rank numbers stay consistent
     * when toggling between expanded ↔ collapsed states.
     *
     * The single source of truth for "which page?" is `pageByKey[key]`.
     * `getPageRows` already slices from the correct page offset, so the
     * `startRank` here must use the same page value — never hard-code 0
     * for the collapsed case.
     */
    function renderSectionInto(el, section, expanded) {
        const rows = getPageRows(section, expanded);
        const page = pageByKey[section.key] || 0;
        const startRank = page * PAGE_SIZE + 1;
        getStatsRenderer().renderTable(el, rows, section.valueTitle, {
            valueFormatter: section.valueFormatter,
            startRank
        });
    }

    function renderSection(section, expanded) {
        const container = document.getElementById(section.containerId);
        if (!container) return;
        renderSectionInto(container, section, expanded);
    }

    function updateToggleButton(section, expanded) {
        const btns = document.querySelectorAll(`.records-expand-toggle[data-record-key="${section.key}"]`);
        btns.forEach((btn) => {
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            btn.classList.toggle('is-expanded', expanded);
            const label = btn.querySelector('.records-expand-toggle__label');
            if (label) {
                label.textContent = expanded ? 'Show top 3' : 'Show top 50';
            }
        });
    }

    function renderSectionWithFold(section, expanded) {
        const container = document.getElementById(section.containerId);
        if (!container) return;

        // If an animation is in progress, capture its current rendered height before cancelling
        // so re-clicks start from where the element actually is.
        if (container._foldAnim) {
            const midHeight = container.getBoundingClientRect().height;
            container._foldGeneration = (container._foldGeneration || 0) + 1; // invalidate pending callback
            container._foldAnim.cancel();
            container._foldAnim = null;
            container.style.height = `${midHeight}px`;
        }
        if (container._slideAnim) {
            container._slideAnim.cancel();
            container._slideAnim = null;
            container.style.height = '';
            container.style.overflow = '';
            container.style.position = '';
        }

        // 1. Snapshot current height BEFORE any DOM change.
        const fromHeight = container.getBoundingClientRect().height;

        // 2. Lock container at current height so content changes are clipped.
        container.style.overflow = 'hidden';
        container.style.height = `${fromHeight}px`;

        // 3. Measure the target height.
        // For EXPANDING: render 50 rows now (they'll be revealed as container grows).
        // For COLLAPSING: temporarily render 3 rows to measure their height, then restore
        //   the 50 rows so they remain visible while the container folds — rows are only
        //   swapped at the END of the animation so content doesn't vanish before the box closes.
        let toHeight;
        if (expanded) {
            renderSection(section, true);
            container.style.height = 'auto';
            toHeight = container.scrollHeight;
            container.style.height = `${fromHeight}px`;
        } else {
            // Render collapsed temporarily to measure, then restore expanded content.
            renderSection(section, false);
            container.style.height = 'auto';
            toHeight = container.scrollHeight;
            container.style.height = `${fromHeight}px`;
            renderSection(section, true); // keep current page visible during fold animation
        }

        // No-layout environments (jsdom / tests): skip animation.
        if (!fromHeight && !toHeight) {
            if (!expanded) renderSection(section, false);
            container.style.height = '';
            container.style.overflow = '';
            return;
        }

        if (typeof container.animate !== 'function') {
            if (!expanded) renderSection(section, false);
            container.style.height = '';
            container.style.overflow = '';
            return;
        }

        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            if (!expanded) renderSection(section, false);
            container.style.height = '';
            container.style.overflow = '';
            return;
        }

        // 4. Animate with WAAPI.
        // fill:'forwards' holds the final keyframe so there is no snap-back before cleanup.
        // We use a generation counter to detect if a new animation has started since this
        // one was created (guards against already-resolved promise microtask race condition).
        const generation = (container._foldGeneration = (container._foldGeneration || 0) + 1);
        const anim = container.animate(
            [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
            { duration: 600, easing: 'ease-in-out', fill: 'forwards' }
        );
        container._foldAnim = anim;

        anim.finished.then(() => {
            if (container._foldAnim !== anim) return;
            if (container._foldGeneration !== generation) return;
            container._foldAnim = null;
            anim.cancel();               // Removes fill:forwards effect layer.
            if (!expanded) renderSection(section, false);
            container.style.height = '';  // Return to natural auto height.
            container.style.overflow = '';
        }).catch(() => { /* cancelled externally */ });
    }

    function setExpanded(nextKey) {
        // If clicking the currently open one, collapse it.
        if (nextKey === expandedKey) {
            const section = getSection(expandedKey);
            if (section) {
                expandedKey = null;
                updateToggleButton(section, false);
                renderSectionWithFold(section, false);
            }
            updateNavButtons();
            return;
        }

        // Collapse currently open (if any), preserving its page.
        if (expandedKey) {
            const prevSection = getSection(expandedKey);
            if (prevSection) {
                updateToggleButton(prevSection, false);
                renderSectionWithFold(prevSection, false);
            }
        }

        // Expand the new one, preserving its page if it was previously visited.
        const nextSection = getSection(nextKey);
        if (!nextSection) {
            expandedKey = null;
            updateNavButtons();
            return;
        }
        expandedKey = nextKey;
        renderSectionWithFold(nextSection, true);
        updateToggleButton(nextSection, true);
        trackRecordsExpand(nextKey, currentFilter);
        updateNavButtons();
    }

    function updateNavButtons() {
        if (!navPrevBtn || !navNextBtn) return;
        if (!expandedKey) {
            navPrevBtn.hidden = true;
            navNextBtn.hidden = true;
            return;
        }
        const page = pageByKey[expandedKey] || 0;
        const allRows = rowsByKey[expandedKey] || [];
        navPrevBtn.hidden = page === 0;
        navNextBtn.hidden = (page + 1) * PAGE_SIZE >= allRows.length;
        positionNavButtons();
    }

    function positionNavButtons() {
        if (!navPrevBtn || !navNextBtn) return;
        const section = expandedKey ? getSection(expandedKey) : null;
        const anchorEl = section ? document.getElementById(section.containerId) : null;
        if (!anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        const btnW = navPrevBtn.offsetWidth || 32;
        const btnH = navPrevBtn.offsetHeight || 80;
        const isMobile = window.innerWidth <= 768;
        const edgeGap = window.innerWidth <= 480 ? 2 : window.innerWidth <= 768 ? 4 : 6;
        
        // Horizontal positioning: mobile pins to viewport edges, desktop positions relative to table.
        if (isMobile) {
            navPrevBtn.style.left = `${edgeGap}px`;
            navNextBtn.style.left = `${window.innerWidth - btnW - edgeGap}px`;
        } else {
            // Desktop: position relative to table edges
            navPrevBtn.style.left = `${Math.max(0, rect.left - btnW - edgeGap)}px`;
            navNextBtn.style.left = `${rect.right + edgeGap}px`;
        }
        
        // Vertical: stay at viewport center, but clamp inside the table's top/bottom.
        // When the table scrolls off-screen the button follows it out.
        const viewportCenter = window.innerHeight / 2;
        const minCenter = rect.top + btnH / 2;
        const maxCenter = rect.bottom - btnH / 2;
        const centerY = Math.min(maxCenter, Math.max(minCenter, viewportCenter));
        navPrevBtn.style.top = `${centerY}px`;
        navNextBtn.style.top = `${centerY}px`;
    }

    function createNavButtons() {
        navPrevBtn = document.createElement('button');
        navPrevBtn.type = 'button';
        navPrevBtn.className = 'records-page-nav records-page-nav--prev';
        navPrevBtn.setAttribute('aria-label', 'Previous page');
        navPrevBtn.innerHTML = '&#9664;';
        navPrevBtn.hidden = true;

        navNextBtn = document.createElement('button');
        navNextBtn.type = 'button';
        navNextBtn.className = 'records-page-nav records-page-nav--next';
        navNextBtn.setAttribute('aria-label', 'Next page');
        navNextBtn.innerHTML = '&#9654;';
        navNextBtn.hidden = true;

        document.body.appendChild(navPrevBtn);
        document.body.appendChild(navNextBtn);

        navPrevBtn.addEventListener('click', () => {
            if (expandedKey) navigatePage(getSection(expandedKey), -1);
        });
        navNextBtn.addEventListener('click', () => {
            if (expandedKey) navigatePage(getSection(expandedKey), 1);
        });

        // Keep buttons aligned with table edges when viewport resizes or user scrolls.
        if (typeof ResizeObserver !== 'undefined' && tablesRoot) {
            const ro = new ResizeObserver(() => positionNavButtons());
            ro.observe(tablesRoot);
        }
        window.addEventListener('resize', positionNavButtons, { passive: true });
        window.addEventListener('scroll', positionNavButtons, { passive: true });
    }

    function navigatePage(section, direction) {
        if (!section) return;
        const container = document.getElementById(section.containerId);
        if (!container) return;

        const page = pageByKey[section.key] || 0;
        const allRows = rowsByKey[section.key] || [];
        const newPage = page + direction;
        if (newPage < 0 || newPage * PAGE_SIZE >= allRows.length) return;

        // Cancel and fully clean up any in-progress animations.
        // We must do the cleanup that the finished-callback would have done,
        // otherwise stale absolutely-positioned children corrupt the container.
        if (container._slideAnim) {
            container._slideAnim.cancel();
            container._slideAnim = null;
        }
        if (container._foldAnim) {
            container._foldAnim.cancel();
            container._foldAnim = null;
        }
        // Reset container layout, then leave only one child with clean styles.
        container.style.height = '';
        container.style.overflow = '';
        container.style.position = '';
        // Remove all children except the last one (most-recent content).
        while (container.children.length > 1) {
            container.firstElementChild.remove();
        }
        if (container.firstElementChild) {
            container.firstElementChild.style.cssText = '';
        }

        // Lock container height for the slide animation.
        const h = container.getBoundingClientRect().height;
        container.style.overflow = 'hidden';
        container.style.position = 'relative';
        container.style.height = `${h}px`;

        // Mark the current content as outgoing.
        const outgoing = container.firstElementChild;
        if (outgoing) {
            outgoing.style.cssText = 'position:absolute;top:0;left:0;width:100%';
        }

        // Render incoming content.
        pageByKey[section.key] = newPage;
        const incoming = document.createElement('div');
        container.appendChild(incoming);
        renderSectionInto(incoming, section, true);
        incoming.style.cssText = 'position:absolute;top:0;left:0;width:100%';

        const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
        const duration = 380;
        const slideOut = direction > 0 ? '-100%' : '100%';
        const slideIn  = direction > 0 ?  '100%' : '-100%';

        if (outgoing) {
            outgoing.animate(
                [{ transform: 'translateX(0)' }, { transform: `translateX(${slideOut})` }],
                { duration, easing, fill: 'forwards' }
            );
        }

        const inAnim = incoming.animate(
            [{ transform: `translateX(${slideIn})` }, { transform: 'translateX(0)' }],
            { duration, easing, fill: 'forwards' }
        );
        container._slideAnim = inAnim;

        inAnim.finished.then(() => {
            if (container._slideAnim !== inAnim) return;
            container._slideAnim = null;
            if (outgoing) outgoing.remove();
            incoming.style.cssText = '';
            container.style.height = '';
            container.style.overflow = '';
            container.style.position = '';
            updateNavButtons();
        }).catch(() => {});

        updateNavButtons();
    }

    function bindToggleHandler() {
        if (!tablesRoot) return;
        tablesRoot.addEventListener('click', (event) => {
            const btn = event.target.closest('.records-expand-toggle');
            if (!btn || !tablesRoot.contains(btn)) return;
            const key = btn.getAttribute('data-record-key');
            if (!key) return;
            // Save scroll position before the layout change.
            // When the table collapses, the browser tries to keep the focused button
            // in view by scrolling up — we restore the position immediately to prevent that.
            const savedScrollY = window.scrollY;
            setExpanded(key);
            requestAnimationFrame(() => {
                if (window.scrollY !== savedScrollY) {
                    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
                }
            });
        });
    }

    function renderAllSections() {
        for (const section of RECORD_SECTIONS) {
            renderSection(section, expandedKey === section.key);
            updateToggleButton(section, expandedKey === section.key);
        }
    }

    function renderLoading() {
        for (const section of RECORD_SECTIONS) {
            const container = document.getElementById(section.containerId);
            if (container) container.innerHTML = '<div class="loading">Loading top drivers...</div>';
        }
    }

    function renderError(error) {
        const safe = escapeHtml(error?.message || 'Unknown error');
        const html = `<div class="error">Failed to load records: ${safe}</div>`;
        for (const section of RECORD_SECTIONS) {
            const container = document.getElementById(section.containerId);
            if (container) container.innerHTML = html;
        }
    }

    function updateTitles(label) {
        for (const section of RECORD_SECTIONS) {
            const titleEl = document.getElementById(section.titleId);
            if (!titleEl) continue;

            const titleText = escapeHtml(section.titleBuilder(label));
            const infoText = escapeHtml(section.infoText || '');
            titleEl.innerHTML = `${titleText} <span class="info-icon" title="${infoText}" aria-label="${infoText}" role="img">i</span>`;
        }
    }

    async function fetchAndRender() {
        const requestId = ++currentRequestId;
        renderLoading();

        try {
            const statsData = getStatsData();
            const [index] = await Promise.all([
                statsData.loadStatsIndex(),
                ensureMpPosLoaded()
            ]);

            const paths = statsData.getAllPathsForFilter(index, currentFilter);
            if (!paths) {
                throw new Error('No stats files found for this class filter.');
            }

            const pathByKey = {
                pole: paths.polePath,
                bested: paths.bestedPath,
                podium: paths.podiumPath,
                avg_bested: paths.avgBestedPath,
                entries: paths.entriesPath
            };

            pageByKey = {};
            rowsByKey = {};
            updateTitles(getSelectedLabel(currentFilter));
            updateNavButtons();

            // Fetch and render sections in display order so the page fills from top to bottom.
            // The requestId guard still prevents stale responses from an older filter
            // selection from mutating the UI.
            const counts = {};
            const renderSectionWhenReady = async (section) => {
                const path = pathByKey[section.key];
                const def = statsData.METRIC_DEFINITIONS[section.key];
                if (!path || !def) {
                    rowsByKey[section.key] = [];
                    counts[`displayed_${section.key}_rows`] = 0;
                    if (requestId === currentRequestId) {
                        renderSection(section, expandedKey === section.key);
                        updateNavButtons();
                    }
                    return;
                }

                let payload = null;
                try {
                    payload = await statsData.fetchGzipJson(path);
                } catch (err) {
                    console.warn(`Failed to load ${section.key} records:`, err);
                }

                if (requestId !== currentRequestId) return;

                // preFilter may be a factory function taking the active filterValue,
                // or a plain predicate, or absent.
                const effectivePreFilter = typeof section.preFilter === 'function'
                    ? section.preFilter(currentFilter)
                    : null;
                const normalized = payload
                    ? statsData.normalizeRows(payload, def.metricKey, MAX_FETCH_ROWS, { direction: def.direction, preFilter: effectivePreFilter })
                    : [];

                rowsByKey[section.key] = normalized;
                counts[`displayed_${section.key}_rows`] = normalized.length;
                renderSection(section, expandedKey === section.key);
                updateNavButtons();
            };

            for (const section of RECORD_SECTIONS) {
                await renderSectionWhenReady(section);
                if (requestId !== currentRequestId) return;
            }

            if (requestId !== currentRequestId) return;

            trackRecordsDisplayed(currentFilter, counts);
            if (pendingTrackSource !== 'initial') {
                trackRecordsFilterChanged(currentFilter, pendingTrackSource, counts);
            }
            pendingTrackSource = 'filter';
        } catch (error) {
            if (requestId !== currentRequestId) return;
            console.error('Records page failed to render:', error);
            renderError(error);
        }
    }

    function initFilter() {
        if (typeof window.CustomSelect !== 'function') {
            console.warn('CustomSelect is not available for records page.');
            return;
        }

        const superclassOptions = window.dataService?.getSuperclassOptions?.() || [];
        const regularClassOptions = window.dataService?.getClassOptionsFromCarsData?.() || [];
        const classOptions = [{ value: '', label: 'All classes' }]
            .concat(superclassOptions)
            .concat(regularClassOptions);

        new window.CustomSelect(FILTER_ROOT_ID, classOptions, (value, opts) => {
            currentFilter = value || '';
            // Reset expand state when filter changes.
            expandedKey = null;
            if (opts?.source === 'user') {
                pendingTrackSource = 'filter';
            }
            fetchAndRender();
        });
    }

    async function init() {
        if (!tablesRoot) return;
        createNavButtons();
        bindToggleHandler();
        initFilter();
        await fetchAndRender();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
