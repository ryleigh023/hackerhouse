import { BRAND, EVENT } from "./brand";
import { canvasFonts } from "./fonts";
import { builderNumber, hashString, seededRandom } from "./hash";

/** Native pass size. 4:5 — the aspect X gives the most vertical room in-feed. */
export const CARD_W = 1080;
export const CARD_H = 1350;

export type Transform = {
  /** 1 = exactly cover-fit. */
  zoom: number;
  /** Pan as a fraction of the slot, clamped so the slot is always covered. */
  offsetX: number;
  offsetY: number;
};

export type PassData = {
  name: string;
  stack: string;
  title: string;
  photo: CanvasImageSource | null;
  transform: Transform;
};

export const DEFAULT_TRANSFORM: Transform = { zoom: 1, offsetX: 0, offsetY: 0 };

/* ------------------------------------------------------------------ layout */

const M = 36; // page margin around the card
const PAD = 44; // card padding
const X0 = M + PAD; // 80  — content left edge
const X1 = CARD_W - M - PAD; // 1000 — content right edge
const CONTENT_W = X1 - X0; // 920

/** The photo slot, in card units. Exported so gestures can map screen px → pan. */
export const PHOTO = { x: X0, y: 208, w: CONTENT_W, h: 652 };
const PERF_Y = 1060;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function clampTransform(t: Transform): Transform {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.zoom));
  // at zoom 1 a cover-fit image can still pan along its overflowing axis only;
  // drawPhoto re-clamps in pixels, this just keeps the stored value sane
  const limit = 1.5;
  return {
    zoom,
    offsetX: Math.max(-limit, Math.min(limit, t.offsetX)),
    offsetY: Math.max(-limit, Math.min(limit, t.offsetY)),
  };
}

/* ----------------------------------------------------------------- helpers */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws text with letter-spacing, which canvas has no native support for. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "right" = "left"
) {
  const chars = [...text];
  const total =
    chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "right" ? x - total : x;
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  return total;
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  const chars = [...text];
  return (
    chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1)
  );
}

/** Shrinks a font until the string fits, then truncates as a last resort. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: (size: number) => string,
  maxSize: number,
  minSize: number
): { text: string; size: number } {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) return { text, size };
    size -= 1;
  }
  ctx.font = font(minSize);
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
  return { text: out.length < text.length ? out + "…" : out, size: minSize };
}

/* ------------------------------------------------------------------ layers */

let grainTile: HTMLCanvasElement | null = null;

/** One 128px noise tile, generated once and reused for every draw. */
function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const rnd = seededRandom(0xf00d);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

function drawGrain(ctx: CanvasRenderingContext2D, alpha: number) {
  const pattern = ctx.createPattern(getGrainTile(), "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
}

function drawScanlines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  for (let i = y; i < y + h; i += 4) ctx.fillRect(x, i, w, 1);
  ctx.restore();
}

