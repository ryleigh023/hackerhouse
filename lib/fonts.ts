import { Victor_Mono, Imbue, Space_Grotesk } from "next/font/google";

/** Terminal face — all data, labels and the boot log. Matches HH Goa's site type. */
export const mono = Victor_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

/** Display serif — the HH GOA wordmark, straight off the event site. */
export const display = Imbue({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

/** Clean grotesk — the builder's name, the one piece that must read instantly. */
export const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const fontVars = `${mono.variable} ${display.variable} ${grotesk.variable}`;

/** Family strings usable directly in `ctx.font` on a 2D canvas. */
export const canvasFonts = {
  mono: mono.style.fontFamily,
  display: display.style.fontFamily,
  grotesk: grotesk.style.fontFamily,
};

/** Every face/weight the card renderer draws with — loaded before the first paint. */
const REQUIRED = [
  `400 32px ${canvasFonts.mono}`,
  `500 32px ${canvasFonts.mono}`,
  `700 32px ${canvasFonts.mono}`,
  `700 64px ${canvasFonts.display}`,
  `900 64px ${canvasFonts.display}`,
  `700 64px ${canvasFonts.grotesk}`,
  `500 32px ${canvasFonts.grotesk}`,
];

let fontsReady: Promise<void> | null = null;

/**
 * Canvas silently falls back to a system face if a webfont has not loaded yet,
 * which would make the exported PNG differ from the preview. Force the issue.
 */
export function ensureFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!fontsReady) {
    fontsReady = Promise.all([
      ...REQUIRED.map((f) => document.fonts.load(f).catch(() => undefined)),
      document.fonts.ready,
    ]).then(() => undefined);
  }
  return fontsReady;
}
