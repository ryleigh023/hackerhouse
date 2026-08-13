import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Generic social preview for the landing page (a real pass supersedes this on /p/[id]). */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B6839",
          padding: 72,
          fontFamily: "monospace",
          color: "#FFFBE8",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, letterSpacing: 8, color: "#FEE101" }}>HH GOA 2026</div>
            <div style={{ fontSize: 84, fontWeight: 700, marginTop: 14, lineHeight: 1 }}>
              FRAMED IN GOA
            </div>
            <div style={{ fontSize: 30, marginTop: 20, opacity: 0.8 }}>
              Builder ID Card Generator
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 132,
              height: 132,
              borderRadius: 999,
              border: "3px solid #FEE101",
              fontSize: 28,
              color: "#FEE101",
            }}
          >
            HHG
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ height: 2, background: "rgba(255,251,232,0.35)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
            <span style={{ color: "#FEE101" }}>AI × CRYPTO · GOA, INDIA</span>
            <span>OCT 28–31</span>
            <span style={{ opacity: 0.7 }}>#FrameInGoa</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
