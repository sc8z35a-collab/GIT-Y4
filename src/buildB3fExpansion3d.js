import * as THREE from 'three';
import { FLOOR_B3F } from './deepBasementData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';

/**
 * Ultra-Precision 3D Builder for the B3F Expansion:
 * - B306: Second Food Storage Vault (2.0m × 7.0m, behind DB3-FD2 at rear of B305)
 * - B307: Warm Timber Acoustic Work Studio (3.0m × 4.0m, STC 52, West Wing)
 * - B308: Mandatory Sauna Preparation Room (1.7m × 2.5m, East Thermal Gateway)
 * - B309: Finnish Main Löyly Sauna (4.0m × 5.0m, 30kW twin pillar stoves, 3-tier L-benches, curved convection ceiling)
 * - B310: Mild-Sauna Long-Session Work Room (2.0m × 3.0m, 42-52°C, 26°C cooled-plenum electronics desk)
 * - B311: Private Meditation Sauna (3.0m × 4.0m, 80-90°C, W950 full-flat lie-down bench, dark yakisugi)
 * - B312: Bathhouse (2.0m × 3.5m, 41°C Kiso Hinoki tub + 14°C 950mm-deep black basalt cold plunge + dual showers & gushing rinse)
 * - B313: Totonoi Forest-Breeze Cooling Gallery (1.8m × 6.15m, spinning 19°C laminar fan + 2 zero-gravity loungers)
 * - PS-TH: Thermal MEP Plant Room (0.8m × 2.0m, ERV 1200m³/h, plunge chiller, 3Φ 200V 60kVA breaker cabinet)
 */
