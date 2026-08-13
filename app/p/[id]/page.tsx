import type { Metadata } from "next";
import Link from "next/link";
import { list } from "@vercel/blob";
import { EVENT } from "@/lib/brand";

export const runtime = "nodejs";
// passes are immutable once written; cache the lookup hard
export const revalidate = 3600;

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> };

/** Resolves a pass id to its stored PNG without needing a database. */
async function passUrl(id: string): Promise<string | null> {
  const clean = id.replace(/[^a-z0-9]/gi, "");
  if (!clean || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: `passes/${clean}.png`, limit: 1 });
    return blobs[0]?.url ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const url = await passUrl(id);
  const name = (sp.n || "").slice(0, 60);
  const title = (sp.t || "").slice(0, 60);

  const heading = name ? `${name} — HH Goa 2026 Builder Pass` : "HH Goa 2026 Builder Pass";
  const description = title
    ? `Builder class: ${title}. ${EVENT.dates} · ${EVENT.strap}. Make yours ${EVENT.hashtag}`
    : `${EVENT.dates} · ${EVENT.strap}. Make yours ${EVENT.hashtag}`;

  // the OG image is the real generated card, never a placeholder
  const images = url ? [{ url, width: 1080, height: 1350 }] : [{ url: "/api/og" }];

  return {
    title: heading,
    description,
    openGraph: { title: heading, description, images, type: "website" },
    twitter: { card: "summary_large_image", title: heading, description, images: images.map((i) => i.url) },
  };
}

export default async function PassPage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;
  const url = await passUrl(id);
  const name = (sp.n || "").slice(0, 60);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-7 px-5 py-12">
      <div className="pointer-events-none fixed inset-0 texture-grain opacity-[0.06]" />

      <header className="relative text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-goa-yellow">
          {EVENT.name} {EVENT.year} · Builder Pass
        </p>
        <h1 className="mt-2 font-grotesk text-2xl font-bold uppercase text-goa-cream">
          {name || "Framed in Goa"}
        </h1>
      </header>

      {url ? (
        // plain <img>: the file is already an optimised PNG at its native size
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name ? `${name}'s HH Goa 2026 builder pass` : "HH Goa 2026 builder pass"}
          width={1080}
          height={1350}
          className="relative w-full rounded-2xl shadow-2xl"
        />
      ) : (
        <p className="relative rounded-xl border border-goa-cream/15 bg-goa-ink-soft px-5 py-6 text-center text-sm text-goa-cream/70">
          This pass has expired or was never stored. Generate a fresh one below.
        </p>
      )}

      <Link
        href="/"
        className="relative w-full rounded-xl bg-goa-yellow px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.18em] text-goa-green transition-transform active:scale-[0.98]"
      >
        Make your own pass
      </Link>

      <p className="relative text-center text-[11px] uppercase tracking-[0.2em] text-goa-cream/35">
        {EVENT.studio} · {EVENT.tagline}
      </p>
    </main>
  );
}
