/**
 * NARROW-50 / TERRENO Cinema/AAA Physical-Modeling Spatial Audio & Foley Engine (v4.0)
 *
 * Strictly zero continuous high-pitched beeps ("ぴぴぴぴぴ") + leak-free 0.0000 Master Mute Bus.
 * Upgraded to Cinema/AAA physical-modeling & mastering architecture:
 *  - Multi-stage Studio Mastering: 24Hz DC-block HPF -> Sub/Air Presence EQ -> Analog Transformer
 *    Warmth WaveShaper -> DynamicsCompressor -> Brickwall Safety Limiter -> MasterGain -> Destination
 *  - 4-Space Physically Modeled Stereo Convolution Reverb with Dual-Band Air Absorption:
 *      (1) Hinoki Timber Room, (2) Wet Granite Spa / Garage, (3) 40m SILO-40 Launch Cavern,
 *      (4) Alpine Mountain Valley Canyon Echo (real mountain-ridge reflections!)
 *  - 7 Pre-Baked Stereo Micro-Physics Buffers (White, 7-pole Pink, Deep Brown, Hearth Crackle,
 *    Minnaert Water Bubbles, Crystalline Gravel/Frost Grit, Dry Autumn Foliage Sibilance)
 *  - 128 ultra-realistic multi-layered procedural SFX (69 upgraded core + 59 brand-new V4 SFX)
 */

import {
  HYPER_SFX_V4_IDS,
  buildAnalogWarmthCurve,
  buildCombustionCurve,
  buildPhysicalIR,
  buildExtendedNoiseBuffers,
  playModalBody,
  playGranularScatter,
  playFormantVocal,
  installHyperFoleyV4,
} from './audioFoleyV4.js';

