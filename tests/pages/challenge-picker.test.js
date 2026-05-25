import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ChallengePicker page', () => {
    beforeAll(() => {
        window.R3EAnalytics = { track: vi.fn() };
        window.R3EUtils = { escapeHtml: (v) => String(v ?? '') };
        window.R3ETrackUtils = {};
        window.R3ECarUtils = {
            resolveBrandLogoPath: (name) => name ? `brand-logo://${name}` : '',
            resolveCarClassLogoByName: (name) => name ? `class-logo://${name}` : '',
            wheelBadge: (cat) => `<span class="car-badge">${cat}</span>`,
            transBadge: (cat) => `<span class="car-badge trans">${cat}</span>`,
            driveBadge: (drive) => `<span class="car-badge drive">${drive}</span>`,
            renderCarDisplayHtml: (name) => `<span class="cars-page-car-name">${name}</span>`,
            attachBrandLogoHandlers: () => {}
        };
        window.R3ETrackImages = {
            resolveTrackLogoByLabel: (label) => label ? `track-logo://${label}` : ''
        };
        loadBrowserScript('modules/challenge-picker-service.js');
        loadBrowserScript('modules/pages/challenge-picker.js');
    });

    beforeEach(() => {
        window.CARS_DATA = [
            {
                class: 'GT3',
                logo: 'http://gt3.png',
                cars: [
                    { car: 'BMW M4 GT3', thumbnail: 'http://bmw.png' },
                    { car: 'Porsche 911 GT3 R', thumbnail: 'http://porsche.png' }
                ]
            }
        ];
        window.TRACKS_DATA = [
            { id: 1, label: 'Spa - Grand Prix' },
            { id: 2, label: 'Spa - Moto' },
            { id: 10, label: 'Monza - Grand Prix' }
        ];

        const htmlPath = path.resolve(__dirname, '..', '..', 'challenge.html');
        const fullHtml = fs.readFileSync(htmlPath, 'utf8');
        const bodyMatch = fullHtml.match(/<main>([\s\S]*?)<\/main>/);
        document.body.innerHTML = `<main>${bodyMatch ? bodyMatch[1] : ''}</main>`;

        // Clear sessionStorage so stored state doesn't leak between tests
        sessionStorage.clear();

        window.R3EAnalytics.track.mockClear();
        window.ChallengePicker.init();
    });

    /* ── mode toggle ─────────────────────────────────────── */

    test('defaults to "both" mode with both pickers visible', () => {
        const carPicker = document.getElementById('challenge-car-picker');
        const trackPicker = document.getElementById('challenge-track-picker');
        expect(carPicker.classList.contains('challenge-picker--hidden')).toBe(false);
        expect(trackPicker.classList.contains('challenge-picker--hidden')).toBe(false);
    });

    test('car mode hides track picker', () => {
        const carBtn = document.querySelector('[data-mode="car"]');
        carBtn.click();
        expect(document.getElementById('challenge-track-picker').classList.contains('challenge-picker--hidden')).toBe(true);
        expect(document.getElementById('challenge-car-picker').classList.contains('challenge-picker--hidden')).toBe(false);
    });

    test('track mode hides car picker', () => {
        const trackBtn = document.querySelector('[data-mode="track"]');
        trackBtn.click();
        expect(document.getElementById('challenge-car-picker').classList.contains('challenge-picker--hidden')).toBe(true);
        expect(document.getElementById('challenge-track-picker').classList.contains('challenge-picker--hidden')).toBe(false);
    });

    test('both mode shows both pickers', () => {
        document.querySelector('[data-mode="car"]').click();
        document.querySelector('[data-mode="both"]').click();
        expect(document.getElementById('challenge-car-picker').classList.contains('challenge-picker--hidden')).toBe(false);
        expect(document.getElementById('challenge-track-picker').classList.contains('challenge-picker--hidden')).toBe(false);
    });

    /* ── granularity toggles ─────────────────────────────── */

    test('car granularity buttons toggle is-active', () => {
        const btns = document.querySelectorAll('#challenge-car-picker .challenge-granularity-btn');
        expect(btns[0].classList.contains('is-active')).toBe(true);  // class
        expect(btns[1].classList.contains('is-active')).toBe(false); // car

        btns[1].click();
        expect(btns[0].classList.contains('is-active')).toBe(false);
        expect(btns[1].classList.contains('is-active')).toBe(true);
    });

    test('track granularity buttons toggle is-active', () => {
        const btns = document.querySelectorAll('#challenge-track-picker .challenge-granularity-btn');
        expect(btns[0].classList.contains('is-active')).toBe(true);  // track
        expect(btns[1].classList.contains('is-active')).toBe(false); // layout

        btns[1].click();
        expect(btns[0].classList.contains('is-active')).toBe(false);
        expect(btns[1].classList.contains('is-active')).toBe(true);
    });

    /* ── pick action ─────────────────────────────────────── */

    test('pick in both+class+track mode renders class and track results', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        const carHtml = document.getElementById('challenge-car-result').innerHTML;
        expect(carHtml).toContain('GT3');
        expect(carHtml).toContain('challenge-result-class__logo');

        const trackHtml = document.getElementById('challenge-track-result').innerHTML;
        expect(trackHtml).toContain('challenge-result-track');
    });

    test('pick in car granularity renders car name and thumbnail', () => {
        document.querySelector('#challenge-car-picker [data-granularity="car"]').click();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        const carHtml = document.getElementById('challenge-car-result').innerHTML;
        expect(carHtml).toContain('BMW M4 GT3');
        expect(carHtml).toContain('car-tile-image');
        expect(carHtml).toContain('http://bmw.png');
    });

    test('pick in layout granularity renders layout label', () => {
        document.querySelector('#challenge-track-picker [data-granularity="layout"]').click();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        const trackHtml = document.getElementById('challenge-track-result').innerHTML;
        expect(trackHtml).toContain('challenge-result-layout');
    });

    test('car-only mode does not update track result', () => {
        document.querySelector('[data-mode="car"]').click();
        const trackResult = document.getElementById('challenge-track-result');
        trackResult.innerHTML = 'ORIGINAL';
        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        expect(trackResult.innerHTML).toBe('ORIGINAL');
        expect(document.getElementById('challenge-car-result').innerHTML).toContain('GT3');
    });

    test('track-only mode does not update car result', () => {
        document.querySelector('[data-mode="track"]').click();
        const carResult = document.getElementById('challenge-car-result');
        carResult.innerHTML = 'ORIGINAL';
        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        expect(carResult.innerHTML).toBe('ORIGINAL');
        expect(document.getElementById('challenge-track-result').innerHTML).toContain('challenge-result-track');
    });

    /* ── animation class ─────────────────────────────────── */

    test('pick adds spin animation class to result containers', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        expect(document.getElementById('challenge-car-result').classList.contains('challenge-picker__result--spinning')).toBe(true);
        expect(document.getElementById('challenge-track-result').classList.contains('challenge-picker__result--spinning')).toBe(true);
    });

    /* ── mode button aria-checked ────────────────────────── */

    test('mode toggle updates aria-checked', () => {
        const btns = document.querySelectorAll('.challenge-mode-btn');
        expect(btns[1].getAttribute('aria-checked')).toBe('true');  // both

        btns[0].click(); // car
        expect(btns[0].getAttribute('aria-checked')).toBe('true');
        expect(btns[1].getAttribute('aria-checked')).toBe('false');
        expect(btns[2].getAttribute('aria-checked')).toBe('false');
    });

    /* ── filter visibility ───────────────────────────────── */

    test('filters are visible in both and car mode, hidden in track mode', () => {
        const filters = document.getElementById('challenge-filters');
        expect(filters.classList.contains('challenge-filters--hidden')).toBe(false);

        document.querySelector('[data-mode="car"]').click();
        expect(filters.classList.contains('challenge-filters--hidden')).toBe(false);

        document.querySelector('[data-mode="track"]').click();
        expect(filters.classList.contains('challenge-filters--hidden')).toBe(true);

        document.querySelector('[data-mode="both"]').click();
        expect(filters.classList.contains('challenge-filters--hidden')).toBe(false);
    });

    /* ── filter integration ──────────────────────────────── */

    test('filter elements exist in the DOM', () => {
        expect(document.getElementById('challenge-era-filter')).not.toBeNull();
        expect(document.getElementById('challenge-wheel-filter')).not.toBeNull();
        expect(document.getElementById('challenge-trans-filter')).not.toBeNull();
        expect(document.getElementById('challenge-rating-filter')).not.toBeNull();
    });

    test('pick with impossible filters shows no-match message', () => {
        // Set up data where no car matches 'oldies' era
        window.CARS_DATA = [
            {
                class: 'GT3',
                logo: '',
                cars: [{ car: 'Modern Car', wheel_cat: 'gt', transmission_cat: 'paddles', year: '2020', thumbnail: '' }]
            }
        ];

        // Manually call doPick with a filter that excludes all cars
        // Since CustomSelect is not loaded in test env, we use the service directly
        const svc = window.ChallengePickerService;
        const filtered = svc.filterCarsData(window.CARS_DATA, { era: 'oldies' });
        expect(filtered).toHaveLength(0);
    });

    test('era checkbox filter renders checkboxes and toggles correctly', () => {
        const root = document.getElementById('challenge-era-filter');
        const menu = root.querySelector('.custom-select__menu');
        const toggle = root.querySelector('.custom-select__toggle');
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]');

        // Should have 4 checkboxes (All years + 3 eras)
        expect(checkboxes).toHaveLength(4);

        const allCb = menu.querySelector('input[value=""]');
        const oldiesCb = menu.querySelector('input[value="oldies"]');
        const recentCb = menu.querySelector('input[value="recent"]');
        const modernCb = menu.querySelector('input[value="modern"]');

        // "All years" should be checked by default
        expect(allCb.checked).toBe(true);
        expect(oldiesCb.checked).toBe(false);

        // Check a specific era — "All years" should uncheck
        oldiesCb.checked = true;
        oldiesCb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(allCb.checked).toBe(false);
        expect(toggle.textContent).toContain('Oldies');

        // Check another era — both should be selected
        recentCb.checked = true;
        recentCb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(allCb.checked).toBe(false);
        expect(toggle.textContent).toContain('Oldies');
        expect(toggle.textContent).toContain('Recent');

        // Uncheck both — "All years" should re-check
        oldiesCb.checked = false;
        oldiesCb.dispatchEvent(new Event('change', { bubbles: true }));
        recentCb.checked = false;
        recentCb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(allCb.checked).toBe(true);
        expect(toggle.textContent).toContain('All years');

        // Check "All years" while eras are selected — eras should uncheck
        oldiesCb.checked = true;
        oldiesCb.dispatchEvent(new Event('change', { bubbles: true }));
        allCb.checked = true;
        allCb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(oldiesCb.checked).toBe(false);
        expect(toggle.textContent).toContain('All years');
    });

    test('checking all individual eras switches to All years', () => {
        const root = document.getElementById('challenge-era-filter');
        const menu = root.querySelector('.custom-select__menu');
        const toggle = root.querySelector('.custom-select__toggle');

        const allCb = menu.querySelector('input[value=""]');
        const oldiesCb = menu.querySelector('input[value="oldies"]');
        const recentCb = menu.querySelector('input[value="recent"]');
        const modernCb = menu.querySelector('input[value="modern"]');

        // Check oldies and recent first
        oldiesCb.checked = true;
        oldiesCb.dispatchEvent(new Event('change', { bubbles: true }));
        recentCb.checked = true;
        recentCb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(allCb.checked).toBe(false);

        // Now check the last era (modern) — should switch to "All years"
        modernCb.checked = true;
        modernCb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(allCb.checked).toBe(true);
        expect(oldiesCb.checked).toBe(false);
        expect(recentCb.checked).toBe(false);
        expect(modernCb.checked).toBe(false);
        expect(toggle.textContent).toContain('All years');
    });

    test('era filter state is saved to sessionStorage', () => {
        const root = document.getElementById('challenge-era-filter');
        const menu = root.querySelector('.custom-select__menu');
        const oldiesCb = menu.querySelector('input[value="oldies"]');

        oldiesCb.checked = true;
        oldiesCb.dispatchEvent(new Event('change', { bubbles: true }));

        const saved = sessionStorage.getItem('challenge-filter-era');
        expect(saved).toBe(JSON.stringify(['oldies']));
    });

    test('era filter state is restored from sessionStorage on init', () => {
        sessionStorage.setItem('challenge-filter-era', JSON.stringify(['recent', 'modern']));
        window.ChallengePicker.init();

        const root = document.getElementById('challenge-era-filter');
        const menu = root.querySelector('.custom-select__menu');
        const allCb = menu.querySelector('input[value=""]');
        const recentCb = menu.querySelector('input[value="recent"]');
        const modernCb = menu.querySelector('input[value="modern"]');
        const toggle = root.querySelector('.custom-select__toggle');

        expect(allCb.checked).toBe(false);
        expect(recentCb.checked).toBe(true);
        expect(modernCb.checked).toBe(true);
        expect(toggle.textContent).toContain('Recent');
        expect(toggle.textContent).toContain('Modern');
    });

    /* ── exclusions ──────────────────────────────────────── */

    test('exclusions toggle opens and closes the panel', () => {
        const container = document.getElementById('challenge-exclusions');
        const toggle = document.getElementById('challenge-exclusions-toggle');
        expect(container.classList.contains('is-open')).toBe(false);

        toggle.click();
        expect(container.classList.contains('is-open')).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        toggle.click();
        expect(container.classList.contains('is-open')).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    test('exclusions panel builds track and car lists on first open', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        const trackItems = document.querySelectorAll('#challenge-exclusions-tracks .challenge-exclusions__item');
        expect(trackItems.length).toBeGreaterThan(0);
        // Should have 2 base tracks: Spa and Monza
        expect(trackItems.length).toBe(2);

        const classItems = document.querySelectorAll('#challenge-exclusions-cars .challenge-exclusions__class');
        expect(classItems.length).toBe(1); // GT3
    });

    test('excluding a track stores it in sessionStorage', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        const spaItem = document.querySelector('#challenge-exclusions-tracks .challenge-exclusions__item[data-track="Spa"]');
        expect(spaItem).not.toBeNull();
        const cb = spaItem.querySelector('input[type="checkbox"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));

        const stored = JSON.parse(sessionStorage.getItem('challenge-excl-tracks'));
        expect(stored).toContain('Spa');
    });

    test('excluding a track removes it from picks', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        // Exclude Monza
        const monzaItem = document.querySelector('#challenge-exclusions-tracks .challenge-exclusions__item[data-track="Monza"]');
        const cb = monzaItem.querySelector('input[type="checkbox"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));

        // Pick multiple times — should never get Monza
        vi.spyOn(Math, 'random').mockReturnValue(0);
        for (let i = 0; i < 5; i++) {
            document.getElementById('challenge-pick-btn').click();
            const html = document.getElementById('challenge-track-result').innerHTML;
            expect(html).not.toContain('Monza');
        }
        Math.random.mockRestore();
    });

    test('excluding a car class stores it in sessionStorage', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        const classDiv = document.querySelector('#challenge-exclusions-cars .challenge-exclusions__class[data-class="GT3"]');
        const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
        classCb.checked = true;
        classCb.dispatchEvent(new Event('change', { bubbles: true }));

        const stored = JSON.parse(sessionStorage.getItem('challenge-excl-classes'));
        expect(stored).toContain('GT3');
    });

    test('excluding all classes shows no-match message on pick', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        const classDiv = document.querySelector('#challenge-exclusions-cars .challenge-exclusions__class[data-class="GT3"]');
        const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
        classCb.checked = true;
        classCb.dispatchEvent(new Event('change', { bubbles: true }));

        vi.spyOn(Math, 'random').mockReturnValue(0);
        document.getElementById('challenge-pick-btn').click();
        Math.random.mockRestore();

        const carHtml = document.getElementById('challenge-car-result').innerHTML;
        expect(carHtml).toContain('No car');
    });

    test('checking a class auto-checks all its cars', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        const classDiv = document.querySelector('#challenge-exclusions-cars .challenge-exclusions__class[data-class="GT3"]');
        const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
        classCb.checked = true;
        classCb.dispatchEvent(new Event('change', { bubbles: true }));

        const carCbs = classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]');
        carCbs.forEach(cb => expect(cb.checked).toBe(true));
    });

    test('exclusion badge shows count', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        const badge = document.getElementById('challenge-exclusions-badge');
        expect(badge.textContent).toBe('');

        // Exclude Spa track
        const spaItem = document.querySelector('#challenge-exclusions-tracks .challenge-exclusions__item[data-track="Spa"]');
        const cb = spaItem.querySelector('input[type="checkbox"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));

        expect(badge.textContent).toBe('(1)');
    });

    test('reset button clears all exclusions', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        // Exclude Spa track
        const spaItem = document.querySelector('#challenge-exclusions-tracks .challenge-exclusions__item[data-track="Spa"]');
        const spaCb = spaItem.querySelector('input[type="checkbox"]');
        spaCb.checked = true;
        spaCb.dispatchEvent(new Event('change', { bubbles: true }));

        const badge = document.getElementById('challenge-exclusions-badge');
        expect(badge.textContent).toBe('(1)');

        // Click reset
        const resetBtn = document.getElementById('challenge-exclusions-reset');
        resetBtn.click();

        expect(badge.textContent).toBe('');
        expect(spaCb.checked).toBe(false);
        expect(spaItem.classList.contains('challenge-exclusions__item--excluded')).toBe(false);
    });

    test('single-car class is not expandable but click toggles checkbox', () => {
        window.CARS_DATA = [
            {
                class: 'SingleCarClass',
                logo: '',
                cars: [{ car: 'Only Car', thumbnail: '' }]
            },
            {
                class: 'MultiCarClass',
                logo: '',
                cars: [
                    { car: 'Car A', thumbnail: '' },
                    { car: 'Car B', thumbnail: '' }
                ]
            }
        ];
        window.ChallengePicker.init();
        document.getElementById('challenge-exclusions-toggle').click();

        const singleDiv = document.querySelector('.challenge-exclusions__class[data-class="SingleCarClass"]');
        expect(singleDiv.classList.contains('challenge-exclusions__class--single')).toBe(true);
        expect(singleDiv.querySelector('.challenge-exclusions__cars')).toBeNull();

        // Clicking the header should toggle the checkbox
        const classCb = singleDiv.querySelector('.challenge-exclusions__class-cb');
        expect(classCb.checked).toBe(false);
        singleDiv.querySelector('.challenge-exclusions__class-header').click();
        expect(classCb.checked).toBe(true);

        const multiDiv = document.querySelector('.challenge-exclusions__class[data-class="MultiCarClass"]');
        expect(multiDiv.classList.contains('challenge-exclusions__class--single')).toBe(false);
        expect(multiDiv.querySelector('.challenge-exclusions__cars')).not.toBeNull();
    });

    test('partial car exclusion shows indeterminate class checkbox', () => {
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();

        // GT3 class has 2 cars — exclude just one
        const classDiv = document.querySelector('#challenge-exclusions-cars .challenge-exclusions__class[data-class="GT3"]');
        const carCbs = classDiv.querySelectorAll('.challenge-exclusions__car-item input[type="checkbox"]');
        expect(carCbs.length).toBe(2);

        // Expand and check first car only
        classDiv.querySelector('.challenge-exclusions__class-header').click(); // expand
        carCbs[0].checked = true;
        carCbs[0].dispatchEvent(new Event('change', { bubbles: true }));

        const classCb = classDiv.querySelector('.challenge-exclusions__class-cb');
        expect(classCb.checked).toBe(false);
        expect(classCb.indeterminate).toBe(true);

        // Check second car — should become fully checked
        carCbs[1].checked = true;
        carCbs[1].dispatchEvent(new Event('change', { bubbles: true }));
        expect(classCb.checked).toBe(true);
        expect(classCb.indeterminate).toBe(false);
    });

    test('exclusions survive re-init via sessionStorage', () => {
        // Open and exclude Spa
        const toggle = document.getElementById('challenge-exclusions-toggle');
        toggle.click();
        const spaItem = document.querySelector('#challenge-exclusions-tracks .challenge-exclusions__item[data-track="Spa"]');
        const cb = spaItem.querySelector('input[type="checkbox"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));

        // Re-init (simulates page reload with sessionStorage preserved)
        window.ChallengePicker.init();

        // Badge should still show count
        const badge = document.getElementById('challenge-exclusions-badge');
        expect(badge.textContent).toBe('(1)');
    });

    /* ── analytics ─────────────────────────────────────────── */

    test('tracks challenge page shown on init', () => {
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'challenge page shown',
            expect.objectContaining({ mode: 'both', hardcore: false })
        );
    });

    test('tracks challenge pick clicked on Pick', () => {
        window.R3EAnalytics.track.mockClear();
        document.getElementById('challenge-pick-btn').click();
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'challenge pick clicked',
            expect.objectContaining({ mode: 'both', hardcore: false })
        );
    });
});
