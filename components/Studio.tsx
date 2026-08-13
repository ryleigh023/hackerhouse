"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BootLog from "./BootLog";
import PassCanvas from "./PassCanvas";
import { EVENT } from "@/lib/brand";
import {
  DEFAULT_TRANSFORM,
  passFileName,
  renderPassBlob,
  type PassData,
  type Transform,
} from "@/lib/card";
import { builderNumber } from "@/lib/hash";
import { loadPhoto, type LoadedPhoto } from "@/lib/image";
import { rollTitle } from "@/lib/titles";
import {
  canShareFile,
  downloadBlob,
  haptic,
  isTouchDevice,
  passId,
  shareCaption,
  tweetIntentUrl,
} from "@/lib/share";

type Phase = "compose" | "booting" | "ready";

export default function Studio() {
  const [name, setName] = useState("");
  const [stack, setStack] = useState("");
  const [title, setTitle] = useState(() => rollTitle());
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM);

  const [phase, setPhase] = useState<Phase>("compose");
  const [reveal, setReveal] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const photoUrl = useRef<string | null>(null);

  const data: PassData = useMemo(
    () => ({ name, stack, title, photo: photo?.image ?? null, transform }),
    [name, stack, title, photo, transform]
  );

  // release the object URL when the photo is swapped or the page goes away
  useEffect(() => {
    photoUrl.current = photo?.url ?? null;
    return () => {
      if (photoUrl.current && photoUrl.current !== photo?.url) URL.revokeObjectURL(photoUrl.current);
    };
  }, [photo]);

  /* ------------------------------------------------------------- upload */

  const acceptFile = useCallback(async (file: File) => {
    setBusy(true);
    setStatus(null);
    try {
      const loaded = await loadPhoto(file);
      setPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return loaded;
      });
      setTransform(DEFAULT_TRANSFORM);
      setPhase("compose");
      setShareLink(null);
      haptic(8);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "That file could not be read.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void acceptFile(file);
  };

  /* ----------------------------------------------------------- generate */

  const bootLines = useMemo(() => {
    const num = builderNumber(name, EVENT.cohort);
    return [
      "> initializing pass...\n",
      "> resolving identity: " + (name.trim() || "anonymous").toLowerCase() + "\n",
      "> stack: " + (stack.trim() || "full stack").toLowerCase() + "\n",
      "> rolling builder class: " + title.toLowerCase() + "\n",
      `> minting builder #${num}/${EVENT.cohort}...\n`,
      "> location: goa.beach\n",
      "> signal/noise: optimal\n",
      "> status: SHIPPING\n",
    ];
  }, [name, stack, title]);

  /** Uploads the PNG so the share link's OG image is the real card. Best effort. */
  const publish = useCallback(async () => {
    try {
      const blob = await renderPassBlob(data, 1);
      const id = passId();
      const form = new FormData();
      form.append("file", blob, `${id}.png`);
      form.append("id", id);
      form.append("name", name.trim());
      form.append("title", title);
      const res = await fetch("/api/pass", { method: "POST", body: form });
      if (!res.ok) return null;
      const json = (await res.json()) as { path: string };
      const link = new URL(json.path, window.location.origin).toString();
      setShareLink(link);
      return link;
    } catch {
      return null; // no blob store configured — share still works, just without a link
    }
  }, [data, name, title]);

  const generate = () => {
    if (!photo) {
      fileRef.current?.click();
      return;
    }
    haptic([14, 30, 22]);
    setReveal(0);
    setStatus(null);
    setPhase("booting");
    void publish();
  };

  const onBootDone = useCallback(() => {
    setReveal(1);
    setPhase("ready");
    haptic(24);
  }, []);

  /* -------------------------------------------------------- export/share */

  const download = async () => {
    setBusy(true);
    try {
      // 2x for a genuinely retina file — 2160×2700
      const blob = await renderPassBlob(data, 2);
      downloadBlob(blob, passFileName(name));
      haptic(16);
      setStatus("Saved to your downloads.");
    } catch {
      setStatus("Could not export the PNG. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderPassBlob(data, 1);
      const file = new File([blob], passFileName(name), { type: "image/png" });

      // phones/tablets: the OS sheet lists X, so hand it the actual PNG
      if (isTouchDevice() && canShareFile(file)) {
        await navigator.share({
          files: [file],
          text: shareCaption(name, title),
        });
        haptic(16);
        return;
      }

      // desktop: X intent, with the share link so the card unfurls in the preview
      const link = shareLink ?? (await publish());
      window.open(tweetIntentUrl(shareCaption(name, title, link ?? undefined)), "_blank", "noopener");
      setStatus(
        link
          ? "Opened X — your link unfurls the card. Download the PNG to attach it directly too."
          : "Opened X without a link — download the PNG and attach it."
      );
    } catch (err) {
      // AbortError = user dismissed the share sheet; not worth surfacing
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setStatus("Sharing failed. Download the PNG instead.");
      }
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const link = shareLink ?? (await publish());
    if (!link) {
      setStatus("Share links need Vercel Blob configured. Download the PNG instead.");
      return;
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    haptic(10);
    setTimeout(() => setCopied(false), 1800);
  };

  const reset = () => {
    setPhase("compose");
    setShareLink(null);
    setStatus(null);
    setReveal(1);
  };

  /* ---------------------------------------------------------------- ui */

  const canGenerate = Boolean(photo) && name.trim().length > 0;

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 pb-40 pt-6 sm:px-6 lg:pb-16">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void acceptFile(f);
          e.target.value = "";
        }}
      />

      <Header />

      <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-12">
        {/* ---------------------------------------------------- the pass */}
        <div className="lg:sticky lg:top-6">
          <div
            ref={passRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="relative overflow-hidden rounded-2xl"
          >
            <motion.div
              animate={{ scale: phase === "booting" ? 0.985 : 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              style={{
                clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)`,
                filter: reveal < 1 ? `blur(${(1 - reveal) * 5}px)` : "none",
              }}
            >
              <PassCanvas data={data} onTransform={setTransform} className="no-tap-highlight" />
            </motion.div>

            {/* decode scan line, riding the reveal boundary */}
            {reveal < 1 && (
              <div
                className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-goa-yellow/25 to-goa-yellow"
                style={{ top: `calc(${reveal * 100}% - 6rem)`, mixBlendMode: "screen" }}
              />
            )}

            {photo && phase !== "booting" && (
              <p className="pointer-events-none absolute inset-x-0 top-[46%] text-center text-[10.5px] uppercase tracking-[0.22em] text-goa-cream/0 transition-colors duration-200 sm:group-hover:text-goa-cream/60">
                drag to reposition
              </p>
            )}
          </div>

          {photo && phase === "compose" && (
            <div className="mt-3 flex items-center justify-between gap-3 text-[10.5px] uppercase tracking-[0.2em] text-goa-cream/40">
              <span>drag photo to reposition · pinch or scroll to zoom</span>
              <button
                type="button"
                onClick={() => setTransform(DEFAULT_TRANSFORM)}
                className="shrink-0 underline underline-offset-4 transition-colors hover:text-goa-yellow"
              >
                reset
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------- the controls */}
        <div className="flex flex-col gap-5">
          <AnimatePresence mode="wait">
            {phase === "booting" ? (
              <BootLog
                key="boot"
                lines={bootLines}
                duration={1900}
                onDone={onBootDone}
                onProgress={setReveal}
              />
            ) : phase === "ready" ? (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-goa-yellow">
                  › pass minted
                </p>

                <button
                  onClick={download}
                  disabled={busy}
                  className="w-full rounded-xl bg-goa-yellow px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-goa-green transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? "Rendering…" : "Download PNG"}
                </button>

                <button
                  onClick={share}
                  disabled={busy}
                  className="w-full rounded-xl border border-goa-cream/25 bg-goa-cream/5 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-goa-cream transition-colors hover:border-goa-yellow/60 hover:text-goa-yellow disabled:opacity-60"
                >
                  Share to X
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={copyLink}
                    className="flex-1 rounded-xl border border-goa-cream/15 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-goa-cream/70 transition-colors hover:text-goa-yellow"
                  >
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                  <button
                    onClick={reset}
                    className="flex-1 rounded-xl border border-goa-cream/15 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-goa-cream/70 transition-colors hover:text-goa-yellow"
                  >
                    Edit pass
                  </button>
                </div>

                <p className="pt-1 text-[11px] leading-relaxed text-goa-cream/45">
                  Post it with {EVENT.hashtag} to land on the Radar.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="compose"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-5"
              >
                <Step n="01" label="Your photo">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-goa-cream/25 bg-goa-cream/[0.03] px-4 py-4 text-left transition-colors hover:border-goa-yellow/70"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-goa-yellow/15 text-lg text-goa-yellow">
                      {photo ? "✓" : "+"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-goa-cream">
                        {busy ? "Decoding…" : photo ? "Photo loaded — tap to swap" : "Upload a photo"}
                      </span>
                      <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-goa-cream/40">
                        jpg · png · heic
                      </span>
                    </span>
                  </button>
                </Step>

                <Step n="02" label="Identity">
                  <div className="flex flex-col gap-3">
                    <Field
                      label="Name"
                      value={name}
                      onChange={setName}
                      placeholder="Ada Lovelace"
                      maxLength={24}
                    />
                    <Field
                      label="Stack / Role"
                      value={stack}
                      onChange={setStack}
                      placeholder="Solidity + Next.js"
                      maxLength={34}
                    />
                  </div>
                </Step>

                <Step n="03" label="Builder class">
                  <div className="flex items-stretch gap-2">
                    <div className="flex min-w-0 flex-1 items-center rounded-xl border border-goa-cream/15 bg-goa-cream/[0.03] px-4 py-3">
                      <span className="truncate text-sm uppercase tracking-[0.08em] text-goa-yellow">
                        {title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle((t) => rollTitle(t));
                        haptic(8);
                      }}
                      aria-label="Roll a new builder class"
                      className="shrink-0 rounded-xl border border-goa-cream/15 px-4 text-[11px] uppercase tracking-[0.16em] text-goa-cream/70 transition-colors hover:border-goa-yellow/60 hover:text-goa-yellow"
                    >
                      Re-roll
                    </button>
                  </div>
                </Step>

                {/* desktop CTA; mobile gets the sticky bar below */}
                <button
                  onClick={generate}
                  disabled={!canGenerate}
                  className="hidden w-full rounded-xl bg-goa-yellow px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-goa-green transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 lg:block"
                >
                  Generate pass
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {status && (
            <p role="status" className="text-[11.5px] leading-relaxed text-goa-coral">
              {status}
            </p>
          )}
        </div>
      </div>

      {/* sticky mobile CTA — always in thumb reach, never a page jump */}
      {phase === "compose" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-goa-cream/10 bg-goa-ink/92 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg lg:hidden">
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="w-full rounded-xl bg-goa-yellow px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-goa-green transition-transform active:scale-[0.98] disabled:opacity-35"
          >
            {!photo ? "Upload a photo" : !name.trim() ? "Add your name" : "Generate pass"}
          </button>
        </div>
      )}

      <footer className="mt-14 border-t border-goa-cream/10 pt-6 text-[10.5px] uppercase tracking-[0.2em] text-goa-cream/30">
        {EVENT.studio} · {EVENT.tagline} · Not affiliated artwork — a builder task entry.
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------ subviews */

function Header() {
  return (
    <header className="relative">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10.5px] uppercase tracking-[0.3em] text-goa-yellow">
          {EVENT.name} {EVENT.year}
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.24em] text-goa-cream/40">
          {EVENT.dates}
        </span>
      </div>

      <h1 className="mt-4 font-display text-5xl font-black uppercase leading-[0.88] tracking-tight text-goa-cream sm:text-7xl">
        Framed
        <br />
        in Goa
      </h1>

      <p className="mt-4 max-w-md text-[13px] leading-relaxed text-goa-cream/55">
        Your builder ID for the residency. Upload a photo, name your stack, and the terminal prints
        your pass. {EVENT.strap}.
      </p>
    </header>
  );
}

function Step({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.24em] text-goa-cream/40">
        <span className="text-goa-yellow">{n}</span>
        {label}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
}) {
  return (
    <label className="group flex items-center gap-3 rounded-xl border border-goa-cream/15 bg-goa-cream/[0.03] px-4 py-3 transition-colors focus-within:border-goa-yellow/70">
      <span className="w-[4.5rem] shrink-0 text-[10px] uppercase tracking-[0.16em] text-goa-cream/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-sm text-goa-cream outline-none placeholder:text-goa-cream/25"
      />
    </label>
  );
}