export const SFX_CATALOG = [
  // Footsteps & Player Foley (14 core)
  'footstep_wood', 'footstep_tatami', 'footstep_tile', 'footstep_wet_stone',
  'footstep_metal', 'footstep_earth', 'footstep_gravel', 'footstep_grass',
  'footstep_bridge', 'footstep_water', 'jump_pushoff', 'land_impact',
  'crouch_rustle', 'stair_step',
  // Architectural Doors, Hatches & Shutters (10 core)
  'door_wood_swing', 'door_shoji_slide', 'door_airtight_bunker', 'door_glass_slide',
  'door_vehicle_cab', 'door_liftgate_strut', 'door_armor_airlock', 'door_k11_airlock',
  'garage_rollup_shutter', 'armor_storm_shutter',
  // Interactive Props, Sauna, Hearth & Underground Lab (10 core)
  'flashlight_click', 'lamp_switch', 'washi_lantern_toggle', 'fireplace_toggle',
  'sauna_loyly_steam', 'thermal_console_cmd', 'cooling_plenum_boost', 'lab_uv_mode',
  'lab_containment_overdrive', 'tow_hitch_couple',
  // Elevators, SILO-40 & Avionics (9 core)
  'elevator_button', 'elevator_brake', 'elevator_door', 'elevator_chime',
  'elevator_safety_cue', 'elevator_motor_loop', 'silo_hydraulic_stage',
  'k11_refuel_pump', 'autopilot_cue',
  // Ground Vehicles & Airship K-11 Flight (15 core)
  'engine_start_diesel', 'engine_start_armor', 'engine_start_kei', 'engine_start_k11',
  'engine_shutdown', 'vehicle_engine_loop', 'tire_surface_loop', 'tire_hydroplane_skid',
  'suspension_thud', 'bridge_expansion_joint', 'vehicle_collision_impact',
  'vehicle_headlight_relay', 'k11_takeoff_boost', 'k11_touchdown_struts',
  'k11_airship_flight_loop',
  // Living World Nature, Weather & UI (11 core)
  'forest_wind_ambience', 'river_rapids_ambience', 'village_spring_ambience',
  'hearth_fire_ambience', 'sauna_spa_ambience', 'underground_hvac_ambience',
  'storm_rain_roof_ambience', 'thunder_lightning_crack', 'landslide_rockfall',
  'wildlife_bird_owl_woodpecker', 'ui_tactile_feedback',
  // Hyper-Realism v4.0 Expansion (+59 brand-new physically modeled SFX -> 128 total!)
  ...HYPER_SFX_V4_IDS,
];

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export class SpatialForestAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.muted = false;

    // Cinema Studio Master Chain & 4-Space Reverb Buses
    this.masterGain = null;
    this.compressor = null;
    this.limiter = null;
    this.warmthShaper = null;
    this.masterInBus = null;
    this.sfxBus = null;
    this.ambienceBus = null;
    this.vehicleBus = null;
    this.uiBus = null;
    this.roomReverbSend = null;
    this.spaReverbSend = null;
    this.cavernReverbSend = null;
    this.valleyReverbSend = null;
    this.roomWetGain = null;
    this.spaWetGain = null;
    this.cavernWetGain = null;
    this.valleyWetGain = null;
    this.combustionCurve = null;

    // 7 Pre-baked High-Definition Stereo Noise Buffers (zero GC during gameplay)
    this.whiteBuf = null;
    this.pinkBuf = null;
    this.brownBuf = null;
    this.crackleBuf = null;
    this.dropletBuf = null;
    this.gritBuf = null;
    this.foliageBuf = null;
    // Keep alias for any legacy callers inspecting this.noiseBuffer
    this.noiseBuffer = null;

    // Continuous Ambient Loops
    this.windFilterL = null;
    this.windFilterR = null;
    this.windGain = null;
    this.leafFilter = null;
    this.leafGain = null;

    this.riverLowFilter = null;
    this.riverMidFilter = null;
    this.riverHighFilter = null;
    this.riverGain = null;
    this.riverBubbleGain = null;

    this.springFilter = null;
    this.springGain = null;

    this.fireCrackleGain = null;
    this.fireRumbleGain = null;

    this.spaGain = null;
    this.hvacGain = null;
    this.hvacFilter = null;

    this.rainFilter = null;
    this.rainRoofFilter = null;
    this.rainGain = null;
    this.rainRoofGain = null;

    // Vehicle Engine & Tire Loops
    this.engineNodes = null;
    this.elvNodes = null;
    this.airNodes = null;

    // State Tracking & Organic Living World Timers
    this._footParity = 1;
    this._lastOpenness = 0.25;
    this._lastStormIntensity = 0.0;
    this._lastAcousticZone = 'wood_room';
    this._wildlifeTimer = 7.5;
    this._ambientEventTimer = 11.0;
    this._shishiTimer = 8.0;
    this._interiorTimer = 14.0;
    this._stormMicroTimer = 4.5;
    this._lastJointTime = 0;
    this._lastSkidTime = 0;
    this._lastLandslideTime = 0;
    this._lastCreakTime = 0;
    this._envState = {
      isOutdoors: false,
      isNight: false,
      altitudeASL: 320,
      onBridge: false,
      riverDist: 999,
      riverFlowBoost: 0,
      springDist: 999,
      shrineDist: 999,
      compoundDist: 0,
      fireDist: 999,
      inSpa: false,
      inUnderground: false,
      inSiloCavern: false,
      roofKind: 'wood',
      landslideNear: 0,
    };
  }

  getCatalog() {
    return SFX_CATALOG;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.enabled = true;

    const sr = this.ctx.sampleRate;
    this.combustionCurve = buildCombustionCurve(1024);

    // 1. Cinema Studio Master Chain:
    //    Buses -> MasterInBus -> 24Hz DC HPF -> Sub/Air EQ -> Analog Warmth -> Compressor -> Brickwall Limiter -> MasterGain -> Destination
    // STRICT MUTE GUARANTEE: EVERYTHING routes into masterGain! Zero direct destination bypasses!
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0.0 : 0.94;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2.2;
    this.limiter.knee.value = 3;
    this.limiter.ratio.value = 18;
    this.limiter.attack.value = 0.0015;
    this.limiter.release.value = 0.08;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -13.5;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 3.4;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.16;

    this.warmthShaper = this.ctx.createWaveShaper();
    this.warmthShaper.curve = buildAnalogWarmthCurve(1024);
    this.warmthShaper.oversample = '2x';

    const dcHpf = this.ctx.createBiquadFilter();
    dcHpf.type = 'highpass';
    dcHpf.frequency.value = 24;
    dcHpf.Q.value = 0.7;

    const subShelf = this.ctx.createBiquadFilter();
    subShelf.type = 'lowshelf';
    subShelf.frequency.value = 68;
    subShelf.gain.value = 1.6;

    const airShelf = this.ctx.createBiquadFilter();
    airShelf.type = 'highshelf';
    airShelf.frequency.value = 9200;
    airShelf.gain.value = 1.3;

    this.masterInBus = this.ctx.createGain();
    this.masterInBus.gain.value = 1.0;

    this.masterInBus.connect(dcHpf);
    dcHpf.connect(subShelf);
    subShelf.connect(airShelf);
    airShelf.connect(this.warmthShaper);
    this.warmthShaper.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1.0;
    this.sfxBus.connect(this.masterInBus);

    this.ambienceBus = this.ctx.createGain();
    this.ambienceBus.gain.value = 0.96;
    this.ambienceBus.connect(this.masterInBus);

    this.vehicleBus = this.ctx.createGain();
    this.vehicleBus.gain.value = 0.94;
    this.vehicleBus.connect(this.masterInBus);

    this.uiBus = this.ctx.createGain();
    this.uiBus.gain.value = 0.86;
    this.uiBus.connect(this.masterInBus);

    // 2. 4-Space Physically Modeled Stereo Convolution Reverb Engine
    this.roomReverbSend = this.ctx.createGain();
    this.roomReverbSend.gain.value = 0.34;
    this.spaReverbSend = this.ctx.createGain();
    this.spaReverbSend.gain.value = 0.04;
    this.cavernReverbSend = this.ctx.createGain();
    this.cavernReverbSend.gain.value = 0.03;
    this.valleyReverbSend = this.ctx.createGain();
    this.valleyReverbSend.gain.value = 0.12;

    try {
      // Space 1: Warm Hinoki Timber Room (0.68s, close early wall reflections)
      const roomConv = this.ctx.createConvolver();
      roomConv.buffer = buildPhysicalIR(this.ctx, {
        durationSec: 0.72, lowDecay: 2.3, highDecay: 5.0, splitHz: 1450, lpfHz: 4600, gainScale: 0.56,
        earlyTaps: [[0.008, 0.58, 0.002], [0.017, 0.42, 0.004], [0.029, 0.30, 0.003], [0.043, 0.22, 0.005]],
      });
      this.roomWetGain = this.ctx.createGain();
      this.roomWetGain.gain.value = 0.34;
      this.roomReverbSend.connect(roomConv);
      roomConv.connect(this.roomWetGain);
      this.roomWetGain.connect(this.masterInBus);

      // Space 2: Wet Granite Bathhouse / Garage (1.95s, crisp stone flutter)
      const spaConv = this.ctx.createConvolver();
      spaConv.buffer = buildPhysicalIR(this.ctx, {
        durationSec: 1.95, preDelaySec: 0.012, lowDecay: 1.9, highDecay: 3.1, splitHz: 2200, lpfHz: 6200, gainScale: 0.50,
        earlyTaps: [[0.014, 0.65, 0.003], [0.028, 0.52, 0.006], [0.049, 0.38, 0.004], [0.074, 0.28, 0.008]],
      });
      this.spaWetGain = this.ctx.createGain();
      this.spaWetGain.gain.value = 0.04;
      this.spaReverbSend.connect(spaConv);
      spaConv.connect(this.spaWetGain);
      this.spaWetGain.connect(this.masterInBus);

      // Space 3: 40m SILO-40 Launch Cavern (3.20s, deep concrete slapback)
      const cavernConv = this.ctx.createConvolver();
      cavernConv.buffer = buildPhysicalIR(this.ctx, {
        durationSec: 3.20, preDelaySec: 0.042, lowDecay: 1.7, highDecay: 3.9, splitHz: 1100, lpfHz: 3200, gainScale: 0.52,
        earlyTaps: [[0.045, 0.68, 0.008], [0.088, 0.50, 0.012], [0.142, 0.36, 0.015]],
      });
      this.cavernWetGain = this.ctx.createGain();
      this.cavernWetGain.gain.value = 0.04;
      this.cavernReverbSend.connect(cavernConv);
      cavernConv.connect(this.cavernWetGain);
      this.cavernWetGain.connect(this.masterInBus);

      // Space 4: Alpine Mountain Valley Echo (2.65s, stereo ridge reflections at 95/168/245ms!)
      const valleyConv = this.ctx.createConvolver();
      valleyConv.buffer = buildPhysicalIR(this.ctx, {
        durationSec: 2.65, preDelaySec: 0.068, lowDecay: 2.1, highDecay: 5.8, splitHz: 920, lpfHz: 2800, gainScale: 0.44,
        earlyTaps: [[0.095, 0.54, 0.022, 0.85], [0.168, 0.40, -0.028, 1.05], [0.248, 0.28, 0.032, 0.90]],
      });
      this.valleyWetGain = this.ctx.createGain();
      this.valleyWetGain.gain.value = 0.16;
      this.valleyReverbSend.connect(valleyConv);
      valleyConv.connect(this.valleyWetGain);
      this.valleyWetGain.connect(this.masterInBus);
    } catch (_) {
      this.roomWetGain = this.ctx.createGain();
      this.spaWetGain = this.ctx.createGain();
      this.cavernWetGain = this.ctx.createGain();
      this.valleyWetGain = this.ctx.createGain();
    }

    // 3. Generate 7 High-Definition Stereo Noise & Micro-Physics Buffers
    this._buildNoiseBuffers(sr);

    // 4. Initialize Organic Continuous Spatial Ambience Layers (ZERO high-pitched beep oscillators!)
    this._initForestWindLayer();
    this._initRiverAndSpringLayers();
    this._initInteriorAmbienceLayers();
  }

  _buildImpulseResponse(durationSec, decayPower, lpfHz) {
    return buildPhysicalIR(this.ctx, {
      durationSec, lowDecay: decayPower, highDecay: decayPower * 1.9, lpfHz,
    });
  }

  _buildNoiseBuffers(sr) {
    const len3 = Math.floor(sr * 3.0);
    const len4 = Math.floor(sr * 4.0);

    // Stereo White Noise
    this.whiteBuf = this.ctx.createBuffer(2, len3, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.whiteBuf.getChannelData(ch);
      for (let i = 0; i < len3; i++) d[i] = Math.random() * 2 - 1;
    }

    // Stereo Pink Noise (Paul Kellet 7-pole approximation — ultra-smooth natural 1/f spectrum!)
    this.pinkBuf = this.ctx.createBuffer(2, len4, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.pinkBuf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len4; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }

    // Stereo Brown Noise (Deep organic low-frequency rumble)
    this.brownBuf = this.ctx.createBuffer(2, len4, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.brownBuf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len4; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.025 * w) / 1.025;
        d[i] = clamp(last * 3.4, -1, 1);
      }
    }
    this.noiseBuffer = this.brownBuf;

    // Stochastic Micro-Crackle Buffer (for hearth wood crackle & embers)
    this.crackleBuf = this.ctx.createBuffer(2, len3, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.crackleBuf.getChannelData(ch);
      let decay = 0;
      for (let i = 0; i < len3; i++) {
        if (Math.random() < 0.00055) {
          decay = (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.65);
        }
        d[i] = decay * (0.5 + 0.5 * (Math.random() * 2 - 1));
        decay *= 0.91;
      }
    }

    // Extended V4 Physical Micro-Buffers: Minnaert Water Bubbles, Crystalline Grit, Dry Foliage
    const ext = buildExtendedNoiseBuffers(this.ctx);
    this.dropletBuf = ext.dropletBuf;
    this.gritBuf = ext.gritBuf;
    this.foliageBuf = ext.foliageBuf;
  }

  _initForestWindLayer() {
    // Smooth Stereo Deep Mountain Forest Wind + Subtle Leaf Canopy Rustle
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.pinkBuf;
    windSrc.loop = true;

    this.windFilterL = this.ctx.createBiquadFilter();
    this.windFilterL.type = 'lowpass';
    this.windFilterL.frequency.value = 185;
    this.windFilterL.Q.value = 1.1;

    // Organic gentle mountain breeze LFO (strictly modulates filter frequency — NEVER gain above mute!)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.085;
    lfoGain.gain.value = 55;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windFilterL.frequency);
    lfo.start();

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.075;

    windSrc.connect(this.windFilterL);
    this.windFilterL.connect(this.windGain);
    this.windGain.connect(this.ambienceBus);
    windSrc.start();

    // Canopy Leaf Shimmer (soft high-mid rustle heard mainly outdoors in breeze — NO tonal oscillators!)
    const leafSrc = this.ctx.createBufferSource();
    leafSrc.buffer = this.pinkBuf;
    leafSrc.loop = true;
    this.leafFilter = this.ctx.createBiquadFilter();
    this.leafFilter.type = 'bandpass';
    this.leafFilter.frequency.value = 1650;
    this.leafFilter.Q.value = 0.65;

    const leafLfo = this.ctx.createOscillator();
    const leafLfoG = this.ctx.createGain();
    leafLfo.frequency.value = 0.14;
    leafLfoG.gain.value = 280;
    leafLfo.connect(leafLfoG);
    leafLfoG.connect(this.leafFilter.frequency);
    leafLfo.start();

    this.leafGain = this.ctx.createGain();
    this.leafGain.gain.value = 0.0;
    leafSrc.connect(this.leafFilter);
    this.leafFilter.connect(this.leafGain);
    this.leafGain.connect(this.ambienceBus);
    leafSrc.start(0, 1.3);
  }

  _initRiverAndSpringLayers() {
    // Multi-band Mountain River & Rapids (Kurosugi River + Tributaries)
    const rivSrc = this.ctx.createBufferSource();
    rivSrc.buffer = this.pinkBuf;
    rivSrc.loop = true;

    const rivLow = this.ctx.createBiquadFilter();
    rivLow.type = 'lowpass';
    rivLow.frequency.value = 260;
    this.riverLowFilter = rivLow;

    const rivMid = this.ctx.createBiquadFilter();
    rivMid.type = 'bandpass';
    rivMid.frequency.value = 1080;
    rivMid.Q.value = 0.65;
    this.riverMidFilter = rivMid;

    const rivHi = this.ctx.createBiquadFilter();
    rivHi.type = 'bandpass';
    rivHi.frequency.value = 3400;
    rivHi.Q.value = 0.9;
    this.riverHighFilter = rivHi;

    const lowG = this.ctx.createGain(); lowG.gain.value = 0.58;
    const midG = this.ctx.createGain(); midG.gain.value = 0.42;
    const hiG = this.ctx.createGain();  hiG.gain.value = 0.18;

    this.riverGain = this.ctx.createGain();
    this.riverGain.gain.value = 0.0;

    rivSrc.connect(rivLow);  rivLow.connect(lowG);  lowG.connect(this.riverGain);
    rivSrc.connect(rivMid);  rivMid.connect(midG);  midG.connect(this.riverGain);
    rivSrc.connect(rivHi);   rivHi.connect(hiG);    hiG.connect(this.riverGain);
    this.riverGain.connect(this.ambienceBus);
    rivSrc.start(0, 0.7);

    // Live Minnaert Water Bubble Sparkle Layer (gives Kurosugi River authentic crystalline babble!)
    const bubSrc = this.ctx.createBufferSource();
    bubSrc.buffer = this.dropletBuf || this.crackleBuf;
    bubSrc.loop = true;
    const bubBp = this.ctx.createBiquadFilter();
    bubBp.type = 'bandpass';
    bubBp.frequency.value = 1520;
    bubBp.Q.value = 0.85;
    this.riverBubbleGain = this.ctx.createGain();
    this.riverBubbleGain.gain.value = 0.0;
    bubSrc.connect(bubBp);
    bubBp.connect(this.riverBubbleGain);
    this.riverBubbleGain.connect(this.ambienceBus);
    if (this.valleyReverbSend) this.riverBubbleGain.connect(this.valleyReverbSend);
    bubSrc.start(0, 0.4);

    // Village Bamboo Spring Well / B3F Spa Trickle (clear Minnaert babbling water)
    const spSrc = this.ctx.createBufferSource();
    spSrc.buffer = this.dropletBuf || this.crackleBuf;
    spSrc.loop = true;
    this.springFilter = this.ctx.createBiquadFilter();
    this.springFilter.type = 'bandpass';
    this.springFilter.frequency.value = 1850;
    this.springFilter.Q.value = 1.4;
    this.springGain = this.ctx.createGain();
    this.springGain.gain.value = 0.0;
    spSrc.connect(this.springFilter);
    this.springFilter.connect(this.springGain);
    this.springGain.connect(this.ambienceBus);
    this.springGain.connect(this.roomReverbSend);
    if (this.spaReverbSend) this.springGain.connect(this.spaReverbSend);
    spSrc.start(0, 0.2);
  }

  _initInteriorAmbienceLayers() {
    // Crackling Fireplace / Irori Hearth (Crackle + Low Draft Rumble)
    const fireCrk = this.ctx.createBufferSource();
    fireCrk.buffer = this.crackleBuf;
    fireCrk.loop = true;
    const fireBp = this.ctx.createBiquadFilter();
    fireBp.type = 'bandpass';
    fireBp.frequency.value = 2400;
    fireBp.Q.value = 0.85;
    this.fireCrackleGain = this.ctx.createGain();
    this.fireCrackleGain.gain.value = 0.0;
    fireCrk.connect(fireBp);
    fireBp.connect(this.fireCrackleGain);
    this.fireCrackleGain.connect(this.ambienceBus);
    this.fireCrackleGain.connect(this.roomReverbSend);
    fireCrk.start(0, 1.1);

    const fireRmb = this.ctx.createBufferSource();
    fireRmb.buffer = this.brownBuf;
    fireRmb.loop = true;
    const fireLp = this.ctx.createBiquadFilter();
    fireLp.type = 'lowpass';
    fireLp.frequency.value = 135;
    this.fireRumbleGain = this.ctx.createGain();
    this.fireRumbleGain.gain.value = 0.0;
    fireRmb.connect(fireLp);
    fireLp.connect(this.fireRumbleGain);
    this.fireRumbleGain.connect(this.ambienceBus);
    fireRmb.start(0, 2.1);

    // Underground Lab / SILO-40 Architectural Ventilation Hum (soft low airflow — never beepy!)
    const hvacSrc = this.ctx.createBufferSource();
    hvacSrc.buffer = this.brownBuf;
    hvacSrc.loop = true;
    this.hvacFilter = this.ctx.createBiquadFilter();
    this.hvacFilter.type = 'bandpass';
    this.hvacFilter.frequency.value = 92;
    this.hvacFilter.Q.value = 1.6;
    this.hvacGain = this.ctx.createGain();
    this.hvacGain.gain.value = 0.0;
    hvacSrc.connect(this.hvacFilter);
    this.hvacFilter.connect(this.hvacGain);
    this.hvacGain.connect(this.ambienceBus);
    hvacSrc.start(0, 0.4);

    // B3F Sauna & Thermal Spa Warm Ambient Steam Shimmer
    const spaSrc = this.ctx.createBufferSource();
    spaSrc.buffer = this.pinkBuf;
    spaSrc.loop = true;
    const spaBp = this.ctx.createBiquadFilter();
    spaBp.type = 'bandpass';
    spaBp.frequency.value = 720;
    spaBp.Q.value = 0.8;
    this.spaGain = this.ctx.createGain();
    this.spaGain.gain.value = 0.0;
    spaSrc.connect(spaBp);
    spaBp.connect(this.spaGain);
    this.spaGain.connect(this.ambienceBus);
    if (this.spaReverbSend) this.spaGain.connect(this.spaReverbSend);
    spaSrc.start(0, 1.9);
  }

  _connectSfx(node, pan = 0, reverbAmt = 0.25, spaceOverride = null) {
    let tail = node;
    if (typeof this.ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.005) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -0.9, 0.9);
      node.connect(p);
      tail = p;
    }
    tail.connect(this.sfxBus);
    if (reverbAmt > 0.01 && this.roomReverbSend) {
      const send = this.ctx.createGain();
      send.gain.value = reverbAmt;
      tail.connect(send);
      if (spaceOverride === 'valley' && this.valleyReverbSend) {
        send.connect(this.valleyReverbSend);
      } else if (spaceOverride === 'spa' && this.spaReverbSend) {
        send.connect(this.spaReverbSend);
      } else if (spaceOverride === 'silo' && this.cavernReverbSend) {
        send.connect(this.cavernReverbSend);
      } else if (spaceOverride === 'room') {
        send.connect(this.roomReverbSend);
      } else {
        // Automatic 4-space acoustic blend controlled by current acoustic zone wet gains
        send.connect(this.roomReverbSend);
        if (this.spaReverbSend) send.connect(this.spaReverbSend);
        if (this.cavernReverbSend) send.connect(this.cavernReverbSend);
        if (this.valleyReverbSend) send.connect(this.valleyReverbSend);
      }
    }
  }

  toggleMute() {
    if (!this.ctx) this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0.0 : 0.94, this.ctx.currentTime, 0.06);
    }
    return !this.muted;
  }

  setAcousticZone(zone = 'wood_room') {
    if (!this.ctx || !this.roomWetGain || !this.cavernWetGain) return;
    if (zone === this._lastAcousticZone) return;
    this._lastAcousticZone = zone;
    const t = this.ctx.currentTime;
    let roomW = 0.28, spaW = 0.03, cavW = 0.02, valW = 0.06;
    if (zone === 'outdoor') {
      roomW = 0.04; spaW = 0.01; cavW = 0.01; valW = 0.36;
    } else if (zone === 'wood_room') {
      roomW = 0.36; spaW = 0.02; cavW = 0.01; valW = 0.04;
    } else if (zone === 'stone_bath' || zone === 'garage') {
      roomW = 0.14; spaW = 0.46; cavW = 0.08; valW = 0.02;
    } else if (zone === 'basement_lab') {
      roomW = 0.16; spaW = 0.28; cavW = 0.24; valW = 0.01;
    } else if (zone === 'silo_cavern' || zone === 'cavern') {
      roomW = 0.10; spaW = 0.16; cavW = 0.64; valW = 0.01;
    } else if (zone === 'vehicle_cabin' || zone === 'metal_cabin' || zone === 'airship_cabin') {
      roomW = 0.14; spaW = 0.05; cavW = 0.01; valW = 0.12;
    }
    this.roomWetGain.gain.setTargetAtTime(roomW, t, 0.25);
    if (this.spaWetGain) this.spaWetGain.gain.setTargetAtTime(spaW, t, 0.25);
    this.cavernWetGain.gain.setTargetAtTime(cavW, t, 0.25);
    if (this.valleyWetGain) this.valleyWetGain.gain.setTargetAtTime(valW, t, 0.25);
  }

  /**
   * Real-time acoustic occlusion for outdoor wind & forest canopy leaf rustle!
   */
  updateOcclusion(openness) {
    this._lastOpenness = clamp(openness, 0, 1);
    if (!this.ctx || !this.windFilterL || !this.windGain) return;
    const t = this.ctx.currentTime;
    const stormBoost = this._lastStormIntensity;
    const altBoost = clamp(((this._envState.altitudeASL || 320) - 550) / 800, 0, 1);
    const freq = 145 + this._lastOpenness * 520 + stormBoost * 340 * this._lastOpenness + altBoost * 240;
    const gain = (0.040 + this._lastOpenness * 0.095) * (1.0 + stormBoost * 0.85 + altBoost * 0.45);
    this.windFilterL.frequency.setTargetAtTime(freq, t, 0.22);
    this.windGain.gain.setTargetAtTime(gain, t, 0.22);

    if (this.leafGain) {
      const leafTarget = Math.max(0, (this._lastOpenness - 0.18) / 0.82) * (0.032 + stormBoost * 0.048);
      this.leafGain.gain.setTargetAtTime(leafTarget, t, 0.25);
    }
  }

  /**
   * Master spatial environment updater called every frame from scene3d.js!
   * Smoothly blends river rapids + Minnaert water bubbles, village spring, fireplaces,
   * sauna spa, underground HVAC, landslides, 4-space reverb, & rich living micro-events!
   */
  updateEnvironment(dt, state = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    Object.assign(this._envState, state);

    if (state.acousticZone) this.setAcousticZone(state.acousticZone);

    // 1. Mountain River & Rapids Proximity (Kurosugi River + Tributaries + Minnaert Bubbles)
    const rDist = state.riverDist ?? 999;
    const rFlow = clamp(state.riverFlowBoost ?? 0, 0, 1.5);
    const rAtten = rDist < 260 ? (1.0 / (1.0 + Math.pow(Math.max(0, rDist - 8) / 28.0, 1.55))) : 0.0;
    const occFactor = 0.20 + 0.80 * this._lastOpenness;
    if (this.riverGain) {
      const rTarget = rAtten * occFactor * (0.19 + rFlow * 0.16);
      this.riverGain.gain.setTargetAtTime(rTarget, t, 0.18);
      if (this.riverMidFilter) {
        this.riverMidFilter.frequency.setTargetAtTime(860 + rAtten * 520 + rFlow * 340, t, 0.22);
      }
      if (this.riverBubbleGain) {
        this.riverBubbleGain.gain.setTargetAtTime(rAtten * rAtten * occFactor * 0.135, t, 0.18);
      }
    }

    // 2. Village Bamboo Spring Well / B3F Hydrotherapy Trickle
    const sDist = state.springDist ?? 999;
    const sAtten = sDist < 36 ? (1.0 / (1.0 + Math.pow(sDist / 6.5, 1.8))) : 0.0;
    const spaWater = state.inSpa ? 0.42 : 0.0;
    if (this.springGain) {
      this.springGain.gain.setTargetAtTime(Math.max(sAtten * 0.24, spaWater * 0.14), t, 0.22);
    }

    // 3. Fireplace & Irori Hearth Crackle
    const fDist = state.fireDist ?? 999;
    const fAtten = fDist < 18 ? (1.0 / (1.0 + Math.pow(fDist / 3.4, 1.7))) : 0.0;
    if (this.fireCrackleGain && this.fireRumbleGain) {
      this.fireCrackleGain.gain.setTargetAtTime(fAtten * 0.22, t, 0.18);
      this.fireRumbleGain.gain.setTargetAtTime(fAtten * 0.10, t, 0.18);
    }

    // 4. B3F Finnish Sauna Warmth & Steam Room Tone
    if (this.spaGain) {
      this.spaGain.gain.setTargetAtTime(state.inSpa ? 0.048 : 0.0, t, 0.30);
    }

    // 5. Underground B2F–B4F & SILO-40 Architectural Ventilation Hum
    if (this.hvacGain && this.hvacFilter) {
      const uGain = state.inSiloCavern ? 0.068 : (state.inUnderground ? 0.040 : 0.0);
      this.hvacGain.gain.setTargetAtTime(uGain, t, 0.35);
      this.hvacFilter.frequency.setTargetAtTime(state.inSiloCavern ? 72 : 108, t, 0.35);
    }

    // 6. Active Storm Landslide Rockfall Rumble
    const lsNear = state.landslideNear ?? 0;
    if (lsNear > 0.15 && t - this._lastLandslideTime > 2.2) {
      this._lastLandslideTime = t;
      this.playLandslideRumble(lsNear);
    }

    const altASL = state.altitudeASL ?? 320;
    const shrineDist = state.shrineDist ?? 999;
    const compoundDist = state.compoundDist ?? 999;

    // 7. Living Japanese Forest Wildlife Ecosystem (Organic, Rare, Strictly Zero High-Pitched Beeps!)
    if (this._lastOpenness > 0.42 && this._lastStormIntensity < 0.25 && !state.inUnderground && !state.inSiloCavern) {
      this._wildlifeTimer -= dt;
      if (this._wildlifeTimer <= 0) {
        this._wildlifeTimer = randRange(8.5, 19.5);
        const pan = randRange(-0.82, 0.82);
        if (state.isNight) {
          const r = Math.random();
          if (rDist < 55 && r < 0.34) this.playFrogChorus(pan);
          else if (r < 0.62) this.playOwlHoot(pan);
          else if (r < 0.80) this.playDeerBark(pan);
          else this.playBambooRustle(pan);
        } else {
          const r = Math.random();
          if (rDist < 38 && r < 0.22) this.playKingfisherDive(pan);
          else if (rDist < 42 && r < 0.34) this.playWaterFishJump(pan);
          else if (r < 0.48) this.playBirdCall('uguisu', pan);
          else if (r < 0.62) this.playCuckooCall(pan);
          else if (r < 0.74) this.playBirdCall('mountain_hawk', pan);
          else if (r < 0.84) this.playWoodpecker(pan);
          else if (r < 0.93) this.playCrowCaw(pan);
          else this.playBambooRustle(pan);
        }
      }
    }

    // 8. Living Environmental Micro-Events (Alpine Gusts, Bridges, Pinecones, Tree Creaks, Furin, Shrine)
    if (this._lastOpenness > 0.35 && !state.inUnderground && !state.inSiloCavern) {
      this._ambientEventTimer -= dt;
      if (this._ambientEventTimer <= 0) {
        this._ambientEventTimer = randRange(9.0, 18.0);
        const pan = randRange(-0.78, 0.78);
        if (state.onBridge && (this._lastStormIntensity > 0.15 || altASL > 420)) {
          this.playBridgeCableHum(0.45 + this._lastStormIntensity * 0.55);
        } else if (altASL > 920) {
          if (Math.random() < 0.55) this.playSnowBlizzardWhip(0.55 + this._lastStormIntensity * 0.45);
          else this.playWindGustHowl(0.65 + this._lastStormIntensity * 0.45, pan);
        } else if (shrineDist < 34 && Math.random() < 0.50) {
          this.playShrineBellSuzu(pan, clamp(1 - shrineDist / 34, 0.25, 0.95));
        } else if ((compoundDist < 28 || sDist < 42) && Math.random() < 0.45) {
          this.playWindChimeFurin(pan, 0.55);
        } else if (rDist < 28 && Math.random() < 0.45) {
          if (Math.random() < 0.6) this.playStreamPebbleRoll(pan, 0.6);
          else this.playDistantWaterfallSurge(0.45, pan);
        } else {
          const r = Math.random();
          if (r < 0.28) this.playTreeCreakWind(pan, 0.55 + this._lastStormIntensity * 0.4);
          else if (r < 0.54) this.playBranchSnap(pan, 0.55);
          else if (r < 0.78) this.playPineconeDrop(pan);
          else this.playWindGustHowl(0.45 + this._lastStormIntensity * 0.5, pan);
        }
      }
    }

    // 9. Authentic Suginosato Bamboo Shishi-Odoshi Water Cycle
    if (sDist < 42 && !state.inUnderground) {
      this._shishiTimer -= dt;
      if (this._shishiTimer <= 0) {
        this._shishiTimer = randRange(15.0, 23.0);
        this.playShishiOdoshi(randRange(-0.4, 0.4), clamp(1.0 - sDist / 42, 0.2, 0.95));
      }
    }

    // 10. Storm Micro-Texture Events (Leaf Drizzle, Metal/Timber Hail Patter, Distant Valley Rumble, Eave Drips)
    if (this._lastStormIntensity > 0.18 && !state.inUnderground && !state.inSiloCavern) {
      this._stormMicroTimer -= dt;
      if (this._stormMicroTimer <= 0) {
        this._stormMicroTimer = randRange(2.8, 6.2);
        if (this._lastOpenness > 0.65) {
          if (this._lastStormIntensity > 0.68 && Math.random() < 0.42) {
            this.playHailPatter('timber', this._lastStormIntensity);
          } else if (Math.random() < 0.65) {
            this.playRainDrizzleLeaves(this._lastStormIntensity);
          } else {
            this.playDistantStormRumble(this._lastStormIntensity * 0.75);
          }
        } else {
          if (this._lastStormIntensity > 0.62 && Math.random() < 0.45) {
            this.playHailPatter(state.roofKind || 'metal', this._lastStormIntensity * 0.85);
          } else {
            this.playGlassRainDrip(randRange(-0.65, 0.65));
          }
        }
      }
    }

    // 11. Living Traditional Interior & Underground Micro-Events
    if (this._lastOpenness < 0.45) {
      this._interiorTimer -= dt;
      if (this._interiorTimer <= 0) {
        this._interiorTimer = randRange(11.0, 22.0);
        const pan = randRange(-0.65, 0.65);
        if (state.inSpa) {
          this.playSpaWaterLadle(pan);
        } else if (state.inUnderground && !state.inSiloCavern) {
          this.playGeneratorThrob(0.55);
        } else if (fDist < 10) {
          this.playKettleSimmer(clamp(1.0 - fDist / 10, 0.25, 0.95));
        } else if (this._lastAcousticZone === 'wood_room') {
          if (Math.random() < 0.68) this.playInteriorTimberSettle(pan);
          else this.playInteriorTatamiCreak(pan);
        }
      }
    }
  }

  // =========================================================================
  // CATEGORY A: MATERIAL-AWARE FOOTSTEPS & PLAYER FOLEY (24 SFX across 16 surfaces!)
  // =========================================================================

  playFootstep(surface = 'wood', opts = {}) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;

    // Delegate the 6 V4 hyper-realistic outdoor biome surfaces
    if (surface === 'snow') return this.playFootstepSnow(opts);
    if (surface === 'mud') return this.playFootstepMud(opts);
    if (surface === 'leaves') return this.playFootstepLeaves(opts);
    if (surface === 'moss') return this.playFootstepMoss(opts);
    if (surface === 'asphalt') return this.playFootstepAsphalt(opts);
    if (surface === 'sand') return this.playFootstepSand(opts);

    const t = this.ctx.currentTime;
    const sprint = Boolean(opts.sprint);
    const crouch = Boolean(opts.crouch);
    const velScale = crouch ? 0.56 : (sprint ? 1.32 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.14;
    const pitchJitter = randRange(0.90, 1.12);

    if (surface === 'water') {
      // Upgraded mountain stream wade: rushing surge + Minnaert bubble droplets + trailing drips
      const spl = this.ctx.createBufferSource();
      spl.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1240 * pitchJitter, t);
      bp.frequency.exponentialRampToValueAtTime(420, t + 0.26);
      bp.Q.value = 1.05;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.145 * velScale, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.28);
      spl.connect(bp); bp.connect(g);
      this._connectSfx(g, pan, 0.24, 'valley');
      spl.start(t, randRange(0, 2.2), 0.30);

      playGranularScatter(this, {
        buffer: this.dropletBuf || this.crackleBuf,
        startTime: t + 0.03,
        count: sprint ? 9 : 6, spreadSec: 0.19,
        grainDurLo: 0.016, grainDurHi: 0.042,
        freqLo: 680, freqHi: 2500,
        gain: 0.068 * velScale, pan, panSpread: 0.26, reverb: 0.24, space: 'valley',
      });
      return;
    }

    if (surface === 'bridge') {
      // Upgraded hollow resonant steel/asphalt bridge deck: modal girder thump + toe-roll tarmac grit
      playModalBody(this, [
        [88, 0.15, 0.72, 8],
        [182, 0.12, 0.55, 12],
        [465, 0.075, 0.42, 16],
        [1180, 0.04, 0.26, 20],
      ], {
        startTime: t, gain: 0.135 * velScale, pan, reverb: 0.30, space: 'valley',
        strikerDur: 0.007, strikerHz: 3200, ringMix: 0.24, pitchMul: pitchJitter,
      });
      playGranularScatter(this, {
        buffer: this.gritBuf || this.pinkBuf,
        startTime: t + 0.052,
        count: 4, spreadSec: 0.04,
        grainDurLo: 0.010, grainDurHi: 0.024,
        freqLo: 1100, freqHi: 3200,
        gain: 0.044 * velScale, pan, panSpread: 0.10, reverb: 0.22, space: 'valley',
      });
      return;
    }

    if (surface === 'metal') {
      // Upgraded steel grating / titanium ramp: authentic 5-mode metallic plate resonance + boot sole tap
      playModalBody(this, [
        [245, 0.14, 0.65, 16],
        [592, 0.11, 0.58, 22],
        [1240, 0.08, 0.46, 26],
        [2380, 0.05, 0.30, 30],
        [4120, 0.03, 0.18, 32],
      ], {
        startTime: t, gain: 0.105 * velScale, pan, reverb: 0.36,
        strikerDur: 0.005, strikerHz: 5400, ringMix: 0.30, pitchMul: pitchJitter,
      });
      return;
    }

    if (surface === 'gravel') {
      // Upgraded 9-grain crushed forestry gravel crunch (heel press + rolling pebble scatter)
      playGranularScatter(this, {
        buffer: this.gritBuf || this.crackleBuf,
        startTime: t,
        count: sprint ? 11 : 8, spreadSec: 0.125,
        grainDurLo: 0.010, grainDurHi: 0.028,
        freqLo: 1200, freqHi: 4800,
        qLo: 1.2, qHi: 3.4,
        gain: 0.088 * velScale, pan, panSpread: 0.20, reverb: 0.18, space: 'valley',
      });
      const lo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lo.type = 'sine';
      lo.frequency.setValueAtTime(104 * pitchJitter, t);
      lo.frequency.exponentialRampToValueAtTime(38, t + 0.075);
      lg.gain.setValueAtTime(0.068 * velScale, t);
      lg.gain.exponentialRampToValueAtTime(0.0005, t + 0.085);
      lo.connect(lg);
      this._connectSfx(lg, pan, 0.14, 'valley');
      lo.start(t); lo.stop(t + 0.095);
      return;
    }

    if (surface === 'grass') {
      // Brushing meadow grass / susuki blades + soft cushioned loam pad
      const swish = this.ctx.createBufferSource();
      swish.buffer = this.pinkBuf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(2600 * pitchJitter, t);
      hp.frequency.linearRampToValueAtTime(1600, t + 0.14);
      hp.Q.value = 1.1;
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.001, t);
      sg.gain.linearRampToValueAtTime(0.085 * velScale, t + 0.025);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      swish.connect(hp); hp.connect(sg);
      this._connectSfx(sg, pan, 0.12);
      swish.start(t, randRange(0, 3.0), 0.18);

      const pad = this.ctx.createBufferSource();
      pad.buffer = this.brownBuf;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 310;
      const pg = this.ctx.createGain();
      pg.gain.setValueAtTime(0.08 * velScale, t);
      pg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      pad.connect(lp); lp.connect(pg);
      this._connectSfx(pg, pan, 0.10);
      pad.start(t, randRange(0, 3.0), 0.11);
      return;
    }

    if (surface === 'wet_stone') {
      // Wet granite bath / sauna / shoreline step: crisp stone tap + wet sheen squelch
      const tap = this.ctx.createBufferSource();
      tap.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1620 * pitchJitter;
      bp.Q.value = 2.8;
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.095 * velScale, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.068);
      tap.connect(bp); bp.connect(tg);
      this._connectSfx(tg, pan, 0.42);
      tap.start(t, randRange(0, 2.3), 0.09);

      const wet = this.ctx.createBufferSource();
      wet.buffer = this.crackleBuf;
      const wbp = this.ctx.createBiquadFilter();
      wbp.type = 'bandpass';
      wbp.frequency.value = 3400 * pitchJitter;
      wbp.Q.value = 1.6;
      const wg = this.ctx.createGain();
      wg.gain.setValueAtTime(0.065 * velScale, t + 0.012);
      wg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      wet.connect(wbp); wbp.connect(wg);
      this._connectSfx(wg, pan, 0.36);
      wet.start(t + 0.012, randRange(0, 2.3), 0.12);
      return;
    }

    if (surface === 'tile') {
      // Crisp stone / terrazzo / granite heel-toe tap with subtle modal ceramic resonance
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1320 * pitchJitter;
      bp.Q.value = 2.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.11 * velScale, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      src.connect(bp); bp.connect(g);
      this._connectSfx(g, pan, 0.34);
      src.start(t, randRange(0, 3.0), 0.085);

      const body = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(165 * pitchJitter, t);
      body.frequency.exponentialRampToValueAtTime(72, t + 0.045);
      bg.gain.setValueAtTime(0.055 * velScale, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
      body.connect(bg);
      this._connectSfx(bg, pan, 0.25);
      body.start(t); body.stop(t + 0.06);
      return;
    }

    if (surface === 'tatami') {
      // Soft woven igusa rush straw rustle + cushioned pad
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420 * pitchJitter;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.072 * velScale, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      src.connect(lp); lp.connect(g);
      this._connectSfx(g, pan, 0.22);
      src.start(t, randRange(0, 3.0), 0.11);

      const straw = this.ctx.createBufferSource();
      straw.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3100 * pitchJitter;
      bp.Q.value = 1.4;
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.024 * velScale, t + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      straw.connect(bp); bp.connect(sg);
      this._connectSfx(sg, pan, 0.15);
      straw.start(t + 0.01, randRange(0, 2.2), 0.09);
      return;
    }

    if (surface === 'earth') {
      // Rich cedar forest humus + fallen pine needle crunch + occasional micro twig snap
      const loam = this.ctx.createBufferSource();
      loam.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 680 * pitchJitter;
      bp.Q.value = 0.9;
      const lg = this.ctx.createGain();
      lg.gain.setValueAtTime(0.115 * velScale, t);
      lg.gain.exponentialRampToValueAtTime(0.001, t + 0.125);
      loam.connect(bp); bp.connect(lg);
      this._connectSfx(lg, pan, 0.15);
      loam.start(t, randRange(0, 3.0), 0.14);

      const needles = this.ctx.createBufferSource();
      needles.buffer = this.crackleBuf;
      const nbp = this.ctx.createBiquadFilter();
      nbp.type = 'bandpass';
      nbp.frequency.value = 2500 * pitchJitter;
      nbp.Q.value = 1.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.075 * velScale, t + 0.015);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      needles.connect(nbp); nbp.connect(ng);
      this._connectSfx(ng, pan, 0.14);
      needles.start(t + 0.015, randRange(0, 2.2), 0.12);
      return;
    }

    // Default: 'wood' — Warm hollow Japanese oak/cedar floorboard heel-toe thud + rare natural timber creak
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(132 * pitchJitter, t);
    body.frequency.exponentialRampToValueAtTime(54, t + 0.072);
    bg.gain.setValueAtTime(0.115 * velScale, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.088);
    body.connect(bg);
    this._connectSfx(bg, pan, 0.30);
    body.start(t); body.stop(t + 0.095);

    const heel = this.ctx.createBufferSource();
    heel.buffer = this.pinkBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 540 * pitchJitter;
    lp.Q.value = 1.8;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.092 * velScale, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    heel.connect(lp); lp.connect(hg);
    this._connectSfx(hg, pan, 0.28);
    heel.start(t, randRange(0, 3.0), 0.095);

    // Subtle occasional old-timber floorboard creak (max once every 4.5s)
    if (Math.random() < 0.14 && t - this._lastCreakTime > 4.5) {
      this._lastCreakTime = t;
      const crk = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      const cf = this.ctx.createBiquadFilter();
      crk.type = 'sawtooth';
      crk.frequency.setValueAtTime(randRange(180, 270), t + 0.03);
      crk.frequency.linearRampToValueAtTime(randRange(125, 175), t + 0.19);
      cf.type = 'bandpass';
      cf.frequency.value = 460;
      cf.Q.value = 4.2;
      cg.gain.setValueAtTime(0.001, t + 0.03);
      cg.gain.linearRampToValueAtTime(0.018 * velScale, t + 0.07);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      crk.connect(cf); cf.connect(cg);
      this._connectSfx(cg, pan, 0.34);
      crk.start(t + 0.03); crk.stop(t + 0.22);
    }
  }

  playStairStep(material = 'wood', ascending = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    this.playFootstep(material, { sprint: false });
    // Add hollow stair-stringer resonance
    const res = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    res.type = 'triangle';
    const base = material === 'metal' ? 210 : (material === 'tile' ? 145 : 108);
    res.frequency.setValueAtTime(base * (ascending ? 1.08 : 0.94), t);
    res.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.09);
    g.gain.setValueAtTime(0.065, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    res.connect(g);
    this._connectSfx(g, 0, 0.36);
    res.start(t); res.stop(t + 0.11);
  }

  playJump(surface = 'earth') {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    this.playFootstep(surface, { sprint: true });
    // Fabric & upward air push whoosh
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(1150, t + 0.14);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.12);
    src.start(t, randRange(0, 2.8), 0.18);
  }

  playLand(surface = 'earth', impactNorm = 0.7) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const imp = clamp(impactNorm, 0.3, 1.3);
    this.playFootstep(surface, { sprint: true });
    setTimeout(() => {
      if (this.ctx && !this.muted) this.playFootstep(surface, { sprint: false });
    }, 42);
    // Low kinetic thump
    const th = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(92, t);
    th.frequency.exponentialRampToValueAtTime(34, t + 0.12);
    g.gain.setValueAtTime(0.14 * imp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    th.connect(g);
    this._connectSfx(g, 0, 0.22);
    th.start(t); th.stop(t + 0.15);
  }

  playCrouch(down = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(down ? 980 : 620, t);
    bp.frequency.linearRampToValueAtTime(down ? 520 : 1080, t + 0.16);
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.062, t + 0.035);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.14);
    src.start(t, randRange(0, 2.8), 0.20);
  }

  // =========================================================================
  // CATEGORY B: ARCHITECTURAL DOORS, HATCHES & SHUTTERS (10 SFX)
  // =========================================================================

  playDoor(kindOrIsPocket = false, isOpening = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const kind = typeof kindOrIsPocket === 'string'
      ? kindOrIsPocket
      : (kindOrIsPocket ? 'shoji' : 'wood_swing');

    if (kind === 'k11_airlock') {
      // Pressurized aerospace cabin equalization whoosh + titanium servo slide + subtle chime
      const hiss = this.ctx.createBufferSource();
      hiss.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isOpening ? 2400 : 1200, t);
      bp.frequency.exponentialRampToValueAtTime(isOpening ? 680 : 2100, t + 0.45);
      bp.Q.value = 1.8;
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.001, t);
      hg.gain.linearRampToValueAtTime(0.11, t + 0.05);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      hiss.connect(bp); bp.connect(hg);
      this._connectSfx(hg, 0, 0.34);
      hiss.start(t, randRange(0, 2.0), 0.50);

      const servo = this.ctx.createOscillator();
      const sg = this.ctx.createGain();
      servo.type = 'triangle';
      servo.frequency.setValueAtTime(isOpening ? 190 : 280, t + 0.04);
      servo.frequency.linearRampToValueAtTime(isOpening ? 290 : 175, t + 0.42);
      sg.gain.setValueAtTime(0.001, t + 0.04);
      sg.gain.linearRampToValueAtTime(0.042, t + 0.12);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
      servo.connect(sg);
      this._connectSfx(sg, 0, 0.32);
      servo.start(t + 0.04); servo.stop(t + 0.46);
      return;
    }

    if (kind === 'armor_airlock' || kind === 'airtight') {
      // Heavy steel bunker/armored bulkhead bolt clunk + gasket decompression hiss
      const bolt = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bolt.type = 'triangle';
      bolt.frequency.setValueAtTime(isOpening ? 148 : 112, t);
      bolt.frequency.exponentialRampToValueAtTime(42, t + 0.15);
      bg.gain.setValueAtTime(0.15, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      bolt.connect(bg);
      this._connectSfx(bg, 0, 0.40);
      bolt.start(t); bolt.stop(t + 0.18);

      const hiss = this.ctx.createBufferSource();
      hiss.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isOpening ? 1650 : 920, t + 0.03);
      bp.frequency.exponentialRampToValueAtTime(520, t + 0.38);
      bp.Q.value = 2.0;
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.095, t + 0.03);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
      hiss.connect(bp); bp.connect(hg);
      this._connectSfx(hg, 0, 0.35);
      hiss.start(t + 0.03, randRange(0, 2.5), 0.42);
      return;
    }

    if (kind === 'liftgate') {
      // Gas-strut hydraulic hiss + tailgate/ramp latch release
      const strut = this.ctx.createBufferSource();
      strut.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isOpening ? 980 : 640, t);
      bp.frequency.linearRampToValueAtTime(isOpening ? 1550 : 380, t + 0.42);
      bp.Q.value = 2.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
      strut.connect(bp); bp.connect(g);
      this._connectSfx(g, 0, 0.25);
      strut.start(t, randRange(0, 2.5), 0.46);
      return;
    }

    if (kind === 'vehicle') {
      // Automotive handle unlatch -> crisp weather-stripped car door slam/open
      const latch = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      latch.type = 'triangle';
      latch.frequency.setValueAtTime(isOpening ? 820 : 140, t);
      latch.frequency.exponentialRampToValueAtTime(isOpening ? 240 : 48, t + (isOpening ? 0.055 : 0.14));
      lg.gain.setValueAtTime(isOpening ? 0.08 : 0.19, t);
      lg.gain.exponentialRampToValueAtTime(0.001, t + (isOpening ? 0.065 : 0.16));
      latch.connect(lg);
      this._connectSfx(lg, 0, 0.18);
      latch.start(t); latch.stop(t + 0.18);

      const body = this.ctx.createBufferSource();
      body.buffer = this.brownBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = isOpening ? 420 : 210;
      bp.Q.value = 1.6;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(isOpening ? 0.07 : 0.15, t + 0.015);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      body.connect(bp); bp.connect(bg);
      this._connectSfx(bg, 0, 0.18);
      body.start(t + 0.015, randRange(0, 2.5), 0.20);
      return;
    }

    if (kind === 'glass') {
      // Smooth tempered glass shower/patio rail glide + crisp detent click
      const slide = this.ctx.createBufferSource();
      slide.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isOpening ? 1800 : 2200, t);
      bp.frequency.linearRampToValueAtTime(isOpening ? 2400 : 1400, t + 0.28);
      bp.Q.value = 3.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      slide.connect(bp); bp.connect(g);
      this._connectSfx(g, 0, 0.38);
      slide.start(t, randRange(0, 2.0), 0.32);
      return;
    }

    if (kind === 'shoji') {
      // Authentic Japanese wooden sliding shoji/fusuma/pocket door track glide + soft wood stop tap
      const glide = this.ctx.createBufferSource();
      glide.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isOpening ? 540 : 440, t);
      bp.frequency.linearRampToValueAtTime(isOpening ? 360 : 520, t + 0.30);
      bp.Q.value = 2.0;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.088, t + 0.045);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      glide.connect(bp); bp.connect(g);
      this._connectSfx(g, 0, 0.28);
      glide.start(t, randRange(0, 2.8), 0.34);

      // Soft wooden rail end tap
      const tap = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      tap.type = 'triangle';
      tap.frequency.setValueAtTime(220, t + 0.25);
      tap.frequency.exponentialRampToValueAtTime(95, t + 0.30);
      tg.gain.setValueAtTime(0.055, t + 0.25);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.31);
      tap.connect(tg);
      this._connectSfx(tg, 0, 0.26);
      tap.start(t + 0.25); tap.stop(t + 0.32);
      return;
    }

    // Default: 'wood_swing' — Brass handle latch click + solid oak door panel resonance
    const latch = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    latch.type = 'triangle';
    latch.frequency.setValueAtTime(isOpening ? 1120 : 680, t);
    latch.frequency.exponentialRampToValueAtTime(280, t + 0.035);
    lg.gain.setValueAtTime(0.055, t);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
    latch.connect(lg);
    this._connectSfx(lg, 0, 0.24);
    latch.start(t); latch.stop(t + 0.048);

    const swing = this.ctx.createBufferSource();
    swing.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isOpening ? 290 : 380, t + 0.02);
    bp.frequency.linearRampToValueAtTime(isOpening ? 440 : 195, t + 0.26);
    bp.Q.value = 3.2;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.082, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    swing.connect(bp); bp.connect(sg);
    this._connectSfx(sg, 0, 0.30);
    swing.start(t + 0.02, randRange(0, 2.8), 0.30);

    if (!isOpening) {
      // Satisfying closed door frame thud
      const thud = this.ctx.createOscillator();
      const thg = this.ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(115, t + 0.22);
      thud.frequency.exponentialRampToValueAtTime(42, t + 0.32);
      thg.gain.setValueAtTime(0.11, t + 0.22);
      thg.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      thud.connect(thg);
      this._connectSfx(thg, 0, 0.28);
      thud.start(t + 0.22); thud.stop(t + 0.35);
    }
  }

  playShutterClank(closing = true, kind = 'garage_rollup') {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const isArmor = kind === 'armor_shutter';

    // Corrugated steel slat / armored louver motorized clatter
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(closing ? (isArmor ? 420 : 340) : (isArmor ? 540 : 480), t);
    bp.frequency.linearRampToValueAtTime(closing ? 165 : 640, t + (isArmor ? 0.38 : 0.65));
    bp.Q.value = isArmor ? 4.4 : 2.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(isArmor ? 0.14 : 0.125, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isArmor ? 0.42 : 0.68));
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.42);
    src.start(t, randRange(0, 2.2), 0.72);

    // Metallic chain/lock clank impulse
    const clank = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clank.type = 'sawtooth';
    const clankT = closing ? (isArmor ? 0.32 : 0.52) : 0.02;
    clank.frequency.setValueAtTime(isArmor ? 240 : 180, t + clankT);
    clank.frequency.exponentialRampToValueAtTime(52, t + clankT + 0.12);
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 620;
    cg.gain.setValueAtTime(0.11, t + clankT);
    cg.gain.exponentialRampToValueAtTime(0.001, t + clankT + 0.14);
    clank.connect(lpf); lpf.connect(cg);
    this._connectSfx(cg, 0, 0.40);
    clank.start(t + clankT); clank.stop(t + clankT + 0.15);
  }

  playTowHitch(coupled = true) {
    if (!this.ctx || this.muted || !this.whiteBuf) return;
    const t = this.ctx.currentTime;
    // Heavy forged-steel pintle hitch drop + locking pin slam + safety chain clink
    const hit = this.ctx.createOscillator();
    const hg = this.ctx.createGain();
    hit.type = 'triangle';
    hit.frequency.setValueAtTime(coupled ? 185 : 230, t);
    hit.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    hg.gain.setValueAtTime(0.18, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    hit.connect(hg);
    this._connectSfx(hg, 0, 0.30);
    hit.start(t); hit.stop(t + 0.22);

    // Metallic chain clink overtones
    [0.08, 0.15, 0.21].forEach((d, idx) => {
      const ch = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      ch.type = 'square';
      ch.frequency.setValueAtTime(1450 + idx * 380, t + d);
      ch.frequency.exponentialRampToValueAtTime(620, t + d + 0.045);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2100;
      bp.Q.value = 4.0;
      cg.gain.setValueAtTime(0.045, t + d);
      cg.gain.exponentialRampToValueAtTime(0.001, t + d + 0.05);
      ch.connect(bp); bp.connect(cg);
      this._connectSfx(cg, 0, 0.28);
      ch.start(t + d); ch.stop(t + d + 0.055);
    });
  }

  // =========================================================================
  // CATEGORY C: INTERACTIVE PROPS, LAMPS, SAUNA, HEARTH & LAB (10 SFX)
  // =========================================================================

  playClick(high = true, kind = 'flashlight') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (kind === 'washi_lantern') {
      // Delicate pull-cord & soft paper rustle
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1850;
      bp.Q.value = 1.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      src.connect(bp); bp.connect(g);
      this._connectSfx(g, 0, 0.22);
      src.start(t, randRange(0, 2.5), 0.11);
      return;
    }
    if (kind === 'headlight') {
      // Automotive dashboard stalk click + crisp relay tick
      [0, 0.024].forEach((d, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(i === 0 ? (high ? 1280 : 880) : 2100, t + d);
        o.frequency.exponentialRampToValueAtTime(240, t + d + 0.022);
        g.gain.setValueAtTime(i === 0 ? 0.07 : 0.045, t + d);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.026);
        o.connect(g);
        this._connectSfx(g, 0, 0.12);
        o.start(t + d); o.stop(t + d + 0.03);
      });
      return;
    }

    // Crisp dual-stage mechanical switch (flashlight / brass desk lamp)
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(high ? 1580 : 820, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.026);
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
    osc.connect(g);
    this._connectSfx(g, 0, 0.18);
    osc.start(t); osc.stop(t + 0.036);

    // Secondary tactile detent click
    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(high ? 2250 : 1200, t + 0.018);
    osc2.frequency.exponentialRampToValueAtTime(420, t + 0.036);
    g2.gain.setValueAtTime(0.04, t + 0.018);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.040);
    osc2.connect(g2);
    this._connectSfx(g2, 0, 0.16);
    osc2.start(t + 0.018); osc2.stop(t + 0.045);
  }

  playFireplaceToggle(isOn = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = isOn ? this.pinkBuf : this.whiteBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isOn ? 320 : 1650, t);
    bp.frequency.exponentialRampToValueAtTime(isOn ? 920 : 540, t + 0.45);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(isOn ? 0.15 : 0.095, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.30);
    src.start(t, randRange(0, 2.0), 0.58);
  }

  playSaunaLoyly(isPrivate = false) {
    if (!this.ctx || this.muted || !this.whiteBuf) return;
    const t = this.ctx.currentTime;
    // 1. Water ladle splash onto 320kg glowing olivine sauna stones
    const pour = this.ctx.createBufferSource();
    pour.buffer = this.crackleBuf;
    const pbp = this.ctx.createBiquadFilter();
    pbp.type = 'bandpass';
    pbp.frequency.value = 1400;
    pbp.Q.value = 1.5;
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.001, t);
    pg.gain.linearRampToValueAtTime(0.11, t + 0.06);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    pour.connect(pbp); pbp.connect(pg);
    this._connectSfx(pg, 0, 0.52);
    pour.start(t, randRange(0, 2.0), 0.36);

    // 2. Explosive sizzling aromatic steam cloud hiss ("ジュワァァァ…")
    const steam = this.ctx.createBufferSource();
    steam.buffer = this.whiteBuf;
    const sbp = this.ctx.createBiquadFilter();
    sbp.type = 'bandpass';
    sbp.frequency.setValueAtTime(isPrivate ? 3200 : 3800, t + 0.08);
    sbp.frequency.exponentialRampToValueAtTime(1150, t + 2.35);
    sbp.Q.value = 0.72;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.001, t + 0.08);
    sg.gain.linearRampToValueAtTime(isPrivate ? 0.16 : 0.21, t + 0.22);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 2.55);
    steam.connect(sbp); sbp.connect(sg);
    this._connectSfx(sg, 0, 0.62);
    steam.start(t + 0.08, randRange(0, 0.3), 2.60);
  }

  playThermalConsole(highMode = true) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    // Heavy 5-channel relay breaker clunk + geothermal circulation spool
    const brk = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    brk.type = 'triangle';
    brk.frequency.setValueAtTime(highMode ? 240 : 180, t);
    brk.frequency.exponentialRampToValueAtTime(52, t + 0.10);
    bg.gain.setValueAtTime(0.13, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    brk.connect(bg);
    this._connectSfx(bg, 0, 0.36);
    brk.start(t); brk.stop(t + 0.13);

    const turbine = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    turbine.type = 'sine';
    turbine.frequency.setValueAtTime(highMode ? 88 : 195, t + 0.06);
    turbine.frequency.exponentialRampToValueAtTime(highMode ? 195 : 82, t + 0.72);
    tg.gain.setValueAtTime(0.001, t + 0.06);
    tg.gain.linearRampToValueAtTime(0.065, t + 0.22);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.78);
    turbine.connect(tg);
    this._connectSfx(tg, 0, 0.42);
    turbine.start(t + 0.06); turbine.stop(t + 0.80);
  }

  playCoolingPlenum(boost = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(boost ? 480 : 1150, t);
    bp.frequency.exponentialRampToValueAtTime(boost ? 1280 : 420, t + 0.58);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.35);
    src.start(t, randRange(0, 2.5), 0.68);
  }

  playLabUvMode(covertOn = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // High-voltage ballast relay snap + ultraviolet harmonic sweep
    this.playClick(covertOn, 'headlight');
    const hum = this.ctx.createOscillator();
    const hum2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    hum.type = 'sawtooth';
    hum2.type = 'sine';
    hum.frequency.setValueAtTime(covertOn ? 120 : 240, t + 0.03);
    hum.frequency.exponentialRampToValueAtTime(covertOn ? 240 : 95, t + 0.55);
    hum2.frequency.setValueAtTime(covertOn ? 360 : 480, t + 0.03);
    hum2.frequency.exponentialRampToValueAtTime(covertOn ? 540 : 220, t + 0.55);
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 720;
    g.gain.setValueAtTime(0.001, t + 0.03);
    g.gain.linearRampToValueAtTime(0.07, t + 0.10);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    hum.connect(lpf); hum2.connect(lpf); lpf.connect(g);
    this._connectSfx(g, 0, 0.45);
    hum.start(t + 0.03); hum2.start(t + 0.03);
    hum.stop(t + 0.65); hum2.stop(t + 0.65);
  }

  playLabContainment(overdrive = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Deep magnetic core resonance ramp + harmonic crystalline field pulse
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(overdrive ? 48 : 112, t);
    sub.frequency.exponentialRampToValueAtTime(overdrive ? 124 : 44, t + 0.95);
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime(0.15, t + 0.18);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
    sub.connect(sg);
    this._connectSfx(sg, 0, 0.52);
    sub.start(t); sub.stop(t + 1.08);

    [261.6, 392.0, 523.25].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(overdrive ? f : f * 1.25, t + idx * 0.07);
      o.frequency.exponentialRampToValueAtTime(overdrive ? f * 1.35 : f * 0.78, t + 0.85);
      g.gain.setValueAtTime(0.001, t + idx * 0.07);
      g.gain.linearRampToValueAtTime(0.036, t + idx * 0.07 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.92);
      o.connect(g);
      this._connectSfx(g, 0, 0.56);
      o.start(t + idx * 0.07); o.stop(t + 0.95);
    });
  }

  // =========================================================================
  // CATEGORY D: 3 ELEVATORS, SILO-40 HANGAR & AVIONICS (9 SFX)
  // =========================================================================

  playElevatorButton() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Crisp stainless push-switch click + soft warm chime confirmation
    const click = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1650, t);
    click.frequency.exponentialRampToValueAtTime(340, t + 0.018);
    cg.gain.setValueAtTime(0.055, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
    click.connect(cg);
    this._connectSfx(cg, 0, 0.22);
    click.start(t); click.stop(t + 0.025);

    const tone = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(1046.5, t + 0.012);
    tg.gain.setValueAtTime(0.042, t + 0.012);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    tone.connect(tg);
    this._connectSfx(tg, 0, 0.28);
    tone.start(t + 0.012); tone.stop(t + 0.11);
  }

  playElevatorBrake(engaging = false) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(engaging ? 94 : 118, t);
    body.frequency.exponentialRampToValueAtTime(32, t + 0.16);
    bg.gain.setValueAtTime(0.13, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    body.connect(bg);
    this._connectSfx(bg, 0, 0.44);
    body.start(t); body.stop(t + 0.20);

    const clack = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clack.type = 'sawtooth';
    clack.frequency.setValueAtTime(engaging ? 420 : 590, t);
    clack.frequency.exponentialRampToValueAtTime(135, t + 0.04);
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 950;
    cg.gain.setValueAtTime(0.045, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.048);
    clack.connect(lpf); lpf.connect(cg);
    this._connectSfx(cg, 0, 0.36);
    clack.start(t); clack.stop(t + 0.055);
  }

  playElevatorSafetyBeep() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Warm melodic double-tone door safety cue (pleasant, never jarring!)
    [0, 0.14].forEach((delay, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 880 : 1174.66, t + delay);
      g.gain.setValueAtTime(0.001, t + delay);
      g.gain.linearRampToValueAtTime(0.048, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.11);
      osc.connect(g);
      this._connectSfx(g, 0, 0.32);
      osc.start(t + delay); osc.stop(t + delay + 0.12);
    });
  }

  playElevatorDoor(isOpening = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Fixed legacy bug (was `this.noiseBuf`!) + added crisp steel interlock latch!
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(isOpening ? 320 : 540, t);
    filt.frequency.linearRampToValueAtTime(isOpening ? 560 : 255, t + 0.95);
    filt.Q.value = 3.6;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.068, t + 0.10);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
    src.connect(filt); filt.connect(g);
    this._connectSfx(g, 0, 0.40);
    src.start(t, randRange(0, 2.0), 1.10);

    // Interlock roller latch click
    const latch = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    latch.type = 'triangle';
    const lt = isOpening ? 0.02 : 0.88;
    latch.frequency.setValueAtTime(isOpening ? 520 : 340, t + lt);
    latch.frequency.exponentialRampToValueAtTime(120, t + lt + 0.055);
    lg.gain.setValueAtTime(0.065, t + lt);
    lg.gain.exponentialRampToValueAtTime(0.001, t + lt + 0.065);
    latch.connect(lg);
    this._connectSfx(lg, 0, 0.36);
    latch.start(t + lt); latch.stop(t + lt + 0.075);
  }

  playElevatorChime(dir = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Authentic resonant Japanese bronze tubular-bell arrival chime (UP: G5->C6, DOWN: A5->E5)
    const notes = dir >= 0
      ? [[783.99, 0.0, 0.45], [1046.5, 0.24, 0.88]]
      : [[880.0, 0.0, 0.45], [659.25, 0.26, 0.92]];
    notes.forEach(([freq, delay, dur]) => {
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);
      osc2.frequency.setValueAtTime(freq * 2.0, t + delay);
      osc3.frequency.setValueAtTime(freq * 3.01, t + delay);
      g.gain.setValueAtTime(0.001, t + delay);
      g.gain.linearRampToValueAtTime(0.088, t + delay + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + delay + dur);
      const g2 = this.ctx.createGain(); g2.gain.value = 0.22;
      const g3 = this.ctx.createGain(); g3.gain.value = 0.07;
      osc.connect(g);
      osc2.connect(g2); g2.connect(g);
      osc3.connect(g3); g3.connect(g);
      this._connectSfx(g, 0, 0.48);
      osc.start(t + delay); osc2.start(t + delay); osc3.start(t + delay);
      osc.stop(t + delay + dur + 0.04);
      osc2.stop(t + delay + dur + 0.04);
      osc3.stop(t + delay + dur + 0.04);
    });
  }

  updateElevatorMotor(moving, speedNorm = 0) {
    if (!this.ctx) return;
    if (!this.elvNodes) {
      const hum = this.ctx.createOscillator();
      hum.type = 'triangle';
      hum.frequency.value = 74;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 240;
      const humG = this.ctx.createGain();
      humG.gain.value = 0.0;
      hum.connect(filt); filt.connect(humG); humG.connect(this.sfxBus);
      hum.start();

      // Subtle VVVF inverter harmonic sweep
      const pwm = this.ctx.createOscillator();
      pwm.type = 'sine';
      pwm.frequency.value = 320;
      const pwmG = this.ctx.createGain();
      pwmG.gain.value = 0.0;
      pwm.connect(pwmG); pwmG.connect(this.sfxBus);
      pwm.start();

      // Express shaft cable/air rush
      const air = this.ctx.createBufferSource();
      air.buffer = this.pinkBuf;
      air.loop = true;
      const airF = this.ctx.createBiquadFilter();
      airF.type = 'bandpass';
      airF.frequency.value = 460;
      airF.Q.value = 1.1;
      const airG = this.ctx.createGain();
      airG.gain.value = 0.0;
      air.connect(airF); airF.connect(airG); airG.connect(this.sfxBus);
      air.start();

      this.elvNodes = { hum, filt, humG, pwm, pwmG, airF, airG };
    }
    const t = this.ctx.currentTime;
    const s = clamp(speedNorm, 0, 1);
    const active = moving && !this.muted;
    this.elvNodes.humG.gain.setTargetAtTime(active ? (0.018 + s * 0.040) : 0.0, t, 0.10);
    this.elvNodes.hum.frequency.setTargetAtTime(66 + s * 116, t, 0.08);
    this.elvNodes.filt.frequency.setTargetAtTime(185 + s * 360, t, 0.08);
    this.elvNodes.pwmG.gain.setTargetAtTime(active ? (0.003 + s * 0.010) : 0.0, t, 0.10);
    this.elvNodes.pwm.frequency.setTargetAtTime(320 + s * 680, t, 0.08);
    this.elvNodes.airG.gain.setTargetAtTime(active ? (s * 0.055) : 0.0, t, 0.12);
    this.elvNodes.airF.frequency.setTargetAtTime(340 + s * 640, t, 0.12);
  }

  playSiloHydraulic(stage = 'unlock') {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    // Deep cavernous 40m hydraulic mecha ram + 44-plate blast roof lock clank + steam vent
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sawtooth';
    const f0 = stage === 'surface_lock' ? 96 : (stage === 'roof_open' ? 68 : 82);
    sub.frequency.setValueAtTime(f0, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.72);
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 185;
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime(0.16, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.78);
    sub.connect(lpf); lpf.connect(sg);
    this._connectSfx(sg, 0, 0.65);
    sub.start(t); sub.stop(t + 0.82);

    // Pressurized pneumatic blast-plate vent hiss
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(stage === 'roof_open' ? 760 : 460, t);
    bp.frequency.linearRampToValueAtTime(220, t + 0.85);
    bp.Q.value = 2.0;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.11, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.90);
    hiss.connect(bp); bp.connect(ng);
    this._connectSfx(ng, 0, 0.58);
    hiss.start(t, randRange(0, 2.0), 0.95);

    // Aerospace confirmation chime on unlock / surface lock
    if (stage === 'unlock' || stage === 'surface_lock') {
      const notes = stage === 'unlock' ? [523.25, 659.25, 783.99] : [783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const og = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.14);
        og.gain.setValueAtTime(0.06, t + idx * 0.14);
        og.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.14 + 0.34);
        osc.connect(og);
        this._connectSfx(og, 0, 0.55);
        osc.start(t + idx * 0.14); osc.stop(t + idx * 0.14 + 0.36);
      });
    }
  }

  playRefuelSound() {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // 1. Aerospace pressurized coupling click
    this.playClick(true, 'headlight');
    // 2. Surging hyper-fuel liquid flow through pressurized hose
    const flow = this.ctx.createBufferSource();
    flow.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, t + 0.06);
    bp.frequency.linearRampToValueAtTime(1280, t + 0.65);
    bp.Q.value = 1.6;
    const fg = this.ctx.createGain();
    fg.gain.setValueAtTime(0.001, t + 0.06);
    fg.gain.linearRampToValueAtTime(0.095, t + 0.16);
    fg.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
    flow.connect(bp); bp.connect(fg);
    this._connectSfx(fg, 0, 0.32);
    flow.start(t + 0.06, randRange(0, 2.0), 0.75);

    // 3. Tank-full confirmation chord
    [587.33, 880.0, 1174.66].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + 0.38 + idx * 0.09);
      g.gain.setValueAtTime(0.068, t + 0.38 + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38 + idx * 0.09 + 0.30);
      osc.connect(g);
      this._connectSfx(g, 0, 0.42);
      osc.start(t + 0.38 + idx * 0.09); osc.stop(t + 0.38 + idx * 0.09 + 0.32);
    });
  }

  playAutopilotCue(event = 'engage') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const seqs = {
      engage: [[523.25, 0.0, 0.14], [783.99, 0.10, 0.22]],
      disengage: [[659.25, 0.0, 0.14], [440.0, 0.10, 0.20]],
      summon: [[587.33, 0.0, 0.12], [783.99, 0.09, 0.14], [1046.5, 0.19, 0.28]],
      arrived: [[659.25, 0.0, 0.16], [783.99, 0.12, 0.18], [1046.5, 0.25, 0.40]],
      error: [[311.13, 0.0, 0.14], [261.63, 0.12, 0.22]],
    };
    const notes = seqs[event] || seqs.engage;
    notes.forEach(([freq, delay, dur]) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + delay);
      g.gain.setValueAtTime(0.001, t + delay);
      g.gain.linearRampToValueAtTime(0.058, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      o.connect(g);
      g.connect(this.uiBus);
      o.start(t + delay); o.stop(t + delay + dur + 0.02);
    });
  }

  // =========================================================================
  // CATEGORY E: VEHICLES, TIRES, BRIDGES, COLLISIONS & K-11 FLIGHT (15 SFX)
  // =========================================================================

  playEngineStart(profile = 'diesel') {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;

    if (profile === 'k11') {
      // K-11 Coaxial Ducted-Fan Turbine Spool-Up + Avionics Ready Hum
      const turb = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      turb.type = 'sine';
      turb.frequency.setValueAtTime(95, t);
      turb.frequency.exponentialRampToValueAtTime(340, t + 1.15);
      tg.gain.setValueAtTime(0.001, t);
      tg.gain.linearRampToValueAtTime(0.068, t + 0.45);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
      turb.connect(tg);
      this._connectSfx(tg, 0, 0.40);
      turb.start(t); turb.stop(t + 1.28);

      const whoosh = this.ctx.createBufferSource();
      whoosh.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(220, t);
      bp.frequency.exponentialRampToValueAtTime(780, t + 1.0);
      bp.Q.value = 1.5;
      const wg = this.ctx.createGain();
      wg.gain.setValueAtTime(0.001, t);
      wg.gain.linearRampToValueAtTime(0.11, t + 0.35);
      wg.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
      whoosh.connect(bp); bp.connect(wg);
      this._connectSfx(wg, 0, 0.38);
      whoosh.start(t, randRange(0, 2.0), 1.20);
      return;
    }

    const isKei = profile === 'kei';
    const isArmor = profile === 'armor';
    // Starter motor crank pulses -> ignition roar catch!
    const pulses = isKei ? 3 : 4;
    for (let i = 0; i < pulses; i++) {
      const pt = t + i * 0.11;
      const crank = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      crank.type = 'sawtooth';
      crank.frequency.setValueAtTime(isKei ? 115 : (isArmor ? 64 : 78), pt);
      crank.frequency.linearRampToValueAtTime(isKei ? 140 : (isArmor ? 78 : 96), pt + 0.08);
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = isKei ? 360 : 210;
      cg.gain.setValueAtTime(0.085, pt);
      cg.gain.exponentialRampToValueAtTime(0.004, pt + 0.095);
      crank.connect(lpf); lpf.connect(cg);
      this._connectSfx(cg, 0, 0.22);
      crank.start(pt); crank.stop(pt + 0.105);
    }

    // Combustion catch roar
    const catchT = t + pulses * 0.105;
    const roar = this.ctx.createOscillator();
    const rg = this.ctx.createGain();
    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(isKei ? 150 : (isArmor ? 78 : 98), catchT);
    roar.frequency.exponentialRampToValueAtTime(isKei ? 74 : (isArmor ? 42 : 52), catchT + 0.42);
    const rlp = this.ctx.createBiquadFilter();
    rlp.type = 'lowpass'; rlp.frequency.value = isKei ? 420 : 240;
    rg.gain.setValueAtTime(0.001, catchT);
    rg.gain.linearRampToValueAtTime(isArmor ? 0.16 : 0.125, catchT + 0.04);
    rg.gain.exponentialRampToValueAtTime(0.001, catchT + 0.48);
    roar.connect(rlp); rlp.connect(rg);
    this._connectSfx(rg, 0, 0.26);
    roar.start(catchT); roar.stop(catchT + 0.50);
  }

  playEngineStop(profile = 'diesel') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lpf = this.ctx.createBiquadFilter();
    osc.type = profile === 'k11' ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(profile === 'k11' ? 260 : (profile === 'kei' ? 88 : 56), t);
    osc.frequency.exponentialRampToValueAtTime(18, t + (profile === 'k11' ? 0.65 : 0.34));
    lpf.type = 'lowpass'; lpf.frequency.value = profile === 'k11' ? 600 : 190;
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (profile === 'k11' ? 0.70 : 0.36));
    osc.connect(lpf); lpf.connect(g);
    this._connectSfx(g, 0, 0.22);
    osc.start(t); osc.stop(t + 0.72);
  }

  updateEngine(active, speedNorm = 0, profile = 'diesel', opts = {}) {
    if (!this.ctx) return;
    if (!this.engineNodes) {
      // Multi-layer physical combustion synthesis: firing sawtooth + sub-harmonic + asymmetric combustion waveshaper
      const mainOsc = this.ctx.createOscillator();
      mainOsc.type = 'sawtooth';
      mainOsc.frequency.value = 46;

      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.value = 23;

      const combShaper = this.ctx.createWaveShaper();
      if (this.combustionCurve) combShaper.curve = this.combustionCurve;
      combShaper.oversample = '2x';

      const engFilt = this.ctx.createBiquadFilter();
      engFilt.type = 'lowpass';
      engFilt.frequency.value = 140;
      engFilt.Q.value = 1.8;

      const engGain = this.ctx.createGain();
      engGain.gain.value = 0.0;

      mainOsc.connect(combShaper);
      subOsc.connect(combShaper);
      combShaper.connect(engFilt);
      engFilt.connect(engGain);
      engGain.connect(this.vehicleBus);
      mainOsc.start();
      subOsc.start();

      // Surface-reactive tire road/gravel/bridge/water-splash rolling noise
      const tireSrc = this.ctx.createBufferSource();
      tireSrc.buffer = this.pinkBuf;
      tireSrc.loop = true;
      const tireFilt = this.ctx.createBiquadFilter();
      tireFilt.type = 'bandpass';
      tireFilt.frequency.value = 480;
      tireFilt.Q.value = 0.9;
      const tireGain = this.ctx.createGain();
      tireGain.gain.value = 0.0;
      tireSrc.connect(tireFilt);
      tireFilt.connect(tireGain);
      tireGain.connect(this.vehicleBus);
      tireSrc.start(0, 0.5);

      // Wet hydroplaning / mud lateral skid hiss
      const skidSrc = this.ctx.createBufferSource();
      skidSrc.buffer = this.whiteBuf;
      skidSrc.loop = true;
      const skidFilt = this.ctx.createBiquadFilter();
      skidFilt.type = 'bandpass';
      skidFilt.frequency.value = 1800;
      skidFilt.Q.value = 1.6;
      const skidGain = this.ctx.createGain();
      skidGain.gain.value = 0.0;
      skidSrc.connect(skidFilt);
      skidFilt.connect(skidGain);
      skidGain.connect(this.vehicleBus);
      skidSrc.start(0, 1.4);

      this.engineNodes = { mainOsc, subOsc, engFilt, engGain, tireFilt, tireGain, skidFilt, skidGain };
    }

    const t = this.ctx.currentTime;
    const on = Boolean(active) && !this.muted;
    const s = clamp(speedNorm, 0, 1.2);
    const isKei = profile === 'kei';
    const isArmor = profile === 'armor';
    const onBridge = Boolean(opts.onBridge);
    const waterDepth = opts.waterDepth || 0;
    const onRoad = Boolean(opts.onRoad);
    const slipSpeed = Math.abs(opts.slipSpeed || 0);

    const baseGain = isKei ? 0.036 : (isArmor ? 0.062 : 0.048);
    const targetGain = on ? (baseGain + Math.min(1, s) * 0.048) : 0.0;
    const baseFreq = isKei ? 68 : (isArmor ? 36 : 46);
    const spanFreq = isKei ? 82 : (isArmor ? 38 : 48);
    const targetFreq = baseFreq + Math.min(1.1, s) * spanFreq;
    const targetCutoff = (isKei ? 225 : (isArmor ? 124 : 142)) + Math.min(1.1, s) * (isKei ? 300 : 205);

    this.engineNodes.engGain.gain.setTargetAtTime(targetGain, t, 0.09);
    this.engineNodes.mainOsc.frequency.setTargetAtTime(targetFreq, t, 0.08);
    this.engineNodes.subOsc.frequency.setTargetAtTime(targetFreq * 0.5, t, 0.08);
    this.engineNodes.engFilt.frequency.setTargetAtTime(targetCutoff, t, 0.09);

    // Surface-reactive tire rolling noise (distinct on bridge deck, water splash, gravel road, & forest earth!)
    const speedFactor = on ? clamp(s * 1.15, 0, 1) : 0;
    let tireFreq = onRoad ? 540 : 410;
    let tireVol = speedFactor * (onRoad ? 0.062 : 0.075);
    if (onBridge) {
      tireFreq = 245; // Hollow steel/concrete bridge deck rumble!
      tireVol = speedFactor * 0.115;
    } else if (waterDepth > 0.08) {
      tireFreq = 1650; // Heavy river/flood tire splash!
      tireVol = speedFactor * clamp(0.09 + waterDepth * 0.10, 0.08, 0.20);
    }
    this.engineNodes.tireGain.gain.setTargetAtTime(tireVol, t, 0.10);
    this.engineNodes.tireFilt.frequency.setTargetAtTime(tireFreq + speedFactor * 260, t, 0.10);

    // Hydroplaning / gravel lateral slip scrub
    const skidVol = (on && slipSpeed > 0.65)
      ? clamp((slipSpeed - 0.65) * 0.042, 0, 0.12)
      : 0.0;
    this.engineNodes.skidGain.gain.setTargetAtTime(skidVol, t, 0.08);
    this.engineNodes.skidFilt.frequency.setTargetAtTime(waterDepth > 0.06 ? 2400 : 1350, t, 0.10);
  }

  playBridgeJoint(speedNorm = 0.5) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this._lastJointTime < 0.35) return;
    this._lastJointTime = t;
    const amp = clamp(0.45 + speedNorm * 0.75, 0.3, 1.15);
    // Authentic dual-axle steel bridge expansion joint "カタンッ！…カタンッ！" with modal steel I-beam resonance
    const axleDelay = clamp(0.16 / Math.max(0.25, speedNorm), 0.065, 0.24);
    [0, axleDelay].forEach((d, idx) => {
      playModalBody(this, [
        [idx === 0 ? 96 : 86, 0.12, 0.85, 8],
        [248, 0.085, 0.58, 14],
        [680, 0.055, 0.44, 18],
        [1520, 0.032, 0.28, 22],
      ], {
        startTime: t + d, gain: 0.145 * amp, pan: 0, reverb: 0.30, space: 'valley',
        strikerDur: 0.006, strikerHz: 3600, ringMix: 0.24, directMix: 0.26,
      });
    });
  }

  playSuspensionThud(intensity = 0.6) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const imp = clamp(intensity, 0.2, 1.2);
    const th = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(88, t);
    th.frequency.exponentialRampToValueAtTime(28, t + 0.13);
    g.gain.setValueAtTime(0.15 * imp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    th.connect(g);
    this._connectSfx(g, 0, 0.18);
    th.start(t); th.stop(t + 0.16);
    // Subtle coil-spring & hydraulic shock rebound creak
    playModalBody(this, [
      [165, 0.08, 0.45, 12],
      [420, 0.05, 0.30, 16],
    ], {
      startTime: t + 0.025, gain: 0.055 * imp, pan: 0, reverb: 0.12,
      strikerDur: 0.006, strikerHz: 1800, ringMix: 0.18,
    });
  }

  playBump(reason = 'generic', impactNorm = 0.8) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const imp = clamp(impactNorm, 0.35, 1.3);

    // Core kinetic impact thump
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(reason === 'forest' ? 128 : 108, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.15);
    g.gain.setValueAtTime(0.20 * imp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    this._connectSfx(g, 0, 0.26);
    osc.start(t); osc.stop(t + 0.20);

    // Material-specific modal clang / canopy rustle / water surge / granite crunch
    if (reason === 'vehicle' || reason === 'shutter' || reason === 'garage') {
      playModalBody(this, [
        [285, 0.18, 0.72, 16], [710, 0.14, 0.62, 22], [1580, 0.09, 0.45, 26], [3100, 0.05, 0.25, 28],
      ], { startTime: t, gain: 0.13 * imp, pan: 0, reverb: 0.30, strikerDur: 0.005, strikerHz: 5200, ringMix: 0.32 });
    } else if (reason === 'forest') {
      playGranularScatter(this, {
        buffer: this.foliageBuf || this.pinkBuf, startTime: t + 0.02,
        count: 9, spreadSec: 0.26, grainDurLo: 0.020, grainDurHi: 0.055,
        freqLo: 850, freqHi: 3200, gain: 0.082 * imp, pan: 0, panSpread: 0.45, reverb: 0.28, space: 'valley',
      });
    } else if (reason === 'river') {
      this.playWaterFordSurge(imp, 0.45);
    } else {
      playGranularScatter(this, {
        buffer: this.gritBuf || this.pinkBuf, startTime: t,
        count: 8, spreadSec: 0.16, grainDurLo: 0.014, grainDurHi: 0.036,
        freqLo: 420, freqHi: 2200, gain: 0.095 * imp, pan: 0, panSpread: 0.32, reverb: 0.26, space: 'valley',
      });
    }
  }

  playK11Takeoff() {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(48, t);
    sub.frequency.exponentialRampToValueAtTime(118, t + 1.45);
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime(0.15, t + 0.25);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 1.65);
    sub.connect(sg);
    this._connectSfx(sg, 0, 0.46, 'valley');
    sub.start(t); sub.stop(t + 1.70);

    const jet = this.ctx.createBufferSource();
    jet.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(280, t);
    bp.frequency.exponentialRampToValueAtTime(1180, t + 1.35);
    bp.Q.value = 1.1;
    const jg = this.ctx.createGain();
    jg.gain.setValueAtTime(0.001, t);
    jg.gain.linearRampToValueAtTime(0.16, t + 0.28);
    jg.gain.exponentialRampToValueAtTime(0.001, t + 1.70);
    jet.connect(bp); bp.connect(jg);
    this._connectSfx(jg, 0, 0.42, 'valley');
    jet.start(t, randRange(0, 1.5), 1.75);
  }

  playK11Touchdown(dockedInSilo = false) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const sp = dockedInSilo ? 'silo' : 'valley';
    // Heavy pneumatic landing gear strut hiss + hull settle thump
    const th = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(92, t);
    th.frequency.exponentialRampToValueAtTime(26, t + 0.28);
    tg.gain.setValueAtTime(0.18, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    th.connect(tg);
    this._connectSfx(tg, 0, dockedInSilo ? 0.62 : 0.34, sp);
    th.start(t); th.stop(t + 0.35);

    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.whiteBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1950, t + 0.04);
    bp.frequency.exponentialRampToValueAtTime(620, t + 0.55);
    bp.Q.value = 1.8;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.10, t + 0.04);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    hiss.connect(bp); bp.connect(hg);
    this._connectSfx(hg, 0, dockedInSilo ? 0.58 : 0.30, sp);
    hiss.start(t + 0.04, randRange(0, 2.0), 0.62);
  }

  updateAirshipEngine(active, speedNorm = 0, opts = {}) {
    if (!this.ctx) return;
    if (!this.airNodes) {
      const thrum = this.ctx.createOscillator();
      thrum.type = 'triangle';
      thrum.frequency.value = 54;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 180;
      const thrumG = this.ctx.createGain();
      thrumG.gain.value = 0.0;
      thrum.connect(filt); filt.connect(thrumG); thrumG.connect(this.vehicleBus);
      thrum.start();

      const turb = this.ctx.createOscillator();
      turb.type = 'sine';
      turb.frequency.value = 210;
      const turbG = this.ctx.createGain();
      turbG.gain.value = 0.0;
      turb.connect(turbG); turbG.connect(this.vehicleBus);
      turb.start();

      // High-speed 250 km/h aerodynamic slipstream wind rush
      const slipSrc = this.ctx.createBufferSource();
      slipSrc.buffer = this.pinkBuf;
      slipSrc.loop = true;
      const slipF = this.ctx.createBiquadFilter();
      slipF.type = 'bandpass';
      slipF.frequency.value = 520;
      slipF.Q.value = 0.7;
      const slipG = this.ctx.createGain();
      slipG.gain.value = 0.0;
      slipSrc.connect(slipF); slipF.connect(slipG); slipG.connect(this.vehicleBus);
      slipSrc.start(0, 1.0);

      this.airNodes = { thrum, filt, thrumG, turb, turbG, slipF, slipG };
    }
    const t = this.ctx.currentTime;
    const on = Boolean(active) && !this.muted;
    const s = clamp(speedNorm, 0, 1);
    const climbBoost = clamp(Math.abs(opts.climbRate || 0) / 14.0, 0, 1);
    this.airNodes.thrumG.gain.setTargetAtTime(on ? (0.028 + s * 0.044 + climbBoost * 0.015) : 0.0, t, 0.12);
    this.airNodes.thrum.frequency.setTargetAtTime(50 + s * 66 + climbBoost * 18, t, 0.10);
    this.airNodes.filt.frequency.setTargetAtTime(160 + s * 310, t, 0.10);
    this.airNodes.turbG.gain.setTargetAtTime(on ? (0.005 + s * 0.015 + climbBoost * 0.006) : 0.0, t, 0.12);
    this.airNodes.turb.frequency.setTargetAtTime(200 + s * 420 + climbBoost * 85, t, 0.10);
    this.airNodes.slipG.gain.setTargetAtTime(on ? (s * s * 0.11) : 0.0, t, 0.14);
    this.airNodes.slipF.frequency.setTargetAtTime(340 + s * 960, t, 0.14);
  }

  // =========================================================================
  // CATEGORY F: WEATHER, THUNDER, LANDSLIDES, WILDLIFE & UI
  // =========================================================================

  updateStorm(intensity, muffle = 0.0, roofKind = 'outdoor') {
    this._lastStormIntensity = clamp(intensity, 0, 1);
    if (!this.ctx || !this.pinkBuf) return;
    if (!this.rainGain) {
      // Outdoor rain curtain sheet
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = this.pinkBuf;
      rainSrc.loop = true;
      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.value = 1450;
      this.rainFilter.Q.value = 0.65;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0.0;
      rainSrc.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.ambienceBus);
      rainSrc.start();

      // Indoor roof rain patter layer (Minnaert droplet buffer for lifelike roof drops!)
      const roofSrc = this.ctx.createBufferSource();
      roofSrc.buffer = this.dropletBuf || this.crackleBuf;
      roofSrc.loop = true;
      this.rainRoofFilter = this.ctx.createBiquadFilter();
      this.rainRoofFilter.type = 'bandpass';
      this.rainRoofFilter.frequency.value = 820;
      this.rainRoofFilter.Q.value = 1.4;
      this.rainRoofGain = this.ctx.createGain();
      this.rainRoofGain.gain.value = 0.0;
      roofSrc.connect(this.rainRoofFilter);
      this.rainRoofFilter.connect(this.rainRoofGain);
      this.rainRoofGain.connect(this.ambienceBus);
      roofSrc.start(0, 0.8);
    }

    const t = this.ctx.currentTime;
    const active = this.muted ? 0 : this._lastStormIntensity;
    const exposure = clamp(muffle, 0.0, 1.0);
    this.rainGain.gain.setTargetAtTime(active * 0.175 * exposure, t, 0.18);
    this.rainFilter.frequency.setTargetAtTime(460 + 1500 * exposure, t, 0.18);

    const sheltered = exposure > 0.05 && exposure < 0.75;
    const roofTarget = sheltered ? active * (roofKind === 'metal' ? 0.13 : 0.095) * (0.4 + exposure) : 0.0;
    const roofFreq = roofKind === 'metal' ? 1420 : (roofKind === 'composite' ? 980 : 620);
    this.rainRoofGain.gain.setTargetAtTime(roofTarget, t, 0.22);
    this.rainRoofFilter.frequency.setTargetAtTime(roofFreq, t, 0.22);
  }

  playThunder(distanceM = 300) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const pan = randRange(-0.68, 0.68);
    if (distanceM < 240 && typeof this.playLightningArcSnap === 'function') {
      this.playLightningArcSnap(pan);
    }
    const delay = clamp(distanceM / 343.0, 0.05, 1.9);
    const t = this.ctx.currentTime + delay;
    const nearness = clamp(1.0 - distanceM / 920.0, 0.25, 1.0);

    // 1. Stepped-leader atmospheric crackle (when < 480m)
    if (distanceM < 480) {
      playGranularScatter(this, {
        buffer: this.gritBuf || this.whiteBuf,
        startTime: t,
        count: 9, spreadSec: 0.22,
        grainDurLo: 0.015, grainDurHi: 0.048,
        freqLo: 650, freqHi: 3200,
        gain: 0.16 * nearness, pan, panSpread: 0.35, reverb: 0.62, space: 'valley',
      });
    }

    // 2. Massive rolling mountain-valley thunder wave bouncing off surrounding ridges!
    [0.02, 0.56].forEach((offset, wIdx) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.brownBuf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(wIdx === 0 ? (230 * nearness + 70) : 145, t + offset);
      filt.frequency.exponentialRampToValueAtTime(36, t + offset + 3.0);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + offset);
      g.gain.linearRampToValueAtTime((wIdx === 0 ? 0.34 : 0.20) * nearness, t + offset + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0005, t + offset + 3.4);
      src.connect(filt); filt.connect(g);
      this._connectSfx(g, pan * (wIdx === 0 ? 1 : -0.65), 0.68, 'valley');
      src.start(t + offset, randRange(0, 0.5), 3.5);
    });
  }

  playLandslideRumble(intensity = 0.6) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.0);
    const pan = randRange(-0.55, 0.55);
    const rmb = this.ctx.createBufferSource();
    rmb.buffer = this.brownBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 155;
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.linearRampToValueAtTime(0.19 * amp, t + 0.28);
    rg.gain.exponentialRampToValueAtTime(0.0005, t + 1.85);
    rmb.connect(lp); lp.connect(rg);
    this._connectSfx(rg, pan, 0.52, 'valley');
    rmb.start(t, randRange(0, 1.5), 1.95);

    // Granular tumbling granite boulders & talus scree
    playGranularScatter(this, {
      buffer: this.gritBuf || this.crackleBuf,
      startTime: t + 0.12,
      count: 14, spreadSec: 1.35,
      grainDurLo: 0.025, grainDurHi: 0.085,
      freqLo: 280, freqHi: 1850,
      gain: 0.095 * amp, pan, panSpread: 0.45, reverb: 0.48, space: 'valley',
    });
  }

  playBirdCall(species = 'uguisu', pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (species === 'uguisu') {
      // Iconic Japanese Bush Warbler (ウグイス) via syrinx formant synthesis + mountain valley echo
      const base = randRange(1240, 1420);
      playFormantVocal(this, {
        startTime: t, dur: 0.54,
        fStart: base, fMid: base * 1.10, fEnd: base * 1.18,
        wave: 'triangle', formants: [[base * 1.08, 4.5, 0.95]],
        vibHz: 5.5, vibDepth: 14, breathAmt: 0.16,
        gain: 0.028, pan, reverb: 0.62, space: 'valley',
      });
      playFormantVocal(this, {
        startTime: t + 0.62, dur: 0.14,
        fStart: base * 1.52, fMid: base * 1.35, fEnd: base * 1.04,
        wave: 'triangle', formants: [[base * 1.35, 4.2, 0.95]],
        vibHz: 7.0, vibDepth: 16, breathAmt: 0.14,
        gain: 0.032, pan, reverb: 0.62, space: 'valley',
      });
      playFormantVocal(this, {
        startTime: t + 0.78, dur: 0.22,
        fStart: base * 1.76, fMid: base * 1.48, fEnd: base * 1.22,
        wave: 'triangle', formants: [[base * 1.48, 4.2, 0.95]],
        vibHz: 6.5, vibDepth: 18, breathAmt: 0.16,
        gain: 0.032, pan, reverb: 0.66, space: 'valley',
      });
    } else {
      // Distant Japanese Mountain Kite / Hawk ("ピーヒョロロ") via formant soaring whistle
      const f0 = randRange(1760, 2020);
      playFormantVocal(this, {
        startTime: t, dur: 1.18,
        fStart: f0, fMid: f0 * 0.78, fEnd: f0 * 0.64,
        wave: 'triangle', formants: [[f0 * 0.85, 3.8, 0.90], [f0 * 1.6, 5.0, 0.22]],
        vibHz: 8.5, vibDepth: 32, breathAmt: 0.20,
        gain: 0.026, pan, reverb: 0.72, space: 'valley',
      });
    }
  }

  playOwlHoot(pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Warm, deep, soothing Tawny Owl hoot ("ホォー…ホッ・ホォー") via airy syrinx formant + canyon reverb!
    const notes = [
      [382, 0.0, 0.44, 0.036],
      [350, 0.72, 0.24, 0.028],
      [338, 1.02, 0.56, 0.034],
    ];
    notes.forEach(([freq, d, dur, amp]) => {
      playFormantVocal(this, {
        startTime: t + d, dur,
        fStart: freq * 0.96, fMid: freq, fEnd: freq * 0.91,
        wave: 'triangle', formants: [[freq, 5.2, 1.0], [freq * 2.0, 6.0, 0.14]],
        vibHz: 4.5, vibDepth: 4.5, breathAmt: 0.22,
        gain: amp, pan, reverb: 0.72, space: 'valley',
      });
    });
  }

  playWoodpecker(pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Authentic Akagera woodpecker drumming on hollow ancient Sugi trunk via 4-mode wood cavity!
    const taps = 6 + Math.floor(Math.random() * 4);
    const pitch = randRange(0.92, 1.10);
    for (let i = 0; i < taps; i++) {
      const dt = i * 0.056 + randRange(0, 0.004);
      playModalBody(this, [
        [440, 0.042, 0.78, 16],
        [790, 0.032, 0.65, 20],
        [1340, 0.022, 0.45, 22],
        [2280, 0.014, 0.24, 24],
      ], {
        startTime: t + dt, gain: 0.052 * (0.85 + Math.random() * 0.25),
        pan, reverb: 0.58, space: 'valley',
        strikerDur: 0.003, strikerHz: 4600, ringMix: 0.30, pitchMul: pitch,
      });
    }
  }

  playBambooRustle(pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.foliageBuf || this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.linearRampToValueAtTime(1550, t + 1.25);
    bp.Q.value = 1.3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.048, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.40);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, pan, 0.40, 'valley');
    src.start(t, randRange(0, 2.0), 1.45);
  }

  playUiSound(kind = 'click') {
    if (!this.ctx || this.muted) return;
    if (kind === 'map_open' || kind === 'map_close') {
      return this.playMapPaperUnfold(kind === 'map_open');
    }
    if (kind === 'zoom_in' || kind === 'zoom_out') {
      return this.playMapZoomTick(kind === 'zoom_in');
    }
    if (kind === 'camera_switch') {
      return this.playCameraShutter();
    }
    if (kind === 'waypoint_set') {
      return this.playMapWaypointLock();
    }
    // Tactile Leica-grade soft mechanical UI click
    playModalBody(this, [
      [kind === 'settings' ? 760 : 980, 0.022, 0.65, 16],
      [kind === 'settings' ? 1680 : 2150, 0.014, 0.38, 20],
    ], {
      gain: 0.046, bus: this.uiBus,
      strikerDur: 0.0025, strikerHz: 4200, ringMix: 0.24,
    });
  }
}

// Install all 59 V4 hyper-realistic SFX + unified 128-SFX playById() dispatcher!
installHyperFoleyV4(SpatialForestAudio);

