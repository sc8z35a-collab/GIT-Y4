import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const baseCache = new Map();
const normalBaseCache = new Map();
const materialCache = new Map();

// Surfaces that receive synthesized micro-surface Sobel Normal Maps for real dark-room flashlight & lantern specular relief!
const NORMAL_STRENGTH = {
  wood_floor: 1.35,
  wood_slats: 2.2,
  tile_caramel_brick: 2.4,
  tatami: 1.75,
  yakisugi_dark: 2.5,
  terrazzo_white: 0.9,
  plaster_beige: 1.4,
  shikkui_white: 1.4,
  tile_blue_bath: 1.8,
  tile_white_small: 1.8,
  tile_beige_grid: 1.5,
  tile_grey_stone: 1.6,
  tile_mosaic_mint: 2.0,
  wainscot_wood: 1.6,
  wood_deck: 2.1,
  fabric_grey_sofa: 1.5,
  carpet_beige: 1.6,
  paver_red_brick: 2.3,
  green_wall: 2.0,
  wood_lattice_dark: 1.9,
};

// Synthesize a tangent-space normal map on an offscreen 256×256 canvas via Sobel luminance gradients
function buildNormalFromImage(img, strength = 1.5) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const src = ctx.getImageData(0, 0, size, size).data;
  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    lum[i] = (0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2]) / 255.0;
  }

  const out = ctx.createImageData(size, size);
  const d = out.data;
  const mask = size - 1;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1) & mask;
    const yp = (y + 1) & mask;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;
      const tl = lum[ym * size + xm], tc = lum[ym * size + x], tr = lum[ym * size + xp];
      const ml = lum[y * size + xm],                            mr = lum[y * size + xp];
      const bl = lum[yp * size + xm], bc = lum[yp * size + x], br = lum[yp * size + xp];
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
      let nx = -gx * strength;
      let ny = -gy * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen; ny *= invLen; nz *= invLen;
      const idx = (y * size + x) * 4;
      d[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const nTex = new THREE.CanvasTexture(c);
  nTex.colorSpace = THREE.NoColorSpace;
  nTex.wrapS = THREE.RepeatWrapping;
  nTex.wrapT = THREE.RepeatWrapping;
  nTex.minFilter = THREE.LinearMipmapLinearFilter;
  nTex.anisotropy = 4; // Adreno 825 sweet-spot
  nTex.needsUpdate = true;
  return nTex;
}

const pendingNormalCallbacks = new Map();

function ensureBaseTextures(name) {
  let base = baseCache.get(name);
  if (!base) {
    const url = `./textures/${name}.png`;
    base = loader.load(url, (loadedTex) => {
      if (NORMAL_STRENGTH[name] && loadedTex.image) {
        const nBase = buildNormalFromImage(loadedTex.image, NORMAL_STRENGTH[name]);
        normalBaseCache.set(name, nBase);
        const cbs = pendingNormalCallbacks.get(name);
        if (cbs) {
          cbs.forEach((cb) => cb(nBase));
          pendingNormalCallbacks.delete(name);
        }
      }
    });
    base.colorSpace = THREE.SRGBColorSpace;
    base.minFilter = THREE.LinearMipmapLinearFilter;
    base.anisotropy = 4;
    baseCache.set(name, base);
  }
  return base;
}

export function loadTex(name, repeatX = 1, repeatY = 1, options = {}) {
  const base = ensureBaseTextures(name);
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  const wrap = options.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatX, repeatY);
  if (options.rotation) {
    tex.center.set(0.5, 0.5);
    tex.rotation = options.rotation;
  }
  if (options.offset) {
    tex.offset.set(options.offset[0], options.offset[1]);
  }
  return tex;
}

function attachNormalMap(mat, name, rx, ry, clamp) {
  if (!NORMAL_STRENGTH[name]) return;
  const apply = (nBase) => {
    const nt = nBase.clone();
    nt.needsUpdate = true;
    const wrap = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    nt.wrapS = wrap;
    nt.wrapT = wrap;
    nt.repeat.set(rx, ry);
    mat.normalMap = nt;
    mat.normalScale = new THREE.Vector2(0.75, 0.75);
    mat.needsUpdate = true;
  };
  const existing = normalBaseCache.get(name);
  if (existing) {
    apply(existing);
  } else {
    if (!pendingNormalCallbacks.has(name)) pendingNormalCallbacks.set(name, []);
    pendingNormalCallbacks.get(name).push(apply);
  }
}

