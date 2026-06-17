import { calculateRisk } from './riskEngine.js';
import {
  FINAL_STATE_BY_CONTRACT_ACTION,
  assertRiskReport,
  assertTradeCase
} from './schema.js';

export function simulateWorkflow(caseData) {
  assertTradeCase(caseData);
  const steps = [];

  steps.push({ state: 'Created', actor: 'Exporter', event: 'Create eBL financing request' });
  steps.push({ state: 'Funding', actor: 'Contract', event: 'eBL is pledged and funding pool opens' });
  steps.push({ state: 'Funded', actor: 'Investors', event: 'Permissioned investors deposit mock USDC' });
  steps.push({ state: 'InTransit', actor: 'Contract', event: 'Funds are released to exporter after target is reached' });

  const report = calculateRisk(caseData);
  assertRiskReport(report, caseData);
  steps.push({
    state: FINAL_STATE_BY_CONTRACT_ACTION[report.contract_action] ?? 'Warning',
    actor: 'AI Risk Agent',
    event: `${report.contract_action}: ${report.explanation}`
  });

  return {
    case_id: caseData.case_id,
    final_state: steps.at(-1).state,
    risk_report: report,
    steps
  };
}