/** The fake foil: a wide diagonal sheen that catches the eye without shouting. */
function drawHolo(ctx: CanvasRenderingContext2D) {
  ctx.save();
  roundRect(ctx, M, M, CARD_W - M * 2, CARD_H - M * 2, 30);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.26;

  // a narrow band, not a wash — it should catch the light, not stain the card
  const g = ctx.createLinearGradient(CARD_W * 0.45, 0, CARD_W * 1.05, CARD_H * 0.42);
  g.addColorStop(0.0, "rgba(0,0,0,0)");
  g.addColorStop(0.4, "rgba(255,122,69,0.1)");
  g.addColorStop(0.5, "rgba(254,225,1,0.14)");
  g.addColorStop(0.6, "rgba(120,255,190,0.09)");
  g.addColorStop(0.7, "rgba(120,190,255,0.06)");
  g.addColorStop(0.85, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(M, M, CARD_W - M * 2, CARD_H - M * 2);
  ctx.restore();
}

/** Holographic seal, top-right. Reads as foil stamping, costs one radial gradient. */
function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, BRAND.coral);
  g.addColorStop(0.4, BRAND.yellow);
  g.addColorStop(0.72, "#7CFFC0");
  g.addColorStop(1, "#8FD0FF");

  // backing disc, so the stamp stays legible over a bright photo
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(4,20,11,0.55)";
  ctx.fill();

  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = g;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = g;
  ctx.fill();

  // dashed outer ring
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.strokeStyle = BRAND.yellow;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
  ctx.fillStyle = BRAND.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 17px ${canvasFonts.mono}`;
  ctx.fillText("HHG", cx, cy - 7);
  ctx.font = `500 12px ${canvasFonts.mono}`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("2026", cx, cy + 10);
  ctx.restore();
}

/** Deterministic Code-128-looking strip. Not scannable, and not pretending to be. */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number
) {
  const rnd = seededRandom(seed);
  ctx.save();
  ctx.fillStyle = BRAND.cream;
  let cx = x;
  // quiet zone + start guard
  ctx.fillRect(cx, y, 3, h);
  cx += 8;
  while (cx < x + w - 12) {
    const bar = 2 + Math.floor(rnd() * 4);
    const gap = 2 + Math.floor(rnd() * 5);
    if (cx + bar > x + w - 12) break;
    ctx.globalAlpha = 0.75 + rnd() * 0.25;
    ctx.fillRect(cx, y, bar, h);
    cx += bar + gap;
  }
  ctx.globalAlpha = 1;
  ctx.fillRect(x + w - 6, y, 3, h);
  ctx.restore();
}

/** A QR-shaped glyph: real finder patterns, seeded noise payload. */
function drawQR(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number) {
  const N = 21;
  const cell = size / N;
  const rnd = seededRandom(seed);

  ctx.save();
  ctx.fillStyle = BRAND.cream;
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 6);
  ctx.fill();

  ctx.fillStyle = BRAND.ink;
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (inFinder(r, c)) continue;
      if (r === 6 || c === 6) {
        if ((r === 6 ? c : r) % 2 === 0) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
        continue;
      }
      if (rnd() > 0.52) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }

  const finder = (r: number, c: number) => {
    ctx.fillStyle = BRAND.ink;
    ctx.fillRect(x + c * cell, y + r * cell, cell * 7, cell * 7);
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, cell * 5, cell * 5);
    ctx.fillStyle = BRAND.ink;
    ctx.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, cell * 3, cell * 3);
  };
  finder(0, 0);
  finder(0, N - 7);
  finder(N - 7, 0);
  ctx.restore();
}

/** Cover-fit the photo into the slot, honouring pan/zoom, never distorting. */
function drawPhoto(ctx: CanvasRenderingContext2D, data: PassData) {
  const { x, y, w, h } = PHOTO;

  ctx.save();
  roundRect(ctx, x, y, w, h, 16);
  ctx.clip();

  if (data.photo) {
    const src = data.photo as HTMLImageElement;
    const iw = src.naturalWidth || (src.width as number);
    const ih = src.naturalHeight || (src.height as number);
    if (iw && ih) {
      const base = Math.max(w / iw, h / ih);
      const scale = base * Math.max(1, data.transform.zoom);
      const dw = iw * scale;
      const dh = ih * scale;
      // clamp the pan so no gap can ever appear at an edge
      const maxOx = Math.max(0, (dw - w) / 2);
      const maxOy = Math.max(0, (dh - h) / 2);
      const ox = Math.max(-maxOx, Math.min(maxOx, data.transform.offsetX * w));
      const oy = Math.max(-maxOy, Math.min(maxOy, data.transform.offsetY * h));
      ctx.drawImage(src, x + (w - dw) / 2 + ox, y + (h - dh) / 2 + oy, dw, dh);
    }
  } else {
    // empty state — still looks like a pass, never a broken box
    ctx.fillStyle = BRAND.greenDeep;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,251,232,0.30)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 26px ${canvasFonts.mono}`;
    ctx.fillText("> awaiting_photo", x + w / 2, y + h / 2);
  }

  // just enough scrim to seat the class badge — the photo stays the hero
  const scrim = ctx.createLinearGradient(0, y + h - 150, 0, y + h);
  scrim.addColorStop(0, "rgba(4,20,11,0)");
  scrim.addColorStop(0.6, "rgba(4,20,11,0.28)");
  scrim.addColorStop(1, "rgba(4,20,11,0.66)");
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y + h - 150, w, 150);

  drawScanlines(ctx, x, y, w, h, 0.045);
  ctx.restore();

  // foil stamp, top-right of the photo — reads as a real hologram over an ID
  drawSeal(ctx, x + w - 66, y + 66, 32);

  // frame + corner ticks
  ctx.save();
  roundRect(ctx, x, y, w, h, 16);
  ctx.strokeStyle = "rgba(255,251,232,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = BRAND.yellow;
  ctx.lineWidth = 3;
  const t = 22;
  const corners: [number, number, number, number][] = [
    [x - 8, y - 8, 1, 1],
    [x + w + 8, y - 8, -1, 1],
    [x - 8, y + h + 8, 1, -1],
    [x + w + 8, y + h + 8, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * t, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * t);
    ctx.stroke();
  }
  ctx.restore();
}

