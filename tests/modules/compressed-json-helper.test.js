import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBrowserScript } from '../helpers/script-loader.js';

describe('CompressedJsonHelper', () => {
    beforeEach(() => {
        delete window.CompressedJsonHelper;

        global.Response = class Response {
            constructor(value) {
                this.value = value;
            }

            async text() {
                return this.value;
            }
        };

        global.DecompressionStream = class DecompressionStream {
            constructor() {}
        };

        loadBrowserScript('modules/compressed-json-helper.js');
    });

    test('reads gzipped JSON payload', async () => {
        const response = {
            body: {
                pipeThrough: vi.fn().mockReturnValue('{"ok":true,"count":3}')
            }
        };

        const parsed = await window.CompressedJsonHelper.readGzipJson(response);
        expect(parsed).toEqual({ ok: true, count: 3 });
    });

    test('throws when payload is empty', async () => {
        const response = {
            body: {
                pipeThrough: vi.fn().mockReturnValue('   ')
            }
        };

        await expect(window.CompressedJsonHelper.readGzipJson(response)).rejects.toThrow('Compressed JSON response is empty.');
    });

    test('throws when decompression support is missing', async () => {
        delete global.DecompressionStream;

        const response = {
            body: {
                pipeThrough: vi.fn().mockReturnValue('{"ok":true}')
            }
        };

        await expect(window.CompressedJsonHelper.readGzipJson(response)).rejects.toThrow('DecompressionStream is not supported in this browser. Please use a modern browser.');
    });
});
