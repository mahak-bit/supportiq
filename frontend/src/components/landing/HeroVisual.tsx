"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";

const OrbitScene = dynamic(() => import("./OrbitScene"), { ssr: false, loading: () => <OrbitFallback /> });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Static drawing of the same sculpture: used before the 3D chunk loads, when WebGL is
 *  unavailable, on very small or low-power devices, and on the sign-in page. */
export function OrbitFallback() {
  const id = useId();
  return (
    <svg viewBox="-160 -160 320 320" className="absolute inset-0 m-auto h-full w-full max-w-[520px]" aria-hidden>
      <defs>
        <radialGradient id={`${id}-core`} cx="38%" cy="34%" r="72%">
          <stop offset="0" stopColor="#24345e" />
          <stop offset="0.55" stopColor="#0c1428" />
          <stop offset="1" stopColor="#070b16" />
        </radialGradient>
        <radialGradient id={`${id}-rim`} r="50%">
          <stop offset="0.78" stopColor="#5b8cff" stopOpacity="0" />
          <stop offset="0.93" stopColor="#5b8cff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#5b8cff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {[
        { rx: 120, ry: 44, rot: -24 },
        { rx: 140, ry: 30, rot: 38 },
        { rx: 152, ry: 70, rot: 8 },
      ].map((r, i) => (
        <g key={i} transform={`rotate(${r.rot})`}>
          <ellipse rx={r.rx} ry={r.ry} fill="none" stroke="#5b8cff" strokeOpacity="0.5" strokeWidth="1" />
          <circle cx={r.rx} cy="0" r="7" fill="#3fd2ee" opacity="0.6" filter={`url(#${id}-glow)`} />
          <circle cx={r.rx} cy="0" r="4.5" fill="#3fd2ee" />
          <circle cx={-r.rx * 0.7} cy={r.ry * 0.71} r="2.6" fill="#7f9ad6" />
          <circle cx={-r.rx * 0.2} cy={-r.ry * 0.98} r="2.6" fill="#7f9ad6" />
        </g>
      ))}
      <circle r="62" fill={`url(#${id}-core)`} />
      <circle r="76" fill={`url(#${id}-rim)`} />
      <ellipse cx="-20" cy="-26" rx="18" ry="10" fill="#fff" opacity="0.07" />
    </svg>
  );
}

export function HeroVisual() {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  useEffect(() => {
    const small = window.matchMedia("(max-width: 380px)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!hasWebGL() || small || conn?.saveData) return setMode("static");
    // Don't compete with the homepage intro for the main thread/GPU: start WebGL once it has
    // finished (it marks <html> with intro-skip), or immediately on pages without one.
    const root = document.documentElement;
    const ready = () => root.classList.contains("intro-skip") || !document.querySelector(".intro");
    if (ready()) return setMode("3d");
    const mo = new MutationObserver(() => ready() && (setMode("3d"), mo.disconnect()));
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return (
    <div className="relative h-full w-full">
      {/* Floor glow under the sculpture; pure CSS so it is there before any JS. */}
      <div aria-hidden className="absolute inset-x-[10%] bottom-[6%] h-[22%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(42_98_236/0.35),transparent)] blur-2xl" />
      {mode === "3d" ? <OrbitScene /> : <OrbitFallback />}
    </div>
  );
}
