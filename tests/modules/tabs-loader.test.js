import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('TabsLoader (real module)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        window.requestAnimationFrame = vi.fn((cb) => cb());
    });

    it('renders all tabs with correct active state', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="challenge"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        const container = document.getElementById('site-tabs');
        const buttons = container.querySelectorAll('.tab-button');
        expect(buttons.length).toBe(8);

        const active = container.querySelector('button.tab-button.is-active');
        expect(active).not.toBeNull();
        expect(active.textContent).toBe('Challenge');

        const links = container.querySelectorAll('a.tab-button');
        expect(links.length).toBe(7);
    });

    it('renders tabs in correct order', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="faq"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        const labels = Array.from(document.querySelectorAll('.tab-button')).map(b => b.textContent.replace(/\s*NEW!$/, ''));
        expect(labels).toEqual(['Ranked', 'Drivers', 'Teams', 'Leaderboards', 'Records', 'Challenge', 'Cars', 'FAQ']);
    });

    it('active tab is a button, others are links with correct hrefs', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="leaderboards"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        const links = document.querySelectorAll('a.tab-button');
        const hrefs = Array.from(links).map(a => a.getAttribute('href'));
        expect(hrefs).toContain('/');
        expect(hrefs).toContain('drivers.html');
        expect(hrefs).toContain('teams.html');
        expect(hrefs).toContain('cars.html');
        expect(hrefs).toContain('records.html');
        expect(hrefs).toContain('challenge.html');
        expect(hrefs).toContain('faq.html');
        expect(hrefs).not.toContain('leaderboards.html');
    });

    it('does nothing when #site-tabs is absent', () => {
        document.body.innerHTML = '<div id="other"></div>';
        expect(() => loadBrowserScript('modules/loaders/tabs-loader.js')).not.toThrow();
        expect(document.querySelector('.tab-button')).toBeNull();
    });

    it('shows NEW badge on Teams tab when not yet visited', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="drivers"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        const teamsLink = Array.from(document.querySelectorAll('a.tab-button'))
            .find(a => a.getAttribute('href') === 'teams.html');
        expect(teamsLink.querySelector('.tab-badge')).not.toBeNull();
        expect(teamsLink.querySelector('.tab-badge').textContent).toBe('NEW!');
    });

    it('hides NEW badge after Teams page has been visited', () => {
        localStorage.setItem('teams-visited', '1');
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="drivers"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        const teamsLink = Array.from(document.querySelectorAll('a.tab-button'))
            .find(a => a.getAttribute('href') === 'teams.html');
        expect(teamsLink.querySelector('.tab-badge')).toBeNull();
    });

    it('dismisses teams badge when teams tab is active', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="teams"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        expect(localStorage.getItem('teams-visited')).toBe('1');
        const active = document.querySelector('button.tab-button.is-active');
        expect(active.textContent).toBe('Teams');
    });

    it('creates scroll hint wrapper with chevrons', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="ranked"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        const wrapper = document.querySelector('.tabs-scroll-wrapper');
        expect(wrapper).not.toBeNull();
        expect(wrapper.querySelector('.tabs-chevron--left')).not.toBeNull();
        expect(wrapper.querySelector('.tabs-chevron--right')).not.toBeNull();
    });

    it('scrolls active tab into view when past middle index', () => {
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="cars"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        // cars is index 6, middleIdx = 3, so scroll should trigger
        expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it('does not scroll when active tab is before middle index', () => {
        window.requestAnimationFrame = vi.fn((cb) => cb());
        document.body.innerHTML = '<div class="tabs" id="site-tabs" data-active="ranked"></div>';
        loadBrowserScript('modules/loaders/tabs-loader.js');
        // ranked is index 0 which is < middleIdx, so no rAF for scroll
        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });
});

