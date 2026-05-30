/**
 * Tooltip Module
 * Shared tooltip creation, positioning, and visibility logic.
 * Single source of truth for tooltip behavior across the application.
 */
(function () {
    'use strict';

    /**
     * Create or retrieve a tooltip element inside a container.
     * @param {HTMLElement} container - Parent element to hold the tooltip
     * @param {string} [className='dist-tooltip'] - CSS class for the tooltip
     * @returns {HTMLElement} The tooltip element
     */
    function getOrCreate(container, className) {
        const cls = className || 'dist-tooltip';
        let tooltip = container.querySelector('.' + cls);
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = cls;
            container.appendChild(tooltip);
        }
        return tooltip;
    }

    /**
     * Position a tooltip above the cursor, centered horizontally,
     * clamped to container bounds and viewport edges.
     * @param {MouseEvent} event - The mouse event
     * @param {HTMLElement} container - The positioning reference element
     * @param {HTMLElement} tooltip - The tooltip element to position
     * @param {Object} [options] - Positioning options
     * @param {number} [options.offsetY=-10] - Vertical offset above cursor (negative = above)
     */
    function positionAboveCursor(event, container, tooltip, options) {
        const opts = options || {};
        const offsetY = opts.offsetY !== undefined ? opts.offsetY : -10;

        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const tipWidth = tooltip.offsetWidth;
        const tipHeight = tooltip.offsetHeight;

        let left = x - tipWidth / 2;
        if (left < 0) left = 0;
        if (left + tipWidth > rect.width) left = rect.width - tipWidth;

        // Prevent tooltip from overflowing left edge of viewport
        const minLeft = -rect.left + 4;
        if (left < minLeft) left = minLeft;

        // Prevent tooltip from overflowing right edge of viewport
        const viewportWidth = document.documentElement.clientWidth;
        if (viewportWidth > 0) {
            const maxLeft = viewportWidth - rect.left - tipWidth - 4;
            if (left > maxLeft) left = maxLeft;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = (y - tipHeight + offsetY) + 'px';
    }

    /**
     * Position a tooltip near the cursor with a fixed offset (no clamping).
     * Suitable for smaller tooltips that follow the pointer closely.
     * @param {MouseEvent} event - The mouse event
     * @param {HTMLElement} container - The positioning reference element
     * @param {HTMLElement} tooltip - The tooltip element to position
     * @param {Object} [options] - Positioning options
     * @param {number} [options.offsetX=12] - Horizontal offset from cursor
     * @param {number} [options.offsetY=-8] - Vertical offset from cursor
     */
    function positionNearCursor(event, container, tooltip, options) {
        const opts = options || {};
        const offsetX = opts.offsetX !== undefined ? opts.offsetX : 12;
        const offsetY = opts.offsetY !== undefined ? opts.offsetY : -8;

        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        tooltip.style.left = (x + offsetX) + 'px';
        tooltip.style.top = (y + offsetY) + 'px';
    }

    /**
     * Show a tooltip element.
     * @param {HTMLElement} tooltip - The tooltip element
     */
    function show(tooltip) {
        tooltip.hidden = false;
        tooltip.style.display = 'block';
    }

    /**
     * Hide a tooltip element.
     * @param {HTMLElement} tooltip - The tooltip element
     */
    function hide(tooltip) {
        tooltip.hidden = true;
        tooltip.style.display = 'none';
    }

    /**
     * Escape a string for safe use in tooltip innerHTML.
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    window.Tooltip = {
        getOrCreate,
        positionAboveCursor,
        positionNearCursor,
        show,
        hide,
        escapeHtml
    };
})();
