import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const baseCache = new Map();
const normalBaseCache = new Map();
const materialCache = new Map();

// Hero architectural textures that receive runtime 256×256 Sobel Normal Map synthesis
const NORMAL_STRENGTH = {
  wood_floor: 1.35,
  wood_walnut_floor: 1.45,
  parquet_oak: 1.50,
  wood_slats: 2.2,
  tile_caramel_brick: 2.4,
  brick_red_classic: 2.4,
  brick_aged_dark: 2.5,
  tatami: 1.75,
  tatami_ryukyu: 1.65,
  tatami_aged: 1.85,
  yakisugi_dark: 2.5,
  yakisugi_deep: 2.6,
  terrazzo_white: 0.9,
  terrazzo_emerald: 1.0,
  plaster_beige: 1.4,
  plaster_sage: 1.35,
  shikkui_white: 1.4,
  concrete_pcon: 1.7,
  concrete_cedar_form: 2.2,
  tile_blue_bath: 1.8,
  tile_emerald_gloss: 1.9,
  tile_cobalt_mosaic: 2.0,
  tile_white_small: 1.8,
  tile_beige_grid: 1.5,
  tile_grey_stone: 1.6,
  tile_checker_stone: 1.3,
  tile_mosaic_mint: 2.0,
  wainscot_wood: 1.6,
  wainscot_rustic: 2.1,
  wood_scratched_cedar: 1.9,
  plywood_attic: 1.5,
  wood_deck: 2.1,
  fabric_grey_sofa: 1.5,
  carpet_beige: 1.6,
  carpet_charcoal_tile: 1.8,
  cork_board: 1.7,
  pegboard_wood: 2.3,
  paver_red_brick: 2.3,
  paver_moss_stones: 2.5,
  paver_granite_grid: 2.2,
  stone_cistern_grey: 2.3,
  stone_moss_wall: 2.4,
  stone_wet_granite: 2.3,
  crate_wood: 2.2,
  timber_logs: 2.5,
  forest_mulch_ground: 2.0,
  green_wall: 2.0,
  wood_lattice_dark: 1.9,
};

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
  nTex.anisotropy = 4;
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
        try {
          const nBase = buildNormalFromImage(loadedTex.image, NORMAL_STRENGTH[name]);
          normalBaseCache.set(name, nBase);
          const cbs = pendingNormalCallbacks.get(name);
          if (cbs) {
            cbs.forEach((cb) => cb(nBase));
            pendingNormalCallbacks.delete(name);
          }
        } catch (_) {
          // Safe fallback if canvas readback restricted
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
  return tex;
}

export function attachNormalMap(mat, name, rx, ry, clamp) {
  if (!NORMAL_STRENGTH[name]) return;
  const apply = (nBase) => {
    const nt = nBase.clone();
    nt.needsUpdate = true;
    const wrap = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    nt.wrapS = wrap;
    nt.wrapT = wrap;
    nt.repeat.set(rx, ry);
    mat.normalMap = nt;
    mat.normalScale = new THREE.Vector2(0.72, 0.72);
    mat.needsUpdate = true;
  };
  const existing = normalBaseCache.get(name);
  if (existing) apply(existing);
  else {
    if (!pendingNormalCallbacks.has(name)) pendingNormalCallbacks.set(name, []);
    pendingNormalCallbacks.get(name).push(apply);
  }
}

export const TILE_SCALE = {
  wood_floor: 1.45,
  wood_walnut_floor: 1.50,
  parquet_oak: 1.25,
  tatami: 0.90,
  tatami_ryukyu: 0.90,
  tatami_aged: 1.05,
  plaster_beige: 1.40,
  plaster_sage: 1.45,
  carpet_beige: 1.10,
  carpet_charcoal_tile: 1.05,
  tile_white_small: 0.85,
  wallpaper_woven: 1.15,
  wallpaper_vintage_floral: 1.10,
  wainscot_wood: 1.25,
  wainscot_rustic: 1.35,
  wood_scratched_cedar: 1.40,
  plywood_attic: 1.45,
  wood_weathered_grey: 1.40,
  timber_logs: 1.10,
  tile_blue_bath: 0.85,
  tile_emerald_gloss: 0.85,
  tile_cobalt_mosaic: 0.70,
  wallpaper_white: 1.20,
  tile_cream: 0.95,
  fabric_floral_quilt: 0.85,
  fabric_rose_vintage: 0.75,
  fabric_denim: 0.60,
  fabric_sakura: 0.55,
  zabuton_red: 0.55,
  fabric_grey_sofa: 0.65,
  curtain_botanical: 0.95,
  folded_clothes: 0.65,
  meal_teishoku: 0.60,
  tile_beige_grid: 0.90,
  tile_checker_stone: 1.10,
  panel_white_vert: 1.20,
  tile_grey_stone: 1.05,
  ceiling_acoustic: 1.20,
  ceiling_hatch: 1.15,
  concrete_clean: 1.60,
  concrete_pcon: 1.80,
  concrete_cedar_form: 1.55,
  marble_white: 1.05,
  marble_black: 1.15,
  wood_slats: 1.15,
  terrazzo_white: 1.00,
  terrazzo_emerald: 0.95,
  tile_white_large: 1.05,
  wood_planks_dark: 1.35,
  travertine: 1.25,
  brick_cream: 1.20,
  brick_red_classic: 1.20,
  brick_aged_dark: 1.25,
  tile_caramel_brick: 0.80,
  stone_grey_block: 1.35,
  stone_cistern_grey: 1.40,
  stone_moss_wall: 1.35,
  stone_wet_granite: 1.30,
  slate_charcoal: 1.15,
  metal_grate: 0.85,
  rubber_black_stud: 0.75,
  rock_wet_black: 1.40,
  rock_mossy_cliff: 1.60,
  metal_bronze: 1.10,
  mesh_bronze_fine: 0.70,
  panel_slate_blue: 1.30,
  glass_fluted: 0.90,
  mesh_rattan: 0.70,
  washi_paper: 1.00,
  cork_board: 0.95,
  pegboard_wood: 0.95,
  shikkui_white: 1.60,
  yakisugi_dark: 1.45,
  yakisugi_deep: 1.45,
  bamboo_sudare: 0.95,
  wood_lattice_dark: 0.90,
  green_wall: 1.20,
  panel_perforated: 0.70,
  shoji_grid: 1.10,
  wood_deck: 1.40,
  tile_mosaic_mint: 0.65,
  plaster_ochre: 1.40,
  paver_red_brick: 1.20,
  paver_granite_grid: 1.20,
  paver_moss_stones: 1.30,
  cobble_river: 1.20,
  forest_mulch_ground: 2.10,
  crate_wood: 0.85,
  rope_coil: 0.65,
  burlap_sack: 0.75,
  exterior_louver: 0.75,
  exterior_siding_grey: 1.50,
};

