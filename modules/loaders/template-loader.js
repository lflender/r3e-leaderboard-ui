/**
 * Template Loader Module
 * Loads and processes HTML templates with variable substitution
 */

(function() {
    'use strict';

    const templateCache = {};

    async function loadTemplate(templateName) {
        if (templateCache[templateName]) {
            return templateCache[templateName];
        }

        try {
            const response = await fetch(`templates/${templateName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${templateName}`);
            }
            const content = await response.text();
            templateCache[templateName] = content;
            return content;
        } catch (error) {
            console.error(`Error loading template ${templateName}:`, error);
            return '';
        }
    }

    function processTemplate(template, data = {}) {
        let result = template;

        result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            return data[condition] ? content : '';
        });

        result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, itemTemplate) => {
            const array = data[arrayName];
            if (!Array.isArray(array)) return '';
            return array.map(item => processTemplate(itemTemplate, item)).join('');
        });

        result = result.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            const value = data[variable];
            return value !== undefined && value !== null ? String(value) : '';
        });

        return result;
    }

    async function render(templateName, data = {}) {
        const template = await loadTemplate(templateName);
        return processTemplate(template, data);
    }

    async function preloadTemplates(templateNames) {
        await Promise.all(templateNames.map(name => loadTemplate(name)));
    }

    window.TemplateLoader = {
        loadTemplate,
        processTemplate,
        render,
        preloadTemplates
    };

})();