// TRUST-5: Data Freshness and Source Health
// 风险情报标记 observed_at/expires_at/source_status，过期自动降置信度或拒绝定价

export class DataFreshnessValidator {
  constructor(maxAgeMs = 86400000) { // 默认 24 小时
    this.maxAgeMs = maxAgeMs;
  }

  /**
   * 验证数据新鲜度
   * @param {Object} data - 包含 observed_at 的数据
   * @param {number} currentTime - 当前时间戳
   * @returns {Object} - { fresh: boolean, age_ms: number, status: string }
   */
  validateFreshness(data, currentTime = Date.now()) {
    if (!data.observed_at) {
      return { fresh: false, age_ms: null, status: 'MISSING_TIMESTAMP' };
    }

    const observedAt = new Date(data.observed_at).getTime();
    const ageMs = currentTime - observedAt;

    if (ageMs < 0) {
      return { fresh: false, age_ms: ageMs, status: 'FUTURE_TIMESTAMP' };
    }

    if (ageMs > this.maxAgeMs) {
      return { fresh: false, age_ms: ageMs, status: 'EXPIRED' };
    }

    return { fresh: true, age_ms: ageMs, status: 'FRESH' };
  }

  /**
   * 根据数据新鲜度调整置信度
   * @param {number} baseConfidence - 基础置信度 (0-1)
   * @param {number} ageMs - 数据年龄（毫秒）
   * @returns {number} - 调整后的置信度
   */
  adjustConfidence(baseConfidence, ageMs) {
    if (ageMs > this.maxAgeMs) {
      return 0; // 过期数据置信度为 0
    }

    // 线性衰减：新鲜数据置信度 100%，接近过期时衰减到 50%
    const decayFactor = 1 - (ageMs / this.maxAgeMs) * 0.5;
    return baseConfidence * decayFactor;
  }

  /**
   * 检查数据源健康状态
   * @param {Object} source - 数据源信息
   * @returns {Object} - { healthy: boolean, status: string }
   */
  checkSourceHealth(source) {
    if (!source || !source.name) {
      return { healthy: false, status: 'UNKNOWN_SOURCE' };
    }

    if (source.status === 'offline' || source.status === 'error') {
      return { healthy: false, status: source.status.toUpperCase() };
    }

    if (source.last_update) {
      const lastUpdate = new Date(source.last_update).getTime();
      const timeSinceUpdate = Date.now() - lastUpdate;

      // 如果数据源超过 1 小时未更新，标记为不健康
      if (timeSinceUpdate > 3600000) {
        return { healthy: false, status: 'STALE_SOURCE' };
      }
    }

    return { healthy: true, status: 'HEALTHY' };
  }
}

/**
 * 带新鲜度验证的风险情报数据结构
 */
export class RiskIntelligence {
  constructor(data) {
    this.event_id = data.event_id;
    this.event_type = data.event_type;
    this.severity = data.severity;
    this.description = data.description;
    this.observed_at = data.observed_at;
    this.expires_at = data.expires_at;
    this.source = data.source;
    this.confidence = data.confidence || 1.0;
  }

  /**
   * 检查情报是否可用于定价
   * @param {number} currentTime - 当前时间戳
   * @returns {Object} - { usable: boolean, reason: string, adjusted_confidence: number }
   */
  isUsableForPricing(currentTime = Date.now()) {
    const validator = new DataFreshnessValidator();

    // 检查数据新鲜度
    const freshness = validator.validateFreshness(this, currentTime);
    if (!freshness.fresh) {
      return {
        usable: false,
        reason: `Data not fresh: ${freshness.status}`,
        adjusted_confidence: 0
      };
    }

    // 检查是否过期
    if (this.expires_at) {
      const expiresAt = new Date(this.expires_at).getTime();
      if (currentTime > expiresAt) {
        return {
          usable: false,
          reason: 'Intelligence expired',
          adjusted_confidence: 0
        };
      }
    }

    // 检查数据源健康
    if (this.source) {
      const sourceHealth = validator.checkSourceHealth(this.source);
      if (!sourceHealth.healthy) {
        return {
          usable: false,
          reason: `Source unhealthy: ${sourceHealth.status}`,
          adjusted_confidence: 0
        };
      }
    }

    // 调整置信度
    const adjustedConfidence = validator.adjustConfidence(
      this.confidence,
      freshness.age_ms
    );

    return {
      usable: true,
      reason: 'Fresh and healthy',
      adjusted_confidence: adjustedConfidence
    };
  }
}

/**
 * 测试数据新鲜度验证（clock-controlled tests）
 */
export function testDataFreshnessValidation() {
  const validator = new DataFreshnessValidator(86400000); // 24 小时
  const baseTime = Date.now();

  const tests = [
    {
      name: 'Fresh data (1 hour old)',
      data: { observed_at: new Date(baseTime - 3600000).toISOString() },
      currentTime: baseTime,
      expectedFresh: true
    },
    {
      name: 'Stale data (48 hours old)',
      data: { observed_at: new Date(baseTime - 172800000).toISOString() },
      currentTime: baseTime,
      expectedFresh: false
    },
    {
      name: 'Missing timestamp',
      data: {},
      currentTime: baseTime,
      expectedFresh: false
    },
    {
      name: 'Future timestamp (invalid)',
      data: { observed_at: new Date(baseTime + 3600000).toISOString() },
      currentTime: baseTime,
      expectedFresh: false
    }
  ];

  const results = tests.map(test => {
    const result = validator.validateFreshness(test.data, test.currentTime);
    const passed = result.fresh === test.expectedFresh;

    return {
      name: test.name,
      passed,
      result
    };
  });

  const allPassed = results.every(r => r.passed);

  return {
    all_tests_passed: allPassed,
    results,
    summary: `${results.filter(r => r.passed).length}/${results.length} freshness tests passed`
  };
}

/**
 * 测试网络断开时不使用旧数据
 */
export function testOfflineFallback() {
  const intelligence = new RiskIntelligence({
    event_id: 'EVT-001',
    event_type: 'war_risk',
    severity: 'HIGH',
    description: 'Conflict in region',
    observed_at: new Date(Date.now() - 100000000).toISOString(), // 太旧
    source: { name: 'xAPI', status: 'offline' }
  });

  const usability = intelligence.isUsableForPricing();

  return {
    passed: !usability.usable,
    reason: usability.reason,
    message: usability.usable
      ? '❌ FAIL: Old data should not be used when offline'
      : '✅ PASS: Correctly rejected stale offline data'
  };
}
