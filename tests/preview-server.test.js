// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPreviewServer } = require('../scripts/preview-server.cjs');
let server;
let origin;

beforeAll(async () => {
    server = createPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('preview server', () => {
    it('serves the page, assets, and compressed data without caching', async () => {
        const page = await fetch(`${origin}/index.html`);
        expect(page.status).toBe(200);
        expect(page.headers.get('cache-control')).toBe('no-store');
        expect(await page.text()).toContain('ranked-series.js');

        const drivers = await fetch(`${origin}/drivers.html`);
        expect(drivers.status).toBe(200);
        expect(await drivers.text()).toContain('Driver Search');

        const css = await fetch(`${origin}/styles/style.css?v=1`);
        expect(css.headers.get('content-type')).toContain('text/css');
        const data = await fetch(`${origin}/cache/ranked_series.json.gz`);
        expect(data.headers.get('content-type')).toBe('application/gzip');
        expect(data.headers.get('content-encoding')).toBeNull();
    });

    it('returns explicit errors for missing, private, and invalid requests', async () => {
        expect((await fetch(`${origin}/missing.html`)).status).toBe(404);
        expect((await fetch(`${origin}/.git/config`)).status).toBe(404);
        expect((await fetch(`${origin}/index.html`, { method: 'POST' })).status).toBe(405);
    });
});
