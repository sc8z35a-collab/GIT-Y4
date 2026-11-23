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
  warehouse_corrugated_steel: 2.8,
  warehouse_epoxy_floor: 1.1,
  armor_steel_plate: 2.4,
  iron_shutter_slat: 2.9,
  container_corrugated: 2.9,
  secret_cedar_plank: 1.85,
  airship_composite_hull: 1.45,
  silo_blast_armor: 2.6,
  silo_hazard_deck: 2.1,
  airship_cabin_teak: 1.55,
};

function buildProceduralTextureCanvas(name) {
  if (typeof document === 'undefined') return null;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  // Deterministic micro-RNG for reproducible industrial & wood grain
  let seed = 1337;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296.0;
  };

  if (name === 'warehouse_corrugated_steel') {
    // Authentic galvanized trapezoidal warehouse steel cladding
    const ribs = 16;
    const ribW = S / ribs;
    for (let x = 0; x < S; x++) {
      const p = (x % ribW) / ribW;
      let shade = 0.72;
      if (p < 0.16) shade = 0.56 + (p / 0.16) * 0.28;
      else if (p < 0.48) shade = 0.86 - ((p - 0.16) / 0.32) * 0.06;
      else if (p < 0.64) shade = 0.80 - ((p - 0.48) / 0.16) * 0.34;
      else shade = 0.46 + ((p - 0.64) / 0.36) * 0.10;
      const g = Math.round(shade * 168);
      ctx.fillStyle = `rgb(${g - 4},${g},${g + 6})`;
      ctx.fillRect(x, 0, 1, S);
    }
    // Subtle zinc spangle & weathering streaks
    for (let i = 0; i < 420; i++) {
      const x = rng() * S, y = rng() * S;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(20,28,36,0.045)';
      ctx.fillRect(x, y, 2 + rng() * 5, 16 + rng() * 64);
    }
    // Horizontal lap seam & hex fastener rows
    [128, 384].forEach((y) => {
      ctx.fillStyle = 'rgba(18,22,28,0.38)';
      ctx.fillRect(0, y, S, 3);
      ctx.fillStyle = 'rgba(220,232,245,0.22)';
      ctx.fillRect(0, y + 3, S, 2);
      for (let r = 0; r < ribs; r++) {
        ctx.fillStyle = '#333b44';
        ctx.beginPath();
        ctx.arc(r * ribW + ribW * 0.32, y - 6, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return c;
  }

  if (name === 'warehouse_epoxy_floor') {
    ctx.fillStyle = '#6f757c';
    ctx.fillRect(0, 0, S, S);
    // Trowel cloud mottling + industrial epoxy speckles
    for (let i = 0; i < 1600; i++) {
      const x = rng() * S, y = rng() * S, rad = 1 + rng() * 14;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(225,232,240,0.035)' : 'rgba(32,38,45,0.045)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // Saw-cut concrete expansion joint grid
    ctx.strokeStyle = 'rgba(24,28,34,0.48)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
    ctx.beginPath();
    ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
    ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
    ctx.stroke();
    return c;
  }

  if (name === 'armor_steel_plate') {
    // Heavy bolted gunmetal ballistic armor plate (crisp welded seams & hex bolts)
    ctx.fillStyle = '#4e5966';
    ctx.fillRect(0, 0, S, S);
    // Directional brushed steel micro-grain
    for (let i = 0; i < 1200; i++) {
      const x = rng() * S, y = rng() * S;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(210,224,238,0.065)' : 'rgba(18,24,30,0.075)';
      ctx.fillRect(x, y, 22 + rng() * 90, 1 + rng() * 2);
    }
    // Welded armor plate subdivisions (2×2 heavy slabs)
    const cells = [0, 256];
    cells.forEach((cx) => {
      cells.forEach((cy) => {
        ctx.strokeStyle = 'rgba(16,21,27,0.82)';
        ctx.lineWidth = 5;
        ctx.strokeRect(cx + 3, cy + 3, 250, 250);
        ctx.strokeStyle = 'rgba(186,202,220,0.32)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx + 7, cy + 7, 242, 242);
        // Heavy recessed corner & edge armor hex bolts
        const offsets = [22, 128, 234];
        offsets.forEach((ox) => {
          [22, 234].forEach((oy) => {
            ctx.fillStyle = '#20262e';
            ctx.beginPath();
            ctx.arc(cx + ox, cy + oy, 5.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8b99aa';
            ctx.beginPath();
            ctx.arc(cx + ox - 1.2, cy + oy - 1.2, 3.1, 0, Math.PI * 2);
            ctx.fill();
          });
        });
      });
    });
    return c;
  }

  if (name === 'iron_shutter_slat') {
    // Heavy interlocking ribbed gunmetal-iron rolling storm shutter slats
    const slats = 16;
    const h = S / slats;
    for (let y = 0; y < S; y++) {
      const p = (y % h) / h;
      let v = 86;
      if (p < 0.14) v = 34;
      else if (p < 0.32) v = 114;
      else if (p < 0.78) v = 82 + (1 - p) * 20;
      else v = 48;
      ctx.fillStyle = `rgb(${Math.round(v)},${Math.round(v + 5)},${Math.round(v + 11)})`;
      ctx.fillRect(0, y, S, 1);
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = 'rgba(220,232,245,0.045)';
      ctx.fillRect(rng() * S, rng() * S, 30 + rng() * 90, 1.5);
    }
    return c;
  }

  if (name === 'container_corrugated') {
    // Heavy olive-steel ISO corrugated cargo container walls
    const ribs = 12;
    const ribW = S / ribs;
    for (let x = 0; x < S; x++) {
      const p = (x % ribW) / ribW;
      let s = 0.65;
      if (p < 0.18) s = 0.42 + (p / 0.18) * 0.46;
      else if (p < 0.52) s = 0.88 - ((p - 0.18) / 0.34) * 0.08;
      else if (p < 0.70) s = 0.80 - ((p - 0.52) / 0.18) * 0.42;
      else s = 0.38 + ((p - 0.70) / 0.30) * 0.08;
      ctx.fillStyle = `rgb(${Math.round(78 * s)},${Math.round(92 * s)},${Math.round(80 * s)})`;
      ctx.fillRect(x, 0, 1, S);
    }
    // Top & bottom welded ISO frame rails
    ctx.fillStyle = '#333d35';
    ctx.fillRect(0, 0, S, 26);
    ctx.fillRect(0, S - 26, S, 26);
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(15,20,16,0.05)';
      ctx.fillRect(rng() * S, rng() * S, 4 + rng() * 8, 20 + rng() * 60);
    }
    return c;
  }

  if (name === 'secret_cedar_plank') {
    // Warm honey-amber tongue-and-groove knotty cedar planks for secret-base warmth
    const planks = 8;
    const pH = S / planks;
    for (let i = 0; i < planks; i++) {
      const y0 = Math.round(i * pH);
      const tone = 0.88 + rng() * 0.22;
      const r = Math.min(255, Math.round(168 * tone));
      const g = Math.min(255, Math.round(112 * tone));
      const b = Math.min(255, Math.round(64 * tone));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y0, S, Math.ceil(pH));
      // Warm longitudinal wood grain streaks
      for (let k = 0; k < 28; k++) {
        const gy = y0 + rng() * pH;
        ctx.fillStyle = rng() > 0.45 ? 'rgba(92,48,18,0.14)' : 'rgba(235,186,125,0.12)';
        ctx.fillRect(0, gy, S, 1 + rng() * 2.4);
      }
      // Natural wood knots
      if (rng() > 0.35) {
        const kx = 40 + rng() * (S - 80);
        const ky = y0 + 12 + rng() * (pH - 24);
        ctx.fillStyle = 'rgba(72,36,14,0.34)';
        ctx.beginPath();
        ctx.ellipse(kx, ky, 10 + rng() * 8, 4 + rng() * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Crisp beveled plank groove shadow
      ctx.fillStyle = 'rgba(42,20,8,0.62)';
      ctx.fillRect(0, y0, S, 2.5);
      ctx.fillStyle = 'rgba(240,198,142,0.18)';
      ctx.fillRect(0, y0 + 2.5, S, 1.5);
      // Staggered vertical plank butt joint
      const jx = Math.round(((i * 193 + 77) % 420) + 46);
      ctx.fillStyle = 'rgba(42,20,8,0.48)';
      ctx.fillRect(jx, y0, 2, Math.ceil(pH));
    }
    return c;
  }

  if (name === 'airship_composite_hull') {
    // Sleek matte titanium-white carbon-composite aerospace geodesic hull skin
    ctx.fillStyle = '#dde3ea';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(120,136,154,0.05)';
      ctx.fillRect(rng() * S, rng() * S, 10 + rng() * 28, 2);
    }
    // Crisp geodesic composite tile seams + micro titanium flush rivets
    const stepX = 128, stepY = 64;
    ctx.strokeStyle = 'rgba(84,98,116,0.34)';
    ctx.lineWidth = 2;
    for (let y = 0; y < S; y += stepY) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
      const xOff = ((y / stepY) % 2) * 64;
      for (let x = xOff; x < S; x += stepX) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + stepY); ctx.stroke();
        ctx.fillStyle = 'rgba(98,112,128,0.45)';
        ctx.beginPath();
        ctx.arc(x + 7, y + 7, 1.8, 0, Math.PI * 2);
        ctx.arc(x + stepX - 7, y + 7, 1.8, 0, Math.PI * 2);
        ctx.arc(x + 7, y + stepY - 7, 1.8, 0, Math.PI * 2);
        ctx.arc(x + stepX - 7, y + stepY - 7, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return c;
  }

  if (name === 'silo_blast_armor') {
    // Heavy mecha blast-hatch gunmetal titanium armor with reinforced structural ribs & bolts
    ctx.fillStyle = '#2b323b';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(rng() * S, rng() * S, 4 + rng() * 34, 2 + rng() * 4);
    }
    // Reinforced panel bays
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        const px = gx * 256, py = gy * 128;
        ctx.fillStyle = (gx + gy) % 2 === 0 ? 'rgba(62,74,88,0.28)' : 'rgba(24,30,38,0.28)';
        ctx.fillRect(px + 6, py + 6, 244, 116);
        ctx.strokeStyle = 'rgba(11,15,20,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeRect(px + 3, py + 3, 250, 122);
        ctx.strokeStyle = 'rgba(154,174,196,0.20)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 7, py + 7, 242, 114);
        // Heavy hex corner bolts
        [[px + 18, py + 18], [px + 238, py + 18], [px + 18, py + 110], [px + 238, py + 110]].forEach(([bx, by]) => {
          ctx.fillStyle = '#141920';
          ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6f7e8f';
          ctx.beginPath(); ctx.arc(bx - 1, by - 1, 3.6, 0, Math.PI * 2); ctx.fill();
        });
      }
    }
    return c;
  }

  if (name === 'silo_hazard_deck') {
    // Aerospace launch pad & mega-lift reinforced dark steel-concrete deck with expansion joints
    ctx.fillStyle = '#31373f';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(210,220,235,0.04)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(rng() * S, rng() * S, 2 + rng() * 5, 2 + rng() * 5);
    }
    // Anti-slip diamond tread grid
    ctx.strokeStyle = 'rgba(148,163,184,0.10)';
    ctx.lineWidth = 1.2;
    for (let y = 0; y < S; y += 32) {
      for (let x = 0; x < S; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 16); ctx.lineTo(x + 16, y + 8);
        ctx.lineTo(x + 24, y + 16); ctx.lineTo(x + 16, y + 24);
        ctx.closePath();
        ctx.stroke();
      }
    }
    // Major deck slab joint lines
    ctx.strokeStyle = 'rgba(12,16,22,0.72)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, S - 4, S - 4);
    ctx.beginPath();
    ctx.moveTo(S * 0.5, 0); ctx.lineTo(S * 0.5, S);
    ctx.moveTo(0, S * 0.5); ctx.lineTo(S, S * 0.5);
    ctx.stroke();
    return c;
  }

  if (name === 'airship_cabin_teak') {
    // Luxury aviation yacht teak deck planking with brushed titanium caulk inlays
    ctx.fillStyle = '#5c3c24';
    ctx.fillRect(0, 0, S, S);
    const plankCount = 8;
    const pH = S / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const y0 = i * pH;
      const tone = Math.round((rng() - 0.5) * 18);
      ctx.fillStyle = `rgb(${98 + tone},${66 + Math.round(tone * 0.7)},${40 + Math.round(tone * 0.5)})`;
      ctx.fillRect(0, y0, S, pH);
      for (let g = 0; g < 18; g++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(54,32,16,0.18)' : 'rgba(196,150,96,0.12)';
        ctx.fillRect(0, y0 + rng() * pH, S, 1 + rng() * 2);
      }
      // Sleek brushed titanium inlay seam
      ctx.fillStyle = 'rgba(176,190,206,0.52)';
      ctx.fillRect(0, y0, S, 2.5);
      ctx.fillStyle = 'rgba(26,16,8,0.68)';
      ctx.fillRect(0, y0 + 2.5, S, 1.5);
    }
    return c;
  }

  return null;
}

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
    const procCanvas = buildProceduralTextureCanvas(name);
    if (procCanvas) {
      base = new THREE.CanvasTexture(procCanvas);
      base.colorSpace = THREE.SRGBColorSpace;
      base.minFilter = THREE.LinearMipmapLinearFilter;
      base.anisotropy = 4;
      base.needsUpdate = true;
      baseCache.set(name, base);
      if (NORMAL_STRENGTH[name]) {
        try {
          const nBase = buildNormalFromImage(procCanvas, NORMAL_STRENGTH[name]);
          normalBaseCache.set(name, nBase);
        } catch (_) {}
      }
      return base;
    }
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
  warehouse_corrugated_steel: 1.85,
  warehouse_epoxy_floor: 2.80,
  armor_steel_plate: 1.65,
  iron_shutter_slat: 1.20,
  container_corrugated: 1.60,
  secret_cedar_plank: 1.40,
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
  warehouse_corrugated_steel: { roughness: 0.44, metalness: 0.68 },
  warehouse_epoxy_floor: { roughness: 0.36, metalness: 0.08 },
  armor_steel_plate: { roughness: 0.42, metalness: 0.50 },
  iron_shutter_slat: { roughness: 0.44, metalness: 0.52 },
  container_corrugated: { roughness: 0.50, metalness: 0.62 },
  secret_cedar_plank: { roughness: 0.46, metalness: 0.02 },
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
