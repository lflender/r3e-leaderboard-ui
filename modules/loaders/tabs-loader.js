/**
 * Tabs Loader
 *
 * Renders the site-wide navigation tabs into #site-tabs.
 * The active page is set via data-active="<tab-id>" on the placeholder element.
 */
(function () {
    'use strict';

    const TABS = [
        { id: 'drivers',   label: 'Drivers',      href: 'drivers.html' },
        { id: 'tracks',    label: 'Leaderboards',  href: 'tracks.html' },
        { id: 'records',   label: 'Records',       href: 'records.html' },
        { id: 'challenge', label: 'Challenge',     href: 'challenge.html', badge: 'NEW!' },
        { id: 'cars',      label: 'Cars',          href: 'cars.html' },
        { id: 'faq',       label: 'FAQ',           href: 'faq.html' },
    ];

    var BADGE_STORAGE_KEY = 'challenge-visited';

    function isBadgeDismissed(tabId) {
        if (tabId !== 'challenge') return false;
        try { return localStorage.getItem(BADGE_STORAGE_KEY) === '1'; } catch (_) { return false; }
    }

    function dismissBadge(tabId) {
        if (tabId !== 'challenge') return;
        try { localStorage.setItem(BADGE_STORAGE_KEY, '1'); } catch (_) { /* ignored */ }
    }

    function render(container) {
        var activeId = container.dataset.active || '';
        var html = '';
        for (var i = 0; i < TABS.length; i++) {
            var tab = TABS[i];
            var badgeHtml = (tab.badge && !isBadgeDismissed(tab.id))
                ? ' <span class="tab-badge">' + tab.badge + '</span>'
                : '';
            if (tab.id === activeId) {
                dismissBadge(tab.id);
                html += '<button class="tab-button active">' + tab.label + '</button>';
            } else {
                html += '<a class="tab-button" href="' + tab.href + '">' + tab.label + badgeHtml + '</a>';
            }
        }
        container.innerHTML = html;
    }

    // With defer, the DOM is already parsed — render immediately
    var container = document.getElementById('site-tabs');
    if (container) render(container);
})();
