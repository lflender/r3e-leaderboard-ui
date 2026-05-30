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
        const { title = '', size = 200, logoResolver } = options;
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
                    `data-percentage="${slice.percentage.toFixed(1)}" data-mid-angle="${slice.midAngle}" />`
                );
            } else {
                const endAngle = currentAngle + sliceAngle;
                const d = describeArc(cx, cy, r, currentAngle, endAngle);
                paths.push(
                    `<path d="${d}" fill="${slice.color}" class="pie-slice" ` +
                    `data-index="${index}" data-label="${escapeAttr(slice.label)}" ` +
                    `data-value="${slice.value}" data-percentage="${slice.percentage.toFixed(1)}" ` +
                    `data-mid-angle="${slice.midAngle}" />`
                );
                currentAngle = endAngle;
            }
        });

        const titleHtml = title ? `<h3 class="pie-chart-title">${escapeHtml(title)}</h3>` : '';

        const legendItems = slices.map((slice, i) => {
            const logoUrl = typeof logoResolver === 'function' ? logoResolver(slice.label) : '';
            const logoHtml = logoUrl ? `<img class="pie-legend-logo" src="${escapeAttr(logoUrl)}" alt="" aria-hidden="true">` : '';
            return `<li class="pie-legend-item" data-index="${i}">` +
                `<span class="pie-legend-color" style="background:${slice.color}"></span>` +
                logoHtml +
                `<span class="pie-legend-label">${escapeHtml(slice.label)}</span>` +
                `<span class="pie-legend-value">${slice.value} (${slice.percentage.toFixed(1)}%)</span>` +
                `</li>`;
        }).join('');

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

        // Store logoResolver for use in showSliceLabels
        container._pieLogoResolver = typeof logoResolver === 'function' ? logoResolver : null;

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
                el.classList.toggle('pie-legend-item-dimmed', i !== index);
                if (i === index) scrollLegendItemIntoView(el);
            });
        }

        function scrollLegendItemIntoView(el) {
            const parent = el.closest('.pie-legend');
            if (!parent) return;
            const parentRect = parent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            if (elRect.top >= parentRect.top && elRect.bottom <= parentRect.bottom) return;
            const offset = el.offsetTop - parent.offsetTop - 4;
            parent.scrollTo({ top: offset, behavior: 'smooth' });
        }

        function clearHighlight() {
            if (shadowEl) { shadowEl.remove(); shadowEl = null; }
            pieSlices.forEach(el => {
                el.classList.remove('pie-slice-active', 'pie-slice-dimmed');
                el.style.transform = '';
            });
            legendItems.forEach(el => {
                el.classList.remove('pie-legend-item-active', 'pie-legend-item-dimmed');
            });
            if (tooltip) Tooltip.hide(tooltip);
        }

        function showTooltip(index, event) {
            if (!tooltip) return;
            const slice = slices[index];
            if (!slice) return;
            const logoUrl = container._pieLogoResolver ? container._pieLogoResolver(slice.label) : '';
            const logoHtml = logoUrl
                ? `<img class="pie-cross-label-logo" src="${escapeAttr(logoUrl)}" alt="" aria-hidden="true">`
                : '';
            tooltip.innerHTML = `${logoHtml}${escapeHtml(slice.label)}: ${slice.value} (${slice.percentage.toFixed(1)}%)`;
            Tooltip.show(tooltip);
            Tooltip.positionNearCursor(event, svgContainer, tooltip);
            // Clamp tooltip to viewport (use clientWidth for reliable mobile measurement)
            const tipRect = tooltip.getBoundingClientRect();
            const containerRect = svgContainer.getBoundingClientRect();
            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            if (tipRect.right > vw - 4) {
                const currentLeft = parseFloat(tooltip.style.left) || 0;
                tooltip.style.left = (currentLeft - (tipRect.right - vw + 4)) + 'px';
            }
            if (tipRect.left < 4) {
                const currentLeft = parseFloat(tooltip.style.left) || 0;
                tooltip.style.left = (currentLeft + (4 - tipRect.left)) + 'px';
            }
            if (tipRect.bottom > vh - 4) {
                const currentTop = parseFloat(tooltip.style.top) || 0;
                tooltip.style.top = (currentTop - (tipRect.bottom - vh + 4)) + 'px';
            }
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

    const escapeHtml = (str) => window.R3EUtils.escapeHtml(str);

    function escapeAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* --- Slice label helpers (used by cross-chart interactions) --- */

    const LABEL_MIN_X_OFFSET = 52; // minimum % from center (prevents overlap with pie)
    const LABEL_ELLIPSE_X = 65;   // ellipse X radius for circular placement
    const LABEL_ELLIPSE_Y = 42;   // ellipse Y radius for ideal Y
    const LABEL_MAX_CHARS = 30;
    const LABEL_MIN_GAP_PCT = 7;  // dynamic gap floor; actual gap = available space / (n-1)
    const LABEL_MAX_PER_SIDE = 11;

    /**
     * Show floating labels on highlighted (active) slices in a chart.
     * Labels are placed in fixed columns on each side, ordered by angle
     * to prevent connector crossings.
     * @param {HTMLElement} chartEl - The chart container element
     * @param {NodeList|Array} slices - The pie slice elements to check
     */
    function showSliceLabels(chartEl, slices) {
        const svgContainer = chartEl.querySelector('.pie-chart-svg-container');
        if (!svgContainer) return;
        const active = [];
        slices.forEach(slice => {
            if (!slice.classList.contains('pie-slice-active')) return;
            const label = slice.getAttribute('data-label') || '';
            if (!label) return;
            const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
            if (isNaN(midAngle)) return;
            const pct = parseFloat(slice.getAttribute('data-percentage')) || 0;
            const color = slice.getAttribute('fill') || '';
            active.push({ label, midAngle, pct, color });
        });
        if (active.length === 0) return;

        // Assign sides based on angle
        const positions = active.map(({ label, midAngle, pct, color }) => {
            const side = Math.cos(midAngle) >= 0 ? 1 : -1;
            return {
                label: shortenLabel(label),
                originalLabel: label,
                side,
                midAngle,
                color,
                pct,
                // Ideal Y from angle (percentage of container height)
                idealY: 50 + Math.sin(midAngle) * LABEL_ELLIPSE_Y,
                x: 0,
                y: 0
            };
        });

        // Split into sides
        const right = positions.filter(p => p.side >= 0);
        const left = positions.filter(p => p.side < 0);

        // Greedy placement: biggest slices first, skip if displaced too far
        const placedRight = greedyPlace(right);
        const placedLeft = greedyPlace(left);

        const allPositions = [...placedRight, ...placedLeft];
        allPositions.forEach(p => {
            const normalizedY = (p.y - 50) / LABEL_ELLIPSE_Y;
            const clamped = Math.max(-1, Math.min(1, normalizedY));
            const cosComponent = Math.sqrt(1 - clamped * clamped);
            // Use the larger of: ellipse curve or minimum offset
            const xOffset = Math.max(LABEL_MIN_X_OFFSET, LABEL_ELLIPSE_X * cosComponent);
            p.x = 50 + p.side * xOffset;
        });

        // Always draw connector lines
        if (allPositions.length >= 1) {
            const linesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            linesSvg.setAttribute('class', 'pie-connector-lines');
            linesSvg.setAttribute('viewBox', '0 0 100 100');
            linesSvg.setAttribute('preserveAspectRatio', 'none');
            const EDGE_RADIUS = 44;
            allPositions.forEach(p => {
                const edgeX = 50 + Math.cos(p.midAngle) * EDGE_RADIUS;
                const edgeY = 50 + Math.sin(p.midAngle) * EDGE_RADIUS;
                // Elbow at label Y, slightly inside label X
                const elbowX = p.x - p.side * 4;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                line.setAttribute('points',
                    `${edgeX.toFixed(1)},${edgeY.toFixed(1)} ` +
                    `${elbowX.toFixed(1)},${p.y.toFixed(1)} ` +
                    `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                if (p.color) line.setAttribute('stroke', p.color);
                linesSvg.appendChild(line);
            });
            svgContainer.appendChild(linesSvg);
        }

        // Retrieve logoResolver stored at render time
        const chartContainer = chartEl.closest('.driver-profile-chart-card') || chartEl;
        const logoResolver = chartContainer._pieLogoResolver || null;

        allPositions.forEach(({ label, originalLabel, x, y, side }) => {
            const el = document.createElement('span');
            el.className = 'pie-cross-label' + (side >= 0 ? ' pie-cross-label-right' : ' pie-cross-label-left');
            // Add logo icon if available
            const logoUrl = logoResolver ? logoResolver(originalLabel || label) : '';
            if (logoUrl) {
                const img = document.createElement('img');
                img.className = 'pie-cross-label-logo';
                img.src = logoUrl;
                img.alt = '';
                img.setAttribute('aria-hidden', 'true');
                el.appendChild(img);
            }
            const text = label.length > LABEL_MAX_CHARS ? label.slice(0, LABEL_MAX_CHARS) + '\u2026' : label;
            el.appendChild(document.createTextNode(text));
            el.style.left = x.toFixed(1) + '%';
            el.style.top = y.toFixed(1) + '%';
            svgContainer.appendChild(el);
        });

        // Post-render: fix vertical overlaps using actual pixel measurements
        resolveVerticalOverlaps(svgContainer);

        // Push labels that overflow viewport edges inward.
        // Use double-rAF to ensure layout is computed on real mobile devices
        // (synchronous getBoundingClientRect is unreliable on mobile after DOM insertion).
        clampLabelsToScreen(svgContainer);
        clampLabelsToViewport();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                clampLabelsToScreen(svgContainer);
                clampLabelsToViewport();
            });
        });
    }

    /**
     * After labels are in the DOM, check actual bounding rects within a single
     * container and push overlapping labels apart vertically.
     */
    function resolveVerticalOverlaps(container) {
        const labels = Array.from(container.querySelectorAll('.pie-cross-label'));
        if (labels.length < 2) return;

        // Split by side
        const leftLabels = labels.filter(el => el.classList.contains('pie-cross-label-left'));
        const rightLabels = labels.filter(el => el.classList.contains('pie-cross-label-right'));

        fixSideOverlaps(leftLabels, container);
        fixSideOverlaps(rightLabels, container);
    }

    function fixSideOverlaps(sideLabels, container) {
        if (sideLabels.length < 2) return;
        const containerHeight = container.getBoundingClientRect().height;
        if (!containerHeight) return;

        // Sort by current top value
        sideLabels.sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));

        // Multiple passes to resolve cascading overlaps
        for (let pass = 0; pass < 4; pass++) {
            let anyFixed = false;
            for (let i = 0; i < sideLabels.length - 1; i++) {
                const aRect = sideLabels[i].getBoundingClientRect();
                const bRect = sideLabels[i + 1].getBoundingClientRect();
                const overlapY = aRect.bottom - bRect.top + 1; // +1px padding
                if (overlapY > 0) {
                    anyFixed = true;
                    // Convert pixel overlap to percentage and push the lower label down
                    const shiftPct = (overlapY / containerHeight) * 100;
                    const currentTop = parseFloat(sideLabels[i + 1].style.top) || 50;
                    const newTop = Math.min(99, currentTop + shiftPct);
                    sideLabels[i + 1].style.top = newTop.toFixed(1) + '%';
                }
            }
            if (!anyFixed) break;
        }
    }

    function shortenLabel(label) {
        return label.replace(/Grand Prix/g, 'GP');
    }

    /**
     * Greedy label placement: process slices from largest to smallest.
     * For each, try to place at ideal Y. If it overlaps with already-placed
     * labels, nudge to nearest free slot. If displaced too far, skip it.
     * After selection, re-sort by angle and distribute evenly to prevent
     * connector line crossings.
     */
    function greedyPlace(group) {
        if (group.length === 0) return [];

        const MIN_Y = -8;
        const MAX_Y = 98;
        const MAX_DISPLACEMENT = 25; // max % a label can be pushed from its ideal spot

        // Sort by pct descending (biggest first)
        const sorted = [...group].sort((a, b) => b.pct - a.pct);
        const selected = [];

        for (const item of sorted) {
            if (selected.length >= LABEL_MAX_PER_SIDE) break;

            const idealY = item.idealY;
            const y = findFreeSlot(selected, idealY, LABEL_MIN_GAP_PCT, MIN_Y, MAX_Y);

            if (y === null || Math.abs(y - idealY) > MAX_DISPLACEMENT) {
                continue; // skip this label — no room without excessive displacement
            }

            item.y = y;
            // Insert maintaining sort order by y for slot-finding
            const insertIdx = selected.findIndex(p => p.y > y);
            if (insertIdx === -1) {
                selected.push(item);
            } else {
                selected.splice(insertIdx, 0, item);
            }
        }

        if (selected.length === 0) return [];

        // Re-sort selected labels by angle order (idealY) to prevent connector crossings
        selected.sort((a, b) => a.idealY - b.idealY);

        // Distribute Y positions starting from each label's ideal, then resolve overlaps
        const n = selected.length;

        // Start at ideal positions
        for (let i = 0; i < n; i++) {
            selected[i].y = selected[i].idealY;
        }

        // Spread from center outward: find the median, then push neighbors apart bidirectionally
        const mid = Math.floor(n / 2);
        // Push upper half upward
        for (let i = mid - 1; i >= 0; i--) {
            const maxAllowed = selected[i + 1].y - LABEL_MIN_GAP_PCT;
            if (selected[i].y > maxAllowed) {
                selected[i].y = maxAllowed;
            }
        }
        // Push lower half downward
        for (let i = mid + 1; i < n; i++) {
            const minAllowed = selected[i - 1].y + LABEL_MIN_GAP_PCT;
            if (selected[i].y < minAllowed) {
                selected[i].y = minAllowed;
            }
        }

        // Clamp to bounds and cascade
        if (selected[0].y < MIN_Y) {
            selected[0].y = MIN_Y;
            for (let i = 1; i < n; i++) {
                const minAllowed = selected[i - 1].y + LABEL_MIN_GAP_PCT;
                if (selected[i].y < minAllowed) {
                    selected[i].y = minAllowed;
                }
            }
        }
        if (selected[n - 1].y > MAX_Y) {
            selected[n - 1].y = MAX_Y;
            for (let i = n - 2; i >= 0; i--) {
                const maxAllowed = selected[i + 1].y - LABEL_MIN_GAP_PCT;
                if (selected[i].y > maxAllowed) {
                    selected[i].y = maxAllowed;
                }
            }
        }

        // Compute X for each placed label
        selected.forEach(p => {
            const normalizedY = (p.y - 50) / LABEL_ELLIPSE_Y;
            const clamped = Math.max(-1, Math.min(1, normalizedY));
            const cosComponent = Math.sqrt(1 - clamped * clamped);
            const xOffset = Math.max(LABEL_MIN_X_OFFSET, LABEL_ELLIPSE_X * cosComponent);
            p.x = 50 + p.side * xOffset;
        });

        return selected;
    }

    /**
     * Find the nearest Y position to idealY that doesn't overlap with
     * already-placed labels (maintaining minGap between each).
     * Returns null if no valid position exists within bounds.
     */
    function findFreeSlot(placed, idealY, minGap, minY, maxY) {
        if (placed.length === 0) {
            return Math.max(minY, Math.min(maxY, idealY));
        }

        // Check if idealY itself works
        if (isSlotFree(placed, idealY, minGap, minY, maxY)) {
            return idealY;
        }

        // Search outward from idealY in both directions
        for (let offset = 1; offset <= 50; offset += 0.5) {
            const above = idealY - offset;
            const below = idealY + offset;
            if (above >= minY && isSlotFree(placed, above, minGap, minY, maxY)) {
                return above;
            }
            if (below <= maxY && isSlotFree(placed, below, minGap, minY, maxY)) {
                return below;
            }
            // If both are out of bounds, give up
            if (above < minY && below > maxY) break;
        }

        return null;
    }

    function isSlotFree(placed, y, minGap, minY, maxY) {
        if (y < minY || y > maxY) return false;
        for (const p of placed) {
            if (Math.abs(p.y - y) < minGap) return false;
        }
        return true;
    }

    function clearSliceLabels() {
        document.querySelectorAll('.pie-cross-label').forEach(el => el.remove());
        document.querySelectorAll('.pie-connector-lines').forEach(el => el.remove());
    }

    /**
     * Push labels that overflow viewport edges inward so they stay on screen.
     */
    function clampLabelsToScreen(container) {
        const labels = Array.from(container.querySelectorAll('.pie-cross-label'));
        if (labels.length === 0) return;
        const containerWidth = container.getBoundingClientRect().width;
        if (!containerWidth) return;
        const containerLeft = container.getBoundingClientRect().left;
        const viewportWidth = document.documentElement.clientWidth;

        labels.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > viewportWidth - 2) {
                // Overflows right edge — push left
                const overflow = rect.right - viewportWidth + 4;
                const shiftPct = (overflow / containerWidth) * 100;
                const currentLeft = parseFloat(el.style.left) || 50;
                el.style.left = (currentLeft - shiftPct).toFixed(1) + '%';
            } else if (rect.left < 2) {
                // Overflows left edge — push right
                const overflow = 4 - rect.left;
                const shiftPct = (overflow / containerWidth) * 100;
                const currentLeft = parseFloat(el.style.left) || 50;
                el.style.left = (currentLeft + shiftPct).toFixed(1) + '%';
            }
        });
    }

    /**
     * After all charts have placed labels, detect cross-chart overlaps
     * and nudge the overlapping label (from whichever chart) toward its
     * own pie center by the exact overlap amount.
     */
    function clampLabelsToViewport() {
        const allLabels = Array.from(document.querySelectorAll('.pie-cross-label'));
        if (allLabels.length < 2) return;

        for (let i = 0; i < allLabels.length; i++) {
            for (let j = i + 1; j < allLabels.length; j++) {
                const a = allLabels[i];
                const b = allLabels[j];
                // Only resolve labels from different containers
                if (a.parentElement === b.parentElement) continue;
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                if (!rectsOverlap(aRect, bRect)) continue;

                // Calculate horizontal overlap amount
                const overlapX = Math.min(aRect.right, bRect.right) - Math.max(aRect.left, bRect.left);
                if (overlapX <= 0) continue;

                // Determine container widths for % conversion
                const aContainer = a.parentElement;
                const bContainer = b.parentElement;
                const aWidth = aContainer ? aContainer.getBoundingClientRect().width || 1 : 1;
                const bWidth = bContainer ? bContainer.getBoundingClientRect().width || 1 : 1;

                // Move the label that's further from center (50%)
                const aLeft = parseFloat(a.style.left) || 50;
                const bLeft = parseFloat(b.style.left) || 50;
                const aDist = Math.abs(aLeft - 50);
                const bDist = Math.abs(bLeft - 50);

                if (aDist >= bDist) {
                    // Move 'a' inward by the overlap amount (converted to %)
                    const shiftPct = (overlapX / aWidth) * 100 + 1;
                    const nudge = aLeft > 50 ? -shiftPct : shiftPct;
                    a.style.left = (aLeft + nudge).toFixed(1) + '%';
                } else {
                    const shiftPct = (overlapX / bWidth) * 100 + 1;
                    const nudge = bLeft > 50 ? -shiftPct : shiftPct;
                    b.style.left = (bLeft + nudge).toFixed(1) + '%';
                }
            }
        }
    }

    function rectsOverlap(a, b) {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }

    window.PieChart = { render, computeSlices, COLORS, showSliceLabels, clearSliceLabels };
})();
