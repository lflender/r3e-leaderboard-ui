import { describe, it, expect, beforeEach } from 'vitest';

describe('TabsLoader', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    const BADGE_STORAGE_KEY = 'challenge-visited';

    function loadTabs() {
        const TABS = [
            { id: 'ranked',    label: 'Ranked',        href: '/' },
            { id: 'drivers',   label: 'Drivers',      href: 'drivers.html' },
            { id: 'leaderboards', label: 'Leaderboards',  href: 'leaderboards.html' },
            { id: 'records',   label: 'Records',       href: 'records.html' },
            { id: 'challenge', label: 'Challenge',     href: 'challenge.html', badge: 'NEW!' },
            { id: 'cars',      label: 'Cars',          href: 'cars.html' },
            { id: 'faq',       label: 'FAQ',           href: 'faq.html' },
        ];
        const container = document.getElementById('site-tabs');
        if (!container) return;
        const activeId = container.dataset.active || 'ranked';
        let html = '';
        for (const tab of TABS) {
            const dismissed = tab.id === 'challenge' && localStorage.getItem(BADGE_STORAGE_KEY) === '1';
            const badgeHtml = (tab.badge && !dismissed)
                ? ' <span class="tab-badge">' + tab.badge + '</span>'
                : '';
            if (tab.id === activeId) {
                if (tab.id === 'challenge') localStorage.setItem(BADGE_STORAGE_KEY, '1');
                html += '<button class="tab-button is-active">' + tab.label + '</button>';
            } else {
                html += '<a class="tab-button" href="' + tab.href + '">' + tab.label + badgeHtml + '</a>';
            }
        }
        container.innerHTML = html;
        // Scroll hint: jsdom doesn't support scrollWidth, so just toggle the class check
        const overflows = container.scrollWidth > container.clientWidth + 1;
        const atStart = container.scrollLeft <= 1;
        const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
        container.classList.toggle('tabs--fade-right', overflows && !atEnd);
        container.classList.toggle('tabs--fade-left', overflows && !atStart);
    }

    it('renders all tabs with correct active state', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="challenge"></div>';
        loadTabs();
        const container = document.getElementById('site-tabs');
        const buttons = container.querySelectorAll('.tab-button');
        expect(buttons.length).toBe(7);

        const active = container.querySelector('button.tab-button.is-active');
        expect(active).not.toBeNull();
        expect(active.textContent).toBe('Challenge');

        const links = container.querySelectorAll('a.tab-button');
        expect(links.length).toBe(6);
    });

    it('renders Ranked tab active when data-active is missing', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs"></div>';
        loadTabs();
        const container = document.getElementById('site-tabs');
        const active = container.querySelector('button.tab-button.is-active');
        expect(active).not.toBeNull();
        expect(active.textContent).toBe('Ranked');

        const links = container.querySelectorAll('a.tab-button');
        expect(links.length).toBe(6);
    });

    it('marks drivers tab active correctly', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="drivers"></div>';
        loadTabs();
        const active = document.querySelector('button.tab-button.is-active');
        expect(active.textContent).toBe('Drivers');
    });

    it('renders tabs in correct order', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="faq"></div>';
        loadTabs();
        const labels = Array.from(document.querySelectorAll('.tab-button')).map(b => b.textContent.replace(/\s*NEW!$/, ''));
        expect(labels).toEqual(['Ranked', 'Drivers', 'Leaderboards', 'Records', 'Challenge', 'Cars', 'FAQ']);
    });

    it('active tab is a button, others are links with correct hrefs', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="leaderboards"></div>';
        loadTabs();
        const links = document.querySelectorAll('a.tab-button');
        const hrefs = Array.from(links).map(a => a.getAttribute('href'));
        expect(hrefs).toContain('/');
        expect(hrefs).toContain('drivers.html');
        expect(hrefs).toContain('cars.html');
        expect(hrefs).toContain('records.html');
        expect(hrefs).toContain('challenge.html');
        expect(hrefs).toContain('faq.html');
        expect(hrefs).not.toContain('leaderboards.html');
    });

    it('does nothing when #site-tabs is absent', () => {
        document.body.innerHTML = '<div id="other"></div>';
        loadTabs();
        expect(document.querySelector('.tab-button')).toBeNull();
    });

    it('shows NEW badge on Challenge tab when not yet visited', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="drivers"></div>';
        loadTabs();
        const challengeLink = Array.from(document.querySelectorAll('a.tab-button'))
            .find(a => a.getAttribute('href') === 'challenge.html');
        expect(challengeLink.querySelector('.tab-badge')).not.toBeNull();
        expect(challengeLink.querySelector('.tab-badge').textContent).toBe('NEW!');
    });

    it('hides NEW badge after Challenge page has been visited', () => {
        // First visit: render with challenge active → dismisses badge
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="challenge"></div>';
        loadTabs();

        // Now render another page — badge should be gone
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="drivers"></div>';
        loadTabs();
        const challengeLink = Array.from(document.querySelectorAll('a.tab-button'))
            .find(a => a.getAttribute('href') === 'challenge.html');
        expect(challengeLink.querySelector('.tab-badge')).toBeNull();
    });
});