export const TILE_SCALE = {
  wood_floor: 1.45,
  tatami: 0.90,
  plaster_beige: 1.40,
  carpet_beige: 1.10,
  tile_white_small: 0.85,
  wallpaper_woven: 1.15,
  wainscot_wood: 1.25,
  tile_blue_bath: 0.85,
  wallpaper_white: 1.20,
  tile_cream: 0.95,
  fabric_floral_quilt: 0.85,
  fabric_sakura: 0.55,
  zabuton_red: 0.55,
  fabric_grey_sofa: 0.65,
  curtain_botanical: 0.95,
  folded_clothes: 0.65,
  meal_teishoku: 0.60,
  tile_beige_grid: 0.90,
  panel_white_vert: 1.20,
  tile_grey_stone: 1.05,
  ceiling_acoustic: 1.20,
  ceiling_hatch: 1.15,
  concrete_clean: 1.60,
  marble_white: 1.05,
  wood_slats: 1.15,
  terrazzo_white: 1.00,
  tile_white_large: 1.05,
  wood_planks_dark: 1.35,
  travertine: 1.25,
  brick_cream: 1.20,
  tile_caramel_brick: 0.80,
  stone_grey_block: 1.35,
  metal_bronze: 1.10,
  panel_slate_blue: 1.30,
  glass_fluted: 0.90,
  mesh_rattan: 0.70,
  shikkui_white: 1.60,
  yakisugi_dark: 1.45,
  bamboo_sudare: 0.95,
  wood_lattice_dark: 0.90,
  green_wall: 1.20,
  panel_perforated: 0.70,
  shoji_grid: 1.10,
  wood_deck: 1.40,
  tile_mosaic_mint: 0.65,
  plaster_ochre: 1.40,
  paver_red_brick: 1.20,
  exterior_louver: 0.75,
  exterior_siding_grey: 1.50,
};

export const MAT_PRESETS = {
  wood_floor: { roughness: 0.38, metalness: 0.04 },
  tatami: { roughness: 0.88, metalness: 0.0 },
  plaster_beige: { roughness: 0.90, metalness: 0.0 },
  carpet_beige: { roughness: 0.95, metalness: 0.0 },
  tile_white_small: { roughness: 0.20, metalness: 0.05 },
  wallpaper_woven: { roughness: 0.88, metalness: 0.0 },
  wainscot_wood: { roughness: 0.48, metalness: 0.03 },
  tile_blue_bath: { roughness: 0.18, metalness: 0.06 },
  wallpaper_white: { roughness: 0.90, metalness: 0.0 },
  tile_cream: { roughness: 0.28, metalness: 0.03 },
  fabric_floral_quilt: { roughness: 0.92, metalness: 0.0 },
  fabric_sakura: { roughness: 0.90, metalness: 0.0 },
  zabuton_red: { roughness: 0.92, metalness: 0.0 },
  fabric_grey_sofa: { roughness: 0.92, metalness: 0.0 },
  curtain_botanical: { roughness: 0.90, metalness: 0.0 },
  tile_beige_grid: { roughness: 0.34, metalness: 0.04 },
  tile_grey_stone: { roughness: 0.56, metalness: 0.04 },
  marble_white: { roughness: 0.14, metalness: 0.06 },
  wood_slats: { roughness: 0.52, metalness: 0.03 },
  terrazzo_white: { roughness: 0.28, metalness: 0.05 },
  tile_white_large: { roughness: 0.24, metalness: 0.04 },
  tile_caramel_brick: { roughness: 0.12, metalness: 0.10 },
  metal_bronze: { roughness: 0.28, metalness: 0.84 },
  shikkui_white: { roughness: 0.88, metalness: 0.0 },
  yakisugi_dark: { roughness: 0.78, metalness: 0.04 },
  wood_lattice_dark: { roughness: 0.56, metalness: 0.03 },
  wood_deck: { roughness: 0.62, metalness: 0.03 },
  tile_mosaic_mint: { roughness: 0.20, metalness: 0.06 },
  green_wall: { roughness: 0.85, metalness: 0.0 },
  paver_red_brick: { roughness: 0.85, metalness: 0.0 },
  concrete_clean: { roughness: 0.84, metalness: 0.02 },
};

/**
 * Quantized repeat-keyed Material Cache so similar static geometry shares identical
 * Material instances and batches cleanly into minimal Adreno 825 draw calls!
 */
