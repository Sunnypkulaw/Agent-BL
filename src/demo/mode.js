export class LiveModeUnavailableError extends Error {
  constructor(missing) {
    super(`Live mode is unavailable; configure: ${missing.join(', ')}`);
    this.name = 'LiveModeUnavailableError';
    this.code = 'live_mode_unavailable';
    this.missing = missing;
  }
}

function booleanValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return !['false', '0', 'off', 'no'].includes(String(value).toLowerCase());
}

export class DemoModeController {
  constructor(options = {}) {
    this.env = options.env ?? process.env;
    this.mode = booleanValue(this.env.DEMO_MODE, true) ? 'demo' : 'live';
    this.startedAt = new Date().toISOString();
    this.resetCount = 0;
    this.generation = 1;
  }

  liveReadiness() {
    const missing = [];
    if (this.env.X402_MODE !== 'live') missing.push('X402_MODE=live');
    if (!this.env.X402_FACILITATOR_URL) missing.push('X402_FACILITATOR_URL');
    if (!this.env.X402_PAY_TO) missing.push('X402_PAY_TO');
    return { ready: missing.length === 0, missing };
  }

  snapshot() {
    const live = this.liveReadiness();
    return {
      mode: this.mode,
      demoMode: this.mode === 'demo',
      liveAvailable: live.ready,
      liveMissing: live.missing,
      generation: this.generation,
      resetCount: this.resetCount,
      startedAt: this.startedAt,
      guarantee: this.mode === 'demo'
        ? 'No wallet or API key required; simulated receipts are labelled and are not chain transactions.'
        : 'Mock transactions and silent demo fallback are disabled.'
    };
  }

  setMode(mode) {
    if (!['demo', 'live'].includes(mode)) throw new TypeError('mode must be demo or live');
    if (mode === 'live') {
      const readiness = this.liveReadiness();
      if (!readiness.ready) throw new LiveModeUnavailableError(readiness.missing);
    }
    this.mode = mode;
    this.env.DEMO_MODE = mode === 'demo' ? 'true' : 'false';
    this.generation += 1;
    return this.snapshot();
  }

  reset() {
    if (this.mode !== 'demo') {
      const error = new Error('Demo reset is disabled in live mode');
      error.code = 'demo_reset_live_forbidden';
      throw error;
    }
    this.resetCount += 1;
    this.generation += 1;
    this.startedAt = new Date().toISOString();
    return this.snapshot();
  }
}

export const demoModeController = new DemoModeController();
