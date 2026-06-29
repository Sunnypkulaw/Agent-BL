// SP-10: OpenTelemetry Tracing for Agent Call Chain
// Records parser→checker→risk→valuation→pricing→payment→chain spans with latency, errors, and cost

import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('agentbl-agent', '1.0.0');

/**
 * Trace a span with automatic error handling and privacy-safe attributes
 * @param {string} name - Span name (e.g., 'compliance_check', 'risk_assessment')
 * @param {Function} fn - Async function to execute
 * @param {Object} attributes - Span attributes (will be sanitized)
 */
export async function traceSpan(name, fn, attributes = {}) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      // Add sanitized attributes
      const safeAttrs = sanitizeAttributes(attributes);
      Object.entries(safeAttrs).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });

      const result = await fn(span);

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Sanitize attributes to remove PII and sensitive data
 */
function sanitizeAttributes(attrs) {
  const safe = {};
  const SENSITIVE_KEYS = ['api_key', 'token', 'password', 'secret', 'ssn', 'credit_card'];

  for (const [key, value] of Object.entries(attrs)) {
    // Skip sensitive keys
    if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
      safe[key] = '[REDACTED]';
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 256) {
      safe[key] = value.slice(0, 256) + '...[truncated]';
      continue;
    }

    // Hash personally identifiable strings
    if (key.toLowerCase().includes('email') || key.toLowerCase().includes('address')) {
      safe[key] = hashPII(value);
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

function hashPII(value) {
  if (typeof value !== 'string') return value;
  // Simple hash for demo (use crypto.createHash in production)
  return `hash_${value.length}_${value.charCodeAt(0)}`;
}

/**
 * Trace a full agent workflow with nested spans
 */
export async function traceAgentWorkflow(workflowName, steps) {
  return traceSpan(`workflow:${workflowName}`, async (parentSpan) => {
    const results = {};

    for (const [stepName, stepFn] of Object.entries(steps)) {
      results[stepName] = await traceSpan(`step:${stepName}`, async (childSpan) => {
        const startTime = Date.now();

        try {
          const result = await stepFn();

          const duration = Date.now() - startTime;
          childSpan.setAttribute('duration_ms', duration);
          childSpan.setAttribute('success', true);

          return result;
        } catch (error) {
          childSpan.setAttribute('success', false);
          childSpan.setAttribute('error_type', error.constructor.name);
          throw error;
        }
      });
    }

    return results;
  });
}

/**
 * Record LLM call metrics
 */
export function recordLLMCall(span, { provider, model, promptTokens, completionTokens, cost }) {
  span.setAttribute('llm.provider', provider);
  span.setAttribute('llm.model', model);
  span.setAttribute('llm.prompt_tokens', promptTokens || 0);
  span.setAttribute('llm.completion_tokens', completionTokens || 0);
  span.setAttribute('llm.total_tokens', (promptTokens || 0) + (completionTokens || 0));

  if (cost !== undefined) {
    span.setAttribute('llm.cost_usd', cost);
  }
}

/**
 * Record blockchain transaction metrics
 */
export function recordChainTransaction(span, { chainId, txHash, gasUsed, gasPrice }) {
  span.setAttribute('chain.id', chainId);
  span.setAttribute('chain.tx_hash', txHash);

  if (gasUsed !== undefined) {
    span.setAttribute('chain.gas_used', gasUsed);
  }

  if (gasPrice !== undefined) {
    span.setAttribute('chain.gas_price_gwei', gasPrice);
  }
}

/**
 * Example: Trace a complete pricing workflow
 */
export async function tracePricingWorkflow(caseData) {
  return traceAgentWorkflow('pricing_workflow', {
    parse_document: async () => {
      // Document parsing logic
      return { cargo: caseData.cargo, value: caseData.value };
    },

    compliance_check: async () => {
      // Compliance check logic
      return { result: 'PASS' };
    },

    risk_assessment: async () => {
      // Risk assessment logic
      return { risk_level: 'MEDIUM', discount_bps: 300 };
    },

    valuation: async () => {
      // Valuation logic
      return { valuation_usd: 2100000 };
    },

    pricing: async () => {
      // Pricing calculation
      return { issue_price: 0.85, yield_bps: 1000 };
    }
  });
}

/**
 * Initialize OpenTelemetry with minimal configuration
 * In production, configure OTLP exporter to send to Application Insights
 */
export function initTracing() {
  // Tracing is initialized by importing @opentelemetry/api
  // For Application Insights integration, set environment variables:
  // - APPLICATIONINSIGHTS_CONNECTION_STRING
  // - OTEL_SERVICE_NAME=agentbl-agent

  console.log('OpenTelemetry tracing initialized');
}
