/**
 * Pie Chart Module
 * Renders interactive SVG pie charts with tooltips and legend
 * Single source of truth for all pie chart rendering in the application
 */
(function () {
    'use strict';

    let _pieIdCounter = 0;

    const COLORS = [
        '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
        '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#10b981',
        '#f43f5e', '#7c3aed', '#2dd4bf', '#fb923c', '#818cf8',
        '#facc15', '#4ade80', '#f472b6', '#38bdf8', '#c084fc',
        '#34d399', '#fb7185', '#a78bfa', '#fbbf24', '#67e8f9',
        '#a3e635', '#f87171', '#60a5fa', '#c084fc', '#2dd4bf',
        '#fca5a5', '#86efac', '#fde68a', '#93c5fd', '#d8b4fe'
    ];

    /**
     * Compute pie slices from data items
     * @param {Array<{label: string, value: number}>} items - Data items
     * @returns {Array<{label: string, value: number, percentage: number, color: string, midAngle: number}>}
     */
    function computeSlices(items) {
        if (!Array.isArray(items) || items.length === 0) return [];

        const total = items.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return [];

        // Sort descending by value
        const sorted = items.slice().sort((a, b) => b.value - a.value);

        let currentAngle = -Math.PI / 2;
        return sorted.map((item, i) => {
            const pct = (item.value / total) * 100;
            const sliceAngle = (pct / 100) * 2 * Math.PI;
            const midAngle = currentAngle + sliceAngle / 2;
            currentAngle += sliceAngle;
            return {
                label: item.label,
                value: item.value,
                percentage: pct,
                color: COLORS[i % COLORS.length],
                midAngle
            };
        });
    }

    /**
     * Build SVG path data for an arc slice
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} r - Radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @returns {string} SVG path d attribute
     */
    function describeArc(cx, cy, r, startAngle, endAngle) {
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

        return [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');
    }

    /**
     * Render an interactive SVG pie chart into a container element
     * @param {HTMLElement} container - DOM element to render into
     * @param {Array<{label: string, value: number}>} data - Chart data
     * @param {Object} [options] - Rendering options
     * @param {string} [options.title] - Chart title
     * @param {number} [options.size=200] - SVG viewport size
     */
    function render(container, data, options = {}) {
        const { title = '', size = 200 } = options;
        const slices = computeSlices(data);

        if (slices.length === 0) {
            container.innerHTML = '<div class="pie-chart-empty">No data</div>';
            return;
        }

        const pad = 10; // room for pop-out translate
        const vbSize = size + pad * 2;
        const cx = size / 2 + pad;
        const cy = size / 2 + pad;
        const r = (size / 2) - 2;

        let currentAngle = -Math.PI / 2; // Start from top
        const paths = [];

        slices.forEach((slice, index) => {
            const sliceAngle = (slice.percentage / 100) * 2 * Math.PI;
            // For a full circle (100%), draw a circle instead of an arc
            if (slice.percentage >= 99.99) {
                paths.push(
                    `<circle cx="${cx}" cy="${cy}" r="${r}" ` +
                    `fill="${slice.color}" class="pie-slice" data-index="${index}" ` +
                    `data-label="${escapeAttr(slice.label)}" data-value="${slice.value}" ` +
                    `data-percentage="${slice.percentage.toFixed(1)}" />`
                );
            } else {
                const endAngle = currentAngle + sliceAngle;
                const d = describeArc(cx, cy, r, currentAngle, endAngle);
                paths.push(
                    `<path d="${d}" fill="${slice.color}" class="pie-slice" ` +
                    `data-index="${index}" data-label="${escapeAttr(slice.label)}" ` +
                    `data-value="${slice.value}" data-percentage="${slice.percentage.toFixed(1)}" />`
                );
                currentAngle = endAngle;
            }
        });

        const titleHtml = title ? `<h3 class="pie-chart-title">${escapeHtml(title)}</h3>` : '';

        const legendItems = slices.map((slice, i) =>
            `<li class="pie-legend-item" data-index="${i}">` +
            `<span class="pie-legend-color" style="background:${slice.color}"></span>` +
            `<span class="pie-legend-label">${escapeHtml(slice.label)}</span>` +
            `<span class="pie-legend-value">${slice.value} (${slice.percentage.toFixed(1)}%)</span>` +
            `</li>`
        ).join('');

        // SVG defs: radial gradient for glossy 3D look
        const pieUid = _pieIdCounter++;
        const defsHtml = [
            '<defs>',
            `<radialGradient id="pie-gloss-${pieUid}" cx="35%" cy="30%" r="65%" fx="35%" fy="30%">`,
            '<stop offset="0%" stop-color="rgba(255,255,255,0.28)" />',
            '<stop offset="50%" stop-color="rgba(255,255,255,0.08)" />',
            '<stop offset="100%" stop-color="rgba(0,0,0,0.12)" />',
            '</radialGradient>',
            '</defs>'
        ].join('');
        const glossId = `pie-gloss-${pieUid}`;

        container.innerHTML = [
            '<div class="pie-chart-wrapper">',
            titleHtml,
            '<div class="pie-chart-body">',
            `<div class="pie-chart-svg-container">`,
            `<svg viewBox="0 0 ${vbSize} ${vbSize}" class="pie-chart-svg" aria-label="${escapeAttr(title || 'Pie chart')}">`,
            defsHtml,
            paths.join(''),
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${glossId})" class="pie-gloss-overlay" pointer-events="none" />`,
            '</svg>',
            '<div class="pie-tooltip" hidden></div>',
            '</div>',
            `<ul class="pie-legend">${legendItems}</ul>`,
            '</div>',
            '</div>'
        ].join('');

        attachInteractions(container, slices);
    }

    /**
     * Attach hover and click interactions to pie chart slices and legend
     * @param {HTMLElement} container - The pie chart container
     * @param {Array} slices - Computed slices data
     */
    function attachInteractions(container, slices) {
        const tooltip = container.querySelector('.pie-tooltip');
        const svgContainer = container.querySelector('.pie-chart-svg-container');
        const pieSlices = container.querySelectorAll('.pie-slice');
        const legendItems = container.querySelectorAll('.pie-legend-item');

        const POP_DISTANCE = 8;
        const glossOverlay = container.querySelector('.pie-gloss-overlay');
        let shadowEl = null;

        function highlightSlice(index) {
            // Remove previous shadow clone
            if (shadowEl) { shadowEl.remove(); shadowEl = null; }

            pieSlices.forEach((el, i) => {
                const isActive = i === index;
                el.classList.toggle('pie-slice-active', isActive);
                el.classList.toggle('pie-slice-dimmed', !isActive);
                if (isActive) {
                    const slice = slices[i];
                    const tx = Math.cos(slice.midAngle) * POP_DISTANCE;
                    const ty = Math.sin(slice.midAngle) * POP_DISTANCE;
                    el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
                    // Move active slice to end of SVG (before gloss overlay)
                    // so it paints on top of other slices
                    const svg = el.parentNode;
                    if (glossOverlay) {
                        svg.insertBefore(el, glossOverlay);
                    } else {
                        svg.appendChild(el);
                    }

                    // Create shadow clone just before the active slice.
                    // Uses SVG transform attribute (not CSS) so it works
                    // reliably across all browsers.
                    shadowEl = el.cloneNode(false);
                    shadowEl.removeAttribute('class');
                    shadowEl.removeAttribute('data-index');
                    shadowEl.setAttribute('fill', 'rgba(0,0,0,0.4)');
                    shadowEl.setAttribute('pointer-events', 'none');
                    shadowEl.removeAttribute('stroke');
                    shadowEl.removeAttribute('stroke-width');
                    // Offset shadow slightly further than slice for depth
                    const stx = tx + 3;
                    const sty = ty + 4;
                    shadowEl.setAttribute('transform', `translate(${stx.toFixed(2)}, ${sty.toFixed(2)})`);
                    shadowEl.style.filter = 'blur(4px)';
                    // Insert just before active slice — on top of inactive
                    // slices but behind the active one
                    el.parentNode.insertBefore(shadowEl, el);
                } else {
                    el.style.transform = '';
                }
            });
            legendItems.forEach((el, i) => {
                el.classList.toggle('pie-legend-item-active', i === index);
            });
        }

        function clearHighlight() {
            if (shadowEl) { shadowEl.remove(); shadowEl = null; }
            pieSlices.forEach(el => {
                el.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                el.style.transform = '';
            });
            legendItems.forEach(el => {
                el.classList.remove('pie-legend-item-active');
            });
            if (tooltip) tooltip.hidden = true;
        }

        function showTooltip(index, event) {
            if (!tooltip) return;
            const slice = slices[index];
            if (!slice) return;
            tooltip.textContent = `${slice.label}: ${slice.value} (${slice.percentage.toFixed(1)}%)`;
            tooltip.hidden = false;

            // Position tooltip near cursor, within SVG container bounds
            const rect = svgContainer.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            tooltip.style.left = `${x + 12}px`;
            tooltip.style.top = `${y - 8}px`;
        }

        pieSlices.forEach((el) => {
            const idx = parseInt(el.dataset.index, 10);
            el.addEventListener('mouseenter', (e) => {
                highlightSlice(idx);
                showTooltip(idx, e);
            });
            el.addEventListener('mousemove', (e) => showTooltip(idx, e));
            el.addEventListener('mouseleave', () => clearHighlight());
        });

        legendItems.forEach((el) => {
            const idx = parseInt(el.dataset.index, 10);
            el.addEventListener('mouseenter', () => highlightSlice(idx));
            el.addEventListener('mouseleave', () => clearHighlight());
        });
    }

    function escapeHtml(str) {
        if (window.R3EUtils && typeof window.R3EUtils.escapeHtml === 'function') {
            return window.R3EUtils.escapeHtml(str);
        }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.PieChart = { render, computeSlices };
})();
