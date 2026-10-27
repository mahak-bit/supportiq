"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* The support orbit: a dark glass core (the customer's question) held by tilted rings of
   evidence. Beads travel the rings; one cyan bead per ring marks a cited passage.
   Pointer/touch tilts the sculpture. Everything is procedural: no assets to download. */

const CORE = new THREE.Color("#0c1428");
const ACCENT = new THREE.Color("#5b8cff");
const CYAN = new THREE.Color("#3fd2ee");
const BEAD = new THREE.Color("#7f9ad6");

const RINGS = [
  { r: 1.75, tilt: [0.95, 0.15, 0.2], speed: 0.16, beads: 7 },
  { r: 2.25, tilt: [1.35, -0.55, 0.0], speed: -0.11, beads: 9 },
  { r: 2.75, tilt: [0.55, 0.75, -0.35], speed: 0.07, beads: 11 },
] as const;

// Fresnel rim: brightest where the surface turns away from the camera, like light wrapping glass.
const rimMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: ACCENT }, uPower: { value: 2.6 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uPower;
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        float f = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);
        gl_FragColor = vec4(uColor * f * 1.6, f);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

function Ring({ r, tilt, speed, beads, animate }: (typeof RINGS)[number] & { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const offsets = useMemo(() => Array.from({ length: beads }, (_, i) => (i / beads) * Math.PI * 2 + i * 0.13), [beads]);
  useFrame((_, dt) => {
    if (animate && group.current) group.current.rotation.z += speed * dt;
  });
  return (
    <group rotation={tilt as unknown as [number, number, number]}>
      <mesh>
        <torusGeometry args={[r, 0.007, 8, 240]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <group ref={group}>
        {offsets.map((a, i) => {
          const cited = i === 0;
          return (
            <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
              <sphereGeometry args={[cited ? 0.085 : 0.045, 20, 20]} />
              <meshBasicMaterial color={cited ? CYAN : BEAD} toneMapped={false} transparent opacity={cited ? 1 : 0.8} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Dust({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Deterministic spread so server and client agree and nothing reshuffles on re-render.
      const t = i * 2.399963;
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(1 - y * y) * (3.4 + ((i * 37) % 17) / 10);
      pos.set([Math.cos(t) * rad, y * 3.2, Math.sin(t) * rad], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (animate && ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.02} color="#9db8ff" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Sculpture({ animate }: { animate: boolean }) {
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const rim = useMemo(rimMaterial, []);
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
        <meshPhysicalMaterial color={CORE} roughness={0.22} metalness={0.35} clearcoat={1} clearcoatRoughness={0.12} emissive={ACCENT} emissiveIntensity={0.06} />
      </mesh>
      <mesh scale={1.14} material={rim}>
        <sphereGeometry args={[1.05, 64, 64]} />
      </mesh>
      {RINGS.map((ring, i) => (
        <Ring key={i} {...ring} animate={animate} />
      ))}
      <Dust animate={animate} />
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
        <ambientLight intensity={0.25} color="#9db8ff" />
        <directionalLight position={[4, 5, 6]} intensity={1.6} color="#dbe6ff" />
        <directionalLight position={[-6, -2, -4]} intensity={2.2} color="#2a62ec" />
        <pointLight position={[0, 0, 3.5]} intensity={0.8} color="#3fd2ee" />
        <Sculpture animate={!reduced} />
      </Canvas>
    </div>
  );
}
