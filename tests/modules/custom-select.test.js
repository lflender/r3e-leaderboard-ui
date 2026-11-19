import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CustomSelect', () => {
    beforeAll(() => {
        window.R3EUtils = {
            escapeHtml: (value) => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
        };
        window.matchMedia = vi.fn().mockReturnValue({ matches: true });
        loadBrowserScript('modules/custom-select.js');
    });

    beforeEach(() => {
        document.body.innerHTML = [
            '<div id="test-select" class="custom-select">',
            '  <button type="button" class="custom-select__toggle" aria-expanded="false"></button>',
            '  <div class="custom-select__menu" hidden></div>',
            '</div>'
        ].join('');
    });

    test('builds menu and selects default option without calling onChange', () => {
        const onChange = vi.fn();
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All classes' },
            { value: 'gt3', label: 'Category: GT3' }
        ], onChange);

        expect(select.toggle.innerHTML).toContain('All classes');
        expect(select.menu.querySelectorAll('.custom-select__option')).toHaveLength(2);
        expect(onChange).not.toHaveBeenCalled();
    });

    test('setValue notifies onChange unless explicitly silenced', () => {
        const onChange = vi.fn();
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All classes' },
            { value: 'gt3', label: 'Category: GT3' }
        ], onChange);

        select.setValue('gt3');
        expect(onChange).toHaveBeenCalledWith('gt3', { source: 'programmatic' });

        onChange.mockClear();
        select.setValue('', { notify: false, source: 'init' });
        expect(onChange).not.toHaveBeenCalled();
    });

    test('opens, selects a value, and updates aria-selected state', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All classes' },
            { value: 'combo', label: 'Combined: Modern GT' }
        ]);

        select.open();
        expect(select.isOpen()).toBe(true);

        select.menu.querySelector('[data-value="combo"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(select.getValue()).toBe('combo');
        expect(select.toggle.innerHTML).toContain('<strong>Combined:</strong> Modern GT');
        expect(select.menu.querySelector('[data-value="combo"]').getAttribute('aria-selected')).toBe('true');
        expect(select.isOpen()).toBe(false);
    });

    test('closes when clicking outside', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All classes' }
        ]);

        select.open();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(select.isOpen()).toBe(false);
    });

    test('adds PNG fallback only to WebP brand logos', () => {
        window.R3EUtils.getBrandLogoFallbackAttributes = (url) => url === 'images/brands/logo-audi.webp'
            ? 'data-fallback-src="images/brands/logo-audi.png" onerror="window.R3ECarUtils.handleBrandLogoError(this)"'
            : '';

        const html = window.CustomSelect.buildLogosHtml({
            logoUrl: 'images/brands/logo-audi.webp'
        });
        const nonBrandHtml = window.CustomSelect.buildLogosHtml({
            logoUrl: 'images/classes/gt3.png'
        });

        expect(html).toContain('data-fallback-src="images/brands/logo-audi.png"');
        expect(nonBrandHtml).not.toContain('data-fallback-src');
        expect(nonBrandHtml).not.toContain('onerror=');
        delete window.R3EUtils.getBrandLogoFallbackAttributes;
    });

    test('preserves search text and scroll position when reopened', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All classes' },
            { value: 'gt3', label: 'GT3' },
            { value: 'gt4', label: 'GT4' },
            { value: 'tcr', label: 'TCR' }
        ]);

        select.open();
        select.searchInput.value = 'gt';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        select.optionsList.scrollTop = 44;
        select.optionsList.dispatchEvent(new Event('scroll'));

        select.close();
        select.open();

        expect(select.searchInput.value).toBe('gt');
        expect(select.optionsList.scrollTop).toBe(44);
        expect(select.menu.querySelector('[data-value="tcr"]').hidden).toBe(true);
    });

    test('searches aliases case-insensitively without changing the label or selected value', () => {
        const onChange = vi.fn();
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All tracks' },
            { value: '1846', label: 'Mount Panorama Circuit', aliases: ['Bathurst'] },
            { value: '10', label: 'Other circuit' }
        ], onChange);

        select.open();
        select.searchInput.value = 'THur';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        const result = select.menu.querySelector('[data-value="1846"]');
        expect(result.hidden).toBe(false);
        expect(result.querySelector('.custom-select__label').textContent).toBe('Mount Panorama Circuit');
        expect(select.menu.querySelector('[data-value="10"]').hidden).toBe(true);
        expect(select.noResults.hidden).toBe(true);

        result.click();
        expect(select.getValue()).toBe('1846');
        expect(select.toggle.textContent).toContain('Mount Panorama Circuit');
        expect(onChange).toHaveBeenCalledWith('1846', { source: 'user' });

        select.setOptions([{ value: '20', label: 'New track', aliases: ['Bathurst'] }]);
        expect(select.menu.querySelector('[data-value="20"]').hidden).toBe(false);
    });

    test('searches labels and aliases without requiring matching diacritics', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '1', label: 'Autódromo Fernanda Pires', aliases: ['Portimão'] },
            { value: '2', label: 'Other circuit' }
        ]);
        select.open();

        select.searchInput.value = 'autodromo';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(select.menu.querySelector('[data-value="1"]').hidden).toBe(false);
        expect(select.menu.querySelector('[data-value="2"]').hidden).toBe(true);

        select.searchInput.value = 'Óther';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(select.menu.querySelector('[data-value="1"]').hidden).toBe(true);
        expect(select.menu.querySelector('[data-value="2"]').hidden).toBe(false);

        select.searchInput.value = 'Portimao';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(select.menu.querySelector('[data-value="1"]').hidden).toBe(false);
        expect(select.menu.querySelector('[data-value="2"]').hidden).toBe(true);
    });

    test('shows track aliases only while Ctrl is held', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '', label: 'All tracks' },
            { value: '1846', label: 'Mount Panorama Circuit', aliases: ['Bathurst'] }
        ]);
        select.setValue('1846', { notify: false });
        select.menu.getBoundingClientRect = () => ({ top: 0, bottom: 200 });
        select.optionsList.getBoundingClientRect = () => ({ top: 0, bottom: 100 });
        select.menu.querySelector('[data-value="1846"]').getBoundingClientRect = () => ({
            top: 20,
            bottom: 60
        });

        const alias = select.menu.querySelector('.custom-select__track-alias');
        expect(alias.textContent).toBe('(Bathurst)');
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);

        select.open();
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', ctrlKey: true }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', ctrlKey: false }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', altKey: false }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);
    });

    test('hides aliases when no visible track option has an alias', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '1', label: 'Aliased track', aliases: ['Old name'] },
            { value: '2', label: 'Other track' }
        ]);
        select.open();
        select.menu.getBoundingClientRect = () => ({ top: 0, bottom: 200 });
        select.optionsList.getBoundingClientRect = () => ({ top: 40, bottom: 100 });
        const aliasedOption = select.menu.querySelector('[data-value="1"]');
        aliasedOption.getBoundingClientRect = () => ({ top: 110, bottom: 150 });
        select.searchInput.value = 'Other';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);

        select.searchInput.value = '';
        select.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);

        aliasedOption.getBoundingClientRect = () => ({ top: 60, bottom: 100 });
        select.optionsList.dispatchEvent(new Event('scroll'));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', ctrlKey: false }));
        expect(document.documentElement.classList.contains('show-track-aliases')).toBe(false);
    });

    test('sizes aliases from the option rows currently visible in the dropdown', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '1', label: 'Short alias track', aliases: ['Short'] },
            { value: '2', label: 'Long alias track', aliases: ['A much longer legacy track name'] }
        ]);
        select.open();
        select.menu.getBoundingClientRect = () => ({ top: 0, bottom: 200 });
        select.optionsList.getBoundingClientRect = () => ({ top: 40, bottom: 100 });

        const shortAliasOption = select.menu.querySelector('[data-value="1"]');
        const longAliasOption = select.menu.querySelector('[data-value="2"]');
        let shortOptionTop = 50;
        let longOptionTop = 110;
        shortAliasOption.getBoundingClientRect = () => ({
            top: shortOptionTop,
            bottom: shortOptionTop + 30
        });
        longAliasOption.getBoundingClientRect = () => ({
            top: longOptionTop,
            bottom: longOptionTop + 30
        });

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));

        expect(shortAliasOption.classList.contains('custom-select__option--alias-visible')).toBe(true);
        expect(longAliasOption.classList.contains('custom-select__option--alias-visible')).toBe(false);

        shortOptionTop = 110;
        longOptionTop = 60;
        select.optionsList.dispatchEvent(new Event('scroll'));

        expect(shortAliasOption.classList.contains('custom-select__option--alias-visible')).toBe(false);
        expect(longAliasOption.classList.contains('custom-select__option--alias-visible')).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', ctrlKey: false }));
        expect(longAliasOption.classList.contains('custom-select__option--alias-visible')).toBe(false);
    });

    test('escapes track aliases before rendering them', () => {
        const select = new window.CustomSelect('test-select', [
            { value: '1', label: 'Track', aliases: ['<img src=x onerror=alert(1)>'] }
        ]);

        expect(select.menu.querySelector('.custom-select__track-alias').innerHTML)
            .toBe('(&lt;img src=x onerror=alert(1)&gt;)');
    });
});