/* -------------------------------------------------------------------- main */

/**
 * Draws the whole pass at native 1080×1350 into whatever context it is handed.
 * The preview and the exported PNG both go through here, so what you see on
 * screen is byte-for-byte what downloads.
 */
export function drawPass(ctx: CanvasRenderingContext2D, data: PassData) {
  const name = (data.name || "Your Name").trim();
  const stack = (data.stack || "Full Stack").trim();
  const title = (data.title || "Terminal Dweller").trim();
  const seed = hashString(name + stack + title);
  const num = builderNumber(name, EVENT.cohort);

  ctx.clearRect(0, 0, CARD_W, CARD_H);

  /* backdrop — the PNG ships with it, so the notches and corners read right */
  const bg = ctx.createRadialGradient(CARD_W / 2, 260, 40, CARD_W / 2, CARD_H, CARD_H);
  bg.addColorStop(0, BRAND.inkSoft);
  bg.addColorStop(1, "#020905");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  /* card body */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, M, M, CARD_W - M * 2, CARD_H - M * 2, 30);
  ctx.fillStyle = BRAND.green;
  ctx.fill();
  ctx.restore();

  // depth inside the card: a touch of light at the head, weight at the foot
  ctx.save();
  roundRect(ctx, M, M, CARD_W - M * 2, CARD_H - M * 2, 30);
  ctx.clip();
  const lift = ctx.createLinearGradient(0, M, 0, CARD_H - M);
  lift.addColorStop(0, "rgba(255,251,232,0.03)");
  lift.addColorStop(0.42, "rgba(0,0,0,0.06)");
  lift.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = lift;
  ctx.fillRect(M, M, CARD_W - M * 2, CARD_H - M * 2);
  ctx.restore();

  ctx.textBaseline = "alphabetic";

  /* ---------------------------------------------------------- header */
  ctx.textAlign = "left";
  ctx.font = `900 76px ${canvasFonts.display}`;
  ctx.fillStyle = BRAND.cream;
  const markW = tracked(ctx, "HH GOA", X0, M + 96, -1);
  ctx.fillStyle = BRAND.yellow;
  tracked(ctx, EVENT.year, X0 + markW + 16, M + 96, 0);

  ctx.font = `700 15px ${canvasFonts.mono}`;
  ctx.fillStyle = "rgba(255,251,232,0.62)";
  tracked(ctx, "BUILDER PASS", X1, M + 70, 3.2, "right");

  // hairline
  ctx.fillStyle = "rgba(255,251,232,0.22)";
  ctx.fillRect(X0, M + 118, CONTENT_W, 1);

  ctx.font = `500 19px ${canvasFonts.mono}`;
  ctx.fillStyle = BRAND.yellow;
  tracked(ctx, EVENT.strap, X0, M + 152, 1.4);
  ctx.fillStyle = "rgba(255,251,232,0.75)";
  tracked(ctx, EVENT.dates, X1, M + 152, 1.4, "right");

  /* ----------------------------------------------------------- photo */
  drawPhoto(ctx, data);

  /* class badge, straddling the photo's lower-left */
  {
    const label = title.toUpperCase();
    ctx.font = `700 21px ${canvasFonts.mono}`;
    const tw = trackedWidth(ctx, label, 2.2);
    const bw = tw + 40;
    const bh = 48;
    const bx = PHOTO.x + 24;
    const by = PHOTO.y + PHOTO.h - 24 - bh;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fillStyle = BRAND.yellow;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = BRAND.green;
    ctx.textAlign = "left";
    tracked(ctx, label, bx + 20, by + 32, 2.2);
  }

  /* ------------------------------------------------------- name block */
  ctx.textAlign = "left";
  const nameFit = fitText(
    ctx,
    name.toUpperCase(),
    CONTENT_W,
    (s) => `700 ${s}px ${canvasFonts.grotesk}`,
    64,
    30
  );
  ctx.fillStyle = BRAND.cream;
  ctx.fillText(nameFit.text, X0, 946);

  const stackFit = fitText(
    ctx,
    stack,
    CONTENT_W - 30,
    (s) => `500 ${s}px ${canvasFonts.mono}`,
    26,
    16
  );
  ctx.fillStyle = BRAND.yellow;
  ctx.fillText("› ", X0, 988);
  const caretW = ctx.measureText("› ").width;
  ctx.font = `500 ${stackFit.size}px ${canvasFonts.mono}`;
  ctx.fillStyle = "rgba(255,251,232,0.88)";
  ctx.fillText(stackFit.text, X0 + caretW, 988);

  // the event's line, sitting where the badge would emboss it
  ctx.font = `500 14px ${canvasFonts.mono}`;
  ctx.fillStyle = "rgba(255,251,232,0.55)";
  tracked(ctx, EVENT.tagline, X0, 1024, 3.4);

  /* ---------------------------------------------------- perforation */
  ctx.save();
  ctx.strokeStyle = "rgba(255,251,232,0.42)";
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 9]);
  ctx.beginPath();
  ctx.moveTo(M + 26, PERF_Y);
  ctx.lineTo(CARD_W - M - 26, PERF_Y);
  ctx.stroke();
  ctx.restore();

  // punched notches — filled with the backdrop so the card reads as torn stock
  ctx.save();
  ctx.fillStyle = "#03110A";
  ctx.beginPath();
  ctx.arc(M, PERF_Y, 20, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CARD_W - M, PERF_Y, 20, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.restore();

  /* ----------------------------------------------------- data grid */
  const cols: [string, string, string][] = [
    ["BUILDER No.", `#${num}/${EVENT.cohort}`, BRAND.cream],
    ["VENUE", EVENT.venue, BRAND.cream],
    ["STATUS", "SHIPPING", BRAND.yellow],
  ];
  const colW = CONTENT_W / 3;
  cols.forEach(([label, value, color], i) => {
    const cx = X0 + colW * i;
    ctx.font = `500 13px ${canvasFonts.mono}`;
    ctx.fillStyle = "rgba(255,251,232,0.45)";
    tracked(ctx, label, cx, PERF_Y + 40, 2.6);
    ctx.font = `700 27px ${canvasFonts.mono}`;
    ctx.fillStyle = color;
    tracked(ctx, value, cx, PERF_Y + 78, 0.4);
  });

  /* -------------------------------------------------- barcode + QR */
  const BAR_W = 720;
  drawBarcode(ctx, X0, 1180, BAR_W, 50, seed);

  // one caption line under the barcode, balanced left/right — no stacked footers
  ctx.font = `500 13px ${canvasFonts.mono}`;
  ctx.fillStyle = "rgba(255,251,232,0.5)";
  tracked(ctx, `HHG26 ${num} FRAMEINGOA`, X0, 1262, 3);
  ctx.fillStyle = "rgba(255,251,232,0.36)";
  tracked(ctx, EVENT.studio, X0 + BAR_W, 1262, 3, "right");

  drawQR(ctx, X1 - 100, 1170, 100, seed ^ 0x5bf0);

  /* ---------------------------------------------------- finish pass */
  drawHolo(ctx);
  drawGrain(ctx, 0.055);

  // crisp inner hairline last, so nothing muddies the edge
  ctx.save();
  roundRect(ctx, M + 0.5, M + 0.5, CARD_W - M * 2 - 1, CARD_H - M * 2 - 1, 30);
  ctx.strokeStyle = "rgba(255,251,232,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Renders the pass to a detached canvas and hands back a PNG blob. */
export async function renderPassBlob(data: PassData, scale = 1): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  drawPass(ctx, data);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
  );
}

export function passFileName(name: string) {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "builder";
  return `hhgoa-2026-${slug}.png`;
}
