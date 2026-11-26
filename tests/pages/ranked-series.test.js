import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function makeSeries(qualifyingType = 'leaderboard') {
    return {
        id: 'series-1',
        name: 'Alpine Cup',
        eligible_classes: [{ id: 'class-1', name: 'Alpine A110 Cup' }],
        format: {
            practice_minutes: 5,
            qualifying_type: qualifyingType,
            qualifying_minutes: 0,
            races: [{ format: 'minutes', length: 15, rolling_start: false }],
            fixed_setup: true,
            mandatory_pitstop: 'none',
            fuel_usage: 'normal',
            tire_wear: 'normal',
            incident_limit: 30,
            reversed_grid_places: 0,
            damage: 'full'
        },
        schedule: {
            cadence_minutes: 120,
            anchor_minutes: [90],
            daily_times: [],
            weekdays: []
        },
        current_round: 2,
        rounds: [
            {
                number: 1,
                status: 'finished',
                starts_at: 1794207600000,
                ends_at: 1794812400000,
                track: {
                    track_id: 'track-previous',
                    layout_id: 'layout-previous',
                    name: 'Previous Circuit',
                    layout: 'Short'
                },
                eligible_classes: [{ id: 'class-old', name: 'Old Class' }]
            },
            {
                number: 2,
                status: 'active',
                starts_at: 1794812400000,
                ends_at: 1795417200000,
                track: {
                    track_id: 'track-current',
                    layout_id: 'layout-current',
                    name: 'Mantorp Park',
                    layout: 'Long Circuit'
                },
                registration: { closes_at: 1795417200000, count: 12 },
                eligible_classes: [{ id: 'class-1', name: 'Alpine A110 Cup' }]
            },
            {
                number: 3,
                status: 'upcoming',
                starts_at: 1795417200000,
                ends_at: 1796022000000,
                track: {
                    track_id: 'track-upcoming',
                    layout_id: 'layout-upcoming',
                    name: 'Future Circuit',
                    layout: 'Grand Prix'
                },
                eligible_classes: [{ id: 'class-1', name: 'Alpine A110 Cup' }]
            }
        ]
    };
}

function setup(data, options = {}) {
    const tracks = options.tracks || [
        { id: 'layout-previous', label: 'Previous Circuit - Short' },
        { id: 'layout-current', label: 'Mantorp Park - Long Circuit' },
        { id: 'layout-upcoming', label: 'Future Circuit - Grand Prix' }
    ];
    document.body.innerHTML = '<div id="results-container"></div>';
    window.TRACKS_DATA = tracks;
    window.R3EUtils = {
        escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character])),
        fetchWithTimeout: vi.fn().mockResolvedValue(options.fetchResponse || { ok: true }),
        getDailyRaceClassLogosHtml: vi.fn(() =>
            '<div class="daily-race-class-logos"><img class="daily-race-class-logo" src="class-logo.png" alt="Class logo"></div>'
        )
    };
    window.R3ETrackImages = {
        resolveTrackLogoById: vi.fn(trackId => `track-logo://${trackId}`)
    };
    window.CompressedJsonHelper = {
        readGzipJson: vi.fn().mockResolvedValue(data)
    };
    window.R3EAnalytics = { track: vi.fn() };
    window.rankedSeriesPage = null;
    loadBrowserScript('modules/pages/ranked-series.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    return window.rankedSeriesPage;
}

