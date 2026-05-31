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
        vi.useFakeTimers();
        const header = document.createElement('div');
        header.dataset.group = 'sample-group';
        const icon = document.createElement('span');
        icon.className = 'toggle-icon';
        header.appendChild(icon);

        window.toggleGroup(header);
        vi.runAllTimers();
        expect(document.querySelectorAll('.sample-group')[0].style.display).toBe('');
        expect(header.classList.contains('collapsed')).toBe(false);

        window.toggleGroup(header);
        // Collapse adds exit animation class; display:none set after animationend
        const row = document.querySelectorAll('.sample-group')[0];
        expect(row.classList.contains('group-row-exit')).toBe(true);
        expect(header.classList.contains('collapsed')).toBe(true);

        // Simulate animationend to complete the fold
        row.dispatchEvent(new Event('animationend'));
        expect(row.style.display).toBe('none');
        expect(row.classList.contains('group-row-exit')).toBe(false);
        vi.useRealTimers();
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

    test('openDriverProfile opens profile page with driver name', () => {
        const header = document.createElement('tr');
        header.dataset.driverName = 'TestDriver';

        window.openDriverProfile(header);
        expect(window.open).toHaveBeenCalledWith(
            'driver-profile.html?driver=%22TestDriver%22',
            '_blank'
        );
    });

    test('openDriverProfile does nothing when no driver name', () => {
        const header = document.createElement('tr');

        window.openDriverProfile(header);
        expect(window.open).not.toHaveBeenCalled();
    });

    test('openDriverProfile encodes special characters', () => {
        const header = document.createElement('tr');
        header.dataset.driverName = 'Test Driver With Spaces';

        window.openDriverProfile(header);
        expect(window.open).toHaveBeenCalledWith(
            'driver-profile.html?driver=%22Test%20Driver%20With%20Spaces%22',
            '_blank'
        );
    });

    test('openDriverProfile includes pathId in URL when available', () => {
        const header = document.createElement('tr');
        header.dataset.driverName = 'Alex Fernandez';
        header.dataset.pathId = '12345';

        window.openDriverProfile(header);
        expect(window.open).toHaveBeenCalledWith(
            'driver-profile.html?driver=%22Alex%20Fernandez%22&id=12345',
            '_blank'
        );
    });
});
