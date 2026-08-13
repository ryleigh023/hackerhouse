import Studio from "@/components/Studio";

export default function Home() {
  return (
    <div className="relative min-h-dvh">
      {/* ambient light: a Goa sunrise bleeding up from behind the pass */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(90rem 50rem at 50% -12%, rgba(11,104,57,0.55), transparent 60%)," +
            "radial-gradient(50rem 30rem at 88% 8%, rgba(255,122,69,0.14), transparent 62%)," +
            "radial-gradient(46rem 30rem at 6% 100%, rgba(254,225,1,0.08), transparent 60%)",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 texture-grain opacity-[0.05]" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 texture-scanlines opacity-[0.35]"
      />
      <Studio />
    </div>
  );
}
