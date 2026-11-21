import { HOUSE, ANNEX, BLUEPRINT_SHEETS, GRID_AXES, COLUMNS } from './planData.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 100; // 1 meter = 100 SVG units
const PAD_L = 175;
const PAD_R = 165;
const PAD_T = 245;
const PAD_B = 345;

const px = (x) => PAD_L + x * SCALE;
const pz = (z) => PAD_T + z * SCALE;

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
    this.activeFloor = HOUSE.spawnFloor; // Default 1F (index 1)
    this.lastPose = null;
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
    const poseSheet = pose.sheetIndex !== undefined ? pose.sheetIndex : pose.floor;
    const sameSheet = poseSheet === this.activeFloor;
    this.camGroup.setAttribute('opacity', sameSheet ? '1' : '0.24');

    const mapX = isAnnexSheet ? (pose.x - ANNEX.originX) : pose.x;
    const mapZ = isAnnexSheet ? (pose.z - ANNEX.originZ) : pose.z;
    const cx = px(Math.max(-1.4, Math.min((floor.width || HOUSE.width) + 1.4, mapX)));
    const cz = pz(Math.max(-1.4, Math.min((floor.depth || HOUSE.depth) + 1.4, mapZ)));
    const ang = (Math.atan2(pose.dz, pose.dx) * 180) / Math.PI;
    this.camDot.setAttribute('cx', cx);
    this.camDot.setAttribute('cy', cz);
    this.camCone.setAttribute('transform', `translate(${cx}, ${cz}) rotate(${ang})`);
  }

  _buildSVG() {
    const floor = BLUEPRINT_SHEETS[this.activeFloor];
    const isAnnex = floor.building === 'annex';
    const bWidth = floor.width || HOUSE.width;
    const bDepth = floor.depth || HOUSE.depth;
    const VW = PAD_L + bWidth * SCALE + PAD_R; // 840
    const VH = PAD_T + bDepth * SCALE + PAD_B; // 1590 (Main) or 1390 (Annex)
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

    const patTatami = el('pattern', { id: 'pat-tatami', width: 10, height: 5, patternUnits: 'userSpaceOnUse' });
    patTatami.appendChild(el('rect', { width: 10, height: 5, fill: '#dde6c8' }));
    patTatami.appendChild(el('line', { x1: 0, y1: 2.5, x2: 10, y2: 2.5, stroke: '#bcc99f', 'stroke-width': 0.8 }));
    defs.appendChild(patTatami);

    const patDeck = el('pattern', { id: 'pat-deck', width: 100, height: 14, patternUnits: 'userSpaceOnUse' });
    patDeck.appendChild(el('rect', { width: 100, height: 14, fill: '#ead8c0' }));
    patDeck.appendChild(el('line', { x1: 0, y1: 14, x2: 100, y2: 14, stroke: '#c7a982', 'stroke-width': 1 }));
    defs.appendChild(patDeck);

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

    this._drawSheetHeader(svg, floor, bWidth, bDepth, VW);

    const names = ['exterior', 'materials', 'grid', 'furniture', 'walls', 'openings', 'plumbing', 'outlets', 'lighting', 'flow', 'labels', 'dimensions', 'camera'];
    names.forEach((n) => {
      const g = el('g', { id: `layer-${n}` });
      svg.appendChild(g);
      this.layerGroups[n] = g;
    });

    this._drawExteriorContext(this.layerGroups.exterior, floor, isAnnex, bWidth, bDepth);
    this._drawRoomFloors(this.layerGroups.materials, floor);
    this._drawGridAxes(this.layerGroups.grid, isAnnex, bDepth);
    this._drawStairwellSymbol(this.layerGroups.furniture, floor, isAnnex);
    this._drawFurniturePlan(this.layerGroups.furniture, floor);
    this._drawWallsAndColumns(this.layerGroups.walls, floor, isAnnex);
    this._drawOpenings(this.layerGroups.openings, floor);
    this._drawPlumbing(this.layerGroups.plumbing, floor);
    this._drawOutlets(this.layerGroups.outlets, floor);
    this._drawLighting(this.layerGroups.lighting, floor);
    this._drawFlowPaths(this.layerGroups.flow, floor);
    this._drawRoomLabels(this.layerGroups.labels, floor);
    this._drawDimensions(this.layerGroups.dimensions, isAnnex, bWidth, bDepth);
    this._drawCameraMarker(this.layerGroups.camera, isAnnex);
    this._drawTitleBlockAndSection(svg, floor, VW, VH);

    this.container.appendChild(svg);
    this.syncLayerVisibility();
  }

  _drawSheetHeader(svg, floor, bWidth, bDepth, VW) {
    const g = el('g');
    const sizeTxt = `${Math.round(bWidth * 1000).toLocaleString()} × ${Math.round(bDepth * 1000).toLocaleString()} mm`;
    g.appendChild(el('text', { x: 32, y: 44, 'font-size': 14.5, 'font-weight': 700, fill: '#1c1e22', 'letter-spacing': 0.6 },
      `実施設計 ${floor.titleJp} (1/50)  —  ${sizeTxt} [${floor.code}]`));
    g.appendChild(el('text', { x: 32, y: 62, 'font-size': 9.6, fill: '#5b5852' },
      `${floor.subtitle}  |  基準床 ${floor.floorLabel}`));

    const nc = el('g', { transform: `translate(${VW - 64}, 54)` });
    nc.appendChild(el('circle', { cx: 0, cy: 0, r: 19, fill: 'none', stroke: '#2c2f36', 'stroke-width': 1 }));
    nc.appendChild(el('polygon', { points: '0,-16 -5,3 0,-2 5,3', fill: '#1c1e22' }));
    nc.appendChild(el('polygon', { points: '0,16 -4,3 0,6 4,3', fill: 'none', stroke: '#1c1e22', 'stroke-width': 0.8 }));
    nc.appendChild(el('text', { x: 0, y: -22, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#1c1e22' }, 'N'));
    g.appendChild(nc);
    svg.appendChild(g);
  }

  _drawExteriorContext(g, floor, isAnnex, bWidth, bDepth) {
    if (isAnnex) {
      if (floor.physicalFloor === 1) {
        g.appendChild(el('rect', { x: px(2.85), y: pz(-1.10), width: 210, height: 110, fill: '#dde2db', stroke: '#8c9689', 'stroke-width': 0.9 }));
        g.appendChild(el('text', { x: px(3.90), y: pz(-0.52), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#4c5749', 'font-weight': 600 }, '離れ玄関ポーチ・石灯籠'));
        g.appendChild(el('rect', { x: px(5.15), y: pz(0.0), width: 115, height: bDepth * SCALE, fill: '#eef2ea', stroke: '#8fa18a', 'stroke-width': 0.9, 'stroke-dasharray': '5 3' }));
        const ct = el('text', { x: px(5.72), y: pz(4.0), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#3d523a', 'font-weight': 700, transform: `rotate(90 ${px(5.72)} ${pz(4.0)})` }, '東2.6m：石灯籠苔中庭 → 母屋 (5×10m 4階建)');
        g.appendChild(ct);
        g.appendChild(el('text', { x: px(2.50), y: pz(8.42), 'text-anchor': 'middle', 'font-size': 9.5, fill: '#5b6b59', 'font-weight': 600 }, '南面：老杉の森（離れカフェ南大窓ビュー）'));
      } else {
        g.appendChild(el('rect', {
          x: px(-0.45), y: pz(-0.45), width: (bWidth + 0.90) * SCALE, height: (bDepth + 0.90) * SCALE,
          fill: 'none', stroke: '#7a756b', 'stroke-width': 0.9, 'stroke-dasharray': '7 4',
        }));
        g.appendChild(el('text', { x: px(2.50), y: pz(-0.56), 'text-anchor': 'middle', 'font-size': 9, fill: '#6b655c' }, '片流れスレート屋根 軒先ライン（西軒+5,450 → 東棟+6,350 / 出450）'));
        const ct = el('text', { x: px(5.72), y: pz(4.0), 'text-anchor': 'middle', 'font-size': 9.0, fill: '#3d523a', 'font-weight': 700, transform: `rotate(90 ${px(5.72)} ${pz(4.0)})` }, '東2.6m向かい：母屋 5×10m タワー棟');
        g.appendChild(ct);
      }
      return;
    }

    if (floor.isBasement) {
      g.appendChild(el('rect', { x: px(0), y: pz(0), width: 500, height: 270, fill: 'url(#hatch-earth)', stroke: '#7c766b', 'stroke-width': 1 }));
      g.appendChild(el('text', { x: px(2.50), y: pz(1.35), 'text-anchor': 'middle', 'font-size': 10, fill: '#5a554c', 'font-weight': 700 }, '地中基礎・地盤土（北側非掘削部）'));
      g.appendChild(el('text', { x: px(2.50), y: pz(10.38), 'text-anchor': 'middle', 'font-size': 9.5, fill: '#4f555c', 'font-weight': 600 }, 'RC地下擁壁（灰色セメント・低天井 CH2,020・薄明作業灯）'));
    } else if (floor.index === 1) {
      g.appendChild(el('rect', { x: px(0.10), y: pz(-1.20), width: 210, height: 120, fill: '#dde2db', stroke: '#8c9689', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: px(1.15), y: pz(-0.55), 'text-anchor': 'middle', 'font-size': 9.5, fill: '#4c5749', 'font-weight': 600 }, '玄関ポーチ・苔石森道'));
      g.appendChild(el('text', { x: px(-0.36), y: pz(5.0), 'text-anchor': 'middle', 'font-size': 8.6, fill: '#3d523a', 'font-weight': 700, transform: `rotate(-90 ${px(-0.36)} ${pz(5.0)})` }, '← 西2.6m 中庭・隣棟「森の離れ」(5×8m 2階建)'));
      g.appendChild(el('rect', { x: px(0.05), y: pz(10.0), width: 490, height: 120, fill: 'url(#pat-deck)', stroke: '#8d6e4a', 'stroke-width': 1 }));
      g.appendChild(el('text', { x: px(2.50), y: pz(10.68), 'text-anchor': 'middle', 'font-size': 10, fill: '#6b4f31', 'font-weight': 600 }, '南 縁側ウッドデッキ (W4,900×D1,350)  —  深い老杉の森'));
    } else if (floor.hasBalcony) {
      const bal = HOUSE.balcony4F;
      g.appendChild(el('rect', {
        x: px(bal.minX), y: pz(bal.minZ), width: (bal.maxX - bal.minX) * SCALE, height: (bal.maxZ - bal.minZ) * SCALE,
        fill: 'url(#pat-deck)', stroke: '#1c1e22', 'stroke-width': 2.2,
      }));
      g.appendChild(el('line', { x1: px(bal.minX), y1: pz(11.18), x2: px(bal.maxX), y2: pz(11.18), stroke: '#9c4722', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: px(3.65), y: pz(11.30), 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'W 2,000'));
      g.appendChild(el('line', { x1: px(4.82), y1: pz(10.0), x2: px(4.82), y2: pz(11.0), stroke: '#9c4722', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: px(5.16), y: pz(10.55), 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#9c4722', 'font-family': 'monospace' }, 'D 1,000'));
    } else if (floor.isAttic) {
      g.appendChild(el('rect', {
        x: px(-0.50), y: pz(-0.45), width: (HOUSE.width + 1.0) * SCALE, height: (HOUSE.depth + 0.90) * SCALE,
        fill: 'none', stroke: '#7a756b', 'stroke-width': 0.9, 'stroke-dasharray': '7 4',
      }));
      g.appendChild(el('text', { x: px(2.50), y: pz(-0.58), 'text-anchor': 'middle', 'font-size': 9, fill: '#6b655c' }, '切妻屋根 軒先ライン (東西出500 / 南北ケラバ出450 / 6寸勾配)'));
    } else {
      g.appendChild(el('text', { x: px(2.50), y: pz(-0.32), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#5b6b59' }, `北面：老杉の森（樹高20〜31m・${floor.code}樹冠ビュー）`));
      g.appendChild(el('text', { x: px(2.50), y: pz(10.45), 'text-anchor': 'middle', 'font-size': 9.2, fill: '#5b6b59' }, `南面：月光の杉林・${floor.code}パノラマ樹冠展望`));
    }
  }

  _drawRoomFloors(g, floor) {
    for (const r of floor.rooms) {
      const isTatami = r.floorTex.startsWith('tatami');
      const isDeck = r.floorTex === 'wood_deck';
      const rect = el('rect', {
        x: px(r.x), y: pz(r.z), width: r.w * SCALE, height: r.d * SCALE,
        fill: isTatami ? 'url(#pat-tatami)' : (isDeck ? 'url(#pat-deck)' : r.tint),
        stroke: 'rgba(40,40,40,0.08)', 'stroke-width': 0.6,
        class: 'bp-room-hit',
        style: 'cursor:pointer',
      });
      rect.addEventListener('mouseenter', () => {
        rect.setAttribute('stroke', '#9c4722');
        rect.setAttribute('stroke-width', '2');
        if (this.callbacks.onRoomHover) this.callbacks.onRoomHover(r);
      });
      rect.addEventListener('mouseleave', () => {
        rect.setAttribute('stroke', 'rgba(40,40,40,0.08)');
        rect.setAttribute('stroke-width', '0.6');
        if (this.callbacks.onRoomHover) this.callbacks.onRoomHover(null);
      });
      g.appendChild(rect);
    }

    if (floor.isBasement) {
      g.appendChild(el('line', { x1: px(0.18), y1: pz(9.55), x2: px(3.12), y2: pz(9.55), stroke: '#2c3e50', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
      g.appendChild(el('text', { x: px(1.65), y: pz(9.48), 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#2c3e50', 'font-family': 'monospace' }, '主空間 内法 W 3,000 × D 7,000 mm'));
      g.appendChild(el('rect', { x: px(2.94), y: pz(3.00), width: 18, height: 665, fill: '#aeb4ba', stroke: '#5c636b', 'stroke-width': 0.6 }));
    }

    if (floor.isAttic) {
      g.appendChild(el('line', { x1: px(2.50), y1: pz(0.15), x2: px(2.50), y2: pz(9.85), stroke: '#9c4722', 'stroke-width': 1.4, 'stroke-dasharray': '12 4 3 4' }));
      g.appendChild(el('text', { x: px(2.55), y: pz(0.55), 'font-size': 8.5, fill: '#9c4722', 'font-weight': 700 }, '棟木ライン CH2,830 (6寸勾配頂部)'));
      [1.28, 3.72].forEach((cx) => {
        g.appendChild(el('line', { x1: px(cx), y1: pz(0.15), x2: px(cx), y2: pz(9.85), stroke: '#7e6952', 'stroke-width': 0.8, 'stroke-dasharray': '5 4' }));
      });
    }
  }

  _drawGridAxes(g, isAnnex, bDepth) {
    const axes = isAnnex ? ANNEX.gridAxes : GRID_AXES;
    axes.x.forEach((ax) => {
      const x = px(ax.pos);
      g.appendChild(el('line', { x1: x, y1: pz(-0.95), x2: x, y2: pz(bDepth + 0.85), stroke: '#b5563c', 'stroke-width': 0.55, 'stroke-dasharray': '12 4 2 4', opacity: 0.72 }));
      g.appendChild(el('circle', { cx: x, cy: pz(-1.15), r: 11, fill: '#fff', stroke: '#b5563c', 'stroke-width': 1 }));
      g.appendChild(el('text', { x, y: pz(-1.15) + 3.5, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#b5563c' }, ax.id));
    });
    axes.z.forEach((az) => {
      const z = pz(az.pos);
      g.appendChild(el('line', { x1: px(-0.95), y1: z, x2: px(5.85), y2: z, stroke: '#b5563c', 'stroke-width': 0.55, 'stroke-dasharray': '12 4 2 4', opacity: 0.72 }));
      g.appendChild(el('circle', { cx: px(-1.15), cy: z, r: 11, fill: '#fff', stroke: '#b5563c', 'stroke-width': 1 }));
      g.appendChild(el('text', { x: px(-1.15), y: z + 3.5, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 700, fill: '#b5563c' }, az.id));
    });
  }

  _drawStairwellSymbol(g, floor, isAnnex) {
    const sb = isAnnex ? ANNEX.stairLocal : HOUSE.stairBox;
    const x1 = px(sb.minX);
    const x2 = px(sb.maxX);
    const yTop = pz(sb.topZ);
    const yBot = pz(sb.bottomZ);
    const w = x2 - x1;
    const h = yBot - yTop;

    const isVoid = floor.isAttic || (isAnnex && floor.physicalFloor === 2);
    g.appendChild(el('rect', {
      x: x1, y: yTop, width: w, height: h,
      fill: isVoid ? 'url(#pat-void)' : (floor.isBasement ? '#d8dce0' : '#f2ebe0'),
      stroke: '#3a342c', 'stroke-width': 1.1,
    }));

    const stepH = h / sb.treads;
    for (let i = 1; i < sb.treads; i++) {
      const sy = yTop + i * stepH;
      g.appendChild(el('line', { x1, y1: sy, x2, y2: sy, stroke: '#6c6256', 'stroke-width': 0.75 }));
    }

    const cx = (x1 + x2) / 2;
    if (floor.stairUp) {
      g.appendChild(el('line', { x1: cx, y1: yBot - 14, x2: cx, y2: yTop + 14, stroke: '#1c1e22', 'stroke-width': 1.4, 'marker-end': 'url(#arr-stair)' }));
      g.appendChild(el('rect', { x: cx - 38, y: yBot - 44, width: 76, height: 15, rx: 3, fill: '#fff', stroke: '#1c1e22', 'stroke-width': 0.7 }));
      g.appendChild(el('text', { x: cx, y: yBot - 33, 'text-anchor': 'middle', 'font-size': 7.8, 'font-weight': 700, fill: '#1c1e22' }, floor.stairUp.label));
    }
    if (floor.stairDown) {
      g.appendChild(el('rect', { x: cx - 34, y: yTop + 14, width: 68, height: 15, rx: 3, fill: '#fff8ec', stroke: '#9c4722', 'stroke-width': 0.7 }));
      g.appendChild(el('text', { x: cx, y: yTop + 25, 'text-anchor': 'middle', 'font-size': 7.8, 'font-weight': 700, fill: '#9c4722' }, floor.stairDown.label));
    }
    if (floor.stairUp && floor.stairDown) {
      g.appendChild(el('line', { x1, y1: yTop + h * 0.44, x2, y2: yTop + h * 0.56, stroke: '#9c4722', 'stroke-width': 1.2 }));
    }
  }

  _drawFurniturePlan(g, floor) {
    const box = (x, z, w, d, label, fill = '#fffdf8') => {
      g.appendChild(el('rect', { x: px(x), y: pz(z), width: w * SCALE, height: d * SCALE, fill, stroke: '#5c5348', 'stroke-width': 0.85, rx: 1.5 }));
      if (label) {
        g.appendChild(el('text', { x: px(x + w / 2), y: pz(z + d / 2) + 2.8, 'text-anchor': 'middle', 'font-size': 7.2, fill: '#3d3832' }, label));
      }
    };

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
      g.appendChild(el('circle', { cx: px(4.52), cy: pz(8.80), r: 13, fill: '#fff2d2', stroke: '#c97f2b', 'stroke-width': 1 }));
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
      g.appendChild(el('rect', { x: px(1.30), y: pz(6.15), width: 240, height: 260, fill: 'url(#pat-tatami)', stroke: '#8c9470', 'stroke-width': 1 }));
      box(2.02, 7.13, 0.96, 0.64, '読書座卓');
      box(0.25, 6.88, 0.54, 1.15, '軒下収納');
      box(4.20, 7.02, 0.52, 1.05, 'チェスト');
      g.appendChild(el('circle', { cx: px(2.50), cy: pz(7.45), r: 15, fill: '#fff1cc', stroke: '#c97f2b', 'stroke-width': 1.2 }));
    } else if (floor.index === 6) {
      // Annex 1F (5×8m)
      box(4.46, 0.42, 0.36, 1.05, '靴ベンチ');
      box(0.47, 0.20, 1.55, 0.68, '作業台');
      box(0.22, 1.56, 0.48, 0.48, '木箱');
      box(3.07, 1.78, 0.95, 0.48, '造作洗面');
      box(3.34, 3.21, 0.42, 0.62, 'WC');
      box(4.21, 4.17, 0.62, 1.95, 'カフェキッチン', '#f5efe6');
      box(2.42, 5.26, 0.86, 1.18, 'ダイニング');
      box(0.20, 5.90, 0.78, 1.56, 'デニムソファ', '#d8e0e8');
      box(1.24, 6.24, 0.48, 0.88, 'ロー卓');
      g.appendChild(el('circle', { cx: px(0.55), cy: pz(7.56), r: 14, fill: '#fff2d2', stroke: '#c97f2b', 'stroke-width': 1.1 }));
    } else {
      // Annex 2F (5×8m)
      box(4.43, 0.57, 0.38, 1.15, '書庫棚');
      box(1.67, 0.19, 1.65, 0.38, '読書ベンチ');
      box(3.27, 3.24, 0.82, 0.82, 'ちゃぶ台');
      box(2.17, 5.36, 1.56, 1.98, 'クイーンベッド', '#f4ece3');
      box(4.29, 5.82, 0.54, 1.65, 'ワードローブ');
    }
  }

  _drawWallsAndColumns(g, floor, isAnnex) {
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
          g.appendChild(el('rect', { x: px(a), y: pz(w.z1), width: (b - a) * SCALE, height: (w.z2 - w.z1) * SCALE, fill, stroke: '#1c1e22', 'stroke-width': 0.9 }));
        } else {
          g.appendChild(el('rect', { x: px(w.x1), y: pz(a), width: (w.x2 - w.x1) * SCALE, height: (b - a) * SCALE, fill, stroke: '#1c1e22', 'stroke-width': 0.9 }));
        }
      };

      for (const op of ops) {
        drawSeg(cur, op.pos);
        cur = op.pos + op.width;
      }
      drawSeg(cur, end);
    }

    const cols = isAnnex ? ANNEX.columns : COLUMNS;
    cols.forEach(([cx, cz]) => {
      if (floor.isBasement && cz < 2.40) return;
      g.appendChild(el('rect', { x: px(cx) - 5.5, y: pz(cz) - 5.5, width: 11, height: 11, fill: '#1c1e22' }));
    });
  }

  _drawOpenings(g, floor) {
    for (const w of floor.walls) {
      const isH = w.axis === 'h';
      const midOrtho = isH ? pz((w.z1 + w.z2) / 2) : px((w.x1 + w.x2) / 2);

      for (const op of w.openings || []) {
        const len = op.width * SCALE;
        if (op.type.startsWith('window')) {
          if (isH) {
            g.appendChild(el('rect', { x: px(op.pos), y: pz(w.z1), width: len, height: (w.z2 - w.z1) * SCALE, fill: '#eef7fc', stroke: '#1d7a8c', 'stroke-width': 1 }));
            g.appendChild(el('line', { x1: px(op.pos), y1: midOrtho, x2: px(op.pos + op.width), y2: midOrtho, stroke: '#1d7a8c', 'stroke-width': 1.2 }));
          } else {
            g.appendChild(el('rect', { x: px(w.x1), y: pz(op.pos), width: (w.x2 - w.x1) * SCALE, height: len, fill: '#eef7fc', stroke: '#1d7a8c', 'stroke-width': 1 }));
            g.appendChild(el('line', { x1: midOrtho, y1: pz(op.pos), x2: midOrtho, y2: pz(op.pos + op.width), stroke: '#1d7a8c', 'stroke-width': 1.2 }));
          }
        } else if (op.type === 'door_swing') {
          const dir = op.swingDir || 1;
          if (isH) {
            const hx = px(op.pos);
            const hy = midOrtho;
            g.appendChild(el('line', { x1: hx, y1: hy, x2: hx, y2: hy + dir * len, stroke: '#9c4722', 'stroke-width': 1.6 }));
            g.appendChild(el('path', { d: `M ${hx + len} ${hy} A ${len} ${len} 0 0 ${dir > 0 ? 1 : 0} ${hx} ${hy + dir * len}`, fill: 'none', stroke: '#9c4722', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));
          } else {
            const hx = midOrtho;
            const hy = pz(op.pos);
            g.appendChild(el('line', { x1: hx, y1: hy, x2: hx + dir * len, y2: hy, stroke: '#9c4722', 'stroke-width': 1.6 }));
            g.appendChild(el('path', { d: `M ${hx} ${hy + len} A ${len} ${len} 0 0 ${dir > 0 ? 0 : 1} ${hx + dir * len} ${hy}`, fill: 'none', stroke: '#9c4722', 'stroke-width': 0.85, 'stroke-dasharray': '3 2' }));
          }
        } else if (op.type === 'door_pocket') {
          if (isH) {
            g.appendChild(el('line', { x1: px(op.pos), y1: midOrtho - 3, x2: px(op.pos + op.width), y2: midOrtho - 3, stroke: '#9c4722', 'stroke-width': 1.8 }));
            g.appendChild(el('line', { x1: px(op.pos) - len * 0.4, y1: midOrtho + 3, x2: px(op.pos + op.width), y2: midOrtho + 3, stroke: '#9c4722', 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }));
          } else {
            g.appendChild(el('line', { x1: midOrtho - 3, y1: pz(op.pos), x2: midOrtho - 3, y2: pz(op.pos + op.width), stroke: '#9c4722', 'stroke-width': 1.8 }));
            g.appendChild(el('line', { x1: midOrtho + 3, y1: pz(op.pos) - len * 0.4, x2: midOrtho + 3, y2: pz(op.pos + op.width), stroke: '#9c4722', 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }));
          }
        }

        const tx = isH ? px(op.pos + op.width / 2) : midOrtho + 14;
        const ty = isH ? midOrtho - 10 : pz(op.pos + op.width / 2) + 3;
        g.appendChild(el('text', { x: tx, y: ty, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: op.type.startsWith('window') ? '#1d7a8c' : '#9c4722' }, op.id));
      }
    }
  }

  _drawLighting(g, floor) {
    (floor.lighting || []).forEach((l) => {
      const cx = px(l.x);
      const cy = pz(l.z);
      g.appendChild(el('circle', { cx, cy, r: 7, fill: '#fff8d6', stroke: '#d97706', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: cx, y: cy + 2.5, 'text-anchor': 'middle', 'font-size': 6.5, 'font-weight': 700, fill: '#b45309' }, l.type));
    });
    (floor.switches || []).forEach((s) => {
      const cx = px(s.x);
      const cy = pz(s.z);
      g.appendChild(el('circle', { cx, cy, r: 3.5, fill: '#d97706' }));
      g.appendChild(el('text', { x: cx + 6, y: cy + 3, 'font-size': 6.8, fill: '#92400e', 'font-weight': 700 }, s.label));
    });
  }

  _drawOutlets(g, floor) {
    (floor.outlets || []).forEach((o) => {
      const cx = px(o.x);
      const cy = pz(o.z);
      g.appendChild(el('circle', { cx, cy, r: 5, fill: '#fff', stroke: '#2563eb', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: cx + 8, y: cy + 3, 'font-size': 7, fill: '#1d4ed8', 'font-weight': 700 }, o.label));
    });
  }

  _drawPlumbing(g, floor) {
    (floor.plumbing || []).forEach((p) => {
      if (p.pts) {
        const d = p.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${px(pt[0])} ${pz(pt[1])}`).join(' ');
        g.appendChild(el('path', { d, fill: 'none', stroke: p.kind === 'water' ? '#0284c7' : '#7c3aed', 'stroke-width': 1.8, 'stroke-dasharray': p.kind === 'drain' ? '5 3' : 'none' }));
      } else {
        g.appendChild(el('rect', { x: px(p.x) - 20, y: pz(p.z) - 7, width: 40, height: 14, rx: 2, fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 0.8 }));
        g.appendChild(el('text', { x: px(p.x), y: pz(p.z) + 3, 'text-anchor': 'middle', 'font-size': 6.5, fill: '#92400e', 'font-weight': 700 }, p.label));
      }
    });
  }

  _drawFlowPaths(g, floor) {
    const colorMap = { entry: ['#c25e28', 'url(#arr-entry)'], work: ['#1d7a8c', 'url(#arr-work)'], priv: ['#6b4fa1', 'url(#arr-priv)'] };
    (floor.flowPaths || []).forEach((fp) => {
      const [stroke, marker] = colorMap[fp.kind] || colorMap.entry;
      const d = fp.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${px(pt[0])} ${pz(pt[1])}`).join(' ');
      g.appendChild(el('path', { d, fill: 'none', stroke, 'stroke-width': 1.9, 'stroke-dasharray': '6 4', 'marker-end': marker, opacity: 0.78 }));
    });
  }

  _drawRoomLabels(g, floor) {
    for (const r of floor.rooms) {
      const [lx, lz] = r.labelPos;
      const cx = px(lx);
      const cy = pz(lz);
      const grp = el('g', { style: 'pointer-events:none' });
      grp.appendChild(el('rect', { x: cx - 58, y: cy - 18, width: 116, height: 34, rx: 3.5, fill: 'rgba(255,255,255,0.88)', stroke: 'rgba(28,30,34,0.22)', 'stroke-width': 0.7 }));
      grp.appendChild(el('text', { x: cx, y: cy - 5, 'text-anchor': 'middle', 'font-size': 8.0, 'font-weight': 700, fill: '#1c1e22' }, `${r.code} ${r.nameJp}`));
      grp.appendChild(el('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 7.2, fill: '#5b5852' }, `${r.area.toFixed(1)}m² (${r.jo.toFixed(1)}帖)`));
      grp.appendChild(el('text', { x: cx, y: cy + 13.5, 'text-anchor': 'middle', 'font-size': 6.5, fill: '#8a5328', 'font-family': 'monospace' }, `${r.fl} / ${r.ch}`));
      g.appendChild(grp);
    }
  }

  _drawDimensions(g, isAnnex, bWidth, bDepth) {
    const dimH = (x1, x2, y, label) => {
      const a = px(x1), b = px(x2);
      g.appendChild(el('line', { x1: a, y1: y, x2: b, y2: y, stroke: '#2c2f36', 'stroke-width': 0.85 }));
      g.appendChild(el('line', { x1: a, y1: y - 5, x2: a, y2: y + 5, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('line', { x1: b, y1: y - 5, x2: b, y2: y + 5, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('text', { x: (a + b) / 2, y: y - 4, 'text-anchor': 'middle', 'font-size': 8.5, 'font-family': 'monospace', fill: '#1c1e22' }, label));
    };
    const dimV = (z1, z2, x, label) => {
      const a = pz(z1), b = pz(z2);
      g.appendChild(el('line', { x1: x, y1: a, x2: x, y2: b, stroke: '#2c2f36', 'stroke-width': 0.85 }));
      g.appendChild(el('line', { x1: x - 5, y1: a, x2: x + 5, y2: a, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      g.appendChild(el('line', { x1: x - 5, y1: b, x2: x + 5, y2: b, stroke: '#2c2f36', 'stroke-width': 0.9 }));
      const txt = el('text', { x: x - 6, y: (a + b) / 2, 'text-anchor': 'middle', 'font-size': 8.5, 'font-family': 'monospace', fill: '#1c1e22', transform: `rotate(-90 ${x - 6} ${(a + b) / 2})` }, label);
      g.appendChild(txt);
    };

    const axes = isAnnex ? ANNEX.gridAxes : GRID_AXES;
    dimH(0, bWidth, pz(-1.55), Math.round(bWidth * 1000).toLocaleString());
    const xs = axes.x;
    for (let i = 0; i < xs.length - 1; i++) {
      dimH(xs[i].pos, xs[i + 1].pos, pz(-0.78), `${Math.round((xs[i + 1].pos - xs[i].pos) * 1000)}`);
    }

    dimV(0, bDepth, px(-1.52), Math.round(bDepth * 1000).toLocaleString());
    const zs = axes.z;
    for (let i = 0; i < zs.length - 1; i++) {
      dimV(zs[i].pos, zs[i + 1].pos, px(-0.78), `${Math.round((zs[i + 1].pos - zs[i].pos) * 1000)}`);
    }
  }

  _drawCameraMarker(g, isAnnex) {
    const sx = isAnnex ? 2.50 : 1.62;
    const sz = isAnnex ? 5.80 : 6.25;
    this.camGroup = el('g', { id: 'cam-marker' });
    this.camCone = el('g', { transform: `translate(${px(sx)}, ${pz(sz)}) rotate(90)` });
    this.camCone.appendChild(el('path', { d: 'M 0 0 L 42 -20 A 46 46 0 0 1 42 20 Z', fill: 'rgba(217, 70, 38, 0.24)', stroke: '#d94626', 'stroke-width': 0.9 }));
    this.camDot = el('circle', { cx: px(sx), cy: pz(sz), r: 6, fill: '#d94626', stroke: '#fff', 'stroke-width': 2 });
    this.camGroup.appendChild(this.camCone);
    this.camGroup.appendChild(this.camDot);
    g.appendChild(this.camGroup);
  }

  /**
   * Twin-House Site Cross-Section Elevation Diagram (Neighboring 5×8m 2F Annex + 2.6m Courtyard + 6-Level Main Tower) + JIS Title Block
   */
  _drawTitleBlockAndSection(svg, floor, VW, VH) {
    const baseTop = VH - 215;
    const g = el('g');

    const secX = 32;
    const secY = baseTop;
    const secW = 320;
    const secH = 185;
    g.appendChild(el('rect', { x: secX, y: secY, width: secW, height: secH, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1 }));
    g.appendChild(el('text', { x: secX + 10, y: secY + 15, 'font-size': 8.8, 'font-weight': 700, fill: '#1c1e22' }, '2棟配置 断面略図（隣棟2階建 ＋ 2.6m中庭 ＋ 母屋6層）'));

    const sx = (m) => secX + 112 + m * 11.2;
    const sy = (m) => secY + 148 - m * 8.6;

    // Ground line GL
    g.appendChild(el('line', { x1: secX + 12, y1: sy(0), x2: secX + 308, y2: sy(0), stroke: '#5a6354', 'stroke-width': 1.4 }));
    g.appendChild(el('text', { x: secX + 14, y: sy(0) - 3, 'font-size': 7, fill: '#5a6354' }, 'GL'));

    // Left: Neighboring 5m×8m 2-Story Annex (X = -7.6 .. -2.6, Shed Roof 5.45 -> 6.35m)
    const a1Active = floor.index === 6;
    const a2Active = floor.index === 7;
    g.appendChild(el('rect', {
      x: sx(-7.6), y: sy(2.75), width: 5.0 * 11.2, height: sy(0) - sy(2.75),
      fill: a1Active ? 'rgba(217, 70, 38, 0.22)' : '#f5f2eb',
      stroke: '#2c2f36', 'stroke-width': a1Active ? 1.5 : 0.85,
    }));
    const a2Pts = `${sx(-7.6)},${sy(2.75)} ${sx(-7.6)},${sy(5.45)} ${sx(-2.6)},${sy(6.35)} ${sx(-2.6)},${sy(2.75)}`;
    g.appendChild(el('polygon', {
      points: a2Pts,
      fill: a2Active ? 'rgba(217, 70, 38, 0.22)' : '#f5f2eb',
      stroke: '#2c2f36', 'stroke-width': a2Active ? 1.5 : 0.85,
    }));
    g.appendChild(el('line', { x1: sx(-8.05), y1: sy(5.37), x2: sx(-2.15), y2: sy(6.43), stroke: '#1c1e22', 'stroke-width': 1.8 }));
    g.appendChild(el('text', { x: sx(-5.1), y: sy(1.3), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': a1Active ? 700 : 500, fill: a1Active ? '#b9381c' : '#444' }, '隣棟1F'));
    g.appendChild(el('text', { x: sx(-5.1), y: sy(4.1), 'text-anchor': 'middle', 'font-size': 6.6, 'font-weight': a2Active ? 700 : 500, fill: a2Active ? '#b9381c' : '#444' }, '隣棟2F'));
    g.appendChild(el('text', { x: sx(-5.1), y: sy(-1.4), 'text-anchor': 'middle', 'font-size': 6.8, 'font-weight': 700, fill: '#3d523a' }, '隣棟 5×8m (2F)'));
    g.appendChild(el('text', { x: sx(-1.3), y: sy(0.8), 'text-anchor': 'middle', 'font-size': 6.2, fill: '#5b6b59' }, '2.6m中庭'));

    // Right: Main Tower 6-Level Stack (X = 0 .. 5.0)
    const bands = [
      { idx: 0, y0: -2.40, y1: 0.00, label: 'B1F (CH2020 セメント地下)' },
      { idx: 1, y0: 0.00, y1: 2.75, label: '1F (1FL±0)' },
      { idx: 2, y0: 2.75, y1: 5.50, label: '2F (+2750)' },
      { idx: 3, y0: 5.50, y1: 8.15, label: '3F (+5500)' },
      { idx: 4, y0: 8.15, y1: 10.50, label: '4F (CH2150 5室+バルコニー)' },
      { idx: 5, y0: 10.50, y1: 13.33, label: '屋根裏 (+10500〜棟13330)' },
    ];
    bands.forEach((b) => {
      const active = b.idx === floor.index;
      if (b.idx < 5) {
        g.appendChild(el('rect', {
          x: sx(0), y: sy(b.y1), width: 5.0 * 11.2, height: sy(b.y0) - sy(b.y1),
          fill: active ? 'rgba(217, 70, 38, 0.22)' : (b.idx === 0 ? '#dcdde0' : '#f8f5ef'),
          stroke: '#2c2f36', 'stroke-width': active ? 1.5 : 0.8,
        }));
        if (b.idx === 4) {
          g.appendChild(el('rect', { x: sx(5.0), y: sy(9.25), width: 9, height: sy(8.15) - sy(9.25), fill: 'rgba(180,210,235,0.35)', stroke: '#1c1e22', 'stroke-width': 0.9 }));
        }
      } else {
        const pts = `${sx(0)},${sy(10.50)} ${sx(0)},${sy(11.92)} ${sx(2.5)},${sy(13.33)} ${sx(5)},${sy(11.92)} ${sx(5)},${sy(10.50)}`;
        g.appendChild(el('polygon', {
          points: pts,
          fill: active ? 'rgba(217, 70, 38, 0.22)' : '#f8f5ef',
          stroke: '#2c2f36', 'stroke-width': active ? 1.5 : 0.9,
        }));
        g.appendChild(el('polyline', {
          points: `${sx(-0.5)},${sy(11.62)} ${sx(2.5)},${sy(13.43)} ${sx(5.5)},${sy(11.62)}`,
          fill: 'none', stroke: '#1c1e22', 'stroke-width': 1.8,
        }));
      }
      const midY = (sy(b.y0) + sy(Math.min(b.y1, 12.6))) / 2;
      g.appendChild(el('text', {
        x: sx(6.10), y: midY + 2.5, 'font-size': 6.7,
        'font-weight': active ? 700 : 500,
        fill: active ? '#b9381c' : '#4a4640',
      }, b.label));
    });

    const tbX = 362;
    const tbW = VW - tbX - 32;
    g.appendChild(el('rect', { x: tbX, y: baseTop, width: tbW, height: secH, fill: '#fff', stroke: '#2c2f36', 'stroke-width': 1 }));
    g.appendChild(el('line', { x1: tbX, y1: baseTop + 34, x2: tbX + tbW, y2: baseTop + 34, stroke: '#2c2f36', 'stroke-width': 0.8 }));
    g.appendChild(el('line', { x1: tbX, y1: baseTop + 86, x2: tbX + tbW, y2: baseTop + 86, stroke: '#2c2f36', 'stroke-width': 0.8 }));
    g.appendChild(el('line', { x1: tbX, y1: baseTop + 134, x2: tbX + tbW, y2: baseTop + 134, stroke: '#2c2f36', 'stroke-width': 0.8 }));

    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 22, 'font-size': 10.0, 'font-weight': 700, fill: '#1c1e22' }, 'PROJECT : NARROW-50 TOWER ＋ 隣棟 ANNEX-40 (5×8m 2階建)'));
    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 54, 'font-size': 9.6, 'font-weight': 700, fill: '#9c4722' }, `図面名称 : ${floor.titleJp} [${floor.code}]`));
    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 72, 'font-size': 8.2, fill: '#5b5852' }, '配置計画 : 母屋(5×10m 地下1F＋地上4F＋屋根裏) 西2.6m中庭越しに隣棟(5×8m 2階建)'));
    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 104, 'font-size': 8.1, fill: '#1c1e22' }, '母屋延床 : B1F 31.9m² + 1〜4F 200m² + バルコニー 2m² + 屋根裏 28.5m²'));
    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 122, 'font-size': 8.1, fill: '#3d523a' }, '隣棟延床 : 1F 40.00m² + 2F 40.00m² = 計 80.00m² (24.20坪 / 片流れ屋根)'));
    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 154, 'font-size': 8.1, fill: '#1c1e22' }, '縮尺 : S = 1/50 (断面略図 1/160) ｜ 単位 : mm ｜ 赤点 = リアルタイム一人称位置'));
    g.appendChild(el('text', { x: tbX + 12, y: baseTop + 172, 'font-size': 7.8, fill: '#6c665d' }, '母屋玄関(D1-1)→石灯籠中庭→隣棟玄関(DA-1)→STA1階段→隣棟2Fまで完全徒歩直結'));

    svg.appendChild(g);
  }
}
