import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

function buildDom() {
    return [
        '<input id="cars-search" type="search">',
        '<div id="wheel-filter-ui"></div>',
        '<div id="trans-filter-ui"></div>',
        '<div id="class-filter-ui-cars"></div>',
        '<div id="cars-view-toggle"><button type="button" data-view="table"></button><button type="button" data-view="tiles"></button></div>',
        '<div id="cars-info-table"></div>'
    ].join('');
}

beforeEach(() => {
    document.body.innerHTML = buildDom();
    window.CARS_DATA = [
        {
            class: 'GT3',
            superclass: 'GT',
            cars: [
                {
                    car: 'BMW M4 GT3',
                    wheel_cat: 'GT',
                    transmission_cat: 'Paddles',
                    drive: 'RWD',
                    year: '2022',
                    power: '590hp',
                    weight: '1300kg',
                    engine: '6 cyl',
                    country: 'DE',
                    description: 'Factory car',
                    link: 'https://example.com/bmw'
                }
            ]
        }
    ];

    window.FlagHelper = {
        countryToFlag: vi.fn().mockReturnValue('<span class="fi fi-de"></span>')
    };
    window.R3EAnalytics = { track: vi.fn() };
    window.CarRatings = {
        buildCarId: vi.fn(() => ''),
        get: vi.fn(() => 0)
    };
    window.dataService = {};
    window.FilterOptionsService = {
        getSuperclassOptions: vi.fn().mockReturnValue([]),
        getClassOptionsFromCarsData: vi.fn().mockReturnValue([])
    };
    window.R3EUtils = {
        escapeHtml: s => String(s),
        splitCarName: vi.fn((name) => {
            const value = String(name || '');
            const idx = value.indexOf(' ');
            if (idx > 0) {
                return { brand: value.slice(0, idx), model: value.slice(idx + 1) };
            }
            return { brand: '', model: value };
        }),
        resolveBrandLogoPath: vi.fn((brand) => `images/brands/logo-${(brand || 'unknown').toLowerCase()}.png`)
    };

    window.CustomSelect = class {
        constructor(_id, _options, _onChange) {}
    };

    // car-info.js references R3ECarUtils badge helpers
    if (!window.R3ECarUtils) {
        loadBrowserScript('modules/car-helper.js');
    }
});