export const MAT_PRESETS = {
  wood_floor: { roughness: 0.38, metalness: 0.04 },
  wood_walnut_floor: { roughness: 0.36, metalness: 0.05 },
  parquet_oak: { roughness: 0.34, metalness: 0.05 },
  tatami: { roughness: 0.88, metalness: 0.0 },
  tatami_ryukyu: { roughness: 0.86, metalness: 0.0 },
  tatami_aged: { roughness: 0.92, metalness: 0.0 },
  plaster_beige: { roughness: 0.90, metalness: 0.0 },
  plaster_sage: { roughness: 0.88, metalness: 0.0 },
  carpet_beige: { roughness: 0.95, metalness: 0.0 },
  carpet_charcoal_tile: { roughness: 0.94, metalness: 0.0 },
  tile_white_small: { roughness: 0.20, metalness: 0.05 },
  tile_emerald_gloss: { roughness: 0.14, metalness: 0.08 },
  tile_cobalt_mosaic: { roughness: 0.16, metalness: 0.08 },
  tile_checker_stone: { roughness: 0.30, metalness: 0.04 },
  wallpaper_woven: { roughness: 0.88, metalness: 0.0 },
  wallpaper_vintage_floral: { roughness: 0.90, metalness: 0.0 },
  wainscot_wood: { roughness: 0.48, metalness: 0.03 },
  wainscot_rustic: { roughness: 0.68, metalness: 0.02 },
  wood_scratched_cedar: { roughness: 0.64, metalness: 0.02 },
  plywood_attic: { roughness: 0.74, metalness: 0.01 },
  tile_blue_bath: { roughness: 0.18, metalness: 0.06 },
  wallpaper_white: { roughness: 0.90, metalness: 0.0 },
  marble_white: { roughness: 0.14, metalness: 0.06 },
  marble_black: { roughness: 0.12, metalness: 0.10 },
  wood_slats: { roughness: 0.52, metalness: 0.03 },
  terrazzo_white: { roughness: 0.28, metalness: 0.05 },
  terrazzo_emerald: { roughness: 0.24, metalness: 0.05 },
  tile_caramel_brick: { roughness: 0.12, metalness: 0.10 },
  brick_red_classic: { roughness: 0.84, metalness: 0.02 },
  brick_aged_dark: { roughness: 0.86, metalness: 0.02 },
  concrete_pcon: { roughness: 0.76, metalness: 0.03 },
  concrete_cedar_form: { roughness: 0.80, metalness: 0.02 },
  slate_charcoal: { roughness: 0.62, metalness: 0.08 },
  stone_wet_granite: { roughness: 0.26, metalness: 0.10 },
  rock_wet_black: { roughness: 0.30, metalness: 0.08 },
  metal_bronze: { roughness: 0.28, metalness: 0.84 },
  yakisugi_dark: { roughness: 0.78, metalness: 0.04 },
  yakisugi_deep: { roughness: 0.72, metalness: 0.05 },
  washi_paper: { roughness: 0.86, metalness: 0.0 },
  cork_board: { roughness: 0.92, metalness: 0.0 },
  pegboard_wood: { roughness: 0.72, metalness: 0.02 },
  crate_wood: { roughness: 0.85, metalness: 0.01 },
  paver_moss_stones: { roughness: 0.78, metalness: 0.02 },
  forest_mulch_ground: { roughness: 0.95, metalness: 0.0 },
};

export function makeSurfaceMat(texName, wMeters, hMeters, extra = {}) {
  const scale = TILE_SCALE[texName] || 1.0;
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
  mat.userData.batchTex = {
    name: texName,
    rx,
    ry,
    clamp: Boolean(extra.clamp),
    rotation: extra.rotation || 0,
  };

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
    walnut: new THREE.MeshStandardMaterial({ color: 0x523826, roughness: 0.56, metalness: 0.04 }),
    whiteMatte: new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.80, metalness: 0.01 }),
    creamTrim: new THREE.MeshStandardMaterial({ color: 0xe3ddd0, roughness: 0.68, metalness: 0.02 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.14, metalness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdce2e8, roughness: 0.15, metalness: 0.92 }),
    stainless: new THREE.MeshStandardMaterial({ color: 0xbcc4cc, roughness: 0.26, metalness: 0.86 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x9b7752, roughness: 0.28, metalness: 0.84 }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x222429, roughness: 0.46, metalness: 0.68 }),
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
      opacity: 0.60,
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
