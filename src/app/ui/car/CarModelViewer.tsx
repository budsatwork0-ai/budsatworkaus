'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import type { ThreeEvent } from '@react-three/fiber';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { CarType, CarZone } from './useCarModelSelector';
import { blendTextures, mapZoneHit } from './helpers';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

type CarModelViewerProps = {
  carType: CarType;
  dirtLevel: number; // 0 clean -> 1 dirty
  onZoneSelect?: (zone: CarZone) => void;
  glbByType: Record<CarType, string>; // urls to your GLB/GLTF per type
  cleanTextureUrl: string;
  dirtyTextureUrl: string;
  initialCamera?: { fov?: number; position?: [number, number, number] };
};

const LoaderOverlay = () => (
  <Html center>
    <div
      className="rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
      style={{ background: '#14532d', color: '#fff' }}
    >
      Loading 3D model…
    </div>
  </Html>
);

function Model({
  url,
  cleanTex,
  dirtyTex,
  dirtLevel,
  onZoneSelect,
  onLoaded,
  rotationOverride,
}: {
  url: string;
  cleanTex: THREE.Texture;
  dirtyTex: THREE.Texture;
  dirtLevel: number;
  onZoneSelect?: (zone: CarZone) => void;
  onLoaded?: (root: THREE.Group) => void;
  rotationOverride?: number;
}) {
  const { scene } = useGLTF(url);
  const tempMat = useMemo(() => new THREE.MeshStandardMaterial(), []);
  const rootRef = useRef<THREE.Group>(null!);
  const meshRefs = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    meshRefs.current = [];
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      meshRefs.current.push(child);
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const root = rootRef.current;
    // Reset wrapper transform so switching car types doesn't inherit the previous model's view.
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.setScalar(1);

    if (typeof rotationOverride === 'number') {
      root.rotation.y = rotationOverride;
    }

    // Normalize each model to a similar visual size so the camera fit is consistent.
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (isFinite(sphere.radius) && sphere.radius > 0) {
      const targetRadius = 3;
      const factor = THREE.MathUtils.clamp(targetRadius / sphere.radius, 0.3, 18);
      root.scale.setScalar(factor);
      root.updateWorldMatrix(true, true);
    }

    onLoaded?.(root);
  }, [scene, onLoaded, rotationOverride]);

  useEffect(() => {
    if (!meshRefs.current.length) return;
    meshRefs.current.forEach((mesh) => {
      const mat = mesh.material;
      if (Array.isArray(mat)) return;
      if (!(mat instanceof THREE.MeshStandardMaterial)) return;
      blendTextures(cleanTex, dirtyTex, dirtLevel, mat, tempMat);
    });
  }, [cleanTex, dirtyTex, dirtLevel, tempMat]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onZoneSelect) return;
    event.stopPropagation();
    const zone = mapZoneHit(event.object?.name || '');
    if (zone) onZoneSelect(zone);
  };

  return (
    <group ref={rootRef} onClick={onZoneSelect ? handleClick : undefined}>
      <primitive object={scene} />
    </group>
  );
}

