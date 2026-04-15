import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('Navigation', () => {
    beforeAll(() => {
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
        document.body.innerHTML = '<div id="difficulty-filter-ui"><button class="custom-select__toggle">Get Real ▾</button></div>';
        loadBrowserScript('modules/navigation.js');
    });

    beforeEach(() => {
        document.body.innerHTML = [
            '<div id="difficulty-filter-ui"><button class="custom-select__toggle">Get Real ▾</button></div>',
            '<div class="group-row sample-group" style="display:none"></div>',
            '<div class="group-row sample-group" style="display:none"></div>'
        ].join('');
        window.open = vi.fn();
    });

    test('toggles grouped rows and icon state', () => {
        const header = document.createElement('div');
        header.dataset.group = 'sample-group';
        const icon = document.createElement('span');
        icon.className = 'toggle-icon';
        header.appendChild(icon);

        window.toggleGroup(header);
        expect(document.querySelectorAll('.sample-group')[0].style.display).toBe('');
        expect(icon.textContent).toBe('▼');

        window.toggleGroup(header);
        expect(document.querySelectorAll('.sample-group')[0].style.display).toBe('none');
        expect(icon.textContent).toBe('▶');
    });

    test('opens detail view with class and difficulty params', () => {
        const row = document.createElement('tr');
        row.dataset.trackid = '123';
        row.dataset.classid = '456';
        row.dataset.position = '7';
        row.dataset.name = 'Driver';
        row.dataset.time = '1:23.456s';

        window.openDetailView({ target: document.createElement('div') }, row);

        expect(window.open).toHaveBeenCalledWith(
            'detail.html?track=123&class=456&pos=7&driver=Driver&time=1%3A23.456s&difficulty=Get%20Real',
            '_blank'
        );
    });

    test('ignores clicks from driver group header targets', () => {
        const event = {
            target: {
                closest: vi.fn(() => ({}))
            }
        };
        const row = document.createElement('tr');
        row.dataset.trackid = '123';
        row.dataset.classid = '456';

        window.openDetailView(event, row);
        expect(window.open).not.toHaveBeenCalled();
    });
});