export function buildB3fExpansion3D(ctx) {
  const {
    deepStatic,
    deepDynamic,
    mat,
    addDBox,
    addDLight,
    addCollider,
    interactiveProps,
    makeCanvasMat,
    sharedMats,
  } = ctx;

  const yB3 = FLOOR_B3F.baseY; // -10.20 m
  const {
    concPconMat,
    concCleanMat,
    studioMirrorMat,
    studioTrackGlow,
    warmGlowMat,
    amberStripMat,
    waterJugMat,
    crateMat,
    riceSackMat,
    rationBoxMat,
    greenCanMat,
    redCanMat,
    warmTimberMat,
    hinokiMat,
    darkSpeakerMat,
  } = sharedMats;

  // === Dedicated B3F Expansion Architectural Materials ===
  const keloCedarMat = makeSurfaceMat('wood_scratched_cedar', 1.8, 1.8);
  const thermoAspenMat = makeSurfaceMat('wood_floor', 1.6, 1.6, { color: 0xf4dec0, roughness: 0.42 });
  const darkAlderMat = makeSurfaceMat('wood_walnut_floor', 1.6, 1.6, { color: 0x6b4730, roughness: 0.45 });
  const yakisugiMat = makeSurfaceMat('yakisugi_dark', 1.8, 1.8);
  const walnutDeskMat = makeSurfaceMat('wood_walnut_floor', 1.4, 1.4);
  const wetGraniteMat = makeSurfaceMat('stone_wet_granite', 2.0, 2.0);
  const wetBasaltMat = makeSurfaceMat('rock_wet_black', 2.0, 2.0);
  const blackMarbleMat = makeSurfaceMat('marble_black', 1.4, 1.4);
  const charcoalSlateMat = makeSurfaceMat('slate_charcoal', 1.4, 1.4);
  const hinokiDeckMat = makeSurfaceMat('wood_deck', 1.6, 1.6);
  const beigeTileMat = makeSurfaceMat('tile_beige_grid', 1.4, 1.4);
  const rattanMat = makeSurfaceMat('mesh_rattan', 0.8, 0.8);
  const corkBoardMat = makeSurfaceMat('cork_board', 1.2, 0.8);
  const washiLanternMat = makeSurfaceMat('washi_paper', 0.6, 0.9, {
    emissive: new THREE.Color(0xffc777),
    emissiveIntensity: 0.72,
    roughness: 0.78,
  });
  const burlapMat = makeSurfaceMat('burlap_sack', 0.6, 0.6);
  const bronzeMat = makeSurfaceMat('metal_bronze', 0.8, 0.8);
  const bronzeMeshMat = makeSurfaceMat('mesh_bronze_fine', 0.7, 0.7, { roughness: 0.36, metalness: 0.72 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc8743a, roughness: 0.24, metalness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a648, roughness: 0.24, metalness: 0.88 });
  const feltHatMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.94, metalness: 0.0 });
  const feltHatGreyMat = new THREE.MeshStandardMaterial({ color: 0x5d646d, roughness: 0.94, metalness: 0.0 });
  const feltHatForestMat = new THREE.MeshStandardMaterial({ color: 0x3b5946, roughness: 0.94, metalness: 0.0 });
  const leatherCognacMat = new THREE.MeshStandardMaterial({ color: 0x8b4a26, roughness: 0.48, metalness: 0.06 });
  const linenCreamMat = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.88, metalness: 0.0 });
  const towelWarmMat = new THREE.MeshStandardMaterial({ color: 0xe7dfd1, roughness: 0.92, metalness: 0.0 });
  const amberBottleMat = new THREE.MeshStandardMaterial({ color: 0x8a3e08, roughness: 0.14, metalness: 0.12 });
  const birchLeafMat = new THREE.MeshStandardMaterial({ color: 0x3f6e3a, roughness: 0.78, metalness: 0.0 });
  const saltPinkMat = new THREE.MeshStandardMaterial({ color: 0xf0a69e, roughness: 0.52, metalness: 0.02 });
  const olivineStoneMat = new THREE.MeshStandardMaterial({ color: 0x2f3339, roughness: 0.88, metalness: 0.08 });
  const cuttingMatGreen = new THREE.MeshStandardMaterial({ color: 0x1e6b4f, roughness: 0.62, metalness: 0.04 });
  const electrolyteCrateMat = new THREE.MeshStandardMaterial({ color: 0x1d6fa5, roughness: 0.42, metalness: 0.10 });
  const chillerPipeMat = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.36, metalness: 0.55 });
  const spiralDuctMat = new THREE.MeshStandardMaterial({ color: 0xaab4be, roughness: 0.32, metalness: 0.72 });

  // Dynamic / Emissive Materials (stored in mutable refs for interactive toggles & animation!)
  const stoveEmberMainMat = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    emissive: new THREE.Color(0xff4500),
    emissiveIntensity: 2.15,
    roughness: 0.42,
  });
  const stoveEmberPrivMat = new THREE.MeshStandardMaterial({
    color: 0xe64818,
    emissive: new THREE.Color(0xd9380a),
    emissiveIntensity: 1.85,
    roughness: 0.45,
  });
  const saunaFiberGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffc675,
    emissive: new THREE.Color(0xff9a2e),
    emissiveIntensity: 1.65,
    roughness: 0.25,
  });
  const privCandleGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffa652,
    emissive: new THREE.Color(0xff7714),
    emissiveIntensity: 1.55,
    roughness: 0.25,
  });
  const deskCoolLedMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: new THREE.Color(0x06b6d4),
    emissiveIntensity: 1.75,
    roughness: 0.2,
  });
  const plungeUnderwaterLedMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: new THREE.Color(0x06b6d4),
    emissiveIntensity: 1.85,
    roughness: 0.18,
  });
  const workLampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b5,
    emissive: new THREE.Color(0xffc978),
    emissiveIntensity: 1.85,
    roughness: 0.2,
  });
  const hotWaterMat = new THREE.MeshStandardMaterial({
    color: 0x8cc9c4,
    emissive: new THREE.Color(0x284e4a),
    emissiveIntensity: 0.22,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.78,
  });
  const coldWaterMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: new THREE.Color(0x0891b2),
    emissiveIntensity: 0.42,
    roughness: 0.06,
    metalness: 0.18,
    transparent: true,
    opacity: 0.74,
  });

  // === Procedural Crisp CanvasTextures for B3F Displays & Signage ===
  const coldChainPanelMat = makeCanvasMat(320, 192, (c, w, h) => {
    c.fillStyle = '#0d1520';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 4;
    c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#38bdf8';
    c.font = '800 18px monospace';
    c.fillText('B306 COLD-CHAIN MONITOR', 16, 30);
    c.fillStyle = '#e2e8f0';
    c.font = '700 15px monospace';
    c.fillText('VAULT ROOM : 12.0°C  45%RH', 16, 66);
    c.fillStyle = '#7dd3fc';
    c.fillText('CHILLER +2 :  +2.1°C  [OK]', 16, 98);
    c.fillStyle = '#a5b4fc';
    c.fillText('FREEZER    : -25.4°C  [OK]', 16, 130);
    c.fillStyle = '#4ade80';
    c.fillText('FIFO STOCK : 24 MONTHS READY', 16, 166);
  }, 0x224466, 0.72);

  const saunaCommandMat = makeCanvasMat(320, 224, (c, w, h) => {
    c.fillStyle = '#111318';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f59e0b';
    c.lineWidth = 4;
    c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#fbbf24';
    c.font = '800 17px monospace';
    c.fillText('THERMAL WING CONTROL [E]', 16, 28);
    const rows = [
      ['B309 MAIN SAUNA', '95.0°C', '#f87171'],
      ['B310 MILD WORK ', '46.5°C', '#fbbf24'],
      ['B311 PRIVATE   ', '85.0°C', '#fb923c'],
      ['B312 HINOKI TUB', '41.0°C', '#f59e0b'],
      ['B312 COLD PLUNG', '14.0°C', '#22d3ee'],
    ];
    rows.forEach(([lbl, val, col], idx) => {
      const y = 62 + idx * 31;
      c.fillStyle = '#cbd5e1';
      c.font = '700 14px monospace';
      c.fillText(lbl, 16, y);
      c.fillStyle = col;
      c.font = '800 16px monospace';
      c.fillText(val, 212, y);
    });
  }, 0x664411, 0.80);

  const workCadScreenMat = makeCanvasMat(320, 180, (c, w, h) => {
    c.fillStyle = '#0c1622';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 2;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.strokeStyle = 'rgba(56,189,248,0.28)';
    for (let gx = 30; gx < w - 10; gx += 26) { c.beginPath(); c.moveTo(gx, 12); c.lineTo(gx, h - 12); c.stroke(); }
    for (let gy = 30; gy < h - 10; gy += 26) { c.beginPath(); c.moveTo(12, gy); c.lineTo(w - 12, gy); c.stroke(); }
    c.strokeStyle = '#fbbf24';
    c.lineWidth = 2.5;
    c.strokeRect(42, 36, 118, 86);
    c.strokeRect(168, 36, 108, 108);
    c.fillStyle = '#f8fafc';
    c.font = '700 13px monospace';
    c.fillText('NARROW-50 B3F MASTER CAD', 22, 26);
    c.fillStyle = '#4ade80';
    c.font = '700 11px monospace';
    c.fillText('STC52 STUDIO  |  CO2 580ppm', 22, 162);
  }, 0x224466, 0.76);

  const mildWorkScreenMat = makeCanvasMat(256, 144, (c, w, h) => {
    c.fillStyle = '#141a1e';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#22d3ee';
    c.lineWidth = 3;
    c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#22d3ee';
    c.font = '800 14px monospace';
    c.fillText('DESK COOL PLENUM: 25.8°C', 14, 28);
    c.fillStyle = '#fbbf24';
    c.font = '700 13px monospace';
    c.fillText('ROOM MILD SAUNA : 46.2°C', 14, 54);
    c.fillStyle = '#cbd5e1';
    c.font = '600 11px monospace';
    c.fillText('> LONG-SESSION DEEP FOCUS', 14, 86);
    c.fillText('> FIR RADIANT PANEL: ON', 14, 106);
    c.fillStyle = '#4ade80';
    c.fillText('> CPU/BAT TEMP: OPTIMAL', 14, 128);
  }, 0x164e63, 0.78);

  const saunaGaugeMat = makeCanvasMat(160, 160, (c, w, h) => {
    c.fillStyle = '#c89b65';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#6b4220';
    c.lineWidth = 8;
    c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#fdf8ef';
    c.beginPath(); c.arc(w / 2, h / 2, 58, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b45309'; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#1e293b'; c.font = '800 22px monospace';
    c.fillText('95°C', 52, 78);
    c.fillStyle = '#0284c7'; c.font = '700 16px monospace';
    c.fillText('32%RH', 54, 104);
    c.strokeStyle = '#dc2626'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 34, h / 2 - 22); c.stroke();
  }, 0x443322, 0.28);

  // Helper to place a cylinder cleanly
  const addCyl = (parent, rt, rb, h, material, x, y, z, segs = 12, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), material);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // =========================================================================
  // 1. STRUCTURAL FLOOR SLABS, FINISHES & CEILINGS FOR ALL 9 NEW ROOMS
  // =========================================================================

  // --- B306: Second Food Storage Vault (X=0.60..2.60, Z=22.43..29.43, CH 2.60m) ---
  addDBox(deepStatic, 2.50, 0.26, 7.30, concCleanMat, 1.60, yB3 - 0.13, 25.95);
  addDBox(deepStatic, 2.50, 0.26, 7.30, concPconMat, 1.60, yB3 + 2.73, 25.95);
  // Stainless floor drain grate in South Cold-Chain Zone C
  addDBox(deepStatic, 1.25, 0.014, 0.18, makeSurfaceMat('metal_grate', 1.25, 0.2), 1.60, yB3 + 0.010, 28.15);
  // 3 Bright Overhead LED Food Vault Light Bars
  [23.45, 25.95, 28.25].forEach((lz) => {
    addDBox(deepStatic, 0.16, 0.04, 1.15, studioTrackGlow, 1.60, yB3 + 2.58, lz);
  });

  // --- B307: Warm Timber Acoustic Work Studio (X=-3.15..-0.15, Z=4.60..8.60, CH 2.75m) ---
  addDBox(deepStatic, 3.40, 0.26, 4.50, concCleanMat, -1.70, yB3 - 0.13, 6.60);
  addDBox(deepStatic, 3.00, 0.024, 4.00, walnutDeskMat, -1.65, yB3 + 0.012, 6.60);
  addDBox(deepStatic, 1.65, 0.012, 2.15, makeSurfaceMat('carpet_beige', 1.65, 2.15), -1.55, yB3 + 0.030, 7.05);
  addDBox(deepStatic, 3.40, 0.26, 4.50, makeSurfaceMat('ceiling_acoustic', 3.4, 4.5), -1.70, yB3 + 2.88, 6.60);
  // Acoustic Timber Ceiling Baffle Beams (RT60 = 0.38s) + 2700K Cove Glow!
  for (let bz = 4.95; bz <= 8.25; bz += 0.42) {
    addDBox(deepStatic, 2.88, 0.10, 0.045, warmTimberMat, -1.65, yB3 + 2.70, bz);
  }
  addDBox(deepStatic, 0.03, 0.04, 3.60, warmGlowMat, -0.18, yB3 + 2.66, 6.60);

  // --- EAST MONOLITHIC WATERPROOF RC BOX CULVERT BASE SLAB & OVERHEAD THERMAL PLENUM (X=3.35..11.60, Z=3.85..12.15) ---
  addDBox(deepStatic, 8.60, 0.30, 8.80, concCleanMat, 7.60, yB3 - 0.18, 8.00);
  addDBox(deepStatic, 8.40, 0.32, 8.60, concPconMat, 7.60, yB3 + 2.83, 8.00);

  // Room-Specific Finished Floors & Custom Ceilings across the East Thermal Wing:
  // B308 Sauna Prep Room (X=3.35..5.05, Z=6.00..8.50, FL±0, CH2.55)
  addDBox(deepStatic, 1.70, 0.020, 2.50, beigeTileMat, 4.20, yB3 + 0.010, 7.25);
  addDBox(deepStatic, 1.38, 0.014, 2.18, hinokiDeckMat, 4.20, yB3 + 0.027, 7.25);
  addDBox(deepStatic, 1.72, 0.12, 2.52, makeSurfaceMat('plywood_attic', 1.7, 2.5), 4.20, yB3 + 2.61, 7.25);
  addDBox(deepStatic, 0.36, 0.03, 0.36, warmGlowMat, 4.20, yB3 + 2.54, 7.25);

  // B310 Mild-Sauna Work Room (X=3.35..6.35, Z=3.85..5.85, FL±0, CH2.50)
  addDBox(deepStatic, 3.00, 0.024, 2.00, thermoAspenMat, 4.85, yB3 + 0.012, 4.85);
  addDBox(deepStatic, 3.02, 0.16, 2.02, warmTimberMat, 4.85, yB3 + 2.58, 4.85);
  // High-CRI 3000K damp-rated track light above cooled desk
  addDBox(deepStatic, 1.45, 0.035, 0.06, mat.darkIron, 5.45, yB3 + 2.48, 4.35);
  [4.95, 5.45, 5.95].forEach((sx) => {
    addDBox(deepStatic, 0.08, 0.05, 0.08, warmGlowMat, sx, yB3 + 2.44, 4.35);
  });

  // PS-TH Thermal MEP Plant Room (X=6.55..7.35, Z=3.85..5.85, FL-20mm, CH2.65)
  addDBox(deepStatic, 0.80, 0.016, 2.00, concCleanMat, 6.95, yB3 + 0.008, 4.85);
  addDBox(deepStatic, 0.14, 0.035, 0.90, studioTrackGlow, 6.95, yB3 + 2.62, 4.85);

  // B309 Finnish Main Sauna (X=7.60..11.60, Z=3.85..8.85, FL-15mm, CURVED CONVECTION CEILING CH2.65->2.40!)
  addDBox(deepStatic, 4.00, 0.020, 5.00, wetGraniteMat, 9.60, yB3 + 0.010, 6.35);
  // Perimeter Stainless Floor Drain Trench
  addDBox(deepStatic, 0.12, 0.012, 4.65, mat.stainless, 7.72, yB3 + 0.022, 6.35);
  // True Finnish Curved/Stepped Löyly Convection Ceiling (High CH2.65 over West stoves -> curves smoothly down to CH2.40 over East Tier 3!)
  addDBox(deepStatic, 1.80, 0.08, 5.02, keloCedarMat, 8.50, yB3 + 2.66, 6.35);
  const ceilSlope = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.08, 5.02), keloCedarMat);
  ceilSlope.position.set(10.48, yB3 + 2.53, 6.35);
  ceilSlope.rotation.z = -0.11; // Exact ~250mm downward curve directing rising Löyly vapor onto Tier 3 bathers!
  deepStatic.add(ceilSlope);
  // Recessed Ceiling Timber Ribs accentuating the Finnish convection flow
  for (let rz = 4.25; rz <= 8.45; rz += 0.70) {
    addDBox(deepStatic, 1.75, 0.035, 0.04, mat.walnut, 8.50, yB3 + 2.61, rz);
  }

  // B311 Private Meditation Sauna (X=7.60..11.60, Z=9.15..12.15, FL-15mm, CH2.45 Dark Yakisugi)
  addDBox(deepStatic, 4.00, 0.020, 3.00, wetBasaltMat, 9.60, yB3 + 0.010, 10.65);
  addDBox(deepStatic, 4.02, 0.22, 3.02, yakisugiMat, 9.60, yB3 + 2.56, 10.65);
  // Linear black stainless drain along West wall
  addDBox(deepStatic, 0.10, 0.012, 2.75, mat.darkIron, 7.72, yB3 + 0.022, 10.65);

  // B312 Hinoki Bath & 14°C Deep Cold Plunge (X=3.35..5.35, Z=8.65..12.15, FL-30mm waterproof pan, CH2.50)
  addDBox(deepStatic, 2.00, 0.020, 3.50, wetGraniteMat, 4.35, yB3 + 0.010, 10.40);
  addDBox(deepStatic, 2.02, 0.16, 3.52, warmTimberMat, 4.35, yB3 + 2.58, 10.40);
  // Moisture-proof Hinoki Ceiling Louvers + Warm Cove
  for (let lz = 8.88; lz <= 11.95; lz += 0.26) {
    addDBox(deepStatic, 1.92, 0.06, 0.032, hinokiMat, 4.35, yB3 + 2.47, lz);
  }
  addDBox(deepStatic, 0.03, 0.035, 3.20, warmGlowMat, 3.38, yB3 + 2.44, 10.40);

  // B313 Totonoi Forest-Breeze Cooling Gallery (X=5.55..7.35, Z=6.00..12.15, FL-10mm, CH2.62 Warm Timber Ceiling!)
  addDBox(deepStatic, 1.80, 0.020, 6.15, wetGraniteMat, 6.45, yB3 + 0.010, 9.075);
  addDBox(deepStatic, 1.18, 0.014, 5.65, hinokiDeckMat, 6.45, yB3 + 0.026, 9.075);
  addDBox(deepStatic, 1.82, 0.10, 6.17, warmTimberMat, 6.45, yB3 + 2.67, 9.075);
  // Warm 2400K Baseboard Footpath Indirect Strips
  addDBox(deepStatic, 0.02, 0.03, 4.50, amberStripMat, 7.33, yB3 + 0.06, 8.60);
  addDBox(deepStatic, 0.02, 0.03, 2.20, amberStripMat, 5.57, yB3 + 0.06, 11.00);

  // =========================================================================
  // 2. B306 SECOND FOOD STORAGE VAULT (2.0m × 7.0m — PURE FOOD STORAGE!)
  // =========================================================================
  // --- Zone A (Z=22.43..24.43): FIFO Food Inspection, Weighing & Vacuum-Packing Station ---
  // West Stainless Food Prep & Weighing Counter (X=0.62..1.08, Z=22.58..24.36, H=0.85m)
  addDBox(deepStatic, 0.46, 0.04, 1.78, mat.stainless, 0.85, yB3 + 0.85, 23.47);
  addDBox(deepStatic, 0.44, 0.03, 1.74, mat.stainless, 0.85, yB3 + 0.24, 23.47);
  [[0.66, 22.62], [1.04, 22.62], [0.66, 24.32], [1.04, 24.32]].forEach(([lx, lz]) => {
    addDBox(deepStatic, 0.035, 0.84, 0.035, mat.stainless, lx, yB3 + 0.42, lz);
  });
  // 0.1g Digital Precision Kitchen/Portion Scale
  addDBox(deepStatic, 0.24, 0.04, 0.28, mat.whiteMatte, 0.86, yB3 + 0.89, 22.84);
  addDBox(deepStatic, 0.18, 0.012, 0.18, mat.stainless, 0.86, yB3 + 0.915, 22.82);
  addDBox(deepStatic, 0.10, 0.018, 0.04, deskCoolLedMat, 0.86, yB3 + 0.90, 22.96);
  // Commercial Stainless Chamber Vacuum Food Sealer (acrylic lid!)
  addDBox(deepStatic, 0.36, 0.20, 0.44, mat.stainless, 0.84, yB3 + 0.97, 23.42);
  addDBox(deepStatic, 0.34, 0.06, 0.40, mat.glassClear, 0.84, yB3 + 1.10, 23.42);
  addDBox(deepStatic, 0.14, 0.04, 0.03, amberStripMat, 0.84, yB3 + 1.00, 23.65);
  // FIFO Label Printer + Inventory Logbook Binder + Spice/Dry-Herb Airtight Glass Jars
  addDBox(deepStatic, 0.22, 0.14, 0.20, darkSpeakerMat, 0.86, yB3 + 0.94, 23.95);
  addDBox(deepStatic, 0.28, 0.03, 0.22, redCanMat, 0.86, yB3 + 0.885, 24.22);
  // Upper Wall Stainless Spice & Dried-Food Glass Jar Shelf above Bench
  addDBox(deepStatic, 0.22, 0.03, 1.65, mat.stainless, 0.72, yB3 + 1.48, 23.47);
  for (let jz = 22.78; jz <= 24.16; jz += 0.22) {
    addCyl(deepStatic, 0.042, 0.042, 0.14, jz % 0.44 < 0.2 ? amberBottleMat : saltPinkMat, 0.72, yB3 + 1.56, jz, 10);
    addCyl(deepStatic, 0.045, 0.045, 0.025, mat.stainless, 0.72, yB3 + 1.64, jz, 10);
  }
  // Floor-Flush 150kg Stainless Platform Produce/Crate Scale (no blocking collider — walk right over!)
  addDBox(deepStatic, 0.46, 0.012, 0.46, mat.stainless, 1.58, yB3 + 0.010, 23.45);
  // East Wall Cold-Chain Telemetry Board (12°C / +2°C / -25°C live display) + Dry Ration Clipboard
  addDBox(deepStatic, 0.06, 0.56, 0.92, darkSpeakerMat, 2.56, yB3 + 1.52, 23.45);
  addDBox(deepStatic, 0.02, 0.48, 0.84, coldChainPanelMat, 2.52, yB3 + 1.52, 23.45);
  addCollider(-2, 0.60, 22.54, 1.09, 24.38);

  // --- Zone B (Z=24.43..27.63): 6 Five-Tier Heavy-Duty Seismic Food Storage Racks (3 West + 3 East) ---
  // Leaves crystal-clear W 1,040mm cart aisle (X=1.08..2.12)!
  const buildFiveTierFoodRack = (rx, rz, bayIdx) => {
    [[-0.21, -0.47], [0.21, -0.47], [-0.21, 0.47], [0.21, 0.47]].forEach(([dx, dz]) => {
      addDBox(deepStatic, 0.032, 2.30, 0.032, mat.stainless, rx + dx, yB3 + 1.15, rz + dz);
    });
    const tiersY = [0.12, 0.60, 1.08, 1.56, 2.04];
    tiersY.forEach((sy) => {
      addDBox(deepStatic, 0.44, 0.028, 0.98, hinokiMat, rx, yB3 + sy, rz);
      // Seismic front retainer bar facing central aisle!
      const barX = rx < 1.6 ? rx + 0.21 : rx - 0.21;
      addDBox(deepStatic, 0.012, 0.024, 0.96, mat.darkIron, barX, yB3 + sy + 0.075, rz);
    });
    // Tier 1: 30L Stainless Rice/Grain Drums OR 20L Water Jerrycans
    if (bayIdx % 2 === 0) {
      [-0.26, 0.26].forEach((oz) => {
        addCyl(deepStatic, 0.16, 0.16, 0.40, mat.stainless, rx, yB3 + 0.34, rz + oz, 12);
        addCyl(deepStatic, 0.17, 0.17, 0.03, bayIdx === 0 ? redCanMat : greenCanMat, rx, yB3 + 0.55, rz + oz, 12);
      });
    } else {
      [-0.30, 0.0, 0.30].forEach((oz) => {
        addDBox(deepStatic, 0.30, 0.38, 0.22, waterJugMat, rx, yB3 + 0.33, rz + oz);
        addDBox(deepStatic, 0.06, 0.05, 0.06, mat.whiteMatte, rx, yB3 + 0.54, rz + oz);
      });
    }
    // Tier 2: 25-Year Nitrogen-Flushed Freeze-Dried Food Tins + MRE Crates
    [-0.30, -0.08, 0.14].forEach((oz, ci) => {
      addCyl(deepStatic, 0.085, 0.085, 0.26, ci === 1 ? redCanMat : greenCanMat, rx, yB3 + 0.75, rz + oz, 10);
    });
    addDBox(deepStatic, 0.36, 0.32, 0.32, crateMat, rx, yB3 + 0.78, rz + 0.30);
    // Tier 3: Sauna Electrolyte & Oral Rehydration Reserve Crates (Blue) + Ration Cartons
    addDBox(deepStatic, 0.36, 0.30, 0.42, electrolyteCrateMat, rx, yB3 + 1.25, rz - 0.22);
    addDBox(deepStatic, 0.36, 0.32, 0.42, rationBoxMat, rx, yB3 + 1.26, rz + 0.24);
    // Tier 4: Stacked Burlap Grain/Bean Sacks + Canned Protein Bins
    addDBox(deepStatic, 0.34, 0.16, 0.44, burlapMat, rx, yB3 + 1.66, rz - 0.22);
    addDBox(deepStatic, 0.34, 0.16, 0.44, riceSackMat, rx, yB3 + 1.82, rz - 0.20);
    addDBox(deepStatic, 0.34, 0.32, 0.40, greenCanMat, rx, yB3 + 1.74, rz + 0.24);
    // Tier 5 (Top): Sealed Emergency Ration & Beverage Reserve Cases
    addDBox(deepStatic, 0.36, 0.30, 0.42, redCanMat, rx, yB3 + 2.21, rz - 0.22);
    addDBox(deepStatic, 0.36, 0.30, 0.42, crateMat, rx, yB3 + 2.21, rz + 0.24);
  };
  [25.00, 26.04, 27.08].forEach((rzBay, i) => {
    buildFiveTierFoodRack(0.84, rzBay, i);
    buildFiveTierFoodRack(2.36, rzBay, i + 1);
  });
  addCollider(-2, 0.60, 24.48, 1.09, 27.60);
  addCollider(-2, 2.11, 24.48, 2.60, 27.60);

  // --- Zone C (Z=27.63..29.43): Cold-Chain +2°C Chiller, -25°C Deep Freezer & Dehumidifier ---
  // Desiccant Industrial Dehumidifier (45%RH auto-drain) on West flank
  addDBox(deepStatic, 0.42, 0.88, 0.48, mat.whiteMatte, 0.84, yB3 + 0.44, 28.08);
  addDBox(deepStatic, 0.03, 0.30, 0.34, darkSpeakerMat, 1.06, yB3 + 0.56, 28.08);
  addCollider(-2, 0.60, 27.78, 1.08, 28.38);
  // Commercial Stainless Upright +2°C Chilled Refrigerator (SW corner)
  addDBox(deepStatic, 0.78, 1.98, 0.72, makeFrontMat('appliance_fridge', { roughness: 0.25, metalness: 0.40 }), 1.03, yB3 + 0.99, 29.02);
  addDBox(deepStatic, 0.16, 0.05, 0.02, deskCoolLedMat, 1.03, yB3 + 1.84, 28.65);
  // Heavy-Duty -25°C Chest Deep Freezer (SE corner)
  addDBox(deepStatic, 1.04, 0.92, 0.68, mat.stainless, 2.02, yB3 + 0.46, 29.04);
  addDBox(deepStatic, 1.06, 0.055, 0.70, mat.whiteMatte, 2.02, yB3 + 0.94, 29.04);
  addDBox(deepStatic, 0.28, 0.025, 0.04, mat.chrome, 2.02, yB3 + 0.96, 28.68);
  addCollider(-2, 0.62, 28.62, 2.58, 29.42);

  // =========================================================================
  // 3. B307 WARM TIMBER ACOUSTIC WORK STUDIO (3.0m × 4.0m — WEST WING)
  // =========================================================================
  // L-Shaped Solid Walnut & Oak Work Desk (West 3.60×0.72 + North Drafting Return 1.06×0.68 butt-jointed at X=-2.40, H=0.73m)
  addDBox(deepStatic, 0.72, 0.055, 3.62, walnutDeskMat, -2.76, yB3 + 0.73, 6.62);
  addDBox(deepStatic, 1.06, 0.055, 0.68, walnutDeskMat, -1.87, yB3 + 0.73, 4.96);
  // Recessed Brass Cable Management Grommet Strip
  addDBox(deepStatic, 0.08, 0.012, 2.20, brassMat, -3.02, yB3 + 0.76, 6.55);
  // Desk Walnut Legs & Side Drawer Pedestal
  addDBox(deepStatic, 0.64, 0.70, 0.46, mat.walnut, -2.76, yB3 + 0.35, 8.15);
  addDBox(deepStatic, 0.06, 0.70, 0.62, mat.walnut, -1.34, yB3 + 0.35, 4.96);
  addDBox(deepStatic, 0.64, 0.70, 0.06, mat.walnut, -2.76, yB3 + 0.35, 4.86);
  // Dual 32" 4K Matte Monitors on Floating Articulated Arms (West Main Desk!)
  [6.12, 6.96].forEach((mz) => {
    addDBox(deepStatic, 0.05, 0.44, 0.74, darkSpeakerMat, -2.98, yB3 + 1.12, mz);
    addDBox(deepStatic, 0.018, 0.39, 0.69, workCadScreenMat, -2.95, yB3 + 1.12, mz);
    addDBox(deepStatic, 0.14, 0.04, 0.04, mat.darkIron, -3.05, yB3 + 1.06, mz);
  });
  addCyl(deepStatic, 0.025, 0.025, 0.42, mat.darkIron, -3.08, yB3 + 0.96, 6.54, 8);
  // Mechanical Keyboard + Walnut Wrist Rest + Mouse + Coffee Pour-Over Server & Mug
  addDBox(deepStatic, 0.14, 0.024, 0.38, darkSpeakerMat, -2.62, yB3 + 0.77, 6.52);
  addDBox(deepStatic, 0.07, 0.018, 0.38, mat.walnut, -2.50, yB3 + 0.765, 6.52);
  addDBox(deepStatic, 0.09, 0.024, 0.06, darkSpeakerMat, -2.62, yB3 + 0.77, 6.84);
  addCyl(deepStatic, 0.055, 0.065, 0.14, mat.glassClear, -2.60, yB3 + 0.83, 7.32, 10);
  addCyl(deepStatic, 0.040, 0.040, 0.09, mat.ceramic, -2.56, yB3 + 0.805, 7.50, 10);
  // Brass Articulated Desk Lamp (Interactive [E] 3000K <-> 5000K Color Temp Toggle!)
  addCyl(deepStatic, 0.09, 0.09, 0.025, brassMat, -2.84, yB3 + 0.77, 5.58, 12);
  addCyl(deepStatic, 0.012, 0.012, 0.42, brassMat, -2.84, yB3 + 0.98, 5.58, 8, 0, -0.22);
  const workDeskLampHead = addCyl(deepDynamic, 0.04, 0.095, 0.12, brassMat, -2.72, yB3 + 1.18, 5.58, 12);
  const workDeskBulb = addCyl(deepDynamic, 0.06, 0.06, 0.02, workLampBulbMat, -2.72, yB3 + 1.12, 5.58, 10);
  // North Return Drafting Zone: Green A1 Cutting Mat, Aluminum Scale, Rolled Blueprints, Cork Strategy Board!
  addDBox(deepStatic, 0.84, 0.008, 0.56, cuttingMatGreen, -1.86, yB3 + 0.762, 4.96);
  addDBox(deepStatic, 0.36, 0.015, 0.025, mat.stainless, -1.86, yB3 + 0.775, 5.14);
  addCyl(deepStatic, 0.028, 0.028, 0.44, mat.whiteMatte, -1.78, yB3 + 0.785, 4.74, 10, 0, Math.PI / 2);
  addDBox(deepStatic, 1.05, 0.68, 0.035, mat.walnut, -1.86, yB3 + 1.46, 4.63);
  addDBox(deepStatic, 0.98, 0.61, 0.020, corkBoardMat, -1.86, yB3 + 1.46, 4.655);
  // Ergonomic Swivel Chair
  addCyl(deepStatic, 0.24, 0.26, 0.05, mat.darkIron, -2.02, yB3 + 0.04, 6.54, 10);
  addCyl(deepStatic, 0.03, 0.03, 0.42, mat.chrome, -2.02, yB3 + 0.26, 6.54, 8);
  addDBox(deepStatic, 0.48, 0.07, 0.48, darkSpeakerMat, -2.02, yB3 + 0.48, 6.54);
  addDBox(deepStatic, 0.08, 0.56, 0.46, darkSpeakerMat, -1.80, yB3 + 0.78, 6.54);
  // Northeast Floor-to-Ceiling Built-In Cedar Bookcase + Stocked Architectural Reference Volumes!
  addDBox(deepStatic, 0.96, 2.52, 0.40, makeFrontMat('furniture_bookshelf'), -0.68, yB3 + 1.26, 4.82);
  addDBox(deepStatic, 0.92, 0.025, 0.03, warmGlowMat, -0.68, yB3 + 2.56, 5.02);
  const bookMats = [redCanMat, electrolyteCrateMat, greenCanMat, leatherCognacMat, darkSpeakerMat];
  [0.64, 1.12, 1.60, 2.08].forEach((sy, rowIdx) => {
    for (let bi = 0; bi < 6; bi++) {
      const bx = -1.04 + bi * 0.12 + (rowIdx % 2) * 0.04;
      const bh = 0.22 + ((bi + rowIdx) % 3) * 0.045;
      addDBox(deepStatic, 0.048, bh, 0.20, bookMats[(bi + rowIdx) % bookMats.length], bx, yB3 + sy + bh * 0.5, 4.88);
    }
  });
  // Southwest Contemplation Alcove: Cognac Leather Lounge Chair, Ottoman, Side Table & Interactive [E] Washi Floor Lantern!
  addDBox(deepStatic, 0.74, 0.36, 0.72, leatherCognacMat, -1.80, yB3 + 0.24, 8.05);
  addDBox(deepStatic, 0.74, 0.54, 0.16, leatherCognacMat, -1.80, yB3 + 0.62, 8.34);
  addDBox(deepStatic, 0.46, 0.30, 0.42, leatherCognacMat, -1.80, yB3 + 0.20, 7.36);
  addCyl(deepStatic, 0.20, 0.20, 0.035, mat.walnut, -1.16, yB3 + 0.48, 8.15, 14);
  addCyl(deepStatic, 0.025, 0.025, 0.46, brassMat, -1.16, yB3 + 0.24, 8.15, 8);
  // Washi Paper Floor Lantern (Interactive [E])
  addCyl(deepStatic, 0.14, 0.16, 0.04, mat.walnut, -2.26, yB3 + 0.04, 8.36, 12);
  const workLanternMesh = addCyl(deepDynamic, 0.13, 0.14, 0.78, washiLanternMat, -2.26, yB3 + 0.45, 8.36, 14);
  // B307 Colliders (leaving huge central studio floor completely walkable!)
  addCollider(-2, -3.15, 4.60, -2.36, 8.48);
  addCollider(-2, -2.42, 4.60, -0.18, 5.34);
  addCollider(-2, -2.35, 7.12, -0.96, 8.58);

  // =========================================================================
  // 4. B308 MANDATORY SAUNA PREPARATION ROOM (1.7m × 2.5m)
  // =========================================================================
  // West-North Built-In Hinoki & Rattan Ventilated Locker (X=3.37..3.80, Z=6.04..6.88)
  addDBox(deepStatic, 0.42, 2.15, 0.84, hinokiMat, 3.58, yB3 + 1.075, 6.46);
  addDBox(deepStatic, 0.02, 1.38, 0.76, rattanMat, 3.80, yB3 + 1.32, 6.46);
  // Slide-out Hinoki Changing Bench (H 0.44m) + Body Scale Niche underneath
  addDBox(deepStatic, 0.34, 0.045, 0.76, hinokiMat, 3.66, yB3 + 0.44, 6.46);
  addDBox(deepStatic, 0.28, 0.022, 0.28, mat.whiteMatte, 3.62, yB3 + 0.03, 6.46);
  // Brass Triple Wall Hooks + 3 Sculpted Wool-Felt Finnish Sauna Hats (Bell Cones!) on West-South Wall (Z=7.90..8.40)
  addDBox(deepStatic, 0.03, 0.08, 0.56, mat.walnut, 3.37, yB3 + 1.56, 8.14);
  [[7.96, feltHatMat], [8.14, feltHatGreyMat], [8.32, feltHatForestMat]].forEach(([hz, hMat]) => {
    addCyl(deepStatic, 0.012, 0.012, 0.06, brassMat, 3.41, yB3 + 1.56, hz, 8, 0, Math.PI / 2);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.20, 12), hMat);
    hat.position.set(3.45, yB3 + 1.44, hz);
    deepStatic.add(hat);
  });
  // East-North Recessed Black-Marble Hydration & Löyly Prep Bar (X=4.62..5.04, Z=6.04..6.70)
  addDBox(deepStatic, 0.42, 0.86, 0.66, hinokiMat, 4.83, yB3 + 0.43, 6.37);
  addDBox(deepStatic, 0.44, 0.038, 0.68, blackMarbleMat, 4.83, yB3 + 0.88, 6.37);
  // 6°C Stainless Electrolyte Pitcher + 4 Double-Wall Copper Tumblers + Himalayan Salt Jar
  addCyl(deepStatic, 0.058, 0.072, 0.24, mat.stainless, 4.82, yB3 + 1.02, 6.18, 12);
  [[4.72, 6.34], [4.86, 6.34], [4.72, 6.46], [4.86, 6.46]].forEach(([tx, tz]) => {
    addCyl(deepStatic, 0.032, 0.028, 0.095, copperMat, tx, yB3 + 0.945, tz, 10);
  });
  addCyl(deepStatic, 0.042, 0.042, 0.10, saltPinkMat, 4.94, yB3 + 0.95, 6.56, 10);
  // Birch Vihta Soaking Vase with Leafy Twigs + 6 Amber Essential Aroma Oil Bottles on Upper Shelf!
  addCyl(deepStatic, 0.052, 0.064, 0.22, mat.ceramic, 4.74, yB3 + 1.01, 6.60, 10);
  addCyl(deepStatic, 0.09, 0.03, 0.24, birchLeafMat, 4.74, yB3 + 1.22, 6.60, 8);
  addDBox(deepStatic, 0.16, 0.025, 0.62, hinokiMat, 4.96, yB3 + 1.42, 6.37);
  for (let ai = 0; ai < 6; ai++) {
    const az = 6.12 + ai * 0.098;
    addCyl(deepStatic, 0.018, 0.018, 0.075, amberBottleMat, 4.94, yB3 + 1.47, az, 8);
    addCyl(deepStatic, 0.012, 0.012, 0.022, darkSpeakerMat, 4.94, yB3 + 1.52, az, 8);
  }
  // East-South Chrome Heated Towel Warmer + Rolled Waffle Towels + Rattan Laundry Hamper
  addDBox(deepStatic, 0.06, 0.82, 0.52, mat.chrome, 5.00, yB3 + 0.88, 8.14);
  for (let ty = 0; ty < 4; ty++) {
    addCyl(deepStatic, 0.014, 0.014, 0.48, mat.chrome, 4.96, yB3 + 0.62 + ty * 0.18, 8.14, 8, Math.PI / 2);
  }
  addDBox(deepStatic, 0.10, 0.42, 0.34, towelWarmMat, 4.92, yB3 + 0.86, 8.14);
  addDBox(deepStatic, 0.32, 0.46, 0.36, rattanMat, 4.86, yB3 + 0.23, 8.22);
  // Interactive [E] 5-Channel Backlit Digital Thermal Wing Command Panel (mounted cleanly at eye height!)
  addDBox(deepStatic, 0.04, 0.34, 0.48, darkSpeakerMat, 5.02, yB3 + 1.52, 8.14);
  const commandPanelMesh = addDBox(deepDynamic, 0.018, 0.29, 0.43, saunaCommandMat, 4.99, yB3 + 1.52, 8.14);
  // Colliders for B308 Perimeter Fixtures (center turning circle Ø1.05m 100% open!)
  addCollider(-2, 3.35, 6.00, 3.82, 6.90);
  addCollider(-2, 4.60, 6.00, 5.05, 6.72);
  addCollider(-2, 4.66, 7.82, 5.05, 8.50);

  // =========================================================================
  // 5. B309 FINNISH MAIN LÖYLY SAUNA (4.0m × 5.0m — FLAGSHIP 20m² HALL!)
  // =========================================================================
  // West Split-Face Stone Hearth & Heat-Shield Backdrop Wall (X=7.62..9.04, Z=4.32..6.40)
  addDBox(deepStatic, 0.08, 2.55, 2.25, makeSurfaceMat('stone_moss_wall', 2.2, 2.5), 7.64, yB3 + 1.27, 5.36);
  addDBox(deepStatic, 1.32, 0.08, 2.08, wetGraniteMat, 8.38, yB3 + 0.025, 5.36);
  // Twin 15kW Open-Mesh Cylindrical Pillar Stoves (320kg Olivine Diabase Stones glowing inside!)
  [4.90, 5.82].forEach((sz) => {
    addCyl(deepStatic, 0.31, 0.32, 1.02, bronzeMeshMat, 8.38, yB3 + 0.56, sz, 16);
    addCyl(deepStatic, 0.26, 0.26, 0.88, stoveEmberMainMat, 8.38, yB3 + 0.56, sz, 14);
    // Piled Dark Olivine-Diabase Sauna Stones crowning the stove top!
    for (let si = 0; si < 9; si++) {
      const ang = (si / 9) * Math.PI * 2;
      const rad = si === 0 ? 0 : 0.16;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.085, 0), olivineStoneMat);
      stone.position.set(8.38 + Math.cos(ang) * rad, yB3 + 1.07 + (si % 2) * 0.035, sz + Math.sin(ang) * rad);
      deepStatic.add(stone);
    }
    // Overhead Copper Auto-Löyly Drip Ring Pipe
    addCyl(deepStatic, 0.015, 0.015, 0.72, copperMat, 8.38, yB3 + 2.28, sz, 8);
    addCyl(deepStatic, 0.18, 0.18, 0.025, copperMat, 8.38, yB3 + 1.92, sz, 14);
  });
  // Hanging Copper Aroma Steam Bowl between the twin stoves
  addCyl(deepStatic, 0.11, 0.06, 0.08, copperMat, 8.38, yB3 + 1.48, 5.36, 12);
  // Knot-Free Thermo-Aspen Stove Safety Guardrail (H 0.72m)
  addDBox(deepStatic, 0.05, 0.05, 2.06, thermoAspenMat, 9.02, yB3 + 0.74, 5.36);
  addDBox(deepStatic, 1.24, 0.05, 0.05, thermoAspenMat, 8.40, yB3 + 0.74, 4.34);
  addDBox(deepStatic, 1.24, 0.05, 0.05, thermoAspenMat, 8.40, yB3 + 0.74, 6.38);
  [[9.02, 4.34], [9.02, 6.38], [9.02, 5.36]].forEach(([px, pz]) => {
    addDBox(deepStatic, 0.045, 0.74, 0.045, mat.darkIron, px, yB3 + 0.37, pz);
  });
  // Interactive [E] Oversized Oak & Copper-Banded Self-Löyly Kiulu Bucket + Long Ladle on Stone Pedestal!
  addDBox(deepStatic, 0.36, 0.42, 0.36, wetGraniteMat, 8.88, yB3 + 0.24, 6.18);
  const mainKiuluBucket = addCyl(deepDynamic, 0.15, 0.125, 0.24, hinokiMat, 8.88, yB3 + 0.57, 6.18, 14);
  addCyl(deepStatic, 0.148, 0.148, 0.02, copperMat, 8.88, yB3 + 0.62, 6.18, 14);
  addCyl(deepStatic, 0.132, 0.132, 0.02, copperMat, 8.88, yB3 + 0.51, 6.18, 14);
  addCyl(deepStatic, 0.012, 0.012, 0.48, thermoAspenMat, 8.92, yB3 + 0.74, 6.16, 8, 0.28, -0.32);

  // 3-Tier Floating Cantilevered L-Shaped Stadium Benches (North + East Walls, Zero Front Legs!)
  // Tier 3 Top Löyly Deck (H 1.66m, D 0.78m)
  addDBox(deepStatic, 2.28, 0.075, 0.78, thermoAspenMat, 10.45, yB3 + 1.64, 4.24);
  addDBox(deepStatic, 0.78, 0.075, 4.16, thermoAspenMat, 11.20, yB3 + 1.64, 6.73);
  // Tier 3 Slatted Backrests + 2200K Fiber-Optic Indirect Glow Strips!
  addDBox(deepStatic, 2.18, 0.34, 0.04, thermoAspenMat, 10.41, yB3 + 2.02, 3.89);
  addDBox(deepStatic, 0.04, 0.34, 4.78, thermoAspenMat, 11.55, yB3 + 2.02, 6.38);
  addDBox(deepStatic, 2.16, 0.025, 0.025, saunaFiberGlowMat, 10.41, yB3 + 2.22, 3.88);
  addDBox(deepStatic, 0.025, 0.025, 4.72, saunaFiberGlowMat, 11.56, yB3 + 2.22, 6.38);
  addDBox(deepStatic, 2.22, 0.02, 0.02, saunaFiberGlowMat, 10.45, yB3 + 1.59, 4.62);
  addDBox(deepStatic, 0.02, 0.02, 4.12, saunaFiberGlowMat, 10.82, yB3 + 1.59, 6.73);

  // Tier 2 Mid Deck (H 1.24m, D 0.60m, butt-jointed at Z=5.24)
  addDBox(deepStatic, 1.50, 0.07, 0.60, thermoAspenMat, 10.06, yB3 + 1.22, 4.93);
  addDBox(deepStatic, 0.60, 0.07, 3.57, thermoAspenMat, 10.51, yB3 + 1.22, 7.025);
  addDBox(deepStatic, 0.02, 0.02, 3.54, saunaFiberGlowMat, 10.22, yB3 + 1.17, 7.025);

  // Tier 1 Lower Foot/Bench Deck (H 0.82m, D 0.50m, butt-jointed at Z=5.74)
  addDBox(deepStatic, 0.90, 0.065, 0.50, thermoAspenMat, 9.76, yB3 + 0.80, 5.48);
  addDBox(deepStatic, 0.50, 0.065, 3.07, thermoAspenMat, 9.96, yB3 + 0.80, 7.275);
  addDBox(deepStatic, 0.02, 0.02, 3.04, saunaFiberGlowMat, 9.72, yB3 + 0.75, 7.275);

  // Access Step (H 0.42m)
  addDBox(deepStatic, 0.34, 0.06, 1.35, thermoAspenMat, 9.52, yB3 + 0.40, 7.80);

  // 4 Curved Wooden Sauna Headrests on Tier 3
  [4.85, 5.95, 7.05, 8.15].forEach((pz) => {
    addDBox(deepStatic, 0.28, 0.08, 0.36, hinokiMat, 11.34, yB3 + 1.72, pz);
  });
  // Opposite East Wall Thermometer/Hygrometer Dial, Dual 15-min Sandglass Timers & Hanging Birch Vihta
  addDBox(deepStatic, 0.03, 0.26, 0.26, saunaGaugeMat, 11.57, yB3 + 2.16, 5.45);
  [6.45, 7.45].forEach((tz) => {
    addDBox(deepStatic, 0.04, 0.26, 0.08, hinokiMat, 11.56, yB3 + 1.98, tz);
    addCyl(deepStatic, 0.02, 0.02, 0.16, mat.glassClear, 11.53, yB3 + 1.98, tz, 8);
  });
  // Colliders for B309 Hearth & Benches (leaves wide open walking hall X=7.60..9.32, Z=6.45..8.82!)
  addCollider(-2, 7.62, 4.30, 9.08, 6.42);
  addCollider(-2, 9.28, 3.85, 11.60, 5.78);
  addCollider(-2, 9.64, 5.72, 11.60, 8.85);

  // =========================================================================
  // 6. B310 MILD-SAUNA LONG-SESSION WORK ROOM (3.0m × 2.0m — 42-52°C!)
  // =========================================================================
  // NW Corner Compact 3.5kW Soft-Steam Bio-Stove (25kg stones + stainless herb water basin)
  addDBox(deepStatic, 0.46, 0.72, 0.46, bronzeMeshMat, 3.68, yB3 + 0.36, 4.16);
  addDBox(deepStatic, 0.34, 0.56, 0.34, stoveEmberPrivMat, 3.68, yB3 + 0.36, 4.16);
  addCyl(deepStatic, 0.12, 0.10, 0.06, mat.stainless, 3.68, yB3 + 0.75, 4.16, 12);
  addDBox(deepStatic, 0.54, 0.04, 0.04, thermoAspenMat, 3.68, yB3 + 0.68, 4.44);
  addDBox(deepStatic, 0.04, 0.04, 0.54, thermoAspenMat, 3.96, yB3 + 0.68, 4.16);
  // NE Cooled-Plenum Electronics Work Desk (W 1.62m × D 0.68m × H 0.73m — 26°C Cool Chamber!)
  addDBox(deepStatic, 1.62, 0.08, 0.68, charcoalSlateMat, 5.48, yB3 + 0.73, 4.24);
  addDBox(deepStatic, 0.06, 0.70, 0.64, hinokiMat, 4.70, yB3 + 0.35, 4.24);
  addDBox(deepStatic, 0.06, 0.70, 0.64, hinokiMat, 6.26, yB3 + 0.35, 4.24);
  // Glowing Cyan 22°C Cool-Air Plenum Conduit entering from adjacent PS-TH wall + Aluminum Cooling Pad!
  addDBox(deepStatic, 0.18, 0.14, 0.24, spiralDuctMat, 6.26, yB3 + 0.60, 4.24);
  const mildCoolStripMesh = addDBox(deepDynamic, 1.48, 0.025, 0.025, deskCoolLedMat, 5.48, yB3 + 0.68, 4.58);
  addDBox(deepStatic, 0.88, 0.014, 0.44, mat.stainless, 5.42, yB3 + 0.778, 4.24); // 26°C cooled aluminum pad!
  // Open Sleek Laptop + Peltier Chilled Coaster & Insulated Tumbler on Cooled Pad
  addDBox(deepStatic, 0.34, 0.016, 0.24, mat.stainless, 5.36, yB3 + 0.794, 4.30);
  const laptopLid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.012), darkSpeakerMat);
  laptopLid.position.set(5.36, yB3 + 0.89, 4.17);
  laptopLid.rotation.x = -0.22;
  deepStatic.add(laptopLid);
  addCyl(deepStatic, 0.055, 0.055, 0.018, deskCoolLedMat, 5.96, yB3 + 0.78, 4.36, 12); // Peltier chilled coaster!
  addCyl(deepStatic, 0.036, 0.034, 0.14, mat.stainless, 5.96, yB3 + 0.86, 4.36, 12);
  // Recessed Moisture-Sealed 27" Wall Display on North Wall
  addDBox(deepStatic, 0.68, 0.40, 0.04, darkSpeakerMat, 5.48, yB3 + 1.24, 3.89);
  addDBox(deepStatic, 0.62, 0.35, 0.018, mildWorkScreenMat, 5.48, yB3 + 1.24, 3.915);
  // Ergonomic Zero-Exposed-Screw Thermo-Aspen Long-Session Bench + Cream Linen Absorbent Pad!
  addDBox(deepStatic, 1.54, 0.06, 0.56, thermoAspenMat, 5.48, yB3 + 0.46, 5.24);
  addDBox(deepStatic, 1.46, 0.032, 0.48, linenCreamMat, 5.48, yB3 + 0.505, 5.24);
  addDBox(deepStatic, 1.54, 0.38, 0.05, thermoAspenMat, 5.48, yB3 + 0.76, 5.52);
  addDBox(deepStatic, 0.05, 0.44, 0.52, thermoAspenMat, 4.78, yB3 + 0.22, 5.24);
  addDBox(deepStatic, 0.05, 0.44, 0.52, thermoAspenMat, 6.18, yB3 + 0.22, 5.24);
  // Colliders for B310 (leaves entry pocket X=3.80..4.68, Z=4.50..5.85 completely walkable!)
  addCollider(-2, 3.38, 3.88, 4.00, 4.48);
  addCollider(-2, 4.66, 3.88, 6.32, 4.60);
  addCollider(-2, 4.72, 4.94, 6.28, 5.60);

  // =========================================================================
  // 7. B311 PRIVATE MEDITATION SAUNA (4.0m × 3.0m — W950 LIE-DOWN BENCH!)
  // =========================================================================
  // NW Sculpted 9kW Corner Basalt Stove (120kg black basalt + 1800K candlelight floor-wash LED!)
  addDBox(deepStatic, 0.88, 2.40, 0.06, wetBasaltMat, 8.08, yB3 + 1.20, 9.19);
  addDBox(deepStatic, 0.06, 2.40, 0.88, wetBasaltMat, 7.64, yB3 + 1.20, 9.60);
  addDBox(deepStatic, 0.66, 0.03, 0.03, privCandleGlowMat, 8.08, yB3 + 0.02, 9.24);
  addCyl(deepStatic, 0.28, 0.30, 0.90, darkSpeakerMat, 8.06, yB3 + 0.45, 9.60, 14);
  addCyl(deepStatic, 0.23, 0.23, 0.78, stoveEmberPrivMat, 8.06, yB3 + 0.45, 9.60, 12);
  for (let bi = 0; bi < 7; bi++) {
    const a = (bi / 7) * Math.PI * 2;
    const r = bi === 0 ? 0 : 0.14;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.075, 0), olivineStoneMat);
    st.position.set(8.06 + Math.cos(a) * r, yB3 + 0.94 + (bi % 2) * 0.025, 9.60 + Math.sin(a) * r);
    deepStatic.add(st);
  }
  // Interactive [E] Personal Forged Copper Kiulu Bucket & Dimmer Niche
  addDBox(deepStatic, 0.34, 0.38, 0.34, wetBasaltMat, 8.62, yB3 + 0.19, 9.42);
  const privKiuluBucket = addCyl(deepDynamic, 0.125, 0.105, 0.20, copperMat, 8.62, yB3 + 0.48, 9.42, 12);
  // Bed-Sized Full-Flat Lie-Down L-Shaped 2-Tier Wide Bench (Upper W 950mm × L 2,800mm, H 1.18m, butt-jointed at X=10.62!)
  addDBox(deepStatic, 0.95, 0.08, 2.94, darkAlderMat, 11.10, yB3 + 1.16, 10.65);
  addDBox(deepStatic, 1.98, 0.08, 0.95, darkAlderMat, 9.62, yB3 + 1.16, 11.64);
  addDBox(deepStatic, 0.03, 0.025, 2.86, privCandleGlowMat, 10.64, yB3 + 1.10, 10.65);
  addDBox(deepStatic, 1.94, 0.025, 0.03, privCandleGlowMat, 9.62, yB3 + 1.10, 11.18);
  // Lower Bench (H 0.66m, D 0.62m, butt-jointed at X=10.00) + Movable Step (H 0.33m)
  addDBox(deepStatic, 0.62, 0.07, 1.85, darkAlderMat, 10.31, yB3 + 0.64, 10.25);
  addDBox(deepStatic, 1.06, 0.07, 0.62, darkAlderMat, 9.46, yB3 + 0.64, 10.86);
  addDBox(deepStatic, 0.36, 0.06, 0.64, darkAlderMat, 9.80, yB3 + 0.32, 10.18);
  // 2 Sculpted Ergonomic Wave Wooden Pillows for Full-Flat Lie-Down!
  addDBox(deepStatic, 0.56, 0.09, 0.26, thermoAspenMat, 11.10, yB3 + 1.24, 9.42);
  addDBox(deepStatic, 0.26, 0.09, 0.56, thermoAspenMat, 8.84, yB3 + 1.24, 11.64);
  // Smoked-Glass Dimmable Meditation Pendant
  addCyl(deepStatic, 0.012, 0.012, 0.45, mat.darkIron, 9.50, yB3 + 2.22, 10.45, 8);
  const privPendantMesh = addCyl(deepDynamic, 0.10, 0.14, 0.22, privCandleGlowMat, 9.50, yB3 + 1.92, 10.45, 12);
  // Colliders for B311 (leaves spacious clear floor X=7.60..9.96, Z=10.02..11.12 inside DB3-S3!)
  addCollider(-2, 7.62, 9.18, 8.82, 9.98);
  addCollider(-2, 9.98, 9.18, 11.60, 12.12);
  addCollider(-2, 8.62, 10.55, 11.60, 12.12);

  // =========================================================================
  // 8. B312 BATHHOUSE (41°C KISO HINOKI TUB + 14°C 950mm DEEP COLD PLUNGE!)
  // =========================================================================
  // North-West Washing Zone (Z=8.65..10.55): Dual Thermostatic Rain + Hand Showers on West Wall (PS-B3W)
  [9.18, 10.02].forEach((sz) => {
    addCyl(deepStatic, 0.016, 0.016, 1.35, mat.chrome, 3.42, yB3 + 1.56, sz, 8);
    addDBox(deepStatic, 0.28, 0.025, 0.28, mat.chrome, 3.62, yB3 + 2.22, sz); // Overhead rain head
    addDBox(deepStatic, 0.06, 0.08, 0.28, mat.chrome, 3.44, yB3 + 0.96, sz); // Thermostatic mixer
    // Solid Hinoki Bath Stool + Copper-Banded Wooden Wash Bucket!
    addDBox(deepStatic, 0.28, 0.30, 0.24, hinokiMat, 3.82, yB3 + 0.12, sz);
    addCyl(deepStatic, 0.11, 0.095, 0.12, hinokiMat, 3.74, yB3 + 0.03, sz + 0.26, 12);
    addCyl(deepStatic, 0.108, 0.108, 0.016, copperMat, 3.74, yB3 + 0.05, sz + 0.26, 12);
  });
  // Anti-Fog Backlit Mirror & Recessed Stone Shampoo/Body-Soap Bottle Niche
  addDBox(deepStatic, 0.024, 0.85, 1.38, studioMirrorMat, 3.38, yB3 + 1.48, 9.60);
  addDBox(deepStatic, 0.10, 0.03, 0.72, blackMarbleMat, 3.42, yB3 + 0.86, 9.60);
  [9.38, 9.54, 9.70].forEach((bz, idx) => {
    addCyl(deepStatic, 0.032, 0.032, 0.16, idx === 0 ? amberBottleMat : (idx === 1 ? greenCanMat : mat.ceramic), 3.43, yB3 + 0.955, bz, 10);
  });
  // East Side right inside DB3-BT2: Gushing Rinse Shower (掛け湯) & Wooden Ladling Stand!
  addDBox(deepStatic, 0.24, 0.04, 0.24, mat.chrome, 5.14, yB3 + 2.18, 9.05);
  addDBox(deepStatic, 0.32, 0.56, 0.34, hinokiMat, 5.14, yB3 + 0.25, 8.92);
  addCyl(deepStatic, 0.13, 0.11, 0.16, hinokiMat, 5.14, yB3 + 0.61, 8.92, 12);

  // South-West 41.0°C Kiso Hinoki Deep Hot Tub (X=3.38..4.30, Z=10.65..12.12, rim +0.52m)
  addDBox(deepStatic, 0.92, 0.55, 0.10, hinokiMat, 3.84, yB3 + 0.245, 10.70); // Front North rim
  addDBox(deepStatic, 0.92, 0.55, 0.10, hinokiMat, 3.84, yB3 + 0.245, 12.07); // Back South rim
  addDBox(deepStatic, 0.10, 0.55, 1.26, hinokiMat, 3.43, yB3 + 0.245, 11.385); // West rim
  addDBox(deepStatic, 0.09, 0.55, 1.26, hinokiMat, 4.26, yB3 + 0.245, 11.385); // Divider rim
  addDBox(deepStatic, 0.72, 0.08, 1.24, hinokiMat, 3.84, yB3 + 0.05, 11.385); // Submerged Hinoki floor
  const hotTubWaterMesh = addDBox(deepDynamic, 0.72, 0.03, 1.24, hotWaterMat, 3.84, yB3 + 0.44, 11.385);
  // Brass Gooseneck Spout + Floating Hinoki Tea Tray & Ceramic Cup
  addCyl(deepStatic, 0.022, 0.022, 0.24, brassMat, 3.52, yB3 + 0.66, 11.38, 10, 0, Math.PI / 2);
  addDBox(deepStatic, 0.22, 0.025, 0.30, hinokiMat, 3.92, yB3 + 0.46, 11.15);
  addCyl(deepStatic, 0.03, 0.025, 0.06, mat.ceramic, 3.92, yB3 + 0.50, 11.15, 10);

  // South-East 14.0°C Black Basalt Deep Cold Plunge (X=4.34..5.32, Z=10.65..12.12 — 950mm Deep Pro Spec!)
  addDBox(deepStatic, 0.98, 0.58, 0.10, blackMarbleMat, 4.83, yB3 + 0.26, 10.70); // Front North coping
  addDBox(deepStatic, 0.98, 0.58, 0.10, blackMarbleMat, 4.83, yB3 + 0.26, 12.07); // Back South coping
  addDBox(deepStatic, 0.10, 0.58, 1.26, blackMarbleMat, 5.27, yB3 + 0.26, 11.385); // East coping
  addDBox(deepStatic, 0.09, 0.58, 1.26, blackMarbleMat, 4.38, yB3 + 0.26, 11.385); // West coping
  addDBox(deepStatic, 0.78, 0.20, 0.34, wetBasaltMat, 4.83, yB3 + 0.14, 10.94); // Internal step!
  // Glowing Cyan IP68 Underwater LED Strip inside Deep Cold Plunge!
  addDBox(deepStatic, 0.72, 0.035, 0.035, plungeUnderwaterLedMat, 4.83, yB3 + 0.22, 12.00);
  addDBox(deepStatic, 0.035, 0.035, 1.12, plungeUnderwaterLedMat, 5.20, yB3 + 0.22, 11.38);
  const coldPlungeWaterMesh = addDBox(deepDynamic, 0.82, 0.035, 1.28, coldWaterMat, 4.83, yB3 + 0.47, 11.385);
  // Colliders for B312 (tubs & shower stools — wide central rinse & approach space 100% open!)
  addCollider(-2, 3.36, 10.62, 5.34, 12.14);
  addCollider(-2, 3.36, 8.95, 3.96, 10.38);
  addCollider(-2, 4.96, 8.68, 5.34, 9.15);

  // =========================================================================
  // 9. B313 TOTONOI FOREST-BREEZE COOLING GALLERY (1.8m × 6.15m)
  // =========================================================================
  // South Contemplation Alcove: 2 Zero-Gravity Curved Wooden Deck Loungers + Hinoki Side Table
  [6.02, 6.88].forEach((lx) => {
    // Frame Base
    addDBox(deepStatic, 0.58, 0.08, 1.24, mat.walnut, lx, yB3 + 0.28, 11.42);
    addDBox(deepStatic, 0.06, 0.28, 0.06, mat.walnut, lx - 0.24, yB3 + 0.14, 10.92);
    addDBox(deepStatic, 0.06, 0.28, 0.06, mat.walnut, lx + 0.24, yB3 + 0.14, 10.92);
    addDBox(deepStatic, 0.06, 0.28, 0.06, mat.walnut, lx - 0.24, yB3 + 0.14, 11.92);
    addDBox(deepStatic, 0.06, 0.28, 0.06, mat.walnut, lx + 0.24, yB3 + 0.14, 11.92);
    // Reclined Zero-Gravity Seat + Tilted Backrest + Cushion
    addDBox(deepStatic, 0.54, 0.05, 0.68, hinokiMat, lx, yB3 + 0.35, 11.12);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.68), hinokiMat);
    back.position.set(lx, yB3 + 0.56, 11.74);
    back.rotation.x = -0.62;
    deepStatic.add(back);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.26), linenCreamMat);
    pad.position.set(lx, yB3 + 0.72, 11.94);
    pad.rotation.x = -0.62;
    deepStatic.add(pad);
  });
  // Side Table with Diatomaceous Coasters & Chilled Glasses + Slim Cold-Water Dispenser
  addCyl(deepStatic, 0.16, 0.16, 0.03, hinokiMat, 6.45, yB3 + 0.44, 11.35, 12);
  addCyl(deepStatic, 0.022, 0.022, 0.42, brassMat, 6.45, yB3 + 0.22, 11.35, 8);
  addDBox(deepStatic, 0.30, 1.08, 0.32, mat.stainless, 5.74, yB3 + 0.54, 6.26);
  addCyl(deepStatic, 0.11, 0.11, 0.32, waterJugMat, 5.74, yB3 + 1.24, 6.26, 12);
  // Overhead Animated 19°C Laminar Forest-Breeze Ceiling Fan!
  const breezeFanGroup = new THREE.Group();
  breezeFanGroup.position.set(6.45, yB3 + 2.52, 9.65);
  deepDynamic.add(breezeFanGroup);
  addCyl(breezeFanGroup, 0.03, 0.03, 0.18, mat.darkIron, 0, 0.09, 0, 8);
  addCyl(breezeFanGroup, 0.12, 0.12, 0.06, bronzeMat, 0, 0, 0, 12);
  for (let fi = 0; fi < 4; fi++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.015, 0.56), hinokiMat);
    const a = (fi / 4) * Math.PI * 2;
    blade.position.set(Math.sin(a) * 0.34, 0, Math.cos(a) * 0.34);
    blade.rotation.y = a;
    breezeFanGroup.add(blade);
  }
  addCollider(-2, 5.66, 10.76, 7.24, 12.12);
  addCollider(-2, 5.56, 6.02, 5.96, 6.50);

  // =========================================================================
  // 10. PS-TH THERMAL MEP PLANT ROOM (0.8m × 2.0m — ACCESSIBLE VIA DB3-PS!)
  // =========================================================================
  // ERV 1,200 m³/h Heat-Recovery Ventilation Unit + Ø250 Silver Spiral Duct Risers
  addDBox(deepStatic, 0.58, 0.68, 0.56, mat.stainless, 6.95, yB3 + 1.92, 4.24);
  addCyl(deepStatic, 0.11, 0.11, 0.90, spiralDuctMat, 6.80, yB3 + 2.38, 4.10, 12);
  addCyl(deepStatic, 0.11, 0.11, 0.90, spiralDuctMat, 7.12, yB3 + 2.38, 4.10, 12);
  // 14°C Cold-Plunge Chiller & UV-C Sterilizer Unit + Insulated Chiller Piping
  addDBox(deepStatic, 0.56, 0.86, 0.58, darkSpeakerMat, 6.95, yB3 + 0.43, 4.30);
  addCyl(deepStatic, 0.075, 0.075, 0.62, chillerPipeMat, 6.72, yB3 + 1.18, 4.42, 10);
  addDBox(deepStatic, 0.22, 0.06, 0.03, deskCoolLedMat, 6.95, yB3 + 0.72, 4.60);
  // 3Φ 200V 60kVA Main Breaker & Smart-Demand Control Cabinet (East Wall)
  addDBox(deepStatic, 0.18, 0.92, 0.62, concCleanMat, 7.24, yB3 + 1.38, 5.18);
  addDBox(deepStatic, 0.02, 0.08, 0.24, amberStripMat, 7.14, yB3 + 1.66, 5.18);
  addDBox(deepStatic, 0.02, 0.08, 0.24, deskCoolLedMat, 7.14, yB3 + 1.54, 5.18);
  addCollider(-2, 6.60, 3.88, 7.32, 4.68);

  // =========================================================================
  // 11. RISING FINNISH LÖYLY STEAM BILLOWS (ULTRA-LIGHTWEIGHT 6 PLANES!)
  // =========================================================================
  const steamGroup = new THREE.Group();
  deepDynamic.add(steamGroup);
  const makeSteamTex = () => {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,248,238,0.45)');
    g.addColorStop(0.55, 'rgba(255,244,230,0.16)');
    g.addColorStop(1, 'rgba(255,244,230,0.0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const steamTex = makeSteamTex();
  const steamMatMain = new THREE.MeshBasicMaterial({
    map: steamTex,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const steamMatPriv = new THREE.MeshBasicMaterial({
    map: steamTex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const steamWisps = [];
  const spawnWisp = (x, baseY, z, m, isMain) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), m);
    plane.position.set(x, baseY, z);
    steamGroup.add(plane);
    steamWisps.push({ mesh: plane, x, baseY, z, phase: Math.random() * Math.PI * 2, isMain });
  };
  spawnWisp(8.38, yB3 + 1.25, 4.90, steamMatMain, true);
  spawnWisp(8.38, yB3 + 1.55, 5.36, steamMatMain, true);
  spawnWisp(8.38, yB3 + 1.25, 5.82, steamMatMain, true);
  spawnWisp(8.46, yB3 + 1.75, 5.15, steamMatMain, true);
  spawnWisp(8.06, yB3 + 1.15, 9.60, steamMatPriv, false);
  spawnWisp(8.12, yB3 + 1.48, 9.64, steamMatPriv, false);

  // =========================================================================
  // 12. SPATIAL LIGHTS FOR ALL NEW B3F ROOMS (DISTANCE-CULLED <= 6 ACTIVE ON GPU!)
  // =========================================================================
  const lightB306 = addDLight('B3F_Food_Vault_2', -2, 'food2', 0xf0f6fc, 2.35, 10.2, 1.60, yB3 + 2.38, 25.90);
  const lightB307 = addDLight('B3F_Work_Studio', -2, 'work', 0xffdcb0, 2.55, 9.5, -1.65, yB3 + 2.35, 6.60);
  const lightB308 = addDLight('B3F_Sauna_Prep', -2, 'prep', 0xffe4bc, 2.10, 6.8, 4.20, yB3 + 2.28, 7.25);
  const lightB309 = addDLight('B3F_Sauna_Main', -2, 'sauna_main', 0xff9d4a, 2.85, 9.8, 9.55, yB3 + 2.15, 6.35);
  const lightB310 = addDLight('B3F_Sauna_Mild', -2, 'sauna_mild', 0xffd08e, 2.25, 7.2, 4.85, yB3 + 2.22, 4.85);
  const lightB311 = addDLight('B3F_Sauna_Priv', -2, 'sauna_priv', 0xff7b2e, 2.20, 8.2, 9.50, yB3 + 2.02, 10.65);
  const lightB312 = addDLight('B3F_Bath_Plunge', -2, 'bath', 0xb8eef8, 2.45, 7.8, 4.35, yB3 + 2.22, 10.35);
  const lightB313 = addDLight('B3F_Cooling_Gallery', -2, 'cool', 0xdcf7f0, 2.15, 8.6, 6.45, yB3 + 2.32, 9.10);

  // =========================================================================
  // 13. INTERACTIVE [E] SYSTEMS & LIVE THERMAL ANIMATION LOOP
  // =========================================================================
  const b3Thermal = {
    mainLoylyBoost: 0,
    privLoylyBoost: 0,
    thermalHighMode: true,
    privWarmMode: false,
    workLampDaylight: false,
    workLanternOn: true,
    mildDeskBoost: true,

    update(dt, elapsed) {
      // Decay active Löyly steam surges gracefully
      if (this.mainLoylyBoost > 0) this.mainLoylyBoost = Math.max(0, this.mainLoylyBoost - dt * 0.22);
      if (this.privLoylyBoost > 0) this.privLoylyBoost = Math.max(0, this.privLoylyBoost - dt * 0.22);

      // Slowly spin 19°C laminar forest-breeze ceiling fan in B313
      breezeFanGroup.rotation.y += dt * 1.45;

      // Gentle breathing ember glow on sauna stoves
      const baseHeat = this.thermalHighMode ? 1.0 : 0.42;
      stoveEmberMainMat.emissiveIntensity = (1.95 + Math.sin(elapsed * 2.4) * 0.22 + this.mainLoylyBoost * 1.15) * baseHeat;
      stoveEmberPrivMat.emissiveIntensity = (1.65 + Math.sin(elapsed * 1.9 + 1.1) * 0.18 + this.privLoylyBoost * 0.95) * baseHeat;

      // Subtle water surface breathing shimmer in 41°C Hinoki Tub & 14°C Cold Plunge
      hotTubWaterMesh.position.y = yB3 + 0.44 + Math.sin(elapsed * 1.6) * 0.004;
      coldPlungeWaterMesh.position.y = yB3 + 0.47 + Math.sin(elapsed * 2.3 + 0.8) * 0.004;
      plungeUnderwaterLedMat.emissiveIntensity = 1.72 + Math.sin(elapsed * 2.1) * 0.22;

      // Rising Löyly steam billows above stove stones
      steamMatMain.opacity = (this.thermalHighMode ? 0.22 : 0.06) + this.mainLoylyBoost * 0.48;
      steamMatPriv.opacity = (this.thermalHighMode ? 0.16 : 0.05) + this.privLoylyBoost * 0.44;
      for (const w of steamWisps) {
        const boost = w.isMain ? this.mainLoylyBoost : this.privLoylyBoost;
        const cycle = (elapsed * (0.35 + boost * 0.45) + w.phase) % 1.0;
        w.mesh.position.y = w.baseY + cycle * 1.05;
        w.mesh.position.x = w.x + Math.sin(elapsed * 1.2 + w.phase) * 0.12;
        w.mesh.rotation.y = elapsed * 0.4 + w.phase;
        const sc = 0.65 + cycle * (0.95 + boost * 0.65);
        w.mesh.scale.set(sc, sc, 1);
      }
    },
  };

  // Bind crosshair raycast IDs on all 6 interactive expansion meshes!
  mainKiuluBucket.userData.propId = 'b309_main_loyly';
  privKiuluBucket.userData.propId = 'b311_priv_loyly';
  commandPanelMesh.userData.propId = 'b308_thermal_cmd';
  workDeskLampHead.userData.propId = 'b307_desk_lamp';
  workLanternMesh.userData.propId = 'b307_washi_lantern';
  mildCoolStripMesh.userData.propId = 'b310_desk_cooling';

  // Interactive 1: B309 Main Finnish Sauna Self-Löyly Bucket
  interactiveProps.push({
    id: 'b309_main_loyly',
    floor: -2,
    building: 'main',
    isOn: true,
    mesh: mainKiuluBucket,
    getLabel: () => '【セルフロウリュ】320kgオリビン石へ白樺アロマ水を掛ける (B309)',
    toggle: () => {
      b3Thermal.mainLoylyBoost = 1.0;
      lightB309.color.setHex(0xff8433);
    },
  });

  // Interactive 2: B311 Private Sauna Meditation Löyly + 1800K/2400K Dimmer
  interactiveProps.push({
    id: 'b311_priv_loyly',
    floor: -2,
    building: 'main',
    isOn: true,
    mesh: privKiuluBucket,
    getLabel: () => (b3Thermal.privWarmMode
      ? '【プライベートロウリュ】1800K深瞑想ダーク調光へ切替 (B311)'
      : '【プライベートロウリュ】蒸気投入＆2400K暖色調光へ切替 (B311)'),
    toggle: () => {
      b3Thermal.privLoylyBoost = 1.0;
      b3Thermal.privWarmMode = !b3Thermal.privWarmMode;
      lightB311.color.setHex(b3Thermal.privWarmMode ? 0xffb66b : 0xff7b2e);
      privCandleGlowMat.emissive.setHex(b3Thermal.privWarmMode ? 0xffaa44 : 0xff7714);
      privPendantMesh.material = privCandleGlowMat;
    },
  });

  // Interactive 3: B308 Sauna Prep 5-Channel Thermal Wing Command Panel
  interactiveProps.push({
    id: 'b308_thermal_cmd',
    floor: -2,
    building: 'main',
    isOn: true,
    mesh: commandPanelMesh,
    getLabel: () => (b3Thermal.thermalHighMode
      ? '【5系統統合盤】3サウナを省エネ予熱待機モードへ切替'
      : '【5系統統合盤】3サウナ＆水風呂をフル稼働モードへ起動'),
    toggle: () => {
      b3Thermal.thermalHighMode = !b3Thermal.thermalHighMode;
      saunaFiberGlowMat.emissiveIntensity = b3Thermal.thermalHighMode ? 1.65 : 0.45;
      lightB309.color.setHex(b3Thermal.thermalHighMode ? 0xff9d4a : 0xc99c72);
      lightB310.color.setHex(b3Thermal.thermalHighMode ? 0xffd08e : 0xdbe6ef);
    },
  });

  // Interactive 4: B307 Work Studio Brass Desk Lamp (3000K Warm <-> 5000K Drafting Daylight)
  interactiveProps.push({
    id: 'b307_desk_lamp',
    floor: -2,
    building: 'main',
    isOn: true,
    mesh: workDeskLampHead,
    getLabel: () => (b3Thermal.workLampDaylight
      ? '真鍮デスクランプを【3000K 暖色書斎光】へ戻す (B307)'
      : '真鍮デスクランプを【5000K 製図昼白色】へ切替 (B307)'),
    toggle: () => {
      b3Thermal.workLampDaylight = !b3Thermal.workLampDaylight;
      lightB307.color.setHex(b3Thermal.workLampDaylight ? 0xf2f7ff : 0xffdcb0);
      workLampBulbMat.emissive.setHex(b3Thermal.workLampDaylight ? 0xe0f2fe : 0xffc978);
      workDeskBulb.material = workLampBulbMat;
    },
  });

  // Interactive 5: B307 Washi Floor Lantern
  interactiveProps.push({
    id: 'b307_washi_lantern',
    floor: -2,
    building: 'main',
    isOn: true,
    mesh: workLanternMesh,
    getLabel: () => (b3Thermal.workLanternOn ? '和紙フロアランタンを消灯 (B307)' : '和紙フロアランタンを点灯 (B307)'),
    toggle: () => {
      b3Thermal.workLanternOn = !b3Thermal.workLanternOn;
      washiLanternMat.emissiveIntensity = b3Thermal.workLanternOn ? 0.72 : 0.04;
    },
  });

  // Interactive 6: B310 Mild-Sauna 26°C Desk Cooling Plenum Boost
  interactiveProps.push({
    id: 'b310_desk_cooling',
    floor: -2,
    building: 'main',
    isOn: true,
    mesh: mildCoolStripMesh,
    getLabel: () => (b3Thermal.mildDeskBoost
      ? 'PC保護・26℃冷却プレナムを【静音エコ送風】へ切替 (B310)'
      : 'PC保護・26℃冷却プレナムを【強力22℃直冷ブースト】へ切替 (B310)'),
    toggle: () => {
      b3Thermal.mildDeskBoost = !b3Thermal.mildDeskBoost;
      deskCoolLedMat.emissiveIntensity = b3Thermal.mildDeskBoost ? 1.85 : 0.45;
      deskCoolLedMat.emissive.setHex(b3Thermal.mildDeskBoost ? 0x06b6d4 : 0x38bdf8);
    },
  });

  // Keep references alive for linters & optional debug inspection
  void lightB306;
  void lightB308;
  void lightB312;
  void lightB313;

  return { b3Thermal };
}
