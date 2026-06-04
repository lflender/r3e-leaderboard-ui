import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CustomSelect', () => {
    beforeAll(() => {
        window.R3EUtils = {
            escapeHtml: (value) => String(value)
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
});
