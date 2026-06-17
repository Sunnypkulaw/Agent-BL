import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JUDGE_QUESTIONS,
  answerJudgeQuestion,
  routeIntent,
  runJudgeRehearsal
} from '../src/agent/judgeAssistant.js';

test('AI-12: every canonical judge question gets a grounded, cited answer', async () => {
  const answers = await runJudgeRehearsal();
  assert.equal(answers.length, JUDGE_QUESTIONS.length);
  for (const a of answers) {
    assert.ok(a.answer.length > 80, `answer too short for: ${a.question}`);
    assert.ok(a.citations.length >= 1, `no citations for: ${a.question}`);
    assert.equal(a.provider, 'deterministic'); // offline default
  }
  // The six canonical questions should map to six distinct intents.
  const intents = new Set(answers.map((a) => a.intent_id));
  assert.equal(intents.size, JUDGE_QUESTIONS.length);
});

test('AI-12: the "guaranteed?" question keeps the non-principal-protection line', async () => {
  const res = await answerJudgeQuestion('Is this a guaranteed, principal-protected return?');
  assert.equal(res.intent_id, 'not-guaranteed');
  assert.match(res.answer, /not guaranteed/i);
  assert.match(res.answer, /target redemption value/i);
  assert.ok(res.citations.some((c) => c.id === 'POL-TARGET-REDEMPTION-NOT-GUARANTEED'));
});

test('AI-12: the pricing question explains the profit-share model with real numbers', async () => {
  const res = await answerJudgeQuestion('How does the AI decide the issue price?');
  assert.equal(res.intent_id, 'how-priced');
  assert.match(res.answer, /share/i);
  assert.match(res.answer, /profit/i);
  // It quotes the real verified profit figure from the engine.
  assert.match(res.answer, /1,375,000/);
});

test('AI-12: the risk-rises answer cites the pause action from the real engine', async () => {
  const res = await answerJudgeQuestion('What happens if war risk rises while the cargo is in transit?');
  assert.equal(res.intent_id, 'risk-rises');
  assert.match(res.answer, /PAUSE_OFFERING/);
  assert.equal(res.numbers.stressed_action, 'PAUSE_OFFERING');
});

test('AI-12: routing picks the on-chain and collateral intents correctly', () => {
  assert.equal(routeIntent('what gets written on-chain by the oracle?').id, 'on-chain');
  assert.equal(routeIntent('how is the collateral value verified?').id, 'collateral');
  // An off-topic question with no keyword hits falls back to the general intent.
  assert.equal(routeIntent('what is your favourite colour?').id, 'general');
});

test('AI-12: a configured LLM rephrases, but a failing LLM falls back to grounded', async () => {
  const env = { DEEPSEEK_API_KEY: 'x' };

  // working model -> its text is used, grounded answer preserved alongside
  const ok = await answerJudgeQuestion('Is it guaranteed?', {
    env,
    useLlm: true,
    chat: async () => ({ role: 'assistant', content: 'Polished: the 1.00 target redemption value is not guaranteed.' })
  });
  assert.equal(ok.provider, 'deepseek');
  assert.match(ok.answer, /^Polished:/);
  assert.match(ok.grounded_answer, /not guaranteed/i);

  // failing model -> deterministic fallback, answer === grounded answer
  const bad = await answerJudgeQuestion('Is it guaranteed?', {
    env,
    useLlm: true,
    chat: async () => {
      throw new Error('429 rate limited');
    }
  });
  assert.equal(bad.provider, 'deterministic-fallback');
  assert.equal(bad.answer, bad.grounded_answer);
});
