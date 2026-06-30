import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { hasTranslation, t } from '../public/i18n.js';

const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');

function referencedTranslationKeys() {
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-html|-ph|-title)?="([^"]+)"/gu)) keys.add(match[1]);
  for (const match of app.matchAll(/\bt\('([^']+)'(?=\s*(?:,|\)))/gu)) keys.add(match[1]);
  return [...keys].sort();
}

test('frontend translation keys have both Chinese and English copy', () => {
  const missing = [];
  for (const key of referencedTranslationKeys()) {
    if (!hasTranslation(key, 'zh')) missing.push(`zh:${key}`);
    if (!hasTranslation(key, 'en')) missing.push(`en:${key}`);
  }
  assert.deepEqual(missing, []);
});

test('Chinese UI keeps navigation and key investor information in Chinese', () => {
  assert.equal(t('nav_market'), '投资市场');
  assert.equal(t('nav_mint'), '提单上链 · 铸造 RWA');
  assert.equal(t('portfolio_h'), '我的持仓');
  assert.equal(t('protocol_evidence_h'), '实时协议凭证');
});