describe('car-info integration', () => {
    it('renders grouped table from CARS_DATA without fetch', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('cars-page-car-name');
        expect(html).toContain('table-brand-logo-slot');
        expect(html).toContain('BMW');
        expect(html).toContain('M4 GT3');
        expect(html).toContain('GT3');
        expect(html).toContain('590hp');
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('shows placeholder when dataset is empty', async () => {
        window.CARS_DATA = [];

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(document.getElementById('cars-info-table').innerHTML).toContain('No car data available');
    });

    it('filters cars live after debounce when typing in search', async () => {
        window.CARS_DATA = [
            {
                class: 'GT3',
                superclass: 'GT',
                cars: [
                    {
                        car: 'BMW M4 GT3',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2022',
                        power: '590hp',
                        weight: '1300kg',
                        engine: '6 cyl',
                        country: 'DE',
                        link: 'https://example.com/bmw'
                    },
                    {
                        car: 'Audi R8 LMS GT3 EVO II',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2022',
                        power: '585hp',
                        weight: '1305kg',
                        engine: '10 cyl',
                        country: 'DE',
                        link: 'https://example.com/audi'
                    }
                ]
            }
        ];

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        vi.useFakeTimers();

        const searchInput = document.getElementById('cars-search');
        searchInput.value = 'Audi';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        vi.advanceTimersByTime(300);
        await Promise.resolve();

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('Audi');
        expect(html).not.toContain('BMW M4 GT3');

        vi.useRealTimers();
    });

    it('filters cars by class name and brand display name when searching', async () => {
        window.R3EUtils = {
            escapeHtml: s => String(s),
            splitCarName: vi.fn((name) => {
                const value = String(name || '');
                if (value === 'E36 V8 JUDD') return { brand: 'Georg Plasa', model: 'BMW E36 V8' };
                if (value === 'BMW M4 GT3') return { brand: 'BMW', model: 'M4 GT3' };
                if (value === 'Porsche 991 GT2 RS CS') return { brand: 'Porsche', model: '991 GT2 RS CS' };
                return { brand: '', model: value };
            }),
            resolveBrandLogoPath: vi.fn(() => 'images/brands/logo-bmw.png')
        };

        window.CARS_DATA = [
            {
                class: 'ADAC GT Masters',
                superclass: 'GT',
                cars: [
                    {
                        car: 'BMW M4 GT3',
                        car_class: 'ADAC GT Masters',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2022',
                        power: '590hp',
                        weight: '1300kg',
                        engine: '6 cyl',
                        country: 'DE',
                        link: 'https://example.com/bmw'
                    },
                    {
                        car: 'E36 V8 JUDD',
                        car_class: 'ADAC GT Masters',
                        wheel_cat: 'Touring',
                        transmission_cat: 'Manual',
                        drive: 'RWD',
                        year: '1998',
                        power: '440hp',
                        weight: '1020kg',
                        engine: '8 cyl',
                        country: 'DE',
                        link: 'https://example.com/e36'
                    }
                ]
            },
            {
                class: 'GT2',
                superclass: 'GT',
                cars: [
                    {
                        car: 'Porsche 991 GT2 RS CS',
                        car_class: 'GT2',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2020',
                        power: '700hp',
                        weight: '1400kg',
                        engine: '6 cyl',
                        country: 'DE',
                        link: 'https://example.com/porsche'
                    }
                ]
            }
        ];

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        vi.useFakeTimers();

        const searchInput = document.getElementById('cars-search');

        // Search by class name: "ADAC" should show ADAC GT Masters cars, not GT2
        searchInput.value = 'ADAC';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        vi.advanceTimersByTime(300);
        await Promise.resolve();

        let html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('M4 GT3');
        expect(html).not.toContain('Porsche');

        // Search by brand display name: "georg" should match Georg Plasa (E36 V8 JUDD)
        searchInput.value = 'georg';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        vi.advanceTimersByTime(300);
        await Promise.resolve();

        html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('Georg Plasa');
        expect(html).not.toContain('Porsche');
        expect(html).not.toContain('M4 GT3');

        vi.useRealTimers();
    });
});

describe('car-info tile view (renderTiles)', () => {
    it('renders car tiles with class sections in tile mode', async () => {
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('cars-tile-grid');
        expect(html).toContain('cars-class-section');
        expect(html).toContain('car-tile');
        expect(html).toContain('car-brand');
        expect(html).toContain('BMW');
        expect(html).toContain('M4 GT3');
    });

    it('renders car image with link and year badge when thumbnail exists', async () => {
        window.CARS_DATA[0].cars[0].thumbnail = 'https://cdn/car.png';
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('car-tile-image');
        expect(html).toContain('year-badge');
        expect(html).toContain('2022');
        expect(html).toContain('href="https://example.com/bmw"');
    });

    it('renders car specs (power, weight, engine)', async () => {
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('car-tile-specs');
        expect(html).toContain('590hp');
        expect(html).toContain('1300kg');
        expect(html).toContain('6 cyl');
    });

    it('renders description when present', async () => {
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('car-tile-description');
        expect(html).toContain('Factory car');
    });

    it('renders country flag overlay when thumbnail exists', async () => {
        window.CARS_DATA[0].cars[0].thumbnail = 'https://cdn/car.png';
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('car-tile-flag-overlay');
        expect(window.FlagHelper.countryToFlag).toHaveBeenCalledWith('DE');
    });

    it('renders class heading with class name', async () => {
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('cars-class-heading');
        expect(html).toContain('GT3');
    });

    it('renders assist badges when present', async () => {
        window.CARS_DATA = [
            {
                class: 'GT3',
                superclass: 'GT',
                cars: [
                    {
                        car: 'BMW M4 GT3',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2022',
                        power: '590hp',
                        weight: '1300kg',
                        engine: '6 cyl',
                        country: 'DE',
                        link: '',
                        TC: 'true',
                        ABS: 'true',
                        LC: 'true'
                    }
                ]
            }
        ];
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('car-tile-assist--tc');
        expect(html).toContain('car-tile-assist--abs');
        expect(html).toContain('car-tile-assist--lc');
        expect(html).toContain('TC');
        expect(html).toContain('ABS');
        expect(html).toContain('Launch Control');
    });

    it('renders div wrapper instead of link when car has no link', async () => {
        window.CARS_DATA = [
            {
                class: 'GT3',
                superclass: 'GT',
                cars: [
                    {
                        car: 'Generic Car',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2023',
                        power: '500hp',
                        weight: '1200kg',
                        engine: '4 cyl',
                        country: '',
                        link: ''
                    }
                ]
            }
        ];
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const tile = document.querySelector('.car-tile');
        expect(tile).not.toBeNull();
        // Should use div instead of anchor
        expect(tile.querySelector('a.car-tile-link')).toBeNull();
        expect(tile.querySelector('div.car-tile-link')).not.toBeNull();
    });

    it('renders weight with driver notation when kg* present', async () => {
        window.CARS_DATA = [
            {
                class: 'GT3',
                superclass: 'GT',
                cars: [
                    {
                        car: 'Heavy Car',
                        wheel_cat: 'GT',
                        transmission_cat: 'Paddles',
                        drive: 'RWD',
                        year: '2022',
                        power: '600hp',
                        weight: '1400kg*',
                        engine: 'V8',
                        country: '',
                        link: ''
                    }
                ]
            }
        ];
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('1400kg with driver');
    });

    it('filters tiles by superclass correctly', async () => {
        window.CARS_DATA = [
            { class: 'GT3', superclass: 'GT', cars: [
                { car: 'BMW M4 GT3', wheel_cat: 'GT', transmission_cat: 'Paddles', drive: 'RWD', year: '2022', power: '590hp', weight: '1300kg', engine: '6 cyl', country: 'DE', link: '' }
            ]},
            { class: 'WTCR', superclass: 'Touring', cars: [
                { car: 'Hyundai Elantra N', wheel_cat: 'Round', transmission_cat: 'Sequential', drive: 'FWD', year: '2021', power: '350hp', weight: '1270kg', engine: '4 cyl', country: 'KR', link: '' }
            ]}
        ];

        let classOnChange;
        window.CustomSelect = class {
            constructor(id, _options, onChange) {
                if (id === 'class-filter-ui-cars') classOnChange = onChange;
            }
        };
        localStorage.setItem('carInfoViewMode', 'tiles');

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        // Verify both classes rendered initially
        let html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('BMW');
        expect(html).toContain('Hyundai');

        // Filter by superclass:GT
        classOnChange('superclass:GT', { source: 'user' });
        await new Promise(resolve => setTimeout(resolve, 0));

        html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('BMW');
        expect(html).not.toContain('Hyundai');
    });

    it('switches from table to tiles via view toggle click', async () => {
        // Start in table mode (default) — ensure no stored preference
        localStorage.removeItem('carInfoViewMode');
        document.body.innerHTML = buildDom();

        loadBrowserScript('modules/pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        let html = document.getElementById('cars-info-table').innerHTML;
        expect(html).not.toContain('cars-tile-grid');

        // Click tiles button
        const tilesBtn = document.querySelector('button[data-view="tiles"]');
        tilesBtn.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('cars-tile-grid');
        expect(html).toContain('car-tile');
        expect(localStorage.getItem('carInfoViewMode')).toBe('tiles');
    });
});
