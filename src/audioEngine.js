/**
 * NARROW-50 / TERRENO AAA Procedural Spatial Audio & Foley Engine (v3.0 — Zero-Beep Immersion Edition)
 *
 * Completely eliminates the legacy 4150Hz continuous pulsed oscillator ("ぴぴぴぴぴ") and replaces it
 * with a studio-grade procedural Web Audio DSP engine featuring:
 *  - Master DynamicsCompressor + strictly leak-free Master Mute Bus (0.0000 gain when muted)
 *  - Real-time Procedural Stereo Convolution Reverb (Warm Timber Room IR + 40m Cavern/Granite Spa IR)
 *  - 55+ ultra-realistic multi-layered procedural SFX covering every surface, door, prop, sauna,
 *    underground lab, elevator, vehicle, bridge, river, weather event, SILO-40, and Airship K-11
 *  - Living 3D Proximity Ambient Soundscape: stereo mountain wind, rushing Kurosugi River & rapids,
 *    village bamboo spring well, crackling fireplaces/irori, B3F thermal spa, underground HVAC,
 *    material-aware storm rain patter, and spacious natural wildlife (day birds / mellow night owl)
 */

export const SFX_CATALOG = [
  // Footsteps & Player Foley (14)
  'footstep_wood', 'footstep_tatami', 'footstep_tile', 'footstep_wet_stone',
  'footstep_metal', 'footstep_earth', 'footstep_gravel', 'footstep_grass',
  'footstep_bridge', 'footstep_water', 'jump_pushoff', 'land_impact',
  'crouch_rustle', 'stair_step',
  // Architectural Doors, Hatches & Shutters (10)
  'door_wood_swing', 'door_shoji_slide', 'door_airtight_bunker', 'door_glass_slide',
  'door_vehicle_cab', 'door_liftgate_strut', 'door_armor_airlock', 'door_k11_airlock',
  'garage_rollup_shutter', 'armor_storm_shutter',
  // Interactive Props, Sauna, Hearth & Underground Lab (10)
  'flashlight_click', 'lamp_switch', 'washi_lantern_toggle', 'fireplace_toggle',
  'sauna_loyly_steam', 'thermal_console_cmd', 'cooling_plenum_boost', 'lab_uv_mode',
  'lab_containment_overdrive', 'tow_hitch_couple',
  // Elevators, SILO-40 & Avionics (9)
  'elevator_button', 'elevator_brake', 'elevator_door', 'elevator_chime',
  'elevator_safety_cue', 'elevator_motor_loop', 'silo_hydraulic_stage',
  'k11_refuel_pump', 'autopilot_cue',
  // Ground Vehicles & Airship K-11 Flight (11)
  'engine_start_diesel', 'engine_start_armor', 'engine_start_kei', 'engine_start_k11',
  'engine_shutdown', 'vehicle_engine_loop', 'tire_surface_loop', 'tire_hydroplane_skid',
  'suspension_thud', 'bridge_expansion_joint', 'vehicle_collision_impact',
  'vehicle_headlight_relay', 'k11_takeoff_boost', 'k11_touchdown_struts',
  'k11_airship_flight_loop',
  // Living World Nature, Weather & UI (11)
  'forest_wind_ambience', 'river_rapids_ambience', 'village_spring_ambience',
  'hearth_fire_ambience', 'sauna_spa_ambience', 'underground_hvac_ambience',
  'storm_rain_roof_ambience', 'thunder_lightning_crack', 'landslide_rockfall',
  'wildlife_bird_owl_woodpecker', 'ui_tactile_feedback',
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

    // Master & Reverb Buses
    this.masterGain = null;
    this.compressor = null;
    this.sfxBus = null;
    this.ambienceBus = null;
    this.vehicleBus = null;
    this.uiBus = null;
    this.roomReverbSend = null;
    this.cavernReverbSend = null;
    this.roomWetGain = null;
    this.cavernWetGain = null;

    // Pre-baked Stereo Noise Buffers (zero GC during gameplay)
    this.whiteBuf = null;
    this.pinkBuf = null;
    this.brownBuf = null;
    this.crackleBuf = null;
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

    // State Tracking
    this._footParity = 1;
    this._lastOpenness = 0.25;
    this._lastStormIntensity = 0.0;
    this._lastAcousticZone = 'wood_room';
    this._wildlifeTimer = 9.0;
    this._lastJointTime = 0;
    this._lastSkidTime = 0;
    this._lastLandslideTime = 0;
    this._lastCreakTime = 0;
    this._envState = {
      isOutdoors: false,
      isNight: false,
      riverDist: 999,
      riverFlowBoost: 0,
      springDist: 999,
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

    // 1. Studio Master Chain: Buses -> DynamicsCompressor -> MasterGain -> Destination
    // STRICT MUTE GUARANTEE: EVERYTHING routes into masterGain! Zero direct destination bypasses!
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0.0 : 0.92;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -13;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 3.8;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.16;

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1.0;
    this.sfxBus.connect(this.compressor);

    this.ambienceBus = this.ctx.createGain();
    this.ambienceBus.gain.value = 0.95;
    this.ambienceBus.connect(this.compressor);

    this.vehicleBus = this.ctx.createGain();
    this.vehicleBus.gain.value = 0.92;
    this.vehicleBus.connect(this.compressor);

    this.uiBus = this.ctx.createGain();
    this.uiBus.gain.value = 0.85;
    this.uiBus.connect(this.compressor);

    // 2. Procedural Stereo Convolution Reverb Engine (Room IR + Deep Cavern/Granite Spa IR)
    this.roomReverbSend = this.ctx.createGain();
    this.roomReverbSend.gain.value = 0.32;
    this.cavernReverbSend = this.ctx.createGain();
    this.cavernReverbSend.gain.value = 0.06;

    try {
      const roomConv = this.ctx.createConvolver();
      roomConv.buffer = this._buildImpulseResponse(0.72, 2.8, 4200);
      this.roomWetGain = this.ctx.createGain();
      this.roomWetGain.gain.value = 0.34;
      this.roomReverbSend.connect(roomConv);
      roomConv.connect(this.roomWetGain);
      this.roomWetGain.connect(this.compressor);

      const cavernConv = this.ctx.createConvolver();
      cavernConv.buffer = this._buildImpulseResponse(2.35, 2.2, 2400);
      this.cavernWetGain = this.ctx.createGain();
      this.cavernWetGain.gain.value = 0.08;
      this.cavernReverbSend.connect(cavernConv);
      cavernConv.connect(this.cavernWetGain);
      this.cavernWetGain.connect(this.compressor);
    } catch (_) {
      this.roomWetGain = this.ctx.createGain();
      this.cavernWetGain = this.ctx.createGain();
    }

    // 3. Generate High-Definition Stereo Noise Bank (White, Pink, Brown, Stochastic Crackle)
    this._buildNoiseBuffers(sr);

    // 4. Initialize Organic Continuous Spatial Ambience Layers (ZERO high-pitched beep oscillators!)
    this._initForestWindLayer();
    this._initRiverAndSpringLayers();
    this._initInteriorAmbienceLayers();
  }

  _buildImpulseResponse(durationSec, decayPower, lpfHz) {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1024, Math.floor(sr * durationSec));
    const buf = this.ctx.createBuffer(2, len, sr);
    const alpha = Math.min(0.99, (2 * Math.PI * lpfHz) / (sr + 2 * Math.PI * lpfHz));
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1.0 - t, decayPower);
        // Subtle early reflection clusters in first 45ms
        let early = 0;
        if (i === Math.floor(sr * (0.011 + ch * 0.003))) early = 0.55;
        else if (i === Math.floor(sr * (0.024 + ch * 0.005))) early = 0.38;
        else if (i === Math.floor(sr * (0.041 + ch * 0.004))) early = 0.25;
        const raw = (Math.random() * 2 - 1) * env + early;
        lp += alpha * (raw - lp);
        data[i] = lp * 0.55;
      }
    }
    return buf;
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

    // Stochastic Micro-Crackle Buffer (for hearth wood crackle, droplets, gravel grit)
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

    // Village Bamboo Spring Well / B3F Spa Trickle (gentle clear babbling water)
    const spSrc = this.ctx.createBufferSource();
    spSrc.buffer = this.crackleBuf;
    spSrc.loop = true;
    this.springFilter = this.ctx.createBiquadFilter();
    this.springFilter.type = 'bandpass';
    this.springFilter.frequency.value = 1750;
    this.springFilter.Q.value = 1.9;
    this.springGain = this.ctx.createGain();
    this.springGain.gain.value = 0.0;
    spSrc.connect(this.springFilter);
    this.springFilter.connect(this.springGain);
    this.springGain.connect(this.ambienceBus);
    this.springGain.connect(this.roomReverbSend);
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
    this.spaGain.connect(this.cavernReverbSend);
    spaSrc.start(0, 1.9);
  }

  _connectSfx(node, pan = 0, reverbAmt = 0.25) {
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
      send.connect(this.roomReverbSend);
      if (this.cavernReverbSend) send.connect(this.cavernReverbSend);
    }
  }

  toggleMute() {
    if (!this.ctx) this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0.0 : 0.92, this.ctx.currentTime, 0.06);
    }
    return !this.muted;
  }

  setAcousticZone(zone = 'wood_room') {
    if (!this.ctx || !this.roomWetGain || !this.cavernWetGain) return;
    if (zone === this._lastAcousticZone) return;
    this._lastAcousticZone = zone;
    const t = this.ctx.currentTime;
    let roomW = 0.24, cavW = 0.04;
    if (zone === 'outdoor') {
      roomW = 0.14; cavW = 0.04;
    } else if (zone === 'wood_room') {
      roomW = 0.34; cavW = 0.03;
    } else if (zone === 'stone_bath' || zone === 'garage') {
      roomW = 0.28; cavW = 0.38;
    } else if (zone === 'basement_lab') {
      roomW = 0.22; cavW = 0.32;
    } else if (zone === 'silo_cavern') {
      roomW = 0.18; cavW = 0.62;
    } else if (zone === 'vehicle_cabin' || zone === 'airship_cabin') {
      roomW = 0.16; cavW = 0.02;
    }
    this.roomWetGain.gain.setTargetAtTime(roomW, t, 0.25);
    this.cavernWetGain.gain.setTargetAtTime(cavW, t, 0.25);
  }

  /**
   * Real-time acoustic occlusion for outdoor wind & forest canopy leaf rustle!
   */
  updateOcclusion(openness) {
    this._lastOpenness = clamp(openness, 0, 1);
    if (!this.ctx || !this.windFilterL || !this.windGain) return;
    const t = this.ctx.currentTime;
    const stormBoost = this._lastStormIntensity;
    const freq = 145 + this._lastOpenness * 520 + stormBoost * 340 * this._lastOpenness;
    const gain = (0.042 + this._lastOpenness * 0.095) * (1.0 + stormBoost * 0.85);
    this.windFilterL.frequency.setTargetAtTime(freq, t, 0.22);
    this.windGain.gain.setTargetAtTime(gain, t, 0.22);

    if (this.leafGain) {
      const leafTarget = Math.max(0, (this._lastOpenness - 0.18) / 0.82) * (0.032 + stormBoost * 0.048);
      this.leafGain.gain.setTargetAtTime(leafTarget, t, 0.25);
    }
  }

  /**
   * Master spatial environment updater called every frame from scene3d.js!
   * Smoothly blends river rapids, village spring, fireplaces, sauna spa, underground HVAC,
   * landslide rockfall rumble, acoustic reverb space, & spacious organic wildlife!
   */
  updateEnvironment(dt, state = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    Object.assign(this._envState, state);

    if (state.acousticZone) this.setAcousticZone(state.acousticZone);

    // 1. Mountain River & Rapids Proximity (Kurosugi River + Tributaries)
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

    // 7. Spacious Natural Forest Wildlife (Rare, Organic, Strictly Zero High-Pitched Beeps!)
    if (this._lastOpenness > 0.45 && this._lastStormIntensity < 0.22 && !state.inUnderground && !state.inSiloCavern) {
      this._wildlifeTimer -= dt;
      if (this._wildlifeTimer <= 0) {
        this._wildlifeTimer = randRange(12.0, 26.0);
        const pan = randRange(-0.82, 0.82);
        if (state.isNight) {
          if (Math.random() < 0.65) this.playOwlHoot(pan);
          else this.playBambooRustle(pan);
        } else {
          const r = Math.random();
          if (r < 0.44) this.playBirdCall('uguisu', pan);
          else if (r < 0.70) this.playBirdCall('mountain_hawk', pan);
          else if (r < 0.88) this.playWoodpecker(pan);
          else this.playBambooRustle(pan);
        }
      }
    }
  }

  // =========================================================================
  // CATEGORY A: MATERIAL-AWARE FOOTSTEPS & PLAYER FOLEY (14 SFX)
  // =========================================================================

  playFootstep(surface = 'wood', opts = {}) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const sprint = Boolean(opts.sprint);
    const crouch = Boolean(opts.crouch);
    const velScale = crouch ? 0.56 : (sprint ? 1.32 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.14;
    const pitchJitter = randRange(0.90, 1.12);

    if (surface === 'water') {
      // Splashing mountain stream wade: burst + bubble resonance + water droplets
      const spl = this.ctx.createBufferSource();
      spl.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1200 * pitchJitter, t);
      bp.frequency.exponentialRampToValueAtTime(480, t + 0.24);
      bp.Q.value = 1.1;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14 * velScale, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      spl.connect(bp); bp.connect(g);
      this._connectSfx(g, pan, 0.22);
      spl.start(t, randRange(0, 2.2), 0.28);

      // Liquid bubble plop harmonic
      const bub = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bub.type = 'sine';
      bub.frequency.setValueAtTime(280 * pitchJitter, t + 0.03);
      bub.frequency.exponentialRampToValueAtTime(760 * pitchJitter, t + 0.10);
      bg.gain.setValueAtTime(0.045 * velScale, t + 0.03);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      bub.connect(bg);
      this._connectSfx(bg, pan, 0.20);
      bub.start(t + 0.03); bub.stop(t + 0.12);
      return;
    }

    if (surface === 'bridge') {
      // Hollow resonant timber/steel bridge deck thump + subtle steel girder ring
      const thump = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      thump.type = 'triangle';
      thump.frequency.setValueAtTime(118 * pitchJitter, t);
      thump.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      tg.gain.setValueAtTime(0.16 * velScale, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      thump.connect(tg);
      this._connectSfx(tg, pan, 0.26);
      thump.start(t); thump.stop(t + 0.14);

      const grit = this.ctx.createBufferSource();
      grit.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 540 * pitchJitter;
      bp.Q.value = 2.4;
      const gg = this.ctx.createGain();
      gg.gain.setValueAtTime(0.095 * velScale, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      grit.connect(bp); bp.connect(gg);
      this._connectSfx(gg, pan, 0.24);
      grit.start(t, randRange(0, 3.0), 0.11);
      return;
    }

    if (surface === 'metal') {
      // Resonant steel grating / titanium ramp clank
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1850 * pitchJitter;
      bp.Q.value = 5.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.095 * velScale, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      src.connect(bp); bp.connect(g);
      this._connectSfx(g, pan, 0.36);
      src.start(t, randRange(0, 2.4), 0.13);

      const ring = this.ctx.createOscillator();
      const rg = this.ctx.createGain();
      ring.type = 'triangle';
      ring.frequency.setValueAtTime(295 * pitchJitter, t);
      ring.frequency.exponentialRampToValueAtTime(140, t + 0.085);
      rg.gain.setValueAtTime(0.08 * velScale, t);
      rg.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      ring.connect(rg);
      this._connectSfx(rg, pan, 0.32);
      ring.start(t); ring.stop(t + 0.10);
      return;
    }

    if (surface === 'gravel') {
      // Multi-grain sharp crushed macadam gravel crunch (heel strike + rolling stone scatter)
      for (let gIdx = 0; gIdx < 2; gIdx++) {
        const dtOff = gIdx * 0.032;
        const src = this.ctx.createBufferSource();
        src.buffer = gIdx === 0 ? this.crackleBuf : this.whiteBuf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = (gIdx === 0 ? 2250 : 1480) * pitchJitter;
        bp.Q.value = gIdx === 0 ? 1.5 : 1.1;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime((gIdx === 0 ? 0.13 : 0.085) * velScale, t + dtOff);
        g.gain.exponentialRampToValueAtTime(0.001, t + dtOff + 0.10);
        src.connect(bp); bp.connect(g);
        this._connectSfx(g, pan, 0.14);
        src.start(t + dtOff, randRange(0, 2.2), 0.12);
      }
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
      // Multi-layer engine synthesis: firing sawtooth + sub-harmonic rumble + turbo whistle + surface tire noise
      const mainOsc = this.ctx.createOscillator();
      mainOsc.type = 'sawtooth';
      mainOsc.frequency.value = 46;

      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.value = 23;

      const engFilt = this.ctx.createBiquadFilter();
      engFilt.type = 'lowpass';
      engFilt.frequency.value = 130;
      engFilt.Q.value = 1.6;

      const engGain = this.ctx.createGain();
      engGain.gain.value = 0.0;

      mainOsc.connect(engFilt);
      subOsc.connect(engFilt);
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
    const targetCutoff = (isKei ? 205 : (isArmor ? 112 : 128)) + Math.min(1.1, s) * (isKei ? 280 : 185);

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
    const amp = clamp(0.45 + speedNorm * 0.75, 0.3, 1.1);
    // Authentic dual-axle steel bridge expansion joint "タタンッ!" (front + rear axle gap)
    const axleDelay = clamp(0.16 / Math.max(0.25, speedNorm), 0.065, 0.24);
    [0, axleDelay].forEach((d, idx) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(idx === 0 ? 110 : 98, t + d);
      o.frequency.exponentialRampToValueAtTime(38, t + d + 0.075);
      g.gain.setValueAtTime(0.14 * amp, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.085);
      o.connect(g);
      this._connectSfx(g, 0, 0.24);
      o.start(t + d); o.stop(t + d + 0.095);
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

    // Material-specific crunch / clang / leaf-shake / splash layer
    if (this.pinkBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = (reason === 'river') ? this.whiteBuf : this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      if (reason === 'vehicle' || reason === 'shutter' || reason === 'garage') {
        bp.frequency.value = 1150; bp.Q.value = 3.8; // Metallic sheet clang
      } else if (reason === 'forest') {
        bp.frequency.value = 780; bp.Q.value = 1.4; // Bark thud + rustling canopy leaves
      } else if (reason === 'river') {
        bp.frequency.value = 1450; bp.Q.value = 0.9; // Heavy water splash
      } else {
        bp.frequency.value = 460; bp.Q.value = 1.6; // Rock / earth crunch
      }
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.12 * imp, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + (reason === 'river' ? 0.36 : 0.22));
      src.connect(bp); bp.connect(ng);
      this._connectSfx(ng, 0, 0.28);
      src.start(t, randRange(0, 2.0), 0.40);
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
    this._connectSfx(sg, 0, 0.42);
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
    this._connectSfx(jg, 0, 0.36);
    jet.start(t, randRange(0, 1.5), 1.75);
  }

  playK11Touchdown(dockedInSilo = false) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Heavy pneumatic landing gear strut hiss + hull settle thump
    const th = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(92, t);
    th.frequency.exponentialRampToValueAtTime(26, t + 0.28);
    tg.gain.setValueAtTime(0.18, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    th.connect(tg);
    this._connectSfx(tg, 0, dockedInSilo ? 0.60 : 0.28);
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
    this._connectSfx(hg, 0, dockedInSilo ? 0.55 : 0.26);
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
  // CATEGORY F: WEATHER, THUNDER, LANDSLIDES, WILDLIFE & UI (11 SFX)
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

      // Indoor roof rain patter layer (distinct wood / metal / composite resonance!)
      const roofSrc = this.ctx.createBufferSource();
      roofSrc.buffer = this.crackleBuf;
      roofSrc.loop = true;
      this.rainRoofFilter = this.ctx.createBiquadFilter();
      this.rainRoofFilter.type = 'bandpass';
      this.rainRoofFilter.frequency.value = 820;
      this.rainRoofFilter.Q.value = 1.6;
      this.rainRoofGain = this.ctx.createGain();
      this.rainRoofGain.gain.value = 0.0;
      roofSrc.connect(this.rainRoofFilter);
      this.rainRoofFilter.connect(this.rainRoofGain);
      this.rainRoofGain.connect(this.ambienceBus);
      roofSrc.start(0, 0.8);
    }

    const t = this.ctx.currentTime;
    const active = this.muted ? 0 : this._lastStormIntensity;
    // Notice scene3d passes `stormMuffle` where 1.0 = outdoors and 0.02 = deep underground!
    const exposure = clamp(muffle, 0.0, 1.0);
    this.rainGain.gain.setTargetAtTime(active * 0.175 * exposure, t, 0.18);
    this.rainFilter.frequency.setTargetAtTime(460 + 1500 * exposure, t, 0.18);

    // Cozy roof patter when sheltered indoors / inside vehicle / garage (not underground!)
    const sheltered = exposure > 0.05 && exposure < 0.75;
    const roofTarget = sheltered ? active * (roofKind === 'metal' ? 0.12 : 0.085) * (0.4 + exposure) : 0.0;
    const roofFreq = roofKind === 'metal' ? 1420 : (roofKind === 'composite' ? 980 : 620);
    this.rainRoofGain.gain.setTargetAtTime(roofTarget, t, 0.22);
    this.rainRoofFilter.frequency.setTargetAtTime(roofFreq, t, 0.22);
  }

  playThunder(distanceM = 300) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const delay = clamp(distanceM / 343.0, 0.06, 1.9);
    const t = this.ctx.currentTime + delay;
    const nearness = clamp(1.0 - distanceM / 900.0, 0.25, 1.0);
    const pan = randRange(-0.65, 0.65);

    // 1. Close lightning electrostatic crack (only when < 450m)
    if (distanceM < 450) {
      const crack = this.ctx.createBufferSource();
      crack.buffer = this.whiteBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200, t);
      bp.frequency.exponentialRampToValueAtTime(320, t + 0.34);
      bp.Q.value = 0.8;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.001, t);
      cg.gain.linearRampToValueAtTime(0.24 * nearness, t + 0.015);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      crack.connect(bp); bp.connect(cg);
      this._connectSfx(cg, pan, 0.45);
      crack.start(t, randRange(0, 1.8), 0.42);
    }

    // 2. Massive rolling mountain-valley thunder wave (dual-wave reverberant bass)
    [0.02, 0.58].forEach((offset, wIdx) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.brownBuf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(wIdx === 0 ? (220 * nearness + 70) : 140, t + offset);
      filt.frequency.exponentialRampToValueAtTime(38, t + offset + 2.8);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t + offset);
      g.gain.linearRampToValueAtTime((wIdx === 0 ? 0.32 : 0.18) * nearness, t + offset + 0.16);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 3.2);
      src.connect(filt); filt.connect(g);
      this._connectSfx(g, pan * (wIdx === 0 ? 1 : -0.6), 0.50);
      src.start(t + offset, randRange(0, 0.6), 3.3);
    });
  }

  playLandslideRumble(intensity = 0.6) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.0);
    const rmb = this.ctx.createBufferSource();
    rmb.buffer = this.brownBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 155;
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.001, t);
    rg.gain.linearRampToValueAtTime(0.18 * amp, t + 0.28);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 1.65);
    rmb.connect(lp); lp.connect(rg);
    this._connectSfx(rg, randRange(-0.5, 0.5), 0.28);
    rmb.start(t, randRange(0, 1.5), 1.75);

    // Tumbling granite rock clatter
    const rock = this.ctx.createBufferSource();
    rock.buffer = this.crackleBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 740;
    bp.Q.value = 1.2;
    const kg = this.ctx.createGain();
    kg.gain.setValueAtTime(0.12 * amp, t + 0.15);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
    rock.connect(bp); bp.connect(kg);
    this._connectSfx(kg, randRange(-0.6, 0.6), 0.24);
    rock.start(t + 0.15, randRange(0, 1.2), 1.30);
  }

  playBirdCall(species = 'uguisu', pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (species === 'uguisu') {
      // Iconic Japanese Bush Warbler (ウグイス: soft airy "Hooo... ho-ke-kyo!")
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      osc.type = 'sine';
      lp.type = 'lowpass'; lp.frequency.value = 3400;
      const base = randRange(1280, 1480);
      // Long pure gentle whistle "hooo..."
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * 1.18, t + 0.52);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.56);
      // Quick melodic "ho-ke-kyo" trill
      osc.frequency.setValueAtTime(base * 1.58, t + 0.64);
      osc.frequency.exponentialRampToValueAtTime(base * 1.05, t + 0.74);
      osc.frequency.setValueAtTime(base * 1.88, t + 0.77);
      osc.frequency.exponentialRampToValueAtTime(base * 1.24, t + 0.94);
      g.gain.setValueAtTime(0.0001, t + 0.63);
      g.gain.linearRampToValueAtTime(0.028, t + 0.66);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      g.gain.linearRampToValueAtTime(0.030, t + 0.79);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.98);
      osc.connect(lp); lp.connect(g);
      this._connectSfx(g, pan, 0.48);
      osc.start(t); osc.stop(t + 1.02);
    } else {
      // Distant Japanese Mountain Kite / Hawk soaring valley whistle ("peee-hyororo")
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const f0 = randRange(1850, 2150);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + 0.55);
      osc.frequency.linearRampToValueAtTime(f0 * 0.84, t + 0.78);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.64, t + 1.15);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.20);
      osc.connect(lp); lp.connect(g);
      this._connectSfx(g, pan, 0.58);
      osc.start(t); osc.stop(t + 1.24);
    }
  }

  playOwlHoot(pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Warm, deep, soothing distant Tawny Owl hoot ("Hooo... hoo-hooo") at mellow ~380Hz!
    const notes = [
      [385, 0.0, 0.42, 0.028],
      [352, 0.72, 0.24, 0.022],
      [340, 1.02, 0.52, 0.026],
    ];
    notes.forEach(([freq, d, dur, amp]) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.96, t + d);
      o.frequency.linearRampToValueAtTime(freq, t + d + 0.08);
      o.frequency.linearRampToValueAtTime(freq * 0.91, t + d + dur);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.linearRampToValueAtTime(amp, t + d + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + dur);
      o.connect(g);
      this._connectSfx(g, pan, 0.62);
      o.start(t + d); o.stop(t + d + dur + 0.04);
    });
  }

  playWoodpecker(pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const taps = 5 + Math.floor(Math.random() * 4);
    const freq = randRange(580, 760);
    for (let i = 0; i < taps; i++) {
      const dt = i * 0.062;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t + dt);
      o.frequency.exponentialRampToValueAtTime(220, t + dt + 0.024);
      g.gain.setValueAtTime(0.032, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dt + 0.028);
      o.connect(g);
      this._connectSfx(g, pan, 0.48);
      o.start(t + dt); o.stop(t + dt + 0.032);
    }
  }

  playBambooRustle(pan = 0) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.linearRampToValueAtTime(1600, t + 1.2);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.038, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, pan, 0.35);
    src.start(t, randRange(0, 2.0), 1.40);
  }

  playUiSound(kind = 'click') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (kind === 'map_open' || kind === 'map_close') {
      // Crisp architectural blueprint paper unfold / fold
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(kind === 'map_open' ? 1450 : 2100, t);
      bp.frequency.linearRampToValueAtTime(kind === 'map_open' ? 2350 : 1150, t + 0.14);
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.058, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      src.connect(bp); bp.connect(g);
      g.connect(this.uiBus);
      src.start(t, randRange(0, 2.5), 0.18);
      return;
    }
    if (kind === 'camera_switch') {
      // Optical lens shutter tick
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1320, t);
      o.frequency.exponentialRampToValueAtTime(360, t + 0.025);
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      o.connect(g); g.connect(this.uiBus);
      o.start(t); o.stop(t + 0.036);
      return;
    }
    if (kind === 'waypoint_set') {
      this.playAutopilotCue('engage');
      return;
    }
    // Clean soft tactile UI click
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'settings' ? 740 : 960, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.03);
    g.gain.setValueAtTime(0.042, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
    o.connect(g); g.connect(this.uiBus);
    o.start(t); o.stop(t + 0.042);
  }
}
