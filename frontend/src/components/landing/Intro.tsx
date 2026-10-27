"use client";

import { useAnimate, type AnimationSequence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrbitMark } from "@/components/ui";

/* Cinematic homepage intro: brand emerges from black, a pair of architectural doors opens
   onto electric-blue light, and the camera pushes through into the page.

   Guarantees:
   - Shown once per browser session, on the homepage only (see BOOT in app/layout.tsx).
   - Never shown with prefers-reduced-motion.
   - Phones, low-core devices and Save-Data get a flat, shorter version.
   - Skip button, Escape, scrolling or swiping ends it immediately.
   - If JavaScript never runs, a CSS failsafe removes the overlay (globals.css). */

const SEEN_KEY = "siq-intro-seen";
const EASE_DOOR = [0.65, 0, 0.25, 1] as const;
const EASE_PUSH = [0.7, 0, 0.84, 0] as const;
const NAV_KEYS = [" ", "Enter", "ArrowDown", "PageDown", "End"];

type Phase = "pending" | "playing" | "done";

function fullSequence(): AnimationSequence {
  return [
    [".i-brand", { opacity: [0, 1], filter: ["blur(12px)", "blur(0px)"], y: [14, 0] }, { duration: 1, at: 0.15, ease: "easeOut" }],
    [".i-env", { opacity: [0, 1] }, { duration: 0.9, at: 0.55 }],
    [".i-seam", { opacity: [0, 1], scaleY: [0.15, 1] }, { duration: 0.6, at: 1.05, ease: "easeOut" }],
    [".i-left", { rotateY: [0, -86] }, { duration: 1.45, at: 1.55, ease: EASE_DOOR }],
    [".i-seam", { opacity: 0 }, { duration: 0.5, at: 1.65 }],
    [".i-right", { rotateY: [0, 86] }, { duration: 1.45, at: 1.55, ease: EASE_DOOR }],
    [".i-shade", { opacity: [0, 0.8] }, { duration: 1.45, at: 1.55, ease: EASE_DOOR }],
    [".i-light", { opacity: [0, 1] }, { duration: 1.1, at: 1.6 }],
    [".i-bloom", { opacity: [0, 1], scale: [0.5, 1.35] }, { duration: 1.5, at: 1.6, ease: "easeOut" }],
    [".i-spill", { opacity: [0, 1], scaleX: [0.1, 1] }, { duration: 1.3, at: 1.7, ease: "easeOut" }],
    [".i-brand", { opacity: 0, y: -16 }, { duration: 0.5, at: 2.35 }],
    [".i-stage", { scale: [1, 4.2] }, { duration: 1.05, at: 2.55, ease: EASE_PUSH }],
    [".i-root", { opacity: [1, 0] }, { duration: 0.65, at: 3.05, ease: "easeOut" }],
  ];
}

function liteSequence(): AnimationSequence {
  return [
    [".i-brand", { opacity: [0, 1], y: [10, 0] }, { duration: 0.7, at: 0.1, ease: "easeOut" }],
    [".i-env", { opacity: [0, 1] }, { duration: 0.6, at: 0.35 }],
    [".i-seam", { opacity: [0, 1], scaleY: [0.2, 1] }, { duration: 0.45, at: 0.75 }],
    [".i-left", { x: ["0%", "-102%"] }, { duration: 0.9, at: 1.1, ease: EASE_DOOR }],
    [".i-seam", { opacity: 0 }, { duration: 0.35, at: 1.15 }],
    [".i-right", { x: ["0%", "102%"] }, { duration: 0.9, at: 1.1, ease: EASE_DOOR }],
    [".i-light", { opacity: [0, 1] }, { duration: 0.7, at: 1.15 }],
    [".i-bloom", { opacity: [0, 1], scale: [0.6, 1.2] }, { duration: 0.9, at: 1.15 }],
    [".i-brand", { opacity: 0 }, { duration: 0.35, at: 1.6 }],
    [".i-root", { opacity: [1, 0] }, { duration: 0.5, at: 1.85, ease: "easeOut" }],
  ];
}

function prefersLite(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return (
    window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ||
    (navigator.hardwareConcurrency ?? 8) <= 4 ||
    Boolean(conn?.saveData) ||
    !CSS.supports("transform-style", "preserve-3d")
  );
}

