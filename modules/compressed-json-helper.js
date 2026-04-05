(function () {
    function ensureDecompressionSupport() {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('DecompressionStream is not supported in this browser. Please use a modern browser.');
        }
    }

    async function readGzipText(response) {
        if (!response || !response.body) {
            throw new Error('Invalid response body for gzip decompression.');
        }

        ensureDecompressionSupport();

        const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).text();
    }

    async function readGzipJson(response) {
        const text = await readGzipText(response);

        if (!text || text.trim().length === 0) {
            throw new Error('Compressed JSON response is empty.');
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error(`Invalid compressed JSON payload: ${error.message}`);
        }
    }

    window.CompressedJsonHelper = {
        ensureDecompressionSupport,
        readGzipText,
        readGzipJson
    };
})();