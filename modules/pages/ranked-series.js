/**
 * Ranked Series page
 * Displays official ranked multiplayer series and their season details.
 */

(function () {
    const DATA_URL = 'cache/ranked_series.json.gz';
    const FETCH_TIMEOUT_MS = 15000;

    function escapeHtml(value) {
        return window.R3EUtils.escapeHtml(value);
    }

    function formatClock(minutes) {
        if (minutes === null || minutes === undefined || minutes === '') return '';
        const value = Number(minutes);
        if (!Number.isFinite(value) || value < 0) return '';
        const normalized = Math.floor(value) % 1440;
        const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
        const minutePart = String(normalized % 60).padStart(2, '0');
        return `${hours}:${minutePart}`;
    }

    function formatCadence(minutes) {
        if (minutes === null || minutes === undefined || minutes === '') return '';
        const value = Number(minutes);
        if (!Number.isFinite(value) || value <= 0) return '';
        if (value === 60) return 'Every hour';
        if (value % 60 === 0) return `Every ${value / 60} hours`;
        return `Every ${value} minutes`;
    }

    function formatDateTime(timestamp) {
        if (timestamp === null || timestamp === undefined || timestamp === '') return '';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
            timeZoneName: 'short'
        }).format(date);
    }

    function formatRoundDateRange(startsAt, endsAt) {
        const start = new Date(startsAt);
        const end = new Date(endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

        const day = date => new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            timeZone: 'UTC'
        }).format(date);
        const month = date => new Intl.DateTimeFormat('en-GB', {
            month: 'short',
            timeZone: 'UTC'
        }).format(date);
        const year = date => new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            timeZone: 'UTC'
        }).format(date);
        const sameMonth = start.getUTCMonth() === end.getUTCMonth()
            && start.getUTCFullYear() === end.getUTCFullYear();
        const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

        if (sameMonth) return `${day(start)}-${day(end)} ${month(end)} ${year(end)}`;
        if (sameYear) return `${day(start)} ${month(start)}-${day(end)} ${month(end)} ${year(end)}`;
        return `${formatDateTime(start).split(', ')[0]}-${formatDateTime(end).split(', ')[0]}`;
    }

    function formatSchedule(schedule) {
        if (!schedule || typeof schedule !== 'object') return 'Schedule not provided';

        const cadence = formatCadence(schedule.cadence_minutes);
        const anchors = Array.isArray(schedule.anchor_minutes)
            ? schedule.anchor_minutes.map(formatClock).filter(Boolean)
            : [];
        const dailyTimes = Array.isArray(schedule.daily_times)
            ? schedule.daily_times.map(formatClock).filter(Boolean)
            : [];
        const parts = [];

        if (cadence && anchors.length && Number(schedule.cadence_minutes) % 60 === 0) {
            const minuteMarks = [...new Set(anchors.map(time => time.slice(-2)))];
            parts.push(`${cadence} at ${minuteMarks.map(minute => `:${minute}`).join(', ')}`);
        } else if (cadence && anchors.length) {
            parts.push(`${cadence} from ${anchors.join(', ')}`);
        } else if (cadence) {
            parts.push(cadence);
        }
        if (dailyTimes.length) parts.push(`Daily at ${dailyTimes.join(', ')}`);

        return parts.length ? parts.join(' / ') : 'Schedule not provided';
    }

    function formatRaceDuration(race) {
        if (!race || typeof race !== 'object') return '';
        const length = Number(race.length);
        if (!Number.isFinite(length) || length <= 0) return '';
        if (race.format === 'minutes') return `${length} min`;
        if (race.format === 'laps') return `${length} ${length === 1 ? 'lap' : 'laps'}`;
        return '';
    }

    function getCurrentRound(series) {
        const rounds = Array.isArray(series.rounds) ? series.rounds : [];
        return rounds.find(round => Number(round.number) === Number(series.current_round))
            || rounds.find(round => round.status === 'active')
            || rounds.find(round => round.status === 'upcoming')
            || rounds[0]
            || null;
    }

    function getRoundClasses(round, series) {
        return round && Array.isArray(round.eligible_classes) && round.eligible_classes.length
            ? round.eligible_classes
            : Array.isArray(series.eligible_classes) ? series.eligible_classes : [];
    }

    function getDetailUrl(round, classes) {
        const track = round && round.track;
        const trackId = track && (track.layout_id || track.track_id);
        const classIds = classes.map(item => String(item && item.id || '').trim()).filter(Boolean);
        if (!trackId || classIds.length === 0) return '';

        const params = new URLSearchParams();
        params.set('track', String(trackId));
        if (classIds.length === 1) {
            params.set('class', classIds[0]);
        } else {
            params.set('classes', classIds.join(','));
        }
        return `detail.html?${params.toString()}`;
    }

    function getTrackLabel(track) {
        const trackId = track && (track.layout_id || track.track_id);
        const tracks = Array.isArray(window.TRACKS_DATA) ? window.TRACKS_DATA : [];
        const match = tracks.find(item => String(item.id) === String(trackId));
        if (match && match.label) return match.label;
        return [track && track.name, track && track.layout].filter(Boolean).join(' - ');
    }

    function getTrackDisplayParts(track) {
        const label = getTrackLabel(track);
        const separatorIndex = label.indexOf(' - ');
        if (separatorIndex === -1) return { name: label, layout: '' };

        return {
            name: label.slice(0, separatorIndex),
            layout: label.slice(separatorIndex + 3)
        };
    }

    function getTrackLogoHtml(track, className) {
        const trackId = track && (track.layout_id || track.track_id);
        const trackLabel = getTrackLabel(track);
        const images = window.R3ETrackImages;
        const logoUrl = images && typeof images.resolveTrackLogoById === 'function'
            ? images.resolveTrackLogoById(trackId, trackLabel)
            : '';
        if (!logoUrl) return '';

        return `<img class="${className}" src="${escapeHtml(logoUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
    }

    function getClassLogosHtml(classes, wrapperClass = '') {
        const utils = window.R3EUtils;
        if (!utils || typeof utils.getDailyRaceClassLogosHtml !== 'function') return '';
        const classIds = classes.map(item => String(item && item.id || '').trim()).filter(Boolean);
        if (classIds.length === 0) return '';
        const classNames = new Map(classes.map(item => [String(item.id), item.name || '']));
        const logos = utils.getDailyRaceClassLogosHtml(
            { category_class_ids: classIds },
            id => classNames.get(String(id)) || (window.getCarClassName ? window.getCarClassName(id) : String(id)),
            classes.map(item => item && item.name).filter(Boolean).join(' + ')
        );
        return logos && wrapperClass ? `<div class="${wrapperClass}">${logos}</div>` : logos;
    }

    class RankedSeriesPage {
        constructor() {
            this.resultsContainer = document.getElementById('results-container');
            this.ready = this.init();
        }

        async loadData() {
            if (!window.R3EUtils || typeof window.R3EUtils.fetchWithTimeout !== 'function') {
                throw new Error('R3EUtils is not loaded.');
            }
            if (!window.CompressedJsonHelper
                || typeof window.CompressedJsonHelper.readGzipJson !== 'function') {
                throw new Error('CompressedJsonHelper is not loaded.');
            }

            const response = await window.R3EUtils.fetchWithTimeout(
                `${DATA_URL}?v=${Date.now()}`,
                { cache: 'no-store' },
                FETCH_TIMEOUT_MS
            );
            if (!response.ok) {
                throw new Error(`Failed to load ranked series: ${response.status}`);
            }

            const data = await window.CompressedJsonHelper.readGzipJson(response);
            if (!data || !Array.isArray(data.series)) {
                throw new Error('Ranked series data has an invalid format.');
            }
            return data;
        }

        async init() {
            if (!this.resultsContainer) return;
            this.resultsContainer.innerHTML = `
                <div class="ranked-series-state" role="status">
                    <span class="ranked-series-spinner" aria-hidden="true"></span>
                    <p>Loading ranked series...</p>
                </div>
            `;

            try {
                const data = await this.loadData();
                const series = data.series.filter(item =>
                    item && item.format && item.format.qualifying_type === 'leaderboard'
                );
                this.render(series);
            } catch (error) {
                console.error('Error loading ranked series:', error);
                this.resultsContainer.innerHTML = `
                    <div class="ranked-series-state ranked-series-state--error" role="alert">
                        <h2>Ranked multiplayer</h2>
                        <p>Unable to load ranked series information. Please try again later.</p>
                    </div>
                `;
            }
        }

        render(series) {
            if (!series.length) {
                this.resultsContainer.innerHTML = `
                    <div class="ranked-series-state">
                        <h2>Ranked multiplayer</h2>
                        <p>No leaderboard-qualifying series are available right now.</p>
                    </div>
                `;
                return;
            }

            const cards = series.map(item => this.renderSeries(item)).join('');
            const round = Number(series[0].current_round);
            const roundLabel = Number.isInteger(round) && round > 0 ? `Round ${round}` : 'Round unavailable';
            this.resultsContainer.innerHTML = `
                <section class="daily-races-container ranked-series-container" aria-label="Ranked multiplayer schedule">
                    <header class="daily-races-header ranked-series-header">
                        <h2>This Week in <span class="ranked-series-title-nowrap">Ranked Multiplayer Series</span></h2>
                        <p class="ranked-series-round-subtitle">${roundLabel}</p>
                        <p class="daily-races-cta">Enter the leaderboards to secure your qualification!</p>
                    </header>
                    <div class="ranked-series-grid">${cards}</div>
                </section>
            `;
        }

        renderSeries(series) {
            const rounds = Array.isArray(series.rounds) ? series.rounds : [];
            const currentRound = getCurrentRound(series);
            const currentClasses = getRoundClasses(currentRound, series);
            const track = currentRound && currentRound.track ? currentRound.track : {};
            const trackDisplay = getTrackDisplayParts(track);
            const detailUrl = getDetailUrl(currentRound, currentClasses);
            const classLogos = getClassLogosHtml(currentClasses);
            const trackLogo = getTrackLogoHtml(track, 'daily-race-track-logo');
            const duration = Array.isArray(series.format && series.format.races)
                ? series.format.races.map(formatRaceDuration).filter(Boolean).join(' / ')
                : '';
            const schedule = formatSchedule(series.schedule);
            const cardContent = `
                <div class="daily-race-card ranked-series-card">
                    <div class="daily-race-content">
                        <div class="ranked-series-card-heading">
                            <h3>${escapeHtml(series.name || 'Unnamed series')}</h3>
                        </div>
                        ${classLogos}
                        <div class="daily-race-track">
                            ${trackLogo}
                            <span>${escapeHtml(trackDisplay.name || 'Track not specified')}${trackDisplay.layout
                                ? `<br><span class="daily-race-track-layout">${escapeHtml(trackDisplay.layout)}</span>`
                                : ''}</span>
                        </div>
                        <div class="daily-race-schedule">${escapeHtml(schedule)}</div>
                        ${duration ? `<div class="daily-race-meta"><span class="daily-race-tag">${escapeHtml(duration)} race</span></div>` : ''}
                    </div>
                </div>
            `;
            const linkedCard = detailUrl
                ? `<a href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer" class="daily-race-card-link ranked-series-card-link">${cardContent}</a>`
                : `<div class="ranked-series-card-link">${cardContent}</div>`;
            const seasonSchedule = rounds.length ? this.renderRounds(series, rounds, currentRound) : '';

            return `
                <article class="ranked-series-item">
                    ${linkedCard}
                    ${seasonSchedule}
                </article>
            `;
        }

        renderRounds(series, rounds, currentRound) {
            const currentNumber = currentRound ? Number(currentRound.number) : Number(series.current_round);
            const items = rounds.map(round => {
                const track = round.track || {};
                const trackDisplay = getTrackDisplayParts(track);
                const classes = getRoundClasses(round, series);
                const detailUrl = getDetailUrl(round, classes);
                const roundNumber = Number(round.number);
                const isCurrent = currentRound && roundNumber === Number(currentRound.number);
                const isPrevious = !isCurrent && (round.status === 'finished'
                    || (Number.isFinite(currentNumber) && roundNumber < currentNumber));
                const stateClass = isCurrent
                    ? 'ranked-series-round--current'
                    : isPrevious ? 'ranked-series-round--previous' : 'ranked-series-round--upcoming';
                const trackLogo = getTrackLogoHtml(track, 'ranked-series-round-logo');
                const classNames = classes.map(item => item && item.name).filter(Boolean).join(' + ');
                const dateRange = formatRoundDateRange(round.starts_at, round.ends_at);
                const content = `
                    <span class="ranked-series-round-number">Round ${escapeHtml(round.number)}</span>
                    ${trackLogo}
                    <span class="ranked-series-round-info">
                        <strong>${escapeHtml(trackDisplay.name || 'Track not specified')}</strong>
                        ${trackDisplay.layout ? `<span class="ranked-series-round-layout">${escapeHtml(trackDisplay.layout)}</span>` : ''}
                        ${classNames ? `<small>${escapeHtml(classNames)}</small>` : ''}
                        ${dateRange ? `<time>${escapeHtml(dateRange)}</time>` : ''}
                    </span>
                    ${isCurrent ? '<span class="ranked-series-round-current-label">Current</span>' : ''}
                `;
                return `
                    <li class="ranked-series-round ${stateClass}">
                        ${isPrevious && detailUrl
                            ? `<a class="ranked-series-round-link" href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer">${content}</a>`
                            : `<div class="ranked-series-round-link">${content}</div>`}
                    </li>
                `;
            }).join('');

            return `
                <details class="ranked-series-rounds">
                    <summary>Season schedule</summary>
                    <ol>${items}</ol>
                </details>
            `;
        }
    }

    if (document.readyState === 'complete') {
        window.rankedSeriesPage = new RankedSeriesPage();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            window.rankedSeriesPage = new RankedSeriesPage();
        }, { once: true });
    }
})();
