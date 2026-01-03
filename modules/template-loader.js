/**
 * Template Loader Module
 * Loads and processes HTML templates with variable substitution
 */

(function() {
    'use strict';

    const templateCache = {};

    /**
     * Load a template from the templates folder
     * @param {string} templateName - Name of the template file (without .html extension)
     * @returns {Promise<string>} Template content
     */
    async function loadTemplate(templateName) {
        // Return from cache if already loaded
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

    /**
     * Process template with data substitution
     * Supports {{variable}}, {{#if condition}}...{{/if}}, {{#each array}}...{{/each}}
     * @param {string} template - Template string
     * @param {Object} data - Data object for substitution
     * @returns {string} Processed template
     */
    function processTemplate(template, data = {}) {
        let result = template;

        // Process conditionals {{#if condition}}...{{/if}}
        result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            return data[condition] ? content : '';
        });

        // Process each loops {{#each array}}...{{/each}}
        result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, itemTemplate) => {
            const array = data[arrayName];
            if (!Array.isArray(array)) return '';
            return array.map(item => processTemplate(itemTemplate, item)).join('');
        });

        // Process simple variable substitution {{variable}}
        result = result.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            const value = data[variable];
            return value !== undefined && value !== null ? String(value) : '';
        });

        return result;
    }

    /**
     * Render a template with data
     * @param {string} templateName - Name of the template file
     * @param {Object} data - Data for template substitution
     * @returns {Promise<string>} Rendered HTML
     */
    async function render(templateName, data = {}) {
        const template = await loadTemplate(templateName);
        return processTemplate(template, data);
    }

    /**
     * Preload multiple templates at once
     * @param {string[]} templateNames - Array of template names
     * @returns {Promise<void>}
     */
    async function preloadTemplates(templateNames) {
        await Promise.all(templateNames.map(name => loadTemplate(name)));
    }

    // Export to global scope
    window.TemplateLoader = {
        loadTemplate,
        processTemplate,
        render,
        preloadTemplates
    };

})();
