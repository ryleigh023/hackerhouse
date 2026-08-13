/**
 * Palette lifted from the Hacker House Goa 2026 site so the pass is
 * instantly recognisable next to the real thing.
 */
export const BRAND = {
  /** bg-brand-primary — the deep green the whole site sits on */
  green: "#0B6839",
  greenDeep: "#08512C",
  /** near-black, tinted green so the page reads as one material */
  ink: "#04140B",
  inkSoft: "#071E10",
  /** bg-brand-accent — the HH Goa yellow */
  yellow: "#FEE101",
  yellowDim: "#EDD723",
  /** bg-brand-offwhite — the cream used for large light surfaces */
  cream: "#FFFBE8",
  /** sunrise coral, echoing the site's "Sun rise" hero art */
  coral: "#FF7A45",
} as const;

export const EVENT = {
  name: "HH GOA",
  year: "2026",
  dates: "OCT 28–31",
  strap: "AI × CRYPTO · GOA, INDIA",
  venue: "GOA.BEACH",
  studio: "2:47 PM STUDIO",
  tagline: "LESS NOISE. MORE SIGNAL.",
  cohort: 247,
  hashtag: "#FrameInGoa",
} as const;