describe('ranked series page', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('renders a compact clickable tile with track and class logos', async () => {
        const page = setup({
            updated_at: '2026-11-16T19:18:42.628539Z',
            series: [makeSeries(), makeSeries('live')]
        });
        await page.ready;

        expect(document.querySelectorAll('.ranked-series-card')).toHaveLength(1);
        expect(document.querySelector('.ranked-series-header h2').textContent)
            .toBe('This Week in Ranked Multiplayer Series');
        expect(document.querySelector('.ranked-series-title-nowrap').textContent)
            .toBe('Ranked Multiplayer Series');
        expect(document.querySelector('.ranked-series-header').textContent).not.toContain('Last cache update');
        expect(document.querySelector('.ranked-series-card').textContent).toContain('Alpine Cup');
        expect(document.querySelector('.ranked-series-card').textContent).toContain('Mantorp Park');
        expect(document.querySelector('.ranked-series-card').textContent).toContain('Every 2 hours at :30');
        expect(document.querySelector('.ranked-series-card').textContent).toContain('15 min race');
        expect(document.querySelector('.ranked-series-card').textContent).not.toContain('Alpine A110 Cup');
        expect(document.querySelector('.ranked-series-item').textContent).not.toContain('Round 2 / 8');
        const cardTrack = document.querySelector('.ranked-series-card .daily-race-track > span');
        expect(cardTrack.firstChild.textContent).toBe('Mantorp Park');
        expect(cardTrack.querySelector('.daily-race-track-layout').textContent).toBe('Long Circuit');
        expect(document.querySelector('.ranked-series-card').textContent).not.toMatch(
            /RANKED SERIES|Active|Anchor|Session format|Race conditions|registered|Closes|Opens/
        );
        expect(document.querySelector('.ranked-series-card .daily-race-track-logo')).not.toBeNull();
        expect(document.querySelector('.ranked-series-card .daily-race-class-logo')).not.toBeNull();

        const currentLink = document.querySelector('.ranked-series-card-link');
        const currentUrl = new URL(currentLink.href);
        expect(currentLink.target).toBe('_blank');
        expect(currentUrl.searchParams.get('track')).toBe('layout-current');
        expect(currentUrl.searchParams.get('class')).toBe('class-1');
        expect(window.R3ETrackImages.resolveTrackLogoById).toHaveBeenCalledWith('layout-current');
    });

    it('groups fixed before open setups without otherwise changing their JSON order', async () => {
        const touring = { ...makeSeries(), name: 'Touring Cup' };
        const ignored = { ...makeSeries('live'), name: 'Ignored Series' };
        const zulu = { ...makeSeries(), name: 'Zulu Cup' };
        const alpine = { ...makeSeries(), name: 'Alpine Cup' };
        const dtm = { ...makeSeries(), name: 'DTM Cup' };
        const unknown = { ...makeSeries(), name: 'Unknown Setup' };
        const openSecond = { ...makeSeries(), name: 'Open Second' };
        touring.format.fixed_setup = false;
        dtm.format.fixed_setup = false;
        openSecond.format.fixed_setup = false;
        delete unknown.format.fixed_setup;
        touring.current_round = 4;
        const page = setup({ series: [touring, ignored, zulu, unknown, alpine, dtm, openSecond] });
        await page.ready;

        const names = [...document.querySelectorAll('.ranked-series-card h3')]
            .map(heading => heading.textContent);
        expect(names).toEqual(['Zulu Cup', 'Alpine Cup', 'Unknown Setup', 'Touring Cup', 'DTM Cup', 'Open Second']);
        expect(document.querySelector('.ranked-series-round-subtitle').textContent).toBe('Round 4');
    });

    it('shows the current round of the first leaderboard series in the header', async () => {
        const series = makeSeries();
        series.current_round = 3;
        const page = setup({ series: [makeSeries('live'), series] });
        await page.ready;

        expect(document.querySelector('.ranked-series-round-subtitle').textContent).toBe('Round 3');
    });

    it('shows an unavailable round instead of inventing one when round data is missing', async () => {
        const series = makeSeries();
        series.current_round = null;
        const page = setup({ series: [series] });
        await page.ready;

        expect(document.querySelector('.ranked-series-round-subtitle').textContent).toBe('Round unavailable');
    });

    it('formats daily start times and singular lap race duration', async () => {
        const series = makeSeries();
        series.schedule = { cadence_minutes: 0, anchor_minutes: [], daily_times: [90, 750] };
        series.format.races = [{ format: 'laps', length: 1 }];
        const page = setup({ series: [series] });
        await page.ready;

        const card = document.querySelector('.ranked-series-card');
        expect(card.textContent).toContain('Daily at 01:30, 12:30');
        expect(card.textContent).toContain('1 lap race');
    });

    it('shows fixed and open setup alongside the race duration', async () => {
        const fixed = makeSeries();
        const open = makeSeries();
        open.format.fixed_setup = false;
        const page = setup({ series: [fixed, open] });
        await page.ready;

        const tags = [...document.querySelectorAll('.ranked-series-card .daily-race-meta')]
            .map(meta => [...meta.querySelectorAll('.daily-race-tag')].map(tag => tag.textContent));
        expect(tags).toEqual([['15 min race', 'Fixed setup'], ['15 min race', 'Open setup']]);
    });

    it('does not infer setup from missing data and shows setup without a duration', async () => {
        const unknown = makeSeries();
        delete unknown.format.fixed_setup;
        const withoutRace = makeSeries();
        withoutRace.format.races = [];
        const page = setup({ series: [unknown, withoutRace] });
        await page.ready;

        const tags = [...document.querySelectorAll('.ranked-series-card .daily-race-meta')]
            .map(meta => [...meta.querySelectorAll('.daily-race-tag')].map(tag => tag.textContent));
        expect(tags).toEqual([['15 min race'], ['Fixed setup']]);
    });

    it('uses the full track label mapped from the layout ID', async () => {
        const series = makeSeries();
        series.rounds[1].track = {
            track_id: 'store-track',
            layout_id: '12112',
            name: '2001',
            layout: 'Grand Prix'
        };
        const page = setup(
            { series: [series] },
            { tracks: [{ id: '12112', label: 'Hockenheimring - 2001' }] }
        );
        await page.ready;

        const trackDisplay = document.querySelector('.ranked-series-card .daily-race-track > span');
        expect(trackDisplay.firstChild.textContent).toBe('Hockenheimring');
        expect(trackDisplay.querySelector('.daily-race-track-layout').textContent).toBe('2001');
        expect(trackDisplay.textContent).not.toContain('2001 Grand Prix');
    });

    it('links each season round and distinguishes the current and previous rounds', async () => {
        const page = setup({ series: [makeSeries()] });
        await page.ready;

        const previousRound = document.querySelector('.ranked-series-round--previous');
        const currentRound = document.querySelector('.ranked-series-round--current');
        expect(previousRound).not.toBeNull();
        expect(currentRound).not.toBeNull();
        expect(previousRound.querySelector('.ranked-series-round-info strong').textContent)
            .toBe('Previous Circuit');
        expect(previousRound.querySelector('.ranked-series-round-layout').textContent).toBe('Short');
        expect(currentRound.textContent).toContain('Current');

        for (const [selector, track, classId] of [
            ['.ranked-series-round--previous', 'layout-previous', 'class-old'],
            ['.ranked-series-round--current', 'layout-current', 'class-1'],
            ['.ranked-series-round--upcoming', 'layout-upcoming', 'class-1']
        ]) {
            const link = document.querySelector(`${selector} a`);
            const url = new URL(link.href);
            expect(link.target).toBe('_blank');
            expect(link.rel).toBe('noopener noreferrer');
            expect(url.searchParams.get('track')).toBe(track);
            expect(url.searchParams.get('class')).toBe(classId);
        }
    });

    it('does not link rounds without a track or eligible class', async () => {
        const series = makeSeries();
        series.eligible_classes = [];
        series.rounds[1].track = {};
        series.rounds[2].eligible_classes = [];
        const page = setup({ series: [series] });
        await page.ready;

        expect(document.querySelector('.ranked-series-round--previous a')).not.toBeNull();
        expect(document.querySelector('.ranked-series-round--current a')).toBeNull();
        expect(document.querySelector('.ranked-series-round--upcoming a')).toBeNull();
    });

    it('opens the season schedule independently of the series link', async () => {
        const page = setup({ series: [makeSeries()] });
        await page.ready;

        const item = document.querySelector('.ranked-series-item');
        const cardLink = item.querySelector('.ranked-series-card-link');
        const schedule = item.querySelector('.ranked-series-rounds');
        const cardClick = vi.fn();
        cardLink.addEventListener('click', cardClick);

        schedule.querySelector('summary').click();
        expect(schedule.open).toBe(true);
        expect(cardClick).not.toHaveBeenCalled();
        expect(schedule.closest('a')).toBeNull();
        schedule.querySelector('summary').click();
        expect(schedule.open).toBe(false);
    });

    it('closes schedules on outside clicks but not on clicks inside them', async () => {
        const page = setup({ series: [makeSeries(), makeSeries()] });
        await page.ready;

        const [first, second] = document.querySelectorAll('.ranked-series-rounds');
        first.querySelector('summary').click();
        const link = first.querySelector('.ranked-series-round-link');
        link.addEventListener('click', event => event.preventDefault());
        link.querySelector('strong').click();
        expect(first.open).toBe(true);

        second.querySelector('summary').click();
        expect(first.open).toBe(false);
        expect(second.open).toBe(true);

        document.body.click();
        expect(second.open).toBe(false);
    });

    it('uses the combined classes detail route for multi-class rounds', async () => {
        const series = makeSeries();
        series.rounds[1].eligible_classes = [
            { id: 'class-1', name: 'Class One' },
            { id: 'class-2', name: 'Class Two' }
        ];
        const page = setup({ series: [series] });
        await page.ready;

        const currentUrl = new URL(document.querySelector('.ranked-series-card-link').href);
        expect(currentUrl.searchParams.get('class')).toBeNull();
        expect(currentUrl.searchParams.get('classes')).toBe('class-1,class-2');
        const roundUrl = new URL(document.querySelector('.ranked-series-round--current a').href);
        expect(roundUrl.searchParams.get('track')).toBe('layout-current');
        expect(roundUrl.searchParams.get('class')).toBeNull();
        expect(roundUrl.searchParams.get('classes')).toBe('class-1,class-2');
    });

    it('escapes series and track labels before inserting them into the page', async () => {
        const series = makeSeries();
        series.name = '<img src=x onerror=alert(1)>';
        const page = setup({ series: [series] });
        window.TRACKS_DATA.find(track => track.id === 'layout-current').label = '<script>bad()</script>';
        await page.ready;

        expect(document.querySelector('.ranked-series-card img[src="x"]')).toBeNull();
        expect(document.querySelector('.ranked-series-card script')).toBeNull();
        expect(document.querySelector('.ranked-series-card h3').textContent).toBe(series.name);
    });

    it('shows an explicit error state when the compressed payload is invalid', async () => {
        const page = setup({ series: null });
        await page.ready;

        expect(document.querySelector('[role="alert"]').textContent)
            .toContain('Unable to load ranked series information');
        expect(console.error).toHaveBeenCalled();
    });

    it('shows an explicit error state when fetching ranked data fails', async () => {
        const page = setup({}, { fetchResponse: { ok: false, status: 503 } });
        await page.ready;

        expect(document.querySelector('[role="alert"]').textContent)
            .toContain('Unable to load ranked series information');
        expect(console.error).toHaveBeenCalled();
        expect(window.R3EAnalytics.track).not.toHaveBeenCalled();
    });

    it('shows an empty state when no leaderboard-qualifying series exist', async () => {
        const page = setup({ series: [makeSeries('live')] });
        await page.ready;

        expect(document.querySelector('.ranked-series-card')).toBeNull();
        expect(document.querySelector('.ranked-series-state').textContent)
            .toContain('No leaderboard-qualifying series are available');
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith('ranked page shown', { series_count: 0 });
    });

    it('tracks the first rendered ranked page only once', async () => {
        const page = setup({ series: [makeSeries(), makeSeries('live')] });
        expect(window.R3EAnalytics.track).not.toHaveBeenCalled();
        await page.ready;
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith('ranked page shown', { series_count: 1 });
        await page.init();
        expect(window.R3EAnalytics.track).toHaveBeenCalledTimes(1);
    });
});
