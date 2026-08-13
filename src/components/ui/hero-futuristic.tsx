'use client';

import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useAspect, useTexture } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import {
  abs,
  blendScreen,
  float,
  mod,
  mx_cell_noise_float,
  oneMinus,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';

import type { NovaState } from '@/lib/store';

const TEXTUREMAP = 'https://i.postimg.cc/XYwvXN8D/img-4.png';
const DEPTHMAP = 'https://i.postimg.cc/2SHKQh2q/raw-4.webp';
const WIDTH = 300;
const HEIGHT = 300;

extend(THREE as never);

type Props = {
  state: NovaState;
  level: number;
  onActivate: () => void;
  disabled?: boolean;
  title?: string;
};

function ReactiveStone({ state, level }: Pick<Props, 'state' | 'level'>) {
  const [rawMap, depthMap] = useTexture([TEXTUREMAP, DEPTHMAP]);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [visible, setVisible] = useState(false);
  const smoothLevel = useRef(0);

  useEffect(() => {
    if (rawMap && depthMap) setVisible(true);
  }, [rawMap, depthMap]);

  const { material, uniforms } = useMemo(() => {
    const uPointer = uniform(new THREE.Vector2(0));
    const uProgress = uniform(0.5);
    const uEnergy = uniform(0.2);

    const depth = texture(depthMap);
    const displaced = texture(rawMap, uv().add(depth.r.mul(uPointer).mul(0.012)));

    const aspect = float(WIDTH).div(HEIGHT);
    const tUv = vec2(uv().x.mul(aspect), uv().y);
    const tiling = vec2(120.0);
    const tiledUv = mod(tUv.mul(tiling), 2.0).sub(1.0);
    const brightness = mx_cell_noise_float(tUv.mul(tiling).div(2));
    const dist = float(tiledUv.length());
    const dots = float(smoothstep(0.5, 0.49, dist)).mul(brightness);
    const flow = oneMinus(smoothstep(0, 0.025, abs(depth.sub(uProgress))));

    // Keep the original red holographic identity, but let voice energy drive it.
    const mask = dots.mul(flow).mul(vec3(10, 0.15, 0.08)).mul(uEnergy.add(0.35));
    const final = blendScreen(displaced, mask);

    const nodeMaterial = new THREE.MeshBasicNodeMaterial({
      colorNode: final,
      transparent: true,
      opacity: 0,
    });

    return { material: nodeMaterial, uniforms: { uPointer, uProgress, uEnergy } };
  }, [rawMap, depthMap]);

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
      // SpeechSynthesis does not expose its output stream to Web Audio, so this
      // follows the actual speaking state with layered speech-like pulses.
      targetEnergy = 0.58 + Math.abs(Math.sin(t * 8.5)) * 0.28 + Math.abs(Math.sin(t * 13.2)) * 0.12;
    }

    smoothLevel.current = THREE.MathUtils.damp(smoothLevel.current, targetEnergy, 8, delta);
    uniforms.uEnergy.value = smoothLevel.current;

    if (listening) {
      uniforms.uProgress.value = THREE.MathUtils.clamp(0.5 + (level - 0.25) * 0.5, 0.08, 0.92);
    } else if (thinking) {
      uniforms.uProgress.value = Math.sin(t * 1.9) * 0.5 + 0.5;
    } else if (speaking) {
      uniforms.uProgress.value = Math.sin(t * 1.15 + Math.sin(t * 5) * 0.18) * 0.5 + 0.5;
    } else {
      uniforms.uProgress.value = Math.sin(t * 0.42) * 0.5 + 0.5;
    }

    uniforms.uPointer.value = pointer;

    if (meshRef.current) {
      const targetScale = 1 + smoothLevel.current * (speaking || listening ? 0.07 : 0.025);
      const baseX = w * 0.42;
      const baseY = h * 0.42;
      meshRef.current.scale.x = THREE.MathUtils.damp(meshRef.current.scale.x, baseX * targetScale, 8, delta);
      meshRef.current.scale.y = THREE.MathUtils.damp(meshRef.current.scale.y, baseY * targetScale, 8, delta);

      const mat = meshRef.current.material as THREE.MeshBasicNodeMaterial;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, visible ? 1 : 0, 7, delta);
    }
  });

  return (
    <mesh ref={meshRef} scale={[w * 0.42, h * 0.42, 1]} material={material}>
      <planeGeometry />
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
          gl={async (props) => {
            const renderer = new THREE.WebGPURenderer(props as never);
            await renderer.init();
            renderer.setClearColor(0x000000, 0);
            return renderer;
          }}
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
