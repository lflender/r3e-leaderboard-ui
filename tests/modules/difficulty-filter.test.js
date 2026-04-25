import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

beforeAll(() => {
    window.R3EUtils = { escapeHtml: (v) => String(v ?? '') };
    loadBrowserScript('modules/difficulty-filter.js');
});

function makeFilter(param = 'All difficulties') {
    const f = window.R3EDetailDifficultyFilter.create({ escapeHtml: (v) => String(v ?? '') });
    f.initializeFromParam(param);
    return f;
}

describe('normalizeDifficultyName', () => {
    it('maps known difficulties case-insensitively', () => {
        const n = window.R3EDetailDifficultyFilter.normalizeDifficultyName;
        expect(n('get real')).toBe('Get Real');
        expect(n('GET REAL')).toBe('Get Real');
        expect(n('Amateur')).toBe('Amateur');
        expect(n('novice')).toBe('Novice');
    });

    it('returns empty string for unknown values', () => {
        const n = window.R3EDetailDifficultyFilter.normalizeDifficultyName;
        expect(n('')).toBe('');
        expect(n('Pro')).toBe('');
        expect(n(null)).toBe('');
    });
});

describe('initializeFromParam', () => {
    it('activates all difficulties for "All difficulties"', () => {
        const f = makeFilter('All difficulties');
        expect([...f.getActiveDifficulties()]).toHaveLength(3);
    });

    it('activates all difficulties when param is empty', () => {
        const f = makeFilter('');
        expect([...f.getActiveDifficulties()]).toHaveLength(3);
    });

    it('activates only specified difficulties', () => {
        const f = makeFilter('Get Real');
        const active = f.getActiveDifficulties();
        expect(active.has('Get Real')).toBe(true);
        expect(active.has('Amateur')).toBe(false);
        expect(active.has('Novice')).toBe(false);
    });

    it('activates multiple comma-separated difficulties', () => {
        const f = makeFilter('Get Real, Amateur');
        const active = f.getActiveDifficulties();
        expect(active.has('Get Real')).toBe(true);
        expect(active.has('Amateur')).toBe(true);
        expect(active.has('Novice')).toBe(false);
    });

    it('ignores invalid difficulty names in param', () => {
        const f = makeFilter('Get Real, InvalidDiff');
        const active = f.getActiveDifficulties();
        expect(active.has('Get Real')).toBe(true);
        expect(active.size).toBe(1);
    });
});

describe('getActiveDifficultyLabel', () => {
    it('returns "All difficulties" when all are active', () => {
        const f = makeFilter('All difficulties');
        expect(f.getActiveDifficultyLabel()).toBe('All difficulties');
    });

    it('returns ordered label for subset', () => {
        const f = makeFilter('Novice, Get Real');
        // Order follows DIFFICULTIES canonical order
        expect(f.getActiveDifficultyLabel()).toBe('Get Real, Novice');
    });

    it('returns single name for single active', () => {
        const f = makeFilter('Amateur');
        expect(f.getActiveDifficultyLabel()).toBe('Amateur');
    });
});

describe('isAllActive / isDifficultyActive', () => {
    it('isAllActive returns true when all active', () => {
        const f = makeFilter('All difficulties');
        expect(f.isAllActive()).toBe(true);
    });

    it('isAllActive returns false when subset active', () => {
        const f = makeFilter('Get Real');
        expect(f.isAllActive()).toBe(false);
    });

    it('isDifficultyActive reflects active state', () => {
        const f = makeFilter('Get Real');
        expect(f.isDifficultyActive('Get Real')).toBe(true);
        expect(f.isDifficultyActive('Amateur')).toBe(false);
    });

    it('isDifficultyActive returns false for unknown difficulty', () => {
        const f = makeFilter('All difficulties');
        expect(f.isDifficultyActive('Pro')).toBe(false);
        expect(f.isDifficultyActive('')).toBe(false);
    });
});

describe('render', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="container"></div>'; });

    it('renders three badge buttons', () => {
        const f = makeFilter('All difficulties');
        const container = document.getElementById('container');
        f.render(container);
        const buttons = container.querySelectorAll('button[data-difficulty]');
        expect(buttons).toHaveLength(3);
    });

    it('marks active badges with aria-pressed="true"', () => {
        const f = makeFilter('Get Real');
        const container = document.getElementById('container');
        f.render(container);
        const active = container.querySelectorAll('button[aria-pressed="true"]');
        expect(active).toHaveLength(1);
        expect(active[0].getAttribute('data-difficulty')).toBe('Get Real');
    });

    it('disables the sole active badge to prevent deactivation', () => {
        const f = makeFilter('Amateur');
        const container = document.getElementById('container');
        f.render(container);
        const disabled = container.querySelector('button[disabled]');
        expect(disabled).not.toBeNull();
        expect(disabled.getAttribute('data-difficulty')).toBe('Amateur');
    });

    it('does nothing when container is null', () => {
        const f = makeFilter();
        expect(() => f.render(null)).not.toThrow();
    });
});

// toggleDifficulty is internal — test via click simulation through bind()
describe('toggleDifficulty (via click)', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="container"></div>'; });

    it('deactivates an active difficulty when badge is clicked', () => {
        const onChange = vi.fn();
        const f = makeFilter('All difficulties');
        const container = document.getElementById('container');
        f.render(container);
        f.bind(container, onChange);
        container.querySelector('button[data-difficulty="Amateur"]')
            .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(f.isDifficultyActive('Amateur')).toBe(false);
        expect(onChange).toHaveBeenCalledOnce();
    });

    it('activates an inactive difficulty when badge is clicked', () => {
        const onChange = vi.fn();
        const f = makeFilter('Get Real');
        const container = document.getElementById('container');
        f.render(container);
        f.bind(container, onChange);
        container.querySelector('button[data-difficulty="Amateur"]')
            .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(f.isDifficultyActive('Amateur')).toBe(true);
    });

    it('cannot deactivate the last active difficulty', () => {
        const onChange = vi.fn();
        const f = makeFilter('Get Real');
        const container = document.getElementById('container');
        f.render(container);
        f.bind(container, onChange);
        // Sole active badge should be disabled — click should not fire onChange
        container.querySelector('button[data-difficulty="Get Real"]')
            .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(f.isDifficultyActive('Get Real')).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('calls onChange with updated Set after toggle', () => {
        const onChange = vi.fn();
        const f = makeFilter('All difficulties');
        const container = document.getElementById('container');
        f.render(container);
        f.bind(container, onChange);
        container.querySelector('button[data-difficulty="Amateur"]')
            .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onChange).toHaveBeenCalledOnce();
        const updated = onChange.mock.calls[0][0];
        expect(updated.has('Amateur')).toBe(false);
        expect(updated.has('Get Real')).toBe(true);
    });
});


