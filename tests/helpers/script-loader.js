import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadBrowserScript(relativePath) {
    const fullPath = path.resolve(__dirname, '..', '..', relativePath);
    const code = fs.readFileSync(fullPath, 'utf8');
    const context = vm.createContext(globalThis);
    vm.runInContext(code, context, { filename: fullPath });
}