/** FNV-1a. Stable across sessions so a given name always gets the same pass number. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) — drives the barcode and QR so they never flicker. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 001–247, derived from the name. */
export function builderNumber(name: string, cohort: number): string {
  const n = (hashString(name.trim().toLowerCase() || "builder") % cohort) + 1;
  return String(n).padStart(3, "0");
}