export function Intro() {
  const [phase, setPhase] = useState<Phase>("pending");
  const [lite, setLite] = useState(false);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const controls = useRef<{ stop: () => void } | null>(null);

  const finish = useCallback(() => {
    document.documentElement.classList.add("intro-skip");
    setPhase("done");
  }, []);

  const skip = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
    if (!scope.current) return finish();
    void animate(scope.current, { opacity: 0 }, { duration: 0.3 }).then(finish);
  }, [animate, finish, scope]);

  // Decide whether to play at all.
  useEffect(() => {
    const root = document.documentElement;
    let seen = false;
    try {
      seen = Boolean(sessionStorage.getItem(SEEN_KEY));
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      seen = true; // Storage blocked: play nothing rather than replay on every visit.
    }
    if (root.classList.contains("intro-skip") || seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setLite(prefersLite());
    setPhase("playing");
  }, [finish]);

  // Run the timeline.
  useEffect(() => {
    if (phase !== "playing") return;
    const c = animate(lite ? liteSequence() : fullSequence());
    controls.current = c;
    void c.then(() => {
      if (controls.current === c) finish();
    });
    return () => c.stop();
  }, [phase, lite, animate, finish]);

  // Any attempt to use the page ends the intro.
  useEffect(() => {
    if (phase !== "playing") return;
    // Space/Enter on the Skip button already click it, so only treat them as navigation elsewhere.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (NAV_KEYS.includes(e.key) && !(e.target instanceof HTMLButtonElement))) skip();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
    };
  }, [phase, skip]);

  if (phase === "done") return null;

  return (
    <div ref={scope} className="intro fixed inset-0 z-[100]">
      <div className="i-root absolute inset-0 overflow-hidden bg-[#02040a]">
        <div aria-hidden className="absolute inset-0 grid place-items-center [perspective:650px] [perspective-origin:50%_46%]">
          <div className="i-stage relative flex flex-col items-center [transform-origin:50%_62%] [transform-style:preserve-3d]">
            {/* Brand, emerging above the portal like a lit sign over an entrance. */}
            <div className="i-brand mb-[clamp(1.25rem,4vh,2.5rem)] flex items-center gap-3 opacity-0">
              <OrbitMark size={34} />
              <span className="font-display text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)] font-semibold tracking-[-0.035em] text-fg [text-shadow:0_0_28px_rgb(91_140_255/0.55)]">
                Support<span className="text-accent">IQ</span>
              </span>
            </div>

            <div className="i-env relative opacity-0 [--h:min(54vh,440px)] [--leaf:calc(var(--h)*0.33)] [transform-style:preserve-3d]">
              {/* Bloom escaping around the frame once the doors part. */}
              <div className="i-bloom pointer-events-none absolute top-1/2 left-1/2 size-[calc(var(--h)*1.9)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(91_140_255/0.55),rgb(42_98_236/0.18)_55%,transparent)] opacity-0 blur-xl" />

              {/* Frame: jambs and a deeper lintel give the opening architectural weight. */}
              <div className="relative rounded-t-[6px] bg-[linear-gradient(180deg,#1c2640,#0d1324)] [transform-style:preserve-3d] p-[calc(var(--h)*0.035)] pt-[calc(var(--h)*0.06)] shadow-[0_40px_80px_-30px_#000,inset_0_1px_0_rgb(170_196_255/0.18),inset_0_0_0_1px_rgb(170_196_255/0.06)]">
                <div aria-hidden className="absolute inset-x-[18%] top-[calc(var(--h)*0.025)] h-px bg-[linear-gradient(90deg,transparent,#5b8cff,transparent)] opacity-70" />
                <div className="relative h-[var(--h)] w-[calc(var(--leaf)*2)] overflow-visible bg-[#03050b] shadow-[inset_0_10px_30px_#000] [transform-style:preserve-3d]">
                  {/* The light behind the doors. */}
                  <div className="i-light absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_55%,#ffffff_0%,#cfe0ff_14%,#5b8cff_42%,#1a3aa0_72%,#0a1638_100%)] opacity-0" />
                  <div className="i-seam absolute inset-y-[3%] left-[calc(50%-1px)] w-[2px] [transform:translateZ(2px)] bg-[linear-gradient(180deg,transparent,#cfe9ff_20%,#ffffff_50%,#cfe9ff_80%,transparent)] opacity-0 shadow-[0_0_18px_4px_rgb(63_210_238/0.55)]" />
                  {/* Doors sit 1px in front of the light so the two layers never share a plane. */}
                  <div className="absolute inset-0 [transform:translateZ(1px)] [transform-style:preserve-3d]">
                    <DoorLeaf side="left" />
                    <DoorLeaf side="right" />
                  </div>
                </div>
              </div>

              {/* Floor: reflective plane with the light spilling out of the doorway. */}
              <div className="absolute top-full left-1/2 h-[calc(var(--h)*0.9)] w-[calc(var(--h)*2.6)] -translate-x-1/2 [transform-origin:50%_0] [transform:rotateX(78deg)]">
                <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgb(42_98_236/0.16),transparent_70%)]" />
                <div className="i-spill absolute top-0 left-1/2 h-full w-[calc(var(--leaf)*4.2)] -translate-x-1/2 bg-[linear-gradient(180deg,rgb(207_224_255/0.75),rgb(91_140_255/0.3)_40%,transparent_85%)] opacity-0 [clip-path:polygon(30%_0,70%_0,100%_100%,0_100%)] [transform-origin:50%_0]" />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={skip}
          className="glass absolute top-4 right-4 z-10 inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] font-medium text-fg transition-colors hover:border-accent/60 sm:top-6 sm:right-6"
        >
          Skip intro <span className="hidden rounded border border-line-strong px-1 text-[11px] text-fg-faint sm:inline">Esc</span>
        </button>
      </div>
    </div>
  );
}

