import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCompliance } from '../src/agent/complianceChecker.js';

test('AI-18: clean case passes compliance', () => {
  const caseData = {
    caseEntry: { buyer: 'Tech Corp', seller: 'Global Minerals', cargo: 'Copper' },
    metadata: { standards: ['mletr', 'dcsa'] }
  };
  const report = checkCompliance(caseData);
  assert.equal(report.ok, true);
  assert.equal(report.has_block, false);
  assert.equal(report.has_warning, false);
  assert.ok(report.checks.some(c => c.id === 'sanctions' && c.status === 'ok'));
  assert.ok(report.checks.some(c => c.id === 'export_controls' && c.status === 'ok'));
  assert.ok(report.checks.some(c => c.id === 'standards' && c.status === 'ok'));
});

test('AI-18: warns on dual-use goods and lack of standards', () => {
  const caseData = {
    caseEntry: { buyer: 'Tech Corp', seller: 'Global Minerals', cargo: 'Semiconductors' },
    metadata: { standards: ['mletr'] }
  };
  const report = checkCompliance(caseData);
  assert.equal(report.ok, true);
  assert.equal(report.has_block, false);
  assert.equal(report.has_warning, true);
  
  const ec = report.checks.find(c => c.id === 'export_controls');
  assert.equal(ec.status, 'warning');
  assert.ok(ec.evidence.includes('semiconductor'));

  const std = report.checks.find(c => c.id === 'standards');
  assert.equal(std.status, 'warning');
});

test('AI-18: blocks on sanctioned entities or military cargo', () => {
  const caseData = {
    caseEntry: { buyer: 'Sanctioned Entity LLC', seller: 'Global Minerals', cargo: 'Copper' }
  };
  const report = checkCompliance(caseData);
  assert.equal(report.ok, false);
  assert.equal(report.has_block, true);
  const sanc = report.checks.find(c => c.id === 'sanctions');
  assert.equal(sanc.status, 'block');
  assert.ok(sanc.evidence.includes('Sanctioned Entity LLC'));

  const caseData2 = {
    caseEntry: { buyer: 'Tech Corp', seller: 'Global Minerals', cargo: 'Military Weapons' }
  };
  const report2 = checkCompliance(caseData2);
  assert.equal(report2.ok, false);
  assert.equal(report2.has_block, true);
  const ec2 = report2.checks.find(c => c.id === 'export_controls');
  assert.equal(ec2.status, 'block');
});

test('AI-18: SME does not trigger refusal of service', () => {
  const caseData = {
    caseEntry: { buyer: 'Tech Corp', seller: 'Small Startup', cargo: 'Copper', company_size: 'sme' },
    metadata: { standards: ['mletr', 'dcsa'] }
  };
  const report = checkCompliance(caseData);
  assert.equal(report.ok, true);
  const fair = report.checks.find(c => c.id === 'fair_access');
  assert.ok(fair);
  assert.equal(fair.status, 'ok');
});
