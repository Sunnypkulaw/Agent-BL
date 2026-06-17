// CLI: TradeShield Judge Q&A assistant (AI-12).
//
//   npm run qa                          # full judge rehearsal (deterministic, offline)
//   npm run qa -- "your question"       # answer a single free-text question
//   npm run qa -- --llm "your question" # let a configured LLM rephrase (auto-fallback)
//   node scripts/judge-qa.mjs --case data/cases/crude-sg-ulsan.case.json
//
// Deterministic by default so it is a reliable demo bottom line; every answer is
// grounded in real pricing-engine numbers and cited risk-intel.

import fsp from 'node:fs/promises';
import { answerJudgeQuestion, runJudgeRehearsal } from '../src/agent/judgeAssistant.js';
import { isConfigured } from '../src/agent/llm/openaiCompatClient.js';

const argv = process.argv.slice(2);
const useLlm = argv.includes('--llm');
const caseFlag = argv.indexOf('--case');
let caseData;
if (caseFlag !== -1 && argv[caseFlag + 1]) {
  caseData = JSON.parse(await fsp.readFile(argv[caseFlag + 1], 'utf8'));
}
const question = argv.filter((a, i) => a !== '--llm' && a !== '--case' && i !== caseFlag + 1).join(' ').trim();

const options = { caseData, useLlm };
const providerNote = useLlm
  ? (isConfigured() ? 'LLM rephrase enabled (deterministic fallback on error)' : 'LLM requested but no provider key set — using deterministic answers')
  : 'deterministic (offline) — pass --llm to let a configured model rephrase';

function render(a) {
  console.log(`\nQ: ${a.question}`);
  console.log(`   intent: ${a.intent_id}  |  provider: ${a.provider}`);
  console.log(`A: ${a.answer}`);
  if (a.citations.length) console.log(`   citations: ${a.citations.map((c) => c.id).join(', ')}`);
}

console.log('\nTradeShield Judge Q&A assistant (AI-12)');
console.log('='.repeat(64));
console.log(providerNote);

if (question) {
  render(await answerJudgeQuestion(question, options));
} else {
  const answers = await runJudgeRehearsal(options);
  for (const a of answers) render(a);
  console.log(`\n${answers.length} canonical judge questions answered.`);
}
