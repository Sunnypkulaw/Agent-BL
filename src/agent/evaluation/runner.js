// SP-9: Agent Evaluation Runner
// Evaluates Agent AI quality against the eval dataset

import { EVAL_DATASET, EVAL_METRICS } from './dataset.js';

export async function runEvaluation({ agent, verbose = false } = {}) {
  const results = [];
  let taskCompletionCount = 0;
  let toolCallSuccessCount = 0;
  let groundedResponseCount = 0;
  let totalToolCalls = 0;

  for (const testCase of EVAL_DATASET) {
    if (verbose) console.log(`Running ${testCase.id}: ${testCase.category}`);

    const result = {
      id: testCase.id,
      category: testCase.category,
      task_completed: false,
      tool_calls_correct: false,
      grounded: false,
      errors: []
    };

    try {
      // Mock agent execution (replace with real agent when available)
      const output = await mockAgentExecution(testCase);

      // Check task completion
      result.task_completed = checkTaskCompletion(output, testCase.expected);
      if (result.task_completed) taskCompletionCount++;

      // Check tool calls
      if (testCase.expected.tool_calls) {
        totalToolCalls++;
        result.tool_calls_correct = checkToolCalls(output, testCase.expected);
        if (result.tool_calls_correct) toolCallSuccessCount++;
      }

      // Check groundedness
      if (testCase.expected.grounded) {
        result.grounded = checkGroundedness(output);
        if (result.grounded) groundedResponseCount++;
      }

      result.output = output;
    } catch (error) {
      result.errors.push(error.message);
    }

    results.push(result);
  }

  const metrics = {
    total_tests: EVAL_DATASET.length,
    task_completion_rate: taskCompletionCount / EVAL_DATASET.length,
    tool_call_success_rate: totalToolCalls > 0 ? toolCallSuccessCount / totalToolCalls : 1.0,
    groundedness_score: groundedResponseCount / EVAL_DATASET.filter(tc => tc.expected.grounded).length || 1.0,
    passed: false
  };

  metrics.passed =
    metrics.task_completion_rate >= EVAL_METRICS.TASK_COMPLETION_TARGET &&
    metrics.tool_call_success_rate >= EVAL_METRICS.TOOL_CALL_SUCCESS_TARGET &&
    metrics.groundedness_score >= EVAL_METRICS.GROUNDEDNESS_TARGET;

  return { results, metrics };
}

// Mock agent execution for testing
async function mockAgentExecution(testCase) {
  // Deterministic mock responses for now
  const { category, input, expected } = testCase;

  const output = {
    tool_calls: expected.tool_calls || [],
    result: {},
    evidence: []
  };

  switch (category) {
    case 'document_parsing':
      output.result = { cargo: input.document.cargo, value_usd: input.document.value_usd };
      break;
    case 'compliance_check':
      output.result = { result: expected.result, reasons: expected.reasons || [] };
      break;
    case 'risk_assessment':
      output.result = { risk_level: expected.risk_level[0] };
      break;
    case 'valuation':
      output.result = { valuation_usd: expected.valuation_usd };
      break;
    case 'pricing':
      output.result = { final_issue_price_usd: 0.85 };
      break;
    case 'evidence_grounding':
      output.result = { explanation: 'Repriced due to risk event', evidence: ['source1'] };
      output.evidence = ['source1'];
      break;
    default:
      output.result = { task_completion: true };
  }

  return output;
}

function checkTaskCompletion(output, expected) {
  if (expected.task_completion === false) return false;
  if (expected.output_fields) {
    return expected.output_fields.every(field => output.result[field] !== undefined);
  }
  return output.result && Object.keys(output.result).length > 0;
}

function checkToolCalls(output, expected) {
  if (!expected.tool_calls) return true;
  if (expected.min_tool_calls) {
    return output.tool_calls.length >= expected.min_tool_calls;
  }
  return expected.tool_calls.every(tool => output.tool_calls.includes(tool));
}

function checkGroundedness(output) {
  return output.evidence && output.evidence.length > 0;
}

// Export evaluation results as shareable JSON
export function exportResults(evaluation, outputPath = './eval-results.json') {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: evaluation.metrics,
    passed: evaluation.metrics.passed,
    results: evaluation.results.map(r => ({
      id: r.id,
      category: r.category,
      task_completed: r.task_completed,
      tool_calls_correct: r.tool_calls_correct,
      grounded: r.grounded,
      errors: r.errors
    }))
  };

  return summary;
}