function DoorLeaf({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <div
      className={`${left ? "i-left left-0 [transform-origin:0_50%]" : "i-right right-0 [transform-origin:100%_50%]"} absolute top-0 h-full w-[var(--leaf)] [transform-style:preserve-3d]`}
    >
      {/* Front face */}
      <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#1d2744_0%,#111a31_45%,#0a1122_100%)] shadow-[inset_0_0_0_1px_rgb(170_196_255/0.07)]">
        {/* Recessed panels */}
        <div className="absolute inset-x-[16%] top-[7%] h-[38%] rounded-[2px] shadow-[inset_0_3px_10px_rgb(0_0_0/0.75),inset_0_-1px_0_rgb(170_196_255/0.1)] ring-1 ring-white/[0.04]" />
        <div className="absolute inset-x-[16%] top-[51%] h-[42%] rounded-[2px] shadow-[inset_0_3px_10px_rgb(0_0_0/0.75),inset_0_-1px_0_rgb(170_196_255/0.1)] ring-1 ring-white/[0.04]" />
        {/* Sheen from the key light */}
        <div className={`absolute inset-0 ${left ? "bg-[linear-gradient(115deg,rgb(170_196_255/0.10),transparent_45%)]" : "bg-[linear-gradient(245deg,rgb(170_196_255/0.06),transparent_45%)]"}`} />
        {/* Light leaking along the meeting edge */}
        <div className={`absolute inset-y-0 w-[3px] ${left ? "right-0" : "left-0"} bg-[linear-gradient(180deg,transparent,rgb(91_140_255/0.5),transparent)]`} />
        {/* Handle */}
        <div className={`absolute top-[44%] h-[18%] w-[5px] rounded-full ${left ? "right-[9%]" : "left-[9%]"} bg-[linear-gradient(90deg,#5b6a90,#dfe8ff_45%,#6c7aa0)] shadow-[0_6px_10px_rgb(0_0_0/0.6)]`} />
        {/* Darkens as the leaf turns away from the light */}
        <div className="i-shade absolute inset-0 bg-black opacity-0" />
      </div>
      {/* Thickness: the inner edge, lit by the light behind as it swings into view. */}
      <div
        className={`absolute top-0 h-full w-[14px] ${left ? "right-0 [transform-origin:100%_50%] [transform:rotateY(-90deg)]" : "left-0 [transform-origin:0_50%] [transform:rotateY(90deg)]"} bg-[linear-gradient(180deg,#7da2ff,#3d66d8_50%,#1b2f6e)]`}
      />
    </div>
  );
}
