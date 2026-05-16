import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('TemplateLoader', () => {
    beforeEach(() => {
        // Re-create TemplateLoader fresh each test by reloading the script
        delete window.TemplateLoader;
        window.R3EUtils = { fetchWithTimeout: (url, options = {}) => fetch(url, options) };
        loadBrowserScript('modules/loaders/template-loader.js');
    });

    // ── processTemplate: simple variable substitution ───────────────

    describe('processTemplate', () => {
        it('replaces simple variables', () => {
            const result = window.TemplateLoader.processTemplate(
                'Hello {{name}}, you are {{age}}.',
                { name: 'Alice', age: 30 }
            );
            expect(result).toBe('Hello Alice, you are 30.');
        });

        it('replaces missing variables with empty string', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{greeting}} {{name}}!',
                { greeting: 'Hi' }
            );
            expect(result).toBe('Hi !');
        });

        it('handles null and undefined values', () => {
            expect(window.TemplateLoader.processTemplate('{{a}}', { a: null })).toBe('');
            expect(window.TemplateLoader.processTemplate('{{a}}', { a: undefined })).toBe('');
        });

        it('handles zero and false values', () => {
            expect(window.TemplateLoader.processTemplate('{{a}}', { a: 0 })).toBe('0');
            expect(window.TemplateLoader.processTemplate('{{a}}', { a: false })).toBe('false');
        });

        it('returns template unchanged when no data provided', () => {
            expect(window.TemplateLoader.processTemplate('No vars here')).toBe('No vars here');
        });
    });

    // ── processTemplate: {{#if}} conditionals ───────────────────────

    describe('processTemplate conditionals', () => {
        it('includes content when condition is truthy', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#if show}}visible{{/if}}',
                { show: true }
            );
            expect(result).toBe('visible');
        });

        it('excludes content when condition is falsy', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#if show}}visible{{/if}}',
                { show: false }
            );
            expect(result).toBe('');
        });

        it('excludes content when condition is missing', () => {
            const result = window.TemplateLoader.processTemplate(
                'before{{#if missing}}hidden{{/if}}after',
                {}
            );
            expect(result).toBe('beforeafter');
        });

        it('processes variables inside if blocks', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#if show}}Hello {{name}}{{/if}}',
                { show: true, name: 'Bob' }
            );
            expect(result).toBe('Hello Bob');
        });
    });

    // ── processTemplate: {{#each}} loops ────────────────────────────

    describe('processTemplate each loops', () => {
        it('iterates over arrays', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#each items}}<li>{{label}}</li>{{/each}}',
                { items: [{ label: 'A' }, { label: 'B' }] }
            );
            expect(result).toBe('<li>A</li><li>B</li>');
        });

        it('returns empty string when array is missing', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#each items}}item{{/each}}',
                {}
            );
            expect(result).toBe('');
        });

        it('returns empty string when value is not an array', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#each items}}item{{/each}}',
                { items: 'not-array' }
            );
            expect(result).toBe('');
        });

        it('handles empty array', () => {
            const result = window.TemplateLoader.processTemplate(
                '{{#each items}}item{{/each}}',
                { items: [] }
            );
            expect(result).toBe('');
        });
    });

    // ── loadTemplate / render ───────────────────────────────────────

    describe('loadTemplate and render', () => {
        beforeEach(() => {
            global.fetch = vi.fn();
        });

        it('fetches and caches templates', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('<p>{{content}}</p>')
            });

            const first = await window.TemplateLoader.loadTemplate('test-tpl');
            expect(first).toBe('<p>{{content}}</p>');
            expect(global.fetch).toHaveBeenCalledOnce();

            // Second call should return cached version without fetching again
            const second = await window.TemplateLoader.loadTemplate('test-tpl');
            expect(second).toBe('<p>{{content}}</p>');
            expect(global.fetch).toHaveBeenCalledOnce();
        });

        it('returns empty string on fetch failure', async () => {
            global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
            const result = await window.TemplateLoader.loadTemplate('missing');
            expect(result).toBe('');
        });

        it('returns empty string on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            const result = await window.TemplateLoader.loadTemplate('broken');
            expect(result).toBe('');
        });

        it('render fetches template and applies data', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('Hello {{name}}!')
            });
            const result = await window.TemplateLoader.render('greeting', { name: 'World' });
            expect(result).toBe('Hello World!');
        });
    });

    // ── preloadTemplates ────────────────────────────────────────────

    describe('preloadTemplates', () => {
        beforeEach(() => {
            global.fetch = vi.fn();
        });

        it('preloads multiple templates in parallel', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<h>H</h>') })
                .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<f>F</f>') });

            await window.TemplateLoader.preloadTemplates(['header', 'footer']);
            expect(global.fetch).toHaveBeenCalledTimes(2);

            // Subsequent loads should be cached
            global.fetch.mockClear();
            const h = await window.TemplateLoader.loadTemplate('header');
            const f = await window.TemplateLoader.loadTemplate('footer');
            expect(h).toBe('<h>H</h>');
            expect(f).toBe('<f>F</f>');
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });
});
