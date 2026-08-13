# Framed in Goa

Builder ID card generator for **Hacker House Goa 2026** — AI × Crypto builder residency,
Oct 28–31, Goa, India. By 2:47 PM Studio.

Upload a photo, fill two fields, and a terminal boot sequence prints a branded builder pass
you can download as a real PNG and share to X. No login, no signup, one pass.

## Quick start

```bash
npm install && npm run dev
```

Open http://localhost:3000.

## How it works

**The pass is drawn, not screenshotted.** `lib/card.ts` hand-draws the whole card onto a 2D
canvas at a native 1080×1350. The on-screen preview and the exported PNG call the *same*
`drawPass()`, so what you see is byte-for-byte what downloads — no `html-to-image` reflow
surprises, no CORS-tainted canvases, and no Tailwind `oklch()` parse failures.

| Concern | Where |
| --- | --- |
| Card drawing, layout, foil, barcode, QR | `lib/card.ts` |
| Brand palette + event copy | `lib/brand.ts` |
| Photo decode, HEIC conversion | `lib/image.ts` |
| Builder classes + re-roll | `lib/titles.ts` |
| Deterministic pass number / barcode seed | `lib/hash.ts` |
| Share, download, haptics | `lib/share.ts` |
| Preview canvas + pan/pinch gestures | `components/PassCanvas.tsx` |
| Boot-log typewriter | `components/BootLog.tsx` |

### Notable details

- **HEIC** — `heic2any` is ~1 MB, so it is dynamically imported only when a `.heic`/`.heif`
  file actually shows up (iPhone camera rolls). Everything else decodes natively.
- **Photo fitting** — always cover-fit, never distorted. Drag to pan, pinch or scroll to zoom;
  the pan is clamped in pixels so a gap can never open at an edge.
- **Determinism** — the builder number, barcode and QR are seeded from the name via FNV-1a,
  so a given builder always gets the same `#085/247`.
- **Boot sequence** — ~1.9s, skippable by tapping the log, and the card's clip-path reveal is
  driven by the same progress value so the two stay in lockstep. Respects
  `prefers-reduced-motion`.
- **Exports** — Download gives 2160×2700 (2× retina). The Share sheet attaches 1080×1350
  (~2 MB) to stay under X's upload limit.

## Share links and OG images

`POST /api/pass` stores the generated PNG in Vercel Blob and returns `/p/<id>`. That route's
`generateMetadata` resolves the blob and sets it as the OG image, so an unfurled link shows
the **actual card** rather than a blank thumbnail.

Blob is optional. Without `BLOB_READ_WRITE_TOKEN` the API returns `501` and the app degrades
cleanly: download and native share still work, the X intent just posts without a link, and
`/p/<id>` falls back to the generic `/api/og` card.

To enable it:

```bash
vercel blob store add framed-in-goa
```

then pull the env var locally with `vercel env pull .env.local`.

## Deploy

```bash
vercel --prod
```

`vercel.json` pins the region to `bom1` (Mumbai) — the audience is in India.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | no | Enables share links with real-card OG images |
| `NEXT_PUBLIC_SITE_URL` | no | Overrides the metadata base URL |

## Notes

Fan artwork for a builder task entry — not an official Hacker House Goa property. The barcode
and QR are decorative and deliberately not scannable.
