import * as THREE from 'three';
import { AIRSHIP_K11, NULL_EREA } from './airshipData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds Flagship Live-In High-Speed Airship "K-11" (tecnica forces):
 *  - Sleek 34.0m × 11.6m × 11.8m Rigid Carbon-Titanium Composite Lifting Hull (Sears-Haack profile)
 *  - Twin Outboard Vectoring Coaxial Ducted-Fan Propulsion Nacelles (VTOL 85° <-> 250 km/h Cruise 0°)
 *  - Retractable Quad Heavy-Duty Landing Skids
 *  - 100% Walkable EXACT 4.50m × 15.00m × 3.20m Luxury Live-In Gondola Cabin (6 Zones K01..K06):
 *      K01 Panoramic Bridge + Live Glass Cockpit MFD + Pilot Chair + Silo/Camper-Call Physical Buttons + tecnica forces Plaque
 *      K02 Panoramic Observation Lounge & Briefing Salon
 *      K03 Live-In Aircraft Galley & Dining Booth
 *      K04 Master Live-In Quarters & Drafting Desk
 *      K05 Pressurized Shower & Lavatory Pod
 *      K06 TF-E11 Custom Engine Gallery (1L/3km) + Live 100L Fuel Sight Gauge + West Hatch & Rear Boarding Ramp
 */
