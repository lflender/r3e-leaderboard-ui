/**
 * Driver Profile Distributions Module
 * Handles rendering and interaction wiring for the distributions section
 * (entries over time + performance over time graphs).
 */
const DriverProfileDistributions = (() => {

    /**
     * Render the distributions section HTML.
     * @param {Array} entries - Raw driver leaderboard entries
     * @returns {string} HTML string for the distributions grid
     */
    function render(entries) {
        if (!entries || entries.length === 0) return '';

        let html = '<div class="driver-profile-distributions-grid">';

        if (window.DetailEntriesDist) {
            const entriesDistHtml = DetailEntriesDist.generateHtml(entries, true, null, null, entries, {});
            if (entriesDistHtml) {
                html += '<div class="driver-profile-dist-card">' + entriesDistHtml + '</div>';
            }
        }

        html += DriverProfileRenderers.generatePerformanceGraph(entries);
        html += '</div>';

        return html;
    }

    /**
     * Wire toggle, timeframe, and tooltip interactions for distribution graphs.
     * @param {HTMLElement} container - The distributions container element
     * @param {Array} entries - Raw driver leaderboard entries (for timeframe re-rendering)
     */
    function wireInteraction(container, entries) {
        if (!container) return;

        // Toggle buttons
        container.querySelectorAll('.entries-dist-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                const contentId = toggle.getAttribute('aria-controls');
                const content = document.getElementById(contentId);
                if (!content) return;
                toggle.setAttribute('aria-expanded', String(!expanded));
                toggle.classList.toggle('is-expanded', !expanded);
                content.style.display = expanded ? 'none' : '';
            });
        });

        // Timeframe controls for entries distribution
        const entriesDistEl = container.querySelector('.entries-dist-summary:not(.perf-dist-summary)');
        if (entriesDistEl && window.DetailEntriesDist) {
            const startInput = entriesDistEl.querySelector('.entries-timeframe-start');
            const endInput = entriesDistEl.querySelector('.entries-timeframe-end');
            const lastWeekBtn = entriesDistEl.querySelector('.entries-timeframe-last-week');

            if (startInput && endInput) {
                const refresh = () => {
                    const parent = entriesDistEl.closest('.driver-profile-dist-card');
                    if (!parent) return;
                    const filtered = DetailEntriesDist.applyTimeframeFilter(entries, startInput.value, endInput.value);
                    const newHtml = DetailEntriesDist.generateHtml(filtered, true, startInput.value, endInput.value, entries, {
                        timeframeStart: startInput.value,
                        timeframeEnd: endInput.value
                    });
                    parent.innerHTML = newHtml;
                    // Re-wire toggle
                    const newToggle = parent.querySelector('.entries-dist-toggle');
                    if (newToggle) {
                        newToggle.addEventListener('click', () => {
                            const exp = newToggle.getAttribute('aria-expanded') === 'true';
                            const cId = newToggle.getAttribute('aria-controls');
                            const c = document.getElementById(cId);
                            if (!c) return;
                            newToggle.setAttribute('aria-expanded', String(!exp));
                            newToggle.classList.toggle('is-expanded', !exp);
                            c.style.display = exp ? 'none' : '';
                        });
                    }
                    // Re-wire interactions recursively
                    wireInteraction(container, entries);
                };
                startInput.addEventListener('change', refresh);
                endInput.addEventListener('change', refresh);
                if (lastWeekBtn) {
                    lastWeekBtn.addEventListener('click', () => {
                        const now = new Date();
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        startInput.value = DetailEntriesDist.toLocalDateInputValue(weekAgo);
                        endInput.value = DetailEntriesDist.toLocalDateInputValue(now);
                        refresh();
                    });
                }
            }
        }

        // Wire tooltips
        if (window.DetailEntriesDist) {
            DetailEntriesDist.wireTooltips(container, entries);
            DetailEntriesDist.wirePerfTooltips(container);
        }
    }

    return {
        render,
        wireInteraction
    };
})();

if (typeof window !== 'undefined') window.DriverProfileDistributions = DriverProfileDistributions;
if (typeof module !== 'undefined') module.exports = DriverProfileDistributions;
