import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Stores a generated pass so it can have a real share URL whose OG image is
 * the actual card. Blob is optional: without a token the app still downloads
 * and shares, it just falls back to the generic preview.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "blob-not-configured" }, { status: 501 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const id = String(form.get("id") ?? "").replace(/[^a-z0-9]/gi, "");
  const name = String(form.get("name") ?? "").slice(0, 60);
  const title = String(form.get("title") ?? "").slice(0, 60);

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 });
  }
  if (!id || id.length < 6) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  }

  const blob = await put(`passes/${id}.png`, file, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
  });

  // name/title ride along in the query string purely for the share page's text
  const q = new URLSearchParams({ n: name, t: title }).toString();
  return NextResponse.json({ id, url: blob.url, path: `/p/${id}?${q}` });
}
