"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Props = {
  lines: string[];
  /** Total type-out budget in ms. Kept short — this is a flourish, not a wait. */
  duration?: number;
  onDone: () => void;
  /** Progress 0→1, so the card can decode in step with the log. */
  onProgress?: (p: number) => void;
};

export default function BootLog({ lines, duration = 2000, onDone, onProgress }: Props) {
  const [typed, setTyped] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const doneRef = useRef(onDone);
  const progressRef = useRef(onProgress);
  doneRef.current = onDone;
  progressRef.current = onProgress;

  const skip = useRef(() => {});

  useEffect(() => {
    const total = lines.reduce((n, l) => n + l.length, 0) || 1;
    const perChar = duration / total;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let start = 0;
    let finished = false;
    let backstop = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
      setTyped(lines);
      setDone(true);
      progressRef.current?.(1);
      doneRef.current();
    };
    skip.current = finish;

    if (reduced) {
      finish();
      return;
    }

    // rAF is suspended entirely while the tab is hidden, so a user who switches
    // apps mid-generate would otherwise be stranded on a frozen log with no
    // download button. setTimeout still fires in the background — belt and braces.
    backstop = window.setTimeout(finish, duration + 600);

    const tick = (ts: number) => {
      if (!start) start = ts;
      const chars = Math.min(total, Math.floor((ts - start) / perChar));
      progressRef.current?.(chars / total);

      const out: string[] = [];
      let budget = chars;
      for (const line of lines) {
        if (budget <= 0) break;
        out.push(line.slice(0, budget));
        budget -= line.length;
      }
      setTyped(out);

      if (chars >= total) {
        // let the last line sit for a beat before the card takes over
        setTimeout(finish, 220);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
    };
  }, [lines, duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-xl border border-goa-cream/15 bg-goa-ink-soft/90 p-4 sm:p-5"
      onClick={() => skip.current()}
    >
      <div className="pointer-events-none absolute inset-0 texture-scanlines opacity-40" />

      <div className="relative flex items-center gap-2 pb-3">
        <span className="h-2 w-2 rounded-full bg-goa-coral" />
        <span className="h-2 w-2 rounded-full bg-goa-yellow" />
        <span className="h-2 w-2 rounded-full bg-goa-green" />
        <span className="ml-2 text-[11px] uppercase tracking-[0.22em] text-goa-cream/45">
          hhgoa — pass_forge
        </span>
      </div>

      <pre className="relative min-h-[132px] whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.75] text-goa-cream/85 sm:text-[13.5px]">
        {typed.map((line, i) => {
          const last = i === typed.length - 1 && !done;
          return (
            <span key={i} className="block">
              <span className="text-goa-yellow">{line.startsWith(">") ? ">" : ""}</span>
              <span className={line.includes("SHIPPING") ? "text-goa-yellow" : undefined}>
                {line.startsWith(">") ? line.slice(1) : line}
              </span>
              {last && <span className="caret text-goa-yellow" />}
            </span>
          );
        })}
      </pre>

      {!done && (
        <p className="relative pt-1 text-[10.5px] uppercase tracking-[0.2em] text-goa-cream/35">
          tap to skip
        </p>
      )}
    </motion.div>
  );
}
