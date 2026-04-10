import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

function buildDom() {
    return [
        '<div id="wheel-filter-ui"></div>',
        '<div id="trans-filter-ui"></div>',
        '<div id="class-filter-ui-cars"></div>',
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
    window.dataService = {
        getSuperclassOptions: vi.fn().mockReturnValue([])
    };
    window.R3EUtils = {
        escapeHtml: s => String(s)
    };

    window.CustomSelect = class {
        constructor(_id, _options, _onChange) {}
    };
});

describe('car-info integration', () => {
    it('renders grouped table from CARS_DATA without fetch', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch');

        loadBrowserScript('pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        const html = document.getElementById('cars-info-table').innerHTML;
        expect(html).toContain('BMW M4');
        expect(html).toContain('GT3');
        expect(html).toContain('590hp');
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('shows placeholder when dataset is empty', async () => {
        window.CARS_DATA = [];

        loadBrowserScript('pages/car-info.js');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(document.getElementById('cars-info-table').innerHTML).toContain('No car data available');
    });
});
