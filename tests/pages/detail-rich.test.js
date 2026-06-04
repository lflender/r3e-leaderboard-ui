import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="detail-track"></div>',
        '<div id="detail-class"></div>',
        '<p id="detail-subtitle"></p>',
        '<div id="detail-filters-stash" style="display:none;">',
        '<div id="car-filter-ui"></div>',
        '<div id="difficulty-filter-ui"></div>',
        '</div>',
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
            const car = String(item.Car || item.car || '');

            const rowDate = String(item.date_time || item.dateTime || item.Date || '');
            let html = `<tr data-trackid="${rowTrackId}" data-classid="${rowClassId}" data-name="${name}" data-time="${lapTime}" data-car="${car}" data-date="${rowDate}">`;
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

    window.CarsChart = {
        generateHtml: vi.fn((data) => {
            const counts = data.reduce((acc, entry) => {
                const carName = String(entry.Car || entry.car || 'Unknown');
                acc[carName] = (acc[carName] || 0) + 1;
                return acc;
            }, {});
            const rows = Object.entries(counts)
                .map(([carName, count]) => `<tr data-car="${carName}"><td class="car-dist-car">${carName}</td><td class="car-dist-entries">${count}</td></tr>`)
                .join('');
            return [
                '<div class="car-dist-summary" data-sort-by="entries" data-sort-dir="desc">',
                '<button type="button" class="car-dist-toggle is-expanded" aria-expanded="true" aria-controls="test-car-dist">',
                '<span class="car-dist-toggle__icon">▼</span>',
                '<span class="car-dist-toggle-text">Car Distribution Summary</span>',
                '</button>',
                '<div id="test-car-dist" class="car-dist-content" style="display: ;">',
                `<table class="car-dist-table"><tbody>${rows}</tbody></table>`,
                '</div>',
                '</div>'
            ].join('');
        }),
        getCarDistributionStats: vi.fn().mockReturnValue([])
    };

    window.EntriesChart = {
        generateHtml: vi.fn((data) => {
            const dayCounts = data.reduce((acc, entry) => {
                const dayKey = String(entry.date_time || entry.dateTime || entry.Date || '').slice(0, 10);
                if (!dayKey) return acc;
                acc[dayKey] = (acc[dayKey] || 0) + 1;
                return acc;
            }, {});
            const bars = Object.entries(dayCounts)
                .map(([dayKey, count], idx) => `<rect class="entries-dist-bar" x="${idx}" y="10" width="0.9" height="80" data-date="${dayKey}" data-count="${count}"></rect>`)
                .join('');
            return [
                '<div class="entries-dist-summary">',
                '<button type="button" class="entries-dist-toggle is-expanded" aria-expanded="true" aria-controls="test-entries">Entries</button>',
                '<div id="test-entries" class="entries-dist-content" style="">',
                '<div class="entries-dist-chart">',
                `<svg viewBox="0 0 10 100" preserveAspectRatio="none">${bars}</svg>`,
                '</div>',
                '</div>',
                '</div>'
            ].join('');
        }),
        parseEntryDate: vi.fn(),
        getLocalDateKey: vi.fn(),
        getDataTimeBounds: vi.fn().mockReturnValue({ min: null, max: null }),
        toLocalDateInputValue: vi.fn().mockReturnValue(''),
        applyTimeframeFilter: vi.fn(data => data)
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

    loadBrowserScript('modules/difficulty-filter.js');
    loadBrowserScript('modules/pages/detail.js');
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
        expect(classHtml).toContain('/images/gt3.webp');
        expect(tableRows.length).toBe(3);
    });

    it('tracks detail view analytics once from URL parameters', () => {
        expect(window.R3EAnalytics.track).toHaveBeenCalledWith(
            'detail page shown',
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
        expect(window.localStorage.getItem('detailDifficultyPreference')).toBe('Amateur, Novice');

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

    it('cross-highlights matching car rows between leaderboard and car distribution summary', async () => {
        const mainRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-car]');
        const summaryRows = document.querySelectorAll('#detail-results-container .car-dist-table tbody tr[data-car]');
        const audiMainRow = Array.from(mainRows).find(row => row.getAttribute('data-car') === 'Audi R8');
        const bmwMainRow = Array.from(mainRows).find(row => row.getAttribute('data-car') === 'BMW M4');
        const audiSummaryRow = Array.from(summaryRows).find(row => row.getAttribute('data-car') === 'Audi R8');
        const bmwSummaryRow = Array.from(summaryRows).find(row => row.getAttribute('data-car') === 'BMW M4');

        audiMainRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const highlightedMainAudiRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr.car-row-highlight[data-car="Audi R8"]');
        expect(highlightedMainAudiRows.length).toBe(2);
        expect(audiSummaryRow.classList.contains('car-dist-row-highlight')).toBe(true);
        expect(bmwSummaryRow.classList.contains('car-dist-row-highlight')).toBe(false);

        bmwSummaryRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        expect(bmwMainRow.classList.contains('car-row-highlight')).toBe(true);
        expect(audiMainRow.classList.contains('car-row-highlight')).toBe(false);
        expect(bmwSummaryRow.classList.contains('car-dist-row-highlight')).toBe(true);
    });

    it('clears car highlights when mouse leaves the main table body', async () => {
        const mainRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-car]');
        const summaryRows = document.querySelectorAll('#detail-results-container .car-dist-table tbody tr[data-car]');
        const tbody = document.querySelector('#detail-results-container table.results-table tbody');
        const audiMainRow = Array.from(mainRows).find(row => row.getAttribute('data-car') === 'Audi R8');
        const audiSummaryRow = Array.from(summaryRows).find(row => row.getAttribute('data-car') === 'Audi R8');

        audiMainRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(audiMainRow.classList.contains('car-row-highlight')).toBe(true);
        expect(audiSummaryRow.classList.contains('car-dist-row-highlight')).toBe(true);

        tbody.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
        expect(audiMainRow.classList.contains('car-row-highlight')).toBe(false);
        expect(audiSummaryRow.classList.contains('car-dist-row-highlight')).toBe(false);
    });

    it('clears car highlights when mouse leaves the car distribution summary', async () => {
        const mainRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-car]');
        const summaryRows = document.querySelectorAll('#detail-results-container .car-dist-table tbody tr[data-car]');
        const summaryTbody = document.querySelector('#detail-results-container .car-dist-table tbody');
        const bmwMainRow = Array.from(mainRows).find(row => row.getAttribute('data-car') === 'BMW M4');
        const bmwSummaryRow = Array.from(summaryRows).find(row => row.getAttribute('data-car') === 'BMW M4');

        bmwSummaryRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(bmwMainRow.classList.contains('car-row-highlight')).toBe(true);
        expect(bmwSummaryRow.classList.contains('car-dist-row-highlight')).toBe(true);

        summaryTbody.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
        expect(bmwMainRow.classList.contains('car-row-highlight')).toBe(false);
        expect(bmwSummaryRow.classList.contains('car-dist-row-highlight')).toBe(false);
    });

    it('cross-highlights between entries chart bars and result table rows', async () => {
        const bars = document.querySelectorAll('#detail-results-container .entries-dist-bar[data-date]');
        const tableRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-date]');

        // Chart bar hover → all rows for that date highlighted
        const aliceDate = '2026-04-03';
        const aliceBar = Array.from(bars).find(b => b.getAttribute('data-date') === aliceDate);
        const aliceRow = Array.from(tableRows).find(r => String(r.getAttribute('data-date')).startsWith(aliceDate));

        aliceBar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(aliceRow.classList.contains('car-row-highlight')).toBe(true);

        // Table row hover → only that row's date bar is activated (not neighbour bars)
        aliceRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(aliceBar.classList.contains('entries-dist-bar--active')).toBe(true);
        const otherBars = Array.from(bars).filter(b => b.getAttribute('data-date') !== aliceDate);
        otherBars.forEach(b => expect(b.classList.contains('entries-dist-bar--active')).toBe(false));
    });

    it('clears table row highlights when mouse leaves the entries chart', async () => {
        const bars = document.querySelectorAll('#detail-results-container .entries-dist-bar[data-date]');
        const tableRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-date]');
        const chart = document.querySelector('#detail-results-container .entries-dist-chart');
        const charlieBar = Array.from(bars).find(b => b.getAttribute('data-date') === '2026-04-02');
        const charlieRow = Array.from(tableRows).find(r => String(r.getAttribute('data-date')).startsWith('2026-04-02'));

        charlieBar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(charlieRow.classList.contains('car-row-highlight')).toBe(true);

        chart.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
        expect(charlieRow.classList.contains('car-row-highlight')).toBe(false);
    });

    it('clears bar highlight when mouse leaves the table body', async () => {
        const bars = document.querySelectorAll('#detail-results-container .entries-dist-bar[data-date]');
        const tbody = document.querySelector('#detail-results-container table.results-table tbody');
        const bobRow = Array.from(tbody.querySelectorAll('tr[data-date]')).find(r => String(r.getAttribute('data-date')).startsWith('2026-04-04'));
        const bobBar = Array.from(bars).find(b => b.getAttribute('data-date') === '2026-04-04');

        bobRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(bobBar.classList.contains('entries-dist-bar--active')).toBe(true);

        tbody.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
        expect(bobBar.classList.contains('entries-dist-bar--active')).toBe(false);
    });

    it('switches row highlights when hovering from one bar to another', async () => {
        const bars = document.querySelectorAll('#detail-results-container .entries-dist-bar[data-date]');
        const tableRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-date]');
        const charlieBar = Array.from(bars).find(b => b.getAttribute('data-date') === '2026-04-02');
        const aliceBar = Array.from(bars).find(b => b.getAttribute('data-date') === '2026-04-03');
        const charlieRow = Array.from(tableRows).find(r => String(r.getAttribute('data-date')).startsWith('2026-04-02'));
        const aliceRow = Array.from(tableRows).find(r => String(r.getAttribute('data-date')).startsWith('2026-04-03'));

        charlieBar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(charlieRow.classList.contains('car-row-highlight')).toBe(true);
        expect(aliceRow.classList.contains('car-row-highlight')).toBe(false);

        aliceBar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(aliceRow.classList.contains('car-row-highlight')).toBe(true);
        expect(charlieRow.classList.contains('car-row-highlight')).toBe(false);
    });

    it('switches bar highlight when hovering different table rows sequentially', async () => {
        const bars = document.querySelectorAll('#detail-results-container .entries-dist-bar[data-date]');
        const tableRows = document.querySelectorAll('#detail-results-container table.results-table tbody tr[data-date]');
        const charlieRow = Array.from(tableRows).find(r => String(r.getAttribute('data-date')).startsWith('2026-04-02'));
        const bobRow = Array.from(tableRows).find(r => String(r.getAttribute('data-date')).startsWith('2026-04-04'));
        const charlieBar = Array.from(bars).find(b => b.getAttribute('data-date') === '2026-04-02');
        const bobBar = Array.from(bars).find(b => b.getAttribute('data-date') === '2026-04-04');

        charlieRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(charlieBar.classList.contains('entries-dist-bar--active')).toBe(true);
        expect(bobBar.classList.contains('entries-dist-bar--active')).toBe(false);

        bobRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(bobBar.classList.contains('entries-dist-bar--active')).toBe(true);
        expect(charlieBar.classList.contains('entries-dist-bar--active')).toBe(false);
    });
});

