import {
  HOUSE, GRID_AXES, COLUMNS, ROOMS, WALLS,
  LIGHTING, SWITCHES, OUTLETS, PLUMBING, FLOW_PATHS,
} from './planData.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 100; // 1 meter = 100 SVG units
const PAD_L = 175;
const PAD_R = 165;
const PAD_T = 235;
const PAD_B = 260;

const VW = PAD_L + HOUSE.width * SCALE + PAD_R;  // 840
const VH = PAD_T + HOUSE.depth * SCALE + PAD_B;  // 1495

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
    this.selectedRoomId = null;
    this._buildSVG();
  }

  _buildSVG() {
    this.container.innerHTML = '';
    const svg = el('svg', {
      viewBox: `0 0 ${VW} ${VH}`,
      class: 'blueprint-svg',
      preserveAspectRatio: 'xMidYMid meet',
    });
    this.svg = svg;

    // Defs: Architectural hatching patterns & arrow markers
    const defs = el('defs');

    // Exterior wall diagonal insulation hatch
    const patExt = el('pattern', { id: 'hatch-ext', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    patExt.appendChild(el('rect', { width: 8, height: 8, fill: '#2a2d33' }));
    patExt.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#505660', 'stroke-width': 2 }));
    defs.appendChild(patExt);

    // Interior wall subtle hatch
    const patInt = el('pattern', { id: 'hatch-int', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    patInt.appendChild(el('rect', { width: 6, height: 6, fill: '#474c54' }));
    patInt.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#6c727d', 'stroke-width': 1.2 }));
    defs.appendChild(patInt);

    // Tatami weave pattern
    const patTatami = el('pattern', { id: 'pat-tatami', width: 8, height: 4, patternUnits: 'userSpaceOnUse' });
    patTatami.appendChild(el('rect', { width: 8, height: 4, fill: '#dde6c8' }));
    patTatami.appendChild(el('line', { x1: 0, y1: 2, x2: 8, y2: 2, stroke: '#c0cca4', 'stroke-width': 0.8 }));
    defs.appendChild(patTatami);

    // Wood deck plank pattern
    const patDeck = el('pattern', { id: 'pat-deck', width: 100, height: 14, patternUnits: 'userSpaceOnUse' });
    patDeck.appendChild(el('rect', { width: 100, height: 14, fill: '#ead8c0' }));
    patDeck.appendChild(el('line', { x1: 0, y1: 14, x2: 100, y2: 14, stroke: '#c7a982', 'stroke-width': 1 }));
    defs.appendChild(patDeck);

    // Tile grid pattern (Kitchen / Wet rooms)
    const patTile = el('pattern', { id: 'pat-tile', width: 16, height: 16, patternUnits: 'userSpaceOnUse' });
    patTile.appendChild(el('rect', { width: 16, height: 16, fill: 'none', stroke: '#cbd2d6', 'stroke-width': 0.6 }));
    defs.appendChild(patTile);

    // Arrowhead markers for flow lines
    [
      ['arr-entry', '#c25e28'],
      ['arr-work', '#1d7a8c'],
      ['arr-priv', '#6b4fa1'],
      ['arr-exhaust', '#d97706'],
    ].forEach(([id, color]) => {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
      m.appendChild(el('path', { d: 'M 0 1 L 10 5 L 0 9 z', fill: color }));
      defs.appendChild(m);
    });

    svg.appendChild(defs);

    // Drafting paper background & subtle border frame
    svg.appendChild(el('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#faf7f1' }));
    svg.appendChild(el('rect', { x: 14, y: 14, width: VW - 28, height: VH - 28, fill: 'none', stroke: '#2c2f36', 'stroke-width': 1.4 }));
    svg.appendChild(el('rect', { x: 18, y: 18, width: VW - 36, height: VH - 36, fill: 'none', stroke: '#9b968d', 'stroke-width': 0.5 }));

    // Title Header inside drawing sheet
    this._drawSheetHeader(svg);

    // Layer Groups
    const names = ['exterior', 'materials', 'grid', 'furniture', 'walls', 'openings', 'plumbing', 'outlets', 'lighting', 'flow', 'labels', 'dimensions', 'camera'];
    names.forEach((n) => {
      const g = el('g', { id: `layer-${n}` });
      svg.appendChild(g);
      this.layerGroups[n] = g;
    });

    this._drawExteriorContext(this.layerGroups.exterior);
    this._drawRoomFloors(this.layerGroups.materials);
    this._drawGridAxes(this.layerGroups.grid);
    this._drawFurniturePlan(this.layerGroups.furniture);
    this._drawWallsAndColumns(this.layerGroups.walls);
    this._drawOpenings(this.layerGroups.openings);
    this._drawPlumbing(this.layerGroups.plumbing);
    this._drawOutlets(this.layerGroups.outlets);
    this._drawLighting(this.layerGroups.lighting);
    this._drawFlowPaths(this.layerGroups.flow);
    this._drawRoomLabels(this.layerGroups.labels);
    this._drawDimensions(this.layerGroups.dimensions);
    this._drawCameraMarker(this.layerGroups.camera);
    this._drawTitleBlockAndLegend(svg);

    // Click anywhere inside the house plan to teleport 3D camera!
    svg.addEventListener('click', (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const loc = pt.matrixTransform(ctm.inverse());
      const wx = (loc.x - PAD_L) / SCALE;
      const wz = (loc.y - PAD_T) / SCALE;
      if (wx >= -0.2 && wx <= HOUSE.width + 0.2 && wz >= -0.2 && wz <= HOUSE.depth + 0.2) {
        if (this.callbacks.onPlanClick) {
          this.callbacks.onPlanClick(
            Math.max(0.25, Math.min(4.75, wx)),
            Math.max(0.25, Math.min(9.75, wz)),
          );
        }
      }
    });

    this.container.appendChild(svg);
    this.syncLayerVisibility();
  }

  _drawSheetHeader(svg) {
    const g = el('g');
    g.appendChild(el('text', { x: 32, y: 46, 'font-size': 15, 'font-weight': 700, fill: '#1c1e22', 'letter-spacing': 0.8 }, '実施設計 平面詳細図 (1/50)  —  5,000 × 10,000 mm 1LDK'));
    g.appendChild(el('text', { x: 32, y: 64, 'font-size': 10, fill: '#5b5852' }, 'NARROW-50 「光と格子の家」  |  延床面積 50.00 m² (15.13坪)  |  室内有効 43.82 m²  |  収納率 11.6%'));

    // North Compass Rose (北方位記号) top-right
    const cx = VW - 66, cy = 54;
    g.appendChild(el('circle', { cx, cy, r: 22, fill: '#faf7f1', stroke: '#2c2f36', 'stroke-width': 1.1 }));
    g.appendChild(el('polygon', { points: `${cx},${cy - 18} ${cx - 6},${cy + 4} ${cx},${cy - 2}`, fill: '#b83c2a' }));
    g.appendChild(el('polygon', { points: `${cx},${cy - 18} ${cx + 6},${cy + 4} ${cx},${cy - 2}`, fill: '#2c2f36' }));
    g.appendChild(el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700, fill: '#1c1e22' }, 'N (北)'));

    // Sun Direction Indicator on South bottom
    g.appendChild(el('text', { x: px(2.5), y: pz(10.0) + 166, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: '#b4621e' }, '☀ 南側採光面 (SOUTH — 掃き出し窓 W2500 + 縁側ウッドデッキ)'));
    svg.appendChild(g);
  }

  _drawExteriorContext(g) {
    // North Approach Brick Pavers (Z = -1.05..0.0, X = 0.05..2.05)
    g.appendChild(el('rect', {
      x: px(0.05), y: pz(-0.85), width: 2.0 * SCALE, height: 0.85 * SCALE,
      fill: '#eadfd5', stroke: '#9f8776', 'stroke-width': 0.9, 'stroke-dasharray': '4 2',
    }));
    g.appendChild(el('text', { x: px(1.05), y: pz(-0.56), 'text-anchor': 'middle', 'font-size': 9, fill: '#755c4b' }, '玄関ポーチ (インターロッキング敷)'));
    // Doormat
    g.appendChild(el('rect', {
      x: px(0.56), y: pz(-0.48), width: 0.78 * SCALE, height: 0.38 * SCALE,
      fill: '#c99c62', stroke: '#5d4222', 'stroke-width': 0.9, rx: 2,
    }));
    // AC Outdoor Compressor (NE)
    g.appendChild(el('rect', {
      x: px(4.14), y: pz(-0.36), width: 0.72 * SCALE, height: 0.28 * SCALE,
      fill: '#e2e6ea', stroke: '#4d5560', 'stroke-width': 0.9,
    }));
    g.appendChild(el('text', { x: px(4.50), y: pz(-0.19), 'text-anchor': 'middle', 'font-size': 7.5, fill: '#333' }, 'AC室外機'));

    // South Wood Engawa Deck (Z = 10.0..11.05, X = 0.0..5.0)
    g.appendChild(el('rect', {
      x: px(0), y: pz(10.0), width: 5.0 * SCALE, height: 0.95 * SCALE,
      fill: 'url(#pat-deck)', stroke: '#8c6943', 'stroke-width': 1.1,
    }));
    g.appendChild(el('text', { x: px(2.5), y: pz(10.55), 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 600, fill: '#6e4e2c' }, '南側 縁側ウッドデッキ (W5,000 × D1,150 / ウォルナット材)'));
    // Green wall badge SW & Lattice screen SE
    g.appendChild(el('rect', { x: px(0.02), y: pz(10.02), width: 12, height: 90, fill: '#4f8a4b', stroke: '#2c5429', 'stroke-width': 0.8 }));
    g.appendChild(el('text', { x: px(-0.08), y: pz(10.50), 'text-anchor': 'end', 'font-size': 8, fill: '#2c5429', 'font-weight': 600 }, '壁面緑化'));
    g.appendChild(el('rect', { x: px(4.92), y: pz(10.02), width: 8, height: 90, fill: '#63432b', stroke: '#3a2617', 'stroke-width': 0.8 }));
    g.appendChild(el('text', { x: px(5.08), y: pz(10.50), 'text-anchor': 'start', 'font-size': 8, fill: '#5d412d', 'font-weight': 600 }, '目隠し格子'));
  }

  _drawRoomFloors(g) {
    ROOMS.forEach((r) => {
      const rect = el('rect', {
        x: px(r.x), y: pz(r.z), width: r.w * SCALE, height: r.d * SCALE,
        fill: r.id === 'tatami_nook' ? 'url(#pat-tatami)' : r.tint,
        'fill-opacity': 0.92,
        class: 'room-zone',
        'data-room': r.id,
      });
      rect.addEventListener('mouseenter', () => {
        if (this.callbacks.onRoomHover) this.callbacks.onRoomHover(r);
      });
      rect.addEventListener('mouseleave', () => {
        if (this.callbacks.onRoomHover) this.callbacks.onRoomHover(null);
      });
      g.appendChild(rect);

      // Add subtle tile grid overlay for tiled rooms
      if (['genkan', 'wc', 'washroom', 'bath'].includes(r.id)) {
        g.appendChild(el('rect', {
          x: px(r.x), y: pz(r.z), width: r.w * SCALE, height: r.d * SCALE,
          fill: 'url(#pat-tile)', 'pointer-events': 'none',
        }));
      }
    });

    // Kitchen easy-clean tile zone inside LDK
    g.appendChild(el('rect', {
      x: px(3.60), y: pz(5.35), width: 1.25 * SCALE, height: 3.03 * SCALE,
      fill: '#f1e8d6', 'pointer-events': 'none',
    }));
    g.appendChild(el('rect', {
      x: px(3.60), y: pz(5.35), width: 1.25 * SCALE, height: 3.03 * SCALE,
      fill: 'url(#pat-tile)', stroke: '#b8945e', 'stroke-width': 0.9, 'stroke-dasharray': '3 2', 'pointer-events': 'none',
    }));

    // Tatami Nook woven green border & step edge
    g.appendChild(el('rect', {
      x: px(3.55), y: pz(8.55), width: 1.30 * SCALE, height: 1.30 * SCALE,
      fill: 'none', stroke: '#4c6d37', 'stroke-width': 3.5, 'pointer-events': 'none',
    }));
    // Genkan Agari-kamachi step line
    g.appendChild(el('line', {
      x1: px(0.15), y1: pz(1.45), x2: px(1.55), y2: pz(1.45),
      stroke: '#8a5d32', 'stroke-width': 2.6,
    }));
    g.appendChild(el('text', { x: px(0.85), y: pz(1.42), 'text-anchor': 'middle', 'font-size': 7.5, fill: '#7a4d22', 'font-weight': 600 }, '▲ 上がり框 (+120)'));

    // Living & Bedroom Area Rugs (dashed fabric outline)
    g.appendChild(el('rect', {
      x: px(0.95), y: pz(7.45), width: 1.85 * SCALE, height: 2.05 * SCALE,
      fill: '#e6d6c3', 'fill-opacity': 0.5, stroke: '#9f8b76', 'stroke-width': 0.8, 'stroke-dasharray': '4 3', 'pointer-events': 'none',
    }));
    g.appendChild(el('rect', {
      x: px(2.68), y: pz(0.40), width: 1.95 * SCALE, height: 2.10 * SCALE,
      fill: '#e6d6c3', 'fill-opacity': 0.45, stroke: '#9f8b76', 'stroke-width': 0.8, 'stroke-dasharray': '4 3', 'pointer-events': 'none',
    }));
  }

  _drawGridAxes(g) {
    // Vertical axes X1..X6
    GRID_AXES.x.forEach((ax) => {
      const x = px(ax.pos);
      g.appendChild(el('line', {
        x1: x, y1: PAD_T - 138, x2: x, y2: pz(HOUSE.depth) + 138,
        stroke: '#c97b63', 'stroke-width': 0.55, 'stroke-dasharray': '12 4 2 4', opacity: 0.65,
      }));
      // Top bubble
      g.appendChild(el('circle', { cx: x, cy: PAD_T - 150, r: 12, fill: '#faf7f1', stroke: '#b85038', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x, y: PAD_T - 146.5, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700, fill: '#b85038' }, ax.id));
    });

    // Horizontal axes Y1..Y6
    GRID_AXES.z.forEach((az) => {
      const y = pz(az.pos);
      g.appendChild(el('line', {
        x1: PAD_L - 108, y1: y, x2: px(HOUSE.width) + 102, y2: y,
        stroke: '#c97b63', 'stroke-width': 0.55, 'stroke-dasharray': '12 4 2 4', opacity: 0.65,
      }));
      // Left bubble
      g.appendChild(el('circle', { cx: PAD_L - 122, cy: y, r: 12, fill: '#faf7f1', stroke: '#b85038', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: PAD_L - 122, y: y + 3.5, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700, fill: '#b85038' }, az.id));
    });
  }

  _drawFurniturePlan(g) {
    const fStroke = '#4f4a44';
    const fFill = '#ffffff';
    const woodFill = '#ebd6bc';

    const box = (x, z, w, d, fill = fFill, stroke = fStroke, sw = 1.0, rx = 0) =>
      g.appendChild(el('rect', { x: px(x), y: pz(z), width: w * SCALE, height: d * SCALE, fill, stroke, 'stroke-width': sw, rx }));

    const txt = (x, z, label, sz = 7.5, color = '#4d4740') =>
      g.appendChild(el('text', { x: px(x), y: pz(z), 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': sz, fill: color, 'font-weight': 600 }, label));

    // --- Genkan Shoe Box & Entry Coat Closet ---
    box(0.15, 0.22, 0.35, 1.18, woodFill);
    g.appendChild(el('line', { x1: px(0.15), y1: pz(0.22), x2: px(0.50), y2: pz(1.40), stroke: '#9b7b56', 'stroke-width': 0.6 }));
    g.appendChild(el('line', { x1: px(0.50), y1: pz(0.22), x2: px(0.15), y2: pz(1.40), stroke: '#9b7b56', 'stroke-width': 0.6 }));
    txt(0.32, 0.81, 'SB', 8, '#664a2a');

    box(0.15, 1.62, 0.45, 1.10, woodFill);
    g.appendChild(el('line', { x1: px(0.37), y1: pz(1.66), x2: px(0.37), y2: pz(2.68), stroke: '#8f6c47', 'stroke-width': 1, 'stroke-dasharray': '4 2' }));
    txt(0.37, 2.17, 'CL', 8.5, '#664a2a');

    // --- Master Bedroom: Double Bed, Nightstands, Wardrobe, Chest ---
    box(2.78, 0.72, 2.05, 1.45, '#fffdf9', fStroke, 1.2, 3);
    // Headboard strip
    box(4.73, 0.72, 0.10, 1.45, '#b6b0a6', fStroke, 0.9);
    // Pillows
    box(4.36, 0.86, 0.32, 0.52, '#f2eee7', '#7b746a', 0.8, 4);
    box(4.36, 1.52, 0.32, 0.52, '#f2eee7', '#7b746a', 0.8, 4);
    // Folded duvet line
    g.appendChild(el('line', { x1: px(4.12), y1: pz(0.72), x2: px(4.12), y2: pz(2.17), stroke: '#8c7e70', 'stroke-width': 1.1 }));
    g.appendChild(el('line', { x1: px(4.24), y1: pz(0.72), x2: px(4.24), y2: pz(2.17), stroke: '#b5a899', 'stroke-width': 0.7, 'stroke-dasharray': '3 2' }));
    txt(3.46, 1.45, 'W-BED 1450×2050', 8, '#5a5248');

    // Nightstands
    box(4.38, 0.25, 0.42, 0.40, woodFill);
    box(4.38, 2.23, 0.42, 0.40, woodFill);

    // Built-in Wardrobe (3-door closet)
    box(2.75, 2.80, 2.05, 0.65, woodFill, fStroke, 1.1);
    g.appendChild(el('line', { x1: px(2.80), y1: pz(3.12), x2: px(4.75), y2: pz(3.12), stroke: '#8f6c47', 'stroke-width': 1.0, 'stroke-dasharray': '5 3' }));
    [3.43, 4.12].forEach((cx) => g.appendChild(el('line', { x1: px(cx), y1: pz(2.80), x2: px(cx), y2: pz(2.87), stroke: fStroke, 'stroke-width': 1 })));
    txt(3.78, 3.12, 'クローゼット W2050', 8, '#5f4326');

    // Chest
    box(1.67, 0.48, 0.45, 0.90, woodFill);
    txt(1.89, 0.93, 'チェスト', 7, '#5f4326');

    // --- WC: Tankless Toilet + Corner Handwash ---
    box(1.41, 3.58, 0.38, 0.24, '#ffffff', fStroke, 1, 2);
    g.appendChild(el('ellipse', { cx: px(1.60), cy: pz(4.00), rx: 18, ry: 23, fill: '#ffffff', stroke: fStroke, 'stroke-width': 1.1 }));
    g.appendChild(el('ellipse', { cx: px(1.60), cy: pz(4.02), rx: 12, ry: 15, fill: 'none', stroke: '#8e969e', 'stroke-width': 0.7 }));
    // Handwash basin
    box(1.78, 4.30, 0.21, 0.44, '#ffffff', fStroke, 0.9, 2);
    g.appendChild(el('ellipse', { cx: px(1.88), cy: pz(4.52), rx: 7, ry: 12, fill: '#e6f2f5', stroke: '#5a7a85', 'stroke-width': 0.7 }));

    // --- Pantry Niche ---
    box(1.22, 4.97, 0.76, 0.36, woodFill, fStroke, 0.9);
    txt(1.60, 5.15, 'パントリー', 7, '#5f4326');

    // --- Washroom: Vanity + Drum Washer ---
    box(2.12, 3.57, 0.70, 0.52, '#ffffff', fStroke, 1.1);
    g.appendChild(el('rect', { x: px(2.22), y: pz(3.67), width: 50, height: 32, rx: 6, fill: '#e8f4f8', stroke: '#597b8a', 'stroke-width': 0.9 }));
    txt(2.47, 3.83, '洗面台', 7.5, '#3b5866');

    box(2.84, 3.57, 0.60, 0.62, '#f8fafb', fStroke, 1.1);
    g.appendChild(el('circle', { cx: px(3.14), cy: pz(3.88), r: 21, fill: '#e9eff2', stroke: '#596873', 'stroke-width': 1.0 }));
    txt(3.14, 3.88, '洗濯機', 7, '#3b4a54');

    // --- Unit Bath (1317): Bathtub + Washing Area + Drain ---
    box(3.57, 3.57, 1.26, 0.76, '#ffffff', fStroke, 1.2, 4);
    g.appendChild(el('rect', { x: px(3.65), y: pz(3.65), width: 110, height: 60, rx: 14, fill: '#d6eef7', stroke: '#4d8299', 'stroke-width': 1.0 }));
    txt(4.20, 3.95, '浴槽 1260×750', 7.5, '#2b5e73');
    // Floor drain cross
    g.appendChild(el('circle', { cx: px(4.20), cy: pz(4.82), r: 7, fill: 'none', stroke: '#5c6b73', 'stroke-width': 0.8 }));
    g.appendChild(el('line', { x1: px(4.15), y1: pz(4.82), x2: px(4.25), y2: pz(4.82), stroke: '#5c6b73', 'stroke-width': 0.7 }));
    g.appendChild(el('line', { x1: px(4.20), y1: pz(4.77), x2: px(4.20), y2: pz(4.87), stroke: '#5c6b73', 'stroke-width': 0.7 }));
    // Bath stool
    box(4.38, 4.62, 0.30, 0.24, woodFill, '#7a5d3b', 0.8, 3);

    // --- LDK Kitchen (East Wall): Fridge + System Kitchen W2200 ---
    box(4.20, 5.38, 0.63, 0.63, '#e5eaee', fStroke, 1.2, 2);
    txt(4.51, 5.69, '冷蔵庫', 8, '#36414a');

    box(4.20, 6.08, 0.64, 2.20, '#ffffff', fStroke, 1.2);
    // Sink basin (Z = 6.24..6.86)
    g.appendChild(el('rect', { x: px(4.28), y: pz(6.24), width: 46, height: 62, rx: 5, fill: '#e5f0f4', stroke: '#537280', 'stroke-width': 1.0 }));
    g.appendChild(el('circle', { cx: px(4.51), cy: pz(6.55), r: 4, fill: '#537280' }));
    txt(4.51, 6.40, 'シンク', 6.8, '#2d4c59');
    // 3-Burner IH Cooktop (Z = 7.62..8.18)
    box(4.28, 7.62, 0.48, 0.56, '#2b3038', '#14171a', 0.9, 2);
    [[4.42, 7.76], [4.42, 8.04], [4.62, 7.90]].forEach(([bx, bz]) => {
      g.appendChild(el('circle', { cx: px(bx), cy: pz(bz), r: 8, fill: 'none', stroke: '#f0b67f', 'stroke-width': 1.0 }));
    });
    // Overhead range hood dashed outline
    g.appendChild(el('rect', { x: px(4.22), y: pz(7.53), width: 62, height: 74, fill: 'none', stroke: '#9b7752', 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }));
    txt(4.51, 7.22, '調理台', 6.8, '#666');

    // --- LDK Dining Table + 4 Chairs ---
    box(1.85, 6.28, 1.35, 0.80, woodFill, fStroke, 1.2, 3);
    txt(2.52, 6.68, 'ダイニング 1350×800', 8, '#593f22');
    // 4 chairs
    [[2.03, 5.90], [2.61, 5.90], [2.03, 7.06], [2.61, 7.06]].forEach(([cx, cz]) => {
      box(cx, cz, 0.42, 0.38, '#f0ece5', fStroke, 0.9, 4);
    });

    // --- LDK Living: Lattice Screen, Bookshelf, TV Board, Coffee Table, 3P Sofa ---
    // Vertical Lattice Screen
    for (let i = 0; i < 8; i++) {
      box(1.13, 5.38 + i * 0.085, 0.045, 0.032, '#5d412d', '#362417', 0.7);
    }
    // Bookshelf
    box(0.16, 6.32, 0.34, 0.88, woodFill);
    txt(0.33, 6.76, '本棚', 7.5, '#593f22');
    // TV Board & 55" TV
    box(0.16, 7.55, 0.40, 1.80, woodFill, fStroke, 1.1);
    box(0.27, 7.83, 0.06, 1.24, '#24272c', '#111', 1.0);
    txt(0.45, 8.45, '55"TV', 7.2, '#222');
    // Coffee Table
    box(1.22, 7.95, 0.55, 1.00, woodFill, fStroke, 1.0, 3);
    txt(1.50, 8.45, 'LT', 8, '#593f22');
    // 3-Seater Sofa
    box(2.28, 7.62, 0.84, 1.75, '#e8e5e0', fStroke, 1.2, 4);
    box(2.94, 7.62, 0.18, 1.75, '#d5d0c8', fStroke, 0.9, 2); // backrest
    box(2.28, 7.62, 0.84, 0.14, '#d5d0c8', fStroke, 0.9); // north arm
    box(2.28, 9.23, 0.84, 0.14, '#d5d0c8', fStroke, 0.9); // south arm
    [8.20, 8.78].forEach((cz) => g.appendChild(el('line', { x1: px(2.28), y1: pz(cz), x2: px(2.94), y2: pz(cz), stroke: '#9b958c', 'stroke-width': 0.8 })));
    txt(2.62, 8.50, '3Pソファ', 8, '#444');

    // --- Tatami Nook Chabudai, Zabuton, Lantern & Plant ---
    g.appendChild(el('circle', { cx: px(3.98), cy: pz(9.28), r: 26, fill: '#d4b48c', stroke: '#63432b', 'stroke-width': 1.1 }));
    txt(3.98, 9.28, 'ちゃぶ台', 6.8, '#4a311c');
    box(4.22, 8.77, 0.48, 0.48, '#a64444', '#692424', 0.9, 4);
    g.appendChild(el('rect', { x: px(4.52), y: pz(9.50), width: 20, height: 20, fill: '#ffe7b3', stroke: '#9e6c24', 'stroke-width': 0.9 }));
    // Living Potted Ficus
    g.appendChild(el('circle', { cx: px(0.45), cy: pz(9.48), r: 19, fill: '#8cc084', 'fill-opacity': 0.7, stroke: '#3a6b35', 'stroke-width': 1.0 }));
    g.appendChild(el('circle', { cx: px(0.45), cy: pz(9.48), r: 9, fill: '#578f50', stroke: '#3a6b35', 'stroke-width': 0.7 }));

    // --- Ergonomic Clearance Callouts (有効通路幅・視距離寸法) ---
    const clearArrow = (x1, z1, x2, z2, label) => {
      g.appendChild(el('line', { x1: px(x1), y1: pz(z1), x2: px(x2), y2: pz(z2), stroke: '#2c6e8f', 'stroke-width': 0.85, 'stroke-dasharray': '2 2' }));
      g.appendChild(el('circle', { cx: px(x1), cy: pz(z1), r: 2, fill: '#2c6e8f' }));
      g.appendChild(el('circle', { cx: px(x2), cy: pz(z2), r: 2, fill: '#2c6e8f' }));
      const mx = (px(x1) + px(x2)) / 2;
      const mz = (pz(z1) + pz(z2)) / 2;
      g.appendChild(el('rect', { x: mx - 30, y: mz - 6.5, width: 60, height: 13, rx: 3, fill: '#ffffff', 'fill-opacity': 0.9, stroke: '#2c6e8f', 'stroke-width': 0.5 }));
      g.appendChild(el('text', { x: mx, y: mz + 2.5, 'text-anchor': 'middle', 'font-size': 7.2, 'font-weight': 700, fill: '#1d5673' }, label));
    };
    clearArrow(0.32, 8.85, 2.75, 8.85, '視距離 2,450');
    clearArrow(3.22, 6.68, 4.18, 6.68, '通路 980');
    clearArrow(1.67, 1.80, 2.76, 1.80, '通路 1,100');
    clearArrow(0.18, 4.40, 1.08, 4.40, '有効 950');
  }

  _drawWallsAndColumns(g) {
    // Draw wall segments respecting openings
    WALLS.forEach((wall) => {
      const ops = [...(wall.openings || [])].sort((a, b) => a.start - b.start);
      let cursor = wall.start;
      const fill = wall.exterior ? 'url(#hatch-ext)' : 'url(#hatch-int)';

      const drawSeg = (s0, s1) => {
        if (s1 - s0 <= 0.005) return;
        if (wall.axis === 'x') {
          g.appendChild(el('rect', {
            x: px(s0), y: pz(wall.pos - wall.thick / 2),
            width: (s1 - s0) * SCALE, height: wall.thick * SCALE,
            fill, stroke: '#15171a', 'stroke-width': 1.2,
          }));
        } else {
          g.appendChild(el('rect', {
            x: px(wall.pos - wall.thick / 2), y: pz(s0),
            width: wall.thick * SCALE, height: (s1 - s0) * SCALE,
            fill, stroke: '#15171a', 'stroke-width': 1.2,
          }));
        }
      };

      ops.forEach((op) => {
        drawSeg(cursor, op.start);
        cursor = op.end;
      });
      drawSeg(cursor, wall.end);
    });

    // Structural 105x105mm Timber Columns (通し柱・管柱)
    COLUMNS.forEach(([cx, cz]) => {
      g.appendChild(el('rect', {
        x: px(cx) - 5.2, y: pz(cz) - 5.2, width: 10.4, height: 10.4,
        fill: '#141619', stroke: '#ffffff', 'stroke-width': 0.6,
      }));
    });
  }

  _drawOpenings(g) {
    WALLS.forEach((wall) => {
      (wall.openings || []).forEach((op) => {
        const len = (op.end - op.start) * SCALE;
        const midS = (op.start + op.end) / 2;

        if (op.type === 'window') {
          // Architectural double-glazed sash window lines
          if (wall.axis === 'x') {
            const x = px(op.start), y = pz(wall.pos - wall.thick / 2), h = wall.thick * SCALE;
            g.appendChild(el('rect', { x, y, width: len, height: h, fill: '#f0f7fc', stroke: '#1f364d', 'stroke-width': 1.0 }));
            g.appendChild(el('line', { x1: x, y1: y + h * 0.35, x2: x + len, y2: y + h * 0.35, stroke: '#1f364d', 'stroke-width': 1.2 }));
            g.appendChild(el('line', { x1: x, y1: y + h * 0.65, x2: x + len, y2: y + h * 0.65, stroke: '#1f364d', 'stroke-width': 1.2 }));
          } else {
            const x = px(wall.pos - wall.thick / 2), y = pz(op.start), w = wall.thick * SCALE;
            g.appendChild(el('rect', { x, y, width: w, height: len, fill: '#f0f7fc', stroke: '#1f364d', 'stroke-width': 1.0 }));
            g.appendChild(el('line', { x1: x + w * 0.35, y1: y, x2: x + w * 0.35, y2: y + len, stroke: '#1f364d', 'stroke-width': 1.2 }));
            g.appendChild(el('line', { x1: x + w * 0.65, y1: y, x2: x + w * 0.65, y2: y + len, stroke: '#1f364d', 'stroke-width': 1.2 }));
          }
          // Window tag badge
          const bx = wall.axis === 'x' ? px(midS) : px(wall.pos) + (wall.pos < 1 ? -19 : 19);
          const by = wall.axis === 'x' ? pz(wall.pos) + (wall.pos < 1 ? -18 : 18) : pz(midS);
          g.appendChild(el('rect', { x: bx - 12, y: by - 6.5, width: 24, height: 13, rx: 2, fill: '#1f4e78' }));
          g.appendChild(el('text', { x: bx, y: by + 3, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#fff' }, op.id));
        } else if (op.type === 'door') {
          if (op.subtype === 'pocket') {
            // Sliding pocket door bar + directional arrow
            if (wall.axis === 'x') {
              const x0 = px(op.start), x1 = px(op.end), y = pz(wall.pos);
              g.appendChild(el('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: '#8c5319', 'stroke-width': 3.2 }));
              g.appendChild(el('line', { x1: x0 + 6, y1: y + 9, x2: x1 - 6, y2: y + 9, stroke: '#8c5319', 'stroke-width': 1.0 }));
              g.appendChild(el('polygon', { points: `${x1 - 4},${y + 9} ${x1 - 11},${y + 6} ${x1 - 11},${y + 12}`, fill: '#8c5319' }));
            } else {
              const y0 = pz(op.start), y1 = pz(op.end), x = px(wall.pos);
              g.appendChild(el('line', { x1: x, y1: y0, x2: x, y2: y1, stroke: '#8c5319', 'stroke-width': 3.2 }));
              g.appendChild(el('line', { x1: x - 9, y1: y0 + 6, x2: x - 9, y2: y1 - 6, stroke: '#8c5319', 'stroke-width': 1.0 }));
              g.appendChild(el('polygon', { points: `${x - 9},${y0 + 4} ${x - 12},${y0 + 11} ${x - 6},${y0 + 11}`, fill: '#8c5319' }));
            }
          } else {
            // Hinged swinging door leaf + exact 90-degree architectural swing arc!
            const r = len;
            const hingeAtStart = op.hinge === 'start';
            if (wall.axis === 'x') {
              const hx = px(hingeAtStart ? op.start : op.end);
              const lx = px(hingeAtStart ? op.end : op.start);
              const hy = pz(wall.pos);
              const tipY = hy + op.swingDir * r;
              g.appendChild(el('line', { x1: hx, y1: hy, x2: hx, y2: tipY, stroke: '#8c5319', 'stroke-width': 2.6 }));
              const sweep = (hingeAtStart ? 1 : 0) ^ (op.swingDir > 0 ? 0 : 1);
              g.appendChild(el('path', {
                d: `M ${lx} ${hy} A ${r} ${r} 0 0 ${sweep} ${hx} ${tipY}`,
                fill: 'none', stroke: '#8c5319', 'stroke-width': 0.9, 'stroke-dasharray': '3 2',
              }));
            } else {
              const hy = pz(hingeAtStart ? op.start : op.end);
              const ly = pz(hingeAtStart ? op.end : op.start);
              const hx = px(wall.pos);
              const tipX = hx + op.swingDir * r;
              g.appendChild(el('line', { x1: hx, y1: hy, x2: tipX, y2: hy, stroke: '#8c5319', 'stroke-width': 2.6 }));
              const sweep = (hingeAtStart ? 0 : 1) ^ (op.swingDir > 0 ? 0 : 1);
              g.appendChild(el('path', {
                d: `M ${hx} ${ly} A ${r} ${r} 0 0 ${sweep} ${tipX} ${hy}`,
                fill: 'none', stroke: '#8c5319', 'stroke-width': 0.9, 'stroke-dasharray': '3 2',
              }));
            }
          }
          // Door tag badge
          const bx = wall.axis === 'x' ? px(midS) : px(wall.pos);
          const by = wall.axis === 'x' ? pz(wall.pos) : pz(midS);
          g.appendChild(el('rect', { x: bx - 10, y: by - 6, width: 20, height: 12, rx: 2, fill: '#8c4419' }));
          g.appendChild(el('text', { x: bx, y: by + 2.8, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#fff' }, op.id));
        }
      });
    });
  }

  _drawLighting(g) {
    // Switch-to-light curved dotted wiring lines (JIS 電気設備図)
    SWITCHES.forEach((sw) => {
      const sx = px(sw.x), sy = pz(sw.z);
      sw.targets.forEach((tid) => {
        const lt = LIGHTING.find((l) => l.id === tid);
        if (!lt) return;
        const lx = px(lt.x), ly = pz(lt.z);
        const mx = (sx + lx) / 2 + (ly - sy) * 0.14;
        const my = (sy + ly) / 2 - (lx - sx) * 0.14;
        g.appendChild(el('path', {
          d: `M ${sx} ${sy} Q ${mx} ${my} ${lx} ${ly}`,
          fill: 'none', stroke: '#d97706', 'stroke-width': 0.85, 'stroke-dasharray': '3 2.5', opacity: 0.72,
        }));
      });
      // Switch symbol (●)
      g.appendChild(el('circle', { cx: sx, cy: sy, r: 3.6, fill: '#b45309', stroke: '#fff', 'stroke-width': 0.8 }));
      g.appendChild(el('text', { x: sx + 5, y: sy - 4, 'font-size': 6.8, 'font-weight': 700, fill: '#92400e' }, sw.id));
    });

    // Light fixture symbols
    LIGHTING.forEach((lt) => {
      const lx = px(lt.x), ly = pz(lt.z);
      if (lt.type === 'downlight' || lt.type === 'bath_light') {
        g.appendChild(el('circle', { cx: lx, cy: ly, r: 6.5, fill: '#fff8db', stroke: '#d97706', 'stroke-width': 1.2 }));
        g.appendChild(el('circle', { cx: lx, cy: ly, r: 2.2, fill: '#d97706' }));
      } else if (lt.type === 'pendant') {
        g.appendChild(el('circle', { cx: lx, cy: ly, r: 7.5, fill: '#fef3c7', stroke: '#b45309', 'stroke-width': 1.3 }));
        g.appendChild(el('line', { x1: lx - 5, y1: ly - 5, x2: lx + 5, y2: ly + 5, stroke: '#b45309', 'stroke-width': 1.0 }));
        g.appendChild(el('line', { x1: lx + 5, y1: ly - 5, x2: lx - 5, y2: ly + 5, stroke: '#b45309', 'stroke-width': 1.0 }));
      } else if (lt.type === 'ceiling') {
        g.appendChild(el('circle', { cx: lx, cy: ly, r: 10, fill: '#fffbeb', stroke: '#d97706', 'stroke-width': 1.3 }));
        g.appendChild(el('circle', { cx: lx, cy: ly, r: 5, fill: 'none', stroke: '#d97706', 'stroke-width': 0.9 }));
      } else {
        g.appendChild(el('rect', { x: lx - 5, y: ly - 5, width: 10, height: 10, fill: '#fde68a', stroke: '#b45309', 'stroke-width': 1.0 }));
      }
      g.appendChild(el('text', { x: lx, y: ly + 15, 'text-anchor': 'middle', 'font-size': 6.5, 'font-weight': 600, fill: '#92400e' }, lt.id));
    });
  }

  _drawOutlets(g) {
    OUTLETS.forEach((o) => {
      const ox = px(o.x), oy = pz(o.z);
      // JIS power outlet half-circle + 2 prongs symbol
      g.appendChild(el('circle', { cx: ox, cy: oy, r: 4.5, fill: '#ffffff', stroke: '#15803d', 'stroke-width': 1.2 }));
      g.appendChild(el('line', { x1: ox - 1.5, y1: oy - 3.5, x2: ox - 1.5, y2: oy + 3.5, stroke: '#15803d', 'stroke-width': 1.1 }));
      g.appendChild(el('line', { x1: ox + 1.5, y1: oy - 3.5, x2: ox + 1.5, y2: oy + 3.5, stroke: '#15803d', 'stroke-width': 1.1 }));
      g.appendChild(el('text', { x: ox + 7, y: oy + 2.5, 'font-size': 6.6, 'font-weight': 700, fill: '#166534' }, o.code));
    });
  }

  _drawPlumbing(g) {
    const drawPipeSet = (paths, stroke, width, dash = null) => {
      paths.forEach((pts) => {
        const d = pts.map(([x, z], i) => `${i === 0 ? 'M' : 'L'} ${px(x)} ${pz(z)}`).join(' ');
        const attrs = { d, fill: 'none', stroke, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
        if (dash) attrs['stroke-dasharray'] = dash;
        g.appendChild(el('path', attrs));
      });
    };
    drawPipeSet(PLUMBING.cold, '#0284c7', 2.2);
    drawPipeSet(PLUMBING.hot, '#dc2626', 1.8, '5 2');
    drawPipeSet(PLUMBING.drain, '#16a34a', 2.8, '2 2');

    // Pipe Shaft (PS) Callout Badge
    g.appendChild(el('rect', { x: px(1.94), y: pz(3.52), width: 22, height: 14, rx: 2, fill: '#0f766e' }));
    g.appendChild(el('text', { x: px(2.05), y: pz(3.62), 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 700, fill: '#fff' }, 'PS'));

    // Exhaust ducts
    PLUMBING.exhaust.forEach((ex) => {
      g.appendChild(el('line', {
        x1: px(ex.from[0]), y1: pz(ex.from[1]), x2: px(ex.to[0]), y2: pz(ex.to[1]),
        stroke: '#d97706', 'stroke-width': 2.0, 'stroke-dasharray': '4 2', 'marker-end': 'url(#arr-exhaust)',
      }));
    });
  }

  _drawFlowPaths(g) {
    const markers = { entry_to_ldk: 'url(#arr-entry)', housework: 'url(#arr-work)', private_night: 'url(#arr-priv)' };
    FLOW_PATHS.forEach((fp) => {
      const pts = fp.points;
      let d = `M ${px(pts[0][0])} ${pz(pts[0][1])}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${px(pts[i][0])} ${pz(pts[i][1])}`;
      }
      g.appendChild(el('path', {
        d, fill: 'none', stroke: fp.color, 'stroke-width': 2.4,
        'stroke-dasharray': '7 4', opacity: 0.78,
        'marker-end': markers[fp.id],
      }));
    });
  }

  _drawRoomLabels(g) {
    ROOMS.forEach((r) => {
      if (r.id === 'pantry') return; // already labeled clearly in furniture
      const lx = px(r.labelPos[0]);
      const lz = pz(r.labelPos[1]);
      const badgeW = r.id === 'ldk' ? 132 : (r.w < 1.1 ? 66 : 94);
      const badgeH = r.id === 'ldk' ? 42 : 38;
      const box = el('g', { class: 'room-label-group', style: 'cursor:pointer' });
      box.appendChild(el('rect', {
        x: lx - badgeW / 2, y: lz - badgeH / 2, width: badgeW, height: badgeH, rx: 4,
        fill: '#ffffff', 'fill-opacity': 0.88, stroke: '#4c4943', 'stroke-width': 0.75,
      }));
      box.appendChild(el('text', { x: lx, y: lz - 7, 'text-anchor': 'middle', 'font-size': 9.2, 'font-weight': 700, fill: '#1c1e22' }, r.nameJp));
      box.appendChild(el('text', { x: lx, y: lz + 4.5, 'text-anchor': 'middle', 'font-size': 7.8, 'font-weight': 600, fill: '#8c4419' }, `${r.area.toFixed(2)}m² (${r.jo.toFixed(1)}帖)`));
      box.appendChild(el('text', { x: lx, y: lz + 14.5, 'text-anchor': 'middle', 'font-size': 6.8, fill: '#5d5a54' }, `${r.fl} / ${r.ch}`));
      g.appendChild(box);
    });
  }

  _drawDimensions(g) {
    const dimColor = '#282b30';
    const dimH = (x0, x1, ySvg, label, bold = false) => {
      const a = px(x0), b = px(x1);
      g.appendChild(el('line', { x1: a, y1: ySvg, x2: b, y2: ySvg, stroke: dimColor, 'stroke-width': bold ? 1.1 : 0.75 }));
      // Architectural 45° tick marks
      [a, b].forEach((tx) => {
        g.appendChild(el('line', { x1: tx - 3.5, y1: ySvg + 3.5, x2: tx + 3.5, y2: ySvg - 3.5, stroke: dimColor, 'stroke-width': 1.1 }));
        g.appendChild(el('line', { x1: tx, y1: ySvg - 5, x2: tx, y2: ySvg + 5, stroke: dimColor, 'stroke-width': 0.5 }));
      });
      const txt = el('text', {
        x: (a + b) / 2, y: ySvg - 4, 'text-anchor': 'middle',
        'font-size': bold ? 10.5 : 8.5, 'font-weight': bold ? 700 : 600, fill: dimColor,
      }, label);
      g.appendChild(txt);
    };

    const dimV = (z0, z1, xSvg, label, bold = false) => {
      const a = pz(z0), b = pz(z1);
      g.appendChild(el('line', { x1: xSvg, y1: a, x2: xSvg, y2: b, stroke: dimColor, 'stroke-width': bold ? 1.1 : 0.75 }));
      [a, b].forEach((ty) => {
        g.appendChild(el('line', { x1: xSvg - 3.5, y1: ty + 3.5, x2: xSvg + 3.5, y2: ty - 3.5, stroke: dimColor, 'stroke-width': 1.1 }));
        g.appendChild(el('line', { x1: xSvg - 5, y1: ty, x2: xSvg + 5, y2: ty, stroke: dimColor, 'stroke-width': 0.5 }));
      });
      const my = (a + b) / 2;
      const txt = el('text', {
        x: xSvg - 5, y: my, 'text-anchor': 'middle',
        transform: `rotate(-90 ${xSvg - 5} ${my})`,
        'font-size': bold ? 10.5 : 8.5, 'font-weight': bold ? 700 : 600, fill: dimColor,
      }, label);
      g.appendChild(txt);
    };

    // --- TOP (NORTH) TRIPLE-TIER DIMENSIONS ---
    dimH(0.0, 5.0, PAD_T - 122, '外寸 5,000 mm (5.00 m)', true);
    dimH(0.075, 1.600, PAD_T - 98, '1,525');
    dimH(1.600, 4.925, PAD_T - 98, '3,325');
    dimH(0.15, 1.55, PAD_T - 76, '土間内法 1,400');
    dimH(1.65, 4.85, PAD_T - 76, '主寝室内法 3,200');

    // --- BOTTOM (SOUTH) TRIPLE-TIER DIMENSIONS ---
    const bBase = pz(HOUSE.depth);
    dimH(0.0, 5.0, bBase + 144, '外寸 5,000 mm', true);
    dimH(0.075, 1.150, bBase + 118, '1,075');
    dimH(1.150, 2.050, bBase + 118, '900');
    dimH(2.050, 3.500, bBase + 118, '1,450');
    dimH(3.500, 4.925, bBase + 118, '1,425');

    // --- LEFT (WEST) TRIPLE-TIER DIMENSIONS ---
    dimV(0.0, 10.0, PAD_L - 86, '外寸 10,000 mm (10.00 m)', true);
    dimV(0.075, 1.450, PAD_L - 60, '1,375');
    dimV(1.450, 3.500, PAD_L - 60, '2,050');
    dimV(3.500, 5.300, PAD_L - 60, '1,800');
    dimV(5.300, 9.925, PAD_L - 60, '4,625');
    dimV(0.15, 3.45, PAD_L - 36, '玄関+ホール 3,300');
    dimV(3.55, 5.25, PAD_L - 36, '水回り帯 1,700');
    dimV(5.35, 9.85, PAD_L - 36, 'LDK内法 4,500');

    // --- RIGHT (EAST) DIMENSION SUMMARY ---
    const rBase = px(HOUSE.width);
    dimV(0.15, 3.45, rBase + 38, '寝室 3,300');
    dimV(3.55, 5.25, rBase + 38, 'UB 1,700');
    dimV(5.35, 8.38, rBase + 38, 'キッチン 3,030');
    dimV(8.55, 9.85, rBase + 38, '畳 1,300');
    dimV(0.0, 10.0, rBase + 68, '10,000 mm', true);
  }

  _drawCameraMarker(g) {
    this.camCone = el('path', { d: 'M 0 0', fill: '#b83c2a', 'fill-opacity': 0.22, stroke: '#b83c2a', 'stroke-width': 1.0 });
    this.camDot = el('circle', { cx: px(2.5), cy: pz(5.0), r: 6, fill: '#b83c2a', stroke: '#ffffff', 'stroke-width': 2 });
    g.appendChild(this.camCone);
    g.appendChild(this.camDot);
  }

  _drawTitleBlockAndLegend(svg) {
    const y0 = VH - 76;
    const g = el('g');
    // Architectural Drawing Title Block (表題欄)
    g.appendChild(el('rect', { x: 26, y: y0, width: VW - 52, height: 52, fill: '#f3efe6', stroke: '#2c2f36', 'stroke-width': 1.1 }));
    // Graphic Scale Bar (0 - 1m - 2m - 5m)
    const sx = 42, sy = y0 + 28;
    g.appendChild(el('text', { x: sx, y: sy - 10, 'font-size': 8.5, 'font-weight': 700, fill: '#1c1e22' }, 'SCALE 1 : 50  (単位: mm)'));
    for (let i = 0; i < 5; i++) {
      g.appendChild(el('rect', { x: sx + i * 32, y: sy - 3, width: 32, height: 6, fill: i % 2 === 0 ? '#2c2f36' : '#ffffff', stroke: '#2c2f36', 'stroke-width': 0.8 }));
      g.appendChild(el('text', { x: sx + i * 32, y: sy + 14, 'text-anchor': 'middle', 'font-size': 7.5, fill: '#333' }, `${i}m`));
    }
    g.appendChild(el('text', { x: sx + 160, y: sy + 14, 'text-anchor': 'middle', 'font-size': 7.5, fill: '#333' }, '5m'));

    // Compact Legend columns
    const lx = 248;
    g.appendChild(el('line', { x1: lx - 14, y1: y0, x2: lx - 14, y2: y0 + 52, stroke: '#2c2f36', 'stroke-width': 0.9 }));
    const legendItems = [
      [lx, y0 + 18, '#c25e28', '--- 帰宅/来客動線'],
      [lx + 115, y0 + 18, '#1d7a8c', '--- 最短家事動線(1.8m)'],
      [lx + 245, y0 + 18, '#6b4fa1', '--- プライベート動線'],
      [lx, y0 + 38, '#0284c7', '━━ 給水 / 給湯(赤)'],
      [lx + 115, y0 + 38, '#16a34a', '┄┄ 排水集約コア'],
      [lx + 245, y0 + 38, '#d97706', '○ 照明 / ● スイッチ / ⊖ コンセント'],
    ];
    legendItems.forEach(([x, y, col, label]) => {
      g.appendChild(el('text', { x, y, 'font-size': 8.2, 'font-weight': 600, fill: col }, label));
    });

    // Drawing Sheet Number Box
    const rx = VW - 142;
    g.appendChild(el('line', { x1: rx, y1: y0, x2: rx, y2: y0 + 52, stroke: '#2c2f36', 'stroke-width': 0.9 }));
    g.appendChild(el('text', { x: rx + 58, y: y0 + 21, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700, fill: '#1c1e22' }, '図番: A-01'));
    g.appendChild(el('text', { x: rx + 58, y: y0 + 38, 'text-anchor': 'middle', 'font-size': 8.2, fill: '#555' }, '木造平屋 1LDK'));
    svg.appendChild(g);
  }

  updateCameraPose({ x, z, dx, dz }) {
    if (!this.camDot || !this.camCone) return;
    const clampedX = Math.max(-0.8, Math.min(HOUSE.width + 0.8, x));
    const clampedZ = Math.max(-0.8, Math.min(HOUSE.depth + 0.8, z));
    const cx = px(clampedX);
    const cz = pz(clampedZ);
    this.camDot.setAttribute('cx', cx);
    this.camDot.setAttribute('cy', cz);

    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    const angle = Math.atan2(uz, ux);
    const spread = 0.44;
    const r = 82;
    const x1 = cx + Math.cos(angle - spread) * r;
    const y1 = cz + Math.sin(angle - spread) * r;
    const x2 = cx + Math.cos(angle + spread) * r;
    const y2 = cz + Math.sin(angle + spread) * r;
    this.camCone.setAttribute('d', `M ${cx} ${cz} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`);
  }

  setLayer(name, visible) {
    this.layers[name] = visible;
    this.syncLayerVisibility();
  }

  syncLayerVisibility() {
    Object.entries(this.layers).forEach(([k, v]) => {
      if (this.layerGroups[k]) {
        this.layerGroups[k].style.display = v ? '' : 'none';
      }
      if (k === 'dimensions' && this.layerGroups.grid) {
        this.layerGroups.grid.style.display = v ? '' : 'none';
      }
    });
  }

  exportSVGString() {
    const clone = this.svg.cloneNode(true);
    const cam = clone.querySelector('#layer-camera');
    if (cam) cam.remove();
    clone.setAttribute('xmlns', SVG_NS);
    return new XMLSerializer().serializeToString(clone);
  }
}
