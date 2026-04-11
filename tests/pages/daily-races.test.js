import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return '<input id="driver-search" value="" /><div id="results-container"></div>';
}

function mockDailyData() {
    return {
        races: [
            {
                track_id: 10,
                car_class_id: 5,
                schedule: '`Every 15 min`',
                is_free_to_play: true
            }
        ],
        'feature-races': [
            {
                track_id: 20,
                car_class: 'PCCD + PCCNA',
                category_class_ids: ['100', '200'],
                schedule: 'Every 30 min',
                is_free_to_play: false
            }
        ]
    };
}

function setupGlobalsAndFetch(data = mockDailyData()) {
    window.TRACKS_DATA = [
        { id: 10, label: 'Spa - Grand Prix' },
        { id: 20, label: 'Monza - GP' }
    ];
    window.getCarClassName = vi.fn((classId) => {
        if (String(classId) === '5') return 'GT3';
        if (String(classId) === '100') return 'PCCD';
        if (String(classId) === '200') return 'PCCNA';
        return String(classId || '');
    });
    window.CAR_CLASSES_DATA = {
        '100': 'PCCD',
        '200': 'PCCNA'
    };
    window.CARS_DATA = [
        { class: 'PCCD', superclass: 'Porsche Cup' },
        { class: 'PCCNA', superclass: 'Porsche Cup' }
    ];
    window.R3EUtils = {
        escapeHtml: value => String(value ?? ''),
        getDailyRaceClassLogosHtml: vi.fn().mockReturnValue('<div class="logos">logos</div>')
    };
    window.CompressedJsonHelper = {
        readGzipJson: vi.fn().mockResolvedValue(data)
    };
    window.R3EAnalytics = { track: vi.fn() };

    global.fetch = vi.fn((url) => {
        const requestUrl = String(url);
        if (requestUrl.includes('daily_races.json.gz')) {
            return Promise.resolve({ ok: true });
        }
        if (requestUrl.includes('status.json')) {
            return Promise.resolve({
                ok: true,
                json: async () => ({ last_daily_race_refresh: '2026-04-11T00:00:00Z' })
            });
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
}

beforeAll(async () => {
    document.body.innerHTML = buildDom();
    setupGlobalsAndFetch();
    loadBrowserScript('modules/pages/daily-races.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 180));
});

beforeEach(async () => {
    document.body.innerHTML = buildDom();
    setupGlobalsAndFetch();

    const DailyRacesCtor = window.dailyRaces && window.dailyRaces.constructor;
    if (DailyRacesCtor) {
        window.dailyRaces = new DailyRacesCtor();
    }
    await new Promise(resolve => setTimeout(resolve, 180));
});

describe('daily-races integration', () => {
    it('renders sprint and feature races with detail links', async () => {
        const html = document.getElementById('results-container').innerHTML;
        const links = Array.from(document.querySelectorAll('.daily-race-card-link'));

        expect(html).toContain('This Week in Ranked Multiplayer');
        expect(html).toContain('Daily Sprint Races');
        expect(html).toContain('Daily Feature Races');
        expect(links[0].getAttribute('href')).toContain('track=10');
        expect(links[0].getAttribute('href')).toContain('class=5');
        expect(links[1].getAttribute('href')).toContain('track=20');
        expect(links[1].getAttribute('href')).toContain('classes=100,200');
        expect(html).toContain('Porsche Cup');
        expect(html).toContain('Every 15 min');
    });

    it('shows fallback error when daily races cannot load', async () => {
        window.CompressedJsonHelper.readGzipJson = vi.fn().mockResolvedValue(null);
        await window.dailyRaces.showDailyRaces();

        const html = document.getElementById('results-container').innerHTML;
        expect(html).toContain('Unable to load daily races information');
    });

    it('tracks sprint and feature tile clicks with specific event names', async () => {
        const sprintLink = document.querySelector('.daily-race-card-link');
        const featureLink = document.querySelector('.daily-races-feature .daily-race-card-link');

        sprintLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        featureLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(window.R3EAnalytics.track).toHaveBeenNthCalledWith(
            1,
            'daily sprint race viewed',
            expect.objectContaining({ track_id: '10', class_id: '5' })
        );
        expect(window.R3EAnalytics.track).toHaveBeenNthCalledWith(
            2,
            'daily feature race viewed',
            expect.objectContaining({ track_id: '20', classes: '100,200' })
        );
    });
});

