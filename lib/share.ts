import { EVENT } from "./brand";

export function shareCaption(name: string, title: string, link?: string) {
  const who = name.trim() || "I";
  const lines = [
    `${who} just got framed for Hacker House Goa 2026.`,
    ``,
    `Builder class: ${title}`,
    `${EVENT.dates} · ${EVENT.strap}`,
    ``,
    `Make yours ${EVENT.hashtag}`,
  ];
  if (link) lines.push(link);
  return lines.join("\n");
}

export function tweetIntentUrl(text: string) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/** True when the browser can actually attach the PNG to a native share sheet. */
export function canShareFile(file: File) {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

/**
 * Capability is not the right test for "Share to X".
 *
 * macOS Safari happily reports it can share files, but its share sheet is
 * AirDrop/Mail/Messages/Notes — X is not in it, so routing a desktop user
 * there dead-ends them. Only phones and tablets have an OS sheet that lists
 * X, so gate on the input device instead and send everyone else to the
 * web intent.
 */
export function isTouchDevice() {
  if (typeof navigator === "undefined" || typeof matchMedia !== "function") return false;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const noHover = matchMedia("(hover: none)").matches;
  return coarse && noHover && navigator.maxTouchPoints > 0;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // give Safari a beat before the URL disappears out from under the download
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Short, URL-safe id for the shareable pass route. */
export function passId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

/** Fires the little "thunk" on generate where the hardware allows it. */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* desktop, or the user has it switched off */
  }
}
