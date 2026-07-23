export function buildMysteryAnalytics({ records = [], investments = [] } = {}) {
  const revealed = records.filter((record) => record.state === 'REVEALED');
  const aborted = records.filter((record) => record.state === 'ABORTED');
  const discoveryClaims = records.reduce(
    (count, record) => count + (record.passports ?? []).filter((passport) => passport.stamp_type === 'DISCOVERY').length,
    0
  );
  const investorJourneyClaims = records.reduce(
    (count, record) => count + (record.passports ?? []).filter((passport) => passport.stamp_type === 'INVESTOR_JOURNEY').length,
    0
  );
  const mysteryInvestments = investments.filter((investment) => investment.source?.kind === 'MYSTERY_VOYAGE');
  const previewCount = records.length;
  const rate = (numerator, denominator) => denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
  const events = records.flatMap((record) => {
    const base = {
      reveal_id: record.reveal_id,
      round_id: record.round_id,
      route_count: Array.isArray(record.candidates) ? record.candidates.length : 0,
      risk_passport_tier: record.risk_passport?.tier ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at
    };
    const recordEvents = [{ ...base, stage: 'COMMITTED', timestamp: record.created_at }];
    if (record.state === 'REVEALED') recordEvents.push({ ...base, stage: 'REVEALED', timestamp: record.updated_at });
    if (record.state === 'ABORTED') recordEvents.push({ ...base, stage: 'ABORTED', timestamp: record.abort?.aborted_at ?? record.updated_at });
    for (const passport of record.passports ?? []) {
      recordEvents.push({
        ...base,
        stage: passport.stamp_type === 'INVESTOR_JOURNEY' ? 'INVESTOR_JOURNEY_STAMP' : 'DISCOVERY_STAMP',
        timestamp: passport.revealed_at,
        credential_id: passport.credential_id
      });
    }
    return recordEvents;
  });
  for (const investment of mysteryInvestments) {
    events.push({
      stage: 'MYSTERY_SUBSCRIPTION',
      reveal_id: investment.source.reveal_id,
      pool_id: investment.poolId,
      timestamp: investment.timestamp,
      source: 'MYSTERY_VOYAGE'
    });
  }
  events.sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
  return {
    ok: true,
    funnel: {
      preview_count: previewCount,
      revealed_count: revealed.length,
      aborted_count: aborted.length,
      discovery_stamp_count: discoveryClaims,
      investor_journey_stamp_count: investorJourneyClaims,
      mystery_subscription_count: mysteryInvestments.length,
      reveal_rate: rate(revealed.length, previewCount),
      subscription_rate_from_reveals: rate(mysteryInvestments.length, revealed.length)
    },
    events: events.slice(-200),
    source_integrity: mysteryInvestments.map((investment) => ({
      reveal_id: investment.source.reveal_id,
      pool_id: investment.poolId,
      reveal_proof_hash: investment.source.reveal_proof_hash,
      risk_passport_hash: investment.source.risk_passport_hash,
      quote_hash: investment.source.quote_hash,
      timestamp: investment.timestamp
    }))
  };
}
