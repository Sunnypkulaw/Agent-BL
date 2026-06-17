// Shared application state for the TradeShield two-view dashboard.
//
// One store, imported by the router (app.js) and the voyage view (voyage.js),
// so both views read the same selected case + live PricingQuote without passing
// state around or risking circular imports.

export const state = {
  // catalog + selection
  cases: [],
  caseId: null,
  caseData: null,

  // pricing (BE-3 comparison: all three payout speeds + a recommendation)
  comparison: null,
  speed: 'BALANCED',

  // routing
  view: 'mint', // 'mint' | 'voyage'

  // View ① mint module
  financingUsd: null,        // merchant's requested cash (USD)
  mint: null,                // last mint result { mode:'chain'|'sim', txHash, poolId, mintedAmount, explorerUrl, issuePriceE6 }

  // View ② voyage
  voyageInjected: false,     // whether an in-transit event has been simulated
  voyageOffering: null,      // last /api/offering/simulate result (with injected events)
  voyageEvents: [],          // the injected event objects shown in the risk feed

  // web3
  wallet: null,              // { address } when connected
  chainConfig: null          // loaded /chain-config.json
};

/** The PricingQuote for the currently selected payout speed (or the first). */
export function selectedQuote() {
  const quotes = state.comparison?.quotes ?? [];
  return quotes.find((q) => q.payout_speed === state.speed) ?? quotes[0] ?? null;
}

/** The live quote for View ②: the repriced quote if an event was injected, else the selected quote. */
export function liveQuote() {
  if (state.voyageInjected && state.voyageOffering?.final_quote) return state.voyageOffering.final_quote;
  return selectedQuote();
}
