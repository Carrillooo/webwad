'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useAspect, useTexture } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { NovaState } from '@/lib/store';

const TEXTUREMAP = 'https://i.postimg.cc/XYwvXN8D/img-4.png';
const DEPTHMAP = 'https://i.postimg.cc/2SHKQh2q/raw-4.webp';
const WIDTH = 300;
const HEIGHT = 300;

type Props = {
  state: NovaState;
  level: number;
  onActivate: () => void;
  disabled?: boolean;
  title?: string;
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform vec2 uPointer;
  uniform float uProgress;
  uniform float uEnergy;
  uniform float uOpacity;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float depth = texture2D(uDepth, vUv).r;
    vec2 displacedUv = vUv + (depth - 0.5) * uPointer * 0.018;
    vec4 base = texture2D(uMap, displacedUv);

    vec2 gridUv = vUv * 120.0;
    vec2 cell = fract(gridUv) - 0.5;
    float dotMask = 1.0 - smoothstep(0.18, 0.29, length(cell));
    float noise = 0.35 + 0.65 * hash(floor(gridUv));
    float flow = 1.0 - smoothstep(0.0, 0.035, abs(depth - uProgress));

    vec3 redGlow = vec3(1.0, 0.035, 0.015) * dotMask * noise * flow * (0.45 + uEnergy * 1.15);
    vec3 color = 1.0 - (1.0 - base.rgb) * (1.0 - redGlow);

    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x)
               * smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);

    gl_FragColor = vec4(color, base.a * edge * uOpacity);
  }
`;

function ReactiveStone({ state, level }: Pick<Props, 'state' | 'level'>) {
  const [rawMap, depthMap] = useTexture([TEXTUREMAP, DEPTHMAP]);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const smoothEnergy = useRef(0.18);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (rawMap && depthMap) setVisible(true);
  }, [rawMap, depthMap]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: rawMap },
          uDepth: { value: depthMap },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uProgress: { value: 0.5 },
          uEnergy: { value: 0.18 },
          uOpacity: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      }),
    [rawMap, depthMap],
  );

  useEffect(() => () => material.dispose(), [material]);

  const [w, h] = useAspect(WIDTH, HEIGHT);

  useFrame(({ clock, pointer }, delta) => {
    const t = clock.getElapsedTime();
    const listening = state === 'listening' || state === 'transcribing';
    const thinking = state === 'thinking' || state === 'planning' || state === 'executing';
    const speaking = state === 'speaking';

    let targetEnergy = 0.18;
    if (listening) targetEnergy = 0.3 + Math.min(1, level) * 0.95;
    if (thinking) targetEnergy = 0.58 + Math.sin(t * 4.2) * 0.12;
    if (speaking) {
      targetEnergy = 0.58 + Math.abs(Math.sin(t * 8.5)) * 0.28 + Math.abs(Math.sin(t * 13.2)) * 0.12;
    }

    smoothEnergy.current = THREE.MathUtils.damp(smoothEnergy.current, targetEnergy, 8, delta);
    material.uniforms.uEnergy.value = smoothEnergy.current;
    material.uniforms.uPointer.value.set(pointer.x, pointer.y);
    material.uniforms.uOpacity.value = THREE.MathUtils.damp(
      material.uniforms.uOpacity.value,
      visible ? 1 : 0,
      7,
      delta,
    );

    if (listening) {
      material.uniforms.uProgress.value = THREE.MathUtils.clamp(0.5 + (level - 0.25) * 0.5, 0.08, 0.92);
    } else if (thinking) {
      material.uniforms.uProgress.value = Math.sin(t * 1.9) * 0.5 + 0.5;
    } else if (speaking) {
      material.uniforms.uProgress.value = Math.sin(t * 1.15 + Math.sin(t * 5) * 0.18) * 0.5 + 0.5;
    } else {
      material.uniforms.uProgress.value = Math.sin(t * 0.42) * 0.5 + 0.5;
    }

    if (meshRef.current) {
      const targetScale = 1 + smoothEnergy.current * (speaking || listening ? 0.07 : 0.025);
      const baseX = w * 0.42;
      const baseY = h * 0.42;
      meshRef.current.scale.x = THREE.MathUtils.damp(meshRef.current.scale.x, baseX * targetScale, 8, delta);
      meshRef.current.scale.y = THREE.MathUtils.damp(meshRef.current.scale.y, baseY * targetScale, 8, delta);
      meshRef.current.rotation.z = THREE.MathUtils.damp(
        meshRef.current.rotation.z,
        pointer.x * 0.025,
        5,
        delta,
      );
    }
  });

  return (
    <mesh ref={meshRef} scale={[w * 0.42, h * 0.42, 1]} material={material}>
      <planeGeometry args={[1, 1, 1, 1]} />
    </mesh>
  );
}

export function FuturisticVoiceCore({ state, level, onActivate, disabled, title }: Props) {
  const active = state !== 'idle';

  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={disabled}
      title={title}
      aria-label={state === 'speaking' ? 'Detener voz de ZERO' : 'Hablar con ZERO'}
      aria-pressed={state === 'listening' || state === 'transcribing'}
      className="relative block h-[168px] w-[240px] overflow-visible rounded-[28px] disabled:opacity-60"
      style={{
        background: 'radial-gradient(circle at 50% 52%, rgb(var(--nova-primary) / 0.12), transparent 62%)',
        filter: active ? 'drop-shadow(0 0 24px rgb(var(--nova-primary) / 0.35))' : undefined,
      }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/10 bg-black/10 backdrop-blur-[2px]" />
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <Canvas
          flat
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <ReactiveStone state={state} level={level} />
        </Canvas>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ boxShadow: `0 0 ${active ? 62 : 32}px rgb(var(--nova-primary) / ${active ? 0.32 : 0.16})` }}
      />
    </button>
  );
}

export default FuturisticVoiceCore;
