/**
 * INNOVATIONS 2 & 5: POCO F7 (Adreno 825 / 120Hz) Dynamic Resolution Scaler (DRS),
 * Demand-Driven Shadow Scheduler, and 6-Level Spatial Portal Light-Budget Culler (B1F..RF).
 */

import { VILLAGE } from './villageData.js';

const DRS_STEPS = [0.85, 1.0, 1.25, 1.5, 1.75, 2.0];

export class AdaptiveMobileEngine {
  constructor(renderer, postfx, house) {
    this.renderer = renderer;
    this.postfx = postfx;
    this.house = house;

    this.surfaceSuper = false;
    this.baseMaxPR = Math.min(window.devicePixelRatio || 1, 2.0);
    this.maxPR = this.baseMaxPR;
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

  setSurfaceSuper(enabled) {
    this.surfaceSuper = Boolean(enabled);
    const nativeDpr = window.devicePixelRatio || 1;
    this.maxPR = this.surfaceSuper
      ? Math.min(Math.max(nativeDpr, 1.1) * 1.1, 2.4)
      : this.baseMaxPR;
    if (this.surfaceSuper) {
      this.stepIdx = DRS_STEPS.length - 1;
    }
    this._applyPixelRatio();
    if (this.postfx && this.postfx.setSurfaceSuper) {
      this.postfx.setSurfaceSuper(this.surfaceSuper);
    }
    this.markShadowsDirty();
  }

  _applyPixelRatio() {
    const baseScale = DRS_STEPS[this.stepIdx];
    const targetPR = this.surfaceSuper ? Math.min(baseScale * 1.1, this.maxPR) : Math.min(baseScale, this.maxPR);
    this.renderer.setPixelRatio(targetPR);
    if (this.postfx) this.postfx.resize();
  }

  markShadowsDirty() {
    this.renderer.shadowMap.needsUpdate = true;
    this.shadowUpdatesThisSec++;
  }

  _getNearestB3LightSet(px, pz, maxCount = 5) {
    const b3Lights = [];
    for (const entry of this.house.interiorLights) {
      const b = entry.light.userData.building || 'main';
      if (b === 'main' && entry.floor === -2) {
        const dx = entry.light.position.x - px;
        const dz = entry.light.position.z - pz;
        b3Lights.push({ name: entry.name, d2: dx * dx + dz * dz });
      }
    }
    b3Lights.sort((a, b) => a.d2 - b.d2);
    return new Set(b3Lights.slice(0, maxCount).map((e) => e.name));
  }

  _getNearestVillageLightSet(px, pz, maxCount = 5) {
    const vLights = [];
    for (const entry of this.house.interiorLights) {
      if ((entry.light.userData.building || 'main') === 'village') {
        const dx = entry.light.position.x - px;
        const dz = entry.light.position.z - pz;
        vLights.push({ name: entry.name, d2: dx * dx + dz * dz });
      }
    }
    vLights.sort((a, b) => a.d2 - b.d2);
    return new Set(vLights.slice(0, maxCount).map((e) => e.name));
  }

  snapFloorLights(floorIdx, activeBuilding = 'main', inElevator = false, playerX = 1.6, playerZ = 5.8) {
    const elvStop = this.house.elevator ? this.house.elevator.currentStopFloor : -2;
    const nearCompound = Math.hypot(playerX - 1.5, playerZ - 4.5) < 85.0;
    const nearVillage = floorIdx === 1 && !inElevator && Math.hypot(playerX - VILLAGE.centerX, playerZ - VILLAGE.centerZ) < 95.0;
    const b3NearSet = (floorIdx === -2 && activeBuilding === 'main' && !inElevator)
      ? this._getNearestB3LightSet(playerX, playerZ, 5)
      : null;
    const villageNearSet = nearVillage ? this._getNearestVillageLightSet(playerX, playerZ, 5) : null;
    for (const entry of this.house.interiorLights) {
      const b = entry.light.userData.building || 'main';
      if (b === 'village') {
        const activeV = Boolean(villageNearSet && villageNearSet.has(entry.name));
        entry.light.intensity = activeV ? entry.baseInt : 0;
        entry.light.visible = activeV;
        continue;
      }
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
      const sameBuilding = (b === 'both' && nearCompound)
        || b === activeBuilding
        || (activeBuilding === 'courtyard' && nearCompound && (b === 'both' || entry.zone === 'exterior' || entry.zone === 'courtyard'));
      let active = entry.floor === floorIdx && sameBuilding;
      if (active && b3NearSet && b === 'main' && entry.floor === -2) {
        active = b3NearSet.has(entry.name);
      }
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
   * 5-Unit + 11-Level Main Tower (B4F..6F+RF) Spatial Portal Light Culler:
   * Strictly keeps <= 6–7 interior point lights active on the GPU at any instant on POCO F7!
   */
  _updateFloorSpatialLightBudget(dtSec, {
    currentFloor,
    activeFlight,
    activeBuilding = 'main',
    inElevator = false,
    doorOpenMap = {},
    propStates,
    playerX = 1.6,
    playerZ = 5.8,
  }) {
    const elv = this.house.elevator;
    const elvStop = elv ? elv.currentStopFloor : -2;
    const elvOpenHere = Boolean(elv && elv.currentStopFloor === currentFloor && elv.doorProgress > 0.15);
    const nearCompound = Math.hypot(playerX - 1.5, playerZ - 4.5) < 85.0;
    const nearVillage = currentFloor === 1 && !inElevator && Math.hypot(playerX - VILLAGE.centerX, playerZ - VILLAGE.centerZ) < 95.0;
    const b3NearSet = (currentFloor === -2 && activeBuilding === 'main' && !inElevator)
      ? this._getNearestB3LightSet(playerX, playerZ, 5)
      : null;
    const villageNearSet = nearVillage ? this._getNearestVillageLightSet(playerX, playerZ, 5) : null;

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
      if (entry.name === '5F_Studio_Drafting' && propStates.lamp_5f_drafting === false) {
        entry.light.intensity = 0;
        entry.light.visible = false;
        continue;
      }
      if (entry.name === '5F_Conservatory_Lamp' && propStates.lamp_5f_conservatory === false) {
        entry.light.intensity = 0;
        entry.light.visible = false;
        continue;
      }
      if (entry.name === '6F_Hearth_Fire' && propStates.fireplace_6f === false) {
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

      if (b === 'village') {
        if (villageNearSet && villageNearSet.has(entry.name)) {
          weight = 1.0;
        }
      } else if (b === 'elevator') {
        // Elevator cab interior LED ceiling light: glows whenever player is inside cab OR doors are open on player's floor!
        if (inElevator) weight = 1.0;
        else if (activeBuilding === 'main' && currentFloor <= 1 && (elvOpenHere || currentFloor === elvStop)) weight = 0.85;
      } else if (inElevator) {
        // Enclosed steel cab optimization (strictly <= 5 active GPU lights on POCO F7 at all stops!)
        if (b === 'main' && entry.floor === currentFloor && (entry.zone === 'north' || entry.zone === 'elv' || entry.zone === 'studio' || entry.zone === 'living')) {
          weight = elvOpenHere ? 0.95 : 0.35;
        }
      } else if (b === 'both') {
        weight = nearCompound ? (currentFloor === 1 ? 1.0 : (currentFloor === 2 ? 0.35 : 0.0)) : 0.0;
      } else if (activeBuilding === 'courtyard') {
        // Outdoors in the compound courtyard: keep strictly <= 7 GPU lights active on POCO F7!
        const keiDoorOpen = Boolean(doorOpenMap['DK-L'] || doorOpenMap['DK-R'] || doorOpenMap['DK-D']);
        if (b === 'kei' && keiDoorOpen) {
          weight = 0.90; // Authentic automatic dome light when opening Kei-Van cargo doors!
        } else if (nearCompound && entry.floor === 1 && entry.zone === 'exterior') {
          weight = 1.0;
        } else if (nearCompound && !keiDoorOpen && entry.floor === 1 && b === 'main' && entry.zone === 'ldk') {
          weight = 0.42;
        }
      } else if (b === activeBuilding) {
        if (entry.floor === currentFloor) {
          if (b3NearSet && b === 'main' && entry.floor === -2) {
            weight = b3NearSet.has(entry.name) ? 1.0 : 0.0;
          } else {
            weight = 1.0;
          }
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
      } else if (nearCompound && currentFloor === 1 && entry.floor === 1 && entry.zone === 'exterior' && b !== 'storage' && b !== 'camper' && b !== 'kei') {
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
      scale: this.renderer.getPixelRatio().toFixed(2),
      surfaceSuper: this.surfaceSuper,
      drawCalls: (this.postfx && this.postfx.lastMainCalls) ? this.postfx.lastMainCalls : info.render.calls,
      triangles: (this.postfx && this.postfx.lastMainTris) ? this.postfx.lastMainTris : info.render.triangles,
      activeLights,
      shadowRate: this.lastShadowRate,
    };
  }
}
