/**
 * URL utility helpers shared across pages.
 */

function getUrlParam(paramName) {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get(paramName);
    } catch (e) {
        return null;
    }
}

function updateUrlParam(paramName, value) {
    try {
        const url = new URL(window.location.href);
        if (value === null || value === undefined || String(value).trim() === '') {
            url.searchParams.delete(paramName);
        } else {
            url.searchParams.set(paramName, value);
        }
        window.history.replaceState({}, '', url);
    } catch (e) {
        // Ignore URL update errors.
    }
}

window.R3EUrlUtils = {
    getUrlParam,
    updateUrlParam
};