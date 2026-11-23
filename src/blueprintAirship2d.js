import {
  NULL_EREA, NULL_ELEVATOR, NULL_SILO_MECHANISM, AIRSHIP_K11,
  NULL_HANGAR_PLAN, AIRSHIP_K11_PLAN,
} from './airshipData.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  if (text !== null) node.textContent = text;
  return node;
}

function addDimH(g, x1, x2, y, label, opts = {}) {
  const col = opts.color || '#1f2937';
  const extFrom = opts.extFrom ?? y;
  const fs = opts.fontSize || 7.2;
  const bold = opts.bold ? 700 : 500;
  if (extFrom !== y) {
    const dir = y > extFrom ? 1 : -1;
    g.appendChild(el('line', { x1, y1: extFrom + dir * 2, x2: x1, y2: y + dir * 5, stroke: col, 'stroke-width': 0.55, opacity: 0.7 }));
    g.appendChild(el('line', { x1: x2, y1: extFrom + dir * 2, x2: x2, y2: y + dir * 5, stroke: col, 'stroke-width': 0.55, opacity: 0.7 }));
  }
  g.appendChild(el('line', { x1, y1: y, x2, y2: y, stroke: col, 'stroke-width': 0.8 }));
  // JIS 45-degree architectural ticks
  g.appendChild(el('line', { x1: x1 - 3, y1: y + 3, x2: x1 + 3, y2: y - 3, stroke: col, 'stroke-width': 1.1 }));
  g.appendChild(el('line', { x1: x2 - 3, y1: y + 3, x2: x2 + 3, y2: y - 3, stroke: col, 'stroke-width': 1.1 }));
  const mx = (x1 + x2) * 0.5;
  g.appendChild(el('rect', { x: mx - label.length * fs * 0.34, y: y - fs - 2.2, width: label.length * fs * 0.68, height: fs + 2, fill: '#faf7f1', opacity: 0.88 }));
  g.appendChild(el('text', { x: mx, y: y - 3, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': bold, 'font-family': 'monospace', fill: col }, label));
}

function addDimV(g, x, y1, y2, label, opts = {}) {
  const col = opts.color || '#1f2937';
  const extFrom = opts.extFrom ?? x;
  const fs = opts.fontSize || 7.2;
  const bold = opts.bold ? 700 : 500;
  if (extFrom !== x) {
    const dir = x > extFrom ? 1 : -1;
    g.appendChild(el('line', { x1: extFrom + dir * 2, y1, x2: x + dir * 5, y2: y1, stroke: col, 'stroke-width': 0.55, opacity: 0.7 }));
    g.appendChild(el('line', { x1: extFrom + dir * 2, y1: y2, x2: x + dir * 5, y2: y2, stroke: col, 'stroke-width': 0.55, opacity: 0.7 }));
  }
  g.appendChild(el('line', { x1: x, y1, x2: x, y2, stroke: col, 'stroke-width': 0.8 }));
  g.appendChild(el('line', { x1: x - 3, y1: y1 + 3, x2: x + 3, y2: y1 - 3, stroke: col, 'stroke-width': 1.1 }));
  g.appendChild(el('line', { x1: x - 3, y1: y2 + 3, x2: x + 3, y2: y2 - 3, stroke: col, 'stroke-width': 1.1 }));
  const my = (y1 + y2) * 0.5;
  g.appendChild(el('text', {
    x: x - 4, y: my, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': bold,
    'font-family': 'monospace', fill: col, transform: `rotate(-90 ${x - 4} ${my})`,
  }, label));
}

function addPanelFrame(svg, x, y, w, h, numBadge, title, scaleTxt, accent = '#0f4c81') {
  const g = el('g');
  g.appendChild(el('rect', { x, y, width: w, height: h, fill: '#ffffff', stroke: '#2c2f36', 'stroke-width': 1.25 }));
  g.appendChild(el('rect', { x, y, width: w, height: 22, fill: '#f1ede4', stroke: '#2c2f36', 'stroke-width': 0.8 }));
  g.appendChild(el('rect', { x: x + 1, y: y + 1, width: 24, height: 20, fill: accent }));
  g.appendChild(el('text', { x: x + 13, y: y + 14.5, 'text-anchor': 'middle', 'font-size': 9.2, 'font-weight': 800, fill: '#ffffff', 'font-family': 'monospace' }, numBadge));
  g.appendChild(el('text', { x: x + 32, y: y + 14.5, 'font-size': 8.6, 'font-weight': 800, fill: '#1c1e22', 'letter-spacing': 0.2 }, title));
  if (scaleTxt) {
    g.appendChild(el('text', { x: x + w - 10, y: y + 14.2, 'text-anchor': 'end', 'font-size': 7.4, 'font-weight': 700, fill: accent, 'font-family': 'monospace' }, scaleTxt));
  }
  svg.appendChild(g);
  return g;
}

function addSharedEngineeringDefs(defs) {
  // Hazard yellow-charcoal stripe for Mega-Lift rim & blast doors
  const patHaz = el('pattern', { id: 'pat-hazard', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  patHaz.appendChild(el('rect', { width: 10, height: 10, fill: '#f59e0b' }));
  patHaz.appendChild(el('rect', { x: 0, y: 0, width: 5, height: 10, fill: '#1e293b' }));
  defs.appendChild(patHaz);

  // Titanium composite cross-hatch for K-11 structural envelope & hull frames
  const patTi = el('pattern', { id: 'pat-ti-mesh', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(30)' });
  patTi.appendChild(el('rect', { width: 8, height: 8, fill: '#eef4f8' }));
  patTi.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#94a3b8', 'stroke-width': 0.6 }));
  patTi.appendChild(el('line', { x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#cbd5e1', 'stroke-width': 0.45 }));
  defs.appendChild(patTi);

  // Helium gas cell subtle translucent gradient
  const gradHe = el('linearGradient', { id: 'grad-helium', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  gradHe.appendChild(el('stop', { offset: '0%', 'stop-color': '#bae6fd', 'stop-opacity': '0.52' }));
  gradHe.appendChild(el('stop', { offset: '60%', 'stop-color': '#e0f2fe', 'stop-opacity': '0.32' }));
  gradHe.appendChild(el('stop', { offset: '100%', 'stop-color': '#f8fafc', 'stop-opacity': '0.18' }));
  defs.appendChild(gradHe);

  // Reinforced rock-cut earth gradient for 40m underground silo section
  const patBedrock = el('pattern', { id: 'pat-bedrock', width: 18, height: 18, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  patBedrock.appendChild(el('rect', { width: 18, height: 18, fill: '#dfd9ce' }));
  patBedrock.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 18, stroke: '#a89f91', 'stroke-width': 1.2 }));
  patBedrock.appendChild(el('line', { x1: 6, y1: 0, x2: 6, y2: 18, stroke: '#bab1a3', 'stroke-width': 0.8 }));
  patBedrock.appendChild(el('line', { x1: 12, y1: 0, x2: 12, y2: 18, stroke: '#c7bfb2', 'stroke-width': 0.6, 'stroke-dasharray': '4 3' }));
  defs.appendChild(patBedrock);

  // Teak deck subtle grain for K-11 live-in cabin
  const patTeak = el('pattern', { id: 'pat-teak', width: 24, height: 6, patternUnits: 'userSpaceOnUse' });
  patTeak.appendChild(el('rect', { width: 24, height: 6, fill: '#f3e5cf' }));
  patTeak.appendChild(el('line', { x1: 0, y1: 6, x2: 24, y2: 6, stroke: '#d6be9c', 'stroke-width': 0.7 }));
  defs.appendChild(patTeak);

  // Cyan directional arrow marker
  const mCyan = el('marker', { id: 'arr-cyan', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  mCyan.appendChild(el('path', { d: 'M 0 1 L 10 5 L 0 9 z', fill: '#0284c7' }));
  defs.appendChild(mCyan);

  const mAmber = el('marker', { id: 'arr-amber', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  mAmber.appendChild(el('path', { d: 'M 0 1 L 10 5 L 0 9 z', fill: '#d97706' }));
  defs.appendChild(mAmber);

  const mGreen = el('marker', { id: 'arr-green', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  mGreen.appendChild(el('path', { d: 'M 0 1 L 10 5 L 0 9 z', fill: '#059669' }));
  defs.appendChild(mGreen);
}

function addSheetBorderAndZones(svg, VW, VH, dwgNo, title, subtitle, northLabel = 'N') {
  // Paper background & double JIS border
  svg.appendChild(el('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#faf7f1' }));
  svg.appendChild(el('rect', { x: 12, y: 12, width: VW - 24, height: VH - 24, fill: 'none', stroke: '#1e293b', 'stroke-width': 1.8 }));
  svg.appendChild(el('rect', { x: 24, y: 24, width: VW - 48, height: VH - 48, fill: 'none', stroke: '#475569', 'stroke-width': 0.85 }));

  // Perimeter JIS Alpha-Numeric Sheet Zone Ticks (1..8 horizontal, A..F vertical)
  const cols = 8;
  const rows = 6;
  for (let i = 1; i < cols; i++) {
    const tx = 24 + ((VW - 48) * i) / cols;
    svg.appendChild(el('line', { x1: tx, y1: 12, x2: tx, y2: 24, stroke: '#64748b', 'stroke-width': 0.6 }));
    svg.appendChild(el('line', { x1: tx, y1: VH - 24, x2: tx, y2: VH - 12, stroke: '#64748b', 'stroke-width': 0.6 }));
  }
  for (let i = 0; i < cols; i++) {
    const cx = 24 + ((VW - 48) * (i + 0.5)) / cols;
    svg.appendChild(el('text', { x: cx, y: 21, 'text-anchor': 'middle', 'font-size': 7.0, 'font-family': 'monospace', fill: '#64748b' }, String(i + 1)));
    svg.appendChild(el('text', { x: cx, y: VH - 15, 'text-anchor': 'middle', 'font-size': 7.0, 'font-family': 'monospace', fill: '#64748b' }, String(i + 1)));
  }
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (let i = 1; i < rows; i++) {
    const ty = 24 + ((VH - 48) * i) / rows;
    svg.appendChild(el('line', { x1: 12, y1: ty, x2: 24, y2: ty, stroke: '#64748b', 'stroke-width': 0.6 }));
    svg.appendChild(el('line', { x1: VW - 24, y1: ty, x2: VW - 12, y2: ty, stroke: '#64748b', 'stroke-width': 0.6 }));
  }
  for (let i = 0; i < rows; i++) {
    const cy = 24 + ((VH - 48) * (i + 0.5)) / rows + 2.5;
    svg.appendChild(el('text', { x: 18, y: cy, 'text-anchor': 'middle', 'font-size': 7.0, 'font-family': 'monospace', fill: '#64748b' }, letters[i]));
    svg.appendChild(el('text', { x: VW - 18, y: cy, 'text-anchor': 'middle', 'font-size': 7.0, 'font-family': 'monospace', fill: '#64748b' }, letters[i]));
  }

  // Top Header Strip
  svg.appendChild(el('rect', { x: 34, y: 32, width: VW - 68, height: 42, fill: '#ffffff', stroke: '#1e293b', 'stroke-width': 1.1 }));
  svg.appendChild(el('rect', { x: 34, y: 32, width: 136, height: 42, fill: '#0f172a' }));
  svg.appendChild(el('text', { x: 102, y: 49, 'text-anchor': 'middle', 'font-size': 9.4, 'font-weight': 900, fill: '#38bdf8', 'font-family': 'monospace', 'letter-spacing': 0.6 }, 'TECNICA FORCES'));
  svg.appendChild(el('text', { x: 102, y: 65, 'text-anchor': 'middle', 'font-size': 8.2, 'font-weight': 700, fill: '#fde68a', 'font-family': 'monospace' }, dwgNo));

  svg.appendChild(el('text', { x: 184, y: 50, 'font-size': 12.2, 'font-weight': 800, fill: '#0f172a', 'letter-spacing': 0.3 }, title));
  svg.appendChild(el('text', { x: 184, y: 66, 'font-size': 8.2, fill: '#475569' }, subtitle));

  // Precision North Compass Rose
  const nc = el('g', { transform: `translate(${VW - 62}, 53)` });
  nc.appendChild(el('circle', { cx: 0, cy: 0, r: 15.5, fill: '#faf7f1', stroke: '#1e293b', 'stroke-width': 1.1 }));
  nc.appendChild(el('circle', { cx: 0, cy: 0, r: 12.2, fill: 'none', stroke: '#94a3b8', 'stroke-width': 0.5, 'stroke-dasharray': '2 2' }));
  nc.appendChild(el('polygon', { points: '0,-13 -4,2 0,-2 4,2', fill: '#0f172a' }));
  nc.appendChild(el('polygon', { points: '0,13 -3.5,2 0,5.5 3.5,2', fill: 'none', stroke: '#0f172a', 'stroke-width': 0.75 }));
  nc.appendChild(el('text', { x: 0, y: -17.5, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 800, fill: '#0f172a', 'font-family': 'monospace' }, northLabel));
  svg.appendChild(nc);
}

// =========================================================================
// SHEET 23: NULL EREA 地下40m 飛行船格納庫「SILO-40」・44枚開閉屋根・40m高速ELV
// =========================================================================
export function buildNullHangarBlueprintSVG(bp, svg, defs) {
  const VW = 1600;
  const VH = 1220;
  bp.curVW = VW;
  bp.curVH = VH;
  // Coordinate system for Panel ① (B40F Hangar Plan 47m × 54m) so live player red dot maps cleanly!
  bp.scale = 9.4;
  bp.padL = 178;
  bp.padT = 166;
  bp.padR = 0;
  bp.padB = 0;

  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  addSharedEngineeringDefs(defs);
  addSheetBorderAndZones(
    svg, VW, VH,
    'TF-NULL-A01',
    `実施設計 ${NULL_HANGAR_PLAN.titleJp}`,
    `立地: NULL EREA (南端整地 300×100m / X=0, Z=29,910) ｜ 基準床: B40FL -40,000 mm ｜ 4層44枚メカ屋根 ＋ 巨大40m高昇機 ＋ ELV-NULL 40m直通`,
    'N',
  );

  // Create standard toggleable layer groups so Blueprint UI layer checkboxes work!
  const layerNames = ['exterior', 'materials', 'grid', 'furniture', 'walls', 'openings', 'plumbing', 'outlets', 'lighting', 'flow', 'labels', 'dimensions', 'camera'];
  layerNames.forEach((n) => {
    const g = el('g', { id: `layer-${n}` });
    svg.appendChild(g);
    bp.layerGroups[n] = g;
  });

  const px = (x) => bp.px(x);
  const pz = (z) => bp.pz(z);
  const sc = bp.scale;

  // -------------------------------------------------------------------------
  // PANEL ①: B40FL -40,000 mm UNDERGROUND HANGAR PRECISION PLAN (S = 1/100)
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 34, 84, 792, 650, '①',
    '地下40m 飛行船格納庫「SILO-40」精密平面図（B40FL -40,000 mm）',
    'SCALE 1/100  |  47,000 × 54,000 mm', '#0f4c81',
  );

  // Rock-cut surrounding bedrock hatch around subterranean cavern
  bp.layerGroups.exterior.appendChild(el('rect', {
    x: px(-6.8), y: pz(-3.2), width: 56.8 * sc, height: 60.4 * sc,
    fill: 'url(#pat-bedrock)', stroke: '#64748b', 'stroke-width': 0.8,
  }));

  // Structural Room Floor Tints (S01..S04)
  const gMat = bp.layerGroups.materials;
  // Full B40F Excavated Structural Cavern Floor
  gMat.appendChild(el('rect', { x: px(0), y: pz(0), width: 47.0 * sc, height: 54.0 * sc, fill: '#eef2f6', stroke: '#1e293b', 'stroke-width': 1.8 }));
  // S03 Command Room
  gMat.appendChild(el('rect', { x: px(0.5), y: pz(5.0), width: 12.8 * sc, height: 15.0 * sc, fill: '#dce9f5', stroke: '#3b82f6', 'stroke-width': 0.8 }));
  // S02 West Concourse & ELV Airlock
  gMat.appendChild(el('rect', { x: px(0.5), y: pz(20.0), width: 12.8 * sc, height: 14.0 * sc, fill: '#e6edf3', stroke: '#64748b', 'stroke-width': 0.7 }));
  // S04 East 100L Fuel Bay & Heavy Maintenance Gallery
  gMat.appendChild(el('rect', { x: px(33.7), y: pz(6.0), width: 12.8 * sc, height: 42.0 * sc, fill: '#dfeee7', stroke: '#059669', 'stroke-width': 0.8 }));
  // S01 Central 40m Hydraulic Mega-Lift Pit & Platform (20.0 × 42.0m -> X: 13.5..33.5, Z: 6.0..48.0)
  gMat.appendChild(el('rect', { x: px(13.5), y: pz(6.0), width: 20.0 * sc, height: 42.0 * sc, fill: 'url(#pat-hazard)', stroke: '#0f172a', 'stroke-width': 1.6 }));
  gMat.appendChild(el('rect', { x: px(13.9), y: pz(6.7), width: 19.2 * sc, height: 40.6 * sc, fill: '#cfd8e3', stroke: '#0f172a', 'stroke-width': 1.3 }));

  // Grid Axes (NX1..NX4, NZ1..NZ4)
  const gGrid = bp.layerGroups.grid;
  const xAxes = [
    { id: 'NX1', m: 0.0 },
    { id: 'NX2', m: 13.5 },
    { id: 'NX3', m: 23.5 },
    { id: 'NX4', m: 33.5 },
    { id: 'NX5', m: 47.0 },
  ];
  const zAxes = [
    { id: 'NZ1', m: 0.0 },
    { id: 'NZ2', m: 6.0 },
    { id: 'NZ3', m: 27.0 },
    { id: 'NZ4', m: 48.0 },
    { id: 'NZ5', m: 54.0 },
  ];
  xAxes.forEach((ax) => {
    const gx = px(ax.m);
    gGrid.appendChild(el('line', { x1: gx, y1: pz(-5.2), x2: gx, y2: pz(56.4), stroke: '#94a3b8', 'stroke-width': 0.55, 'stroke-dasharray': '10 3 2 3' }));
    gGrid.appendChild(el('circle', { cx: gx, cy: pz(-5.2), r: 8.5, fill: '#fff', stroke: '#0f4c81', 'stroke-width': 0.9 }));
    gGrid.appendChild(el('text', { x: gx, y: pz(-5.2) + 2.8, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f4c81', 'font-family': 'monospace' }, ax.id));
  });
  zAxes.forEach((az) => {
    const gz = pz(az.m);
    gGrid.appendChild(el('line', { x1: px(-7.8), y1: gz, x2: px(49.5), y2: gz, stroke: '#94a3b8', 'stroke-width': 0.55, 'stroke-dasharray': '10 3 2 3' }));
    gGrid.appendChild(el('circle', { cx: px(-7.8), cy: gz, r: 8.5, fill: '#fff', stroke: '#0f4c81', 'stroke-width': 0.9 }));
    gGrid.appendChild(el('text', { x: px(-7.8), y: gz + 2.8, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f4c81', 'font-family': 'monospace' }, az.id));
  });

  // Reinforced 1.2m Subterranean RC Outer Walls & Partition Walls
  const gWall = bp.layerGroups.walls;
  const drawWallRect = (x, z, w, d, fill = 'url(#hatch-ext)') => {
    gWall.appendChild(el('rect', { x: px(x), y: pz(z), width: w * sc, height: d * sc, fill, stroke: '#0f172a', 'stroke-width': 1.0 }));
  };
  drawWallRect(-1.2, -1.2, 49.4, 1.2); // North RC retaining wall
  drawWallRect(-1.2, 54.0, 49.4, 1.2); // South RC retaining wall
  drawWallRect(47.0, 0.0, 1.2, 54.0);  // East RC retaining wall
  drawWallRect(-1.2, 0.0, 1.2, 25.0);  // West RC wall north of ELV-NULL
  drawWallRect(-1.2, 29.0, 1.2, 25.0); // West RC wall south of ELV-NULL
  // Command Room partition wall (glazed southern edge at Z=20.0)
  drawWallRect(0.5, 19.7, 9.2, 0.3, 'url(#hatch-int)');

  // ELV-NULL 40m High-Speed Elevator Shaft (world X=-26.2..-23.8 -> hangar X = -2.7..-0.3, Z = 25.8..28.2)
  const elvX = px(-2.7);
  const elvZ = pz(25.8);
  const elvW = 2.4 * sc;
  const elvD = 2.4 * sc;
  gWall.appendChild(el('rect', { x: elvX - 3, y: elvZ - 3, width: elvW + 6, height: elvD + 6, fill: 'url(#hatch-ext)', stroke: '#0f172a', 'stroke-width': 1.1 }));
  gWall.appendChild(el('rect', { x: elvX, y: elvZ, width: elvW, height: elvD, fill: '#dbeafe', stroke: '#0284c7', 'stroke-width': 1.8 }));
  gWall.appendChild(el('line', { x1: elvX, y1: elvZ, x2: elvX + elvW, y2: elvZ + elvD, stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  gWall.appendChild(el('line', { x1: elvX + elvW, y1: elvZ, x2: elvX, y2: elvZ + elvD, stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  // East center-opening high-speed door highlight
  bp.layerGroups.openings.appendChild(el('line', { x1: elvX + elvW, y1: pz(26.35), x2: elvX + elvW, y2: pz(27.65), stroke: '#059669', 'stroke-width': 3.4 }));

  // Furniture, Machinery, Mega-Lift & K-11 Silhouette inside Hangar Plan
  const gFurn = bp.layerGroups.furniture;
  // 4 Heavy Corner Rack-and-Pinion Vertical Lift Towers
  [[13.5, 6.0], [31.5, 6.0], [13.5, 46.0], [31.5, 46.0]].forEach(([tx, tz]) => {
    gFurn.appendChild(el('rect', { x: px(tx), y: pz(tz), width: 2.0 * sc, height: 2.0 * sc, fill: 'url(#hatch-armor)', stroke: '#0f172a', 'stroke-width': 1.2 }));
    gFurn.appendChild(el('circle', { cx: px(tx + 1.0), cy: pz(tz + 1.0), r: 0.55 * sc, fill: '#f59e0b', stroke: '#0f172a', 'stroke-width': 0.9 }));
  });
  // 4 Multi-Stage Hydraulic Lifting Column Bases + 8 Dashed X-Scissor Truss Projections
  [[16.8, 12.0], [30.2, 12.0], [16.8, 42.0], [30.2, 42.0]].forEach(([hx, hz]) => {
    gFurn.appendChild(el('circle', { cx: px(hx), cy: pz(hz), r: 1.05 * sc, fill: '#94a3b8', stroke: '#1e293b', 'stroke-width': 1.0 }));
    gFurn.appendChild(el('circle', { cx: px(hx), cy: pz(hz), r: 0.48 * sc, fill: '#e2e8f0', stroke: '#334155', 'stroke-width': 0.8 }));
  });
  gFurn.appendChild(el('line', { x1: px(16.8), y1: pz(12.0), x2: px(16.8), y2: pz(42.0), stroke: '#64748b', 'stroke-width': 1.4, 'stroke-dasharray': '5 3' }));
  gFurn.appendChild(el('line', { x1: px(30.2), y1: pz(12.0), x2: px(30.2), y2: pz(42.0), stroke: '#64748b', 'stroke-width': 1.4, 'stroke-dasharray': '5 3' }));

  // Docked Airship K-11 Structural Footprint Silhouette on Mega-Lift (Center: 23.5, 27.0; L=34.0m, W_hull=9.2m, W_nac=11.6m)
  gFurn.appendChild(el('ellipse', {
    cx: px(23.5), cy: pz(27.0), rx: 4.6 * sc, ry: 17.0 * sc,
    fill: 'rgba(14, 165, 233, 0.12)', stroke: '#0284c7', 'stroke-width': 1.6, 'stroke-dasharray': '7 3',
  }));
  // K-11 Nacelles (Port & Starboard)
  gFurn.appendChild(el('rect', { x: px(17.7), y: pz(25.2), width: 1.6 * sc, height: 3.6 * sc, rx: 4, fill: 'rgba(14,165,233,0.22)', stroke: '#0369a1', 'stroke-width': 1.1 }));
  gFurn.appendChild(el('rect', { x: px(27.7), y: pz(25.2), width: 1.6 * sc, height: 3.6 * sc, rx: 4, fill: 'rgba(14,165,233,0.22)', stroke: '#0369a1', 'stroke-width': 1.1 }));
  // K-11 X-Tail Fins
  gFurn.appendChild(el('line', { x1: px(19.0), y1: pz(41.2), x2: px(28.0), y2: pz(41.2), stroke: '#0369a1', 'stroke-width': 2.0 }));
  // K-11 Inner Walkable Live-In Cabin Outline (4.50m × 15.00m)
  gFurn.appendChild(el('rect', {
    x: px(21.25), y: pz(19.50), width: 4.50 * sc, height: 15.00 * sc,
    fill: 'rgba(245, 158, 11, 0.14)', stroke: '#b45309', 'stroke-width': 1.25,
  }));
  // Retractable Steel Boarding Bridge connecting West Concourse to K-11 Port Hatch DK11-W
  gFurn.appendChild(el('rect', { x: px(13.2), y: pz(31.2), width: 8.1 * sc, height: 2.2 * sc, fill: '#cbd5e1', stroke: '#0f172a', 'stroke-width': 1.1 }));
  gFurn.appendChild(el('line', { x1: px(13.2), y1: pz(32.3), x2: px(21.3), y2: pz(32.3), stroke: '#0284c7', 'stroke-width': 1.0, 'stroke-dasharray': '4 2', 'marker-start': 'url(#arr-cyan)' }));

  // S03 tecnica forces Command Room Console, Telemetry Wall & Memorial Table
  gFurn.appendChild(el('rect', { x: px(2.0), y: pz(6.6), width: 9.2 * sc, height: 2.0 * sc, fill: '#1e293b', stroke: '#38bdf8', 'stroke-width': 1.0 }));
  gFurn.appendChild(el('rect', { x: px(3.2), y: pz(11.4), width: 5.8 * sc, height: 3.2 * sc, fill: '#e8dcc7', stroke: '#475569', 'stroke-width': 0.9 }));
  gFurn.appendChild(el('rect', { x: px(10.8), y: pz(12.2), width: 1.6 * sc, height: 5.2 * sc, fill: '#334155', stroke: '#0f172a', 'stroke-width': 0.8 }));
  // Silo Launch Trigger Pedestal at S02/S01 Edge
  gFurn.appendChild(el('rect', { x: px(11.6), y: pz(24.0), width: 1.2 * sc, height: 1.8 * sc, fill: '#f59e0b', stroke: '#0f172a', 'stroke-width': 1.0 }));

  // S04 East 100L High-Efficiency Fuel Bay: 3 Pressurized Vertical Fuel Tanks + Boom + Overhead Crane Rails
  [21.0, 27.0, 33.0].forEach((fz) => {
    gFurn.appendChild(el('circle', { cx: px(43.0), cy: pz(fz), r: 1.65 * sc, fill: '#a7f3d0', stroke: '#047857', 'stroke-width': 1.3 }));
    gFurn.appendChild(el('circle', { cx: px(43.0), cy: pz(fz), r: 0.72 * sc, fill: '#ecfdf5', stroke: '#059669', 'stroke-width': 0.8 }));
  });
  // Overhead Yellow Industrial Gantry Crane Bridge in East Gallery
  gFurn.appendChild(el('line', { x1: px(34.2), y1: pz(7.0), x2: px(34.2), y2: pz(47.0), stroke: '#d97706', 'stroke-width': 1.5, 'stroke-dasharray': '7 3' }));
  gFurn.appendChild(el('line', { x1: px(45.8), y1: pz(7.0), x2: px(45.8), y2: pz(47.0), stroke: '#d97706', 'stroke-width': 1.5, 'stroke-dasharray': '7 3' }));
  gFurn.appendChild(el('rect', { x: px(34.0), y: pz(14.5), width: 12.0 * sc, height: 1.4 * sc, fill: 'rgba(245,158,11,0.34)', stroke: '#b45309', 'stroke-width': 1.0 }));
  // Fuel Hose Boom Line to K-11 Tank
  gFurn.appendChild(el('path', {
    d: `M ${px(41.3)} ${pz(33.0)} L ${px(33.8)} ${pz(33.0)} L ${px(25.8)} ${pz(33.0)}`,
    fill: 'none', stroke: '#059669', 'stroke-width': 1.6, 'stroke-dasharray': '5 3', 'marker-end': 'url(#arr-green)',
  }));

  // Section Cut Line A - A' across Z = 27.0m
  const gFlow = bp.layerGroups.flow;
  gFlow.appendChild(el('line', { x1: px(-5.5), y1: pz(27.0), x2: px(49.8), y2: pz(27.0), stroke: '#dc2626', 'stroke-width': 1.5, 'stroke-dasharray': '14 4 3 4' }));
  [px(-5.5), px(49.8)].forEach((sx, idx) => {
    gFlow.appendChild(el('polygon', { points: `${sx},${pz(27.0)} ${sx - 5},${pz(27.0) - 11} ${sx + 5},${pz(27.0) - 11}`, fill: '#dc2626' }));
    gFlow.appendChild(el('text', { x: sx, y: pz(27.0) - 15, 'text-anchor': 'middle', 'font-size': 9.2, 'font-weight': 900, fill: '#dc2626', 'font-family': 'monospace' }, idx === 0 ? 'A' : "A'"));
  });
  // Walking Flow Arrow from ELV-NULL -> West Concourse -> Boarding Bridge -> K-11 Hatch
  gFlow.appendChild(el('path', {
    d: `M ${px(-0.2)} ${pz(27.0)} L ${px(7.5)} ${pz(27.0)} L ${px(7.5)} ${pz(32.3)} L ${px(21.0)} ${pz(32.3)}`,
    fill: 'none', stroke: '#0284c7', 'stroke-width': 1.6, 'stroke-dasharray': '5 3', 'marker-end': 'url(#arr-cyan)',
  }));

  // Curated Lighting Fixtures (POCO F7 5-light spatial grid)
  const gLight = bp.layerGroups.lighting;
  [[7.0, 27.0], [23.5, 15.0], [23.5, 39.0], [40.0, 27.0], [-1.5, 27.0]].forEach(([lx, lz]) => {
    gLight.appendChild(el('circle', { cx: px(lx), cy: pz(lz), r: 4.5, fill: 'none', stroke: '#d97706', 'stroke-width': 1.0 }));
    gLight.appendChild(el('line', { x1: px(lx) - 3.2, y1: pz(lz) - 3.2, x2: px(lx) + 3.2, y2: pz(lz) + 3.2, stroke: '#d97706', 'stroke-width': 0.8 }));
    gLight.appendChild(el('line', { x1: px(lx) + 3.2, y1: pz(lz) - 3.2, x2: px(lx) - 3.2, y2: pz(lz) + 3.2, stroke: '#d97706', 'stroke-width': 0.8 }));
  });

  // Labels inside Panel ①
  const gLab = bp.layerGroups.labels;
  const addTag = (mx, mz, line1, line2 = '', col = '#0f172a') => {
    gLab.appendChild(el('text', { x: px(mx), y: pz(mz), 'text-anchor': 'middle', 'font-size': 7.4, 'font-weight': 800, fill: col }, line1));
    if (line2) gLab.appendChild(el('text', { x: px(mx), y: pz(mz) + 9.5, 'text-anchor': 'middle', 'font-size': 6.2, 'font-family': 'monospace', fill: '#475569' }, line2));
  };
  addTag(23.5, 24.0, 'S01 巨大高昇機発進デッキ', '20,000 × 42,000 mm (耐荷重120t)', '#0f4c81');
  addTag(23.5, 29.0, '飛行船 K-11 格納位置', 'L34,000 × W11,600 / 船室4.5×15m', '#b45309');
  addTag(6.8, 16.8, 'S03 tecnica forces', '技術司令室・管制卓 (192m²)', '#1d4ed8');
  addTag(6.8, 22.8, 'S02 西コンコース', 'ELV-NULL 到着ロビー', '#334155');
  addTag(6.8, 37.5, '格納式 搭乗ブリッジ', '自動引込 8,200mm → K-11', '#0369a1');
  addTag(40.1, 11.2, 'S04 東100L給油ベイ', '天井クレーン・整備庫 (537m²)', '#065f46');
  addTag(40.1, 39.2, 'TF-E11 100L給油タンク×3', '1L=3.0km / 満タン航続300km', '#047857');
  // ELV-NULL Callout Box
  gLab.appendChild(el('rect', { x: px(-12.2), y: pz(20.0), width: 88, height: 34, rx: 3, fill: '#f0f9ff', stroke: '#0284c7', 'stroke-width': 1.0 }));
  gLab.appendChild(el('text', { x: px(-12.2) + 44, y: pz(20.0) + 12, 'text-anchor': 'middle', 'font-size': 6.8, 'font-weight': 800, fill: '#0369a1' }, 'ELV-NULL 高速昇降'));
  gLab.appendChild(el('text', { x: px(-12.2) + 44, y: pz(20.0) + 22, 'text-anchor': 'middle', 'font-size': 6.0, 'font-family': 'monospace', fill: '#0f172a' }, 'GL±0 ↔ B40F(-40m)'));
  gLab.appendChild(el('text', { x: px(-12.2) + 44, y: pz(20.0) + 30.5, 'text-anchor': 'middle', 'font-size': 5.8, 'font-family': 'monospace', fill: '#059669', 'font-weight': 700 }, 'MAX 45km/h (12.5m/s)'));
  gLab.appendChild(el('line', { x1: px(-12.2) + 88, y1: pz(23.5), x2: elvX, y2: elvZ + elvD * 0.3, stroke: '#0284c7', 'stroke-width': 0.9 }));

  // Dimension Chains for Panel ①
  const gDim = bp.layerGroups.dimensions;
  addDimH(gDim, px(0), px(13.5), pz(-1.9), '13,500', { extFrom: pz(0) });
  addDimH(gDim, px(13.5), px(33.5), pz(-1.9), '20,000 (昇降立坑)', { extFrom: pz(6.0), color: '#0f4c81', bold: true });
  addDimH(gDim, px(33.5), px(47.0), pz(-1.9), '13,500', { extFrom: pz(0) });
  addDimH(gDim, px(0), px(47.0), pz(-3.6), '全幅 47,000 mm', { extFrom: pz(0), color: '#0f172a', bold: true, fontSize: 7.8 });

  addDimV(gDim, px(50.2), pz(0), pz(6.0), '6,000', { extFrom: px(47.0) });
  addDimV(gDim, px(50.2), pz(6.0), pz(48.0), '42,000 (高昇機開口)', { extFrom: px(33.5), color: '#0f4c81', bold: true });
  addDimV(gDim, px(50.2), pz(48.0), pz(54.0), '6,000', { extFrom: px(47.0) });
  addDimV(gDim, px(52.4), pz(0), pz(54.0), '全長 54,000 mm', { extFrom: px(47.0), color: '#0f172a', bold: true, fontSize: 7.8 });

  // -------------------------------------------------------------------------
  // PANEL ②: GL ±0 SURFACE LAUNCH PAD & 4-TIER 44-PLATE MECHA ROOF PLAN (S = 1/240)
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 34, 746, 792, 286, '②',
    '地上 GL±0 発進パッド ＆ 4層44枚多層開閉メカ屋根 展開配置図（NULL EREA）',
    'SCALE 1/240  |  96,000 × 76,000 mm APRON', '#b45309',
  );
  const p2 = bp.layerGroups.furniture;
  const sCx = 448;
  const sCy = 898;
  const scS = 3.05; // 1m = 3.05px -> 96m = 292.8px, 76m = 231.8px! Wait: let's rotate 90° OR draw upright nicely!
  // Let's draw North = UP at scale 2.85 px/m: 96m × 76m = 273.6 × 216.6 px, leaving room on left & right for 4-Tier callouts!
  const sc2 = 2.95;
  const sx = (mx) => sCx + mx * sc2;
  const sz = (mz) => sCy + mz * sc2;

  // 96m × 76m Concrete Apron
  p2.appendChild(el('rect', { x: sx(-48), y: sz(-38), width: 96 * sc2, height: 76 * sc2, fill: '#e5e7eb', stroke: '#475569', 'stroke-width': 1.2 }));
  // Camper Summon / Staging Bay (West, X=-36)
  p2.appendChild(el('rect', { x: sx(-44), y: sz(-12), width: 12 * sc2, height: 24 * sc2, fill: '#ecfdf5', stroke: '#059669', 'stroke-width': 1.0, 'stroke-dasharray': '4 2' }));
  p2.appendChild(el('text', { x: sx(-38), y: sz(0) + 3, 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#065f46', transform: `rotate(-90 ${sx(-38)} ${sz(0)})` }, 'RV 待機ベイ'));
  // ELV-NULL Surface Pavilion (X=-25)
  p2.appendChild(el('rect', { x: sx(-28), y: sz(-3.2), width: 5.8 * sc2, height: 6.4 * sc2, fill: '#bae6fd', stroke: '#0284c7', 'stroke-width': 1.2 }));
  p2.appendChild(el('text', { x: sx(-25.1), y: sz(5.6), 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': 800, fill: '#0369a1' }, 'ELVパビリオン'));
  // Silo-40 Central 20m × 42m Opening with 4-Tier 44-Plate Exploded Quadrant Overlay!
  p2.appendChild(el('rect', { x: sx(-10), y: sz(-21), width: 20 * sc2, height: 42 * sc2, fill: '#1e293b', stroke: '#f59e0b', 'stroke-width': 1.8 }));

  // Draw Tier 1 (16 Blast Louvers - Top half) sliding outward
  for (let i = 0; i < 4; i++) {
    const lz = -21 + i * 5.25;
    p2.appendChild(el('rect', { x: sx(-10 - 2.6), y: sz(lz + 0.3), width: 9.6 * sc2, height: 4.6 * sc2, fill: '#94a3b8', stroke: '#0f172a', 'stroke-width': 0.7 }));
    p2.appendChild(el('rect', { x: sx(0.4 + 2.6), y: sz(lz + 0.3), width: 9.6 * sc2, height: 4.6 * sc2, fill: '#94a3b8', stroke: '#0f172a', 'stroke-width': 0.7 }));
  }
  // Draw Tier 2 (12 Folding Iris Blades - Mid-lower) + Tier 3 (10 Acoustic Slats) + Tier 4 (6 Vault Jaws)
  for (let i = 0; i < 3; i++) {
    const lz = 0.5 + i * 6.8;
    p2.appendChild(el('rect', { x: sx(-9.6), y: sz(lz), width: 9.2 * sc2, height: 6.1 * sc2, fill: '#cbd5e1', stroke: '#0284c7', 'stroke-width': 0.85 }));
    p2.appendChild(el('rect', { x: sx(0.4), y: sz(lz), width: 9.2 * sc2, height: 6.1 * sc2, fill: '#cbd5e1', stroke: '#0284c7', 'stroke-width': 0.85 }));
    // LED status strip
    p2.appendChild(el('line', { x1: sx(-0.5), y1: sz(lz + 0.8), x2: sx(-0.5), y2: sz(lz + 5.2), stroke: '#10b981', 'stroke-width': 1.4 }));
    p2.appendChild(el('line', { x1: sx(0.5), y1: sz(lz + 0.8), x2: sx(0.5), y2: sz(lz + 5.2), stroke: '#10b981', 'stroke-width': 1.4 }));
  }
  // Opening motion arrows
  p2.appendChild(el('line', { x1: sx(-10), y1: sz(-11), x2: sx(-18), y2: sz(-11), stroke: '#d97706', 'stroke-width': 1.5, 'marker-end': 'url(#arr-amber)' }));
  p2.appendChild(el('line', { x1: sx(10), y1: sz(-11), x2: sx(18), y2: sz(-11), stroke: '#d97706', 'stroke-width': 1.5, 'marker-end': 'url(#arr-amber)' }));
  // Perimeter Amber Warning Beacons
  [-21, -7, 7, 21].forEach((bz) => {
    p2.appendChild(el('circle', { cx: sx(-12.5), cy: sz(bz), r: 2.6, fill: '#f59e0b', stroke: '#78350f', 'stroke-width': 0.7 }));
    p2.appendChild(el('circle', { cx: sx(12.5), cy: sz(bz), r: 2.6, fill: '#f59e0b', stroke: '#78350f', 'stroke-width': 0.7 }));
  });

  // Left & Right 4-Tier 44-Plate Callout Cards inside Panel ②
  const tierCards = [
    { x: 46, y: 782, t: '第1層：表面ブラスト・ルーバー（16枚）', s: '8×2枚 波状チルト上昇＋左右10.75mスライド展開', c: '#475569' },
    { x: 46, y: 844, t: '第2層：油圧折畳アイリス翼（12枚）', s: '6×2枚 中央→外端へ連続86°上方起立（メカ展開）', c: '#0284c7' },
    { x: 46, y: 906, t: '第3層：気密防音スラット隔壁（10枚）', s: '5×2枚 状態LED(赤→黄→緑)連動＋水平格納', c: '#059669' },
    { x: 46, y: 968, t: '第4層：重装甲ボールト・ジョー（6枚）', s: '3×2枚 92°下方装甲ポケット退避（最終解放）', c: '#b45309' },
  ];
  tierCards.forEach((tc) => {
    p2.appendChild(el('rect', { x: tc.x, y: tc.y, width: 244, height: 50, rx: 3, fill: '#faf7f1', stroke: tc.c, 'stroke-width': 1.1 }));
    p2.appendChild(el('rect', { x: tc.x, y: tc.y, width: 5, height: 50, fill: tc.c }));
    p2.appendChild(el('text', { x: tc.x + 12, y: tc.y + 18, 'font-size': 7.8, 'font-weight': 800, fill: '#0f172a' }, tc.t));
    p2.appendChild(el('text', { x: tc.x + 12, y: tc.y + 34, 'font-size': 6.6, fill: '#475569' }, tc.s));
  });

  // Right Legend inside Panel ②
  p2.appendChild(el('rect', { x: 604, y: 782, width: 210, height: 236, rx: 3, fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 0.9 }));
  p2.appendChild(el('text', { x: 614, y: 800, 'font-size': 8.0, 'font-weight': 800, fill: '#0f4c81' }, '合計 44枚 厳重装甲屋根仕様'));
  const roofNotes = [
    '・総稼働プレート数 : 16+12+10+6 = 44枚',
    '・耐荷重(閉鎖時) : 地上RV通行可能',
    '・屋根開放＋40m昇降 : 18.0秒 同期稼働',
    '・第1層開放と同時に内部照明・警報点灯',
    '・第2〜4層展開中に巨大高昇機が先行上昇',
    '・地上GL±0到達時、四隅クランプ自動解放',
    '・K-11帰還格納時は逆順44枚完全密閉',
    '・嵐/豪雨時も地下40m格納庫を完全防護',
    '・地上管制盤/地下司令室/K-11船内から操作',
  ];
  roofNotes.forEach((txt, i) => {
    p2.appendChild(el('text', { x: 614, y: 822 + i * 21, 'font-size': 6.8, fill: '#334155' }, txt));
  });

  // -------------------------------------------------------------------------
  // PANEL ③: FULL 40,000 mm VERTICAL CROSS-SECTION A-A' (S = 1/115)
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 840, 84, 726, 650, '③',
    '全高 40,000 mm 縦断面図 A-A\'（高速ELV立坑 ＋ 4層44枚屋根 ＋ 巨大高昇機40m昇降機構）',
    'SCALE 1/115  |  GL±0 〜 B40FL -40,000 mm', '#dc2626',
  );
  const p3 = bp.layerGroups.furniture;
  const scSec = 10.1; // 1m = 10.1px -> 40m = 404px with generous sky headroom above GL±0!
  const secOriginX = 1228; // World X = 0 (Center of Silo-40)
  const glY = 260;         // GL ±0
  const vx = (wx) => secOriginX + wx * scSec;
  const vy = (relY) => glY - relY * scSec;

  // Sky tint above GL & Bedrock Earth Cut below GL
  p3.appendChild(el('rect', { x: 854, y: 112, width: 698, height: glY - 112, fill: '#f0f9ff' }));
  p3.appendChild(el('rect', { x: 854, y: glY, width: 698, height: 722 - glY, fill: 'url(#pat-bedrock)' }));
  p3.appendChild(el('line', { x1: 854, y1: glY, x2: 1552, y2: glY, stroke: '#1e293b', 'stroke-width': 2.0 }));

  // Surface ELV-NULL Glass Pavilion (X = -28.0..-22.2, Y = 0..4.2m)
  p3.appendChild(el('rect', { x: vx(-28.0), y: vy(4.2), width: 5.8 * scSec, height: 4.2 * scSec, fill: '#e0f2fe', stroke: '#0284c7', 'stroke-width': 1.3 }));
  p3.appendChild(el('rect', { x: vx(-28.2), y: vy(4.5), width: 6.2 * scSec, height: 0.35 * scSec, fill: '#1e293b' }));

  // Full 40m ELV-NULL Hoistway Shaft (X = -26.2..-23.8, Y = +4.2..-41.4m)
  p3.appendChild(el('rect', { x: vx(-26.4), y: vy(4.2), width: 2.8 * scSec, height: 45.6 * scSec, fill: '#dbeafe', stroke: '#0f172a', 'stroke-width': 1.4 }));
  // 5m Illuminated Depth Marker Rings inside ELV-NULL
  for (let d = 5; d <= 35; d += 5) {
    p3.appendChild(el('line', { x1: vx(-26.3), y1: vy(-d), x2: vx(-23.7), y2: vy(-d), stroke: '#f59e0b', 'stroke-width': 1.0 }));
  }
  // ELV-NULL Cab at GL (solid), Ghost at -20m, and Ghost at -40m
  p3.appendChild(el('rect', { x: vx(-26.0), y: vy(2.5), width: 2.0 * scSec, height: 2.5 * scSec, fill: '#38bdf8', stroke: '#0f172a', 'stroke-width': 1.1 }));
  p3.appendChild(el('rect', { x: vx(-26.0), y: vy(-17.5), width: 2.0 * scSec, height: 2.5 * scSec, fill: 'rgba(56,189,248,0.28)', stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  p3.appendChild(el('rect', { x: vx(-26.0), y: vy(-37.5), width: 2.0 * scSec, height: 2.5 * scSec, fill: 'rgba(56,189,248,0.35)', stroke: '#0284c7', 'stroke-width': 1.0, 'stroke-dasharray': '3 2' }));
  p3.appendChild(el('line', { x1: vx(-25.0), y1: vy(3.8), x2: vx(-25.0), y2: vy(-37.5), stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr-cyan)' }));

  // Subterranean Cavern Cutout (B40F: X = -23.5..+23.5, Y = -40..-25.5m) + Central 40m Silo Shaft (X = -10..+10, Y = -40..0m)
  p3.appendChild(el('rect', { x: vx(-23.5), y: vy(-25.5), width: 47.0 * scSec, height: 14.5 * scSec, fill: '#f1f5f9', stroke: '#0f172a', 'stroke-width': 1.5 }));
  p3.appendChild(el('rect', { x: vx(-10.0), y: vy(0.0), width: 20.0 * scSec, height: 40.0 * scSec, fill: '#f8fafc', stroke: '#0f172a', 'stroke-width': 1.6 }));
  // Deep Hydraulic Pit under Mega-Lift (-40.0..-41.6m)
  p3.appendChild(el('rect', { x: vx(-10.0), y: vy(-40.0), width: 20.0 * scSec, height: 1.6 * scSec, fill: '#cbd5e1', stroke: '#0f172a', 'stroke-width': 1.2 }));

  // Silo Wall Horizontal Rib Rings & Depth Band Markings every 5m
  for (let d = 5; d <= 35; d += 5) {
    p3.appendChild(el('line', { x1: vx(-10.0), y1: vy(-d), x2: vx(10.0), y2: vy(-d), stroke: '#cbd5e1', 'stroke-width': 0.65, 'stroke-dasharray': '5 4' }));
  }

  // 4-TIER 44-PLATE ARMORED ROOF STACK AT TOP OF SILO (GL -0.1m .. -4.4m) + OPEN KINEMATIC ARCS!
  // Tier 1 (Surface Slide Louvers)
  p3.appendChild(el('rect', { x: vx(-10.0), y: vy(-0.1), width: 9.8 * scSec, height: 0.45 * scSec, fill: '#64748b', stroke: '#0f172a', 'stroke-width': 0.9 }));
  p3.appendChild(el('rect', { x: vx(0.2), y: vy(-0.1), width: 9.8 * scSec, height: 0.45 * scSec, fill: '#64748b', stroke: '#0f172a', 'stroke-width': 0.9 }));
  // Tier 1 open ghost slid outward
  p3.appendChild(el('rect', { x: vx(-19.5), y: vy(0.55), width: 9.2 * scSec, height: 0.4 * scSec, fill: 'none', stroke: '#d97706', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  p3.appendChild(el('rect', { x: vx(10.3), y: vy(0.55), width: 9.2 * scSec, height: 0.4 * scSec, fill: 'none', stroke: '#d97706', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));

  // Tier 2 (Hydraulic Folding Iris Blades 86° Upward!)
  p3.appendChild(el('rect', { x: vx(-9.8), y: vy(-1.2), width: 9.6 * scSec, height: 0.42 * scSec, fill: '#38bdf8', stroke: '#0369a1', 'stroke-width': 0.8 }));
  p3.appendChild(el('rect', { x: vx(0.2), y: vy(-1.2), width: 9.6 * scSec, height: 0.42 * scSec, fill: '#38bdf8', stroke: '#0369a1', 'stroke-width': 0.8 }));
  // Dashed 86° upward fold arc + ghost vertical blades!
  p3.appendChild(el('path', { d: `M ${vx(-0.2)} ${vy(-1.2)} A ${9.6 * scSec} ${9.6 * scSec} 0 0 0 ${vx(-9.6)} ${vy(8.2)}`, fill: 'none', stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  p3.appendChild(el('path', { d: `M ${vx(0.2)} ${vy(-1.2)} A ${9.6 * scSec} ${9.6 * scSec} 0 0 1 ${vx(9.6)} ${vy(8.2)}`, fill: 'none', stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  p3.appendChild(el('line', { x1: vx(-9.8), y1: vy(-1.2), x2: vx(-9.4), y2: vy(8.2), stroke: '#0284c7', 'stroke-width': 2.0, 'stroke-dasharray': '4 2' }));
  p3.appendChild(el('line', { x1: vx(9.8), y1: vy(-1.2), x2: vx(9.4), y2: vy(8.2), stroke: '#0284c7', 'stroke-width': 2.0, 'stroke-dasharray': '4 2' }));

  // Tier 3 (Acoustic Slats) & Tier 4 (Heavy Vault Blast Jaws 92° Downward Swing!)
  p3.appendChild(el('rect', { x: vx(-9.8), y: vy(-2.4), width: 19.6 * scSec, height: 0.36 * scSec, fill: '#10b981', stroke: '#047857', 'stroke-width': 0.7 }));
  p3.appendChild(el('rect', { x: vx(-9.8), y: vy(-3.6), width: 9.6 * scSec, height: 0.55 * scSec, fill: '#f59e0b', stroke: '#78350f', 'stroke-width': 0.9 }));
  p3.appendChild(el('rect', { x: vx(0.2), y: vy(-3.6), width: 9.6 * scSec, height: 0.55 * scSec, fill: '#f59e0b', stroke: '#78350f', 'stroke-width': 0.9 }));
  p3.appendChild(el('path', { d: `M ${vx(-0.2)} ${vy(-3.9)} A ${9.4 * scSec} ${9.4 * scSec} 0 0 1 ${vx(-9.6)} ${vy(-13.2)}`, fill: 'none', stroke: '#b45309', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));
  p3.appendChild(el('path', { d: `M ${vx(0.2)} ${vy(-3.9)} A ${9.4 * scSec} ${9.4 * scSec} 0 0 0 ${vx(9.6)} ${vy(-13.2)}`, fill: 'none', stroke: '#b45309', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));

  // ARTICULATED X-SCISSOR HYDRAULIC MEGA-LIFT LATTICE (Full 40m Extension shown dashed!)
  for (let tier = 0; tier < 4; tier++) {
    const yBot = -40.0 + tier * 10.0;
    const yTop = yBot + 10.0;
    p3.appendChild(el('line', { x1: vx(-7.2), y1: vy(yBot), x2: vx(7.2), y2: vy(yTop), stroke: '#94a3b8', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));
    p3.appendChild(el('line', { x1: vx(7.2), y1: vy(yBot), x2: vx(-7.2), y2: vy(yTop), stroke: '#94a3b8', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));
  }
  // 4 Telescoping Hydraulic Columns
  [-6.8, 6.8].forEach((hx) => {
    p3.appendChild(el('line', { x1: vx(hx), y1: vy(-41.2), x2: vx(hx), y2: vy(-0.6), stroke: '#475569', 'stroke-width': 2.0, 'stroke-dasharray': '6 3' }));
  });

  // Helper to draw K-11 Front/Transverse Cross-Section Silhouette at any vertical elevation relY!
  const drawK11SectionGhost = (baseRelY, solid) => {
    const strk = solid ? '#0f4c81' : '#0284c7';
    const fillHull = solid ? 'url(#grad-helium)' : 'rgba(56,189,248,0.10)';
    const dash = solid ? '' : '5 3';
    // Mega-Lift Platform Deck
    p3.appendChild(el('rect', {
      x: vx(-9.6), y: vy(baseRelY), width: 19.2 * scSec, height: 1.15 * scSec,
      fill: solid ? 'url(#pat-hazard)' : 'rgba(245,158,11,0.22)', stroke: '#0f172a', 'stroke-width': solid ? 1.4 : 0.9,
      ...(dash ? { 'stroke-dasharray': dash } : {}),
    }));
    // Hull Ellipse (W=9.2m, H=7.6m centered at +7.8m)
    p3.appendChild(el('ellipse', {
      cx: vx(0), cy: vy(baseRelY + 7.7), rx: 4.6 * scSec, ry: 3.8 * scSec,
      fill: fillHull, stroke: strk, 'stroke-width': solid ? 1.5 : 1.0, ...(dash ? { 'stroke-dasharray': dash } : {}),
    }));
    // Underslung Pressurized Live-In Cabin (4.8m × 3.2m)
    p3.appendChild(el('rect', {
      x: vx(-2.4), y: vy(baseRelY + 3.85), width: 4.8 * scSec, height: 3.2 * scSec, rx: 3,
      fill: solid ? '#fef3c7' : 'rgba(254,243,199,0.25)', stroke: solid ? '#b45309' : '#d97706', 'stroke-width': solid ? 1.2 : 0.85,
      ...(dash ? { 'stroke-dasharray': dash } : {}),
    }));
    // Outboard Nacelles (±4.7m)
    [-4.9, 4.9].forEach((nx) => {
      p3.appendChild(el('circle', {
        cx: vx(nx), cy: vy(baseRelY + 5.8), r: 0.95 * scSec,
        fill: solid ? '#cbd5e1' : 'none', stroke: strk, 'stroke-width': 1.0, ...(dash ? { 'stroke-dasharray': dash } : {}),
      }));
    });
  };

  // Stage 1: Stored at B40F -40.0m (SOLID)
  drawK11SectionGhost(-40.0, true);
  // Stage 2: Rising at -20.0m (GHOST)
  drawK11SectionGhost(-20.0, false);
  // Stage 3: Flush at GL ±0 Surface Launch Ready! (GHOST)
  drawK11SectionGhost(0.0, false);
  // Big Upward Lift Vector Arrow
  p3.appendChild(el('line', { x1: vx(0), y1: vy(-28.0), x2: vx(0), y2: vy(-1.8), stroke: '#dc2626', 'stroke-width': 2.0, 'stroke-dasharray': '7 4', 'marker-end': 'url(#arr-entry)' }));

  // B40F West Boarding Bridge, Command Room & East Fuel Bay + Crane inside Section A-A'
  p3.appendChild(el('rect', { x: vx(-14.0), y: vy(-39.1), width: 11.6 * scSec, height: 0.35 * scSec, fill: '#38bdf8', stroke: '#0f172a', 'stroke-width': 0.8 }));
  // East 100L Fuel Tanks + Overhead Gantry Crane
  p3.appendChild(el('rect', { x: vx(17.6), y: vy(-33.8), width: 2.8 * scSec, height: 6.2 * scSec, rx: 4, fill: '#a7f3d0', stroke: '#047857', 'stroke-width': 1.1 }));
  p3.appendChild(el('rect', { x: vx(10.6), y: vy(-27.8), width: 12.2 * scSec, height: 0.8 * scSec, fill: '#f59e0b', stroke: '#78350f', 'stroke-width': 0.9 }));

  // Vertical Elevation Scale Ladder on Right of Section A-A'
  const ladX = 1496;
  p3.appendChild(el('line', { x1: ladX, y1: vy(12.0), x2: ladX, y2: vy(-41.6), stroke: '#0f172a', 'stroke-width': 1.0 }));
  [10, 0, -5, -10, -15, -20, -25, -30, -35, -40].forEach((m) => {
    const yy = vy(m);
    p3.appendChild(el('line', { x1: ladX - 5, y1: yy, x2: ladX + 4, y2: yy, stroke: m === 0 || m === -40 ? '#dc2626' : '#475569', 'stroke-width': m === 0 || m === -40 ? 1.4 : 0.8 }));
    const lbl = m === 0 ? 'GL ±0' : (m === -40 ? 'B40F -40m' : `${m > 0 ? '+' : ''}${m}m`);
    p3.appendChild(el('text', { x: ladX + 7, y: yy + 2.6, 'font-size': 6.6, 'font-weight': (m === 0 || m === -40) ? 800 : 600, 'font-family': 'monospace', fill: (m === 0 || m === -40) ? '#dc2626' : '#334155' }, lbl));
  });

  // Annotations inside Section A-A'
  p3.appendChild(el('text', { x: vx(-25.0), y: vy(6.0), 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 800, fill: '#0369a1' }, 'ELV-NULL 地上搭乗口'));
  p3.appendChild(el('text', { x: vx(-29.8), y: vy(-20.0), 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 800, fill: '#0284c7', transform: `rotate(-90 ${vx(-29.8)} ${vy(-20.0)})` }, '高速40m直通立坑 (MAX 45km/h)'));
  p3.appendChild(el('text', { x: vx(0), y: vy(12.8), 'text-anchor': 'middle', 'font-size': 7.6, 'font-weight': 800, fill: '#0369a1' }, '③ 地上発進位置 (GL±0 / 44枚屋根全開)'));
  p3.appendChild(el('text', { x: vx(0), y: vy(-14.2), 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#dc2626' }, '② 40m高昇機 上昇中 (-20m / Xシザー展開)'));
  p3.appendChild(el('text', { x: vx(0), y: vy(-41.8) + 12, 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 800, fill: '#0f172a' }, '① B40FL -40,000 mm K-11格納待機位置'));
  p3.appendChild(el('text', { x: vx(-16.8), y: vy(-31.0), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#1e3a8a' }, '西コンコース＆搭乗橋'));
  p3.appendChild(el('text', { x: vx(16.8), y: vy(-36.6), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#065f46' }, '東100L給油ベイ'));
  p3.appendChild(el('text', { x: vx(16.8), y: vy(-26.3), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#b45309' }, '天井クレーン'));

  // -------------------------------------------------------------------------
  // PANEL ④: 4-STAGE MECHA ROOF & MEGA-LIFT SEQUENCE BREAKDOWN
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 840, 746, 726, 286, '④',
    '4層44枚メカ屋根 ＆ 巨大高昇機 連続開閉シーケンス機構図（T = 0.0s → 18.0s）',
    'SYNC KINEMATICS  |  44 PLATES + 40m LIFT', '#059669',
  );
  const p4 = bp.layerGroups.furniture;
  const stages = [
    { idx: 'STAGE 1', t: '0.0s — 4.5s', name: '搭乗橋格納＋第1層16枚展開', desc: '西搭乗ブリッジ8.2m自動引込。表面16枚ルーバーが波状にチルト上昇し左右へスライド退避', roofOpen: 0.22, liftP: 0.0, accent: '#475569' },
    { idx: 'STAGE 2', t: '4.5s — 9.0s', name: '第2層12枚起立＋第3層10枚解放', desc: '12枚の油圧アイリス翼が86°上方起立。第3層10枚防音隔壁がLED緑点灯と共に水平開放', roofOpen: 0.65, liftP: 0.25, accent: '#0284c7' },
    { idx: 'STAGE 3', t: '9.0s — 15.0s', name: '第4層6枚ジョー開放＋40m昇降', desc: '最下層6枚重装甲ジョーが92°開放し青空貫通。4本油圧柱＋8基XシザーがK-11を高速揚重', roofOpen: 1.0, liftP: 0.68, accent: '#d97706' },
    { idx: 'STAGE 4', t: '15.0s — 18.0s', name: '地上GL±0 着床ロック・発進準備', desc: '高昇機デッキが地上エプロンと完全段差ゼロ着床。スキッドクランプ解放、250km/h離陸可能', roofOpen: 1.0, liftP: 1.0, accent: '#059669' },
  ];
  stages.forEach((st, i) => {
    const cx = 852 + i * 178;
    const cy = 780;
    const cw = 170;
    const ch = 240;
    p4.appendChild(el('rect', { x: cx, y: cy, width: cw, height: ch, rx: 3, fill: '#f8fafc', stroke: st.accent, 'stroke-width': 1.1 }));
    p4.appendChild(el('rect', { x: cx, y: cy, width: cw, height: 22, fill: st.accent }));
    p4.appendChild(el('text', { x: cx + 8, y: cy + 14, 'font-size': 7.5, 'font-weight': 800, fill: '#fff', 'font-family': 'monospace' }, st.idx));
    p4.appendChild(el('text', { x: cx + cw - 8, y: cy + 14, 'text-anchor': 'end', 'font-size': 6.8, 'font-weight': 700, fill: '#fef08a', 'font-family': 'monospace' }, st.t));

    // Mini kinematic cross-section box
    const mx0 = cx + 14;
    const my0 = cy + 32;
    const mw = 142;
    const mh = 112;
    const mGl = my0 + 28;
    p4.appendChild(el('rect', { x: mx0, y: my0, width: mw, height: mh, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 0.8 }));
    p4.appendChild(el('rect', { x: mx0, y: my0, width: mw, height: 28, fill: '#e0f2fe' }));
    p4.appendChild(el('rect', { x: mx0, y: mGl, width: mw, height: mh - 28, fill: '#e7e2d8' }));
    // Silo cavity
    const sL = mx0 + 36;
    const sW = 70;
    p4.appendChild(el('rect', { x: sL, y: mGl, width: sW, height: 76, fill: '#f8fafc', stroke: '#334155', 'stroke-width': 1.0 }));
    // Roof plates animation state
    const gap = st.roofOpen * 30;
    p4.appendChild(el('rect', { x: sL - gap * 0.7, y: mGl - 2, width: 34, height: 4, fill: '#475569' }));
    p4.appendChild(el('rect', { x: sL + 36 + gap * 0.7, y: mGl - 2, width: 34, height: 4, fill: '#475569' }));
    if (st.roofOpen > 0.35) {
      // Raised Tier 2 Iris blades!
      p4.appendChild(el('line', { x1: sL + 2, y1: mGl + 4, x2: sL + 4, y2: mGl - 18, stroke: '#0284c7', 'stroke-width': 2.5 }));
      p4.appendChild(el('line', { x1: sL + sW - 2, y1: mGl + 4, x2: sL + sW - 4, y2: mGl - 18, stroke: '#0284c7', 'stroke-width': 2.5 }));
    }
    // Lift deck & K-11 mini silhouette
    const liftY = mGl + 74 - st.liftP * 72;
    p4.appendChild(el('line', { x1: sL + 12, y1: mGl + 75, x2: sL + sW - 12, y2: liftY, stroke: '#94a3b8', 'stroke-width': 1.0 }));
    p4.appendChild(el('line', { x1: sL + sW - 12, y1: mGl + 75, x2: sL + 12, y2: liftY, stroke: '#94a3b8', 'stroke-width': 1.0 }));
    p4.appendChild(el('rect', { x: sL + 2, y: liftY, width: sW - 4, height: 4, fill: '#f59e0b', stroke: '#0f172a', 'stroke-width': 0.7 }));
    p4.appendChild(el('ellipse', { cx: sL + sW * 0.5, cy: liftY - 12, rx: 16, ry: 9, fill: '#bae6fd', stroke: '#0369a1', 'stroke-width': 1.0 }));

    // Text description
    p4.appendChild(el('text', { x: cx + 8, y: cy + 160, 'font-size': 7.4, 'font-weight': 800, fill: '#0f172a' }, st.name));
    // Wrap description cleanly into 3 lines (~19 JP chars per line)
    const lines = [];
    for (let k = 0; k < st.desc.length; k += 18) lines.push(st.desc.slice(k, k + 18));
    lines.forEach((ln, li) => {
      p4.appendChild(el('text', { x: cx + 8, y: cy + 178 + li * 13, 'font-size': 6.6, fill: '#475569' }, ln));
    });
  });

  // -------------------------------------------------------------------------
  // BOTTOM SPEC TABLE & JIS TITLE BLOCK
  // -------------------------------------------------------------------------
  const bY = 1044;
  const bH = 140;
  // Left Spec Table
  const gSpec = bp.layerGroups.exterior;
  gSpec.appendChild(el('rect', { x: 34, y: bY, width: 792, height: bH, fill: '#ffffff', stroke: '#1e293b', 'stroke-width': 1.2 }));
  gSpec.appendChild(el('rect', { x: 34, y: bY, width: 792, height: 20, fill: '#0f172a' }));
  gSpec.appendChild(el('text', { x: 46, y: bY + 13.5, 'font-size': 8.0, 'font-weight': 800, fill: '#fde68a' }, 'SILO-40 地下40m飛行船格納庫 ＆ ELV-NULL 設備主要諸元表'));
  const specs = [
    ['地下格納庫規模', '47,000 × 54,000 × CH14,500 mm（B40FL -40,000 mm・総面積 1,748.8 m²）', '高速ELV-NULL', 'GL±0↔B40F -40.0m 直通・最高 45km/h (12.5m/s)・OLED深度計'],
    ['巨大高昇機デッキ', '19,200 × 40,600 mm（耐荷重120t・4隅ラック＆ピニオン＋4油圧柱＋8シザー）', '4層44枚メカ屋根', '第1層16枚＋第2層12枚＋第3層10枚＋第4層6枚＝計44枚完全連動'],
    ['給油設備 (S04)', 'TF-E11専用100.0L高圧給油ステーション（満タン航続 300.0km / 1L=3.0km）', '安全防護機構', '昇降中ピット防護柵自動起立・地上16基警告ビーコン・搭乗橋自動退避'],
    ['地上連携 (NULL)', 'NULL EREA南端整地(300×100m)・RV呼出待機ベイ・風向吹流し・管制卓', '設計・施工主体', '精鋭技術部隊「tecnica forces」（機械会社設立者＋有志精鋭社員9名）'],
  ];
  specs.forEach((row, i) => {
    const ry = bY + 20 + i * 30;
    if (i % 2 === 1) gSpec.appendChild(el('rect', { x: 35, y: ry, width: 790, height: 30, fill: '#faf7f1' }));
    gSpec.appendChild(el('line', { x1: 34, y1: ry + 30, x2: 826, y2: ry + 30, stroke: '#cbd5e1', 'stroke-width': 0.7 }));
    gSpec.appendChild(el('text', { x: 42, y: ry + 18, 'font-size': 6.9, 'font-weight': 800, fill: '#0f4c81' }, row[0]));
    gSpec.appendChild(el('text', { x: 132, y: ry + 18, 'font-size': 6.5, fill: '#1e293b' }, row[1]));
    gSpec.appendChild(el('text', { x: 438, y: ry + 18, 'font-size': 6.9, 'font-weight': 800, fill: '#b45309' }, row[2]));
    gSpec.appendChild(el('text', { x: 524, y: ry + 18, 'font-size': 6.5, fill: '#1e293b' }, row[3]));
  });

  // Right JIS Title Block
  const tbX = 840;
  const tbW = 726;
  gSpec.appendChild(el('rect', { x: tbX, y: bY, width: tbW, height: bH, fill: '#ffffff', stroke: '#1e293b', 'stroke-width': 1.2 }));
  gSpec.appendChild(el('line', { x1: tbX, y1: bY + 34, x2: tbX + tbW, y2: bY + 34, stroke: '#1e293b', 'stroke-width': 0.8 }));
  gSpec.appendChild(el('line', { x1: tbX, y1: bY + 76, x2: tbX + tbW, y2: bY + 76, stroke: '#1e293b', 'stroke-width': 0.8 }));
  gSpec.appendChild(el('line', { x1: tbX, y1: bY + 110, x2: tbX + tbW, y2: bY + 110, stroke: '#1e293b', 'stroke-width': 0.8 }));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 22, 'font-size': 9.2, 'font-weight': 900, fill: '#0f172a' }, 'PROJECT : TERRENO NULL EREA — 地下40m飛行船格納庫「SILO-40」実施設計図'));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 53, 'font-size': 8.8, 'font-weight': 800, fill: '#0f4c81' }, '図面名称 : 地下格納庫平面(1/100) ＋ 地上44枚屋根展開図(1/240) ＋ 全高40m縦断面図 A-A\'(1/115)'));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 69, 'font-size': 7.2, fill: '#475569' }, '全25図面・SHEET 24/25 ｜ 図面番号: TF-NULL-A01 ｜ 座標基準: NULL EREA (0, 29,910) ｜ 単位: mm'));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 96, 'font-size': 7.4, 'font-weight': 700, fill: '#059669' }, 'TECNICA FORCES 設計監理 : 地下40m耐圧岩盤掘削・44枚多層開閉メカ屋根・40m高速ELV・120t油圧高昇機'));
  // Graphic Scale Bar inside Title Block
  const sbX = tbX + 14;
  const sbY = bY + 124;
  gSpec.appendChild(el('text', { x: sbX, y: sbY + 3, 'font-size': 7.0, 'font-weight': 700, 'font-family': 'monospace', fill: '#334155' }, 'SCALE 1/100 :'));
  [0, 1, 2, 3, 4].forEach((k) => {
    gSpec.appendChild(el('rect', { x: sbX + 78 + k * 23.5, y: sbY - 4, width: 23.5, height: 6, fill: k % 2 === 0 ? '#0f172a' : '#ffffff', stroke: '#0f172a', 'stroke-width': 0.7 }));
  });
  gSpec.appendChild(el('text', { x: sbX + 78, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '0m'));
  gSpec.appendChild(el('text', { x: sbX + 78 + 47, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '5m'));
  gSpec.appendChild(el('text', { x: sbX + 78 + 117.5, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '12.5m'));
  gSpec.appendChild(el('text', { x: tbX + tbW - 14, y: bY + 128, 'text-anchor': 'end', 'font-size': 7.4, 'font-weight': 700, fill: '#b91c1c' }, '赤点 = 現在地 (B40F / NULL EREA 連動)'));

  // Live Camera Marker on Panel ① (B40F Hangar Plan)
  const gCam = bp.layerGroups.camera;
  bp.camGroup = el('g', { id: 'live-cam' });
  bp.camCone = el('polygon', { points: '0,0 26,-11 26,11', fill: 'rgba(220,38,38,0.28)', stroke: '#dc2626', 'stroke-width': 0.9 });
  bp.camDot = el('circle', { cx: px(6.8), cy: pz(27.0), r: 5.5, fill: '#dc2626', stroke: '#ffffff', 'stroke-width': 1.8 });
  bp.camGroup.appendChild(bp.camCone);
  bp.camGroup.appendChild(bp.camDot);
  gCam.appendChild(bp.camGroup);
}

// =========================================================================
// SHEET 24: 飛行船「K-11」(TECNICA FORCES) 総合設計三面図・住み込み空間(4.5×15×3.2m)
// =========================================================================
export function buildAirshipK11BlueprintSVG(bp, svg, defs) {
  const VW = 1600;
  const VH = 1220;
  bp.curVW = VW;
  bp.curVH = VH;
  // Coordinate system for Panel ① (K-11 Walkable Live-In Cabin 4.80m × 15.60m -> 240 × 780 px)
  bp.scale = 48.5;
  bp.padL = 172;
  bp.padT = 192;
  bp.padR = 0;
  bp.padB = 0;

  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  addSharedEngineeringDefs(defs);
  addSheetBorderAndZones(
    svg, VW, VH,
    'TF-K11-M01',
    `実施設計 ${AIRSHIP_K11_PLAN.titleJp}`,
    `精鋭技術部隊「tecnica forces」(創設者＋有志9名・2年開発) 初号機 ｜ 室内 W4,500×L15,000×H3,200mm (67.50m²) ｜ 無風250km/h・1L/3km(100L)・自動航行・RV呼出`,
    '前(BOW)',
  );

  const layerNames = ['exterior', 'materials', 'grid', 'furniture', 'walls', 'openings', 'plumbing', 'outlets', 'lighting', 'flow', 'labels', 'dimensions', 'camera'];
  layerNames.forEach((n) => {
    const g = el('g', { id: `layer-${n}` });
    svg.appendChild(g);
    bp.layerGroups[n] = g;
  });

  const px = (x) => bp.px(x);
  const pz = (z) => bp.pz(z);
  const sc = bp.scale;

  // -------------------------------------------------------------------------
  // PANEL ①: EXACT W4,500 × L15,000 × H3,200 mm LIVE-IN CABIN PLAN (S = 1/45)
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 34, 84, 514, 948, '①',
    'K-11 住み込み船室 精密平面図（内法 W4,500 × L15,000 × H3,200 mm）',
    'SCALE 1/45  |  67.50 m² (6 ZONES)', '#0284c7',
  );

  // Dashed aerodynamic upper hull footprint ghost around the cabin
  bp.layerGroups.exterior.appendChild(el('path', {
    d: `M ${px(2.40)} ${pz(-1.2)} C ${px(-0.6)} ${pz(1.0)}, ${px(-0.9)} ${pz(13.8)}, ${px(2.40)} ${pz(16.8)} C ${px(5.7)} ${pz(13.8)}, ${px(5.4)} ${pz(1.0)}, ${px(2.40)} ${pz(-1.2)} Z`,
    fill: 'rgba(14,165,233,0.05)', stroke: '#94a3b8', 'stroke-width': 1.0, 'stroke-dasharray': '7 4',
  }));

  // Structural Grid Axes (KX1..KX3, KZ1..KZ6)
  const gGrid = bp.layerGroups.grid;
  AIRSHIP_K11.gridAxes.x.forEach((ax) => {
    const gx = px(ax.pos);
    gGrid.appendChild(el('line', { x1: gx, y1: pz(-1.32), x2: gx, y2: pz(16.35), stroke: '#94a3b8', 'stroke-width': 0.55, 'stroke-dasharray': '8 3 2 3' }));
    gGrid.appendChild(el('circle', { cx: gx, cy: pz(-1.32), r: 8.5, fill: '#fff', stroke: '#0284c7', 'stroke-width': 0.9 }));
    gGrid.appendChild(el('text', { x: gx, y: pz(-1.32) + 2.8, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0284c7', 'font-family': 'monospace' }, ax.id));
  });
  AIRSHIP_K11.gridAxes.z.forEach((az) => {
    const gz = pz(az.pos);
    gGrid.appendChild(el('line', { x1: px(-1.45), y1: gz, x2: px(5.85), y2: gz, stroke: '#94a3b8', 'stroke-width': 0.55, 'stroke-dasharray': '8 3 2 3' }));
    gGrid.appendChild(el('circle', { cx: px(-1.45), cy: gz, r: 8.5, fill: '#fff', stroke: '#0284c7', 'stroke-width': 0.9 }));
    gGrid.appendChild(el('text', { x: px(-1.45), y: gz + 2.8, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0284c7', 'font-family': 'monospace' }, az.id));
  });

  // Cabin Floor Zone Finishes (K01..K06)
  const gMat = bp.layerGroups.materials;
  gMat.appendChild(el('rect', { x: px(0.15), y: pz(0.30), width: 4.50 * sc, height: 15.00 * sc, fill: 'url(#pat-teak)', stroke: '#b45309', 'stroke-width': 0.8 }));
  // K01 Bridge subtle aero deck tint
  gMat.appendChild(el('rect', { x: px(0.15), y: pz(0.30), width: 4.50 * sc, height: 3.20 * sc, fill: 'rgba(186,230,253,0.34)' }));
  // K05 Pressurized Shower & Lavatory Ceramic Floor
  gMat.appendChild(el('rect', { x: px(3.00), y: pz(9.70), width: 1.65 * sc, height: 2.60 * sc, fill: '#dbeafe', stroke: '#0284c7', 'stroke-width': 0.7 }));
  // K06 TF-E11 Engine Gallery Titanium Grate Floor
  gMat.appendChild(el('rect', { x: px(0.15), y: pz(12.30), width: 4.50 * sc, height: 3.00 * sc, fill: 'url(#pat-grate)', stroke: '#475569', 'stroke-width': 0.7 }));

  // Outer Pressurized Composite Gondola Shell Walls (150mm thick: outer 4.80×15.60, inner exact 4.50×15.00!)
  const gWall = bp.layerGroups.walls;
  const wRect = (x, z, w, d, fill = 'url(#hatch-ext)') => {
    gWall.appendChild(el('rect', { x: px(x), y: pz(z), width: w * sc, height: d * sc, fill, stroke: '#0f172a', 'stroke-width': 1.0 }));
  };
  wRect(0.0, 0.0, 4.80, 0.30);     // Nose Structural Bulkhead (with panoramic windshield glass inset)
  wRect(0.0, 0.30, 0.15, 13.00);   // West Pressurized Wall (north of DK11-W)
  wRect(0.0, 14.50, 0.15, 1.10);   // West Pressurized Wall (south of DK11-W)
  wRect(4.65, 0.30, 0.15, 15.30);  // East Pressurized Wall
  wRect(0.15, 15.30, 1.65, 0.30);  // Rear Wall Left of DK11-R
  wRect(3.00, 15.30, 1.65, 0.30);  // Rear Wall Right of DK11-R
  // Interior Bulkheads (K05 Bath Pod + K04 Privacy Divider)
  wRect(2.95, 9.65, 1.70, 0.10, 'url(#hatch-int)');
  wRect(2.95, 12.25, 1.70, 0.10, 'url(#hatch-int)');
  wRect(2.95, 9.75, 0.10, 0.73, 'url(#hatch-int)');
  wRect(2.95, 11.37, 0.10, 0.88, 'url(#hatch-int)');
  wRect(0.15, 9.65, 1.50, 0.10, 'url(#hatch-int)');

  // Panoramic Glazing & Pressurized Doors (DK11-W, DK11-R, DK11-B)
  const gOp = bp.layerGroups.openings;
  // 270° Nose Panoramic Windshield + Side Panoramic Observation Windows
  gOp.appendChild(el('rect', { x: px(0.45), y: pz(0.05), width: 3.90 * sc, height: 0.20 * sc, fill: '#bae6fd', stroke: '#0284c7', 'stroke-width': 1.1 }));
  [1.4, 4.4, 7.6].forEach((wz) => {
    gOp.appendChild(el('rect', { x: px(0.02), y: pz(wz), width: 0.11 * sc, height: 2.1 * sc, fill: '#bae6fd', stroke: '#0284c7', 'stroke-width': 0.9 }));
    gOp.appendChild(el('rect', { x: px(4.67), y: pz(wz), width: 0.11 * sc, height: 2.1 * sc, fill: '#bae6fd', stroke: '#0284c7', 'stroke-width': 0.9 }));
  });
  // West Airlock Hatch DK11-W (lz: 13.30..14.50) with outward swing arc
  gOp.appendChild(el('line', { x1: px(0.05), y1: pz(13.30), x2: px(-0.95), y2: pz(13.30), stroke: '#059669', 'stroke-width': 2.0 }));
  gOp.appendChild(el('path', { d: `M ${px(-0.95)} ${pz(13.30)} A ${1.0 * sc} ${1.0 * sc} 0 0 0 ${px(0.05)} ${pz(14.30)}`, fill: 'none', stroke: '#059669', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
  // Rear Deployable Airstair Ramp DK11-R (lx: 1.80..3.00, lz: 15.30..16.55)
  gOp.appendChild(el('rect', { x: px(1.80), y: pz(15.30), width: 1.20 * sc, height: 1.15 * sc, fill: '#e0f2fe', stroke: '#0284c7', 'stroke-width': 1.1, 'stroke-dasharray': '4 2' }));
  [15.55, 15.80, 16.05, 16.30].forEach((rz) => {
    gOp.appendChild(el('line', { x1: px(1.84), y1: pz(rz), x2: px(2.96), y2: pz(rz), stroke: '#0284c7', 'stroke-width': 0.7 }));
  });
  // Bath Pocket Door DK11-B
  gOp.appendChild(el('line', { x1: px(3.00), y1: pz(10.50), x2: px(3.00), y2: pz(11.35), stroke: '#0f4c81', 'stroke-width': 2.2 }));

  // Millimeter-Accurate Cabin Furnishings & Machinery (K01..K06)
  const gFurn = bp.layerGroups.furniture;
  const fBox = (x, z, w, d, lbl = '', fill = '#f1e7d6', stroke = '#475569') => {
    gFurn.appendChild(el('rect', { x: px(x), y: pz(z), width: w * sc, height: d * sc, rx: 2, fill, stroke, 'stroke-width': 0.9 }));
    if (lbl) {
      gFurn.appendChild(el('text', { x: px(x + w * 0.5), y: pz(z + d * 0.5) + 2.6, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#1e293b' }, lbl));
    }
  };
  // K01 Flight Bridge
  fBox(0.70, 0.38, 3.40, 0.68, 'MFD操縦コンソール・RV呼出盤', '#cbd5e1', '#0f4c81');
  fBox(2.06, 1.28, 0.68, 0.64, '操縦席[E]', '#93c5fd', '#1d4ed8');
  fBox(0.18, 1.82, 0.12, 1.45, '', '#fde68a', '#b45309'); // tecnica forces titanium plaque
  gFurn.appendChild(el('text', { x: px(0.42), y: pz(2.55), 'font-size': 5.6, 'font-weight': 700, fill: '#b45309' }, 'TF銘板'));
  // K02 Panoramic Lounge
  fBox(3.64, 3.75, 0.92, 2.90, 'L字本革航空ソファ', '#d8e0e8');
  fBox(2.50, 4.28, 0.84, 1.84, '作戦卓', '#e6d7be');
  fBox(0.18, 4.00, 0.48, 2.40, '書棚', '#efe3d1');
  // K03 Live-In Galley & Dining
  fBox(3.82, 7.05, 0.80, 1.85, 'IHギャレー', '#f5efe6');
  gFurn.appendChild(el('circle', { cx: px(4.18), cy: pz(7.55), r: 5.5, fill: 'none', stroke: '#0f172a', 'stroke-width': 0.9 }));
  gFurn.appendChild(el('circle', { cx: px(4.18), cy: pz(7.85), r: 4.5, fill: 'none', stroke: '#0f172a', 'stroke-width': 0.9 }));
  fBox(3.88, 8.94, 0.74, 0.68, '冷蔵庫', '#cbd5e1');
  fBox(0.22, 7.26, 1.12, 0.48, 'ベンチ', '#d8e0e8');
  fBox(0.22, 7.86, 1.15, 0.88, '4人食卓', '#e6d7be');
  fBox(0.22, 8.86, 1.12, 0.48, 'ベンチ', '#d8e0e8');
  // K04 Master Quarters
  fBox(0.22, 10.06, 1.64, 2.12, 'クイーン航空ベッド', '#f4ece3');
  fBox(0.42, 10.16, 0.52, 0.30, '枕', '#ffffff');
  fBox(1.12, 10.16, 0.52, 0.30, '枕', '#ffffff');
  // K05 Pressurized Shower & Lavatory Pod
  gFurn.appendChild(el('rect', { x: px(3.65), y: pz(9.78), width: 0.96 * sc, height: 1.06 * sc, fill: '#e0f2fe', stroke: '#0284c7', 'stroke-width': 0.9 }));
  gFurn.appendChild(el('line', { x1: px(3.65), y1: pz(9.78), x2: px(4.61), y2: pz(10.84), stroke: '#0284c7', 'stroke-width': 0.6 }));
  gFurn.appendChild(el('line', { x1: px(4.61), y1: pz(9.78), x2: px(3.65), y2: pz(10.84), stroke: '#0284c7', 'stroke-width': 0.6 }));
  gFurn.appendChild(el('text', { x: px(4.13), y: pz(10.35), 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': 700, fill: '#0369a1' }, 'シャワー'));
  fBox(4.08, 11.08, 0.54, 0.92, '洗面', '#f8fafc');
  gFurn.appendChild(el('ellipse', { cx: px(3.45), cy: pz(11.88), rx: 0.22 * sc, ry: 0.28 * sc, fill: '#fff', stroke: '#475569', 'stroke-width': 0.9 }));
  gFurn.appendChild(el('text', { x: px(3.45), y: pz(11.92), 'text-anchor': 'middle', 'font-size': 5.2, fill: '#334155' }, 'WC'));
  // K06 TF-E11 Custom Engine Gallery & 100L Fuel Tank Sight Gauge
  fBox(3.32, 12.96, 1.28, 1.98, '', '#1e293b', '#38bdf8');
  gFurn.appendChild(el('circle', { cx: px(3.96), cy: pz(13.95), r: 0.44 * sc, fill: '#38bdf8', stroke: '#fde68a', 'stroke-width': 1.4 }));
  gFurn.appendChild(el('text', { x: px(3.96), y: pz(13.98), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 800, fill: '#0f172a' }, 'TF-E11'));
  gFurn.appendChild(el('text', { x: px(3.96), y: pz(14.70), 'text-anchor': 'middle', 'font-size': 5.4, 'font-family': 'monospace', fill: '#fde68a', 'font-weight': 700 }, '1L = 3.0km'));
  fBox(0.22, 14.52, 0.34, 0.56, '', '#34d399', '#065f46');
  gFurn.appendChild(el('text', { x: px(0.68), y: pz(14.84), 'font-size': 6.0, 'font-weight': 800, fill: '#065f46', 'font-family': 'monospace' }, '100L 燃料計'));

  // Cabin Center Walking Flow Spine
  const gFlow = bp.layerGroups.flow;
  gFlow.appendChild(el('path', {
    d: `M ${px(2.40)} ${pz(16.15)} L ${px(2.40)} ${pz(13.9)} L ${px(2.15)} ${pz(9.7)} L ${px(2.15)} ${pz(2.2)}`,
    fill: 'none', stroke: '#0284c7', 'stroke-width': 1.4, 'stroke-dasharray': '5 3', 'marker-end': 'url(#arr-cyan)',
  }));
  gFlow.appendChild(el('path', {
    d: `M ${px(-0.6)} ${pz(13.9)} L ${px(2.40)} ${pz(13.9)}`,
    fill: 'none', stroke: '#059669', 'stroke-width': 1.3, 'stroke-dasharray': '4 2', 'marker-end': 'url(#arr-green)',
  }));

  // Cabin Zone Labels
  const gLab = bp.layerGroups.labels;
  [
    [2.40, 2.65, 'K01 パノラマ操縦ブリッジ', '14.40m² / CH3,200'],
    [1.60, 5.25, 'K02 展望ラウンジ', '15.30m² / CH3,200'],
    [2.55, 8.35, 'K03 ギャレー＆ダイニング', '12.60m² / CH3,200'],
    [2.10, 11.45, 'K04 主寝室', '7.15m²'],
    [2.05, 13.15, 'K06 TF-E11機関展望室', '13.50m² / エアロック'],
  ].forEach(([mx, mz, l1, l2]) => {
    gLab.appendChild(el('text', { x: px(mx), y: pz(mz), 'text-anchor': 'middle', 'font-size': 6.8, 'font-weight': 800, fill: '#0f172a' }, l1));
    gLab.appendChild(el('text', { x: px(mx), y: pz(mz) + 8.5, 'text-anchor': 'middle', 'font-size': 5.6, 'font-family': 'monospace', fill: '#475569' }, l2));
  });
  gLab.appendChild(el('text', { x: px(2.40), y: pz(16.75), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 800, fill: '#0369a1' }, 'DK11-R 後部自動タラップ'));
  gLab.appendChild(el('text', { x: px(-0.80), y: pz(14.55), 'text-anchor': 'middle', 'font-size': 6.2, 'font-weight': 800, fill: '#059669' }, 'DK11-W'));

  // Exact Breakthrough #2 Metric Dimension Chains on Panel ①!
  const gDim = bp.layerGroups.dimensions;
  addDimH(gDim, px(0.15), px(4.65), pz(-0.30), '内法 W = 4,500 mm', { extFrom: pz(0.30), color: '#dc2626', bold: true, fontSize: 7.8 });
  addDimH(gDim, px(0.0), px(4.80), pz(-0.70), '外寸 4,800 mm', { extFrom: pz(0.0), color: '#1e293b', fontSize: 6.8 });
  addDimV(gDim, px(5.45), pz(0.30), pz(3.50), '3,200', { extFrom: px(4.80) });
  addDimV(gDim, px(5.45), pz(3.50), pz(6.90), '3,400', { extFrom: px(4.80) });
  addDimV(gDim, px(5.45), pz(6.90), pz(9.70), '2,800', { extFrom: px(4.80) });
  addDimV(gDim, px(5.45), pz(9.70), pz(12.30), '2,600', { extFrom: px(4.80) });
  addDimV(gDim, px(5.45), pz(12.30), pz(15.30), '3,000', { extFrom: px(4.80) });
  addDimV(gDim, px(6.18), pz(0.30), pz(15.30), '内法全長 L = 15,000 mm（天井高 H = 3,200 mm）', { extFrom: px(4.80), color: '#dc2626', bold: true, fontSize: 7.8 });

  // -------------------------------------------------------------------------
  // PANEL ②: FULL 34.0m × 11.8m LONGITUDINAL AEROSPACE CUTAWAY SECTION A-A'
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 564, 84, 1002, 372, '②',
    'K-11 全機縦断面透視図 A-A\'（全長 L34,000 × 全高 H11,800 mm・ヘリウム気嚢＋住み込み船室＋チルト推進器）',
    'SCALE 1/130  |  MAX 250 km/h (ZERO WIND)', '#0f4c81',
  );
  const p2 = bp.layerGroups.furniture;
  const scL = 24.4; // 34.0m = 829.6px!! Magnificent wide cutaway!
  const xBow = 648;
  const yBase = 414; // Bottom of landing skids (Y = 0)
  const lx = (m) => xBow + m * scL; // m = 0 (nose) .. 34.0 (tail)
  const ly = (m) => yBase - m * scL; // m = 0 (skids) .. 11.8 (dorsal crest)

  // Ground / Datum Line
  p2.appendChild(el('line', { x1: 586, y1: yBase, x2: 1546, y2: yBase, stroke: '#64748b', 'stroke-width': 1.2, 'stroke-dasharray': '8 4' }));

  // Sleek Rigid Aerodynamic Sears-Haack Composite Envelope (Center at m=17.0, Y=7.9m, rx=17.0, ry=3.9)
  p2.appendChild(el('path', {
    d: `M ${lx(0.0)} ${ly(7.5)}
        C ${lx(2.8)} ${ly(11.6)}, ${lx(10.5)} ${ly(11.8)}, ${lx(17.0)} ${ly(11.8)}
        C ${lx(24.5)} ${ly(11.8)}, ${lx(31.2)} ${ly(10.4)}, ${lx(34.0)} ${ly(7.8)}
        C ${lx(31.2)} ${ly(5.2)}, ${lx(24.5)} ${ly(4.1)}, ${lx(17.0)} ${ly(4.0)}
        C ${lx(10.0)} ${ly(3.9)}, ${lx(2.8)} ${ly(4.8)}, ${lx(0.0)} ${ly(7.5)} Z`,
    fill: 'url(#grad-helium)', stroke: '#0f172a', 'stroke-width': 1.8,
  }));

  // Internal Geodesic Carbon-Titanium Ring Frames (STA 4 .. STA 30) & 5 Independent Helium Cells
  [4.5, 8.0, 11.5, 15.0, 18.5, 22.0, 25.5, 29.0].forEach((sx, idx) => {
    const t = (sx - 17.0) / 17.0;
    const hHalf = 3.85 * Math.sqrt(Math.max(0.08, 1 - t * t));
    p2.appendChild(el('line', { x1: lx(sx), y1: ly(7.9 + hHalf), x2: lx(sx), y2: ly(7.9 - hHalf), stroke: '#0284c7', 'stroke-width': idx % 2 === 0 ? 1.1 : 0.65, 'stroke-dasharray': idx % 2 === 0 ? '' : '3 2' }));
  });
  // Dorsal Spine Girder & Internal Air Ballonets
  p2.appendChild(el('line', { x1: lx(1.2), y1: ly(7.8), x2: lx(32.8), y2: ly(7.8), stroke: '#475569', 'stroke-width': 1.1, 'stroke-dasharray': '10 3 2 3' }));
  p2.appendChild(el('ellipse', { cx: lx(11.5), cy: ly(5.6), rx: 3.1 * scL, ry: 0.95 * scL, fill: 'rgba(148,163,184,0.22)', stroke: '#64748b', 'stroke-width': 0.8, 'stroke-dasharray': '4 2' }));
  p2.appendChild(el('ellipse', { cx: lx(22.5), cy: ly(5.6), rx: 3.1 * scL, ry: 0.95 * scL, fill: 'rgba(148,163,184,0.22)', stroke: '#64748b', 'stroke-width': 0.8, 'stroke-dasharray': '4 2' }));

  // X-Tail Cruciform Aerodynamic Stabilizers (m = 27.5 .. 33.6)
  p2.appendChild(el('polygon', {
    points: `${lx(27.2)},${ly(10.0)} ${lx(31.8)},${ly(11.7)} ${lx(33.4)},${ly(11.5)} ${lx(32.5)},${ly(8.6)}`,
    fill: '#e2e8f0', stroke: '#0f172a', 'stroke-width': 1.2,
  }));
  p2.appendChild(el('polygon', {
    points: `${lx(27.2)},${ly(5.6)} ${lx(31.8)},${ly(3.6)} ${lx(33.4)},${ly(3.9)} ${lx(32.5)},${ly(6.9)}`,
    fill: '#e2e8f0', stroke: '#0f172a', 'stroke-width': 1.2,
  }));

  // Underslung Pressurized Live-In Gondola Cutaway (m = 9.2 .. 24.8 -> L15.6m outer, L15.0m × H3.2m inner!)
  p2.appendChild(el('path', {
    d: `M ${lx(7.8)} ${ly(2.6)} Q ${lx(8.6)} ${ly(4.2)}, ${lx(10.0)} ${ly(4.25)} L ${lx(25.2)} ${ly(4.25)} Q ${lx(26.6)} ${ly(3.9)}, ${lx(27.2)} ${ly(2.0)} L ${lx(24.8)} ${ly(0.65)} L ${lx(9.2)} ${ly(0.65)} Z`,
    fill: '#fffbeb', stroke: '#0f172a', 'stroke-width': 1.6,
  }));
  // Exact 15.0m × 3.2m Interior Clear Space Highlight
  p2.appendChild(el('rect', { x: lx(9.5), y: ly(3.85), width: 15.0 * scL, height: 3.20 * scL, fill: 'rgba(254,243,199,0.55)', stroke: '#b45309', 'stroke-width': 1.1 }));
  // Zone dividers inside cutaway
  [12.7, 16.1, 18.9, 21.5].forEach((zx) => {
    p2.appendChild(el('line', { x1: lx(zx), y1: ly(3.85), x2: lx(zx), y2: ly(0.65), stroke: '#94a3b8', 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }));
  });
  // Standing Protagonist Human Figure (H 1.75m vs CH 3.20m spacious ceiling!)
  const hx = lx(14.4);
  p2.appendChild(el('circle', { cx: hx, cy: ly(2.22), r: 4.5, fill: 'rgba(185,28,28,0.20)', stroke: '#b91c1c', 'stroke-width': 1.0 }));
  p2.appendChild(el('line', { x1: hx, y1: ly(2.02), x2: hx, y2: ly(1.22), stroke: '#b91c1c', 'stroke-width': 1.5 }));
  p2.appendChild(el('line', { x1: hx, y1: ly(1.22), x2: hx - 4, y2: ly(0.65), stroke: '#b91c1c', 'stroke-width': 1.3 }));
  p2.appendChild(el('line', { x1: hx, y1: ly(1.22), x2: hx + 4, y2: ly(0.65), stroke: '#b91c1c', 'stroke-width': 1.3 }));
  // TF-E11 Engine Core & 100L Tank inside K06 Rear Cutaway
  p2.appendChild(el('rect', { x: lx(22.2), y: ly(2.85), width: 1.8 * scL, height: 1.9 * scL, rx: 3, fill: '#0f172a', stroke: '#38bdf8', 'stroke-width': 1.2 }));
  p2.appendChild(el('circle', { cx: lx(23.1), cy: ly(1.90), r: 0.45 * scL, fill: '#38bdf8', stroke: '#fde68a', 'stroke-width': 1.2 }));
  // Deployed Rear Airstair Ramp DK11-R
  p2.appendChild(el('line', { x1: lx(24.6), y1: ly(0.65), x2: lx(26.6), y2: ly(0.0), stroke: '#0284c7', 'stroke-width': 2.4 }));

  // Outboard Vectoring Coaxial Ducted-Fan Nacelle + 0°–85° Tilt Arc (at m = 17.5, Y = 5.8)
  p2.appendChild(el('rect', { x: lx(15.8), y: ly(6.85), width: 3.4 * scL, height: 2.1 * scL, rx: 6, fill: '#cbd5e1', stroke: '#0f4c81', 'stroke-width': 1.5 }));
  p2.appendChild(el('rect', { x: lx(16.4), y: ly(7.6), width: 2.2 * scL, height: 3.4 * scL, rx: 6, fill: 'none', stroke: '#d97706', 'stroke-width': 1.0, 'stroke-dasharray': '4 2' }));
  p2.appendChild(el('path', { d: `M ${lx(15.5)} ${ly(5.8)} A ${2.0 * scL} ${2.0 * scL} 0 0 1 ${lx(17.5)} ${ly(7.8)}`, fill: 'none', stroke: '#d97706', 'stroke-width': 1.2, 'marker-end': 'url(#arr-amber)' }));

  // Retractable Quad Landing Skids (Solid = Deployed, Dashed = Retracted!)
  [11.8, 22.6].forEach((kx) => {
    p2.appendChild(el('line', { x1: lx(kx - 1.4), y1: ly(0.08), x2: lx(kx + 1.4), y2: ly(0.08), stroke: '#0f172a', 'stroke-width': 2.8 }));
    p2.appendChild(el('line', { x1: lx(kx - 0.8), y1: ly(0.65), x2: lx(kx - 0.8), y2: ly(0.08), stroke: '#475569', 'stroke-width': 1.8 }));
    p2.appendChild(el('line', { x1: lx(kx + 0.8), y1: ly(0.65), x2: lx(kx + 0.8), y2: ly(0.08), stroke: '#475569', 'stroke-width': 1.8 }));
  });

  // Labels & Dimensions on Panel ②
  p2.appendChild(el('text', { x: lx(17.0), y: ly(9.7), 'text-anchor': 'middle', 'font-size': 8.2, 'font-weight': 800, fill: '#0369a1' }, '剛性複合ヘリウム主気嚢（5独立セル ＋ ジオデシック炭素チタン肋骨）'));
  p2.appendChild(el('text', { x: lx(11.5), y: ly(5.45), 'text-anchor': 'middle', 'font-size': 6.0, fill: '#475569' }, '前部空気房'));
  p2.appendChild(el('text', { x: lx(22.5), y: ly(5.45), 'text-anchor': 'middle', 'font-size': 6.0, fill: '#475569' }, '後部空気房'));
  p2.appendChild(el('text', { x: lx(17.5), y: ly(8.25), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 800, fill: '#b45309' }, '0°↔85° チルト同軸ダクトファン'));
  p2.appendChild(el('text', { x: lx(11.1), y: ly(2.9), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f4c81' }, 'K01 操縦室'));
  p2.appendChild(el('text', { x: lx(14.4), y: ly(3.15), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#9c4722' }, 'K02 ラウンジ(CH3.2m)'));
  p2.appendChild(el('text', { x: lx(17.5), y: ly(2.9), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f172a' }, 'K03 ギャレー'));
  p2.appendChild(el('text', { x: lx(20.2), y: ly(2.9), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f172a' }, 'K04/05 寝室・浴室'));
  p2.appendChild(el('text', { x: lx(23.1), y: ly(3.25), 'text-anchor': 'middle', 'font-size': 6.2, 'font-weight': 800, fill: '#0369a1' }, 'TF-E11 機関'));
  p2.appendChild(el('text', { x: lx(31.2), y: ly(10.2), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#334155' }, 'X字尾翼'));

  addDimH(bp.layerGroups.dimensions, lx(0), lx(34.0), yBase + 26, '機体全長 L = 34,000 mm', { extFrom: yBase, color: '#0f172a', bold: true, fontSize: 7.8 });
  addDimH(bp.layerGroups.dimensions, lx(9.5), lx(24.5), yBase + 11, '住み込み室内長 15,000 mm', { extFrom: ly(0.65), color: '#dc2626', bold: true, fontSize: 7.0 });
  addDimV(bp.layerGroups.dimensions, lx(35.1), ly(11.8), ly(0.0), '全高 H = 11,800 mm', { extFrom: lx(34.0), color: '#0f172a', bold: true, fontSize: 7.4 });
  addDimV(bp.layerGroups.dimensions, lx(-0.8), ly(3.85), ly(0.65), 'CH 3,200', { extFrom: lx(9.5), color: '#dc2626', bold: true, fontSize: 6.8 });

  // -------------------------------------------------------------------------
  // PANEL ③: OVERALL TOP PLAN VIEW (34.0m × 11.6m)
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 564, 468, 592, 300, '③',
    'K-11 全機上面平面図（全長 34,000 × ナセル全幅 11,600 mm）',
    'SCALE 1/200', '#0369a1',
  );
  const p3 = bp.layerGroups.furniture;
  const scT = 14.2; // 34m = 482.8px, 11.6m = 164.7px!
  const tBowX = 618;
  const tMidY = 626;
  const tx = (m) => tBowX + m * scT;
  const ty = (w) => tMidY + w * scT;

  // Centerline
  p3.appendChild(el('line', { x1: tx(-1.0), y1: tMidY, x2: tx(35.0), y2: tMidY, stroke: '#94a3b8', 'stroke-width': 0.7, 'stroke-dasharray': '10 3 2 3' }));
  // X-Tail Wingspan (9.2m)
  p3.appendChild(el('polygon', { points: `${tx(27.5)},${ty(-2.4)} ${tx(32.2)},${ty(-4.6)} ${tx(33.4)},${ty(-4.4)} ${tx(32.5)},${ty(-1.6)}`, fill: '#e2e8f0', stroke: '#0f172a', 'stroke-width': 1.1 }));
  p3.appendChild(el('polygon', { points: `${tx(27.5)},${ty(2.4)} ${tx(32.2)},${ty(4.6)} ${tx(33.4)},${ty(4.4)} ${tx(32.5)},${ty(1.6)}`, fill: '#e2e8f0', stroke: '#0f172a', 'stroke-width': 1.1 }));
  // Port & Starboard Outrigger Pylons + Coaxial Ducted-Fan Nacelles (Total span 11.6m -> ±5.8m)
  p3.appendChild(el('rect', { x: tx(16.4), y: ty(-5.2), width: 2.2 * scT, height: 10.4 * scT, fill: '#94a3b8', stroke: '#0f172a', 'stroke-width': 1.0 }));
  p3.appendChild(el('rect', { x: tx(15.6), y: ty(-5.8), width: 3.8 * scT, height: 1.8 * scT, rx: 5, fill: '#cbd5e1', stroke: '#0f4c81', 'stroke-width': 1.3 }));
  p3.appendChild(el('rect', { x: tx(15.6), y: ty(4.0), width: 3.8 * scT, height: 1.8 * scT, rx: 5, fill: '#cbd5e1', stroke: '#0f4c81', 'stroke-width': 1.3 }));
  // Main Rigid Composite Hull Outline (34.0m × 9.2m)
  p3.appendChild(el('ellipse', { cx: tx(17.0), cy: tMidY, rx: 17.0 * scT, ry: 4.6 * scT, fill: 'url(#pat-ti-mesh)', stroke: '#0f172a', 'stroke-width': 1.6 }));
  // Underslung Cabin Dashed Projection (15.0m × 4.5m)
  p3.appendChild(el('rect', { x: tx(9.5), y: ty(-2.25), width: 15.0 * scT, height: 4.5 * scT, fill: 'rgba(245,158,11,0.14)', stroke: '#b45309', 'stroke-width': 1.15, 'stroke-dasharray': '5 3' }));
  p3.appendChild(el('text', { x: tx(17.0), y: tMidY + 3, 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 800, fill: '#b45309' }, '下部住み込み船室 (4,500×15,000)'));
  p3.appendChild(el('text', { x: tx(17.5), y: ty(-6.2), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f4c81' }, '左舷チルト推進器'));
  p3.appendChild(el('text', { x: tx(17.5), y: ty(6.7), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#0f4c81' }, '右舷チルト推進器'));

  addDimV(bp.layerGroups.dimensions, tx(-1.6), ty(-5.8), ty(5.8), '全幅 11,600', { extFrom: tx(15.6), color: '#0f4c81', bold: true, fontSize: 6.8 });
  addDimV(bp.layerGroups.dimensions, tx(35.3), ty(-4.6), ty(4.6), '胴体 9,200', { extFrom: tx(33.4), color: '#334155', fontSize: 6.4 });
  addDimH(bp.layerGroups.dimensions, tx(0), tx(34.0), ty(7.9), '全長 34,000 mm', { extFrom: ty(4.6), color: '#0f172a', bold: true, fontSize: 7.0 });

  // -------------------------------------------------------------------------
  // PANEL ④: TRANSVERSE FRONT CUTAWAY SECTION B-B' (W11,600 × H11,800 mm)
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 1168, 468, 398, 300, '④',
    'K-11 正面横断面図 B-B\'（室内 W4,500×H3,200）',
    'SCALE 1/125', '#b45309',
  );
  const p4 = bp.layerGroups.furniture;
  const scF = 16.5; // 11.8m H = 194.7px, 11.6m W = 191.4px!
  const fCx = 1368;
  const fGl = 720;
  const fx = (w) => fCx + w * scF;
  const fy = (h) => fGl - h * scF;

  p4.appendChild(el('line', { x1: 1184, y1: fGl, x2: 1552, y2: fGl, stroke: '#64748b', 'stroke-width': 1.2 }));
  // X-Tail Dihedral Behind Hull
  p4.appendChild(el('line', { x1: fx(-4.6), y1: fy(11.3), x2: fx(4.6), y2: fy(4.1), stroke: '#94a3b8', 'stroke-width': 2.2, 'stroke-dasharray': '4 2' }));
  p4.appendChild(el('line', { x1: fx(4.6), y1: fy(11.3), x2: fx(-4.6), y2: fy(4.1), stroke: '#94a3b8', 'stroke-width': 2.2, 'stroke-dasharray': '4 2' }));
  // Main Hull Cross-Section (W 9.2m × H 7.8m)
  p4.appendChild(el('ellipse', { cx: fCx, cy: fy(7.9), rx: 4.6 * scF, ry: 3.9 * scF, fill: 'url(#grad-helium)', stroke: '#0f172a', 'stroke-width': 1.6 }));
  // Outrigger Pylons & Twin Coaxial Ducted-Fan Nacelles (Span 11.6m)
  p4.appendChild(el('line', { x1: fx(-4.8), y1: fy(5.8), x2: fx(4.8), y2: fy(5.8), stroke: '#334155', 'stroke-width': 3.0 }));
  [-4.9, 4.9].forEach((nx) => {
    p4.appendChild(el('circle', { cx: fx(nx), cy: fy(5.8), r: 0.90 * scF, fill: '#cbd5e1', stroke: '#0f4c81', 'stroke-width': 1.6 }));
    p4.appendChild(el('circle', { cx: fx(nx), cy: fy(5.8), r: 0.68 * scF, fill: '#e0f2fe', stroke: '#0284c7', 'stroke-width': 0.9 }));
    p4.appendChild(el('circle', { cx: fx(nx), cy: fy(5.8), r: 0.16 * scF, fill: '#0f172a' }));
  });
  // Pressurized Live-In Cabin Outer (4.80m) & Exact Inner (4.50m × 3.20m)
  p4.appendChild(el('rect', { x: fx(-2.40), y: fy(4.00), width: 4.80 * scF, height: 3.50 * scF, rx: 4, fill: '#334155', stroke: '#0f172a', 'stroke-width': 1.4 }));
  p4.appendChild(el('rect', { x: fx(-2.25), y: fy(3.85), width: 4.50 * scF, height: 3.20 * scF, fill: '#fef3c7', stroke: '#b45309', 'stroke-width': 1.2 }));
  // Standing Human inside Cabin Cross-Section (1.75m vs 3.20m ceiling!)
  p4.appendChild(el('circle', { cx: fCx, cy: fy(2.22), r: 4.2, fill: 'rgba(185,28,28,0.22)', stroke: '#b91c1c', 'stroke-width': 1.0 }));
  p4.appendChild(el('rect', { x: fCx - 5, y: fy(2.00), width: 10, height: 1.35 * scF, rx: 3, fill: 'rgba(185,28,28,0.16)', stroke: '#b91c1c', 'stroke-width': 0.9 }));
  p4.appendChild(el('text', { x: fCx, y: fy(3.15), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 800, fill: '#b45309', 'font-family': 'monospace' }, '4,500 × 3,200'));
  // Quad Skids
  [-1.95, 1.95].forEach((sx) => {
    p4.appendChild(el('line', { x1: fx(sx), y1: fy(0.65), x2: fx(sx), y2: fy(0.05), stroke: '#0f172a', 'stroke-width': 2.0 }));
    p4.appendChild(el('rect', { x: fx(sx - 0.25), y: fy(0.14), width: 0.50 * scF, height: 0.14 * scF, fill: '#0f172a' }));
  });

  addDimH(bp.layerGroups.dimensions, fx(-2.25), fx(2.25), fy(-0.7), '室内幅 4,500', { extFrom: fy(0.65), color: '#dc2626', bold: true, fontSize: 6.8 });
  addDimH(bp.layerGroups.dimensions, fx(-5.8), fx(5.8), fy(-1.65), 'ナセル全幅 11,600 mm', { extFrom: fy(5.8), color: '#0f4c81', bold: true, fontSize: 7.0 });
  addDimV(bp.layerGroups.dimensions, fx(6.6), fy(3.85), fy(0.65), 'CH3,200', { extFrom: fx(2.25), color: '#dc2626', bold: true, fontSize: 6.4 });
  addDimV(bp.layerGroups.dimensions, fx(-6.7), fy(11.8), fy(0.0), '全高 11,800', { extFrom: fx(-4.6), color: '#0f172a', bold: true, fontSize: 6.6 });

  // -------------------------------------------------------------------------
  // PANEL ⑤: TECNICA FORCES DOSSIER & 4 TECHNOLOGICAL BREAKTHROUGHS
  // -------------------------------------------------------------------------
  addPanelFrame(
    bp.layerGroups.exterior, 564, 780, 1002, 252, '⑤',
    '精鋭技術部隊「tecnica forces」開発記 ＆ K-11 搭載 4大技術的ブレイクスルー設計仕様',
    'FOUNDER + 9 VOLUNTEERS  |  2-YEAR R&D', '#0f172a',
  );
  const p5 = bp.layerGroups.furniture;
  // Story Header Banner
  p5.appendChild(el('rect', { x: 576, y: 810, width: 978, height: 32, rx: 3, fill: '#0f172a' }));
  p5.appendChild(el('text', { x: 588, y: 825, 'font-size': 8.2, 'font-weight': 800, fill: '#fde68a' },
    '開発体制 : 機械技術系会社の設立者（主人公）が有志社員9名を引き抜き結成した精鋭技術部隊「tecnica forces」（計10名）'));
  p5.appendChild(el('text', { x: 588, y: 837, 'font-size': 7.0, fill: '#cbd5e1' },
    '開発期間 2年間をかけて完成させた初の住み込み型高速飛行船「K-11」。以下の4つの革新的技術ブレイクスルーを搭載し、60×60kmの大地と空を完全制覇する。'));

  const bts = [
    {
      num: 'BREAKTHROUGH 01', accent: '#059669', title: '超高効率機関 TF-E11 ＆ 250km/h',
      stats: '無風最高 250 km/h ｜ 1L = 3.0 km ｜ 満タン 100L (300km)',
      lines: [
        '・独自設計ターボロータリー複合機関「TF-E11」搭載',
        '・1Lあたり3.0km航行する驚異的エネルギー効率',
        '・最大給油容量 100.0L（連続航続距離 300.0km）',
        '・給油は NULL EREA 地下40m車庫 または 自宅拠点',
        '  (NARROW-50) に帰還してワンタッチ満タン補給',
        '・無風時 250km/h、嵐/強風時は空力抗力を実計算',
      ],
    },
    {
      num: 'BREAKTHROUGH 02', accent: '#b45309', title: '住み込み大型船室 (4.5×15×3.2m)',
      stats: '内法 W4,500 × L15,000 × H3,200 mm ＝ 67.50 m²',
      lines: [
        '・気嚢直下に完全加圧断熱の住居空間6区画を統合',
        '・K01 操縦ブリッジ / K02 展望ラウンジ / K03 食卓',
        '・K04 クイーン主寝室 / K05 加圧シャワー＆WC',
        '・K06 TF-E11機関展望室＆100L燃料サイトゲージ',
        '・天井高3.2mの開放空間、自動飛行中も船内歩行可',
        '・飛行中は外扉(DK11-W/R)を気密安全ロック制御',
      ],
    },
    {
      num: 'BREAKTHROUGH 03', accent: '#0284c7', title: 'マップ自由地点 自動航行システム',
      stats: '2D/3Dマップ任意地点マーク → 自動発進・巡航・着陸',
      lines: [
        '・2D/3Dマップ上で「K-11自動」を選択し自由地点',
        '  をクリックするだけで最短安全高度へ自動離陸',
        '・地下40m格納待機中なら44枚屋根開放＆高昇機',
        '  40m上昇シーケンスまで自動連携してから発進',
        '・地形標高＋安全高度を自動追従し250km/h巡航',
        '・航行中も操縦席を離れて船内を自由に生活可能',
      ],
    },
    {
      num: 'BREAKTHROUGH 04', accent: '#dc2626', title: 'キャンピングカー無人自動呼出',
      stats: '現在地(水平X,Z)へ自動発進 ｜ 不可能地点判定＋4段脱出',
      lines: [
        '・指定RV(CAMPER-75/ARMOR-155)を無人で現在地へ',
        '  自動呼出（高度を除く直下地点へ自律走行到着）',
        '・河川・氾濫水域・急崖・建物・開放ピット・A*',
        '  到達不能地点は事前計算により厳格に呼出不可',
        '・走行中スタック時は「4段階自己修復リカバリー」',
        '  (後退操舵→迂回再探索→16方向探索→軌道復帰)',
      ],
    },
  ];
  bts.forEach((bt, i) => {
    const bx = 576 + i * 246;
    const by = 850;
    const bw = 240;
    const bh = 172;
    p5.appendChild(el('rect', { x: bx, y: by, width: bw, height: bh, rx: 3, fill: '#f8fafc', stroke: bt.accent, 'stroke-width': 1.15 }));
    p5.appendChild(el('rect', { x: bx, y: by, width: bw, height: 18, fill: bt.accent }));
    p5.appendChild(el('text', { x: bx + 8, y: by + 12.2, 'font-size': 7.0, 'font-weight': 800, fill: '#fff', 'font-family': 'monospace' }, bt.num));
    p5.appendChild(el('text', { x: bx + 8, y: by + 32, 'font-size': 7.7, 'font-weight': 800, fill: '#0f172a' }, bt.title));
    p5.appendChild(el('rect', { x: bx + 6, y: by + 38, width: bw - 12, height: 15, rx: 2, fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 0.6 }));
    p5.appendChild(el('text', { x: bx + bw * 0.5, y: by + 48.2, 'text-anchor': 'middle', 'font-size': 5.9, 'font-weight': 800, fill: bt.accent, 'font-family': 'monospace' }, bt.stats));
    bt.lines.forEach((ln, li) => {
      p5.appendChild(el('text', { x: bx + 8, y: by + 68 + li * 16.5, 'font-size': 6.5, fill: '#334155' }, ln));
    });
  });

  // -------------------------------------------------------------------------
  // BOTTOM BAR: ROOM AREA SCHEDULE + JIS AEROSPACE TITLE BLOCK
  // -------------------------------------------------------------------------
  const bY = 1044;
  const bH = 140;
  const gSpec = bp.layerGroups.exterior;
  gSpec.appendChild(el('rect', { x: 34, y: bY, width: 792, height: bH, fill: '#ffffff', stroke: '#1e293b', 'stroke-width': 1.2 }));
  gSpec.appendChild(el('rect', { x: 34, y: bY, width: 792, height: 20, fill: '#0f172a' }));
  gSpec.appendChild(el('text', { x: 46, y: bY + 13.5, 'font-size': 8.0, 'font-weight': 800, fill: '#38bdf8' }, 'K-11 住み込み船室 面積・仕上表（内法 W4,500 × L15,000 × CH3,200 mm ＝ 総面積 67.50 m² / 41.67 畳）'));

  const roomRows = [
    ['K01', 'パノラマ操縦ブリッジ', '4.50×3.20m', '14.40 m²', '航空チーク', '操縦席[E]・MFD・RV呼出端末・TF銘板'],
    ['K02', '展望リビングラウンジ', '4.50×3.40m', '15.30 m²', '航空チーク', '両舷パノラマ窓・L字本革ソファ・作戦卓'],
    ['K03', '住み込みギャレー＆食卓', '4.50×2.80m', '12.60 m²', '耐水チーク', 'IHコンロ・エスプレッソ・冷蔵庫・4人卓'],
    ['K04', '主寝室＆設計デスク', '2.75×2.60m', '7.15 m²', '防音チーク', 'クイーン航空ベッド・仕切壁・読書灯'],
    ['K05', '加圧シャワー＆WCポッド', '1.65×2.60m', '4.29 m²', '防滑タイル', '循環シャワー・洗面・真空WC・DK11-B'],
    ['K06', 'TF-E11機関室＆エアロック', '4.50×3.00m', '13.50 m²', 'チタン格子', 'TF-E11機関・100L燃料計・DK11-W/R'],
  ];
  roomRows.forEach((r, i) => {
    const ry = bY + 20 + i * 20;
    if (i % 2 === 1) gSpec.appendChild(el('rect', { x: 35, y: ry, width: 790, height: 20, fill: '#faf7f1' }));
    gSpec.appendChild(el('line', { x1: 34, y1: ry + 20, x2: 826, y2: ry + 20, stroke: '#cbd5e1', 'stroke-width': 0.55 }));
    gSpec.appendChild(el('text', { x: 46, y: ry + 13.5, 'font-size': 6.6, 'font-weight': 800, 'font-family': 'monospace', fill: '#0284c7' }, r[0]));
    gSpec.appendChild(el('text', { x: 76, y: ry + 13.5, 'font-size': 6.6, 'font-weight': 700, fill: '#0f172a' }, r[1]));
    gSpec.appendChild(el('text', { x: 210, y: ry + 13.5, 'font-size': 6.3, 'font-family': 'monospace', fill: '#475569' }, r[2]));
    gSpec.appendChild(el('text', { x: 286, y: ry + 13.5, 'font-size': 6.5, 'font-weight': 700, 'font-family': 'monospace', fill: '#b45309' }, r[3]));
    gSpec.appendChild(el('text', { x: 348, y: ry + 13.5, 'font-size': 6.4, fill: '#334155' }, r[4]));
    gSpec.appendChild(el('text', { x: 422, y: ry + 13.5, 'font-size': 6.3, fill: '#334155' }, r[5]));
  });

  // Right JIS Aerospace Title Block
  const tbX = 840;
  const tbW = 726;
  gSpec.appendChild(el('rect', { x: tbX, y: bY, width: tbW, height: bH, fill: '#ffffff', stroke: '#1e293b', 'stroke-width': 1.2 }));
  gSpec.appendChild(el('line', { x1: tbX, y1: bY + 34, x2: tbX + tbW, y2: bY + 34, stroke: '#1e293b', 'stroke-width': 0.8 }));
  gSpec.appendChild(el('line', { x1: tbX, y1: bY + 76, x2: tbX + tbW, y2: bY + 76, stroke: '#1e293b', 'stroke-width': 0.8 }));
  gSpec.appendChild(el('line', { x1: tbX, y1: bY + 110, x2: tbX + tbW, y2: bY + 110, stroke: '#1e293b', 'stroke-width': 0.8 }));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 22, 'font-size': 9.2, 'font-weight': 900, fill: '#0f172a' }, 'PROJECT : TECNICA FORCES — 住み込み型高速飛行船「K-11」総合実施設計図面'));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 53, 'font-size': 8.6, 'font-weight': 800, fill: '#0284c7' }, '図面名称 : 住み込み船室平面(1/45) ＋ 全機縦断面A-A\'(1/130) ＋ 上面図(1/200) ＋ 正面断面B-B\'(1/125)'));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 69, 'font-size': 7.2, fill: '#475569' }, '全25図面・SHEET 25/25 ｜ 図面番号: TF-K11-M01 ｜ 格納拠点: NULL EREA 地下40m SILO-40 ｜ 単位: mm'));
  gSpec.appendChild(el('text', { x: tbX + 12, y: bY + 96, 'font-size': 7.4, 'font-weight': 700, fill: '#059669' }, '主要性能 : 無風最高250km/h ｜ 1L/3km (100L=300km) ｜ 室内4.5×15×3.2m ｜ マップ自動航行 ｜ RV無人自動呼出'));
  // Graphic Scale Bar (1/45 Cabin Plan: 1m = 50px)
  const sbX = tbX + 14;
  const sbY = bY + 124;
  gSpec.appendChild(el('text', { x: sbX, y: sbY + 3, 'font-size': 7.0, 'font-weight': 700, 'font-family': 'monospace', fill: '#334155' }, 'CABIN SCALE 1/45 :'));
  [0, 1, 2, 3].forEach((k) => {
    gSpec.appendChild(el('rect', { x: sbX + 102 + k * 50, y: sbY - 4, width: 50, height: 6, fill: k % 2 === 0 ? '#0f172a' : '#ffffff', stroke: '#0f172a', 'stroke-width': 0.7 }));
  });
  gSpec.appendChild(el('text', { x: sbX + 102, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '0m'));
  gSpec.appendChild(el('text', { x: sbX + 152, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '1m'));
  gSpec.appendChild(el('text', { x: sbX + 202, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '2m'));
  gSpec.appendChild(el('text', { x: sbX + 302, y: sbY + 11, 'font-size': 6.0, 'font-family': 'monospace', fill: '#334155' }, '4m'));
  gSpec.appendChild(el('text', { x: tbX + tbW - 14, y: bY + 128, 'text-anchor': 'end', 'font-size': 7.4, 'font-weight': 700, fill: '#b91c1c' }, '赤点 = 現在地 (K-11 船内6区画リアルタイム連動)'));

  // Live Camera Marker on Panel ① (Exact Cabin Floor Plan)
  const gCam = bp.layerGroups.camera;
  bp.camGroup = el('g', { id: 'live-cam' });
  bp.camCone = el('polygon', { points: '0,0 28,-12 28,12', fill: 'rgba(220,38,38,0.28)', stroke: '#dc2626', 'stroke-width': 0.9 });
  bp.camDot = el('circle', { cx: px(2.40), cy: pz(1.90), r: 6.0, fill: '#dc2626', stroke: '#ffffff', 'stroke-width': 1.8 });
  bp.camGroup.appendChild(bp.camCone);
  bp.camGroup.appendChild(bp.camDot);
  gCam.appendChild(bp.camGroup);
}
