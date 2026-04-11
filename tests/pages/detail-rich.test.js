import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="detail-track"></div>',
        '<div id="detail-class"></div>',
        '<p id="detail-subtitle"></p>',
        '<div id="car-filter-ui"></div>',
        '<div id="difficulty-filter-ui"></div>',
        '<div id="detail-results-container"></div>'
    ].join('');
}

function makeEntry({ pos, name, lapTime, car, difficulty, dateTime, classId = 5, className = 'GT3' }) {
    return {
        Position: pos,
        Name: name,
        LapTime: lapTime,
        Car: car,
        Difficulty: difficulty,
        date_time: dateTime,
        Country: 'SE',
        track_id: 10,
        class_id: classId,
        car_class: {
            class: {
                Name: className,
                Id: classId
            }
        }
    };
}

function setupGlobals() {
    window.history.replaceState({}, '', '/detail.html?track=10&class=5&driver=alice&time=1:20.000&pos=2&difficulty=All%20difficulties');

    window.R3EAnalytics = { track: vi.fn() };

    window.R3EUtils = {
        getUrlParam: (name) => {
            const params = new URLSearchParams(window.location.search);
            return params.get(name) || '';
        },
        escapeHtml: value => String(value ?? ''),
        formatDate: value => String(value ?? ''),
        getPositionBadgeColor: () => '#abcdef',
        getTotalEntriesCount: (entry) => Number(entry.TotalEntries || 0),
        resolveCarClassLogo: vi.fn(() => '/images/gt3.webp'),
        splitCarName: (carName) => {
            const raw = String(carName || '');
            const spaceIdx = raw.indexOf(' ');
            if (spaceIdx === -1) return { brand: raw, model: '' };
            return {
                brand: raw.slice(0, spaceIdx),
                model: raw.slice(spaceIdx + 1)
            };
        },
        matchesCarFilterValue: (car, selected) => {
            if (!selected || selected === 'All cars') return true;
            return String(car || '') === String(selected);
        },
        findCarCombinations: () => [],
        findCombinationForCar: () => null,
        isLastInCarGroup: () => false
    };

    window.FIELD_NAMES = {
        DIFFICULTY: ['Difficulty', 'difficulty', 'driving_model'],
        CAR: ['Car', 'car']
    };
    window.getField = (obj, fields, defaultValue = '') => {
        for (const field of fields) {
            if (obj && obj[field] !== undefined && obj[field] !== null) {
                return obj[field];
            }
        }
        return defaultValue;
    };

    window.TemplateHelper = {
        showLoading: vi.fn(async (container) => {
            container.innerHTML = '<div class="loading">Loading...</div>';
        }),
        showError: vi.fn(async (container, message) => {
            container.innerHTML = `<div class="error">${message}</div>`;
        }),
        showNoResults: vi.fn(async (container) => {
            container.innerHTML = '<div class="no-results">No results</div>';
        }),
        generateTable: vi.fn((headers, rowsHtml) => {
            const headersHtml = headers.map(h => `<th>${h}</th>`).join('');
            return `<table class="results-table"><thead><tr>${headersHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
        }),
        generatePagination: vi.fn(() => '<div class="pagination">pagination</div>')
    };

    window.DataNormalizer = {
        normalizeLeaderboardEntry: (entry) => ({ ...entry, TotalEntries: 3 }),
        normalizeTrackName: (name) => String(name).replace('Old', 'New'),
        extractPosition: item => Number(item.Position || item.position || item.Pos || 0),
        extractName: item => String(item.Name || item.name || ''),
        extractCountry: item => String(item.Country || item.country || ''),
        extractCar: item => String(item.Car || item.car || ''),
        extractDifficulty: item => String(item.Difficulty || item.difficulty || ''),
        extractLapTime: item => String(item.LapTime || item['Lap Time'] || item.lap_time || ''),
        extractTrackId: item => item.track_id || '',
        extractClassId: item => item.class_id || ''
    };

    window.ColumnConfig = {
        getDisplayName: key => String(key),
        getOrderedColumns: key => key,
        isColumnType: () => false
    };

    window.tableRenderer = {
        renderDetailPositionCell: (item) => {
            const position = item.Position || 0;
            const total = item.TotalEntries || 0;
            return `<td class="pos-cell"><span class="pos-number">${position}</span><span class="pos-total">${total}</span></td>`;
        },
        renderDriverNameCell: (item, opts) => `<td><a class="${opts.driverLinkClass}" href="${opts.driverLinkBase}${encodeURIComponent(item.Name)}">${item.Name}</a></td>`,
        renderLapTimeCell: lapTime => `<td>${lapTime}</td>`,
        renderGapTimeCell: () => '<td>+0.000</td>',
        renderGapPercentCell: () => '<td>0.00%</td>',
        renderCell: (item, key) => `<td>${item[key] ?? item[key.toLowerCase()] ?? ''}</td>`,
        renderDetailSections: (resultsContainer, summaryHTML, entriesDistHTML, paginationHTML, tableWrapperHTML) => {
            const html = `${summaryHTML || ''}${entriesDistHTML || ''}${paginationHTML || ''}${tableWrapperHTML || ''}${paginationHTML || ''}`;
            resultsContainer.innerHTML = html;
        },
        renderDetailRow: (item, options = {}) => {
            const isCombinedView = !!options.isCombinedView;
            const totalEntries = isCombinedView ? (options.allResultsLength || 0) : Number(item.TotalEntries || 0);
            const name = String(item.Name || item.name || '');
            const lapTime = String(item.LapTime || item['Lap Time'] || item.lap_time || '');
            const rowTrackId = item.track_id || options.trackParam || '';
            const rowClassId = item.class_id || '';

            const rowItem = {
                ...item,
                Name: name,
                LapTime: lapTime,
                Position: Number(item.Position || item.position || item.Pos || 0),
                TotalEntries: totalEntries
            };
            if (isCombinedView) {
                rowItem.CarClass = item.ClassName || item.class_name || item.CarClass || item.car_class || '';
            }

            let html = `<tr data-trackid="${rowTrackId}" data-classid="${rowClassId}" data-name="${name}" data-time="${lapTime}">`;
            html += window.tableRenderer.renderDetailPositionCell(rowItem, { showAbsolutePosition: !!options.showAbsolutePosition });
            html += window.tableRenderer.renderDriverNameCell(rowItem, { driverLinkClass: 'detail-driver-link', driverLinkBase: 'drivers.html?driver=' });
            html += window.tableRenderer.renderLapTimeCell(lapTime, { includeDelta: false });
            html += window.tableRenderer.renderGapTimeCell(lapTime);
            html += window.tableRenderer.renderGapPercentCell(rowItem, null);
            if (isCombinedView) {
                html += window.tableRenderer.renderCell(rowItem, 'CarClass');
            }
            html += window.tableRenderer.renderCell(rowItem, 'Car');
            html += window.tableRenderer.renderCell(rowItem, 'Difficulty');
            html += window.tableRenderer.renderCell(rowItem, 'date_time');
            html += '</tr>';
            return html;
        }
    };

    window.CustomSelect = class {
        constructor(rootId, options, onChange) {
            this.rootId = rootId;
            this.options = options;
            this.onChange = onChange;
            this.value = '';
            window.__customSelects = window.__customSelects || {};
            window.__customSelects[rootId] = this;
        }

        getValue() {
            return this.value;
        }

        setValue(nextValue, options = {}) {
            this.value = nextValue || '';
            const shouldNotify = options.notify !== false;
            if (shouldNotify && typeof this.onChange === 'function') {
                this.onChange(nextValue, { source: options.source || 'test' });
            }
        }

        setOptions(nextOptions) {
            this.options = nextOptions;
        }
    };

    const leaderboard = [
        makeEntry({ pos: 3, name: 'charlie', lapTime: '1:24.500', car: 'BMW M4', difficulty: 'Amateur', dateTime: '2026-04-02T12:00:00Z' }),
        makeEntry({ pos: 2, name: 'alice', lapTime: '1:20.000', car: 'Audi R8', difficulty: 'Get Real', dateTime: '2026-04-03T12:00:00Z' }),
        makeEntry({ pos: 1, name: 'bob', lapTime: '1:19.100', car: 'Audi R8', difficulty: 'Get Real', dateTime: '2026-04-04T12:00:00Z' })
    ];

    window.dataService = {
        fetchLeaderboardDetails: vi.fn().mockResolvedValue({
            track_info: {
                Name: 'Old Spa - Grand Prix',
                ClassName: 'GT3',
                ClassId: 5
            },
            leaderboard
        }),
        extractLeaderboardArray: vi.fn((payload) => payload.leaderboard),
        enrichEntriesWithDriverMetadata: vi.fn(async entries => entries)
    };

    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = vi.fn();
    }
    window.open = vi.fn();
}

beforeAll(async () => {
    document.body.innerHTML = buildDom();
    setupGlobals();

    loadBrowserScript('modules/detail-difficulty-filter.js');
    loadBrowserScript('pages/detail.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await new Promise(resolve => setTimeout(resolve, 80));
});

describe('detail page rich integration', () => {
    it('renders normalized titles, class logo, and initial table rows', () => {
        const trackHtml = document.getElementById('detail-track').innerHTML;
        const classHtml = document.getElementById('detail-class').innerHTML;
        const tableRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr');

        expect(window.dataService.fetchLeaderboardDetails).toHaveBeenCalledWith('10', '5');
        expect(trackHtml).toContain('New Spa');
        expect(trackHtml).toContain('Track:');
        expect(classHtml).toContain('Class:');
        expect(classHtml).toContain('/images/gt3.webp');
        expect(tableRows.length).toBe(3);
    });

    it('tracks detail view analytics once from URL parameters', () => {
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'detail page viewed',
            expect.objectContaining({
                track_id: '10',
                class_param: '5',
                driver_param: 'alice',
                time_param: '1:20.000'
            })
        );
    });

    it('applies difficulty badge toggles and car filter and tracks user filter analytics', async () => {
        const carSelect = window.__customSelects['car-filter-ui'];
        const getRealBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Get Real"]');

        getRealBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        await new Promise(resolve => setTimeout(resolve, 0));

        let rows = document.querySelectorAll('#detail-results-container table.results-table tbody tr');
        expect(rows.length).toBe(1);
        expect(document.getElementById('detail-results-container').innerHTML).toContain('charlie');

        carSelect.setValue('BMW M4', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 0));

        rows = document.querySelectorAll('#detail-results-container table.results-table tbody tr');
        expect(rows.length).toBe(1);

        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'detail filter changed',
            expect.objectContaining({
                selected_difficulty: 'Amateur, Novice',
                selected_car: 'BMW M4',
                result_count: 1
            })
        );

        const refreshedGetRealBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Get Real"]');
        refreshedGetRealBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        carSelect.setValue('', { source: 'user' });
    });

    it('does not allow disabling the last active difficulty badge', async () => {
        const initiallyInactive = document.querySelectorAll('#difficulty-filter-ui button[aria-pressed="false"]');
        initiallyInactive.forEach(badge => badge.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        await new Promise(resolve => setTimeout(resolve, 0));

        const getRealBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Get Real"]');
        const amateurBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Amateur"]');

        amateurBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));

        const noviceBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Novice"]');
        noviceBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));

        const lockedGetRealBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Get Real"]');
        expect(lockedGetRealBadge.hasAttribute('disabled')).toBe(true);

        lockedGetRealBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));

        const refreshedGetRealBadge = document.querySelector('#difficulty-filter-ui button[data-difficulty="Get Real"]');
        expect(refreshedGetRealBadge.getAttribute('aria-pressed')).toBe('true');

        const inactiveBadges = document.querySelectorAll('#difficulty-filter-ui button[aria-pressed="false"]');
        inactiveBadges.forEach(badge => badge.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    });

    it('highlights the target row and opens RaceRoom leaderboard when the row is clicked', async () => {
        const carSelect = window.__customSelects['car-filter-ui'];
        carSelect.setValue('', { source: 'user' });

        const inactiveBadges = document.querySelectorAll('#difficulty-filter-ui button[aria-pressed="false"]');
        inactiveBadges.forEach(badge => badge.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        await new Promise(resolve => setTimeout(resolve, 80));

        const highlighted = document.querySelector('#detail-results-container tr.highlight-row');
        expect(highlighted).toBeTruthy();

        highlighted.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(window.open).toHaveBeenCalledWith(
            'https://game.raceroom.com/leaderboard/?track=10&car_class=class-5',
            '_blank'
        );
    });
});

