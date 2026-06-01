const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            reportsDirectory: 'coverage',
            exclude: [
                'modules/lib/**',
                'node_modules/**',
                'tests/**',
                'cache/**',
                'vitest.config.js'
            ]
        }
    }
});