export default function CarModelViewer({
  carType,
  dirtLevel,
  onZoneSelect,
  glbByType,
  cleanTextureUrl,
  dirtyTextureUrl,
  initialCamera,
}: CarModelViewerProps) {
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const fitDistanceRef = useRef<number>(5);
  const defaultYaw = useRef(-Math.PI / 4); // consistent front-left angle
  const fittedTypes = useRef<Set<CarType>>(new Set());
  const lastFitCenter = useRef<THREE.Vector3 | null>(null);
  const lastFitOffset = useRef<THREE.Vector3 | null>(null);
  const modelUrl = glbByType[carType];
  const dirt = Math.max(0, Math.min(1, dirtLevel));

  // Preload all car models on mount for instant switching
  useEffect(() => {
    Object.values(glbByType).forEach((url) => {
      if (url) useGLTF.preload(url);
    });
  }, [glbByType]);
  // Force a uniform orientation for all models
  const rotationOverrides: Partial<Record<CarType, number>> = {
    hatch: defaultYaw.current,
    sedan: defaultYaw.current,
    suv: defaultYaw.current,
    ute: defaultYaw.current + Math.PI,
    van: defaultYaw.current,
    '4wd': defaultYaw.current,
    luxury: defaultYaw.current,
    muscle: defaultYaw.current,
  };

  const fitCameraToModel = useCallback(
    (root: THREE.Object3D, attempt = 0) => {
      const camera = cameraRef.current as THREE.PerspectiveCamera | null;
      if (!camera || !root) {
        if (attempt < 3) {
          setTimeout(() => fitCameraToModel(root, attempt + 1), 40);
        }
        return;
      }
      const box = new THREE.Box3().setFromObject(root);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const center = sphere.center ?? new THREE.Vector3(0, 0, 0);
      const radius = isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 2.5;
      const typeFactor = carType === 'hatch' ? 0.7 : 1;
      const dist = THREE.MathUtils.clamp(radius * 1.8 * typeFactor, 2.0, 8);
      const dir = new THREE.Vector3(1, 0.35, 1).normalize();
      const offset = dir.clone().multiplyScalar(dist);
      camera.position.copy(center).add(offset);
      camera.near = Math.max(0.1, dist / 40);
      camera.far = dist * 20;
      camera.updateProjectionMatrix();
      camera.lookAt(center);
      controlsRef.current?.target.copy(center);
      controlsRef.current?.update();
      fitDistanceRef.current = dist;
      lastFitCenter.current = center.clone();
      lastFitOffset.current = offset.clone();
    },
    [carType]
  );

  const adjustCameraDistance = (dir: 'in' | 'out') => {
    const camera = cameraRef.current;
    if (!camera) return;
    const target = controlsRef.current?.target || new THREE.Vector3();
    const offset = camera.position.clone().sub(target);
    const baseDist = fitDistanceRef.current || offset.length() || 5;
    const minDist = 0.25;
    const maxDist = Math.max(minDist + 0.5, baseDist * 5);
    const factor = dir === 'in' ? 0.85 : 1.15;
    const next = offset.multiplyScalar(factor).clampLength(minDist, maxDist);
    camera.position.copy(target.clone().add(next));
    camera.lookAt(target);
    controlsRef.current?.update();
    camera.updateMatrixWorld();
  };

  const resetCamera = () => {
    const camera = cameraRef.current as THREE.PerspectiveCamera | null;
    const center = lastFitCenter.current;
    const offset = lastFitOffset.current;
    if (!camera || !center || !offset) return;
    camera.position.copy(center.clone().add(offset));
    camera.lookAt(center);
    controlsRef.current?.target.copy(center);
    controlsRef.current?.update();
    camera.updateMatrixWorld();
  };

  const Inner = () => {
    const fallback =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
    const useFallback = !cleanTextureUrl || !dirtyTextureUrl;
    const cleanTex = useTexture(useFallback ? fallback : (cleanTextureUrl as string));
    const dirtyTex = useTexture(useFallback ? fallback : (dirtyTextureUrl as string));
    cleanTex.flipY = dirtyTex.flipY = false;
    const { camera } = useThree();
    useEffect(() => {
      cameraRef.current = camera;
    }, [camera]);
    return (
      <Suspense fallback={<LoaderOverlay />}>
        <Model
          url={modelUrl}
          cleanTex={cleanTex}
          dirtyTex={dirtyTex}
          dirtLevel={dirtLevel}
          onZoneSelect={onZoneSelect}
          onLoaded={(root) => {
            if (!fittedTypes.current.has(carType)) {
              fitCameraToModel(root);
              fittedTypes.current.add(carType);
            }
          }}
          rotationOverride={rotationOverrides[carType]}
        />
      </Suspense>
    );
  };

  if (!modelUrl) {
    return (
      <div className="w-full h-[400px] rounded-2xl border border-dashed border-amber-300 bg-white/80 text-sm text-amber-700 grid place-items-center overflow-hidden">
        <div className="w-full h-full grid place-items-center p-6">
          <div className="relative w-full h-full max-w-[520px]">
            <Image
              src="/car-fallback.svg"
              alt="Car preview"
              fill
              sizes="(max-width: 768px) 90vw, 520px"
              style={{ objectFit: 'contain' }}
              priority={false}
            />
          </div>
          <div className="mt-3 text-center">
            3D model not found for {carType}. Add a GLB path in glbByType to enable the viewer.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-black/10 bg-gradient-to-b from-slate-50 to-slate-200">
      <Canvas
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#000'), 0);
        }}
        camera={{
          fov: initialCamera?.fov ?? 45,
          position: initialCamera?.position ?? [8, 5, 10],
          near: 0.1,
          far: 600,
        }}
        dpr={[1, 1.2]}
        gl={{
          alpha: true,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
          antialias: true,
        }}
      >
        <ambientLight intensity={0.65} />
        <hemisphereLight intensity={0.45} groundColor="#555" color="#fff" />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <Environment preset="city" background={false} resolution={128} />
        <Inner />
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.08}
          minDistance={0.2}
          maxDistance={50}
          zoomSpeed={0.3}
        />
      </Canvas>
      {/* Dirt overlays (visual-only): subtle darkening on lower panels, wheels, and rear. */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            opacity: dirt * 0.22,
            background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
            mixBlendMode: 'multiply',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            opacity: dirt * 0.32,
            background:
              'radial-gradient(circle at 22% 90%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 58%), radial-gradient(circle at 78% 90%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 58%)',
            mixBlendMode: 'multiply',
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[55%]"
          style={{
            opacity: dirt * 0.18,
            background: 'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
            mixBlendMode: 'multiply',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-4 right-4 flex flex-col gap-2 rounded-lg p-2 shadow-lg"
        style={{ background: '#14532d', color: '#fff' }}
      >
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-white/30 px-3 py-1 text-xs font-semibold tracking-wide shadow-sm transition hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
          onClick={() => adjustCameraDistance('in')}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-white/30 px-3 py-1 text-xs font-semibold tracking-wide shadow-sm transition hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
          onClick={() => adjustCameraDistance('out')}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-white/30 px-3 py-1 text-xs font-semibold tracking-wide shadow-sm transition hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
          onClick={resetCamera}
          aria-label="Reset view"
        >
          ⟳
        </button>
      </div>
    </div>
  );
}
