import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateWorkflow } from './workflow.js';
import {
  assertScenarioExpectations,
  assertTradeCase,
  assertWorkflowResult
} from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function fromRoot(relativePath) {
  return path.join(rootDir, relativePath);
}

export async function readCaseFile(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : fromRoot(filePath);
  const caseData = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  assertTradeCase(caseData);
  return { file: path.relative(rootDir, absolutePath).replaceAll('\\', '/'), caseData };
}

export async function listHarnessCaseFiles(options = {}) {
  const includeDemo = options.includeDemo !== false;
  const scenarioDir = options.scenarioDir ?? fromRoot('data/scenarios');
  const files = [];

  if (includeDemo) files.push(fromRoot('data/demo-case.json'));

  try {
    const entries = await fs.readdir(scenarioDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) files.push(path.join(scenarioDir, entry.name));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return files.sort();
}

export async function loadHarnessCases(options = {}) {
  const files = await listHarnessCaseFiles(options);
  return Promise.all(files.map((file) => readCaseFile(file)));
}

export function runScenario(caseData, options = {}) {
  assertTradeCase(caseData);
  const workflow = simulateWorkflow(caseData);
  assertWorkflowResult(workflow, caseData);
  if (options.assertExpectations !== false) assertScenarioExpectations(caseData, workflow);
  return workflow;
}

export async function runHarnessScenarios(options = {}) {
  const records = await loadHarnessCases(options);
  return records.map(({ file, caseData }) => {
    const workflow = runScenario(caseData, options);
    return summarizeScenario(file, caseData, workflow);
  });
}

export function summarizeScenario(file, caseData, workflow) {
  const report = workflow.risk_report;
  return {
    file,
    case_id: caseData.case_id,
    bl_id: caseData.bill_of_lading.bl_id,
    final_state: workflow.final_state,
    risk_level: report.risk_level,
    contract_action: report.contract_action,
    health_factor: report.health_factor,
    cargo_health_score: report.cargo_health_score,
    detected_risks: report.detected_risks
  };
}
