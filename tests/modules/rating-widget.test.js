import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CarRatingWidget', () => {
    beforeAll(() => {
        window.CarRatings = {
            get: vi.fn(() => 0),
            set: vi.fn(),
            normalizeCarName: vi.fn(n => n.toLowerCase().trim())
        };
        loadBrowserScript('modules/rating-widget.js');
    });

    beforeEach(() => {
        vi.clearAllMocks();
        window.CarRatings.get.mockReturnValue(0);
    });

    // ── buildHtml ───────────────────────────────────────────────────

    describe('buildHtml', () => {
        test('returns empty string when CarRatings is undefined', () => {
            const saved = window.CarRatings;
            delete window.CarRatings;
            expect(window.CarRatingWidget.buildHtml('id', 0, 'tile')).toBe('');
            window.CarRatings = saved;
        });

        test('returns widget HTML with tile variant class', () => {
            const html = window.CarRatingWidget.buildHtml('GT3||BMW||2022||/car/1', 0, 'tile');
            expect(html).toContain('class="rating-widget rating-widget--tile"');
            expect(html).toContain('data-car-id="GT3||BMW||2022||/car/1"');
            expect(html).toContain('data-rated="false"');
            expect(html).toContain('data-score-level="0"');
        });

        test('returns widget HTML with table variant class', () => {
            const html = window.CarRatingWidget.buildHtml('id', 0, 'table');
            expect(html).toContain('class="rating-widget rating-widget--table"');
        });

        test('renders 5 star buttons plus 1 heart button', () => {
            const html = window.CarRatingWidget.buildHtml('id', 0, 'tile');
            const starCount = (html.match(/rating-btn"/g) || []).length;
            const heartCount = (html.match(/rating-heart/g) || []).length;
            expect(starCount).toBe(5);
            expect(heartCount).toBe(1);
        });

        test('marks stars as filled when rating > 0', () => {
            const html = window.CarRatingWidget.buildHtml('id', 3, 'tile');
            expect(html).toContain('data-rated="true"');
            expect(html).toContain('data-score-level="3"');
            // First 3 stars should be filled
            const buttons = html.match(/<span class="rating-btn[^"]*"[^>]*>/g);
            expect(buttons[0]).toContain('is-rated');
            expect(buttons[1]).toContain('is-rated');
            expect(buttons[2]).toContain('is-rated');
            // 4th and 5th should not be filled
            expect(buttons[3]).not.toContain('is-rated');
            expect(buttons[4]).not.toContain('is-rated');
        });

        test('marks heart as filled when rating is 6', () => {
            const html = window.CarRatingWidget.buildHtml('id', 6, 'tile');
            expect(html).toContain('rating-heart is-rated');
            expect(html).toContain('♥');
        });

        test('escapes HTML in carId', () => {
            const html = window.CarRatingWidget.buildHtml('<script>', 0, 'tile');
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });
    });

    // ── attachHandlers ──────────────────────────────────────────────

    describe('attachHandlers', () => {
        function createWidget(carId, rating) {
            const div = document.createElement('div');
            div.innerHTML = window.CarRatingWidget.buildHtml(carId, rating, 'tile');
            document.body.appendChild(div);
            return div;
        }

        beforeEach(() => {
            document.body.innerHTML = '';
        });

        test('does nothing when CarRatings is undefined', () => {
            const saved = window.CarRatings;
            delete window.CarRatings;
            const div = document.createElement('div');
            div.innerHTML = '<div class="rating-widget" data-car-id="x"></div>';
            // Should not throw
            expect(() => window.CarRatingWidget.attachHandlers(div)).not.toThrow();
            window.CarRatings = saved;
        });

        test('click on star sets rating via CarRatings.set', () => {
            const container = createWidget('GT3||BMW||2022||/car/1', 0);
            window.CarRatingWidget.attachHandlers(container);

            const btn3 = container.querySelector('[data-score="3"]');
            btn3.click();

            expect(window.CarRatings.set).toHaveBeenCalledWith('GT3||BMW||2022||/car/1', 3);
        });

        test('click on same rating toggles it off', () => {
            window.CarRatings.get.mockReturnValue(3);
            const container = createWidget('GT3||BMW||2022||/car/1', 3);
            window.CarRatingWidget.attachHandlers(container);

            const btn3 = container.querySelector('[data-score="3"]');
            btn3.click();

            expect(window.CarRatings.set).toHaveBeenCalledWith('GT3||BMW||2022||/car/1', 0);
        });

        test('click updates DOM display', () => {
            const container = createWidget('GT3||BMW||2022||/car/1', 0);
            window.CarRatingWidget.attachHandlers(container);

            const btn2 = container.querySelector('[data-score="2"]');
            btn2.click();

            const widget = container.querySelector('.rating-widget');
            expect(widget.getAttribute('data-rated')).toBe('true');
            expect(widget.getAttribute('data-score-level')).toBe('2');

            // First 2 buttons should show filled stars
            const buttons = container.querySelectorAll('.rating-btn:not(.rating-heart)');
            expect(buttons[0].textContent).toBe('★');
            expect(buttons[1].textContent).toBe('★');
            expect(buttons[2].textContent).toBe('☆');
        });

        test('click on heart sets rating to 6', () => {
            const container = createWidget('GT3||BMW||2022||/car/1', 0);
            window.CarRatingWidget.attachHandlers(container);

            const heart = container.querySelector('.rating-heart');
            heart.click();

            expect(window.CarRatings.set).toHaveBeenCalledWith('GT3||BMW||2022||/car/1', 6);
            expect(heart.textContent).toBe('♥');
            expect(heart.classList.contains('is-rated')).toBe(true);
        });

        test('syncs sibling widgets with same car name and year', () => {
            const container = document.createElement('div');
            // Two widgets for the same car (same name/year, different link)
            container.innerHTML =
                window.CarRatingWidget.buildHtml('GT3||BMW M4||2022||/car/1', 0, 'tile') +
                window.CarRatingWidget.buildHtml('GT3||BMW M4||2022||/car/2', 0, 'table');
            document.body.appendChild(container);
            window.CarRatingWidget.attachHandlers(container);

            // Click star 4 on first widget
            const firstWidget = container.querySelectorAll('.rating-widget')[0];
            const btn4 = firstWidget.querySelector('[data-score="4"]');
            btn4.click();

            // Second widget should be synced
            const secondWidget = container.querySelectorAll('.rating-widget')[1];
            expect(secondWidget.getAttribute('data-score-level')).toBe('4');
        });

        test('does not sync widgets with different car names', () => {
            const container = document.createElement('div');
            container.innerHTML =
                window.CarRatingWidget.buildHtml('GT3||BMW M4||2022||/car/1', 0, 'tile') +
                window.CarRatingWidget.buildHtml('GT3||Porsche 911||2022||/car/2', 0, 'tile');
            document.body.appendChild(container);
            window.CarRatingWidget.attachHandlers(container);

            const firstWidget = container.querySelectorAll('.rating-widget')[0];
            firstWidget.querySelector('[data-score="5"]').click();

            const secondWidget = container.querySelectorAll('.rating-widget')[1];
            expect(secondWidget.getAttribute('data-score-level')).toBe('0');
        });
    });
});
