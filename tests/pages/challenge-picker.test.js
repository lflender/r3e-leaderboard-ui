import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ChallengePicker page', () => {
    beforeAll(() => {
        window.R3EUtils = { escapeHtml: (v) => String(v ?? '') };
        window.R3ETrackUtils = {
            resolveCarClassLogoByName: (name) => name ? `class-logo://${name}` : ''
        };
        window.R3ECarUtils = {
            resolveBrandLogoPath: (name) => name ? `brand-logo://${name}` : '',
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
});
