const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gz': 'application/gzip',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.xml': 'application/xml; charset=utf-8'
};

function createPreviewServer() {
    return http.createServer((request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end();
            return;
        }

        let pathname;
        try {
            pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        } catch (error) {
            response.writeHead(400).end('Invalid URL');
            return;
        }

        if (pathname === '/') {
            pathname = '/index.html';
        } else if (/^\/[^/\\]+\.html$/i.test(pathname) && pathname !== '/index.html') {
            pathname = `/pages${pathname}`;
        }

        const file = path.resolve(root, `.${pathname}`);
        const relative = path.relative(root, file);
        const contentType = contentTypes[path.extname(file).toLowerCase()];
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)
            || relative.split(path.sep).some(part => part.startsWith('.') || part === 'node_modules')
            || !contentType) {
            response.writeHead(404).end('Not found');
            return;
        }

        fs.readFile(file, (error, data) => {
            if (error) {
                if (error.code === 'ENOENT' || error.code === 'EISDIR') {
                    response.writeHead(404).end('Not found');
                } else {
                    console.error('Preview server error:', error);
                    response.writeHead(500).end('Unable to read file');
                }
                return;
            }
            response.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': data.length,
                'Cache-Control': 'no-store'
            });
            response.end(request.method === 'HEAD' ? undefined : data);
        });
    });
}

if (require.main === module) {
    createPreviewServer().listen(8765, '127.0.0.1', () => {
        console.log('Preview: http://127.0.0.1:8765/index.html');
    });
}

module.exports = { createPreviewServer };
