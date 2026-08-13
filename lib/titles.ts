/** On-theme builder classes. Rolled automatically, re-rollable by the user. */
export const BUILDER_TITLES = [
  "Terminal Dweller",
  "Onchain Shipper",
  "Multichain Maximalist",
  "3AM Committer",
  "Signal Over Noise",
  "Latency Abolitionist",
  "Merge Conflict Survivor",
  "Prompt Whisperer",
  "Zero Knowledge Zealot",
  "Rollup Romantic",
  "Cold Start Killer",
  "Vector Search Vandal",
  "Mainnet Menace",
  "Gas Golfer",
  "Context Window Cartel",
  "Ship Or Ship Doctrine",
  "Deterministic Dreamer",
  "Solidity Sandpiper",
  "Inference Addict",
  "Consensus Breaker",
  "Edge Runtime Native",
  "Monorepo Monk",
  "Rate Limit Rebel",
  "Beach Node Operator",
  "Silent Push Force",
  "Token Budget Ascetic",
  "Reproducible Build Purist",
  "Latenight Deploy Cult",
] as const;

export type BuilderTitle = (typeof BUILDER_TITLES)[number];

/** Rolls a new title, never repeating the one already on screen. */
export function rollTitle(current?: string): string {
  if (BUILDER_TITLES.length < 2) return BUILDER_TITLES[0];
  let next = current;
  while (next === current) {
    next = BUILDER_TITLES[Math.floor(Math.random() * BUILDER_TITLES.length)];
  }
  return next!;
}
