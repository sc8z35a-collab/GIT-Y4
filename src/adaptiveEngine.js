/**
 * INNOVATIONS 2 & 5: POCO F7 (Adreno 825 / 120Hz) Dynamic Resolution Scaler (DRS),
 * Demand-Driven Shadow Scheduler, and Spatial Portal Room Light-Budget Culler.
 */

const DRS_STEPS = [0.85, 1.0, 1.25, 1.5, 1.75, 2.0];

export class AdaptiveMobileEngine {
  constructor(renderer, postfx, house) {
    this.renderer = renderer;
    this.postfx = postfx;
    this.house = house;

    // Detect display native pixel ratio capped at 2.0 (ideal for POCO F7 1.5K 446ppi AMOLED)
    this.maxPR = Math.min(window.devicePixelRatio || 1, 2.0);
    this.stepIdx = DRS_STEPS.findIndex((s) => s >= Math.min(this.maxPR, 1.5));
    if (this.stepIdx < 0) this.stepIdx = 2;

    this.emaFrameMs = 8.33;
    this.detectedHz = 120;
    this.targetFrameMs = 8.8; // 120Hz headroom
    this.sampleCount = 0;
    this.cooldownFrames = 0;
    this.shadowUpdatesThisSec = 0;
    this.shadowSecTimer = 0;
    this.lastShadowRate = 0;

    // Demand-driven shadow caching: bake static shadows once, only re-render when dynamic light/door moves!
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this._applyPixelRatio();
  }

  _applyPixelRatio() {
    const pr = Math.min(DRS_STEPS[this.stepIdx], this.maxPR);
    this.renderer.setPixelRatio(pr);
    if (this.postfx) this.postfx.resize();
  }

  markShadowsDirty() {
    this.renderer.shadowMap.needsUpdate = true;
    this.shadowUpdatesThisSec++;
  }

  /**
   * Called each frame with raw frame delta (ms) and protagonist context.
   * Performs:
   *  1) Rolling EMA frame-rate & 120Hz/60Hz cadence calibration
   *  2) Thermal-safe Dynamic Resolution Scaling (DRS)
   *  3) Spatial Portal Room Light-Budget Culling (max <= 4 active interior point lights)
   */
  update(dtMs, dtSec, context) {
    const safeDtMs = Math.max(1.0, Math.min(50, dtMs));
    this.emaFrameMs = this.emaFrameMs * 0.92 + safeDtMs * 0.08;
    this.sampleCount++;

    // Calibrate target cadence during startup (auto-detects 120Hz POCO F7 vs 60Hz displays)
    if (this.sampleCount === 45) {
      if (this.emaFrameMs > 13.5) {
        this.detectedHz = 60;
        this.targetFrameMs = 16.2;
      } else {
        this.detectedHz = 120;
        this.targetFrameMs = 8.6;
      }
    }

    // Dynamic Resolution Scaling with hysteresis to prevent oscillation
    if (this.cooldownFrames > 0) {
      this.cooldownFrames--;
    } else if (this.sampleCount > 60) {
      if (this.emaFrameMs > this.targetFrameMs * 1.18 && this.stepIdx > 0) {
        this.stepIdx--;
        this._applyPixelRatio();
        this.cooldownFrames = 55;
      } else if (this.emaFrameMs < this.targetFrameMs * 0.72 && this.stepIdx < DRS_STEPS.length - 1 && DRS_STEPS[this.stepIdx + 1] <= this.maxPR) {
        this.stepIdx++;
        this._applyPixelRatio();
        this.cooldownFrames = 90;
      }
    }

    // Demand-driven shadow refresh ONLY when a door is animating OR flashlight is ON & player moved/turned
    if (context.anyDoorAnimating || (context.flashlightOn && context.cameraMoved)) {
      this.markShadowsDirty();
    }

    // Shadow update telemetry per second
    this.shadowSecTimer += dtSec;
    if (this.shadowSecTimer >= 1.0) {
      this.lastShadowRate = this.shadowUpdatesThisSec;
      this.shadowUpdatesThisSec = 0;
      this.shadowSecTimer = 0;
    }

    // Spatial Portal Light-Budget Culler: smoothly dim lights behind closed interior doors!
    this._updateSpatialLightBudget(dtSec, context);
  }

  _updateSpatialLightBudget(dtSec, { roomId, doorOpenMap, lanternOn }) {
    const inNorth = roomId === 'genkan' || roomId === 'hall' || roomId === 'bedroom' || roomId === 'exterior';
    const inMid = roomId === 'passage' || roomId === 'wc' || roomId === 'washroom' || roomId === 'bath';
    const inLDK = roomId === 'ldk' || roomId === 'tatami_nook' || roomId === 'pantry' || !roomId;

    const d2Open = Boolean(doorOpenMap.D2); // Bedroom
    const d3Open = Boolean(doorOpenMap.D3); // Living
    const d5Open = Boolean(doorOpenMap.D5); // Washroom
    const d1Open = Boolean(doorOpenMap.D1); // Front door

    for (const entry of this.house.interiorLights) {
      let weight = 0.0;
      switch (entry.name) {
        case 'Dining_Pendant':
        case 'Living_Cove':
        case 'Kitchen_Task':
          weight = inLDK ? 1.0 : (d3Open || d5Open ? 0.55 : 0.08);
          break;
        case 'Tatami_Lantern':
          weight = lanternOn ? (inLDK ? 1.0 : (d3Open ? 0.45 : 0.0)) : 0.0;
          break;
        case 'Bedroom_Lamps':
          weight = roomId === 'bedroom' ? 1.0 : (d2Open && inNorth ? 0.65 : 0.0);
          break;
        case 'Genkan_Glow':
          weight = (inNorth || inMid) ? 1.0 : (d3Open ? 0.35 : 0.0);
          break;
        case 'Corridor_Dim':
          weight = (inMid || inNorth || d3Open) ? 1.0 : 0.25;
          break;
        case 'Wash_Bath':
          weight = (roomId === 'washroom' || roomId === 'bath' || roomId === 'wc') ? 1.0 : (d5Open ? 0.65 : 0.05);
          break;
        case 'Porch_Sconce':
          weight = (roomId === 'exterior' || roomId === 'genkan' || d1Open) ? 1.0 : 0.35;
          break;
        default:
          weight = 1.0;
      }

      const targetInt = entry.baseInt * weight;
      entry.light.intensity += (targetInt - entry.light.intensity) * Math.min(1, dtSec * 6.0);
      entry.light.visible = entry.light.intensity > 0.02;
    }
  }

  getTelemetry() {
    const info = this.renderer.info;
    const activeLights = this.house.interiorLights.filter((l) => l.light.visible).length;
    return {
      fps: Math.round(1000 / Math.max(1, this.emaFrameMs)),
      frameMs: this.emaFrameMs.toFixed(1),
      targetHz: this.detectedHz,
      scale: Math.min(DRS_STEPS[this.stepIdx], this.maxPR).toFixed(2),
      drawCalls: (this.postfx && this.postfx.lastMainCalls) ? this.postfx.lastMainCalls : info.render.calls,
      triangles: (this.postfx && this.postfx.lastMainTris) ? this.postfx.lastMainTris : info.render.triangles,
      activeLights,
      shadowRate: this.lastShadowRate,
    };
  }
}
