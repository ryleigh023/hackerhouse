"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  CARD_H,
  CARD_W,
  PHOTO,
  clampTransform,
  drawPass,
  type PassData,
  type Transform,
} from "@/lib/card";
import { ensureFonts } from "@/lib/fonts";

type Props = {
  data: PassData;
  /** When set, the photo slot accepts drag + pinch and reports new transforms. */
  onTransform?: (t: Transform) => void;
  className?: string;
};

type Pointer = { x: number; y: number };

/**
 * Draws the pass through the exact same `drawPass` used for the PNG export,
 * so the preview is a true WYSIWYG of the downloaded file.
 */
export default function PassCanvas({ data, onTransform, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const pointers = useRef(new Map<number, Pointer>());
  const gestureStart = useRef<{ dist: number; zoom: number } | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.clientWidth;
    if (!cssW) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssW * (CARD_H / CARD_W) * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = w / CARD_W;
    ctx.scale(scale, scale);
    drawPass(ctx, dataRef.current);
  }, []);

  // repaint on data change, and once more after webfonts land
  useEffect(() => {
    paint();
    let cancelled = false;
    ensureFonts().then(() => {
      if (!cancelled) paint();
    });
    return () => {
      cancelled = true;
    };
  }, [data, paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [paint]);

  /* ------------------------------------------------------------ gestures */

  /** Is this point inside the photo slot? Everything else stays a normal scroll. */
  const overPhoto = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const r = canvas.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * CARD_W;
    const cy = ((e.clientY - r.top) / r.height) * CARD_H;
    return cx >= PHOTO.x && cx <= PHOTO.x + PHOTO.w && cy >= PHOTO.y && cy <= PHOTO.y + PHOTO.h;
  }, []);

  const scaleFactor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    return canvas.getBoundingClientRect().width / CARD_W;
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onTransform || !data.photo) return;
    if (pointers.current.size === 0 && !overPhoto(e)) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gestureStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: data.transform.zoom };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onTransform || !pointers.current.has(e.pointerId)) return;
    e.preventDefault();

    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t = data.transform;

    if (pointers.current.size >= 2 && gestureStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / (gestureStart.current.dist || 1);
      onTransform(clampTransform({ ...t, zoom: gestureStart.current.zoom * ratio }));
      return;
    }

    // one finger: pan, in fractions of the photo slot
    const s = scaleFactor();
    const dx = (e.clientX - prev.x) / s / PHOTO.w;
    const dy = (e.clientY - prev.y) / s / PHOTO.h;
    onTransform(clampTransform({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }));
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gestureStart.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!onTransform || !data.photo) return;
    const t = data.transform;
    onTransform(clampTransform({ ...t, zoom: t.zoom * (e.deltaY < 0 ? 1.06 : 0.94) }));
  };

  const interactive = Boolean(onTransform && data.photo);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        aspectRatio: `${CARD_W} / ${CARD_H}`,
        width: "100%",
        display: "block",
        // let the browser scroll the page normally until a drag starts on the photo
        touchAction: interactive ? "none" : "auto",
        cursor: interactive ? "grab" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      role="img"
      aria-label={`Hacker House Goa 2026 builder pass for ${data.name || "your name"}`}
    />
  );
}
