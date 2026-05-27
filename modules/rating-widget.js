/**
 * Car Rating Widget — interactive star/heart rating UI component.
 * Shared by Cars page (table + tile views) and Challenge Picker.
 *
 * Depends on: window.CarRatings (car-ratings.js) for persistence.
 * Exposes: window.CarRatingWidget { buildHtml, attachHandlers }
 */
(function () {
    'use strict';

    var escHtml = (typeof R3EUtils !== 'undefined' && R3EUtils.escapeHtml)
        ? R3EUtils.escapeHtml
        : function (t) { return String(t || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    function buildHtml(carId, currentRating, variant) {
        if (typeof CarRatings === 'undefined') return '';
        var encId = escHtml(carId);
        var widgetClass = variant === 'table'
            ? 'rating-widget rating-widget--table'
            : 'rating-widget rating-widget--tile';

        var html = '<div class="' + widgetClass + '" data-car-id="' + encId + '" data-rated="' + (currentRating > 0) + '" data-score-level="' + currentRating + '" aria-label="Rate this car">';
        for (var s = 1; s <= 5; s++) {
            var filled = currentRating >= s;
            var btnCls = 'rating-btn' + (filled ? ' is-rated' : '');
            html += '<span class="' + btnCls + '" role="button" tabindex="-1" data-score="' + s + '" data-filled="' + filled + '" aria-label="Rate ' + s + ' star' + (s > 1 ? 's' : '') + '">' + (filled ? '★' : '☆') + '</span>';
        }
        var heartFilled = currentRating === 6;
        var heartCls = 'rating-btn rating-heart' + (heartFilled ? ' is-rated' : '');
        html += '<span class="' + heartCls + '" role="button" tabindex="-1" data-score="6" data-filled="' + heartFilled + '" aria-label="Add to favorites">' + (heartFilled ? '♥' : '♡') + '</span>';
        html += '</div>';
        return html;
    }

    function attachHandlers(rootEl) {
        if (typeof CarRatings === 'undefined') return;

        function syncSiblingWidgets(root, sourceWidget, newRating) {
            if (typeof CarRatings === 'undefined' || typeof CarRatings.normalizeCarName !== 'function') return;
            var sourceId = sourceWidget.getAttribute('data-car-id');
            if (!sourceId) return;
            var sourceParts = sourceId.split('||');
            if (sourceParts.length !== 4) return;
            var sourceName = CarRatings.normalizeCarName(sourceParts[1]);
            var sourceYear = (sourceParts[2] || '').trim().toLowerCase();

            Array.from(root.querySelectorAll('.rating-widget')).forEach(function (w) {
                if (w === sourceWidget) return;
                var wId = w.getAttribute('data-car-id');
                if (!wId) return;
                var wParts = wId.split('||');
                if (wParts.length !== 4) return;
                var wName = CarRatings.normalizeCarName(wParts[1]);
                var wYear = (wParts[2] || '').trim().toLowerCase();
                if (wName === sourceName && wYear === sourceYear && w._updateRatingDisplay) {
                    w._updateRatingDisplay(newRating);
                }
            });
        }

        Array.from(rootEl.querySelectorAll('.rating-widget')).forEach(function (widget) {
            var carId = widget.getAttribute('data-car-id');
            if (!carId) return;
            var buttons = Array.from(widget.querySelectorAll('.rating-btn'));

            function updateDisplay(rating) {
                widget.setAttribute('data-rated', rating > 0 ? 'true' : 'false');
                widget.setAttribute('data-score-level', String(rating));
                buttons.forEach(function (btn) {
                    var score = parseInt(btn.getAttribute('data-score'));
                    var isHeart = btn.classList.contains('rating-heart');
                    btn.classList.remove('is-preview');
                    if (isHeart) {
                        var filled = rating === 6;
                        btn.classList.toggle('is-rated', filled);
                        btn.setAttribute('data-filled', filled);
                        btn.textContent = filled ? '♥' : '♡';
                    } else {
                        var filled = rating >= score;
                        btn.classList.toggle('is-rated', filled);
                        btn.setAttribute('data-filled', filled);
                        btn.textContent = filled ? '★' : '☆';
                    }
                });
            }

            widget._updateRatingDisplay = updateDisplay;

            widget.addEventListener('mouseover', function (e) {
                var btn = e.target.closest('.rating-btn');
                if (!btn) return;
                var previewScore = parseInt(btn.getAttribute('data-score'));
                buttons.forEach(function (b) {
                    var s = parseInt(b.getAttribute('data-score'));
                    var isHeart = b.classList.contains('rating-heart');
                    if (previewScore === 6) {
                        b.classList.add('is-preview');
                        b.textContent = isHeart ? '♥' : '★';
                    } else if (isHeart) {
                        b.classList.remove('is-preview');
                        b.textContent = '♡';
                    } else {
                        b.classList.toggle('is-preview', s <= previewScore);
                        b.textContent = s <= previewScore ? '★' : '☆';
                    }
                });
            });

            widget.addEventListener('mouseout', function (e) {
                if (widget.contains(e.relatedTarget)) return;
                updateDisplay(CarRatings.get(carId));
            });

            buttons.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var score = parseInt(btn.getAttribute('data-score'));
                    var current = CarRatings.get(carId);
                    var newRating = current === score ? 0 : score;
                    CarRatings.set(carId, newRating);
                    updateDisplay(newRating);
                    syncSiblingWidgets(rootEl, widget, newRating);
                });
            });
        });
    }

    window.CarRatingWidget = {
        buildHtml: buildHtml,
        attachHandlers: attachHandlers
    };
})();
