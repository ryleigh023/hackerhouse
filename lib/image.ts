const HEIC_RE = /\.(heic|heif)$/i;

function isHeic(file: File) {
  // Safari reports image/heic; most other browsers hand back an empty type.
  return /image\/hei[cf]/i.test(file.type) || HEIC_RE.test(file.name);
}

/** heic2any is ~1MB and touches `window` — only pull it in when we hit a HEIC. */
async function decodeHeic(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : (out as Blob);
}

export type LoadedPhoto = { image: HTMLImageElement; url: string };

/**
 * File → decoded <img>, transparently converting HEIC from iPhone camera rolls.
 * Rejects with a message that is safe to show the user.
 */
export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  let blob: Blob = file;

  if (isHeic(file)) {
    try {
      blob = await decodeHeic(file);
    } catch {
      throw new Error("Could not read that HEIC. Try exporting it as JPEG.");
    }
  } else if (file.type && !/^image\//.test(file.type)) {
    throw new Error("That is not an image file.");
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image could not be decoded."));
      img.src = url;
    });
    return { image, url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}
