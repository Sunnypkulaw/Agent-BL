import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { hasTranslation, setLang, t, tData } from '../public/i18n.js';

const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const mystery = await fs.readFile(new URL('../public/mystery.js', import.meta.url), 'utf8');

function referencedTranslationKeys() {
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-html|-ph|-title)?="([^"]+)"/gu)) keys.add(match[1]);
  for (const match of app.matchAll(/\bt\('([^']+)'(?=\s*(?:,|\)))/gu)) keys.add(match[1]);
  for (const match of mystery.matchAll(/\bt\('([^']+)'(?=\s*(?:,|\)))/gu)) keys.add(match[1]);
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
  setLang('zh');
  assert.equal(t('nav_market'), '投资市场');
  assert.equal(t('nav_mint'), '提单上链 · 铸造 RWA');
  assert.equal(t('portfolio_h'), '我的持仓');
  assert.equal(t('protocol_evidence_h'), '实时协议凭证');
});

test('English UI copy contains no accidental Chinese', () => {
  setLang('en');
  const allowed = new Set(['lang_switch_to']);
  const mixed = referencedTranslationKeys()
    .filter((key) => !allowed.has(key) && /[\u3400-\u9fff]/u.test(t(key)))
    .map((key) => `${key}: ${t(key)}`);
  assert.deepEqual(mixed, []);
  setLang('zh');
});

test('Chinese-native trade data is rendered in English in English mode', () => {
  setLang('en');
  assert.equal(tData('N/A（库内交货）'), 'N/A (Warehouse Delivery)');
  assert.equal(tData('AL99.70 / P1020 级别'), 'AL99.70 / P1020 Grade');
  assert.equal(
    tData('佛山南海指定仓库（入库单号 WH-FS-00008)'),
    'Designated Warehouse, Nanhai, Foshan (Inbound Receipt WH-FS-00008)'
  );
  assert.equal(tData('Non-GMO Soybeans (非转基因大豆), Bulk'), 'Non-GMO Soybeans, Bulk');
  setLang('zh');
});
