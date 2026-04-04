import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadBrowserScript } from './helpers/script-loader.js';

function buildTabDOM() {
    return `
        <button class="tab-button" data-tab="tab1">Tab 1</button>
        <button class="tab-button" data-tab="tab2">Tab 2</button>
        <button class="tab-button" data-tab="tab3">Tab 3</button>
        <div id="tab1" class="tab-panel">Panel 1</div>
        <div id="tab2" class="tab-panel">Panel 2</div>
        <div id="tab3" class="tab-panel">Panel 3</div>
    `;
}

// TabManager auto-inits and does NOT export the class to window.
// Load once; subsequent tests get the constructor from window.tabManager.constructor.
beforeAll(() => {
    document.body.innerHTML = buildTabDOM();
    loadBrowserScript('modules/tab-manager.js');
    // window.tabManager is now set; .constructor is the TabManager class
});

beforeEach(() => {
    document.body.innerHTML = buildTabDOM();
});

// ---------------------------------------------------------------------------
// switchTab – correct element gets active
// ---------------------------------------------------------------------------
describe('TabManager.switchTab – activation', () => {
    it('adds "active" class to the matching button', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab2');
        const btn = document.querySelector('[data-tab="tab2"]');
        expect(btn.classList.contains('active')).toBe(true);
    });

    it('adds "active" class to the panel with the matching id', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab3');
        const panel = document.getElementById('tab3');
        expect(panel.classList.contains('active')).toBe(true);
    });

    it('only one button is active at a time', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab1');
        tm.switchTab('tab2');

        const activeButtons = document.querySelectorAll('.tab-button.active');
        expect(activeButtons.length).toBe(1);
        expect(activeButtons[0].dataset.tab).toBe('tab2');
    });

    it('only one panel is active at a time', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab1');
        tm.switchTab('tab3');

        const activePanels = document.querySelectorAll('.tab-panel.active');
        expect(activePanels.length).toBe(1);
        expect(activePanels[0].id).toBe('tab3');
    });
});

// ---------------------------------------------------------------------------
// switchTab – deactivation
// ---------------------------------------------------------------------------
describe('TabManager.switchTab – deactivation', () => {
    it('removes "active" from a previously active button when switching', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab1');
        expect(document.querySelector('[data-tab="tab1"]').classList.contains('active')).toBe(true);

        tm.switchTab('tab2');
        expect(document.querySelector('[data-tab="tab1"]').classList.contains('active')).toBe(false);
    });

    it('removes "active" from previously active panel when switching', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab1');
        tm.switchTab('tab2');
        expect(document.getElementById('tab1').classList.contains('active')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// switchTab – unknown tab id
// ---------------------------------------------------------------------------
describe('TabManager.switchTab – unknown tab', () => {
    it('clears all active states without throwing when target does not exist', () => {
        const tm = new window.tabManager.constructor();
        tm.switchTab('tab1'); // first activate something
        expect(() => tm.switchTab('nonexistent')).not.toThrow();

        // All buttons and panels should be inactive
        const activeButtons = document.querySelectorAll('.tab-button.active');
        const activePanels = document.querySelectorAll('.tab-panel.active');
        expect(activeButtons.length).toBe(0);
        expect(activePanels.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Click event wiring
// ---------------------------------------------------------------------------
describe('TabManager – click event', () => {
    it('clicking a button switches to that tab', () => {
        const tm = new window.tabManager.constructor();
        const btn2 = document.querySelector('[data-tab="tab2"]');
        btn2.click();

        expect(document.querySelector('[data-tab="tab2"]').classList.contains('active')).toBe(true);
        expect(document.getElementById('tab2').classList.contains('active')).toBe(true);

        const activeButtons = document.querySelectorAll('.tab-button.active');
        expect(activeButtons.length).toBe(1);
    });

    it('button without data-tab attribute is ignored during init', () => {
        document.body.insertAdjacentHTML('beforeend', '<button class="tab-button">No data-tab</button>');
        // Should not throw when creating TabManager with such a button in the DOM
        expect(() => new window.tabManager.constructor()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('TabManager – edge cases', () => {
    it('constructs without throwing when there are no tab buttons', () => {
        document.body.innerHTML = '<div>no tabs here</div>';
        expect(() => new window.tabManager.constructor()).not.toThrow();
    });

    it('constructs without throwing when there are no panels', () => {
        document.body.innerHTML = `
            <button class="tab-button" data-tab="x">X</button>
        `;
        const tm = new window.tabManager.constructor();
        expect(() => tm.switchTab('x')).not.toThrow();
    });
});
