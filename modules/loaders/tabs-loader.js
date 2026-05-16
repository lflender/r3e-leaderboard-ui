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
        initScrollHint(container);

        // On mobile, scroll the tabs container so the active tab is visible
        var activeBtn = container.querySelector('.tab-button.active');
        if (activeBtn) {
            var idx = Array.prototype.indexOf.call(container.children, activeBtn);
            if (idx >= TABS.length - 3) {
                // Use requestAnimationFrame to ensure layout is complete
                requestAnimationFrame(function () {
                    var btnLeft = activeBtn.offsetLeft;
                    var btnWidth = activeBtn.offsetWidth;
                    var containerWidth = container.clientWidth;
                    container.scrollLeft = btnLeft - (containerWidth - btnWidth) / 2;
                });
            }
        }
    }

    function initScrollHint(container) {
        // Wrap in a relative container so chevrons sit outside the mask
        var wrapper = document.createElement('div');
        wrapper.className = 'tabs-scroll-wrapper';
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);

        var chevronSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

        var leftChev = document.createElement('button');
        leftChev.className = 'tabs-chevron tabs-chevron--left';
        leftChev.setAttribute('aria-label', 'Scroll tabs left');
        leftChev.innerHTML = chevronSvg;
        wrapper.appendChild(leftChev);

        var rightChev = document.createElement('button');
        rightChev.className = 'tabs-chevron tabs-chevron--right';
        rightChev.setAttribute('aria-label', 'Scroll tabs right');
        rightChev.innerHTML = chevronSvg;
        wrapper.appendChild(rightChev);

        leftChev.addEventListener('click', function () {
            container.scrollBy({ left: -120, behavior: 'smooth' });
        });
        rightChev.addEventListener('click', function () {
            container.scrollBy({ left: 120, behavior: 'smooth' });
        });

        function update() {
            var overflows = container.scrollWidth > container.clientWidth + 1;
            var atStart = container.scrollLeft <= 1;
            var atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
            container.classList.toggle('tabs--fade-right', overflows && !atEnd);
            container.classList.toggle('tabs--fade-left', overflows && !atStart);
            leftChev.classList.toggle('visible', overflows && !atStart);
            rightChev.classList.toggle('visible', overflows && !atEnd);
        }
        // Check after layout settles
        update();
        container.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update, { passive: true });
    }

    // With defer, the DOM is already parsed — render immediately
    var container = document.getElementById('site-tabs');
    if (container) render(container);
})();
