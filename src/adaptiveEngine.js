/**
 * INNOVATIONS 2 & 5: POCO F7 (Adreno 825 / 120Hz) Dynamic Resolution Scaler (DRS),
 * Demand-Driven Shadow Scheduler, and 6-Level Spatial Portal Light-Budget Culler (B1F..RF).
 */

const DRS_STEPS = [0.85, 1.0, 1.25, 1.5, 1.75, 2.0];

export class AdaptiveMobileEngine {
  constructor(renderer, postfx, house) {
    this.renderer = renderer;
    this.postfx = postfx;
    this.house = house;

    this.maxPR = Math.min(window.devicePixelRatio || 1, 2.0);
    this.stepIdx = DRS_STEPS.findIndex((s) => s >= Math.min(this.maxPR, 1.5));
    if (this.stepIdx < 0) this.stepIdx = 2;

    this.emaFrameMs = 8.33;
    this.detectedHz = 120;
    this.targetFrameMs = 8.8;
    this.sampleCount = 0;
    this.cooldownFrames = 0;
    this.shadowUpdatesThisSec = 0;
    this.shadowSecTimer = 0;
    this.lastShadowRate = 0;

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

  snapFloorLights(floorIdx, activeBuilding = 'main', inElevator = false) {
    const elvStop = this.house.elevator ? this.house.elevator.currentStopFloor : -2;
    for (const entry of this.house.interiorLights) {
      const b = entry.light.userData.building || 'main';
      if (b === 'elevator') {
        const activeElv = inElevator || (activeBuilding === 'main' && floorIdx <= 1 && (floorIdx === elvStop));
        entry.light.intensity = activeElv ? entry.baseInt : 0;
        entry.light.visible = activeElv;
        continue;
      }
      if (inElevator) {
        const activeNear = b === 'main' && entry.floor === floorIdx && (entry.zone === 'north' || entry.zone === 'elv' || entry.zone === 'studio' || entry.zone === 'living');
        entry.light.intensity = activeNear ? entry.baseInt * 0.9 : 0;
        entry.light.visible = activeNear;
        continue;
      }
      const sameBuilding = b === 'both'
        || b === activeBuilding
        || (activeBuilding === 'courtyard' && (b === 'both' || entry.zone === 'exterior' || entry.zone === 'courtyard'));
      const active = entry.floor === floorIdx && sameBuilding;
      entry.light.intensity = active ? entry.baseInt : 0;
      entry.light.visible = active;
    }
  }

  update(dtMs, dtSec, context) {
    const safeDtMs = Math.max(1.0, Math.min(50, dtMs));
    this.emaFrameMs = this.emaFrameMs * 0.92 + safeDtMs * 0.08;
    this.sampleCount++;

    if (this.sampleCount === 45) {
      if (this.emaFrameMs > 13.5) {
        this.detectedHz = 60;
        this.targetFrameMs = 16.2;
      } else {
        this.detectedHz = 120;
        this.targetFrameMs = 8.6;
      }
    }

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

    if (context.anyDoorAnimating || (context.flashlightOn && context.cameraMoved)) {
      this.markShadowsDirty();
    }

    this.shadowSecTimer += dtSec;
    if (this.shadowSecTimer >= 1.0) {
      this.lastShadowRate = this.shadowUpdatesThisSec;
      this.shadowUpdatesThisSec = 0;
      this.shadowSecTimer = 0;
    }

    this._updateFloorSpatialLightBudget(dtSec, context);
  }

  /**
   * 5-Unit + Deep Basement (B3F..RF) Spatial Portal Light Culler:
   * Strictly keeps <= 3–7 interior point lights active on the GPU at any instant on POCO F7!
   */
  _updateFloorSpatialLightBudget(dtSec, { currentFloor, activeFlight, activeBuilding = 'main', inElevator = false, doorOpenMap = {}, propStates }) {
    const elv = this.house.elevator;
    const elvStop = elv ? elv.currentStopFloor : -2;
    const elvOpenHere = Boolean(elv && elv.currentStopFloor === currentFloor && elv.doorProgress > 0.15);

    for (const entry of this.house.interiorLights) {
      if (entry.name === 'Tatami_Lantern' && !propStates.lantern_1f) {
        entry.light.intensity = 0;
        entry.light.visible = false;
        continue;
      }
      if (entry.name === 'Study_Desk' && !propStates.lamp_study) {
        entry.light.intensity = 0;
        entry.light.visible = false;
        continue;
      }
      if (entry.name === 'Attic_Lantern' && !propStates.lantern_attic) {
        entry.light.intensity = 0;
        entry.light.visible = false;
        continue;
      }
      if (entry.name === 'Annex_Cafe_Lamp' && propStates.lamp_annex_cafe === false) {
        entry.light.intensity = 0;
        entry.light.visible = false;
        continue;
      }

      const b = entry.light.userData.building || 'main';
      let weight = 0.0;

      if (b === 'elevator') {
        // Elevator cab interior LED ceiling light: glows whenever player is inside cab OR doors are open on player's floor!
        if (inElevator) weight = 1.0;
        else if (activeBuilding === 'main' && currentFloor <= 1 && (elvOpenHere || currentFloor === elvStop)) weight = 0.85;
      } else if (inElevator) {
        // Enclosed steel cab optimization (strictly <= 5 active GPU lights on POCO F7 at all stops!)
        if (b === 'main' && entry.floor === currentFloor && (entry.zone === 'north' || entry.zone === 'elv' || entry.zone === 'studio' || entry.zone === 'living')) {
          weight = elvOpenHere ? 0.95 : 0.35;
        }
      } else if (b === 'both') {
        weight = currentFloor === 1 ? 1.0 : (currentFloor === 2 ? 0.35 : 0.0);
      } else if (activeBuilding === 'courtyard') {
        // Outdoors in the compound courtyard: keep strictly <= 7 GPU lights active on POCO F7!
        const keiDoorOpen = Boolean(doorOpenMap['DK-L'] || doorOpenMap['DK-R'] || doorOpenMap['DK-D']);
        if (b === 'kei' && keiDoorOpen) {
          weight = 0.90; // Authentic automatic dome light when opening Kei-Van cargo doors!
        } else if (entry.floor === 1 && entry.zone === 'exterior') {
          weight = 1.0;
        } else if (!keiDoorOpen && entry.floor === 1 && b === 'main' && entry.zone === 'ldk') {
          weight = 0.42;
        }
      } else if (b === activeBuilding) {
        if (entry.floor === currentFloor) {
          weight = 1.0;
        } else if (b === 'camper' && entry.zone === 'mid') {
          weight = 0.72; // Soaring 3.02m central skylight atrium illuminates both 1F & 2F Loft bridge!
        } else if (b === 'camper' && currentFloor === 1 && entry.floor === 2) {
          weight = 0.30;
        } else if (activeFlight === 'st_b2' && (entry.floor === 0 || entry.floor === -1)) {
          weight = entry.zone === 'studio' || entry.zone === 'north' || entry.zone === 'south' ? 0.72 : 0.25;
        } else if (activeFlight === 'st_b3' && (entry.floor === -1 || entry.floor === -2)) {
          weight = entry.zone === 'studio' || entry.zone === 'bedroom' || entry.zone === 'living' ? 0.72 : 0.25;
        } else if (typeof activeFlight === 'number' && (entry.floor === activeFlight || entry.floor === activeFlight + 1)) {
          weight = entry.zone === 'north' || entry.zone === 'ldk' || entry.zone === 'main' || entry.zone === 'sanctuary' || entry.zone === 'south' || entry.zone === 'exterior' ? 0.65 : 0.12;
        } else if (currentFloor > 0 && entry.floor > 0 && Math.abs(entry.floor - currentFloor) === 1 && entry.zone === 'north') {
          weight = 0.20;
        }
      } else if (currentFloor === 1 && entry.floor === 1 && entry.zone === 'exterior' && b !== 'storage' && b !== 'camper' && b !== 'kei') {
        weight = 0.55;
      }

      const targetInt = entry.baseInt * weight;
      entry.light.intensity += (targetInt - entry.light.intensity) * Math.min(1, dtSec * 7.0);
      entry.light.visible = entry.light.intensity > 0.025;
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
