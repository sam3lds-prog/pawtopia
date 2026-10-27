// Builds a single self-contained HTML file of the release game (fonts, code and icon inlined), for sharing a
// playable web preview. Usage: npm run artifact  →  artifact/pawtopia.html
//                              npm run artifact -- --qa  →  artifact/pawtopia-qa.html (adds Tester shortcuts in Settings)
//
// It is a release build: no dev hooks, no test store, no test ads. Progress is kept in that browser only.
import { build } from 'vite';

const qa = process.argv.includes('--qa');
if (qa) process.env.VITE_QA = '1';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const outDir = 'artifact/dist';
await build({
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: 1_000_000, // fonts become data: URIs inside the CSS
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } }, // one JS file
  },
});

const html = readFileSync(`${outDir}/index.html`, 'utf8');
const assets = readdirSync(`${outDir}/assets`);
const jsFiles = assets.filter((f) => f.endsWith('.js'));
if (jsFiles.length !== 1) throw new Error(`expected one JS bundle, found ${jsFiles.join(', ')}`);
const css = readFileSync(`${outDir}/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`${outDir}/assets/${jsFiles[0]}`, 'utf8');
const favicon = readFileSync('public/favicon.svg', 'utf8');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[^>]*><\/script>/g, '').trim();

// The artifact viewer already pads the page by the top safe area; avoid doubling it.
const hostFix = ':root{--safe-top:0px}';
const out = `<meta charset="utf-8">
<title>${qa ? 'Pawtopia Tester Preview' : 'Pawtopia'}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}">
<style>${css}${hostFix}</style>
${body}
<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>
`;
mkdirSync('artifact', { recursive: true });
const file = qa ? 'artifact/pawtopia-qa.html' : 'artifact/pawtopia.html';
writeFileSync(file, out);
console.log(`${file} ${(out.length / 1024).toFixed(0)} KB`);