export function makeSurfaceMat(texName, wMeters, hMeters, extra = {}) {
  const scale = TILE_SCALE[texName] || 1.0;
  // Quantize repeat to nearest 0.25 step so adjacent wall piers share exact same material bucket!
  const q = (v) => Math.max(0.25, Math.round(v * 4) / 4);
  const rx = extra.clamp ? 1 : q(wMeters / scale);
  const ry = extra.clamp ? 1 : q(hMeters / scale);
  const preset = MAT_PRESETS[texName] || { roughness: 0.72, metalness: 0.02 };
  const roughness = extra.roughness ?? preset.roughness;
  const metalness = extra.metalness ?? preset.metalness;
  const colorHex = extra.color ?? 0xffffff;
  const side = extra.side ?? THREE.FrontSide;
  const cacheKey = `surf|${texName}|${rx}|${ry}|${roughness}|${metalness}|${colorHex}|${side}|${extra.clamp ? 1 : 0}`;

  if (!extra.noCache && !extra.emissive && !extra.transparent && materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey);
  }

  const tex = loadTex(texName, rx, ry, extra);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness,
    metalness,
    color: colorHex,
    side,
    transparent: extra.transparent ?? false,
    opacity: extra.opacity ?? 1.0,
    emissive: extra.emissive ? new THREE.Color(extra.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: extra.emissiveIntensity ?? 0,
  });
  attachNormalMap(mat, texName, rx, ry, Boolean(extra.clamp));

  if (!extra.noCache && !extra.emissive && !extra.transparent) {
    materialCache.set(cacheKey, mat);
  }
  return mat;
}

export function makeFrontMat(texName, extra = {}) {
  const roughness = extra.roughness ?? 0.45;
  const metalness = extra.metalness ?? 0.05;
  const colorHex = extra.color ?? 0xffffff;
  const cacheKey = `front|${texName}|${roughness}|${metalness}|${colorHex}|${extra.transparent ? 1 : 0}`;
  if (!extra.noCache && materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey);
  }
  const tex = loadTex(texName, 1, 1, { clamp: true, ...extra });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness,
    metalness,
    color: colorHex,
    side: extra.side ?? THREE.FrontSide,
    transparent: extra.transparent ?? false,
    opacity: extra.opacity ?? 1.0,
  });
  attachNormalMap(mat, texName, 1, 1, true);
  if (!extra.noCache) materialCache.set(cacheKey, mat);
  return mat;
}

export function createSharedMaterials() {
  return {
    oak: new THREE.MeshStandardMaterial({ color: 0xc99c6b, roughness: 0.46, metalness: 0.03 }),
    oakLight: new THREE.MeshStandardMaterial({ color: 0xdab687, roughness: 0.48, metalness: 0.03 }),
    walnut: new THREE.MeshStandardMaterial({ color: 0x5d412d, roughness: 0.54, metalness: 0.04 }),
    whiteMatte: new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.80, metalness: 0.01 }),
    creamTrim: new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.68, metalness: 0.02 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.14, metalness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdce2e8, roughness: 0.15, metalness: 0.92 }),
    stainless: new THREE.MeshStandardMaterial({ color: 0xbcc4cc, roughness: 0.26, metalness: 0.86 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x9b7752, roughness: 0.28, metalness: 0.84 }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.46, metalness: 0.68 }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0x9ca4ac, roughness: 0.30, metalness: 0.80 }),
    glassClear: new THREE.MeshStandardMaterial({
      color: 0x8fb4cc,
      roughness: 0.06,
      metalness: 0.12,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      envMapIntensity: 0.10,
    }),
    glassFrosted: new THREE.MeshStandardMaterial({
      color: 0xe6f0f5,
      roughness: 0.45,
      metalness: 0.02,
      transparent: true,
      opacity: 0.62,
    }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xdfe7ee, roughness: 0.04, metalness: 0.96 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x5fb0c4,
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: 0.56,
    }),
    wallCutCap: new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 0.92, metalness: 0.0 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x2f542c, roughness: 0.80, metalness: 0.0 }),
    foliageLight: new THREE.MeshStandardMaterial({ color: 0x456e3a, roughness: 0.78, metalness: 0.0 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xb26443, roughness: 0.78, metalness: 0.02 }),
    warmBulb: new THREE.MeshStandardMaterial({
      color: 0xfff0cc,
      emissive: new THREE.Color(0xffb554),
      emissiveIntensity: 2.6,
      roughness: 0.2,
    }),
    washiGlow: new THREE.MeshStandardMaterial({
      color: 0xfff0d4,
      emissive: new THREE.Color(0xff9e3d),
      emissiveIntensity: 1.75,
      roughness: 0.85,
    }),
  };
}
