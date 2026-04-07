/**
 * Analytics Module — PostHog wrapper
 *
 * Provides front-end product analytics (pageviews, searches, visitor identity)
 * while bypassing most ad-blockers by:
 *   1. Serving the PostHog JS SDK from the site's own domain (renamed file)
 *   2. Proxying the ingestion endpoint through the site's own domain
 *
 * ─── SETUP INSTRUCTIONS ───────────────────────────────────────────────
 *
 * 1. Create a free PostHog account at https://posthog.com
 *    Copy your Project API Key and paste it below in PH_TOKEN.
 *
 * 2. Download the PostHog JS SDK and host it locally:
 *      curl -o modules/ph-lib.js "https://eu-assets.i.posthog.com/static/array.js"
 *    This avoids ad-blockers that block requests to posthog.com / i.posthog.com.
 *
 * 3. Set up a reverse-proxy on your server so that /ingest/* forwards
 *    to https://eu.i.posthog.com/*   (see proxy-setup.md in the repo root).
 *    Then set PH_API_HOST below to '' (empty string = same origin).
 *
 *    Until the proxy is live you can use PostHog's cloud URL directly —
 *    it will work fine for users without ad-blockers.
 *
 * ──────────────────────────────────────────────────────────────────────
 */

const R3EAnalytics = (() => {
    // ── Configuration ────────────────────────────────────────────────
    // Replace with your PostHog project API key
    const PH_TOKEN = 'phc_3m0kaFKagkaRovjHQ2Po1ABIC10oxylWoZJiklFrtd';

    // Proxy path — must match the reverse-proxy on the server.
    // Uses a short, generic name to avoid ad-blocker filter lists.
    const PH_API_HOST = '/t';

    // Path to the locally-hosted PostHog SDK file (see step 2 above).
    // Falls back to PostHog CDN if the local file is missing.
    const PH_LOCAL_SDK = 'modules/ph-lib.js';
    // ─────────────────────────────────────────────────────────────────

    let _ready = false;

    /**
     * Bootstrap PostHog: load the SDK and initialise.
     * Called once from every page via the <script> tag.
     */
    function init() {
        if (PH_TOKEN === 'YOUR_POSTHOG_PROJECT_API_KEY') {
            console.warn('[Analytics] PostHog token not configured — skipping.');
            return;
        }

        console.log('[Analytics] Bootstrapping PostHog SDK...');

        // Inline mini-bootstrap (same logic PostHog uses, but we control the src)
        !function(t, e) {
            var o, n, p, r;
            e.__SV || (
                window.posthog = e, e._i = [], e.init = function(i, s, a) {
                    function g(t, e) {
                        var o = e.split(".");
                        2 == o.length && (t = t[o[0]], e = o[1]);
                        t[e] = function() { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
                    }
                    (p = t.createElement("script")).type = "text/javascript";
                    p.crossOrigin = "anonymous";
                    p.async = !0;
                    // Load from local first-party file
                    p.src = PH_LOCAL_SDK;
                    console.log('[Analytics] Injecting SDK script:', p.src);
                    p.onload = function() {
                        console.log('[Analytics] ph-lib.js loaded OK, posthog:', typeof window.posthog);
                    };
                    p.onerror = function(err) {
                        console.error('[Analytics] ph-lib.js FAILED to load, falling back to CDN', err);
                        var f = t.createElement("script");
                        f.type = "text/javascript";
                        f.crossOrigin = "anonymous";
                        f.async = !0;
                        f.src = "https://eu-assets.i.posthog.com/static/array.js";
                        f.onload = function() { console.log('[Analytics] CDN fallback loaded OK'); };
                        f.onerror = function() { console.error('[Analytics] CDN fallback ALSO failed'); };
                        p.parentNode.insertBefore(f, p.nextSibling);
                    };
                    (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
                    var u = e;
                    for (
                        void 0 !== a ? u = e[a] = [] : a = "posthog",
                        u.people = u.people || [],
                        u.toString = function(t) {
                            var e = "posthog";
                            return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e;
                        },
                        u.people.toString = function() { return u.toString(1) + ".people (stub)"; },
                        o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),
                        n = 0; n < o.length; n++
                    ) g(u, o[n]);
                    e._i.push([i, s, a]);
                },
                e.__SV = 1
            );
        }(document, window.posthog || []);

        posthog.init(PH_TOKEN, {
            api_host: PH_API_HOST,
            ui_host: 'https://eu.posthog.com',
            // Disable noisy auto-capture; we track manually
            autocapture: false,
            // Keep automatic pageviews on
            capture_pageview: true,
            capture_pageleave: true,
            // Use localStorage for identity (persists across sessions)
            persistence: 'localStorage+cookie',
            // Respect Do-Not-Track
            respect_dnt: false,
            // Disable session recording to keep things lightweight
            disable_session_recording: true,
            // Prevent toolbar assets from routing through the /t proxy
            // (they live on eu-assets.i.posthog.com, not eu.i.posthog.com)
            advanced_disable_toolbar_metrics: true,
            // Single-domain site — skip cross-subdomain cookie discovery probe
            // (prevents the dmn_chk_* cookie rejection warning in the console)
            cross_subdomain_cookie: false
        });

        _ready = true;
    }

    /**
     * Track a custom event with optional properties.
     * Safe to call even if PostHog hasn't loaded yet — calls are queued.
     */
    function track(eventName, properties) {
        if (!_ready) return;
        try {
            posthog.capture(eventName, properties || {});
        } catch (_) { /* never break the UI */ }
    }

    /**
     * Track a driver search on the Driver Info page.
     * Call this after results are returned from dataService.searchDriver().
     *
     * @param {string}  searchTerm   - The raw search string
     * @param {number}  resultCount  - Number of driver groups returned
     * @param {Object}  opts         - Extra context
     * @param {string}  opts.trackFilter  - Active track filter value ('' = none)
     * @param {string}  opts.classFilter  - Active class filter value ('' = none)
     * @param {string}  opts.source       - 'input' | 'enter' | 'url' | 'filter'
     * @param {boolean} opts.isExact      - True when wrapped in quotes
     */
    function trackSearch(searchTerm, resultCount, opts) {
        if (!_ready) return;
        opts = opts || {};
        track('driver search', {
            search_term:   searchTerm,
            result_count:  resultCount,
            has_results:   resultCount > 0,
            track_filter:  opts.trackFilter || '',
            class_filter:  opts.classFilter || '',
            source:        opts.source || 'input',
            is_exact:      !!opts.isExact
        });
    }

    // Public API
    return { init, track, trackSearch };
})();

// Auto-initialise as soon as this script runs
R3EAnalytics.init();
