"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const OrbitScene = dynamic(() => import("./OrbitScene"), { ssr: false, loading: () => <OrbitFallback /> });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Static drawing of the same sculpture: used before the 3D chunk loads and when WebGL is unavailable. */
export function OrbitFallback() {
  return (
    <svg viewBox="-160 -160 320 320" className="absolute inset-0 m-auto h-full w-full max-w-[520px]" aria-hidden>
      <defs>
        <radialGradient id="core" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#3a3f5e" />
          <stop offset="0.55" stopColor="#171a2c" />
          <stop offset="1" stopColor="#0f1120" />
        </radialGradient>
      </defs>
      {[
        { rx: 120, ry: 44, rot: -24 },
        { rx: 140, ry: 30, rot: 38 },
        { rx: 152, ry: 70, rot: 8 },
      ].map((r, i) => (
        <g key={i} transform={`rotate(${r.rot})`}>
          <ellipse rx={r.rx} ry={r.ry} fill="none" stroke="#2448d8" strokeOpacity="0.45" strokeWidth="1" />
          <circle cx={r.rx} cy="0" r="5" fill="#2448d8" />
          <circle cx={-r.rx * 0.7} cy={r.ry * 0.71} r="3" fill="#e2d8c2" />
          <circle cx={-r.rx * 0.2} cy={-r.ry * 0.98} r="3" fill="#e2d8c2" />
        </g>
      ))}
      <circle r="62" fill="url(#core)" />
      <ellipse cx="-20" cy="-26" rx="18" ry="10" fill="#fff" opacity="0.08" />
    </svg>
  );
}

export function HeroVisual() {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  useEffect(() => {
    const coarseAndSmall = window.matchMedia("(max-width: 380px)").matches;
    setMode(hasWebGL() && !coarseAndSmall ? "3d" : "static");
  }, []);
  return (
    <div className="relative h-full w-full">
      {mode === "3d" ? <OrbitScene /> : <OrbitFallback />}
    </div>
  );
}
