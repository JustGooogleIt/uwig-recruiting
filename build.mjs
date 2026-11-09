import * as esbuild from 'esbuild';
import fs from 'node:fs';
const r = await esbuild.build({
  entryPoints: ['src/main.tsx'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2020',
  jsx: 'transform', loader: { '.png': 'dataurl' },
  alias: { 'react': './src/shims/react.ts', 'react-dom/client': './src/shims/react-dom-client.ts' },
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync('src/styles.css', 'utf8');
const html = `<title>UWIG Recruiting</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/uwig-recruiting.html', html);
// local preview wrapper with skeleton
fs.writeFileSync('dist/preview.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>${html}</body></html>`);
// standalone site for Vercel (public/index.html)
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#3F4A52"><title>UWIG Recruiting</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>[hidden]{display:none!important}body{margin:0}${css}</style></head><body><div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script></body></html>`);
console.log('size KB', (html.length / 1024) | 0);
