import { HOUSE, ANNEX, STORAGE, CAMPER, KEI, BLUEPRINT_SHEETS, GRID_AXES, COLUMNS } from './planData.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  if (text !== null) node.textContent = text;
  return node;
}

export class ArchitecturalBlueprint2D {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.activeFloor = HOUSE.spawnFloor; // Default Main 1F (index 1)
    this.lastPose = null;
    this.scale = 100;
    this.padL = 175;
    this.padR = 165;
    this.padT = 245;
    this.padB = 345;
    this.layers = {
      dimensions: true,
      furniture: true,
      lighting: true,
      outlets: false,
      plumbing: false,
      flow: true,
      materials: true,
      camera: true,
    };
    this.layerGroups = {};
    this._buildSVG();
  }

  px(x) {
    return this.padL + x * this.scale;
  }

  pz(z) {
    return this.padT + z * this.scale;
  }

  setFloor(floorIdx) {
    const idx = Math.max(0, Math.min(BLUEPRINT_SHEETS.length - 1, Number(floorIdx) || 0));
    if (idx === this.activeFloor && this.svg) return;
    this.activeFloor = idx;
    this._buildSVG();
    if (this.lastPose) this.updateCameraPose(this.lastPose);
  }

  setLayer(name, visible) {
    this.layers[name] = visible;
    this.syncLayerVisibility();
  }

  syncLayerVisibility() {
    for (const [name, g] of Object.entries(this.layerGroups)) {
      if (name === 'grid' || name === 'walls' || name === 'openings' || name === 'labels' || name === 'exterior') continue;
      const show = this.layers[name] !== false;
      g.style.display = show ? '' : 'none';
    }
  }

  exportSVGString() {
    const clone = this.svg.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
  }

  updateCameraPose(pose) {
    this.lastPose = pose;
    if (!this.camGroup) return;
    const floor = BLUEPRINT_SHEETS[this.activeFloor];
    const isAnnexSheet = floor.building === 'annex';
    const isStorageSheet = floor.building === 'storage';
    const isCamperSheet = floor.building === 'camper';
    const isKeiSheet = floor.building === 'kei';
    const poseSheet = pose.sheetIndex !== undefined ? pose.sheetIndex : pose.floor;
    const sameSheet = poseSheet === this.activeFloor;
    this.camGroup.setAttribute('opacity', sameSheet ? '1' : '0.24');

    let mapX = pose.x;
    let mapZ = pose.z;
    if (isKeiSheet) {
      if (pose.building === 'kei' && pose.localX !== undefined) {
        mapX = pose.localX;
        mapZ = pose.localZ;
      } else if (pose.keiPose) {
        const kp = pose.keiPose;
        const dx = pose.x - kp.cx;
        const dz = pose.z - kp.cz;
        const c = Math.cos(kp.yaw);
        const s = Math.sin(kp.yaw);
        mapX = dx * c - dz * s + KEI.width * 0.5;
        mapZ = dx * s + dz * c + KEI.length * 0.5;
      }
    } else if (isCamperSheet) {
      if (pose.building === 'camper' && pose.localX !== undefined) {
        mapX = pose.localX;
        mapZ = pose.localZ;
      } else if (pose.camperPose) {
        const cp = pose.camperPose;
        const dx = pose.x - cp.cx;
        const dz = pose.z - cp.cz;
        const c = Math.cos(cp.yaw);
        const s = Math.sin(cp.yaw);
        mapX = dx * c - dz * s + CAMPER.width * 0.5;
        mapZ = dx * s + dz * c + CAMPER.length * 0.5;
      }
    } else if (isStorageSheet) {
      mapX = pose.x - STORAGE.originX;
      mapZ = pose.z - STORAGE.originZ;
    } else if (isAnnexSheet) {
      mapX = pose.x - ANNEX.originX;
      mapZ = pose.z - ANNEX.originZ;
    }

    const maxW = floor.width || HOUSE.width;
    const maxD = floor.depth || HOUSE.depth;
    const cx = this.px(Math.max(-1.0, Math.min(maxW + 1.0, mapX)));
    const cz = this.pz(Math.max(-1.0, Math.min(maxD + 1.0, mapZ)));
    const ang = (Math.atan2(pose.dz, pose.dx) * 180) / Math.PI;
    this.camDot.setAttribute('cx', cx);
    this.camDot.setAttribute('cy', cz);
    this.camCone.setAttribute('transform', `translate(${cx}, ${cz}) rotate(${ang})`);
  }

  _buildSVG() {
    const floor = BLUEPRINT_SHEETS[this.activeFloor];
    const isAnnex = floor.building === 'annex';
    const isStorage = floor.building === 'storage';
    const isCamper = floor.building === 'camper';
    const isKei = floor.building === 'kei';
    const bWidth = floor.width || HOUSE.width;
    const bDepth = floor.depth || HOUSE.depth;

    if (isKei) {
      // Multi-View Automotive Engineering Sheet: Left = 1/20 Top-Down Plan, Right = Side Section + Rear Section + Specs!
      this.scale = 185;
      this.padL = 165;
      this.padR = 468;
      this.padT = 205;
      this.padB = 310;
    } else if (isCamper) {
      this.scale = 148;
      this.padL = 220;
      this.padR = 220;
      this.padT = 220;
      this.padB = 345;
    } else if (isStorage) {
      this.scale = 180;
      this.padL = 200;
      this.padR = 280;
      this.padT = 300;
      this.padB = 340;
    } else if (floor.hasAnnexBalconies) {
      this.scale = 100;
      this.padL = 210;
      this.padR = 130;
      this.padT = 270;
      this.padB = 365;
    } else {
      this.scale = 100;
      this.padL = 175;
      this.padR = 165;
      this.padT = 245;
      this.padB = 345;
    }

    const VW = Math.round(this.padL + bWidth * this.scale + this.padR);
    const VH = Math.round(this.padT + bDepth * this.scale + this.padB);
    this.curVW = VW;
    this.curVH = VH;

    this.container.innerHTML = '';

    const svg = el('svg', {
      viewBox: `0 0 ${VW} ${VH}`,
      class: 'blueprint-svg',
      preserveAspectRatio: 'xMidYMid meet',
    });
    this.svg = svg;

    const defs = el('defs');

    const patExt = el('pattern', { id: 'hatch-ext', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    patExt.appendChild(el('rect', { width: 8, height: 8, fill: '#25282e' }));
    patExt.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#555c68', 'stroke-width': 2 }));
    defs.appendChild(patExt);

    const patInt = el('pattern', { id: 'hatch-int', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    patInt.appendChild(el('rect', { width: 6, height: 6, fill: '#474c54' }));
    patInt.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#6c727d', 'stroke-width': 1.2 }));
    defs.appendChild(patInt);

    const patEarth = el('pattern', { id: 'hatch-earth', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    patEarth.appendChild(el('rect', { width: 14, height: 14, fill: '#dcd9d2' }));
    patEarth.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 14, stroke: '#a9a398', 'stroke-width': 1.2 }));
    patEarth.appendChild(el('line', { x1: 4, y1: 0, x2: 4, y2: 14, stroke: '#b8b2a7', 'stroke-width': 0.8 }));
    defs.appendChild(patEarth);

    const patArmor = el('pattern', { id: 'hatch-armor', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    patArmor.appendChild(el('rect', { width: 9, height: 9, fill: '#c4cbd2' }));
    patArmor.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: '#6c7885', 'stroke-width': 1.4 }));
    patArmor.appendChild(el('line', { x1: 0, y1: 0, x2: 9, y2: 0, stroke: '#8995a1', 'stroke-width': 0.7 }));
    defs.appendChild(patArmor);

    const patTatami = el('pattern', { id: 'pat-tatami', width: 10, height: 5, patternUnits: 'userSpaceOnUse' });
    patTatami.appendChild(el('rect', { width: 10, height: 5, fill: '#dde6c8' }));
    patTatami.appendChild(el('line', { x1: 0, y1: 2.5, x2: 10, y2: 2.5, stroke: '#bcc99f', 'stroke-width': 0.8 }));
    defs.appendChild(patTatami);

    const patDeck = el('pattern', { id: 'pat-deck', width: 100, height: 14, patternUnits: 'userSpaceOnUse' });
    patDeck.appendChild(el('rect', { width: 100, height: 14, fill: '#ead8c0' }));
    patDeck.appendChild(el('line', { x1: 0, y1: 14, x2: 100, y2: 14, stroke: '#c7a982', 'stroke-width': 1 }));
    defs.appendChild(patDeck);

    const patGrate = el('pattern', { id: 'pat-grate', width: 10, height: 10, patternUnits: 'userSpaceOnUse' });
    patGrate.appendChild(el('rect', { width: 10, height: 10, fill: '#d9dfe4' }));
    patGrate.appendChild(el('line', { x1: 0, y1: 5, x2: 10, y2: 5, stroke: '#8c969f', 'stroke-width': 0.8 }));
    patGrate.appendChild(el('line', { x1: 5, y1: 0, x2: 5, y2: 10, stroke: '#8c969f', 'stroke-width': 0.8 }));
    defs.appendChild(patGrate);

    const patVoid = el('pattern', { id: 'pat-void', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' });
    patVoid.appendChild(el('rect', { width: 10, height: 10, fill: '#f2efe8' }));
    patVoid.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: '#b8b1a4', 'stroke-width': 1 }));
    defs.appendChild(patVoid);

    [
      ['arr-entry', '#c25e28'],
      ['arr-work', '#1d7a8c'],
      ['arr-priv', '#6b4fa1'],
      ['arr-stair', '#1c1e22'],
    ].forEach(([id, color]) => {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
      m.appendChild(el('path', { d: 'M 0 1 L 10 5 L 0 9 z', fill: color }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    svg.appendChild(el('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#faf7f1' }));
    svg.appendChild(el('rect', { x: 14, y: 14, width: VW - 28, height: VH - 28, fill: 'none', stroke: '#2c2f36', 'stroke-width': 1.4 }));
    svg.appendChild(el('rect', { x: 18, y: 18, width: VW - 36, height: VH - 36, fill: 'none', stroke: '#9b968d', 'stroke-width': 0.5 }));

    this._drawSheetHeader(svg, floor, bWidth, bDepth, VW, isStorage, isCamper, isKei);

    const names = ['exterior', 'materials', 'grid', 'furniture', 'walls', 'openings', 'plumbing', 'outlets', 'lighting', 'flow', 'labels', 'dimensions', 'camera'];
    names.forEach((n) => {
      const g = el('g', { id: `layer-${n}` });
      svg.appendChild(g);
      this.layerGroups[n] = g;
    });

    this._drawExteriorContext(this.layerGroups.exterior, floor, isAnnex, isStorage, isCamper, isKei, bWidth, bDepth);
    this._drawRoomFloors(this.layerGroups.materials, floor, isAnnex, isStorage, isCamper, isKei);
    this._drawGridAxes(this.layerGroups.grid, floor, isAnnex, isStorage, isCamper, isKei, bWidth, bDepth);
    if (!isKei) this._drawStairwellSymbol(this.layerGroups.furniture, floor, isAnnex, isStorage, isCamper);
    this._drawFurniturePlan(this.layerGroups.furniture, floor);
    this._drawWallsAndColumns(this.layerGroups.walls, floor, isAnnex, isStorage, isCamper, isKei);
    this._drawOpenings(this.layerGroups.openings, floor);
    this._drawPlumbing(this.layerGroups.plumbing, floor);
    this._drawOutlets(this.layerGroups.outlets, floor);
    this._drawLighting(this.layerGroups.lighting, floor);
    this._drawFlowPaths(this.layerGroups.flow, floor);
    this._drawRoomLabels(this.layerGroups.labels, floor, isStorage, isCamper, isKei);
    this._drawDimensions(this.layerGroups.dimensions, floor, isAnnex, isStorage, isCamper, isKei, bWidth, bDepth);
    this._drawCameraMarker(this.layerGroups.camera, isAnnex, isStorage, isCamper, isKei);
    if (isKei) this._drawKeiEngineeringViews(svg, VW, VH);
    this._drawTitleBlockAndSection(svg, floor, VW, VH, isCamper, isKei);

    this.container.appendChild(svg);
    this.syncLayerVisibility();
  }

  _drawSheetHeader(svg, floor, bWidth, bDepth, VW, isStorage, isCamper, isKei) {
    const g = el('g');
    const sizeTxt = isKei
      ? '3,400×1,480×H1,800mm'
      : (isCamper
        ? '2,700×7,500×H3,400mm'
        : `${Math.round(bWidth * 1000).toLocaleString()} × ${Math.round(bDepth * 1000).toLocaleString()} mm`);
    const scaleTag = isKei ? '1/20 三面精密設計' : (isCamper ? '1/34' : (isStorage ? '1/28 拡大詳細' : '1/50'));
    g.appendChild(el('text', { x: 28, y: 42, 'font-size': (isCamper || isKei) ? 10.0 : 11.2, 'font-weight': 700, fill: '#1c1e22', 'letter-spacing': 0.2 },
      `実施設計 ${floor.titleJp} (${scaleTag}) — ${sizeTxt}`));
    g.appendChild(el('text', { x: 28, y: 59, 'font-size': (isCamper || isKei) ? 8.1 : 8.5, fill: '#5b5852' },
      `${floor.subtitle}  |  基準床 ${floor.floorLabel}`));

    const nc = el('g', { transform: `translate(${VW - 56}, 52)` });
    nc.appendChild(el('circle', { cx: 0, cy: 0, r: 17, fill: 'none', stroke: '#2c2f36', 'stroke-width': 1 }));
    nc.appendChild(el('polygon', { points: '0,-14 -4.5,3 0,-2 4.5,3', fill: '#1c1e22' }));
    nc.appendChild(el('polygon', { points: '0,14 -3.5,3 0,6 3.5,3', fill: 'none', stroke: '#1c1e22', 'stroke-width': 0.8 }));
    nc.appendChild(el('text', { x: 0, y: -20, 'text-anchor': 'middle', 'font-size': 9.2, 'font-weight': 700, fill: '#1c1e22' }, (isCamper || isKei) ? '前(N)' : 'N'));
    g.appendChild(nc);
    svg.appendChild(g);
  }

  _drawExteriorContext(g, floor, isAnnex, isStorage, isCamper, isKei, bWidth, bDepth) {
    const sc = this.scale;

    if (isKei) {
      // ULTRA-DETAILED 1/20 AUTOMOTIVE EXTERIOR PLAN CONTEXT FOR KEI-340 (3.40m × 1.48m × H1.80m)
      // Front & Rear Rugged Commercial Bumpers + Authentic Yellow Kei License Plates (軽 580)
      g.appendChild(el('rect', { x: this.px(-0.01), y: this.pz(-0.09), width: 1.50 * sc, height: 0.09 * sc, rx: 5, fill: '#2c3138', stroke: '#111', 'stroke-width': 1.2 }));
      g.appendChild(el('rect', { x: this.px(0.575), y: this.pz(-0.115), width: 0.33 * sc, height: 0.045 * sc, rx: 1, fill: '#f2c738', stroke: '#1c1e22', 'stroke-width': 0.8 }));
      g.appendChild(el('text', { x: this.px(0.74), y: this.pz(-0.025), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#fff' }, 'FRONT BUMPER / LED / 軽580'));
      // Headlight beam cones (dashed schematic projection)
      [0.24, 1.24].forEach((hx) => {
        g.appendChild(el('polygon', {
          points: `${this.px(hx)},${this.pz(-0.09)} ${this.px(hx - 0.18)},${this.pz(-0.34)} ${this.px(hx + 0.18)},${this.pz(-0.34)}`,
          fill: 'rgba(245, 198, 70, 0.16)', stroke: '#d97706', 'stroke-width': 0.6, 'stroke-dasharray': '3 2',
        }));
      });
      // Rear Bumper + Taillight markers + Rear Liftgate Open Swing Clearance Envelope
      g.appendChild(el('rect', { x: this.px(-0.01), y: this.pz(3.40), width: 1.50 * sc, height: 0.08 * sc, rx: 4, fill: '#2c3138', stroke: '#111', 'stroke-width': 1.2 }));
      g.appendChild(el('rect', { x: this.px(0.575), y: this.pz(3.465), width: 0.33 * sc, height: 0.045 * sc, rx: 1, fill: '#f2c738', stroke: '#1c1e22', 'stroke-width': 0.8 }));
      // Open Rear Liftgate projection envelope (+Z 1.25m behind tailgate!)
      g.appendChild(el('rect', {
        x: this.px(0.15), y: this.pz(3.40), width: 1.18 * sc, height: 0.42 * sc,
        fill: 'rgba(29,122,140,0.06)', stroke: '#1d7a8c', 'stroke-width': 0.9, 'stroke-dasharray': '5 3',
      }));
      g.appendChild(el('text', { x: this.px(0.74), y: this.pz(3.69), 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 700, fill: '#1d7a8c' }, 'リア跳上ハッチ開放域 (DK-R / 開放角 81°)'));

      // Folding Left & Right Side Mirrors
      g.appendChild(el('rect', { x: this.px(-0.12), y: this.pz(0.28), width: 0.10 * sc, height: 0.14 * sc, rx: 2, fill: '#2c3138' }));
      g.appendChild(el('rect', { x: this.px(1.50), y: this.pz(0.28), width: 0.10 * sc, height: 0.14 * sc, rx: 2, fill: '#2c3138' }));

      // Left Exterior Sliding Door Track Rail + Open Slide Travel Arrow (DK-L)
      g.appendChild(el('line', { x1: this.px(-0.045), y1: this.pz(1.24), x2: this.px(-0.045), y2: this.pz(2.96), stroke: '#9c4722', 'stroke-width': 2.2 }));
      g.appendChild(el('rect', {
        x: this.px(-0.095), y: this.pz(2.04), width: 0.06 * sc, height: 0.84 * sc,
        fill: 'rgba(156,71,34,0.16)', stroke: '#9c4722', 'stroke-width': 0.85, 'stroke-dasharray': '3 2',
      }));
      g.appendChild(el('text', { x: this.px(-0.16), y: this.pz(2.46), 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#9c4722', transform: `rotate(-90 ${this.px(-0.16)} ${this.pz(2.46)})` }, '左スライド扉 開放軌跡 (W840)'));

      // Monocoque Underbody Subframe Rails (dashed steel blue)
      [0.24, 1.24].forEach((fx) => {
        g.appendChild(el('line', { x1: this.px(fx), y1: this.pz(0.20), x2: this.px(fx), y2: this.pz(3.22), stroke: '#334155', 'stroke-width': 0.75, 'stroke-dasharray': '8 4', opacity: 0.45 }));
      });
      // Vehicle Longitudinal Centerline CL
      g.appendChild(el('line', { x1: this.px(0.74), y1: this.pz(-0.36), x2: this.px(0.74), y2: this.pz(3.92), stroke: '#2563eb', 'stroke-width': 0.65, 'stroke-dasharray': '12 3 2 3', opacity: 0.55 }));
      g.appendChild(el('text', { x: this.px(0.74), y: this.pz(-0.39), 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#1d4ed8', 'font-family': 'monospace' }, 'CL (車体中心線)'));

      // Front Steering Axle (FA) & Rear Drive Axle (RA) + 4 Tires (145/80R12) + ±32° Steering Lock Projections!
      const keiAxles = ['FA 前操舵軸 (±32°)', 'RA 後駆動軸'];
      KEI.axlesZ.forEach((az, i) => {
        g.appendChild(el('line', { x1: this.px(-0.22), y1: this.pz(az), x2: this.px(1.70), y2: this.pz(az), stroke: '#2563eb', 'stroke-width': 0.9, 'stroke-dasharray': '10 3 2 3', opacity: 0.78 }));
        g.appendChild(el('text', { x: this.px(1.73), y: this.pz(az) + 3, 'font-size': 7.0, 'font-weight': 700, fill: '#1d4ed8', 'font-family': 'monospace' }, keiAxles[i]));
        [-0.01, 1.33].forEach((tx) => {
          const cxT = this.px(tx + 0.08);
          const cyT = this.pz(az);
          g.appendChild(el('rect', {
            x: this.px(tx), y: this.pz(az - 0.27), width: 0.16 * sc, height: 0.54 * sc, rx: 3.5,
            fill: 'rgba(30, 58, 138, 0.14)', stroke: '#1d4ed8', 'stroke-width': 1.0,
          }));
          if (i === 0) {
            // Dashed ±32° steering envelope on front tires!
            g.appendChild(el('rect', {
              x: this.px(tx), y: this.pz(az - 0.27), width: 0.16 * sc, height: 0.54 * sc, rx: 3,
              fill: 'none', stroke: '#1d4ed8', 'stroke-width': 0.65, 'stroke-dasharray': '3 2', opacity: 0.55,
              transform: `rotate(28 ${cxT} ${cyT})`,
            }));
          }
        });
      });

      // Right-side Wheelbase (WB = 1,980mm) & Overhang Dimension Chain (680 / 1,980 / 740)!
      const wbX = this.px(1.66);
      const drawDimR = (z1, z2, lbl, col = '#1d4ed8') => {
        g.appendChild(el('line', { x1: wbX, y1: this.pz(z1), x2: wbX, y2: this.pz(z2), stroke: col, 'stroke-width': 0.85 }));
        g.appendChild(el('line', { x1: wbX - 4, y1: this.pz(z1), x2: wbX + 4, y2: this.pz(z1), stroke: col, 'stroke-width': 0.9 }));
        g.appendChild(el('line', { x1: wbX - 4, y1: this.pz(z2), x2: wbX + 4, y2: this.pz(z2), stroke: col, 'stroke-width': 0.9 }));
        const ym = (this.pz(z1) + this.pz(z2)) / 2;
        g.appendChild(el('text', { x: wbX + 10, y: ym, 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 700, fill: col, 'font-family': 'monospace', transform: `rotate(90 ${wbX + 10} ${ym})` }, lbl));
      };
      drawDimR(0.0, 0.68, 'FOH 680', '#475569');
      drawDimR(0.68, 2.66, 'WB 1,980 mm', '#1d4ed8');
      drawDimR(2.66, 3.40, 'ROH 740', '#475569');
      return;
    }

    if (isCamper) {
      // Heavy Steel Front Bull-Bar Bumper & Rear Bumper + Mounted Spare Tire
      g.appendChild(el('rect', { x: this.px(0.02), y: this.pz(-0.16), width: 2.66 * sc, height: 0.16 * sc, rx: 4, fill: '#474f57', stroke: '#1c1e22', 'stroke-width': 1.2 }));
      g.appendChild(el('text', { x: this.px(1.35), y: this.pz(-0.05), 'text-anchor': 'middle', 'font-size': 7.4, 'font-weight': 700, fill: '#fff' }, 'FRONT BULL-BAR / TWIN LED HEADLIGHTS'));
      g.appendChild(el('rect', { x: this.px(0.02), y: this.pz(7.50), width: 2.66 * sc, height: 0.14 * sc, rx: 3, fill: '#474f57', stroke: '#1c1e22', 'stroke-width': 1.2 }));
      // Rear mounted spare expedition wheel
      g.appendChild(el('rect', { x: this.px(0.28), y: this.pz(7.60), width: 0.80 * sc, height: 0.24 * sc, rx: 5, fill: '#2c3138', stroke: '#1c1e22', 'stroke-width': 1 }));
      g.appendChild(el('text', { x: this.px(0.68), y: this.pz(7.76), 'text-anchor': 'middle', 'font-size': 6.6, fill: '#fff', 'font-weight': 700 }, '予備タイヤ'));
      // Left & Right Side Mirrors
      g.appendChild(el('rect', { x: this.px(-0.18), y: this.pz(0.24), width: 0.14 * sc, height: 0.22 * sc, rx: 2, fill: '#2c3138' }));
      g.appendChild(el('rect', { x: this.px(2.74), y: this.pz(0.24), width: 0.14 * sc, height: 0.22 * sc, rx: 2, fill: '#2c3138' }));

      // Fold-Down West Steel Entry Steps outside DC-1
      if (floor.camperLevel === 1) {
        g.appendChild(el('rect', { x: this.px(-0.34), y: this.pz(2.20), width: 0.34 * sc, height: 0.58 * sc, fill: 'url(#pat-grate)', stroke: '#1c1e22', 'stroke-width': 1.2 }));
        g.appendChild(el('line', { x1: this.px(-0.17), y1: this.pz(2.20), x2: this.px(-0.17), y2: this.pz(2.78), stroke: '#444', 'stroke-width': 0.8 }));
        g.appendChild(el('text', { x: this.px(-0.46), y: this.pz(2.49), 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#9c4722', transform: `rotate(-90 ${this.px(-0.46)} ${this.pz(2.49)})` }, '格納ステップ (母屋東側)'));
      }

      // 3 Heavy Expedition Axle Centerlines & 6 Wheel Projections (dashed mechanical blue-grey)
      const axleNames = ['FA 前輪操舵軸 (Ø800)', 'RA1 後前駆動軸 (Ø800)', 'RA2 後後駆動軸 (Ø800)'];
      CAMPER.axlesZ.forEach((az, i) => {
        g.appendChild(el('line', { x1: this.px(-0.32), y1: this.pz(az), x2: this.px(3.04), y2: this.pz(az), stroke: '#2563eb', 'stroke-width': 0.85, 'stroke-dasharray': '10 3 2 3', opacity: 0.72 }));
        g.appendChild(el('text', { x: this.px(3.08), y: this.pz(az) + 3, 'font-size': 7.2, 'font-weight': 700, fill: '#1d4ed8', 'font-family': 'monospace' }, axleNames[i]));
        // Left & Right Tires (dashed underbody projection)
        [0.00, 2.42].forEach((tx) => {
          g.appendChild(el('rect', {
            x: this.px(tx), y: this.pz(az - 0.40), width: 0.28 * sc, height: 0.80 * sc, rx: 4,
            fill: 'rgba(37,99,235,0.09)', stroke: '#1d4ed8', 'stroke-width': 0.9, 'stroke-dasharray': '4 2',
          }));
        });
      });

      // Right-side callout showing total height & soaring ceiling architecture
      g.appendChild(el('text', { x: this.px(1.35), y: this.pz(8.02), 'text-anchor': 'middle', 'font-size': 8.6, 'font-weight': 700, fill: '#2c3138' },
        floor.camperLevel === 1
          ? '1F 全14室＋極狭廊下 W460 (主人公幅400)＋中央高天井 CH3,020 ｜ 厳格OBB当たり判定自走対応'
          : '2F ロフト2室 (CL01前方寝台＋CL02後方展望収納)＋強化ガラス連絡ブリッジ＋中央吹抜 (CH3,020)'));
      return;
    }

    if (isStorage) {
      if (floor.physicalFloor === 1) {
        g.appendChild(el('rect', {
          x: this.px(-0.85), y: this.pz(0.05), width: 0.85 * sc, height: 1.95 * sc,
          fill: '#e3e6e8', stroke: '#7b848c', 'stroke-width': 0.9, 'stroke-dasharray': '5 3',
        }));
        g.appendChild(el('text', {
          x: this.px(-0.44), y: this.pz(1.05), 'text-anchor': 'middle', 'font-size': 8.8, fill: '#3f4b54', 'font-weight': 700,
          transform: `rotate(-90 ${this.px(-0.44)} ${this.pz(1.05)})`,
        }, '← 西1.6m：コンクリート歩道 → 母屋北ポーチ'));
        g.appendChild(el('rect', {
          x: this.px(0.40), y: this.pz(-0.76), width: 2.40 * sc, height: 0.76 * sc,
          fill: 'none', stroke: '#6c757d', 'stroke-width': 0.9, 'stroke-dasharray': '6 4',
        }));
        g.appendChild(el('text', { x: this.px(1.60), y: this.pz(-0.34), 'text-anchor': 'middle', 'font-size': 8.8, fill: '#5b656e', 'font-weight': 600 },
          '上部2F 鋼製グレーチング踊場（+2,120 投影線）'));
      } else {
        g.appendChild(el('rect', {
          x: this.px(0.40), y: this.pz(-0.76), width: 2.40 * sc, height: 0.76 * sc,
          fill: 'url(#pat-grate)', stroke: '#1c1e22', 'stroke-width': 2.0,
        }));
        g.appendChild(el('text', { x: this.px(1.42), y: this.pz(-0.36), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#1c1e22', 'font-weight': 700 },
          '2F 鋼製グレーチング踊場 (+2,120 / 手摺H1,040)'));
      }
      g.appendChild(el('text', { x: this.px(1.00), y: this.pz(2.26), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#4f555c', 'font-weight': 700 },
        'RCコンクリート固め 2,000×2,000mm・低天井 CH1,920・1F 2室＋2F 2室＝計4室'));
      return;
    }

    if (isAnnex) {
      if (floor.physicalFloor === 1) {
        g.appendChild(el('rect', { x: this.px(2.85), y: this.pz(-1.10), width: 210, height: 110, fill: '#dde2db', stroke: '#8c9689', 'stroke-width': 0.9 }));
        g.appendChild(el('text', { x: this.px(3.90), y: this.pz(-0.52), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#4c5749', 'font-weight': 600 }, '離れ玄関ポーチ・石灯籠'));
        g.appendChild(el('rect', { x: this.px(5.15), y: this.pz(0.0), width: 105, height: bDepth * sc, fill: '#eef2ea', stroke: '#8fa18a', 'stroke-width': 0.9, 'stroke-dasharray': '5 3' }));
        g.appendChild(el('text', { x: this.px(5.68), y: this.pz(4.0), 'text-anchor': 'middle', 'font-size': 8.8, fill: '#3d523a', 'font-weight': 700, transform: `rotate(90 ${this.px(5.68)} ${this.pz(4.0)})` }, '東2.6m：石灯籠苔中庭 → 母屋 (5×10m 6層)'));
        g.appendChild(el('text', { x: this.px(2.50), y: this.pz(8.42), 'text-anchor': 'middle', 'font-size': 9.4, fill: '#5b6b59', 'font-weight': 600 }, '南面：老杉の森（離れカフェ南大窓ビュー）'));
      } else if (floor.hasAnnexBalconies) {
        ANNEX.balconies3F.forEach((b) => {
          const bw = b.lx2 - b.lx1;
          const bd = b.lz2 - b.lz1;
          g.appendChild(el('rect', {
            x: this.px(b.lx1), y: this.pz(b.lz1), width: bw * sc, height: bd * sc,
            fill: 'url(#pat-deck)', stroke: '#1c1e22', 'stroke-width': 2.1,
          }));
        });
        g.appendChild(el('line', { x1: this.px(2.85), y1: this.pz(-1.14), x2: this.px(4.45), y2: this.pz(-1.14), stroke: '#9c4722', 'stroke-width': 0.95 }));
        g.appendChild(el('text', { x: this.px(3.65), y: this.pz(-1.20), 'text-anchor': 'middle', 'font-size': 8.0, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'W 1,600 × D 1,000'));
        g.appendChild(el('line', { x1: this.px(-1.14), y1: this.pz(5.95), x2: this.px(-1.14), y2: this.pz(7.55), stroke: '#9c4722', 'stroke-width': 0.95 }));
        g.appendChild(el('text', { x: this.px(-1.24), y: this.pz(6.75), 'text-anchor': 'middle', 'font-size': 7.8, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace', transform: `rotate(-90 ${this.px(-1.24)} ${this.pz(6.75)})` }, '1,600×1,000'));
        g.appendChild(el('line', { x1: this.px(2.85), y1: this.pz(9.18), x2: this.px(4.45), y2: this.pz(9.18), stroke: '#9c4722', 'stroke-width': 0.95 }));
        g.appendChild(el('text', { x: this.px(3.65), y: this.pz(9.32), 'text-anchor': 'middle', 'font-size': 8.0, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'W 1,600 × D 1,000'));
      } else if (floor.isAttic) {
        g.appendChild(el('rect', {
          x: this.px(-0.45), y: this.pz(-0.40), width: (bWidth + 0.90) * sc, height: (bDepth + 0.80) * sc,
          fill: 'none', stroke: '#7a756b', 'stroke-width': 0.9, 'stroke-dasharray': '7 4',
        }));
        g.appendChild(el('text', { x: this.px(2.50), y: this.pz(-0.52), 'text-anchor': 'middle', 'font-size': 8.8, fill: '#6b655c' }, '隣棟 切妻屋根 軒先ライン (6寸勾配 軒+9,550〜棟+10,950 / 全5部屋)'));
      } else {
        g.appendChild(el('text', { x: this.px(2.50), y: this.pz(-0.34), 'text-anchor': 'middle', 'font-size': 9.0, fill: '#5b6b59' }, '北面：老杉の森（隣棟2F 樹冠ビュー）'));
        g.appendChild(el('text', { x: this.px(5.68), y: this.pz(4.0), 'text-anchor': 'middle', 'font-size': 8.8, fill: '#3d523a', 'font-weight': 700, transform: `rotate(90 ${this.px(5.68)} ${this.pz(4.0)})` }, '東2.6m向かい：母屋 5×10m タワー棟'));
      }
      return;
    }

    if (floor.isBasement) {
      g.appendChild(el('rect', { x: this.px(0), y: this.pz(0), width: 500, height: 270, fill: 'url(#hatch-earth)', stroke: '#7c766b', 'stroke-width': 1 }));
      g.appendChild(el('text', { x: this.px(2.50), y: this.pz(1.35), 'text-anchor': 'middle', 'font-size': 10, fill: '#5a554c', 'font-weight': 700 }, '地中基礎・地盤土（北側非掘削部）'));
      g.appendChild(el('text', { x: this.px(2.50), y: this.pz(10.38), 'text-anchor': 'middle', 'font-size': 9.5, fill: '#4f555c', 'font-weight': 600 }, 'RC地下擁壁（灰色セメント・低天井 CH2,020・薄明作業灯）'));
    } else if (floor.index === 1) {
      g.appendChild(el('rect', { x: this.px(0.10), y: this.pz(-1.20), width: 210, height: 120, fill: '#dde2db', stroke: '#8c9689', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: this.px(1.15), y: this.pz(-0.55), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#4c5749', 'font-weight': 600 }, '玄関ポーチ・苔石森道'));
      g.appendChild(el('text', { x: this.px(-0.36), y: this.pz(5.0), 'text-anchor': 'middle', 'font-size': 8.4, fill: '#3d523a', 'font-weight': 700, transform: `rotate(-90 ${this.px(-0.36)} ${this.pz(5.0)})` }, '← 西2.6m 隣棟「森の離れ」(5×8m 3F+屋根裏)'));
      g.appendChild(el('text', { x: this.px(5.32), y: this.pz(0.45), 'text-anchor': 'start', 'font-size': 7.8, fill: '#4f555c', 'font-weight': 700 }, '東1.6m→RC倉庫'));
      g.appendChild(el('text', { x: this.px(5.32), y: this.pz(5.20), 'text-anchor': 'start', 'font-size': 7.8, fill: '#9c4722', 'font-weight': 700 }, '東1.4m→巨大RV'));
      g.appendChild(el('text', { x: this.px(5.32), y: this.pz(5.55), 'text-anchor': 'start', 'font-size': 7.2, fill: '#646c75' }, '(2.7×7.5×3.4m)'));
      g.appendChild(el('rect', { x: this.px(0.05), y: this.pz(10.0), width: 490, height: 120, fill: 'url(#pat-deck)', stroke: '#8d6e4a', 'stroke-width': 1 }));
      g.appendChild(el('text', { x: this.px(2.50), y: this.pz(10.68), 'text-anchor': 'middle', 'font-size': 10, fill: '#6b4f31', 'font-weight': 600 }, '南 縁側ウッドデッキ (W4,900×D1,350)  —  深い老杉の森'));
    } else if (floor.hasBalcony) {
      const bal = HOUSE.balcony4F;
      g.appendChild(el('rect', {
        x: this.px(bal.minX), y: this.pz(bal.minZ), width: (bal.maxX - bal.minX) * sc, height: (bal.maxZ - bal.minZ) * sc,
        fill: 'url(#pat-deck)', stroke: '#1c1e22', 'stroke-width': 2.2,
      }));
      g.appendChild(el('line', { x1: this.px(bal.minX), y1: this.pz(11.18), x2: this.px(bal.maxX), y2: this.pz(11.18), stroke: '#9c4722', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: this.px(3.65), y: this.pz(11.30), 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'W 2,000'));
      g.appendChild(el('line', { x1: this.px(4.82), y1: this.pz(10.0), x2: this.px(4.82), y2: this.pz(11.0), stroke: '#9c4722', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: this.px(5.16), y: this.pz(10.55), 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'D 1,000'));
    } else if (floor.isAttic) {
      g.appendChild(el('rect', {
        x: this.px(-0.50), y: this.pz(-0.45), width: (HOUSE.width + 1.0) * sc, height: (HOUSE.depth + 0.90) * sc,
        fill: 'none', stroke: '#7a756b', 'stroke-width': 0.9, 'stroke-dasharray': '7 4',
      }));
      g.appendChild(el('text', { x: this.px(2.50), y: this.pz(-0.58), 'text-anchor': 'middle', 'font-size': 9, fill: '#6b655c' }, '切妻屋根 軒先ライン (東西出500 / 南北ケラバ出450 / 6寸勾配)'));
    } else {
      g.appendChild(el('text', { x: this.px(2.50), y: this.pz(-0.32), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#5b6b59' }, `北面：老杉の森（樹高20〜31m・${floor.code}樹冠ビュー）`));
      g.appendChild(el('text', { x: this.px(2.50), y: this.pz(10.45), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#5b6b59' }, `南面：月光の杉林・${floor.code}パノラマ樹冠展望`));
    }
  }

  _drawRoomFloors(g, floor, isAnnex, isStorage, isCamper, isKei = false) {
    const sc = this.scale;
    for (const r of floor.rooms) {
      const isTatami = r.floorTex.startsWith('tatami');
      const isDeck = r.floorTex === 'wood_deck';
      const isArmor = r.id === 'c1_shelter';
      const fill = isArmor ? 'url(#hatch-armor)' : (isTatami ? 'url(#pat-tatami)' : (isDeck ? 'url(#pat-deck)' : r.tint));
      const rect = el('rect', {
        x: this.px(r.x), y: this.pz(r.z), width: r.w * sc, height: r.d * sc,
        fill,
        stroke: isArmor ? '#2c3e50' : 'rgba(40,40,40,0.08)', 'stroke-width': isArmor ? 1.8 : 0.6,
        class: 'bp-room-hit',
        style: 'cursor:pointer',
      });
      rect.addEventListener('mouseenter', () => {
        rect.setAttribute('stroke', '#9c4722');
        rect.setAttribute('stroke-width', '2');
        if (this.callbacks.onRoomHover) this.callbacks.onRoomHover(r);
      });
      rect.addEventListener('mouseleave', () => {
        rect.setAttribute('stroke', isArmor ? '#2c3e50' : 'rgba(40,40,40,0.08)');
        rect.setAttribute('stroke-width', isArmor ? '1.8' : '0.6');
        if (this.callbacks.onRoomHover) this.callbacks.onRoomHover(null);
      });
      g.appendChild(rect);
    }

    if (isKei) {
      // Highlight Central Walk-In Cargo Alley (kx = 0.44..1.04, kz = 1.18..3.32 -> W 600 × L 2,140mm!)
      g.appendChild(el('rect', {
        x: this.px(0.44), y: this.pz(1.18), width: 0.60 * sc, height: 2.14 * sc,
        fill: 'rgba(156, 71, 34, 0.08)', stroke: '#9c4722', 'stroke-width': 1.0, 'stroke-dasharray': '5 3',
      }));
      g.appendChild(el('line', { x1: this.px(0.44), y1: this.pz(2.05), x2: this.px(1.04), y2: this.pz(2.05), stroke: '#9c4722', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: this.px(0.74), y: this.pz(2.01), 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, '進入有効 W600'));
      // Highlight Passenger-Delete Zone (K02: ZERO passenger seat!)
      g.appendChild(el('rect', {
        x: this.px(0.08), y: this.pz(0.42), width: 0.64 * sc, height: 0.72 * sc,
        fill: 'none', stroke: '#b45309', 'stroke-width': 0.9, 'stroke-dasharray': '4 2',
      }));
      g.appendChild(el('text', { x: this.px(0.40), y: this.pz(1.08), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#b45309' }, '助手席撤去 (完全1人乗)'));
      // 6 Floor Tie-Down D-Ring Anchors (cargo lashing points!)
      [[0.12, 1.26], [1.36, 1.26], [0.12, 2.22], [1.36, 2.22], [0.12, 3.24], [1.36, 3.24]].forEach(([dx, dz]) => {
        g.appendChild(el('circle', { cx: this.px(dx), cy: this.pz(dz), r: 3.5, fill: '#fff', stroke: '#334155', 'stroke-width': 1.0 }));
        g.appendChild(el('circle', { cx: this.px(dx), cy: this.pz(dz), r: 1.2, fill: '#334155' }));
      });
    }

    if (isCamper && floor.camperLevel === 2) {
      g.appendChild(el('rect', {
        x: this.px(1.12), y: this.pz(2.17), width: 1.51 * sc, height: 3.08 * sc,
        fill: 'url(#pat-void)', stroke: '#9c4722', 'stroke-width': 1.2, 'stroke-dasharray': '6 3',
      }));
      g.appendChild(el('line', { x1: this.px(1.12), y1: this.pz(2.17), x2: this.px(2.63), y2: this.pz(5.25), stroke: '#9c4722', 'stroke-width': 0.85, opacity: 0.65 }));
      g.appendChild(el('line', { x1: this.px(2.63), y1: this.pz(2.17), x2: this.px(1.12), y2: this.pz(5.25), stroke: '#9c4722', 'stroke-width': 0.85, opacity: 0.65 }));
      g.appendChild(el('rect', { x: this.px(1.26), y: this.pz(3.42), width: 1.22 * sc, height: 0.56 * sc, rx: 4, fill: 'rgba(255,255,255,0.92)', stroke: '#9c4722', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: this.px(1.87), y: this.pz(3.64), 'text-anchor': 'middle', 'font-size': 8.2, 'font-weight': 700, fill: '#9c4722' }, '1F 高天井 吹抜空間'));
      g.appendChild(el('text', { x: this.px(1.87), y: this.pz(3.84), 'text-anchor': 'middle', 'font-size': 7.4, 'font-family': 'monospace', fill: '#4a4640' }, 'CH 3,020 mm (上部天窓)'));
      g.appendChild(el('rect', { x: this.px(0.72), y: this.pz(0.90), width: 1.26 * sc, height: 0.90 * sc, fill: 'none', stroke: '#0284c7', 'stroke-width': 1.0, 'stroke-dasharray': '5 3' }));
      g.appendChild(el('text', { x: this.px(1.35), y: this.pz(0.84), 'text-anchor': 'middle', 'font-size': 7.0, fill: '#0284c7', 'font-weight': 700 }, '上部パノラマ天窓 (1260×900)'));
      g.appendChild(el('rect', { x: this.px(0.42), y: this.pz(5.30), width: 1.85 * sc, height: 1.75 * sc, fill: 'none', stroke: '#1e3a8a', 'stroke-width': 0.9, 'stroke-dasharray': '6 3' }));
      g.appendChild(el('text', { x: this.px(1.35), y: this.pz(5.44), 'text-anchor': 'middle', 'font-size': 7.0, fill: '#1e3a8a', 'font-weight': 700 }, '屋上ソーラー発電パネル投影 (1.8kW)'));
    }

    if (isCamper && floor.camperLevel === 1) {
      g.appendChild(el('line', { x1: this.px(1.12), y1: this.pz(2.50), x2: this.px(1.58), y2: this.pz(2.50), stroke: '#b9381c', 'stroke-width': 1.4 }));
      g.appendChild(el('text', { x: this.px(1.35), y: this.pz(2.42), 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 700, fill: '#b9381c', 'font-family': 'monospace' }, 'W460'));
      g.appendChild(el('rect', { x: this.px(0.72), y: this.pz(2.80), width: 1.26 * sc, height: 1.95 * sc, fill: 'none', stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '5 3' }));
    }

    if (floor.isBasement) {
      g.appendChild(el('line', { x1: this.px(0.18), y1: this.pz(9.55), x2: this.px(3.12), y2: this.pz(9.55), stroke: '#2c3e50', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
      g.appendChild(el('text', { x: this.px(1.65), y: this.pz(9.48), 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#2c3e50', 'font-family': 'monospace' }, '主空間 内法 W 3,000 × D 7,000 mm'));
      g.appendChild(el('rect', { x: this.px(2.94), y: this.pz(3.00), width: 18, height: 665, fill: '#aeb4ba', stroke: '#5c636b', 'stroke-width': 0.6 }));
    }

    if (floor.isAttic && !isStorage && !isCamper && !isKei) {
      const maxD = isAnnex ? ANNEX.depth - 0.15 : HOUSE.depth - 0.15;
      const ridgeLbl = isAnnex ? '棟木ライン CH2,800 (6寸勾配)' : '棟木ライン CH2,830 (6寸勾配頂部)';
      g.appendChild(el('line', { x1: this.px(2.50), y1: this.pz(0.15), x2: this.px(2.50), y2: this.pz(maxD), stroke: '#9c4722', 'stroke-width': 1.4, 'stroke-dasharray': '12 4 3 4' }));
      g.appendChild(el('text', { x: this.px(2.56), y: this.pz(0.55), 'font-size': 8.2, fill: '#9c4722', 'font-weight': 700 }, ridgeLbl));
      [1.28, 3.72].forEach((cx) => {
        g.appendChild(el('line', { x1: this.px(cx), y1: this.pz(0.15), x2: this.px(cx), y2: this.pz(maxD), stroke: '#7e6952', 'stroke-width': 0.8, 'stroke-dasharray': '5 4' }));
      });
    }
  }

  _drawGridAxes(g, floor, isAnnex, isStorage, isCamper, isKei, bWidth, bDepth) {
    const axes = isKei ? KEI.gridAxes : (isCamper ? CAMPER.gridAxes : (isStorage ? STORAGE.gridAxes : (isAnnex ? ANNEX.gridAxes : GRID_AXES)));
    const topOff = isKei ? -0.50 : (isCamper ? -0.68 : (isStorage ? -0.96 : (floor.hasAnnexBalconies ? -1.36 : -1.15)));
    const topLineOff = isKei ? -0.36 : (isCamper ? -0.50 : (isStorage ? -0.82 : (floor.hasAnnexBalconies ? -1.18 : -0.95)));
    const leftOff = isKei ? -0.58 : (isCamper ? -0.82 : (isStorage ? -0.68 : (floor.hasAnnexBalconies ? -1.42 : -1.15)));
    const leftLineOff = isKei ? -0.44 : (isCamper ? -0.64 : (isStorage ? -0.52 : (floor.hasAnnexBalconies ? -1.24 : -0.95)));
    const rightEnd = isKei ? bWidth + 0.16 : (isCamper ? bWidth + 0.45 : (isStorage ? bWidth + 1.05 : bWidth + 0.85));
    const botEnd = isKei ? bDepth + 0.22 : (isCamper ? bDepth + 0.35 : (isStorage ? bDepth + 0.42 : (floor.hasAnnexBalconies ? bDepth + 1.15 : bDepth + 0.85)));

    axes.x.forEach((ax) => {
      const x = this.px(ax.pos);
      g.appendChild(el('line', { x1: x, y1: this.pz(topLineOff), x2: x, y2: this.pz(botEnd), stroke: '#b5563c', 'stroke-width': 0.5, 'stroke-dasharray': '12 4 2 4', opacity: 0.65 }));
      g.appendChild(el('circle', { cx: x, cy: this.pz(topOff), r: 10.0, fill: '#fff', stroke: '#b5563c', 'stroke-width': 0.95 }));
      g.appendChild(el('text', { x, y: this.pz(topOff) + 3.1, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#b5563c' }, ax.id));
    });
    axes.z.forEach((az) => {
      const z = this.pz(az.pos);
      g.appendChild(el('line', { x1: this.px(leftLineOff), y1: z, x2: this.px(rightEnd), y2: z, stroke: '#b5563c', 'stroke-width': 0.5, 'stroke-dasharray': '12 4 2 4', opacity: 0.65 }));
      g.appendChild(el('circle', { cx: this.px(leftOff), cy: z, r: 10.0, fill: '#fff', stroke: '#b5563c', 'stroke-width': 0.95 }));
      g.appendChild(el('text', { x: this.px(leftOff), y: z + 3.1, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#b5563c' }, az.id));
    });
  }

  _drawStairwellSymbol(g, floor, isAnnex, isStorage, isCamper) {
    let sb;
    if (isCamper) {
      sb = { minX: CAMPER.stairLocal.minX, maxX: CAMPER.stairLocal.maxX, topZ: CAMPER.stairLocal.bottomZ, bottomZ: CAMPER.stairLocal.topZ, treads: CAMPER.stairLocal.treads };
    } else if (isStorage) {
      sb = { minX: 2.00, maxX: 2.80, topZ: 0.00, bottomZ: 2.00, treads: STORAGE.stairWorld.treads };
    } else if (isAnnex) {
      sb = ANNEX.stairLocal;
    } else {
      sb = HOUSE.stairBox;
    }

    const x1 = this.px(sb.minX);
    const x2 = this.px(sb.maxX);
    const yTop = this.pz(sb.topZ);
    const yBot = this.pz(sb.bottomZ);
    const w = x2 - x1;
    const h = yBot - yTop;

    const isVoid = floor.isAttic || (isCamper && floor.camperLevel === 2);
    g.appendChild(el('rect', {
      x: x1, y: yTop, width: w, height: h,
      fill: isStorage ? 'url(#pat-grate)' : (isVoid ? 'url(#pat-void)' : (floor.isBasement ? '#d8dce0' : '#f2ebe0')),
      stroke: '#3a342c', 'stroke-width': 1.2,
    }));

    const stepH = h / sb.treads;
    for (let i = 1; i < sb.treads; i++) {
      const sy = yTop + i * stepH;
      g.appendChild(el('line', { x1, y1: sy, x2, y2: sy, stroke: '#6c6256', 'stroke-width': 0.8 }));
    }

    const cx = (x1 + x2) / 2;
    if (isCamper) {
      if (floor.stairUp) {
        g.appendChild(el('line', { x1: cx, y1: yTop + 4, x2: cx, y2: yBot - 6, stroke: '#1c1e22', 'stroke-width': 1.4, 'marker-end': 'url(#arr-stair)' }));
        g.appendChild(el('rect', { x: cx - 34, y: yBot + 4, width: 68, height: 14, rx: 3, fill: '#fff', stroke: '#1c1e22', 'stroke-width': 0.7 }));
        g.appendChild(el('text', { x: cx, y: yBot + 14, 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#1c1e22' }, 'STC1 UP 2F'));
      } else {
        g.appendChild(el('rect', { x: cx - 34, y: yBot + 4, width: 68, height: 14, rx: 3, fill: '#fff8ec', stroke: '#9c4722', 'stroke-width': 0.7 }));
        g.appendChild(el('text', { x: cx, y: yBot + 14, 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#9c4722' }, 'STC1 DN 1F'));
      }
      return;
    }

    if (floor.stairUp) {
      g.appendChild(el('line', { x1: cx, y1: yBot - 16, x2: cx, y2: yTop + 16, stroke: '#1c1e22', 'stroke-width': 1.5, 'marker-end': 'url(#arr-stair)' }));
      g.appendChild(el('rect', { x: cx - 44, y: yBot - 48, width: 88, height: 16, rx: 3, fill: '#fff', stroke: '#1c1e22', 'stroke-width': 0.75 }));
      g.appendChild(el('text', { x: cx, y: yBot - 37, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#1c1e22' }, floor.stairUp.label));
    }
    if (floor.stairDown) {
      g.appendChild(el('rect', { x: cx - 40, y: yTop + 16, width: 80, height: 16, rx: 3, fill: '#fff8ec', stroke: '#9c4722', 'stroke-width': 0.75 }));
      g.appendChild(el('text', { x: cx, y: yTop + 27, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#9c4722' }, floor.stairDown.label));
    }
    if (floor.stairUp && floor.stairDown) {
      g.appendChild(el('line', { x1, y1: yTop + h * 0.44, x2, y2: yTop + h * 0.56, stroke: '#9c4722', 'stroke-width': 1.2 }));
    }
  }

  _drawFurniturePlan(g, floor) {
    const sc = this.scale;
    const box = (x, z, w, d, label, fill = '#fffdf8') => {
      g.appendChild(el('rect', { x: this.px(x), y: this.pz(z), width: w * sc, height: d * sc, fill, stroke: '#5c5348', 'stroke-width': 0.85, rx: 1.5 }));
      if (label) {
        g.appendChild(el('text', { x: this.px(x + w / 2), y: this.pz(z + d / 2) + 2.6, 'text-anchor': 'middle', 'font-size': 6.9, fill: '#3d3832', 'font-weight': 600 }, label));
      }
    };

    if (floor.index === 12) {
      // ULTRA-DETAILED CAMPER 1F MECHANICAL & ARCHITECTURAL FIXTURES (ALL 14 ROOMS!)
      // C01 Cockpit: dashboard, steering wheel symbol, GPS screen, captain seats
      box(0.11, 0.08, 2.48, 0.34, '計器盤 / GPSコンソール', '#e2e6eb');
      g.appendChild(el('circle', { cx: this.px(0.72), cy: this.pz(0.49), r: 16, fill: 'none', stroke: '#1c1e22', 'stroke-width': 2.0 }));
      g.appendChild(el('line', { x1: this.px(0.72) - 14, y1: this.pz(0.49), x2: this.px(0.72) + 14, y2: this.pz(0.49), stroke: '#1c1e22', 'stroke-width': 1.2 }));
      box(0.46, 0.58, 0.52, 0.46, '運転席[E]', '#d4dfe8');
      box(1.72, 0.58, 0.52, 0.46, '助手席', '#d4dfe8');
      // C02 Seating Lounge
      box(0.09, 1.29, 0.40, 0.80, '座席', '#d8e0e8');
      box(0.51, 1.41, 0.30, 0.56, '卓', '#f5ead6');
      // C03 Galley Kitchen (sink + 2-burner IH rings)
      box(0.08, 2.87, 0.40, 0.76, '', '#f5efe6');
      g.appendChild(el('rect', { x: this.px(0.12), y: this.pz(2.91), width: 0.30 * sc, height: 0.28 * sc, fill: '#e6edf2', stroke: '#4b5563', 'stroke-width': 0.8 }));
      g.appendChild(el('circle', { cx: this.px(0.27), cy: this.pz(3.35), r: 9, fill: 'none', stroke: '#1c1e22', 'stroke-width': 1.0 }));
      g.appendChild(el('circle', { cx: this.px(0.27), cy: this.pz(3.52), r: 7, fill: 'none', stroke: '#1c1e22', 'stroke-width': 1.0 }));
      // C04 Soaking Bath (deep tub)
      g.appendChild(el('rect', { x: this.px(0.09), y: this.pz(3.71), width: 0.48 * sc, height: 0.76 * sc, rx: 8, fill: '#d0e9f7', stroke: '#0284c7', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: this.px(0.33), y: this.pz(4.11), 'text-anchor': 'middle', 'font-size': 7.0, fill: '#0369a1', 'font-weight': 700 }, '深型浴槽'));
      // C05 Rain Shower (head + drain grate X)
      g.appendChild(el('rect', { x: this.px(0.28), y: this.pz(4.75), width: 0.28 * sc, height: 0.28 * sc, fill: '#eef7fc', stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
      g.appendChild(el('line', { x1: this.px(0.28), y1: this.pz(4.75), x2: this.px(0.56), y2: this.pz(5.03), stroke: '#0284c7', 'stroke-width': 0.7 }));
      g.appendChild(el('line', { x1: this.px(0.56), y1: this.pz(4.75), x2: this.px(0.28), y2: this.pz(5.03), stroke: '#0284c7', 'stroke-width': 0.7 }));
      // C06 RV Toilet
      box(0.09, 5.46, 0.16, 0.34, '', '#fff');
      g.appendChild(el('ellipse', { cx: this.px(0.36), cy: this.pz(5.63), rx: 0.14 * sc, ry: 0.17 * sc, fill: '#fff', stroke: '#4b5563', 'stroke-width': 0.9 }));
      box(0.10, 5.82, 0.22, 0.18, '手洗', '#eef7fc');
      // C10 Armored Shelter (locker + HEPA + beacon)
      box(0.09, 6.66, 0.42, 0.72, '非常備蓄', '#a6b0ba');
      g.appendChild(el('circle', { cx: this.px(0.62), cy: this.pz(7.30), r: 6, fill: '#ef4444', stroke: '#7f1d1d', 'stroke-width': 0.9 }));
      // C11 Comms & Satellite Ops
      box(2.23, 1.28, 0.38, 0.74, '衛星卓', '#d5e2ee');
      // C08 Walk-In Closet (hanger rod)
      box(2.25, 2.11, 0.36, 0.72, '衣類棚', '#f3e5cf');
      g.appendChild(el('line', { x1: this.px(2.18), y1: this.pz(2.14), x2: this.px(2.18), y2: this.pz(2.80), stroke: '#7c5a38', 'stroke-width': 1.2, 'stroke-dasharray': '4 2' }));
      // C09 Expedition Storage
      box(2.25, 2.91, 0.36, 0.74, '装備棚', '#b8bec4');
      // C12 Laundry & Drying (drum circle)
      box(2.19, 3.83, 0.42, 0.56, '', '#fff');
      g.appendChild(el('circle', { cx: this.px(2.40), cy: this.pz(4.11), r: 16, fill: '#e8f1f5', stroke: '#475569', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: this.px(2.40), y: this.pz(4.14), 'text-anchor': 'middle', 'font-size': 6.5, fill: '#334155', 'font-weight': 700 }, '洗濯'));
      // C13 Power & Battery Vault
      box(2.23, 4.56, 0.38, 0.66, '20kWh', '#cfd7df');
      // C14 Medical & Repair (workbench + Red Cross)
      box(2.23, 5.31, 0.38, 0.70, '整備台', '#f0e4cf');
      g.appendChild(el('line', { x1: this.px(2.42) - 6, y1: this.pz(5.44), x2: this.px(2.42) + 6, y2: this.pz(5.44), stroke: '#dc2626', 'stroke-width': 2.4 }));
      g.appendChild(el('line', { x1: this.px(2.42), y1: this.pz(5.44) - 6, x2: this.px(2.42), y2: this.pz(5.44) + 6, stroke: '#dc2626', 'stroke-width': 2.4 }));
      // C07 1F Cabin Bedroom
      box(1.65, 6.72, 0.94, 0.68, '1Fキャビンベッド', '#f4ece3');
      box(2.32, 6.83, 0.24, 0.46, '枕', '#fff');
      return;
    }

    if (floor.index === 13) {
      // CAMPER 2F LOFT FIXTURES (CL01 Front Sky-Bunk Loft + CL02 Rear Observation & Gear Loft)
      box(1.06, 0.18, 1.52, 1.72, 'キングサイズ寝台マット', '#f7ede0');
      box(1.31, 0.20, 0.42, 0.26, '枕', '#fff');
      box(1.91, 0.20, 0.42, 0.26, '枕', '#fff');
      box(0.13, 0.16, 0.38, 0.52, 'ギア箱', '#d8cfc0');
      // Rear Loft CL02
      box(1.68, 5.71, 0.68, 0.48, 'ロフト座卓', '#efe2ce');
      box(1.80, 6.23, 0.44, 0.44, '座布団', '#f2dcd6');
      box(0.14, 5.41, 0.48, 0.48, '木箱', '#d8cfc0');
      box(0.15, 5.97, 0.46, 0.46, '木箱', '#d8cfc0');
      return;
    }

    if (floor.index === 0) {
      const zones = [[2.85, 5.10], [5.20, 7.45], [7.55, 9.85]];
      zones.forEach(([z1, z2]) => {
        const mid = (z1 + z2) / 2;
        box(4.48, z1 + 0.04, 0.34, 0.66, '棚1', '#b8bec4');
        box(4.48, mid - 0.33, 0.34, 0.66, '棚2', '#b8bec4');
        box(4.48, z2 - 0.70, 0.34, 0.66, '棚3', '#b8bec4');
        box(3.59, z1 + 0.03, 0.66, 0.34, '棚4', '#b8bec4');
        box(3.59, z2 - 0.37, 0.66, 0.34, '棚5', '#b8bec4');
      });
    } else if (floor.index === 1) {
      box(0.17, 0.22, 0.34, 1.00, '下駄箱');
      box(4.42, 1.08, 0.40, 1.34, '薪棚', '#efe3d1');
      box(2.28, 0.22, 0.36, 1.02, '本棚');
      box(4.32, 2.80, 0.48, 0.48, '木箱');
      box(2.65, 3.60, 0.42, 0.62, 'WC');
      box(3.48, 3.58, 0.64, 0.66, '冷蔵庫');
      box(4.34, 3.62, 0.48, 1.30, 'パントリー');
      box(0.18, 7.38, 0.36, 1.84, 'TVボード');
      box(1.80, 7.42, 0.78, 1.85, '3Pソファ', '#e5e2dc');
      box(1.02, 7.86, 0.52, 0.96, 'テーブル');
      box(2.55, 5.82, 0.80, 1.28, 'ダイニング');
      box(4.18, 5.48, 0.65, 2.72, 'I型キッチン', '#f5efe6');
      box(3.74, 8.78, 0.56, 0.56, '座布団', '#f2dcd6');
      g.appendChild(el('circle', { cx: this.px(4.52), cy: this.pz(8.80), r: 13, fill: '#fff2d2', stroke: '#c97f2b', 'stroke-width': 1 }));
    } else if (floor.index === 2) {
      box(0.57, 0.18, 1.10, 0.36, 'ベンチ');
      box(4.19, 0.91, 0.62, 1.68, '書斎デスク');
      box(3.56, 1.52, 0.46, 0.46, '椅子');
      box(2.56, 3.05, 1.18, 0.38, '書棚');
      box(2.42, 3.57, 0.88, 0.50, '造作洗面');
      box(2.57, 5.29, 0.62, 0.62, '洗濯機');
      box(3.64, 5.06, 1.16, 0.84, '浴槽(1317)', '#d6edf7');
      box(2.07, 6.12, 1.62, 2.08, 'クイーンベッド', '#f4ece3');
      box(0.17, 6.48, 0.58, 1.95, 'W2050収納');
      box(4.38, 8.10, 0.44, 0.92, 'チェスト');
    } else if (floor.index === 3) {
      box(0.57, 0.18, 1.10, 0.36, '展望ベンチ');
      box(3.11, 1.36, 0.88, 0.88, 'ちゃぶ台');
      box(4.04, 2.44, 0.76, 0.96, '客布団', '#f0dfe2');
      box(2.89, 3.77, 0.54, 1.05, '黒大理石洗面');
      box(2.61, 5.20, 0.42, 0.62, 'WC');
      box(4.40, 3.62, 0.44, 2.15, 'アーカイブ棚');
      box(3.47, 6.74, 0.62, 1.72, '黒大理石BAR', '#e2e0dd');
      box(0.53, 7.75, 1.90, 0.80, '展望ソファ', '#e5e2dc');
      box(0.19, 6.26, 0.66, 1.18, 'アトリエ机');
    } else if (floor.index === 4) {
      box(0.20, 0.33, 0.36, 0.98, 'AV機器');
      box(1.41, 0.26, 0.62, 1.05, 'ソファ', '#dde1e6');
      box(3.57, 0.66, 1.22, 1.98, 'ローベッド', '#f4ece3');
      box(2.34, 3.00, 1.05, 0.44, '埋込収納');
      box(2.72, 3.57, 1.85, 0.42, '壁面ワードローブ');
      box(2.92, 5.51, 1.45, 0.42, 'ドレッサー');
      box(0.17, 6.10, 0.36, 1.45, '壁面書棚');
      box(0.17, 8.58, 0.36, 1.15, '壁面書棚');
      box(0.73, 9.24, 1.38, 0.56, '樹冠デスク');
      box(3.18, 6.28, 1.48, 0.74, 'ラウンジソファ', '#e5e2dc');
      box(3.42, 7.41, 0.86, 0.54, '大理石卓');
      box(4.17, 10.32, 0.36, 0.36, '腰掛');
    } else if (floor.index === 5) {
      box(3.94, 1.04, 0.62, 0.62, '木箱');
      box(3.89, 1.85, 0.66, 0.60, 'ロープ箱');
      box(3.95, 2.86, 0.55, 1.05, '麻袋');
      g.appendChild(el('rect', { x: this.px(1.30), y: this.pz(6.15), width: 240, height: 260, fill: 'url(#pat-tatami)', stroke: '#8c9470', 'stroke-width': 1 }));
      box(2.02, 7.13, 0.96, 0.64, '読書座卓');
      box(0.25, 6.88, 0.54, 1.15, '軒下収納');
      box(4.20, 7.02, 0.52, 1.05, 'チェスト');
      g.appendChild(el('circle', { cx: this.px(2.50), cy: this.pz(7.45), r: 15, fill: '#fff1cc', stroke: '#c97f2b', 'stroke-width': 1.2 }));
    } else if (floor.index === 6) {
      box(4.46, 0.42, 0.36, 1.05, '靴ベンチ');
      box(0.47, 0.20, 1.55, 0.68, '作業台');
      box(0.22, 1.56, 0.48, 0.48, '木箱');
      box(3.07, 1.78, 0.95, 0.48, '造作洗面');
      box(3.34, 3.21, 0.42, 0.62, 'WC');
      box(4.21, 4.17, 0.62, 1.95, 'カフェキッチン', '#f5efe6');
      box(2.42, 5.26, 0.86, 1.18, 'ダイニング');
      box(0.20, 5.90, 0.78, 1.56, 'デニムソファ', '#d8e0e8');
      box(1.24, 6.24, 0.48, 0.88, 'ロー卓');
      g.appendChild(el('circle', { cx: this.px(0.55), cy: this.pz(7.56), r: 14, fill: '#fff2d2', stroke: '#c97f2b', 'stroke-width': 1.1 }));
    } else if (floor.index === 7) {
      box(4.43, 0.57, 0.38, 1.15, '書庫棚');
      box(1.67, 0.19, 1.65, 0.38, '読書ベンチ');
      box(3.27, 3.45, 0.82, 0.82, 'ちゃぶ台');
      box(2.17, 5.78, 1.56, 1.92, 'クイーンベッド', '#f4ece3');
      box(4.29, 6.00, 0.52, 1.60, 'ワードローブ');
    } else if (floor.index === 8) {
      box(0.20, 0.22, 1.08, 0.48, '書斎机');
      box(2.48, 1.24, 1.85, 0.86, 'ゲストベッド', '#f4ece3');
      box(4.43, 2.34, 0.38, 1.12, '書庫棚');
      box(3.30, 3.96, 0.70, 0.68, '茶卓');
      box(1.08, 7.24, 1.15, 0.55, '作業台');
      box(3.28, 5.94, 1.35, 0.68, 'サロンソファ', '#d8e0e8');
    } else if (floor.index === 9) {
      box(0.24, 0.24, 0.42, 0.42, '木箱');
      box(0.68, 0.38, 0.54, 0.54, '座布団', '#d8e0e8');
      box(4.06, 0.46, 0.58, 0.58, '木箱');
      box(4.02, 1.40, 0.48, 0.52, '麻袋');
      box(4.19, 3.12, 0.58, 1.25, '工作台');
      box(0.21, 6.18, 0.38, 1.15, '古書棚');
      box(1.07, 6.49, 0.76, 0.52, '座卓');
      box(3.28, 6.48, 0.74, 0.54, '畳卓');
      g.appendChild(el('circle', { cx: this.px(3.25), cy: this.pz(6.75), r: 12, fill: '#fff1cc', stroke: '#c97f2b', 'stroke-width': 1.1 }));
    } else if (floor.index === 14) {
      // ULTRA-DETAILED 1/20 KEI-340 INTERIOR FIXTURES (SINGLE RHD SEAT ONLY + WALK-IN DAILY CARGO!)
      // Dashboard + amber speedometer cluster + center AC console + 3-pedal box
      box(0.07, 0.07, 1.34, 0.27, 'インストルメントパネル', '#dde2e8');
      box(0.90, 0.24, 0.36, 0.11, '計器盤', '#fef3c7');
      [0.94, 1.06, 1.18].forEach((ppx, pi) => {
        box(ppx - 0.025, 0.20, 0.05, 0.08, ['C', 'B', 'A'][pi], '#cbd5e1');
      });
      // Steering wheel Ø350 symbol on RIGHT (RHD!) + shift lever + handbrake
      g.appendChild(el('circle', { cx: this.px(1.08), cy: this.pz(0.46), r: 17, fill: 'none', stroke: '#1c1e22', 'stroke-width': 2.2 }));
      g.appendChild(el('circle', { cx: this.px(1.08), cy: this.pz(0.46), r: 4, fill: '#1c1e22' }));
      g.appendChild(el('line', { x1: this.px(1.08) - 15, y1: this.pz(0.46), x2: this.px(1.08) + 15, y2: this.pz(0.46), stroke: '#1c1e22', 'stroke-width': 1.3 }));
      g.appendChild(el('circle', { cx: this.px(0.76), cy: this.pz(0.58), r: 5.5, fill: '#334155', stroke: '#111', 'stroke-width': 0.8 }));
      g.appendChild(el('text', { x: this.px(0.76), y: this.pz(0.58) + 2.2, 'text-anchor': 'middle', 'font-size': 5.8, fill: '#fff', 'font-weight': 700 }, 'MT'));
      box(0.73, 0.72, 0.06, 0.22, '', '#475569');
      // ONLY ONE SEAT: RHD Driver Bucket Seat (bolstered cushion + backrest + headrest)
      box(0.84, 0.58, 0.48, 0.44, '運転席(1脚のみ)', '#cbd9e8');
      box(0.85, 0.96, 0.46, 0.10, '背もたれ', '#94a3b8');
      box(0.96, 0.98, 0.24, 0.07, '', '#64748b');
      // Single-side protective cargo divider bar behind driver ONLY
      g.appendChild(el('line', { x1: this.px(0.79), y1: this.pz(1.15), x2: this.px(1.41), y2: this.pz(1.15), stroke: '#1c1e22', 'stroke-width': 2.6 }));
      g.appendChild(el('text', { x: this.px(1.10), y: this.pz(1.12), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#1c1e22' }, '荷室仕切バー'));

      // Passenger-Delete Front Cargo (K02: daily tool tote + umbrella)
      box(0.08, 0.46, 0.26, 0.44, '工具箱', '#cfdbe8');
      box(0.09, 0.94, 0.07, 0.18, '傘', '#cbd5e1');

      // Rear Inner Wheel-Arch Humps (dashed mechanical steel)
      box(0.06, 2.35, 0.18, 0.62, '', '#e2e6ea');
      box(1.24, 2.35, 0.18, 0.62, '', '#e2e6ea');

      // Right Cargo Wall: DIY 2-Tier Birch Utility Shelf + Oricons + Parcel + Emergency Kit + Pegboard
      box(1.07, 1.36, 0.34, 1.88, '', '#f5ebdc');
      box(1.09, 1.43, 0.30, 0.46, 'オリコン×2', '#d7e2d3');
      box(1.10, 2.06, 0.28, 0.44, '日用品箱', '#eadcc7');
      box(1.10, 2.75, 0.28, 0.38, '非常工具', '#f4d3d0');
      g.appendChild(el('text', { x: this.px(1.24), y: this.pz(1.31), 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#7c5a38' }, 'DIY 2段合板棚'));

      // Left Rear Cargo Wall (aft of sliding door DK-L): Cooler + Wood Crate + Rolled Tarp
      box(0.08, 2.28, 0.32, 0.48, 'クーラー', '#d1e6dc');
      box(0.08, 2.82, 0.32, 0.44, '木箱+シート', '#e8dcc7');

      // TO-SCALE PROTAGONIST HUMAN SILHOUETTE (Ø400 mm!) standing/crouching inside walk-in cargo bay!
      const hx = this.px(0.74);
      const hy = this.pz(2.58);
      g.appendChild(el('circle', { cx: hx, cy: hy, r: 0.20 * sc, fill: 'rgba(156,71,34,0.12)', stroke: '#9c4722', 'stroke-width': 1.0, 'stroke-dasharray': '3 2' }));
      g.appendChild(el('ellipse', { cx: hx, cy: hy, rx: 0.18 * sc, ry: 0.095 * sc, fill: 'rgba(156,71,34,0.22)', stroke: '#9c4722', 'stroke-width': 1.1 }));
      g.appendChild(el('circle', { cx: hx, cy: hy, r: 0.075 * sc, fill: '#fff', stroke: '#9c4722', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: hx, y: hy + 0.27 * sc, 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#9c4722' }, '主人公進入確認 (Ø400)'));
      return;
    } else {
      box(1.58, 0.19, 0.28, 0.68, '棚', '#aeb4ba');
      box(1.58, 1.13, 0.28, 0.68, '棚', '#aeb4ba');
    }
  }

  _drawWallsAndColumns(g, floor, isAnnex, isStorage, isCamper, isKei = false) {
    const sc = this.scale;
    for (const w of floor.walls) {
      const isH = w.axis === 'h';
      const fill = w.kind === 'railing' ? '#9c4722' : (w.kind.startsWith('ext') ? 'url(#hatch-ext)' : 'url(#hatch-int)');
      const ops = [...(w.openings || [])].sort((a, b) => a.pos - b.pos);
      const start = isH ? w.x1 : w.z1;
      const end = isH ? w.x2 : w.z2;
      let cur = start;

      const drawSeg = (a, b) => {
        if (b - a < 0.005) return;
        if (isH) {
          g.appendChild(el('rect', { x: this.px(a), y: this.pz(w.z1), width: (b - a) * sc, height: (w.z2 - w.z1) * sc, fill, stroke: '#1c1e22', 'stroke-width': 0.9 }));
        } else {
          g.appendChild(el('rect', { x: this.px(w.x1), y: this.pz(a), width: (w.x2 - w.x1) * sc, height: (b - a) * sc, fill, stroke: '#1c1e22', 'stroke-width': 0.9 }));
        }
      };

      for (const op of ops) {
        drawSeg(cur, op.pos);
        cur = op.pos + op.width;
      }
      drawSeg(cur, end);
    }

    if (isCamper || isKei) return;
    const cols = isStorage ? STORAGE.columns : (isAnnex ? ANNEX.columns : COLUMNS);
    const colSz = isStorage ? 14 : 11;
    cols.forEach(([cx, cz]) => {
      if (floor.isBasement && cz < 2.40) return;
      g.appendChild(el('rect', { x: this.px(cx) - colSz / 2, y: this.pz(cz) - colSz / 2, width: colSz, height: colSz, fill: '#1c1e22' }));
    });
  }

  _drawOpenings(g, floor) {
    const sc = this.scale;
    for (const w of floor.walls) {
      const isH = w.axis === 'h';
      const midOrtho = isH ? this.pz((w.z1 + w.z2) / 2) : this.px((w.x1 + w.x2) / 2);

      for (const op of w.openings || []) {
        const len = op.width * sc;
        if (op.type.startsWith('window')) {
          if (isH) {
            g.appendChild(el('rect', { x: this.px(op.pos), y: this.pz(w.z1), width: len, height: (w.z2 - w.z1) * sc, fill: '#eef7fc', stroke: '#1d7a8c', 'stroke-width': 1 }));
            g.appendChild(el('line', { x1: this.px(op.pos), y1: midOrtho, x2: this.px(op.pos + op.width), y2: midOrtho, stroke: '#1d7a8c', 'stroke-width': 1.2 }));
          } else {
            g.appendChild(el('rect', { x: this.px(w.x1), y: this.pz(op.pos), width: (w.x2 - w.x1) * sc, height: len, fill: '#eef7fc', stroke: '#1d7a8c', 'stroke-width': 1 }));
            g.appendChild(el('line', { x1: midOrtho, y1: this.pz(op.pos), x2: midOrtho, y2: this.pz(op.pos + op.width), stroke: '#1d7a8c', 'stroke-width': 1.2 }));
          }
        } else if (op.type === 'door_swing') {
          const dir = op.swingDir || 1;
          if (isH) {
            const hx = this.px(op.pos);
            const hy = midOrtho;
            g.appendChild(el('line', { x1: hx, y1: hy, x2: hx, y2: hy + dir * len, stroke: '#9c4722', 'stroke-width': 1.6 }));
            g.appendChild(el('path', { d: `M ${hx + len} ${hy} A ${len} ${len} 0 0 ${dir > 0 ? 1 : 0} ${hx} ${hy + dir * len}`, fill: 'none', stroke: '#9c4722', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));
          } else {
            const hx = midOrtho;
            const hy = this.pz(op.pos);
            g.appendChild(el('line', { x1: hx, y1: hy, x2: hx + dir * len, y2: hy, stroke: '#9c4722', 'stroke-width': 1.6 }));
            g.appendChild(el('path', { d: `M ${hx} ${hy + len} A ${len} ${len} 0 0 ${dir > 0 ? 0 : 1} ${hx + dir * len} ${hy}`, fill: 'none', stroke: '#9c4722', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));
          }
        } else if (op.type === 'door_pocket' || op.type === 'door_slide_ext') {
          if (isH) {
            g.appendChild(el('line', { x1: this.px(op.pos), y1: midOrtho - 3, x2: this.px(op.pos + op.width), y2: midOrtho - 3, stroke: '#9c4722', 'stroke-width': 1.8 }));
            g.appendChild(el('line', { x1: this.px(op.pos) - len * 0.25, y1: midOrtho + 3, x2: this.px(op.pos + op.width), y2: midOrtho + 3, stroke: '#9c4722', 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }));
          } else {
            g.appendChild(el('line', { x1: midOrtho - 3, y1: this.pz(op.pos), x2: midOrtho - 3, y2: this.pz(op.pos + op.width), stroke: '#9c4722', 'stroke-width': 1.8 }));
            g.appendChild(el('line', { x1: midOrtho + 3, y1: this.pz(op.pos) + (op.type === 'door_slide_ext' ? 0 : -len * 0.25), x2: midOrtho + 3, y2: this.pz(op.pos + op.width) + (op.type === 'door_slide_ext' ? len * 0.55 : 0), stroke: '#9c4722', 'stroke-width': 0.9, 'stroke-dasharray': '3 2' }));
          }
        } else if (op.type === 'door_liftgate') {
          g.appendChild(el('line', { x1: this.px(op.pos), y1: midOrtho, x2: this.px(op.pos + op.width), y2: midOrtho, stroke: '#1d7a8c', 'stroke-width': 2.2, 'stroke-dasharray': '6 2' }));
          [op.pos + 0.12, op.pos + op.width - 0.12].forEach((hx) => {
            g.appendChild(el('rect', { x: this.px(hx) - 3, y: midOrtho - 3, width: 6, height: 6, fill: '#1d7a8c' }));
          });
        }

        const tx = isH ? this.px(op.pos + op.width / 2) : (midOrtho + (w.x1 > 1.2 && (floor.isCamper || floor.isKei) ? -18 : 16));
        const ty = isH ? midOrtho - 9 : this.pz(op.pos + op.width / 2) + 3;
        g.appendChild(el('text', { x: tx, y: ty, 'text-anchor': 'middle', 'font-size': 6.9, 'font-weight': 700, fill: op.type.startsWith('window') || op.type === 'door_liftgate' ? '#1d7a8c' : '#9c4722' }, op.id));
      }
    }
  }

  _drawLighting(g, floor) {
    (floor.lighting || []).forEach((l) => {
      const cx = this.px(l.x);
      const cy = this.pz(l.z);
      g.appendChild(el('circle', { cx, cy, r: 6.5, fill: '#fff8d6', stroke: '#d97706', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: cx, y: cy + 2.3, 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': 700, fill: '#b45309' }, l.type));
    });
    (floor.switches || []).forEach((s) => {
      const cx = this.px(s.x);
      const cy = this.pz(s.z);
      g.appendChild(el('circle', { cx, cy, r: 3.3, fill: '#d97706' }));
      g.appendChild(el('text', { x: cx + 5, y: cy + 3, 'font-size': 6.5, fill: '#92400e', 'font-weight': 700 }, s.label));
    });
  }

  _drawOutlets(g, floor) {
    (floor.outlets || []).forEach((o) => {
      const cx = this.px(o.x);
      const cy = this.pz(o.z);
      g.appendChild(el('circle', { cx, cy, r: 4.8, fill: '#fff', stroke: '#2563eb', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: cx + 7, y: cy + 3, 'font-size': 6.8, fill: '#1d4ed8', 'font-weight': 700 }, o.label));
    });
  }

  _drawPlumbing(g, floor) {
    (floor.plumbing || []).forEach((p) => {
      if (p.pts) {
        const d = p.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${this.px(pt[0])} ${this.pz(pt[1])}`).join(' ');
        g.appendChild(el('path', { d, fill: 'none', stroke: p.kind === 'water' ? '#0284c7' : '#7c3aed', 'stroke-width': 1.8, 'stroke-dasharray': p.kind === 'drain' ? '5 3' : 'none' }));
      } else {
        g.appendChild(el('rect', { x: this.px(p.x) - 22, y: this.pz(p.z) - 7, width: 44, height: 14, rx: 2, fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 0.8 }));
        g.appendChild(el('text', { x: this.px(p.x), y: this.pz(p.z) + 3, 'text-anchor': 'middle', 'font-size': 6.5, fill: '#92400e', 'font-weight': 700 }, p.label));
      }
    });
  }

  _drawFlowPaths(g, floor) {
    const colorMap = { entry: ['#c25e28', 'url(#arr-entry)'], work: ['#1d7a8c', 'url(#arr-work)'], priv: ['#6b4fa1', 'url(#arr-priv)'] };
    (floor.flowPaths || []).forEach((fp) => {
      const [stroke, marker] = fp.color ? [fp.color, 'url(#arr-entry)'] : (colorMap[fp.kind] || colorMap.entry);
      const d = fp.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${this.px(pt[0])} ${this.pz(pt[1])}`).join(' ');
      g.appendChild(el('path', { d, fill: 'none', stroke, 'stroke-width': 1.8, 'stroke-dasharray': '6 4', 'marker-end': marker, opacity: 0.78 }));
    });
  }

  _drawRoomLabels(g, floor, isStorage, isCamper, isKei = false) {
    for (const r of floor.rooms) {
      const [lx, lz] = r.labelPos;
      const cx = this.px(lx);
      const cy = this.pz(lz);

      if (isKei) {
        const yAdj = r.code === 'K03' ? this.pz(1.58) : (r.code === 'K02' ? this.pz(0.70) : this.pz(0.76));
        const xAdj = r.code === 'K02' ? this.px(0.50) : cx;
        const bw = r.code === 'K03' ? 140 : 94;
        const grp = el('g', { style: 'pointer-events:none' });
        grp.appendChild(el('rect', { x: xAdj - bw / 2, y: yAdj - 13, width: bw, height: 26, rx: 3, fill: 'rgba(255,255,255,0.90)', stroke: 'rgba(28,30,34,0.28)', 'stroke-width': 0.7 }));
        grp.appendChild(el('text', { x: xAdj, y: yAdj - 2, 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#1c1e22' }, `${r.code} ${r.nameJp.split('（')[0]}`));
        grp.appendChild(el('text', { x: xAdj, y: yAdj + 8, 'text-anchor': 'middle', 'font-size': 6.3, fill: '#7a4b25', 'font-family': 'monospace' }, `${r.area.toFixed(2)}m² · ${r.ch}`));
        g.appendChild(grp);
        continue;
      }

      if (isCamper && r.id === 'c1_corridor') {
        const grp = el('g', { style: 'pointer-events:none' });
        grp.appendChild(el('rect', { x: cx - 14, y: cy - 72, width: 28, height: 144, rx: 3, fill: 'rgba(255,255,255,0.92)', stroke: '#b9381c', 'stroke-width': 0.85 }));
        grp.appendChild(el('text', { x: cx, y: cy, 'text-anchor': 'middle', 'font-size': 7.4, 'font-weight': 700, fill: '#b9381c', transform: `rotate(-90 ${cx} ${cy})` }, 'C00 極狭廊下 W460 / CH3,020'));
        g.appendChild(grp);
        continue;
      }

      const isNarrow = r.w <= 1.05 && !isStorage && !isCamper;
      const boxW = isCamper ? (r.w > 1.5 ? 148 : 112) : (isNarrow ? 82 : (isStorage ? 168 : 114));
      const boxH = isCamper ? 30 : 34;
      const grp = el('g', { style: 'pointer-events:none' });
      grp.appendChild(el('rect', { x: cx - boxW / 2, y: cy - boxH / 2, width: boxW, height: boxH, rx: 3.2, fill: 'rgba(255,255,255,0.88)', stroke: 'rgba(28,30,34,0.22)', 'stroke-width': 0.65 }));
      grp.appendChild(el('text', { x: cx, y: cy - 3.5, 'text-anchor': 'middle', 'font-size': isCamper ? 7.1 : (isNarrow ? 7.0 : 7.8), 'font-weight': 700, fill: '#1c1e22' }, `${r.code} ${r.nameJp}`));
      grp.appendChild(el('text', { x: cx, y: cy + 5.5, 'text-anchor': 'middle', 'font-size': 6.5, fill: '#5b5852' }, `${r.area.toFixed(2)}m² · ${r.ch}`));
      if (!isCamper) {
        grp.appendChild(el('text', { x: cx, y: cy + 13.5, 'text-anchor': 'middle', 'font-size': 6.4, fill: '#8a5328', 'font-family': 'monospace' }, `${r.fl} / ${r.ch}`));
      }
      g.appendChild(grp);
    }
  }

  _drawDimensions(g, floor, isAnnex, isStorage, isCamper, isKei, bWidth, bDepth) {
    const dimH = (x1, x2, y, label) => {
      const a = this.px(x1), b = this.px(x2);
      g.appendChild(el('line', { x1: a, y1: y, x2: b, y2: y, stroke: '#2c2f36', 'stroke-width': 0.85 }));
      g.appendChild(el('line', { x1: a, y1: y - 5, x2: a, y2: y + 5, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('line', { x1: b, y1: y - 5, x2: b, y2: y + 5, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: (a + b) / 2, y: y - 4, 'text-anchor': 'middle', 'font-size': 8.0, 'font-family': 'monospace', fill: '#1c1e22' }, label));
    };
    const dimV = (z1, z2, x, label) => {
      const a = this.pz(z1), b = this.pz(z2);
      g.appendChild(el('line', { x1: x, y1: a, x2: x, y2: b, stroke: '#2c2f36', 'stroke-width': 0.85 }));
      g.appendChild(el('line', { x1: x - 5, y1: a, x2: x + 5, y2: a, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('line', { x1: x - 5, y1: b, x2: x + 5, y2: b, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: x - 6, y: (a + b) / 2, 'text-anchor': 'middle', 'font-size': 8.0, 'font-family': 'monospace', fill: '#1c1e22', transform: `rotate(-90 ${x - 6} ${(a + b) / 2})` }, label));
    };

    const axes = isKei ? KEI.gridAxes : (isCamper ? CAMPER.gridAxes : (isStorage ? STORAGE.gridAxes : (isAnnex ? ANNEX.gridAxes : GRID_AXES)));
    const dimHOuterY = isKei ? this.pz(-0.66) : (isCamper ? this.pz(-0.92) : (isStorage ? this.pz(-1.16) : (floor.hasAnnexBalconies ? this.pz(-1.78) : this.pz(-1.55))));
    const dimHInnerY = isKei ? this.pz(-0.34) : (isCamper ? this.pz(-0.46) : (isStorage ? this.pz(-0.84) : (floor.hasAnnexBalconies ? this.pz(-1.52) : this.pz(-0.78))));
    const dimVOuterX = isKei ? this.px(-0.74) : (isCamper ? this.px(-1.08) : (isStorage ? this.px(-0.92) : (floor.hasAnnexBalconies ? this.px(-1.78) : this.px(-1.52))));
    const dimVInnerX = isKei ? this.px(-0.42) : (isCamper ? this.px(-0.62) : (isStorage ? this.px(-0.48) : (floor.hasAnnexBalconies ? this.px(-1.54) : this.px(-0.78))));

    dimH(0, bWidth, dimHOuterY, Math.round(bWidth * 1000).toLocaleString());
    const xs = axes.x;
    for (let i = 0; i < xs.length - 1; i++) {
      dimH(xs[i].pos, xs[i + 1].pos, dimHInnerY, `${Math.round((xs[i + 1].pos - xs[i].pos) * 1000)}`);
    }

    dimV(0, bDepth, dimVOuterX, Math.round(bDepth * 1000).toLocaleString());
    const zs = axes.z;
    for (let i = 0; i < zs.length - 1; i++) {
      dimV(zs[i].pos, zs[i + 1].pos, dimVInnerX, `${Math.round((zs[i + 1].pos - zs[i].pos) * 1000)}`);
    }
  }

  _drawCameraMarker(g, isAnnex, isStorage, isCamper, isKei = false) {
    const sx = isKei ? 0.74 : (isCamper ? 1.35 : (isStorage ? 0.65 : (isAnnex ? 2.50 : 1.62)));
    const sz = isKei ? 1.72 : (isCamper ? 2.49 : (isStorage ? 0.53 : (isAnnex ? 5.80 : 6.25)));
    this.camGroup = el('g', { id: 'cam-marker' });
    this.camCone = el('g', { transform: `translate(${this.px(sx)}, ${this.pz(sz)}) rotate(90)` });
    this.camCone.appendChild(el('path', { d: 'M 0 0 L 42 -20 A 46 46 0 0 1 42 20 Z', fill: 'rgba(217, 70, 38, 0.24)', stroke: '#d94626', 'stroke-width': 0.9 }));
    this.camDot = el('circle', { cx: this.px(sx), cy: this.pz(sz), r: 6, fill: '#d94626', stroke: '#fff', 'stroke-width': 2 });
    this.camGroup.appendChild(this.camCone);
    this.camGroup.appendChild(this.camDot);
    g.appendChild(this.camGroup);
  }

  /**
   * Dedicated Right-Column 3-View Engineering Projection Suite for Sheet 14 (KEI-340):
   * 1) 1/30 Longitudinal Side Cross-Section (L 3,400 × H 1,800 mm, driver & cargo crouch heights, 81° liftgate arc!)
   * 2) 1/26 Rear Elevation & Cargo Bay Cross-Section (W 1,480 × H 1,800 mm, W600 walk-in alley + DIY shelf + cooler!)
   * 3) Complete Automotive Specification Schedule (主要諸元表)
   */
  _drawKeiEngineeringViews(svg, VW, VH) {
    const g = el('g');
    const colX = 500;
    const colW = VW - colX - 28; // ~379px

    // --- PANEL 1: 1/30 LONGITUDINAL SIDE CROSS-SECTION (L 3,400 × H 1,800 mm) ---
    const p1Y = 82;
    const p1H = 264;
    g.appendChild(el('rect', { x: colX, y: p1Y, width: colW, height: p1H, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1.1 }));
    g.appendChild(el('rect', { x: colX, y: p1Y, width: colW, height: 22, fill: '#efebe2', stroke: '#2c2f36', 'stroke-width': 0.7 }));
    g.appendChild(el('text', { x: colX + 10, y: p1Y + 14.5, 'font-size': 8.4, 'font-weight': 700, fill: '#1c1e22' },
      '① 側面縦断面図 (1/30) — 全長 3,400 × 全高 1,800 mm（1席＋進入可能荷室）'));

    const scS = 66; // 3.40m -> 224px + 81deg liftgate arc -> 309px, fits cleanly inside 379px box!
    const sx0 = colX + 20;
    const glS = p1Y + 216;
    const vx = (m) => sx0 + m * scS;
    const vy = (m) => glS - m * scS;

    g.appendChild(el('line', { x1: colX + 12, y1: glS, x2: colX + colW - 12, y2: glS, stroke: '#5a6354', 'stroke-width': 1.4 }));
    g.appendChild(el('text', { x: colX + 14, y: glS - 4, 'font-size': 6.6, fill: '#5a6354', 'font-family': 'monospace' }, 'GL'));

    // Outer High-Roof Kei-Van Silhouette (0..3.40m, y=0.34..1.80m)
    g.appendChild(el('rect', { x: vx(0), y: vy(1.80), width: 3.40 * scS, height: 1.46 * scS, rx: 4, fill: '#f8f6f0', stroke: '#1c1e22', 'stroke-width': 1.8 }));
    // Interior Cavity (0.06..3.34m, y=0.34..1.72m -> exact CH 1,380mm!)
    g.appendChild(el('rect', { x: vx(0.06), y: vy(1.72), width: 3.28 * scS, height: 1.38 * scS, fill: '#fcfbf7', stroke: '#555', 'stroke-width': 0.8 }));
    // Front & Rear Bumpers + Headlight + Taillight
    g.appendChild(el('rect', { x: vx(-0.08), y: vy(0.56), width: 0.09 * scS, height: 0.28 * scS, rx: 2, fill: '#2c3138' }));
    g.appendChild(el('rect', { x: vx(3.39), y: vy(0.54), width: 0.08 * scS, height: 0.24 * scS, rx: 2, fill: '#2c3138' }));
    // Front Windshield & Side Windows
    g.appendChild(el('rect', { x: vx(0.00), y: vy(1.62), width: 0.06 * scS, height: 0.56 * scS, fill: '#dff0fa', stroke: '#1d7a8c', 'stroke-width': 0.9 }));
    g.appendChild(el('rect', { x: vx(1.24), y: vy(1.66), width: 0.84 * scS, height: 1.30 * scS, fill: 'rgba(156,71,34,0.06)', stroke: '#9c4722', 'stroke-width': 0.9, 'stroke-dasharray': '4 2' }));
    g.appendChild(el('text', { x: vx(1.66), y: vy(1.52), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#9c4722' }, 'DK-L 開口'));

    // Single RHD Driver Seat Profile + Steering Column + Dash + Seated Driver Eye Height (FL+980)
    g.appendChild(el('rect', { x: vx(0.06), y: vy(1.06), width: 0.28 * scS, height: 0.38 * scS, fill: '#cbd5e1', stroke: '#334155', 'stroke-width': 0.8 }));
    g.appendChild(el('line', { x1: vx(0.28), y1: vy(0.95), x2: vx(0.50), y2: vy(1.16), stroke: '#1c1e22', 'stroke-width': 2.0 }));
    g.appendChild(el('rect', { x: vx(0.60), y: vy(0.68), width: 0.44 * scS, height: 0.16 * scS, rx: 2, fill: '#94a3b8', stroke: '#334155', 'stroke-width': 0.8 }));
    g.appendChild(el('rect', { x: vx(0.96), y: vy(1.24), width: 0.10 * scS, height: 0.58 * scS, rx: 2, fill: '#94a3b8', stroke: '#334155', 'stroke-width': 0.8 }));
    g.appendChild(el('circle', { cx: vx(0.84), cy: vy(1.32), r: 6.5, fill: 'none', stroke: '#1d4ed8', 'stroke-width': 1.1, 'stroke-dasharray': '2 1.5' }));
    g.appendChild(el('text', { x: vx(0.74), y: vy(1.44), 'text-anchor': 'middle', 'font-size': 5.6, 'font-weight': 700, fill: '#1d4ed8' }, '運転目線+980'));
    // Cargo Divider Post behind Driver
    g.appendChild(el('line', { x1: vx(1.15), y1: vy(0.34), x2: vx(1.15), y2: vy(1.20), stroke: '#1c1e22', 'stroke-width': 1.8 }));

    // Walk-In Cargo Bay: Crouching Protagonist Silhouette (Eye FL+1,040, Headroom CH 1,380!) + 2-Tier Shelf
    g.appendChild(el('rect', { x: vx(1.36), y: vy(0.88), width: 1.88 * scS, height: 0.04 * scS, fill: '#d6bfa0', stroke: '#7c5a38', 'stroke-width': 0.7 }));
    g.appendChild(el('rect', { x: vx(1.36), y: vy(1.32), width: 1.88 * scS, height: 0.04 * scS, fill: '#d6bfa0', stroke: '#7c5a38', 'stroke-width': 0.7 }));
    g.appendChild(el('rect', { x: vx(1.43), y: vy(0.64), width: 0.46 * scS, height: 0.28 * scS, fill: '#d7e2d3', stroke: '#45543e', 'stroke-width': 0.7 }));
    g.appendChild(el('rect', { x: vx(2.06), y: vy(1.16), width: 0.44 * scS, height: 0.26 * scS, fill: '#eadcc7', stroke: '#7c5a38', 'stroke-width': 0.7 }));
    // Crouching Protagonist Silhouette inside cargo bay
    g.appendChild(el('circle', { cx: vx(2.60), cy: vy(1.42), r: 6.8, fill: 'rgba(156,71,34,0.16)', stroke: '#9c4722', 'stroke-width': 1.1 }));
    g.appendChild(el('path', { d: `M ${vx(2.60)} ${vy(1.32)} L ${vx(2.57)} ${vy(0.82)} L ${vx(2.46)} ${vy(0.34)} M ${vx(2.57)} ${vy(0.82)} L ${vx(2.72)} ${vy(0.34)}`, fill: 'none', stroke: '#9c4722', 'stroke-width': 1.4 }));
    g.appendChild(el('text', { x: vx(2.60), y: vy(1.56), 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': 700, fill: '#9c4722' }, '荷室目線+1,040'));
    // Overhead Dome LED Strip
    g.appendChild(el('rect', { x: vx(1.69), y: vy(1.72), width: 0.42 * scS, height: 3.5, fill: '#f59e0b' }));

    // Rear Liftgate Open Swing Arc (81° UPWARD!) — cleanly inside Panel 1!
    const hX = vx(3.37);
    const hY = vy(1.70);
    const lgLen = 1.30 * scS;
    const endX = hX + lgLen * Math.sin(1.42);
    const endY = hY + lgLen * Math.cos(1.42);
    g.appendChild(el('line', { x1: hX, y1: hY, x2: endX, y2: endY, stroke: '#1d7a8c', 'stroke-width': 1.8 }));
    g.appendChild(el('path', { d: `M ${hX} ${vy(0.40)} A ${lgLen} ${lgLen} 0 0 0 ${endX} ${endY}`, fill: 'none', stroke: '#1d7a8c', 'stroke-width': 0.9, 'stroke-dasharray': '4 2' }));
    g.appendChild(el('text', { x: hX + 42, y: endY - 10, 'text-anchor': 'middle', 'font-size': 6.2, 'font-weight': 700, fill: '#1d7a8c' }, 'DK-R 開放81°'));

    // Underfloor 658cc Engine & Fuel Tank Dashed Outlines + 2 Wheels (Ø540 mm)
    g.appendChild(el('rect', { x: vx(0.82), y: vy(0.32), width: 0.56 * scS, height: 0.16 * scS, fill: 'rgba(51,65,85,0.16)', stroke: '#334155', 'stroke-width': 0.7, 'stroke-dasharray': '3 2' }));
    g.appendChild(el('text', { x: vx(1.10), y: vy(0.22), 'text-anchor': 'middle', 'font-size': 5.4, fill: '#334155' }, '658cc'));
    KEI.axlesZ.forEach((az) => {
      g.appendChild(el('circle', { cx: vx(az), cy: vy(0.27), r: 0.27 * scS, fill: '#1f2428', stroke: '#555', 'stroke-width': 1.3 }));
      g.appendChild(el('circle', { cx: vx(az), cy: vy(0.27), r: 0.14 * scS, fill: '#9aa3ad' }));
    });

    // Side Section Height & Length Dimensions (cleanly positioned inside Panel 1!)
    const rDimX = vx(4.84);
    g.appendChild(el('line', { x1: rDimX, y1: vy(0), x2: rDimX, y2: vy(1.80), stroke: '#9c4722', 'stroke-width': 1.0 }));
    g.appendChild(el('text', { x: rDimX - 3, y: vy(1.86), 'text-anchor': 'end', 'font-size': 6.3, 'font-family': 'monospace', 'font-weight': 700, fill: '#9c4722' }, '+1,800'));
    g.appendChild(el('text', { x: rDimX + 3, y: vy(1.02), 'font-size': 5.8, 'font-family': 'monospace', fill: '#0369a1', 'font-weight': 700 }, 'CH1380'));
    g.appendChild(el('text', { x: rDimX + 3, y: vy(0.30), 'font-size': 5.8, 'font-family': 'monospace', fill: '#444' }, '+340'));
    g.appendChild(el('text', { x: colX + colW / 2, y: glS + 16, 'text-anchor': 'middle', 'font-size': 6.9, 'font-family': 'monospace', fill: '#1c1e22' }, 'FOH 680 ｜ WB 1,980 ｜ ROH 740 ＝ 全長 3,400 mm'));

    // --- PANEL 2: 1/26 REAR ELEVATION & CARGO BAY CROSS-SECTION (W 1,480 × H 1,800 mm) ---
    const p2Y = p1Y + p1H + 14;
    const p2H = 240;
    g.appendChild(el('rect', { x: colX, y: p2Y, width: colW, height: p2H, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1.1 }));
    g.appendChild(el('rect', { x: colX, y: p2Y, width: colW, height: 22, fill: '#efebe2', stroke: '#2c2f36', 'stroke-width': 0.7 }));
    g.appendChild(el('text', { x: colX + 10, y: p2Y + 14.5, 'font-size': 8.4, 'font-weight': 700, fill: '#1c1e22' },
      '② 後部横断面図 (1/26) — 全幅 1,480 × 全高 1,800 mm（荷室進入クリアランス）'));

    const scR = 88; // 1.48m -> 130px, 1.80m -> 158px!
    const rx0 = colX + 112;
    const glR = p2Y + 206;
    const rvx = (m) => rx0 + m * scR;
    const rvy = (m) => glR - m * scR;

    g.appendChild(el('line', { x1: colX + 24, y1: glR, x2: colX + colW - 24, y2: glR, stroke: '#5a6354', 'stroke-width': 1.4 }));
    // Rear Tires (Track 1,300mm)
    [0.01, 1.31].forEach((tx) => {
      g.appendChild(el('rect', { x: rvx(tx), y: rvy(0.54), width: 0.16 * scR, height: 0.54 * scR, rx: 3, fill: '#1f2428' }));
    });
    // Body Shell (W 1.48m × H 1.46m above +0.34m floor) + Roof Rails
    g.appendChild(el('rect', { x: rvx(0), y: rvy(1.80), width: 1.48 * scR, height: 1.46 * scR, rx: 4, fill: '#f8f6f0', stroke: '#1c1e22', 'stroke-width': 1.8 }));
    g.appendChild(el('rect', { x: rvx(0.06), y: rvy(1.72), width: 1.36 * scR, height: 1.38 * scR, fill: '#fcfbf7', stroke: '#555', 'stroke-width': 0.8 }));
    // Taillights & Yellow Kei License Plate at Rear Bumper
    g.appendChild(el('rect', { x: rvx(0.02), y: rvy(0.90), width: 0.07 * scR, height: 0.34 * scR, fill: '#dc2626' }));
    g.appendChild(el('rect', { x: rvx(1.39), y: rvy(0.90), width: 0.07 * scR, height: 0.34 * scR, fill: '#dc2626' }));
    g.appendChild(el('rect', { x: rvx(0.575), y: rvy(0.49), width: 0.33 * scR, height: 0.14 * scR, fill: '#f2c738', stroke: '#1c1e22', 'stroke-width': 0.7 }));
    g.appendChild(el('text', { x: rvx(0.74), y: rvy(0.40), 'text-anchor': 'middle', 'font-size': 5.6, 'font-weight': 700, fill: '#1c1e22' }, '軽 580'));

    // Cutaway Cargo Bay Contents: Left Cooler & Crate | CENTER W600 PROTAGONIST ALLEY | Right 2-Tier Birch Rack!
    g.appendChild(el('rect', { x: rvx(0.07), y: rvy(0.72), width: 0.34 * scR, height: 0.38 * scR, fill: '#d1e6dc', stroke: '#2d5e48', 'stroke-width': 0.8 }));
    g.appendChild(el('text', { x: rvx(0.24), y: rvy(0.50), 'text-anchor': 'middle', 'font-size': 5.6, fill: '#1e4633', 'font-weight': 700 }, 'クーラー'));
    // Right 2-Tier Birch Shelf + Containers
    g.appendChild(el('rect', { x: rvx(1.07), y: rvy(0.88), width: 0.34 * scR, height: 0.04 * scR, fill: '#d6bfa0', stroke: '#7c5a38', 'stroke-width': 0.7 }));
    g.appendChild(el('rect', { x: rvx(1.07), y: rvy(1.32), width: 0.34 * scR, height: 0.04 * scR, fill: '#d6bfa0', stroke: '#7c5a38', 'stroke-width': 0.7 }));
    g.appendChild(el('rect', { x: rvx(1.09), y: rvy(0.64), width: 0.30 * scR, height: 0.28 * scR, fill: '#d7e2d3', stroke: '#45543e', 'stroke-width': 0.7 }));
    g.appendChild(el('rect', { x: rvx(1.09), y: rvy(1.16), width: 0.30 * scR, height: 0.26 * scR, fill: '#cfdbe8', stroke: '#2c3f59', 'stroke-width': 0.7 }));
    g.appendChild(el('text', { x: rvx(1.24), y: rvy(1.40), 'text-anchor': 'middle', 'font-size': 5.6, fill: '#7c5a38', 'font-weight': 700 }, '2段棚'));
    // Center Open Walk-In Alley Highlight + Front-Facing Crouching Protagonist Silhouette!
    g.appendChild(el('rect', { x: rvx(0.44), y: rvy(1.72), width: 0.60 * scR, height: 1.38 * scR, fill: 'rgba(156,71,34,0.08)', stroke: '#9c4722', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));
    g.appendChild(el('circle', { cx: rvx(0.74), cy: rvy(1.40), r: 7.5, fill: 'rgba(156,71,34,0.18)', stroke: '#9c4722', 'stroke-width': 1.1 }));
    g.appendChild(el('rect', { x: rvx(0.56), y: rvy(1.28), width: 0.36 * scR, height: 0.44 * scR, rx: 6, fill: 'rgba(156,71,34,0.15)', stroke: '#9c4722', 'stroke-width': 1.0 }));
    g.appendChild(el('text', { x: rvx(0.74), y: rvy(1.57), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'W600×H1380'));
    // Rear Section Dimensions (W1,480 / Inner 1,360 / H1,800)
    g.appendChild(el('line', { x1: rvx(0), y1: glR + 10, x2: rvx(1.48), y2: glR + 10, stroke: '#1c1e22', 'stroke-width': 0.9 }));
    g.appendChild(el('text', { x: rvx(0.74), y: glR + 22, 'text-anchor': 'middle', 'font-size': 7.0, 'font-family': 'monospace', 'font-weight': 700, fill: '#1c1e22' }, '全幅 W = 1,480 mm (内幅 1,360)'));
    g.appendChild(el('line', { x1: rvx(1.62), y1: rvy(0), x2: rvx(1.62), y2: rvy(1.80), stroke: '#9c4722', 'stroke-width': 0.9 }));
    g.appendChild(el('text', { x: rvx(1.68), y: rvy(0.92), 'font-size': 6.6, 'font-family': 'monospace', 'font-weight': 700, fill: '#9c4722' }, 'H 1,800'));

    // --- PANEL 3: AUTOMOTIVE SPECIFICATION SCHEDULE (主要諸元表) ---
    const p3Y = p2Y + p2H + 14;
    const p3H = Math.max(150, VH - 232 - p3Y);
    g.appendChild(el('rect', { x: colX, y: p3Y, width: colW, height: p3H, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1.1 }));
    g.appendChild(el('rect', { x: colX, y: p3Y, width: colW, height: 21, fill: '#efebe2', stroke: '#2c2f36', 'stroke-width': 0.7 }));
    g.appendChild(el('text', { x: colX + 10, y: p3Y + 14, 'font-size': 8.2, 'font-weight': 700, fill: '#1c1e22' },
      '③ KEI-340 主要諸元・厳格衝突設計仕様'));

    const rowH = Math.min(20, (p3H - 25) / KEI.specs.length);
    KEI.specs.forEach(([k, v], i) => {
      const ry = p3Y + 21 + i * rowH;
      if (i % 2 === 1) g.appendChild(el('rect', { x: colX + 1, y: ry, width: colW - 2, height: rowH, fill: '#faf7f1' }));
      g.appendChild(el('line', { x1: colX, y1: ry + rowH, x2: colX + colW, y2: ry + rowH, stroke: 'rgba(28,30,34,0.14)', 'stroke-width': 0.6 }));
      g.appendChild(el('text', { x: colX + 8, y: ry + rowH * 0.72, 'font-size': 6.9, 'font-weight': 700, fill: '#4a4640' }, k));
      g.appendChild(el('text', { x: colX + 132, y: ry + rowH * 0.72, 'font-size': 7.0, 'font-family': 'monospace', fill: '#1c1e22' }, v));
    });

    svg.appendChild(g);
  }

  /**
   * Bottom Engineering Section + JIS Title Block:
   * - On Camper Sheets (12 & 13): Draws 1/65 Longitudinal Section (L7,500 × H3,400mm)
   * - On Building Sheets (0..11) & Kei Sheet (14): Draws 5-Unit Compound Site Elevation Diagram!
   */
  _drawTitleBlockAndSection(svg, floor, VW, VH, isCamper, isKei = false) {
    const baseTop = VH - 218;
    const g = el('g');

    const secX = 28;
    const secY = baseTop;
    const secW = 356;
    const secH = 190;
    g.appendChild(el('rect', { x: secX, y: secY, width: secW, height: secH, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1 }));

    if (isCamper) {
      g.appendChild(el('text', { x: secX + 10, y: secY + 15, 'font-size': 8.5, 'font-weight': 700, fill: '#1c1e22' },
        'キャンピングカー 縦断面図 (L7,500 × H3,400 / 1F高天井CH3,020＋2Fロフト)'));
      const scM = 34.5;
      const lx0 = secX + 32;
      const glY = secY + 156;
      const vx = (m) => lx0 + m * scM;
      const vy = (m) => glY - m * scM;

      g.appendChild(el('line', { x1: secX + 12, y1: glY, x2: secX + secW - 12, y2: glY, stroke: '#5a6354', 'stroke-width': 1.4 }));
      g.appendChild(el('rect', { x: vx(0), y: vy(3.40), width: 7.5 * scM, height: 3.10 * scM, fill: '#f7f4ec', stroke: '#1c1e22', 'stroke-width': 1.6 }));
      const f1Act = floor.camperLevel === 1;
      const f2Act = floor.camperLevel === 2;
      g.appendChild(el('rect', { x: vx(0.07), y: vy(2.28), width: 7.36 * scM, height: 1.98 * scM, fill: f1Act ? 'rgba(217,70,38,0.16)' : '#f8f5ef', stroke: '#4a4640', 'stroke-width': 0.7 }));
      g.appendChild(el('rect', { x: vx(2.17), y: vy(3.32), width: 3.08 * scM, height: 3.02 * scM, fill: f1Act ? 'rgba(217,70,38,0.22)' : 'rgba(2,132,199,0.10)', stroke: '#0284c7', 'stroke-width': 0.9, 'stroke-dasharray': '4 2' }));
      g.appendChild(el('rect', { x: vx(0.07), y: vy(3.32), width: 2.10 * scM, height: 0.98 * scM, fill: f2Act ? 'rgba(217,70,38,0.26)' : '#efe5d3', stroke: '#1c1e22', 'stroke-width': f2Act ? 1.5 : 0.9 }));
      g.appendChild(el('rect', { x: vx(5.25), y: vy(3.32), width: 2.18 * scM, height: 0.98 * scM, fill: f2Act ? 'rgba(217,70,38,0.26)' : '#dce6d4', stroke: '#1c1e22', 'stroke-width': f2Act ? 1.5 : 0.9 }));
      g.appendChild(el('line', { x1: vx(2.17), y1: vy(2.34), x2: vx(5.25), y2: vy(2.34), stroke: '#9c4722', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }));
      g.appendChild(el('line', { x1: vx(6.66), y1: vy(0.30), x2: vx(6.96), y2: vy(2.34), stroke: '#9c4722', 'stroke-width': 2.0 }));
      g.appendChild(el('rect', { x: vx(5.10), y: vy(3.50), width: 1.95 * scM, height: 4, fill: '#1e3a8a' }));
      g.appendChild(el('rect', { x: vx(-0.16), y: vy(0.92), width: 0.16 * scM, height: 0.56 * scM, fill: '#2c3138' }));
      CAMPER.axlesZ.forEach((az) => {
        g.appendChild(el('circle', { cx: vx(az), cy: vy(0.40), r: 0.40 * scM, fill: '#1f2428', stroke: '#555', 'stroke-width': 1.2 }));
        g.appendChild(el('circle', { cx: vx(az), cy: vy(0.40), r: 0.21 * scM, fill: '#9aa3ad' }));
      });
      g.appendChild(el('text', { x: vx(1.12), y: vy(2.75), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#1c1e22' }, 'CL01 前ロフト(CH980)'));
      g.appendChild(el('text', { x: vx(6.34), y: vy(2.75), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': 700, fill: '#1c1e22' }, 'CL02 後ロフト'));
      g.appendChild(el('text', { x: vx(3.71), y: vy(1.90), 'text-anchor': 'middle', 'font-size': 7.0, 'font-weight': 700, fill: '#0369a1' }, '1F 高天井吹抜'));
      g.appendChild(el('text', { x: vx(3.71), y: vy(1.52), 'text-anchor': 'middle', 'font-size': 6.8, 'font-weight': 700, fill: '#0369a1', 'font-family': 'monospace' }, 'CH 3,020 mm'));
      g.appendChild(el('text', { x: vx(1.10), y: vy(1.10), 'text-anchor': 'middle', 'font-size': 6.4, fill: '#333' }, '運転室/座席'));
      g.appendChild(el('text', { x: vx(6.20), y: vy(1.10), 'text-anchor': 'middle', 'font-size': 6.4, fill: '#333' }, '寝室/シェルター'));
      const dxR = vx(7.85);
      g.appendChild(el('line', { x1: dxR, y1: vy(0), x2: dxR, y2: vy(3.40), stroke: '#9c4722', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: dxR + 5, y: vy(3.32), 'font-size': 6.4, 'font-family': 'monospace', fill: '#9c4722', 'font-weight': 700 }, '+3,400'));
      g.appendChild(el('text', { x: dxR + 5, y: vy(2.34), 'font-size': 6.2, 'font-family': 'monospace', fill: '#444' }, '+2,340'));
      g.appendChild(el('text', { x: dxR + 5, y: vy(0.30), 'font-size': 6.2, 'font-family': 'monospace', fill: '#444' }, '+300'));
      g.appendChild(el('text', { x: vx(3.75), y: glY + 14, 'text-anchor': 'middle', 'font-size': 7.0, 'font-family': 'monospace', fill: '#1c1e22' }, '全長 L = 7,500 mm ｜ 全幅 W = 2,700 mm ｜ 全高 H = 3,400 mm'));
    } else {
      g.appendChild(el('text', { x: secX + 10, y: secY + 15, 'font-size': 8.0, 'font-weight': 700, fill: '#1c1e22' },
        '全5拠点配置 断面比較（隣棟｜母屋6層｜軽バン｜RC倉庫｜巨大RV）'));

      const sx = (m) => secX + 106 + m * 9.6;
      const sy = (m) => secY + 152 - m * 8.6;

      g.appendChild(el('line', { x1: secX + 10, y1: sy(0), x2: secX + secW - 10, y2: sy(0), stroke: '#5a6354', 'stroke-width': 1.4 }));
      g.appendChild(el('text', { x: secX + 12, y: sy(0) - 3, 'font-size': 6.4, fill: '#5a6354' }, 'GL'));

      // 1. Neighbor Annex (-7.6 .. -2.6)
      [
        { idx: 6, y0: 0.00, y1: 2.75, txt: '隣1F' },
        { idx: 7, y0: 2.75, y1: 5.50, txt: '隣2F' },
        { idx: 8, y0: 5.50, y1: 8.15, txt: '隣3F' },
      ].forEach((b) => {
        const act = floor.index === b.idx;
        g.appendChild(el('rect', {
          x: sx(-7.6), y: sy(b.y1), width: 5.0 * 9.6, height: sy(b.y0) - sy(b.y1),
          fill: act ? 'rgba(217, 70, 38, 0.25)' : '#f5f2eb', stroke: '#2c2f36', 'stroke-width': act ? 1.5 : 0.85,
        }));
        g.appendChild(el('text', { x: sx(-5.1), y: (sy(b.y0) + sy(b.y1)) / 2 + 2.5, 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': act ? 700 : 500, fill: act ? '#b9381c' : '#444' }, b.txt));
      });
      const arAct = floor.index === 9;
      g.appendChild(el('polygon', {
        points: `${sx(-7.6)},${sy(8.15)} ${sx(-7.6)},${sy(9.55)} ${sx(-5.1)},${sy(10.95)} ${sx(-2.6)},${sy(9.55)} ${sx(-2.6)},${sy(8.15)}`,
        fill: arAct ? 'rgba(217, 70, 38, 0.25)' : '#f5f2eb', stroke: '#2c2f36', 'stroke-width': arAct ? 1.5 : 0.9,
      }));
      g.appendChild(el('text', { x: sx(-5.1), y: sy(9.2), 'text-anchor': 'middle', 'font-size': 5.5, 'font-weight': arAct ? 700 : 500, fill: arAct ? '#b9381c' : '#444' }, '屋根裏5室'));

      // 2. Main Tower (0 .. 5.0)
      [
        { idx: 0, y0: -2.40, y1: 0.00, txt: 'B1F' },
        { idx: 1, y0: 0.00, y1: 2.75, txt: '1F' },
        { idx: 2, y0: 2.75, y1: 5.50, txt: '2F' },
        { idx: 3, y0: 5.50, y1: 8.15, txt: '3F' },
        { idx: 4, y0: 8.15, y1: 10.50, txt: '4F' },
      ].forEach((b) => {
        const act = b.idx === floor.index;
        g.appendChild(el('rect', {
          x: sx(0), y: sy(b.y1), width: 5.0 * 9.6, height: sy(b.y0) - sy(b.y1),
          fill: act ? 'rgba(217, 70, 38, 0.25)' : (b.idx === 0 ? '#dcdde0' : '#f8f5ef'), stroke: '#2c2f36', 'stroke-width': act ? 1.5 : 0.85,
        }));
        g.appendChild(el('text', { x: sx(2.5), y: (sy(b.y0) + sy(b.y1)) / 2 + 2.5, 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': act ? 700 : 500, fill: act ? '#b9381c' : '#3a3732' }, b.txt));
      });
      const mAttAct = floor.index === 5;
      g.appendChild(el('polygon', {
        points: `${sx(0)},${sy(10.50)} ${sx(0)},${sy(11.92)} ${sx(2.5)},${sy(13.33)} ${sx(5)},${sy(11.92)} ${sx(5)},${sy(10.50)}`,
        fill: mAttAct ? 'rgba(217, 70, 38, 0.25)' : '#f8f5ef', stroke: '#2c2f36', 'stroke-width': mAttAct ? 1.5 : 0.9,
      }));
      g.appendChild(el('text', { x: sx(2.5), y: sy(11.5), 'text-anchor': 'middle', 'font-size': 5.5, 'font-weight': mAttAct ? 700 : 500, fill: mAttAct ? '#b9381c' : '#444' }, '母屋RF'));

      // 3. Daily Kei-Van Silhouette (front parked beside Main Entrance, W1.48 × H1.80m!)
      g.appendChild(el('rect', { x: sx(5.6), y: sy(1.80), width: 1.55 * 9.6, height: sy(0.30) - sy(1.80), fill: isKei ? 'rgba(217,70,38,0.32)' : '#e6ece8', stroke: isKei ? '#b9381c' : '#1d7a8c', 'stroke-width': isKei ? 1.5 : 1.0 }));
      g.appendChild(el('rect', { x: sx(5.7), y: sy(0.30), width: 3.2, height: sy(0) - sy(0.30), fill: '#1c1e22' }));
      g.appendChild(el('rect', { x: sx(6.75), y: sy(0.30), width: 3.2, height: sy(0) - sy(0.30), fill: '#1c1e22' }));
      g.appendChild(el('text', { x: sx(6.38), y: sy(-1.45), 'text-anchor': 'middle', 'font-size': 5.8, 'font-weight': 700, fill: isKei ? '#b9381c' : '#1d7a8c' }, '軽バン'));

      // 4. Concrete Warehouse (7.8 .. 9.8)
      const s1Act = floor.index === 10;
      const s2Act = floor.index === 11;
      g.appendChild(el('rect', { x: sx(7.8), y: sy(2.12), width: 2.0 * 9.6, height: sy(0) - sy(2.12), fill: s1Act ? 'rgba(217,70,38,0.28)' : '#cfd4d9', stroke: '#2c2f36', 'stroke-width': s1Act ? 1.5 : 0.9 }));
      g.appendChild(el('rect', { x: sx(7.8), y: sy(4.28), width: 2.0 * 9.6, height: sy(2.12) - sy(4.28), fill: s2Act ? 'rgba(217,70,38,0.28)' : '#c5cbd1', stroke: '#2c2f36', 'stroke-width': s2Act ? 1.5 : 0.9 }));
      g.appendChild(el('text', { x: sx(8.8), y: sy(0.9), 'text-anchor': 'middle', 'font-size': 5.2, fill: '#222' }, '倉1F'));
      g.appendChild(el('text', { x: sx(8.8), y: sy(3.0), 'text-anchor': 'middle', 'font-size': 5.2, fill: '#222' }, '倉2F'));

      // 5. Movable Giant Camper (10.5 .. 13.2, H=3.40m!)
      g.appendChild(el('rect', { x: sx(10.6), y: sy(3.40), width: 2.7 * 9.6, height: sy(0.30) - sy(3.40), fill: '#e5e9ee', stroke: '#9c4722', 'stroke-width': 1.0 }));
      g.appendChild(el('rect', { x: sx(10.7), y: sy(0.30), width: 4.0, height: sy(0) - sy(0.30), fill: '#1c1e22' }));
      g.appendChild(el('rect', { x: sx(12.8), y: sy(0.30), width: 4.0, height: sy(0) - sy(0.30), fill: '#1c1e22' }));
      g.appendChild(el('text', { x: sx(11.95), y: sy(1.5), 'text-anchor': 'middle', 'font-size': 5.5, 'font-weight': 700, fill: '#9c4722' }, '巨大RV'));
      g.appendChild(el('text', { x: sx(11.95), y: sy(-1.45), 'text-anchor': 'middle', 'font-size': 5.6, 'font-weight': 700, fill: '#9c4722' }, 'RV3.4m'));
      g.appendChild(el('text', { x: sx(-5.1), y: sy(-1.45), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#3d523a' }, '隣棟5×8m'));
      g.appendChild(el('text', { x: sx(2.5), y: sy(-3.35), 'text-anchor': 'middle', 'font-size': 6.0, 'font-weight': 700, fill: '#1c1e22' }, '母屋5×10m'));
      g.appendChild(el('text', { x: sx(8.8), y: sy(-1.45), 'text-anchor': 'middle', 'font-size': 5.6, 'font-weight': 700, fill: '#4f555c' }, 'RC倉庫'));

      [
        [13.33, '+13.3m'],
        [8.15, '+8.15m'],
        [3.40, '+3.4m RV'],
        [1.80, '+1.8m 軽'],
        [-2.40, '-2.4m B1'],
      ].forEach(([m, txt]) => {
        g.appendChild(el('text', { x: secX + 278, y: sy(m) + 2.5, 'font-size': 6.0, fill: '#5b5852', 'font-family': 'monospace' }, txt));
      });
    }

    // --- JIS Title Block ---
    const tbX = 394;
    const tbW = VW - tbX - 28;
    g.appendChild(el('rect', { x: tbX, y: baseTop, width: tbW, height: secH, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1 }));
    g.appendChild(el('line', { x1: tbX, y1: baseTop + 34, x2: tbX + tbW, y2: baseTop + 34, stroke: '#2c2f36', 'stroke-width': 0.8 }));
    g.appendChild(el('line', { x1: tbX, y1: baseTop + 82, x2: tbX + tbW, y2: baseTop + 82, stroke: '#2c2f36', 'stroke-width': 0.8 }));
    g.appendChild(el('line', { x1: tbX, y1: baseTop + 144, x2: tbX + tbW, y2: baseTop + 144, stroke: '#2c2f36', 'stroke-width': 0.8 }));

    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 21, 'font-size': 8.8, 'font-weight': 700, fill: '#1c1e22' }, 'PROJECT : NARROW-50 ＋ 隣棟 ＋ RC倉庫 ＋ 巨大RV ＋ 日常軽バン KEI-340'));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 51, 'font-size': 8.5, 'font-weight': 700, fill: '#9c4722' }, `図面名称 : ${floor.titleJp}`));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 69, 'font-size': 7.5, fill: '#5b5852' }, '5拠点構成 : 母屋6層 ｜ 隣棟3F+RF ｜ RC倉庫2F ｜ 巨大RV(14室+2F) ｜ 軽バン(1席+進入荷室)'));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 98, 'font-size': 7.5, fill: '#1c1e22' }, '建築3棟 : 母屋延262.4m² ｜ 隣棟延154.3m² (3F 6室+3B+5室RF) ｜ RC倉庫 2×2m 4室'));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 114, 'font-size': 7.5, fill: '#9c4722' }, '巨大RV : 2.7×7.5×H3.4m (1F 全14室＋W460極狭廊下＋CH3,020吹抜 / 2F ロフト2室)'));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 131, 'font-size': 7.5, fill: '#1d7a8c', 'font-weight': 700 }, '日常軽バン : 3.40×1.48×H1.80m (RHD運転席1脚のみ＋主人公進入可能フル荷室・相互SAT衝突自走)'));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 161, 'font-size': 7.5, fill: '#1c1e22' }, isKei ? '縮尺 : 平面 1/20 ｜ 側面断面 1/30 ｜ 後部断面 1/26 ｜ 2D SAT OBB-vs-OBB 厳格衝突判定' : (isCamper ? '縮尺 : S = 1/34 (縦断面 1/65) ｜ 厳格SAT/OBB当たり判定自走対応' : '縮尺 : S = 1/50 (倉庫 1/28・RV 1/34・軽 1/20) ｜ 単位 : mm ｜ 赤点 = 現在地')));
    g.appendChild(el('text', { x: tbX + 10, y: baseTop + 178, 'font-size': 7.3, fill: '#6c665d' }, '母屋・隣棟・RC倉庫・巨大RV・日常軽バンまで全15図面＆完全一人称徒歩・運転探索対応'));

    svg.appendChild(g);
  }
}
