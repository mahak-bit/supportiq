"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* The support orbit: an ink sphere (the customer's question) held by tilted rings of
   evidence. Beads travel the rings; one cobalt bead per ring marks a cited passage.
   Pointer/touch tilts the sculpture. Everything is procedural: no assets to download. */

const INK = new THREE.Color("#1f2442");
const COBALT = new THREE.Color("#2448d8");
const IVORY = new THREE.Color("#efe7d4");

const RINGS = [
  { r: 1.75, tilt: [0.95, 0.15, 0.2], speed: 0.16, beads: 7 },
  { r: 2.25, tilt: [1.35, -0.55, 0.0], speed: -0.11, beads: 9 },
  { r: 2.75, tilt: [0.55, 0.75, -0.35], speed: 0.07, beads: 11 },
] as const;

function Ring({ r, tilt, speed, beads, animate }: (typeof RINGS)[number] & { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const offsets = useMemo(() => Array.from({ length: beads }, (_, i) => (i / beads) * Math.PI * 2 + i * 0.13), [beads]);
  useFrame((_, dt) => {
    if (animate && group.current) group.current.rotation.z += speed * dt;
  });
  return (
    <group rotation={tilt as unknown as [number, number, number]}>
      <mesh>
        <torusGeometry args={[r, 0.006, 8, 220]} />
        <meshBasicMaterial color={COBALT} transparent opacity={0.45} />
      </mesh>
      <group ref={group}>
        {offsets.map((a, i) => {
          const cited = i === 0;
          return (
            <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
              <sphereGeometry args={[cited ? 0.085 : 0.05, 24, 24]} />
              <meshStandardMaterial color={cited ? COBALT : IVORY} roughness={0.35} metalness={cited ? 0.2 : 0} emissive={cited ? COBALT : INK} emissiveIntensity={cited ? 0.35 : 0} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Sculpture({ animate }: { animate: boolean }) {
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const { pointer, viewport } = useThree();
  const compact = viewport.width < 5;

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const tx = animate ? pointer.y * 0.28 : 0;
    const ty = animate ? pointer.x * 0.45 + state.clock.elapsedTime * 0.05 : 0.3;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tx, 3, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ty, 3, dt);
    if (core.current && animate) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.012;
      core.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={root} scale={compact ? 0.78 : 1}>
      <mesh ref={core}>
        <sphereGeometry args={[1.05, 96, 96]} />
        <meshPhysicalMaterial color={INK} roughness={0.28} metalness={0.15} clearcoat={1} clearcoatRoughness={0.18} />
      </mesh>
      {RINGS.map((ring, i) => (
        <Ring key={i} {...ring} animate={animate} />
      ))}
    </group>
  );
}

export default function OrbitScene() {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    // Stop rendering entirely while the hero is scrolled out of view.
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.01 });
    if (host.current) io.observe(host.current);
    return () => {
      mq.removeEventListener("change", onChange);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={host} className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 8.4], fov: 42 }}
        frameloop={!visible ? "never" : reduced ? "demand" : "always"}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        style={{ touchAction: "pan-y" }}
      >
        <ambientLight intensity={0.55} color="#fff4e2" />
        <directionalLight position={[4, 5, 6]} intensity={2.1} color="#fff1dc" />
        <directionalLight position={[-6, -2, -4]} intensity={1.4} color="#5b7bff" />
        <pointLight position={[0, 0, 3.5]} intensity={0.6} color="#ffffff" />
        <Sculpture animate={!reduced} />
      </Canvas>
    </div>
  );
}
