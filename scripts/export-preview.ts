import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { lane } from '../src/lane.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const marker = lane().marker;
const args = process.argv.slice(2);
const allowNoMarker = args.includes('--allow-no-marker');
const pathArgument = args.find((arg) => arg !== '--allow-no-marker');
if (args.filter((arg) => arg !== '--allow-no-marker').length > 1) {
  throw new Error('Provide at most one output path.');
}

const requestedPath = pathArgument ?? resolve(tmpdir(), 'rig-digest-2026-10-28.html');
const outputPath = resolve(requestedPath);
const outputRelativeToProject = relative(projectRoot, outputPath);

if (!isAbsolute(requestedPath)) {
  throw new Error('Provide an absolute output path so the preview location is explicit.');
}
if (outputRelativeToProject === '' || (outputRelativeToProject !== '..' && !outputRelativeToProject.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`))) {
  throw new Error('Preview files must be written outside the repository.');
}
if (!marker && !allowNoMarker) {
  throw new Error('LANE_MARKER is unset; set it for the review preview or pass --allow-no-marker for cleanup.');
}

const response = await createApp(loadConfig()).request('/digest/2026-10-28');
if (!response.ok) {
  throw new Error(`Digest export failed: server returned HTTP ${response.status}.`);
}

const contentType = response.headers.get('content-type') ?? '';
if (!contentType.includes('text/html')) {
  throw new Error(`Digest export expected HTML, received ${contentType || 'no content type'}.`);
}

const html = await response.text();
if (!/^<!doctype html>/i.test(html)) {
  throw new Error('Digest export is not a complete HTML document.');
}
if (marker && !html.includes(marker)) {
  throw new Error('Digest export does not contain the configured lane marker.');
}
if (/<(?:script|link|img|iframe|audio|video)\b|\s(?:src|href)=(["'])https?:\/\//i.test(html)) {
  throw new Error('Digest export references external resources and is not self-contained.');
}

writeFileSync(outputPath, html, { encoding: 'utf8', mode: 0o600 });
console.log(outputPath);