export function buildAirshipK113D(ctx) {
  const {
    scene,
    interactiveDoors,
    interactiveProps,
    interiorLights,
    b40Y,
  } = ctx;

  const CAB = AIRSHIP_K11.cabin; // interior 4.50 × 15.00 × 3.20, outer 4.80 × 15.60, floorY 0.65, ceilY 3.85
  const HULL = AIRSHIP_K11.hull; // 34.0 × 9.2 (11.6 span) × 11.8
  const OW = CAB.outerWidth;     // 4.80
  const OL = CAB.outerLength;    // 15.60
  const FY = CAB.floorLocalY;    // 0.65
  const CY = CAB.ceilingLocalY;  // 3.85
  const CH = CAB.interiorHeight; // 3.20 EXACT!

  const root = new THREE.Group();
  root.name = 'AIRSHIP_K11_TECNICA_FORCES';
  root.position.set(NULL_EREA.originX, b40Y, NULL_EREA.originZ);
  scene.add(root);

  // Tilt group handles smooth aerodynamic pitch & banking roll in flight
  const tiltGroup = new THREE.Group();
  root.add(tiltGroup);

  // Local origin matches CAMPER / ARMOR_CAMPER convention: (lx: 0..4.80, lz: 0..15.60, Nose = -Z)
  const localOrigin = new THREE.Group();
  localOrigin.position.set(-OW * 0.5, 0, -OL * 0.5);
  tiltGroup.add(localOrigin);

  const staticGrp = new THREE.Group();
  const dynamicGrp = new THREE.Group();
  localOrigin.add(dynamicGrp);

  // ---- Aerospace & Luxury Cabin Materials ----
  const hullMat = makeSurfaceMat('airship_composite_hull', 12.0, 5.0, { roughness: 0.34, metalness: 0.28 });
  const hullDarkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.36, metalness: 0.52 });
  const brushedTiMat = new THREE.MeshStandardMaterial({ color: 0xb8c4d2, roughness: 0.26, metalness: 0.72 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xdcb45c, roughness: 0.28, metalness: 0.74 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x263140, roughness: 0.42, metalness: 0.48 });
  const teakFloorMat = makeSurfaceMat('airship_cabin_teak', 3.5, 11.0, { roughness: 0.40, metalness: 0.12 });
  const walnutMat = makeSurfaceMat('wood_walnut_floor', 2.0, 2.0, { roughness: 0.44 });
  const creamWallMat = new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.65, metalness: 0.06 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x38322e, roughness: 0.58, metalness: 0.08 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });
  const duvetMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.80 });
  const bathTileMat = makeSurfaceMat('tile_white_small', 2.5, 2.5, { color: 0xd8e4ea, roughness: 0.28 });
  const grateMat = makeSurfaceMat('silo_hazard_deck', 2.5, 2.5, { roughness: 0.50, metalness: 0.55 });
  const canopyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xa5d8f3,
    roughness: 0.06,
    metalness: 0.18,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: new THREE.Color(0x0ea5e9),
    emissiveIntensity: 1.65,
    roughness: 0.2,
  });
  const warmStripMat = new THREE.MeshStandardMaterial({
    color: 0xfff7ed,
    emissive: new THREE.Color(0xfde68a),
    emissiveIntensity: 1.35,
    roughness: 0.3,
  });
  const redNavMat = new THREE.MeshStandardMaterial({
    color: 0xfca5a5, emissive: new THREE.Color(0xef4444), emissiveIntensity: 2.2,
  });
  const greenNavMat = new THREE.MeshStandardMaterial({
    color: 0x6ee7b7, emissive: new THREE.Color(0x10b981), emissiveIntensity: 2.2,
  });
  const whiteStrobeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 2.4,
  });

  function addBox(parent, w, h, d, material, x, y, z, shadow = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function makePanelMat(lines, bg = '#07101c', border = '#38bdf8', w = 512, h = 224) {
    if (typeof document === 'undefined') return new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = border;
    c.lineWidth = 6;
    c.strokeRect(6, 6, w - 12, h - 12);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const step = (h - 24) / Math.max(1, lines.length);
    lines.forEach((ln, i) => {
      c.fillStyle = ln.color || '#f8fafc';
      c.font = ln.font || '800 26px sans-serif';
      c.fillText(ln.text, w * 0.5, 12 + step * (i + 0.5));
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.72,
      roughness: 0.3,
    });
  }

  function makeBtnMat(label, accent = '#38bdf8') {
    if (typeof document === 'undefined') return new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    const cv = document.createElement('canvas');
    cv.width = 160;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#0c1b2a';
    c.fillRect(0, 0, 160, 128);
    c.strokeStyle = accent;
    c.lineWidth = 8;
    c.strokeRect(8, 8, 144, 112);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = label.length <= 4 ? '800 30px sans-serif' : '800 22px sans-serif';
    c.fillText(label, 80, 66);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(accent),
      emissiveIntensity: 0.95,
      roughness: 0.25,
    });
  }

  // =========================================================================
  // 1. SLEEK 34.0m AERODYNAMIC RIGID COMPOSITE LIFTING ENVELOPE (SEARS-HAACK)
  // =========================================================================
  const envCx = OW * 0.5; // 2.40
  const envCz = OL * 0.5; // 7.80
  const envCy = HULL.envelopeCenterY; // 7.10
  const halfLen = HULL.overallLength * 0.5; // 17.0m (from lz = -9.2 to lz = +24.8!)

  // LatheGeometry along Y then rotateX(PI/2) -> aligns cleanly along Z axis!
  const lathePts = [];
  const segsZ = 28;
  for (let i = 0; i <= segsZ; i++) {
    const u = i / segsZ; // 0 (nose) .. 1 (tail)
    const yLathe = -halfLen + u * HULL.overallLength;
    // Sleek low-drag aerodynamic teardrop/Sears-Haack radius envelope (widest at 40% back from nose!)
    const shaped = u < 0.42
      ? Math.pow(Math.sin((u / 0.42) * Math.PI * 0.5), 0.72)
      : Math.pow(Math.sin(((1.0 - u) / 0.58) * Math.PI * 0.5), 0.85);
    const rad = Math.max(0.02, shaped * HULL.envelopeRadiusX);
    lathePts.push(new THREE.Vector2(rad, yLathe));
  }
  const envGeo = new THREE.LatheGeometry(lathePts, 28);
  envGeo.rotateX(Math.PI * 0.5);
  // Subtle aerodynamic flattening (Width 9.20m × Height 7.80m elliptical lifting-body cross-section!)
  envGeo.scale(1.0, HULL.envelopeRadiusY / HULL.envelopeRadiusX, 1.0);
  const envMesh = new THREE.Mesh(envGeo, hullMat);
  envMesh.position.set(envCx, envCy, envCz);
  envMesh.castShadow = true;
  envMesh.receiveShadow = true;
  staticGrp.add(envMesh);

  // Nose Cone Titanium Cap + Pitot Probe & Racing Gold/Cyan Livery Ribs
  const noseCap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.4, 16), hullDarkMat);
  noseCap.rotation.x = -Math.PI * 0.5;
  noseCap.position.set(envCx, envCy, envCz - halfLen + 0.8);
  staticGrp.add(noseCap);
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.8, 8), goldTrimMat);
  pitot.rotation.x = Math.PI * 0.5;
  pitot.position.set(envCx, envCy, envCz - halfLen - 0.8);
  staticGrp.add(pitot);

  // Geodesic Carbon-Titanium Accent Spine Ribs & Side Livery Stripes
  addBox(staticGrp, 0.42, 0.34, 24.5, hullDarkMat, envCx, envCy + HULL.envelopeRadiusY - 0.08, envCz + 0.5, false);
  addBox(staticGrp, 0.16, 0.12, 22.0, cyanGlowMat, envCx, envCy + HULL.envelopeRadiusY + 0.12, envCz + 0.5, false);

  // Port & Starboard Glowing "K-11 // TECNICA FORCES" Livery Emblems
  const hullBadgeMat = makePanelMat([
    { text: 'K-11', font: '900 96px sans-serif', color: '#38bdf8' },
    { text: 'TECNICA FORCES  •  250 KM/H CLASS', font: '800 28px monospace', color: '#fde68a' },
  ], '#111824', '#d4a954', 640, 224);
  [-1, 1].forEach((side) => {
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.2), hullBadgeMat);
    badge.rotation.y = side * Math.PI * 0.5;
    badge.position.set(envCx + side * (HULL.envelopeRadiusX + 0.04), envCy + 0.35, envCz - 4.2);
    staticGrp.add(badge);
    // Champagne gold accent stripe along flank
    addBox(staticGrp, 0.12, 0.22, 18.5, goldTrimMat, envCx + side * (HULL.envelopeRadiusX - 0.18), envCy - 0.95, envCz - 0.5, false);
  });

  // Seamless Structural Pylon Fairings bonding Envelope (Bottom Y=4.10) to Gondola Cabin Roof (Top Y=4.03)!
  addBox(staticGrp, OW + 0.26, 0.96, OL + 1.8, hullDarkMat, envCx, CY + 0.56, envCz, false);
  addBox(staticGrp, OW - 0.4, 0.14, OL + 2.4, goldTrimMat, envCx, CY + 0.16, envCz, false);

  // ---- CRUCIFORM X-TAIL AERODYNAMIC STABILIZERS (lz = 18.5..24.4) ----
  const tailZ = envCz + halfLen - 3.2; // 21.6
  const finAngles = [Math.PI * 0.25, -Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75];
  finAngles.forEach((ang, idx) => {
    const fin = new THREE.Group();
    fin.position.set(envCx, envCy, tailZ);
    fin.rotation.z = ang;
    addBox(fin, 4.8, 0.22, 4.6, hullDarkMat, 3.2, 0, 0.6, false);
    addBox(fin, 4.6, 0.26, 0.55, goldTrimMat, 3.1, 0, -1.65, false);
    addBox(fin, 0.16, 0.16, 3.6, cyanGlowMat, 5.5, 0, 0.6, false);
    staticGrp.add(fin);
    if (idx === 0 || idx === 3) {
      // Dorsal/tail strobe light
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), whiteStrobeMat);
      st.position.set(envCx, envCy + 3.85, tailZ + 2.6);
      if (idx === 0) dynamicGrp.add(st);
    }
  });
  // Top Dorsal Fin extending cleanly to exact HULL.overallHeight (11.80m!)
  addBox(staticGrp, 0.22, 2.8, 5.6, hullDarkMat, envCx, envCy + 2.45, tailZ + 0.4, false);
  addBox(staticGrp, 0.26, 2.6, 0.42, cyanGlowMat, envCx, envCy + 2.45, tailZ + 3.0, false);

  // =========================================================================
  // 2. TWIN OUTBOARD VECTORING COAXIAL DUCTED-FAN PROPULSORS (Span 11.60m!)
  // =========================================================================
  const nacelles = [];
  const propellers = [];
  [-1, 1].forEach((side) => {
    // Swept Carbon-Titanium Wing Stub connecting Hull to Nacelle
    const stub = addBox(staticGrp, 2.8, 0.42, 2.1, hullDarkMat, envCx + side * 4.2, envCy - 1.55, envCz + 0.8, false);
    stub.rotation.z = side * 0.12;
    addBox(staticGrp, 2.6, 0.12, 0.35, cyanGlowMat, envCx + side * 4.2, envCy - 1.55, envCz - 0.22, false);

    // Wingtip Navigation Light (Port = Red, Starboard = Green!)
    const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), side < 0 ? redNavMat : greenNavMat);
    navLight.position.set(envCx + side * 5.75, envCy - 1.45, envCz + 0.2);
    dynamicGrp.add(navLight);

    // Articulated Vectoring Nacelle Pivot (X = envCx ± 5.15m -> Outer Shroud Span = 11.60m!)
    const nacPivot = new THREE.Group();
    nacPivot.position.set(envCx + side * 5.15, envCy - 1.45, envCz + 0.8);
    dynamicGrp.add(nacPivot);

    // Aerodynamic Ducted Shroud Ring (Open Cylinder)
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.02, 2.35, 18, 1, true), hullDarkMat);
    shroud.rotation.x = Math.PI * 0.5;
    nacPivot.add(shroud);
    const shroudLip = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.08, 10, 20), cyanGlowMat);
    shroudLip.position.z = -1.16;
    nacPivot.add(shroudLip);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 2.55, 12), brushedTiMat);
    hub.rotation.x = Math.PI * 0.5;
    nacPivot.add(hub);

    // Coaxial Counter-Rotating 4-Blade Composite Propellers (Front + Rear!)
    [-0.55, 0.55].forEach((pz, pIdx) => {
      const prop = new THREE.Group();
      prop.position.z = pz;
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.18, 0.05), pIdx === 0 ? goldTrimMat : brushedTiMat);
        blade.rotation.z = (b * Math.PI) * 0.5;
        prop.add(blade);
      }
      nacPivot.add(prop);
      propellers.push({ prop, dir: pIdx === 0 ? side : -side });
    });

    nacelles.push(nacPivot);
  });

  // =========================================================================
  // 3. RETRACTABLE QUAD LANDING SKIDS (localY = 0.00 when deployed!)
  // =========================================================================
  const landingGearGroup = new THREE.Group();
  dynamicGrp.add(landingGearGroup);
  [-1, 1].forEach((side) => {
    const sx = envCx + side * 2.15;
    // Wide armored landing skid rail touching exact localY = 0.0
    addBox(landingGearGroup, 0.34, 0.14, 11.4, carbonMat, sx, 0.07, envCz, false);
    addBox(landingGearGroup, 0.14, 0.08, 10.6, goldTrimMat, sx + side * 0.12, 0.10, envCz, false);
    // Front & rear shock-absorbing oleo struts
    [envCz - 4.2, envCz + 4.2].forEach((sz) => {
      addBox(landingGearGroup, 0.16, 0.62, 0.20, brushedTiMat, sx, 0.38, sz, false);
    });
  });

  // =========================================================================
  // 4. EXACT 4.50m × 15.00m × 3.20m WALKABLE LIVE-IN GONDOLA CABIN
  //    Interior: lx ∈ [0.15, 4.65] (4.50m), lz ∈ [0.30, 15.30] (15.00m),
  //              localY ∈ [0.65, 3.85] (CH 3.20m EXACT!)
  // =========================================================================
  const localColliders = [];
  const addLocalCol = (minX, minZ, maxX, maxZ) => localColliders.push({ minX, minZ, maxX, maxZ });

  // Cabin Structural Belly Floor Slab (Top EXACT at FY = 0.65m) & Ceiling Slab (Underside EXACT at CY = 3.85m!)
  addBox(staticGrp, OW, 0.24, OL, hullDarkMat, envCx, FY - 0.12, envCz, false);
  // Luxury Teak Cabin Floor (Zones K01..K04: lz 0.30..12.30)
  addBox(staticGrp, 4.52, 0.03, 12.02, teakFloorMat, envCx, FY - 0.005, 6.30, false);
  // Bath Pod Ceramic Floor (K05: lx 3.00..4.65, lz 9.70..12.30)
  addBox(staticGrp, 1.66, 0.035, 2.60, bathTileMat, 3.825, FY - 0.002, 11.00, false);
  // Engine Gallery & Airlock Titanium Grate Floor (K06: lz 12.30..15.30)
  addBox(staticGrp, 4.52, 0.03, 3.02, grateMat, envCx, FY - 0.005, 13.80, false);

  // Cabin Ceiling Panel (Exact underside at CY = 3.85m!) + Warm Ambient Ceiling Strips
  addBox(staticGrp, OW, 0.18, OL, creamWallMat, envCx, CY + 0.09, envCz, false);
  addBox(staticGrp, 0.18, 0.04, 13.8, warmStripMat, 0.85, CY - 0.02, 7.6, false);
  addBox(staticGrp, 0.18, 0.04, 13.8, warmStripMat, 3.95, CY - 0.02, 7.6, false);

  // ---- EXTERIOR GONDOLA WALLS WITH PANORAMIC WINDOWS & EXACT DOOR OPENINGS ----
  const wH = CH; // 3.20m
  const wMidY = FY + wH * 0.5;
  const wT = CAB.wallThick; // 0.15m

  // 4A. Front Panoramic Bridge Wall (lz = 0.00..0.30): Lower knee wall + tall 270° panoramic glass canopy!
  addBox(staticGrp, OW, 0.96, 0.30, hullDarkMat, envCx, FY + 0.48, 0.15, false);
  addBox(staticGrp, OW, 0.34, 0.30, hullDarkMat, envCx, CY - 0.17, 0.15, false);
  addBox(staticGrp, 4.46, 1.90, 0.06, canopyGlassMat, envCx, FY + 0.96 + 0.95, 0.15, false);
  // Corner windshield mullions
  addBox(staticGrp, 0.18, wH, 0.30, hullDarkMat, 0.09, wMidY, 0.15, false);
  addBox(staticGrp, 0.18, wH, 0.30, hullDarkMat, OW - 0.09, wMidY, 0.15, false);
  addLocalCol(0.0, 0.0, OW, 0.32);

  // 4B. West (Port) Exterior Wall (lx = 0.00..0.15) with Panoramic Windows & West Boarding Door DK11-W (lz: 13.00..14.20)!
  // Lower knee wall from lz = 0.30..13.00 and 14.20..15.30
  addBox(staticGrp, wT, 0.92, 12.70, hullDarkMat, 0.075, FY + 0.46, 6.65, false);
  addBox(staticGrp, wT, 0.40, 12.70, hullDarkMat, 0.075, CY - 0.20, 6.65, false);
  // Panoramic glass strip along West side (lz: 0.45..9.60)
  addBox(staticGrp, 0.05, 1.88, 9.15, canopyGlassMat, 0.075, FY + 0.92 + 0.94, 5.025, false);
  // Solid privacy wall in Master Bedroom K04 (lz: 9.60..13.00) with sleek recessed horizontal window
  addBox(staticGrp, wT, 1.88, 3.40, creamWallMat, 0.075, FY + 0.92 + 0.94, 11.30, false);
  // Above West Boarding Hatch DK11-W (lz: 13.00..14.20, door height 2.25m)
  addBox(staticGrp, wT, wH - 2.25, 1.20, hullDarkMat, 0.075, FY + 2.25 + (wH - 2.25) * 0.5, 13.60, false);
  // Rear West jamb (lz: 14.20..15.60)
  addBox(staticGrp, wT, wH, 1.40, hullDarkMat, 0.075, wMidY, 14.90, false);
  // Structural vertical mullions along West window span
  [3.50, 6.90, 9.65].forEach((mz) => addBox(staticGrp, 0.18, wH, 0.18, brushedTiMat, 0.09, wMidY, mz, false));
  addLocalCol(0.0, 0.0, 0.16, 12.98);
  addLocalCol(0.0, 14.22, 0.16, OL);

  // 4C. East (Starboard) Exterior Wall (lx = 4.65..4.80) with Panoramic Windows along Bridge, Lounge & Galley!
  addBox(staticGrp, wT, 0.92, 9.40, hullDarkMat, OW - 0.075, FY + 0.46, 5.00, false);
  addBox(staticGrp, wT, 0.40, 9.40, hullDarkMat, OW - 0.075, CY - 0.20, 5.00, false);
  addBox(staticGrp, 0.05, 1.88, 9.15, canopyGlassMat, OW - 0.075, FY + 0.92 + 0.94, 5.025, false);
  // Solid Bath Pod & Engine Gallery East Wall (lz: 9.70..15.60)
  addBox(staticGrp, wT, wH, 5.90, hullDarkMat, OW - 0.075, wMidY, 12.65, false);
  [3.50, 6.90, 9.65].forEach((mz) => addBox(staticGrp, 0.18, wH, 0.18, brushedTiMat, OW - 0.09, wMidY, mz, false));
  addLocalCol(OW - 0.16, 0.0, OW, OL);

  // 4D. Rear Bulkhead (lz = 15.30..15.60) with Rear Boarding Ramp Opening DK11-R (lx: 1.80..3.00, H: 2.25m)!
  addBox(staticGrp, 1.80, wH, 0.30, hullDarkMat, 0.90, wMidY, 15.45, false);
  addBox(staticGrp, 1.80, wH, 0.30, hullDarkMat, 3.90, wMidY, 15.45, false);
  addBox(staticGrp, 1.20, wH - 2.25, 0.30, hullDarkMat, 2.40, FY + 2.25 + (wH - 2.25) * 0.5, 15.45, false);
  addLocalCol(0.0, 15.28, 1.78, OL);
  addLocalCol(3.02, 15.28, OW, OL);

  // ---- AUTOMATIC AIRLOCK DOORS & DEPLOYABLE BOARDING AIRSTAIR RAMP ----
  // 1) West Boarding Airlock Door (DK11-W: slides along Z, sealed automatically while airborne!)
  const westDoorPivot = new THREE.Group();
  westDoorPivot.position.set(0.08, FY + 1.12, 13.60);
  addBox(westDoorPivot, 0.09, 2.24, 1.18, brushedTiMat, 0, 0, 0, false);
  addBox(westDoorPivot, 0.11, 0.72, 0.42, canopyGlassMat, 0, 0.32, 0, false);
  dynamicGrp.add(westDoorPivot);
  interactiveDoors.push({
    id: 'DK11-W',
    floor: 1,
    isK11: true,
    isExteriorAirlock: true,
    kind: 'pocket',
    axis: 'z',
    pivot: westDoorPivot,
    mesh: westDoorPivot.children[0],
    closedPos: { x: 0.08, z: 13.60 },
    slideDelta: -1.12,
    collider: { minX: -0.05, minZ: 12.98, maxX: 0.22, maxZ: 14.22 },
    isOpen: false,
    progress: 0,
    autoHoldTimer: 0,
  });

  // 2) Rear Boarding Airlock Hatch + Deployable Airstair Ramp (DK11-R: hinges outward down to ground when landed!)
  const rearRampPivot = new THREE.Group();
  rearRampPivot.position.set(2.40, FY, 15.45);
  const rearDoorPanel = addBox(rearRampPivot, 1.18, 2.24, 0.10, brushedTiMat, 0, 1.12, 0, false);
  addBox(rearRampPivot, 1.06, 0.04, 0.12, cyanGlowMat, 0, 0.50, 0.02, false);
  addBox(rearRampPivot, 1.06, 0.04, 0.12, cyanGlowMat, 0, 1.10, 0.02, false);
  addBox(rearRampPivot, 1.06, 0.04, 0.12, cyanGlowMat, 0, 1.70, 0.02, false);
  dynamicGrp.add(rearRampPivot);
  interactiveDoors.push({
    id: 'DK11-R',
    floor: 1,
    isK11: true,
    isExteriorAirlock: true,
    kind: 'liftgate',
    pivot: rearRampPivot,
    mesh: rearDoorPanel,
    openAngle: Math.PI * 0.62, // Folds cleanly outward & down to form boarding ramp!
    collider: { minX: 1.78, minZ: 15.25, maxX: 3.02, maxZ: 15.65 },
    isOpen: false,
    progress: 0,
    autoHoldTimer: 0,
  });

  // ---- INTERIOR PARTITIONS (Bath Pod K05 + Master Bedroom Privacy Divider) ----
  // Bath Pod North Wall (lx: 2.95..4.65, lz: 9.65..9.75) & South Wall (lz: 12.25..12.35)
  addBox(staticGrp, 1.70, wH, 0.10, creamWallMat, 3.80, wMidY, 9.70, false);
  addBox(staticGrp, 1.70, wH, 0.10, creamWallMat, 3.80, wMidY, 12.30, false);
  addLocalCol(2.92, 9.64, 4.66, 9.76);
  addLocalCol(2.92, 12.24, 4.66, 12.36);
  // Bath Pod West Wall (lx: 2.95..3.05) with automatic sliding door DK11-B (lz: 10.50..11.35)
  addBox(staticGrp, 0.10, wH, 0.80, creamWallMat, 3.00, wMidY, 10.10, false);
  addBox(staticGrp, 0.10, wH, 0.95, creamWallMat, 3.00, wMidY, 11.825, false);
  addBox(staticGrp, 0.10, wH - 2.15, 0.85, creamWallMat, 3.00, FY + 2.15 + (wH - 2.15) * 0.5, 10.925, false);
  addLocalCol(2.92, 9.70, 3.08, 10.48);
  addLocalCol(2.92, 11.37, 3.08, 12.30);

  const bathDoorPivot = new THREE.Group();
  bathDoorPivot.position.set(3.00, FY + 1.07, 10.925);
  const bathDoorMesh = addBox(bathDoorPivot, 0.06, 2.14, 0.86, walnutMat, 0, 0, 0, false);
  dynamicGrp.add(bathDoorPivot);
  interactiveDoors.push({
    id: 'DK11-B',
    floor: 1,
    isK11: true,
    kind: 'pocket',
    axis: 'z',
    pivot: bathDoorPivot,
    mesh: bathDoorMesh,
    closedPos: { x: 3.00, z: 10.925 },
    slideDelta: 0.80,
    collider: { minX: 2.92, minZ: 10.48, maxX: 3.08, maxZ: 11.37 },
    isOpen: false,
    progress: 0,
    autoHoldTimer: 0,
  });

  // Subtle decorative partial screen between K03 Galley & K04 Master Quarters (lx: 0.15..1.65, lz: 9.70)
  addBox(staticGrp, 1.50, wH, 0.10, walnutMat, 0.90, wMidY, 9.70, false);
  addLocalCol(0.15, 9.64, 1.66, 9.76);

  // =========================================================================
  // 5. LUXURY LIVE-IN FURNISHINGS & INTERACTIVE CONSOLES (ZONES K01 .. K06)
  // =========================================================================

  // ---- K01: PANORAMIC FLIGHT BRIDGE (lz: 0.30..3.50) ----
  // Wraparound aerospace flight console desk
  addBox(staticGrp, 3.40, 0.88, 0.68, hullDarkMat, envCx, FY + 0.44, 0.72, false);
  addBox(staticGrp, 3.44, 0.05, 0.72, brushedTiMat, envCx, FY + 0.90, 0.72, false);
  addLocalCol(0.70, 0.35, 4.10, 1.08);

  // Live Dynamic Glass Cockpit Multi-Function Display (CanvasTexture updating Speed/Fuel/Alt/Wind/Autopilot/Camper!)
  const mfdCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (mfdCanvas) { mfdCanvas.width = 640; mfdCanvas.height = 256; }
  const mfdTex = mfdCanvas ? new THREE.CanvasTexture(mfdCanvas) : null;
  if (mfdTex) mfdTex.colorSpace = THREE.SRGBColorSpace;
  const mfdMat = mfdTex
    ? new THREE.MeshStandardMaterial({ map: mfdTex, emissiveMap: mfdTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.05, roughness: 0.18 })
    : new THREE.MeshStandardMaterial({ color: 0x0ea5e9 });
  const mfdMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.62), mfdMat);
  mfdMesh.position.set(envCx, FY + 1.24, 0.76);
  mfdMesh.rotation.x = -0.26;
  dynamicGrp.add(mfdMesh);

  let lastMfdSig = '';
  function updateCockpitMFD(info) {
    if (!mfdCanvas || !mfdTex) return;
    const spd = Math.round(info.speedKmh || 0);
    const alt = Math.round(info.altAgl || 0);
    const fuel = (info.fuelL ?? 100).toFixed(1);
    const rng = Math.round((info.fuelL ?? 100) * 3.0);
    const wKmh = Math.round(info.windKmh || 0);
    const autoTxt = info.autopilotActive ? 'AUTO: ENGAGED' : 'MANUAL FLIGHT';
    const sig = `${spd}|${alt}|${fuel}|${wKmh}|${autoTxt}|${info.siloState || ''}`;
    if (sig === lastMfdSig) return;
    lastMfdSig = sig;
    const c = mfdCanvas.getContext('2d');
    c.fillStyle = '#040a14';
    c.fillRect(0, 0, 640, 256);
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 632, 248);
    // Header
    c.fillStyle = '#38bdf8';
    c.font = '900 18px monospace';
    c.textAlign = 'left';
    c.fillText('K-11 // TECNICA FORCES MFD', 20, 32);
    c.fillStyle = info.autopilotActive ? '#34d399' : '#94a3b8';
    c.textAlign = 'right';
    c.fillText(autoTxt, 620, 32);
    // Big Speed & Altitude Readouts
    c.fillStyle = '#ffffff';
    c.font = '900 56px monospace';
    c.textAlign = 'left';
    c.fillText(`${spd}`, 24, 110);
    c.font = '700 20px monospace';
    c.fillStyle = '#94a3b8';
    c.fillText('km/h (MAX 250)', 142, 110);
    c.fillStyle = '#fde68a';
    c.font = '900 44px monospace';
    c.textAlign = 'right';
    c.fillText(`${alt}m AGL`, 616, 108);
    // Fuel Bar (100L = 300km, 1L = 3km!)
    const fPct = Math.max(0, Math.min(1, (info.fuelL ?? 100) / 100.0));
    c.fillStyle = '#1e293b';
    c.fillRect(24, 148, 592, 24);
    c.fillStyle = fPct > 0.25 ? '#10b981' : (fPct > 0.12 ? '#f59e0b' : '#ef4444');
    c.fillRect(24, 148, Math.round(592 * fPct), 24);
    c.fillStyle = '#e2e8f0';
    c.font = '700 20px monospace';
    c.textAlign = 'left';
    c.fillText(`FUEL: ${fuel}L / 100L (RANGE ${rng}km • 1L=3km)`, 24, 204);
    c.fillStyle = '#7dd3fc';
    c.textAlign = 'right';
    c.fillText(`WIND: ${wKmh} km/h`, 616, 204);
    c.fillStyle = '#64748b';
    c.font = '700 16px sans-serif';
    c.textAlign = 'left';
    c.fillText(`SILO: ${info.siloState || 'READY'}  |  RV/装甲 呼出システム待機`, 24, 236);
    mfdTex.needsUpdate = true;
  }

  // Captain's Ergonomic Pilot Chair ([E] 操縦)
  const seatGroup = new THREE.Group();
  seatGroup.position.set(envCx, FY, 1.58);
  addBox(seatGroup, 0.64, 0.44, 0.62, carbonMat, 0, 0.22, 0, false);
  const pilotChairMesh = addBox(seatGroup, 0.68, 0.14, 0.64, leatherMat, 0, 0.50, 0, false);
  addBox(seatGroup, 0.64, 0.88, 0.14, leatherMat, 0, 0.96, 0.26, false);
  addBox(seatGroup, 0.48, 0.08, 0.08, goldTrimMat, 0, 1.44, 0.26, false);
  pilotChairMesh.userData.propId = 'k11_pilot';
  dynamicGrp.add(seatGroup);
  interactiveProps.push({
    id: 'k11_pilot',
    floor: 1,
    isK11Prop: true,
    mesh: pilotChairMesh,
    getLabel() { return 'K-11 操縦席'; },
  });

  // Physical 3D Interactive Bridge Buttons (Accessible walking inside Bridge!)
  const bridgeBtnSpecs = [
    { id: 'k11_btn_silo', label: '格納昇降', accent: '#f59e0b', x: 1.05, prompt: 'SILO-40 屋根・昇降' },
    { id: 'k11_btn_call_rv', label: 'RV呼出', accent: '#38bdf8', x: 3.55, prompt: 'RVを現在地へ呼出' },
    { id: 'k11_btn_call_armor', label: '装甲呼出', accent: '#10b981', x: 3.92, prompt: '装甲RVを現在地へ呼出' },
  ];
  bridgeBtnSpecs.forEach((bs) => {
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.22, 0.08), makeBtnMat(bs.label, bs.accent));
    bm.position.set(bs.x, FY + 1.04, 0.96);
    bm.rotation.x = -0.35;
    bm.userData.propId = bs.id;
    dynamicGrp.add(bm);
    interactiveProps.push({
      id: bs.id,
      floor: 1,
      isK11Prop: true,
      mesh: bm,
      getLabel() { return bs.prompt; },
    });
  });

  // "tecnica forces" Titanium Builder's Commemorative Plaque on Port Bridge Pillar!
  const plaqueMat = makePanelMat([
    { text: 'TECNICA FORCES  —  UNIT K-11', font: '900 28px sans-serif', color: '#fde68a' },
    { text: 'FOUNDER + 9 ELITE VOLUNTEER ENGINEERS', font: '700 20px monospace', color: '#38bdf8' },
    { text: '2-YEAR DEVELOPMENT  •  4 BREAKTHROUGHS', font: '700 18px monospace', color: '#e2e8f0' },
  ], '#111822', '#d4a954', 512, 160);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.46), plaqueMat);
  plaque.rotation.y = Math.PI * 0.5;
  plaque.position.set(0.18, FY + 1.55, 2.55);
  staticGrp.add(plaque);

  // ---- K02: PANORAMIC OBSERVATION LOUNGE (lz: 3.50..6.90) ----
  // L-Shaped Luxury Leather Aviation Sofa along East Window
  addBox(staticGrp, 0.92, 0.44, 2.90, leatherMat, 4.10, FY + 0.22, 5.20, false);
  addBox(staticGrp, 0.22, 0.92, 2.90, leatherMat, 4.48, FY + 0.46, 5.20, false);
  addLocalCol(3.62, 3.72, 4.62, 6.68);
  // Sleek Walnut & Glass Tactical Briefing Table
  addBox(staticGrp, 0.82, 0.06, 1.85, walnutMat, 2.92, FY + 0.66, 5.20, false);
  addBox(staticGrp, 0.12, 0.64, 0.12, brushedTiMat, 2.92, FY + 0.32, 4.55, false);
  addBox(staticGrp, 0.12, 0.64, 0.12, brushedTiMat, 2.92, FY + 0.32, 5.85, false);
  addLocalCol(2.50, 4.26, 3.34, 6.14);
  // West Aviation Bookshelf & Instrument Sideboard
  addBox(staticGrp, 0.46, 0.90, 2.40, walnutMat, 0.42, FY + 0.45, 5.20, false);
  addLocalCol(0.16, 3.98, 0.68, 6.42);

  // ---- K03: LIVE-IN GALLEY & DINING BAR (lz: 6.90..9.70) ----
  // East Aircraft Galley Counter + Induction Stove + Espresso Machine + Tall Fridge
  addBox(staticGrp, 0.80, 0.90, 2.50, walnutMat, 4.22, FY + 0.45, 8.30, false);
  addBox(staticGrp, 0.82, 0.05, 2.52, brushedTiMat, 4.22, FY + 0.92, 8.30, false);
  addBox(staticGrp, 0.48, 0.03, 0.56, carbonMat, 4.18, FY + 0.96, 7.75, false); // IH Burner
  addBox(staticGrp, 0.32, 0.42, 0.30, brushedTiMat, 4.28, FY + 1.15, 8.65, false); // Espresso
  addBox(staticGrp, 0.72, 2.05, 0.68, brushedTiMat, 4.26, FY + 1.025, 9.28, false); // Tall Aircraft Fridge
  addLocalCol(3.80, 7.02, 4.64, 9.64);
  // West 4-Seat Aviation Dining Booth
  addBox(staticGrp, 1.15, 0.74, 0.88, walnutMat, 0.80, FY + 0.37, 8.30, false);
  addBox(staticGrp, 1.10, 0.46, 0.48, leatherMat, 0.76, FY + 0.23, 7.50, false);
  addBox(staticGrp, 1.10, 0.46, 0.48, leatherMat, 0.76, FY + 0.23, 9.10, false);
  addLocalCol(0.18, 7.24, 1.40, 9.36);

  // ---- K04: MASTER LIVE-IN QUARTERS (lx: 0.15..2.90, lz: 9.70..12.30) ----
  addBox(staticGrp, 1.65, 0.46, 2.10, walnutMat, 1.04, FY + 0.23, 11.12, false);
  addBox(staticGrp, 1.58, 0.18, 2.02, linenMat, 1.04, FY + 0.54, 11.12, false);
  addBox(staticGrp, 1.56, 0.12, 1.38, duvetMat, 1.04, FY + 0.65, 11.40, false);
  addBox(staticGrp, 0.55, 0.12, 0.34, linenMat, 0.68, FY + 0.66, 10.35, false);
  addBox(staticGrp, 0.55, 0.12, 0.34, linenMat, 1.40, FY + 0.66, 10.35, false);
  addLocalCol(0.18, 10.02, 1.88, 12.22);

  // ---- K05: PRESSURIZED SHOWER & LAVATORY POD (lx: 3.00..4.65, lz: 9.70..12.30) ----
  addBox(staticGrp, 0.05, 2.25, 1.10, canopyGlassMat, 3.65, FY + 1.125, 10.30, false); // Glass shower screen
  addBox(staticGrp, 0.55, 0.84, 0.90, creamWallMat, 4.35, FY + 0.42, 11.55, false); // Vanity
  addBox(staticGrp, 0.04, 0.80, 0.72, brushedTiMat, 4.61, FY + 1.45, 11.55, false); // Mirror
  addLocalCol(4.06, 11.08, 4.64, 12.20);

  // ---- K06: TF-E11 CUSTOM ENGINE GALLERY & LIVE 100L FUEL GAUGE (lz: 12.30..15.30) ----
  // Glowing TF-E11 High-Efficiency Rotary-Turbo Hybrid Engine Core behind armored glass (East Rear Corner!)
  const engineHousing = new THREE.Group();
  engineHousing.position.set(3.85, FY + 1.25, 13.95);
  dynamicGrp.add(engineHousing);
  addBox(staticGrp, 1.25, 2.65, 1.95, hullDarkMat, 3.95, FY + 1.325, 13.95, false);
  addBox(staticGrp, 0.06, 1.85, 1.60, canopyGlassMat, 3.30, FY + 1.35, 13.95, false);
  const engineCore = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.25, 14), cyanGlowMat);
  engineCore.rotation.x = Math.PI * 0.5;
  engineHousing.add(engineCore);
  const engineRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 10, 18), goldTrimMat);
  engineHousing.add(engineRing);
  addLocalCol(3.28, 12.92, 4.64, 14.98);

  // Live 100.0 L Vertical Fuel Tank Sight Gauge (West Rear Wall, dynamically reflects K-11 Fuel!)
  addBox(staticGrp, 0.24, 1.90, 0.36, hullDarkMat, 0.34, FY + 1.25, 14.70, false);
  const fuelBarMat = new THREE.MeshStandardMaterial({
    color: 0x34d399, emissive: new THREE.Color(0x10b981), emissiveIntensity: 1.5,
  });
  const fuelBarMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.66, 0.20), fuelBarMat);
  fuelBarMesh.position.set(0.44, FY + 1.25, 14.70);
  dynamicGrp.add(fuelBarMesh);

  // ---- K-11 INTERIOR LIGHTING (3 Curated Warm/Cyan Cabin Lights for POCO F7 GPU Budget!) ----
  const k11Lights = [
    { name: 'K11_Bridge', pos: [envCx, CY - 0.28, 2.10], col: 0xdbeafe, int: 2.2, dist: 10 },
    { name: 'K11_Salon',  pos: [envCx, CY - 0.28, 7.20], col: 0xffe8c8, int: 2.6, dist: 12 },
    { name: 'K11_Rear',   pos: [envCx, CY - 0.28, 12.6], col: 0xe0f2fe, int: 2.2, dist: 10 },
  ];
  k11Lights.forEach((cfg) => {
    const l = new THREE.PointLight(cfg.col, cfg.int, cfg.dist, 1.5);
    l.position.set(...cfg.pos);
    l.userData.building = 'k11';
    localOrigin.add(l);
    interiorLights.push({ name: cfg.name, floor: 1, zone: 'k11', light: l, baseInt: cfg.int });
  });

  // Forward High-Beam Landing / Searchlights (2 SpotLights mounted under Nose!)
  const headlights = [];
  [-1.2, 1.2].forEach((hx) => {
    const sp = new THREE.SpotLight(0xe0f2fe, 0.0, 95, Math.PI * 0.28, 0.45, 1.2);
    sp.position.set(envCx + hx, FY + 0.15, 0.10);
    const tgt = new THREE.Object3D();
    tgt.position.set(envCx + hx * 1.4, FY - 4.0, -32.0);
    localOrigin.add(tgt);
    sp.target = tgt;
    localOrigin.add(sp);
    headlights.push(sp);
  });

  const { batchedGroup, stats: batchStats } = batchStaticGroups([staticGrp]);
  localOrigin.add(batchedGroup);

  // =========================================================================
  // 6. K-11 LIVE POSE, PHYSICS & VISUAL ANIMATION STATE
  // =========================================================================
  const state = {
    root,
    tiltGroup,
    localOrigin,
    headlights,
    headlightsOn: false,
    localColliders,
    batchStats,

    // World Pose (cx, y, cz, yaw) — y = bottom of landing skids!
    pose: {
      cx: NULL_EREA.originX,
      y: b40Y,
      cz: NULL_EREA.originZ,
      yaw: AIRSHIP_K11.initialPose.yaw,
    },
    velX: 0,
    velY: 0,
    velZ: 0,
    speed: 0,           // Forward scalar speed (m/s)
    groundSpeedKmh: 0,
    altitudeAGL: 0,
    pitchAngle: 0,
    rollAngle: 0,
    yawRate: 0,
    nacellePitch: Math.PI * 0.48, // Vertical VTOL at rest -> tilts smoothly to 0° horizontal for 250 km/h cruise!
    gearDeploy: 1.0,    // 1.0 = skids deployed, 0.0 = retracted in flight!
    dockedInSilo: true, // True while resting on SILO-40 Mega-Lift Platform!

    // Breakthrough 1: 1L = 3.0 km, Max 100.0 L (300.0 km range!)
    fuelL: AIRSHIP_K11.maxFuelL,
    totalDistKm: 0,
    windSpeedKmh: 0,

    syncTransform() {
      root.position.set(this.pose.cx, this.pose.y, this.pose.cz);
      root.rotation.y = this.pose.yaw;
      tiltGroup.rotation.x = this.pitchAngle;
      tiltGroup.rotation.z = this.rollAngle;
    },

    updateVisuals(dt, elapsed, info = {}) {
      // 1. Vectoring Nacelles smoothly pitch from vertical (hover/VTOL) to horizontal (high-speed cruise!)
      const spdNorm = Math.min(1.0, Math.hypot(this.velX, this.velZ) / AIRSHIP_K11.maxSpeedMs);
      const targetNac = (1.0 - Math.min(1.0, spdNorm * 2.4)) * (Math.PI * 0.46);
      this.nacellePitch += (targetNac - this.nacellePitch) * Math.min(1, dt * 4.5);
      nacelles.forEach((n) => { n.rotation.x = this.nacellePitch; });

      // 2. Spin Coaxial Propellers & TF-E11 Glowing Engine Core
      const airborne = !this.dockedInSilo || this.altitudeAGL > 0.35;
      const propRate = airborne ? (10.0 + spdNorm * 34.0) : (info.isPiloted ? 4.5 : 0.4);
      propellers.forEach((p) => { p.prop.rotation.z += p.dir * propRate * dt; });
      engineRing.rotation.z += (1.2 + spdNorm * 8.0) * dt;
      engineCore.material.emissiveIntensity = 1.1 + spdNorm * 1.4 + Math.sin(elapsed * 5.0) * 0.15;

      // 3. Retractable Landing Skids (smoothly fold up above 6m AGL!)
      const wantGear = (this.dockedInSilo || this.altitudeAGL < 6.0) ? 1.0 : 0.0;
      this.gearDeploy += (wantGear - this.gearDeploy) * Math.min(1, dt * 2.6);
      landingGearGroup.position.y = (1.0 - this.gearDeploy) * 0.56;
      landingGearGroup.scale.y = 0.22 + 0.78 * this.gearDeploy;

      // 4. Update Live 100L Sight Gauge in K06 Engine Gallery
      const fPct = Math.max(0.01, Math.min(1.0, this.fuelL / AIRSHIP_K11.maxFuelL));
      fuelBarMesh.scale.y = fPct;
      fuelBarMesh.position.y = FY + 0.42 + (1.66 * fPct) * 0.5;
      if (fPct > 0.25) {
        fuelBarMat.color.setHex(0x34d399);
        fuelBarMat.emissive.setHex(0x10b981);
      } else if (fPct > 0.12) {
        fuelBarMat.color.setHex(0xfde047);
        fuelBarMat.emissive.setHex(0xf59e0b);
      } else {
        fuelBarMat.color.setHex(0xf87171);
        fuelBarMat.emissive.setHex(0xef4444);
      }

      // 5. Update Live Glass Cockpit MFD Display
      updateCockpitMFD({
        speedKmh: this.groundSpeedKmh,
        altAgl: this.altitudeAGL,
        fuelL: this.fuelL,
        windKmh: this.windSpeedKmh,
        autopilotActive: Boolean(info.autopilotActive),
        siloState: info.siloState || 'READY',
      });

      this.syncTransform();
    },
  };

  state.updateVisuals(0.016, 0, { siloState: 'B40F STORED' });
  return state;
}
