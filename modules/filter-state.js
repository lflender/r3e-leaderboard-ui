(function (global) {
    'use strict';

    const STORAGE_PREFIX = 'r3e-page-filter-state:';

    function getStorageKey(page, context = '') {
        return STORAGE_PREFIX + encodeURIComponent(String(page)) + ':' + encodeURIComponent(String(context));
    }

    function read(page, context = '') {
        try {
            const serialized = global.sessionStorage.getItem(getStorageKey(page, context));
            if (!serialized) return {};

            const state = JSON.parse(serialized);
            if (state && typeof state === 'object' && !Array.isArray(state)) return state;
            console.warn(`Ignoring invalid saved filter state for ${page}.`);
        } catch (error) {
            console.warn(`Could not restore filter state for ${page}:`, error);
        }

        return {};
    }

    function write(page, field, value, context = '') {
        const state = read(page, context);
        state[field] = value;

        try {
            global.sessionStorage.setItem(getStorageKey(page, context), JSON.stringify(state));
        } catch (error) {
            console.warn(`Could not save filter state for ${page}:`, error);
        }
    }

    global.PageFilterState = { read, write };
})(window);
