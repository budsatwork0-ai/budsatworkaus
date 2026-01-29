import * as THREE from 'three';
import { CarZone } from './useCarModelSelector';

type ShaderLike = {
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
};

type DirtyBlendUserData = {
  shader?: ShaderLike;
  shaderSetup?: boolean;
  baseMap?: THREE.Texture;
};

export function blendTextures(
  clean: THREE.Texture,
  dirty: THREE.Texture,
  t: number,
  target: THREE.MeshStandardMaterial,
  temp: THREE.MeshStandardMaterial
) {
  const userData = target.userData as DirtyBlendUserData & Record<string, unknown>;
  const isPlaceholder = (tex: THREE.Texture) => {
    const img: any = tex?.image;
    return !img || ((img.width ?? 0) <= 1 && (img.height ?? 0) <= 1);
  };

  // If no dirt effect is desired or textures are placeholders, leave the original material untouched.
  if (t <= 0 || isPlaceholder(clean) || isPlaceholder(dirty)) {
    return;
  }

  if (!userData.baseMap) {
    // Only overlay when the material has a real base map; otherwise skip to avoid UV artifacts.
    const base = target.map as THREE.Texture | null;
    if (!base || isPlaceholder(base)) return;
    userData.baseMap = base;
  }

  target.map = temp.map = userData.baseMap;
  target.userData.dirtyMap = dirty;
  target.needsUpdate = true;

  if (!userData.shaderSetup) {
    target.onBeforeCompile = (shader) => {
      const shaderLike = shader as unknown as ShaderLike;
      shader.fragmentShader = `uniform sampler2D dirtyMap;
uniform float mixVal;
${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        vec4 dirtyColor = texture2D( dirtyMap, vMapUv );
        dirtyColor = mapTexelToLinear( dirtyColor );
        float blendAmount = mixVal * 0.35; // cap dirt influence to keep base paint visible
        diffuseColor = mix( diffuseColor, dirtyColor, blendAmount );
      `
      );
      shaderLike.uniforms.dirtyMap = { value: dirty };
      shaderLike.uniforms.mixVal = { value: t };
      userData.shader = shaderLike;
      userData.shaderSetup = true;
    };
  }

  const shader = userData.shader;
  if (shader) {
    shader.uniforms.dirtyMap.value = dirty;
    shader.uniforms.mixVal.value = t;
  }

  target.userData.dirtyMap = dirty;
}

export function mapZoneHit(name: string): CarZone | null {
  const n = name.toLowerCase();
  if (n.includes('hood')) return 'hood';
  if (n.includes('roof')) return 'roof';
  if (n.includes('wheel')) return 'wheels';
  if (n.includes('glass') || n.includes('window')) return 'glass';
  if (n.includes('boot') || n.includes('trunk')) return 'boot';
  if (n.includes('interior') || n.includes('seat')) return 'interior';
  return null;
}
