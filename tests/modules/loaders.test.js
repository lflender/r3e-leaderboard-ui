import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('HeaderLoader', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="site-header"></div>';
        window.TemplateLoader = {
            render: vi.fn().mockResolvedValue('<header>Test Header</header>')
        };
    });

    it('injects header HTML into #site-header', async () => {
        loadBrowserScript('modules/loaders/header-loader.js');
        // The IIFE fires immediately since readyState is already 'complete' in jsdom
        await vi.waitFor(() => {
            expect(document.getElementById('site-header').innerHTML).toBe('<header>Test Header</header>');
        });
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('header');
    });

    it('does nothing when #site-header is missing', () => {
        document.body.innerHTML = '';
        loadBrowserScript('modules/loaders/header-loader.js');
        expect(window.TemplateLoader.render).not.toHaveBeenCalled();
    });

    it('does nothing when TemplateLoader is unavailable', () => {
        delete window.TemplateLoader;
        loadBrowserScript('modules/loaders/header-loader.js');
        expect(document.getElementById('site-header').innerHTML).toBe('');
    });
});

describe('FooterLoader', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="site-footer"></div>';
        window.TemplateLoader = {
            render: vi.fn().mockResolvedValue('<footer>Test Footer</footer>')
        };
    });

    it('injects footer HTML into #site-footer', async () => {
        loadBrowserScript('modules/loaders/footer-loader.js');
        await vi.waitFor(() => {
            expect(document.getElementById('site-footer').innerHTML).toBe('<footer>Test Footer</footer>');
        });
        expect(window.TemplateLoader.render).toHaveBeenCalledWith('footer');
    });

    it('does nothing when #site-footer is missing', () => {
        document.body.innerHTML = '';
        loadBrowserScript('modules/loaders/footer-loader.js');
        expect(window.TemplateLoader.render).not.toHaveBeenCalled();
    });

    it('does nothing when TemplateLoader is unavailable', () => {
        delete window.TemplateLoader;
        loadBrowserScript('modules/loaders/footer-loader.js');
        expect(document.getElementById('site-footer').innerHTML).toBe('');
    });
});
