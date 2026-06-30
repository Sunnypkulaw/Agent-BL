import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const dom = await fs.readFile(new URL('../public/dom.js', import.meta.url), 'utf8');

test('judge-facing Agent terminal does not intercept browser diagnostics', () => {
  assert.doesNotMatch(app, /console\.(?:log|warn|error)\s*=/u);
});

test('high-frequency render helpers do not emit debug logs', () => {
  assert.doesNotMatch(dom, /Setting style via cssText/u);
  assert.doesNotMatch(app, /\[renderMarketCard\]/u);
});
