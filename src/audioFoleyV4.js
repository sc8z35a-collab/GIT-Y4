/**
 * NARROW-50 / TERRENO — Cinema/AAA Physical-Modeling Foley & Hyper-Realism Extension (v4.0)
 *
 * Adds 59 brand-new, physically modeled, multi-layered procedural sound effects plus studio
 * acoustic primitives:
 *  - Analog transformer/tape subtle warmth WaveShaper & internal-combustion firing waveshaper
 *  - Physically modeled 4-space stereo Convolution Impulse Responses (Timber Room, Granite Spa,
 *    40m SILO-40 Launch Cavern, and Alpine Mountain Valley Echo with air absorption)
 *  - 3 extended stereo micro-physics buffers: Minnaert bubble droplets, crystalline gravel grit,
 *    and dry broad-leaf / pine-needle foliage sibilance
 *  - Reusable Modal Bank Resonator (4–7 inharmonic modes + velocity-shaped mallet/striker impulse)
 *  - Micro-Granular Foley Scatter (6–24 stereo-panned transient grains)
 *  - Karplus-Strong / Damped Resonator Pluck (cables, bamboo, timber, taut strings)
 *  - Biological Syrinx / Vocal-Tract Formant Synthesizer (birds, frogs, deer, crows — ZERO beeps!)
 *
 * STRICT ZERO-BEEP & MUTE GUARANTEE:
 *  Every node connects solely into engine buses -> mastering chain -> engine.masterGain (0.0 when muted).
 */

export const HYPER_SFX_V4_IDS = [
  // Category 1: Extended Biome Footsteps & Human Movement Foley (10)
  'footstep_snow', 'footstep_mud', 'footstep_leaves', 'footstep_moss',
  'footstep_asphalt', 'footstep_sand', 'body_cloth_brush', 'player_sprint_breath',
  'ladder_climb_rung', 'water_wade_splash',
  // Category 2: Living Japanese Mountain Wildlife & Forest Micro-Events (14)
  'wildlife_cuckoo', 'wildlife_crow', 'wildlife_kingfisher', 'wildlife_deer_bark',
  'wildlife_frog_chorus', 'wildlife_branch_snap', 'wildlife_pinecone_drop',
  'wildlife_wing_flutter', 'wildlife_water_fish_jump', 'wildlife_wind_chime_furin',
  'wildlife_shishi_odoshi', 'wildlife_distant_waterfall', 'wildlife_tree_creak_wind',
  'wildlife_stream_pebble_roll',
  // Category 3: Extreme Weather, Alpine Wind & Atmospheric Phenomena (7)
  'weather_wind_gust_howl', 'weather_rain_drizzle_leaves', 'weather_hail_patter',
  'weather_distant_rumble', 'weather_lightning_arc_snap', 'weather_bridge_cable_hum',
  'weather_snow_blizzard_whip',
  // Category 4: Extreme Vehicle Mechanics, Hydraulics & Road Physics (12)
  'vehicle_horn_rv', 'vehicle_horn_armor', 'vehicle_horn_kei', 'vehicle_gear_shift',
  'vehicle_air_brake_hiss', 'vehicle_handbrake_ratchet', 'vehicle_wiper_sweep',
  'vehicle_turn_signal_click', 'vehicle_gravel_undercarriage', 'vehicle_water_ford_surge',
  'vehicle_turbo_spool', 'vehicle_seatbelt_latch',
  // Category 5: Airship K-11 Aviation & SILO-40 Mega-Machinery (5)
  'k11_prop_pitch_feather', 'k11_cabin_pressurize', 'k11_altitude_wind_shear',
  'silo_blast_door_klaxon_low', 'silo_cryo_vent_purge',
  // Category 6: Living Japanese Architecture, Traditional Interior & Lab Foley (7)
  'interior_timber_settle', 'interior_tatami_creak', 'interior_shrine_bell_suzu',
  'interior_spa_water_ladle', 'interior_kettle_simmer', 'interior_generator_hum_throb',
  'interior_glass_rain_drip',
  // Category 7: Ultra-Tactile Cartographic Map & Camera UI Foley (4)
  'ui_map_paper_unfold', 'ui_map_zoom_tick', 'ui_map_waypoint_lock', 'ui_camera_shutter',
];

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// =========================================================================
// 1. STUDIO ANALOG WARMTH & COMBUSTION WAVESHAPING CURVES
// =========================================================================

export function buildAnalogWarmthCurve(samples = 1024) {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    // Gentle asymmetric tape/transformer soft saturation: linear at quiet levels, warm rounding at peaks
    const asym = x + 0.045 * x * x;
    curve[i] = Math.tanh(asym * 1.18) / Math.tanh(1.18);
  }
  return curve;
}

export function buildCombustionCurve(samples = 1024) {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    // Asymmetric cylinder firing pressure wave: punchy low-mid harmonics without fizzy clipping
    const shaped = Math.tanh(x * 2.15 + 0.35 * Math.sin(x * Math.PI * 2.0));
    curve[i] = clamp(shaped * 0.92, -1, 1);
  }
  return curve;
}

// =========================================================================
// 2. PHYSICALLY MODELED 4-SPACE STEREO CONVOLUTION IR BUILDER
//    True frequency-dependent air absorption + discrete early reflection taps!
// =========================================================================

export function buildPhysicalIR(ctx, cfg) {
  const sr = ctx.sampleRate;
  const dur = cfg.durationSec || 1.2;
  const len = Math.max(2048, Math.floor(sr * dur));
  const buf = ctx.createBuffer(2, len, sr);
  const preDelaySamples = Math.floor(sr * (cfg.preDelaySec || 0.0));
  const earlyTaps = cfg.earlyTaps || [];
  const lowDecay = cfg.lowDecay || 2.2;
  const highDecay = cfg.highDecay || 4.8;
  const splitHz = cfg.splitHz || 1400;
  const lpfHz = cfg.lpfHz || 5500;
  const gainScale = cfg.gainScale || 0.50;

  const alphaSplit = Math.min(0.98, (2 * Math.PI * splitHz) / (sr + 2 * Math.PI * splitHz));
  const alphaTop = Math.min(0.99, (2 * Math.PI * lpfHz) / (sr + 2 * Math.PI * lpfHz));

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lpSplit = 0;
    let lpTop = 0;
    let dcPrevX = 0;
    let dcPrevY = 0;

    // Diffuse tail with genuine dual-band frequency-dependent RT60 decay
    for (let i = preDelaySamples; i < len; i++) {
      const t = (i - preDelaySamples) / Math.max(1, len - preDelaySamples);
      const fadeIn = Math.min(1.0, (i - preDelaySamples) / Math.max(1, sr * 0.014));
      const envLo = Math.pow(1.0 - t, lowDecay) * fadeIn;
      const envHi = Math.pow(1.0 - t, highDecay) * fadeIn;
      const white = Math.random() * 2 - 1;
      lpSplit += alphaSplit * (white - lpSplit);
      const hiBand = white - lpSplit;
      const mixed = lpSplit * envLo * 0.68 + hiBand * envHi * 0.42;
      lpTop += alphaTop * (mixed - lpTop);
      // Gentle 1-pole DC blocker
      const y = lpTop - dcPrevX + 0.995 * dcPrevY;
      dcPrevX = lpTop;
      dcPrevY = y;
      data[i] = y * gainScale;
    }

    // Discrete early architectural / mountain ridge reflection clusters (stereo decorrelated)
    for (let k = 0; k < earlyTaps.length; k++) {
      const tap = earlyTaps[k];
      const delaySec = tap[0] + (ch === 1 ? (tap[2] || 0.0025) : 0);
      const amp = tap[1] * (ch === 1 ? (tap[3] || 0.94) : 1.0);
      const idx = Math.floor(sr * delaySec);
      if (idx >= 4 && idx < len - 16) {
        // Soft 6-sample air-damped reflection pulse (not a single harsh Dirac spike)
        const pulse = [0.22, 0.62, 1.0, 0.72, 0.34, 0.12];
        const polarity = (k + ch) % 2 === 0 ? 1 : -1;
        for (let p = 0; p < pulse.length; p++) {
          data[idx + p] += amp * pulse[p] * polarity * gainScale;
        }
      }
    }
  }
  return buf;
}

// =========================================================================
// 3. EXTENDED HIGH-DEFINITION MICRO-PHYSICS NOISE BUFFERS
//    - dropletBuf: Minnaert resonant water bubbles (authentic bubbling river/rain!)
//    - gritBuf: Crystalline gravel / frost / pebble micro-transients
//    - foliageBuf: Dry broad-leaf / pine needle / bamboo micro-rustle
// =========================================================================

export function buildExtendedNoiseBuffers(ctx) {
  const sr = ctx.sampleRate;
  const len4 = Math.floor(sr * 4.0);

  // 1. Natural Organic Water Ripple & Soft Lapping Texture (ZERO synthetic sine-chirp bloops!)
  const len6 = Math.floor(sr * 6.0);
  const dropletBuf = ctx.createBuffer(2, len6, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = dropletBuf.getChannelData(ch);
    // Soft continuous brook lapping bed (band-limited 180-1150 Hz pink/brown noise modulated by slow eddies)
    let lpHi = 0, lpLo = 0;
    let eddy1 = randRange(0, Math.PI * 2);
    let eddy2 = randRange(0, Math.PI * 2);
    const w1 = (2 * Math.PI * 0.3333) / sr; // exact 2 cycles per 6s for seamless loop!
    const w2 = (2 * Math.PI * 0.8333) / sr; // exact 5 cycles per 6s for seamless loop!
    for (let i = 0; i < len6; i++) {
      const white = Math.random() * 2 - 1;
      lpHi += 0.14 * (white - lpHi);
      lpLo += 0.028 * (lpHi - lpLo);
      const band = lpHi - lpLo;
      const swell = 0.58 + 0.24 * Math.sin(eddy1 + i * w1) + 0.18 * Math.sin(eddy2 + i * w2);
      d[i] = band * swell * 0.55;
    }
    // Sparse, delicate, non-tonal soft water-lap bursts (filtered noise, NEVER sine pitches!)
    const lapCount = 54;
    for (let b = 0; b < lapCount; b++) {
      const startIdx = Math.floor(Math.random() * (len6 - 3200));
      const durSec = randRange(0.022, 0.068);
      const nSamp = Math.min(len6 - startIdx, Math.floor(sr * durSec));
      const amp = randRange(0.05, 0.18);
      const alpha = randRange(0.08, 0.20);
      let flt = 0;
      for (let i = 0; i < nSamp; i++) {
        const u = i / Math.max(1, nSamp - 1);
        const env = Math.sin(u * Math.PI) * Math.exp(-u * 1.4);
        flt += alpha * ((Math.random() * 2 - 1) - flt);
        d[startIdx + i] += flt * env * amp;
      }
    }
    // Seamless 120ms crossfade at loop boundary so 6s loop never clicks
    const xf = Math.floor(sr * 0.12);
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      d[i] = d[i] * t + d[len6 - xf + i] * (1 - t);
    }
    for (let i = 0; i < len6; i++) d[i] = Math.tanh(d[i] * 0.85);
  }

  // 2. Crystalline Gravel / Pebble / Snow-Crust Micro-Grit Buffer
  const gritBuf = ctx.createBuffer(2, len4, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = gritBuf.getChannelData(ch);
    const grainCount = 950;
    for (let g = 0; g < grainCount; g++) {
      const s0 = Math.floor(Math.random() * (len4 - 800));
      const nS = Math.floor(randRange(24, 210));
      const amp = randRange(0.10, 0.58);
      let prev = 0;
      const hiBias = randRange(0.25, 0.85);
      for (let i = 0; i < nS && (s0 + i) < len4; i++) {
        const env = Math.exp(-i / (nS * 0.30));
        const w = Math.random() * 2 - 1;
        const crisp = w - prev * hiBias;
        prev = w;
        d[s0 + i] += crisp * env * amp;
      }
    }
    for (let i = 0; i < len4; i++) d[i] = Math.tanh(d[i] * 0.9);
  }

  // 3. Dry Autumn Leaf & Conifer Needle Sibilant Foliage Buffer
  const foliageBuf = ctx.createBuffer(2, len4, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = foliageBuf.getChannelData(ch);
    let lp1 = 0, lp2 = 0;
    let burstEnv = 0;
    for (let i = 0; i < len4; i++) {
      if (Math.random() < 0.0022) burstEnv = Math.min(1.0, burstEnv + randRange(0.35, 0.85));
      burstEnv *= 0.9965;
      const w = Math.random() * 2 - 1;
      lp1 += 0.28 * (w - lp1);
      lp2 += 0.06 * (w - lp2);
      const bp = lp1 - lp2;
      d[i] = clamp(bp * (0.28 + burstEnv * 1.15), -1, 1);
    }
  }

  return { dropletBuf, gritBuf, foliageBuf };
}

// =========================================================================
// 4. PHYSICAL-MODELING DSP PRIMITIVES (Modal, Granular, Karplus, Formant)
// =========================================================================

/**
 * True Modal Synthesis: excites a bank of inharmonic resonant modes with a velocity-shaped
 * physical impact striker impulse (NOT a plain sine click). Sounds remarkably lifelike for
 * timber, stone, steel bridges, cast iron furin bells, bamboo shishi-odoshi, and glass!
 */
export function playModalBody(engine, modes, opts = {}) {
  const ctx = engine.ctx;
  if (!ctx || engine.muted || !engine.whiteBuf) return;
  const t = (opts.startTime ?? ctx.currentTime);
  const gainScale = opts.gain ?? 0.14;
  const pan = opts.pan ?? 0;
  const revAmt = opts.reverb ?? 0.28;
  const space = opts.space ?? null;
  const pitchMul = opts.pitchMul ?? 1.0;
  const strikerDur = opts.strikerDur ?? 0.008;
  const strikerHz = opts.strikerHz ?? 2600;
  const bus = opts.bus ?? null;

  // Shared physical impact striker burst
  const strike = ctx.createBufferSource();
  strike.buffer = engine.whiteBuf;
  const sLp = ctx.createBiquadFilter();
  sLp.type = 'lowpass';
  sLp.frequency.value = clamp(strikerHz, 180, 12000);
  const sEnv = ctx.createGain();
  sEnv.gain.setValueAtTime(0.0001, t);
  sEnv.gain.linearRampToValueAtTime(1.0, t + Math.min(0.002, strikerDur * 0.3));
  sEnv.gain.exponentialRampToValueAtTime(0.0001, t + strikerDur);
  strike.connect(sLp);
  sLp.connect(sEnv);

  const outBus = ctx.createGain();
  outBus.gain.value = gainScale;

  // Subtle direct contact thump/click from striker
  if ((opts.directMix ?? 0.12) > 0.005) {
    const dirG = ctx.createGain();
    dirG.gain.value = opts.directMix ?? 0.12;
    sEnv.connect(dirG);
    dirG.connect(outBus);
  }

  let maxDecay = strikerDur + 0.05;
  for (let i = 0; i < modes.length; i++) {
    const [freq, decaySec, amp, qVal] = modes[i];
    const f = clamp(freq * pitchMul, 28, 13000);
    const dSec = Math.max(0.02, decaySec);
    if (dSec > maxDecay) maxDecay = dSec;

    // Resonant bandpass excited by striker + subtly damped harmonic oscillator body
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = qVal ?? clamp(f * dSec * 0.22, 6, 48);

    const mg = ctx.createGain();
    mg.gain.setValueAtTime(amp * 0.9, t);
    mg.gain.exponentialRampToValueAtTime(0.0002, t + dSec);

    sEnv.connect(bp);
    bp.connect(mg);
    mg.connect(outBus);

    // Pure modal decay partial (subtle phase-locked ringing for iron/glass/bamboo/wood body)
    if ((opts.ringMix ?? 0.24) > 0.01) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * randRange(0.996, 1.004);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(amp * (opts.ringMix ?? 0.24), t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dSec);
      o.connect(og);
      og.connect(outBus);
      o.start(t);
      o.stop(t + dSec + 0.03);
    }
  }

  if (bus) {
    outBus.connect(bus);
  } else {
    engine._connectSfx(outBus, pan, revAmt, space);
  }
  strike.start(t, randRange(0, 2.5), Math.min(0.45, strikerDur + 0.04));
}

/**
 * Micro-Granular Foley Scatter: fires N independent micro-grains (snow crystals, pebbles,
 * dry autumn leaves, rain droplets, embers, gravel under tires) with stereo micro-spread.
 */
export function playGranularScatter(engine, opts = {}) {
  const ctx = engine.ctx;
  if (!ctx || engine.muted) return;
  const buf = opts.buffer || engine.gritBuf || engine.pinkBuf;
  if (!buf) return;
  const t0 = opts.startTime ?? ctx.currentTime;
  const count = clamp(opts.count ?? 8, 2, 24);
  const spreadSec = opts.spreadSec ?? 0.14;
  const grainDurLo = opts.grainDurLo ?? 0.012;
  const grainDurHi = opts.grainDurHi ?? 0.036;
  const freqLo = opts.freqLo ?? 900;
  const freqHi = opts.freqHi ?? 4200;
  const qLo = opts.qLo ?? 1.2;
  const qHi = opts.qHi ?? 4.5;
  const gainBase = opts.gain ?? 0.08;
  const panCenter = opts.pan ?? 0;
  const panSpread = opts.panSpread ?? 0.26;
  const revAmt = opts.reverb ?? 0.20;
  const space = opts.space ?? null;
  const decayCurve = opts.decayCurve ?? 1.0;

  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? (i / (count - 1)) : 0;
    const dt = Math.pow(frac, opts.timePower ?? 1.0) * spreadSec + randRange(0, 0.008);
    const gDur = randRange(grainDurLo, grainDurHi);
    const amp = gainBase * Math.pow(1.0 - frac * 0.65, decayCurve) * randRange(0.55, 1.25);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = opts.filterType || 'bandpass';
    bp.frequency.value = randRange(freqLo, freqHi);
    bp.Q.value = randRange(qLo, qHi);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.linearRampToValueAtTime(amp, t0 + dt + Math.min(0.004, gDur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + gDur);

    src.connect(bp);
    bp.connect(g);
    const gPan = clamp(panCenter + randRange(-panSpread, panSpread), -0.92, 0.92);
    engine._connectSfx(g, gPan, revAmt, space);
    src.start(t0 + dt, randRange(0, Math.max(0.2, buf.duration - 0.15)), gDur + 0.02);
  }
}

/**
 * Biological Vocal Tract / Syrinx Formant Synthesizer:
 * Blends harmonic source + air breath turbulence through parallel vocal formant filters
 * with natural organic micro-vibrato & canyon/forest reverb. Strictly warm & zero-beep!
 */
export function playFormantVocal(engine, opts = {}) {
  const ctx = engine.ctx;
  if (!ctx || engine.muted || !engine.pinkBuf) return;
  const t = opts.startTime ?? ctx.currentTime;
  const dur = opts.dur ?? 0.45;
  const fStart = opts.fStart ?? 620;
  const fMid = opts.fMid ?? fStart * 1.05;
  const fEnd = opts.fEnd ?? fStart * 0.88;
  const formants = opts.formants || [[1100, 3.8, 0.85], [2200, 4.5, 0.42]];
  const vibHz = opts.vibHz ?? 5.5;
  const vibDepth = opts.vibDepth ?? (fStart * 0.018);
  const breathAmt = opts.breathAmt ?? 0.24;
  const gain = opts.gain ?? 0.045;
  const pan = opts.pan ?? 0;
  const revAmt = opts.reverb ?? 0.56;
  const space = opts.space ?? 'valley';

  const osc = ctx.createOscillator();
  osc.type = opts.wave || 'sawtooth';
  osc.frequency.setValueAtTime(fStart, t);
  osc.frequency.linearRampToValueAtTime(fMid, t + dur * 0.35);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), t + dur);

  // Organic syrinx / vocal vibrato
  const vib = ctx.createOscillator();
  const vibG = ctx.createGain();
  vib.type = 'sine';
  vib.frequency.value = vibHz;
  vibG.gain.value = vibDepth;
  vib.connect(vibG);
  vibG.connect(osc.frequency);

  // Soft glottal lowpass so raw sawtooth harmonics stay velvety organic
  const glotLp = ctx.createBiquadFilter();
  glotLp.type = 'lowpass';
  glotLp.frequency.value = clamp(fStart * 3.8, 700, 4200);
  osc.connect(glotLp);

  // Parallel air/breath turbulence
  const breath = ctx.createBufferSource();
  breath.buffer = engine.pinkBuf;
  const breathG = ctx.createGain();
  breathG.gain.value = breathAmt;
  breath.connect(breathG);

  const sumIn = ctx.createGain();
  sumIn.gain.value = 1.0;
  glotLp.connect(sumIn);
  breathG.connect(sumIn);

  const masterEnv = ctx.createGain();
  masterEnv.gain.setValueAtTime(0.0001, t);
  masterEnv.gain.linearRampToValueAtTime(gain, t + Math.min(0.08, dur * 0.24));
  masterEnv.gain.setValueAtTime(gain * 0.92, t + dur * 0.65);
  masterEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  for (let i = 0; i < formants.length; i++) {
    const [ff, fq, fg] = formants[i];
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = ff;
    bp.Q.value = fq;
    const fgNode = ctx.createGain();
    fgNode.gain.value = fg;
    sumIn.connect(bp);
    bp.connect(fgNode);
    fgNode.connect(masterEnv);
  }

  engine._connectSfx(masterEnv, pan, revAmt, space);
  osc.start(t); osc.stop(t + dur + 0.04);
  vib.start(t); vib.stop(t + dur + 0.04);
  breath.start(t, randRange(0, 2.5), dur + 0.04);
}

// =========================================================================
// 5. INSTALL ALL 59 BRAND-NEW ULTRA-REALISTIC SFX ON SpatialForestAudio
// =========================================================================

export function installHyperFoleyV4(AudioClass) {
  const P = AudioClass.prototype;

  // -----------------------------------------------------------------------
  // CATEGORY 1: EXTENDED BIOME FOOTSTEPS & HUMAN MOVEMENT FOLEY (+10)
  // -----------------------------------------------------------------------

  P.playFootstepSnow = function (opts = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const vel = opts.crouch ? 0.55 : (opts.sprint ? 1.30 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.14;
    // Soft compressed alpine powder thud (heel compression)
    const th = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(randRange(92, 112), t);
    th.frequency.exponentialRampToValueAtTime(34, t + 0.085);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.linearRampToValueAtTime(0.085 * vel, t + 0.009);
    tg.gain.exponentialRampToValueAtTime(0.0005, t + 0.095);
    th.connect(tg);
    this._connectSfx(tg, pan, 0.12, 'valley');
    th.start(t); th.stop(t + 0.11);

    // 11-grain crystalline cold snow shear crunch ("ギュッ…キュッ")
    playGranularScatter(this, {
      buffer: this.gritBuf || this.whiteBuf,
      startTime: t + 0.005,
      count: opts.sprint ? 13 : 10,
      spreadSec: opts.sprint ? 0.095 : 0.125,
      grainDurLo: 0.010, grainDurHi: 0.026,
      freqLo: 2400, freqHi: 6800,
      qLo: 1.8, qHi: 4.2,
      gain: 0.068 * vel,
      pan, panSpread: 0.16,
      reverb: 0.10, space: 'valley',
    });
  };

  P.playFootstepMud = function (opts = {}) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const vel = opts.crouch ? 0.55 : (opts.sprint ? 1.28 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.15;

    // 1. Damp wet heel sink squelch
    const sink = this.ctx.createBufferSource();
    sink.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(randRange(520, 740), t);
    bp.frequency.exponentialRampToValueAtTime(190, t + 0.12);
    bp.Q.value = 3.2;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.11 * vel, t + 0.014);
    sg.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
    sink.connect(bp); bp.connect(sg);
    this._connectSfx(sg, pan, 0.16, 'valley');
    sink.start(t, randRange(0, 2.5), 0.16);

    // 2. Viscous mud suction release pop (toe lift!)
    const sucT = t + randRange(0.068, 0.098);
    const suc = this.ctx.createOscillator();
    const sucG = this.ctx.createGain();
    suc.type = 'sine';
    suc.frequency.setValueAtTime(165, sucT);
    suc.frequency.exponentialRampToValueAtTime(540, sucT + 0.055);
    sucG.gain.setValueAtTime(0.0001, sucT);
    sucG.gain.linearRampToValueAtTime(0.055 * vel, sucT + 0.015);
    sucG.gain.exponentialRampToValueAtTime(0.0005, sucT + 0.068);
    suc.connect(sucG);
    this._connectSfx(sucG, pan, 0.14, 'valley');
    suc.start(sucT); suc.stop(sucT + 0.075);

    // Wet micro-droplet splatter
    playGranularScatter(this, {
      buffer: this.dropletBuf || this.crackleBuf,
      startTime: sucT,
      count: 6, spreadSec: 0.07,
      grainDurLo: 0.014, grainDurHi: 0.032,
      freqLo: 850, freqHi: 2600,
      gain: 0.048 * vel, pan, panSpread: 0.22, reverb: 0.16,
    });
  };

  P.playFootstepLeaves = function (opts = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const vel = opts.crouch ? 0.52 : (opts.sprint ? 1.32 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.15;

    // Soft forest loam base
    const lo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lo.type = 'sine';
    lo.frequency.setValueAtTime(98, t);
    lo.frequency.exponentialRampToValueAtTime(36, t + 0.075);
    lg.gain.setValueAtTime(0.075 * vel, t);
    lg.gain.exponentialRampToValueAtTime(0.0005, t + 0.082);
    lo.connect(lg);
    this._connectSfx(lg, pan, 0.14);
    lo.start(t); lo.stop(t + 0.09);

    // 10-grain dry autumn maple/buna leaf crunch & scatter ("カサッ・パリッ")
    playGranularScatter(this, {
      buffer: this.foliageBuf || this.crackleBuf,
      startTime: t,
      count: opts.sprint ? 12 : 9,
      spreadSec: 0.145,
      grainDurLo: 0.016, grainDurHi: 0.045,
      freqLo: 1500, freqHi: 5800,
      qLo: 1.0, qHi: 2.8,
      gain: 0.082 * vel,
      pan, panSpread: 0.28,
      reverb: 0.18, space: 'valley',
    });
  };

  P.playFootstepMoss = function (opts = {}) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const vel = opts.crouch ? 0.50 : (opts.sprint ? 1.25 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.13;

    // Plush damp mossy carpet muffled low thump
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.135 * vel, t + 0.016);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.115);
    src.connect(lp); lp.connect(g);
    this._connectSfx(g, pan, 0.12);
    src.start(t, randRange(0, 2.5), 0.13);

    // Soft organic lichen / damp pine-needle brush
    playGranularScatter(this, {
      buffer: this.foliageBuf || this.pinkBuf,
      startTime: t + 0.025,
      count: 5, spreadSec: 0.085,
      grainDurLo: 0.018, grainDurHi: 0.042,
      freqLo: 650, freqHi: 1850,
      qLo: 0.9, qHi: 1.8,
      gain: 0.036 * vel, pan, panSpread: 0.18, reverb: 0.12,
    });
  };

  P.playFootstepAsphalt = function (opts = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const vel = opts.crouch ? 0.54 : (opts.sprint ? 1.32 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.13;

    // Phase 1: Solid granite-tarmac heel impact (tight modal stone body)
    playModalBody(this, [
      [148, 0.055, 0.55, 5],
      [420, 0.038, 0.42, 7],
      [1180, 0.024, 0.34, 9],
      [2850, 0.016, 0.25, 11],
    ], {
      startTime: t,
      gain: 0.10 * vel,
      pan, reverb: 0.20, space: 'valley',
      strikerDur: 0.006, strikerHz: 4600,
      ringMix: 0.08, directMix: 0.35,
      pitchMul: randRange(0.93, 1.08),
    });

    // Phase 2: Rubber boot sole toe-roll + tiny tarmac grit scuff
    playGranularScatter(this, {
      buffer: this.gritBuf || this.pinkBuf,
      startTime: t + randRange(0.048, 0.068),
      count: 5, spreadSec: 0.045,
      grainDurLo: 0.008, grainDurHi: 0.020,
      freqLo: 1400, freqHi: 4600,
      gain: 0.048 * vel, pan, panSpread: 0.10, reverb: 0.18, space: 'valley',
    });
  };

  P.playFootstepSand = function (opts = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const vel = opts.crouch ? 0.54 : (opts.sprint ? 1.30 : 1.0);
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.14;

    // Damp riverbank sand heel press + sliding sibilant sand grains
    playGranularScatter(this, {
      buffer: this.gritBuf || this.pinkBuf,
      startTime: t,
      count: 11, spreadSec: 0.135,
      grainDurLo: 0.014, grainDurHi: 0.035,
      freqLo: 1800, freqHi: 5200,
      qLo: 0.8, qHi: 2.0,
      gain: 0.056 * vel, pan, panSpread: 0.18, reverb: 0.14, space: 'valley',
    });
    const th = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(86, t);
    th.frequency.exponentialRampToValueAtTime(34, t + 0.075);
    tg.gain.setValueAtTime(0.065 * vel, t);
    tg.gain.exponentialRampToValueAtTime(0.0005, t + 0.085);
    th.connect(tg);
    this._connectSfx(tg, pan, 0.12);
    th.start(t); th.stop(t + 0.095);
  };

  P.playBodyClothBrush = function (intensity = 0.7, pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.2);
    // Stereo sweeping brush through kumazasa bamboo & fern undergrowth + outdoor jacket rustle
    [-0.38, 0.38].forEach((side, i) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.foliageBuf || this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(randRange(1400, 2200), t + i * 0.045);
      bp.frequency.exponentialRampToValueAtTime(randRange(680, 1150), t + 0.28 + i * 0.045);
      bp.Q.value = 1.15;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.045);
      g.gain.linearRampToValueAtTime(0.065 * amp, t + 0.06 + i * 0.045);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 0.30 + i * 0.045);
      src.connect(bp); bp.connect(g);
      this._connectSfx(g, clamp(pan + side, -0.85, 0.85), 0.16, 'valley');
      src.start(t + i * 0.045, randRange(0, 2.5), 0.34);
    });
  };

  P.playSprintBreath = function (exertion = 0.6) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(exertion, 0.2, 1.0);
    // Soft realistic exhale breath through vocal mouth cavity formants
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp1 = this.ctx.createBiquadFilter();
    bp1.type = 'bandpass'; bp1.frequency.setValueAtTime(760, t); bp1.frequency.linearRampToValueAtTime(520, t + 0.32); bp1.Q.value = 2.6;
    const bp2 = this.ctx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.frequency.value = 1850; bp2.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.036 * amp, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.35);
    src.connect(bp1); bp1.connect(g);
    src.connect(bp2); bp2.connect(g);
    this._connectSfx(g, 0, 0.08);
    src.start(t, randRange(0, 2.5), 0.38);
  };

  P.playLadderRung = function (metal = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._footParity = -this._footParity;
    const pan = this._footParity * 0.18;
    const modes = metal
      ? [[225, 0.14, 0.65, 16], [562, 0.11, 0.55, 22], [1180, 0.08, 0.38, 28], [2480, 0.05, 0.24, 34]]
      : [[175, 0.09, 0.65, 10], [440, 0.065, 0.48, 12], [960, 0.04, 0.30, 15], [1980, 0.025, 0.18, 18]];
    playModalBody(this, modes, {
      startTime: t, gain: 0.095, pan, reverb: 0.26,
      strikerDur: 0.006, strikerHz: metal ? 4200 : 2400,
      ringMix: metal ? 0.28 : 0.14, pitchMul: randRange(0.94, 1.07),
    });
  };

  P.playWaterWadeSplash = function (intensity = 0.75) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.25, 1.2);
    // Soft natural stream wade swirl
    const surge = this.ctx.createBufferSource();
    surge.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(640, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + 0.34);
    bp.Q.value = 0.65;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.058 * amp, t + 0.045);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.38);
    surge.connect(bp); bp.connect(g);
    this._connectSfx(g, randRange(-0.18, 0.18), 0.14, 'valley');
    surge.start(t, randRange(0, 2.5), 0.42);

    // Subtle soft water trail
    playGranularScatter(this, {
      buffer: this.dropletBuf || this.pinkBuf,
      startTime: t + 0.08,
      count: 6, spreadSec: 0.30,
      grainDurLo: 0.018, grainDurHi: 0.044,
      freqLo: 420, freqHi: 1250,
      gain: 0.024 * amp, pan: 0, panSpread: 0.32, reverb: 0.14, space: 'valley',
    });
  };

  // -----------------------------------------------------------------------
  // CATEGORY 2: LIVING JAPANESE MOUNTAIN WILDLIFE & FOREST MICRO-EVENTS (+14)
  // -----------------------------------------------------------------------

  P.playCuckooCall = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Iconic Japanese mountain Cuckoo ("カッ・コー" — minor-third descending soft syrinx call)
    const fHi = randRange(695, 745);
    const fLo = fHi * 0.80;
    const calls = Math.random() < 0.65 ? 2 : 1;
    for (let c = 0; c < calls; c++) {
      const off = c * 1.18;
      playFormantVocal(this, {
        startTime: t + off, dur: 0.14,
        fStart: fHi * 0.97, fMid: fHi, fEnd: fHi * 0.96,
        wave: 'triangle', formants: [[fHi, 5.2, 1.0], [fHi * 2, 6.0, 0.18]],
        breathAmt: 0.16, gain: 0.032, pan, reverb: 0.68, space: 'valley',
      });
      playFormantVocal(this, {
        startTime: t + off + 0.24, dur: 0.28,
        fStart: fLo * 1.02, fMid: fLo, fEnd: fLo * 0.94,
        wave: 'triangle', formants: [[fLo, 5.2, 1.0], [fLo * 2, 6.0, 0.16]],
        breathAmt: 0.18, gain: 0.034, pan, reverb: 0.72, space: 'valley',
      });
    }
  };

  P.playCrowCaw = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Deep mountain Hashibuto-garasu crow ("カー、カー") with throaty formant rasp
    const count = Math.random() < 0.55 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const dt = i * randRange(0.52, 0.66);
      const f0 = randRange(285, 345);
      playFormantVocal(this, {
        startTime: t + dt, dur: randRange(0.32, 0.44),
        fStart: f0 * 0.92, fMid: f0 * 1.08, fEnd: f0 * 0.78,
        wave: 'sawtooth',
        formants: [[980, 3.2, 0.90], [1680, 4.0, 0.65], [2550, 5.0, 0.30]],
        vibHz: 28, vibDepth: 11, breathAmt: 0.35,
        gain: 0.036, pan: clamp(pan + randRange(-0.08, 0.08), -0.9, 0.9),
        reverb: 0.65, space: 'valley',
      });
    }
  };

  P.playKingfisherDive = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Soft riverside Kawasemi quick melodic double-note + clean water plunge plop
    [0, 0.15].forEach((d, idx) => {
      playFormantVocal(this, {
        startTime: t + d, dur: 0.095,
        fStart: idx === 0 ? 1580 : 1720, fMid: 1640, fEnd: 1380,
        wave: 'sine', formants: [[1650, 4.0, 0.9]],
        breathAmt: 0.12, gain: 0.022, pan, reverb: 0.42, space: 'valley',
      });
    });
    // Clean tiny vertical dive plop into Kurosugi River
    const plopT = t + 0.52;
    const pOsc = this.ctx.createOscillator();
    const pG = this.ctx.createGain();
    pOsc.type = 'sine';
    pOsc.frequency.setValueAtTime(340, plopT);
    pOsc.frequency.exponentialRampToValueAtTime(1180, plopT + 0.075);
    pG.gain.setValueAtTime(0.0001, plopT);
    pG.gain.linearRampToValueAtTime(0.048, plopT + 0.008);
    pG.gain.exponentialRampToValueAtTime(0.0004, plopT + 0.095);
    pOsc.connect(pG);
    this._connectSfx(pG, pan, 0.36, 'valley');
    pOsc.start(plopT); pOsc.stop(plopT + 0.11);
  };

  P.playDeerBark = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Distant Japanese Shika deer crisp twilight alarm bark + hooves darting across leaves
    playFormantVocal(this, {
      startTime: t, dur: 0.24,
      fStart: 540, fMid: 680, fEnd: 310,
      wave: 'sawtooth',
      formants: [[840, 2.8, 0.95], [1620, 3.6, 0.55]],
      vibHz: 14, vibDepth: 16, breathAmt: 0.42,
      gain: 0.036, pan, reverb: 0.68, space: 'valley',
    });
    // Distant muffled bounding leaf steps receding
    playGranularScatter(this, {
      buffer: this.foliageBuf || this.pinkBuf,
      startTime: t + 0.34,
      count: 6, spreadSec: 0.72,
      grainDurLo: 0.035, grainDurHi: 0.07,
      freqLo: 850, freqHi: 2600,
      gain: 0.032, pan: clamp(pan * 1.15, -0.9, 0.9), panSpread: 0.14,
      reverb: 0.35, space: 'valley', decayCurve: 1.8,
    });
  };

  P.playFrogChorus = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Gentle Japanese stream frog (カジカガエル — warm liquid flute-like trill at mellow ~1150Hz, NEVER sharp!)
    const f0 = randRange(1060, 1260);
    const notes = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const dt = i * 0.115;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      o.type = 'sine';
      lp.type = 'lowpass'; lp.frequency.value = 1900;
      o.frequency.setValueAtTime(f0 * (0.94 + i * 0.015), t + dt);
      o.frequency.linearRampToValueAtTime(f0 * (1.03 + i * 0.01), t + dt + 0.075);
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.linearRampToValueAtTime(0.017, t + dt + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0002, t + dt + 0.10);
      o.connect(lp); lp.connect(g);
      this._connectSfx(g, pan, 0.52, 'valley');
      o.start(t + dt); o.stop(t + dt + 0.11);
    }
  };

  P.playBranchSnap = function (pan = 0, intensity = 0.75) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.25, 1.1);
    // Crisp dry cedar twig fracture (2 staggered sharp modal wood cracks + falling leaf rustle)
    [0, randRange(0.022, 0.048)].forEach((off, idx) => {
      playModalBody(this, [
        [340, 0.032, 0.55, 7],
        [920, 0.025, 0.75, 11],
        [1950, 0.018, 0.62, 14],
        [3600, 0.012, 0.42, 16],
      ], {
        startTime: t + off,
        gain: (idx === 0 ? 0.11 : 0.075) * amp,
        pan, reverb: 0.42, space: 'valley',
        strikerDur: 0.004, strikerHz: 5800,
        ringMix: 0.12, directMix: 0.40,
        pitchMul: randRange(0.86, 1.18),
      });
    });
    playGranularScatter(this, {
      buffer: this.foliageBuf || this.pinkBuf,
      startTime: t + 0.06,
      count: 6, spreadSec: 0.24,
      grainDurLo: 0.020, grainDurHi: 0.055,
      freqLo: 1100, freqHi: 3800,
      gain: 0.036 * amp, pan, panSpread: 0.20, reverb: 0.28, space: 'valley',
    });
  };

  P.playPineconeDrop = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Pine cone tumbling through 3 cedar boughs before soft moss bounce
    [0, 0.14, 0.29].forEach((off, idx) => {
      playGranularScatter(this, {
        buffer: this.foliageBuf || this.pinkBuf,
        startTime: t + off,
        count: 3, spreadSec: 0.045,
        grainDurLo: 0.012, grainDurHi: 0.028,
        freqLo: 1400, freqHi: 3800,
        gain: 0.032 * (0.7 + idx * 0.15), pan, panSpread: 0.12, reverb: 0.22, space: 'valley',
      });
    });
    playModalBody(this, [
      [145, 0.055, 0.70, 5],
      [340, 0.035, 0.45, 8],
    ], {
      startTime: t + 0.44, gain: 0.068, pan, reverb: 0.22, space: 'valley',
      strikerDur: 0.008, strikerHz: 1100, ringMix: 0.10,
    });
  };

  P.playWingFlutter = function (pan = 0) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Startled forest jay / pigeon rapid feathered wingbeats (7 rapid low-mid air slaps receding)
    const flaps = 7;
    for (let i = 0; i < flaps; i++) {
      const dt = i * 0.058 + randRange(0, 0.006);
      const fade = Math.pow(1.0 - i / flaps, 0.75);
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(randRange(420, 660), t + dt);
      bp.Q.value = 1.15;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.linearRampToValueAtTime(0.088 * fade, t + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0004, t + dt + 0.048);
      src.connect(bp); bp.connect(g);
      const curPan = clamp(pan + (pan >= 0 ? 1 : -1) * i * 0.05, -0.9, 0.9);
      this._connectSfx(g, curPan, 0.34, 'valley');
      src.start(t + dt, randRange(0, 2.5), 0.058);
    }
  };

  P.playWaterFishJump = function (pan = 0) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // River trout breaching out of Kurosugi River and splashing cleanly back down
    [0, 0.28].forEach((off, idx) => {
      const amp = idx === 0 ? 0.65 : 1.0;
      const spl = this.ctx.createBufferSource();
      spl.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(idx === 0 ? 1350 : 920, t + off);
      bp.frequency.exponentialRampToValueAtTime(380, t + off + 0.24);
      bp.Q.value = 1.1;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.linearRampToValueAtTime(0.095 * amp, t + off + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0004, t + off + 0.26);
      spl.connect(bp); bp.connect(g);
      this._connectSfx(g, pan, 0.38, 'valley');
      spl.start(t + off, randRange(0, 2.5), 0.28);
    });
    playGranularScatter(this, {
      buffer: this.dropletBuf || this.crackleBuf,
      startTime: t + 0.30,
      count: 9, spreadSec: 0.32,
      grainDurLo: 0.016, grainDurHi: 0.045,
      freqLo: 850, freqHi: 2900,
      gain: 0.062, pan, panSpread: 0.25, reverb: 0.36, space: 'valley',
    });
  };

  P.playWindChimeFurin = function (pan = 0, intensity = 0.65) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.0);
    // Authentic Nanbu cast-iron Furin (南部鉄器風鈴) — shimmering warm inharmonic iron bell modes!
    const strikes = Math.random() < 0.6 ? 2 : 1;
    for (let s = 0; s < strikes; s++) {
      const dt = s * randRange(0.28, 0.56);
      playModalBody(this, [
        [1185, 2.10, 0.42, 42],
        [1202, 1.95, 0.38, 44], // Authentic cast-iron slow acoustic beating!
        [2340, 1.35, 0.22, 48],
        [3420, 0.72, 0.10, 40],
      ], {
        startTime: t + dt,
        gain: 0.046 * amp * (s === 0 ? 1.0 : 0.72),
        pan, reverb: 0.48, space: 'valley',
        strikerDur: 0.003, strikerHz: 4800,
        ringMix: 0.58, directMix: 0.04,
        pitchMul: randRange(0.97, 1.03),
      });
    }
  };

  P.playShishiOdoshi = function (pan = 0, proximity = 0.85) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(proximity, 0.15, 1.0);
    // 1. Water tipping out of bamboo tube
    playGranularScatter(this, {
      buffer: this.dropletBuf || this.pinkBuf,
      startTime: t,
      count: 7, spreadSec: 0.22,
      grainDurLo: 0.020, grainDurHi: 0.050,
      freqLo: 950, freqHi: 2600,
      gain: 0.055 * amp, pan, panSpread: 0.12, reverb: 0.32, space: 'valley',
    });
    // 2. Iconic hollow seasoned bamboo tube tipping back and striking wet garden stone ("カコーン！")
    playModalBody(this, [
      [392, 0.24, 0.85, 24],
      [785, 0.18, 0.62, 28],
      [1290, 0.12, 0.42, 30],
      [2180, 0.06, 0.24, 24],
    ], {
      startTime: t + 0.26,
      gain: 0.135 * amp,
      pan, reverb: 0.52, space: 'valley',
      strikerDur: 0.005, strikerHz: 3200,
      ringMix: 0.42, directMix: 0.16,
      pitchMul: randRange(0.96, 1.04),
    });
  };

  P.playDistantWaterfallSurge = function (intensity = 0.5, pan = 0) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.15, 1.0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320 + amp * 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.036 * amp, t + 0.95);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 2.6);
    src.connect(lp); lp.connect(g);
    this._connectSfx(g, pan, 0.32, 'valley');
    src.start(t, randRange(0, 1.5), 2.7);
  };

  P.playTreeCreakWind = function (pan = 0, intensity = 0.7) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.1);
    // Ancient Sugi trunk slow stick-slip wood groan in strong mountain wind
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = randRange(74, 118);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.14, t + 0.42);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + 1.18);
    // Stick-slip AM modulation (14-22Hz slow fibrous wood chatter)
    const am = this.ctx.createOscillator();
    const amG = this.ctx.createGain();
    am.frequency.setValueAtTime(19, t);
    am.frequency.linearRampToValueAtTime(9, t + 1.15);
    amG.gain.value = 0.35;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 4.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.052 * amp, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0003, t + 1.25);
    am.connect(amG); amG.connect(g.gain);
    o.connect(bp); bp.connect(g);
    this._connectSfx(g, pan, 0.48, 'valley');
    o.start(t); o.stop(t + 1.30);
    am.start(t); am.stop(t + 1.30);
  };

  P.playStreamPebbleRoll = function (pan = 0, intensity = 0.6) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.0);
    // Submerged smooth river cobbles tumbling underwater (muffled water-damped stone clicks)
    const knocks = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < knocks; i++) {
      const dt = i * randRange(0.045, 0.11);
      playModalBody(this, [
        [290, 0.032, 0.65, 8],
        [680, 0.022, 0.48, 12],
      ], {
        startTime: t + dt, gain: 0.048 * amp * randRange(0.6, 1.1),
        pan: clamp(pan + randRange(-0.15, 0.15), -0.9, 0.9),
        reverb: 0.22, space: 'valley',
        strikerDur: 0.005, strikerHz: 1400, ringMix: 0.15,
        pitchMul: randRange(0.82, 1.25),
      });
    }
  };

  // -----------------------------------------------------------------------
  // CATEGORY 3: EXTREME WEATHER, ALPINE WIND & ATMOSPHERIC PHENOMENA (+7)
  // -----------------------------------------------------------------------

  P.playWindGustHowl = function (intensity = 0.75, pan = 0) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.2);
    // Sweeping alpine ridge wind gust with warm hollow ridge resonance (low-mid 190-540Hz)
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(195, t);
    bp.frequency.exponentialRampToValueAtTime(480 + amp * 160, t + 1.15);
    bp.frequency.exponentialRampToValueAtTime(175, t + 2.85);
    bp.Q.value = 3.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.115 * amp, t + 0.95);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 2.95);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, pan, 0.45, 'valley');
    src.start(t, randRange(0, 1.2), 3.05);
  };

  P.playRainDrizzleLeaves = function (intensity = 0.65) {
    if (!this.ctx || this.muted) return;
    const amp = clamp(intensity, 0.2, 1.0);
    // Big rainwater drops pattering individually on broad maple/buna foliage overhead
    playGranularScatter(this, {
      buffer: this.dropletBuf || this.crackleBuf,
      count: 14, spreadSec: 0.85,
      grainDurLo: 0.014, grainDurHi: 0.036,
      freqLo: 900, freqHi: 3200,
      qLo: 1.4, qHi: 3.4,
      gain: 0.056 * amp, pan: 0, panSpread: 0.78,
      reverb: 0.28, space: 'valley', decayCurve: 0.4,
    });
  };

  P.playHailPatter = function (roofKind = 'metal', intensity = 0.75) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.2);
    // Ice pellets bouncing crisply off metal vehicle roof / glass / timber deck!
    const hits = 8 + Math.floor(Math.random() * 6);
    const isMetal = roofKind === 'metal';
    for (let i = 0; i < hits; i++) {
      const dt = Math.random() * 0.65;
      const modes = isMetal
        ? [[680, 0.055, 0.6, 18], [1640, 0.042, 0.55, 24], [3280, 0.028, 0.38, 28]]
        : [[420, 0.035, 0.6, 10], [1240, 0.022, 0.45, 14], [2680, 0.015, 0.30, 18]];
      playModalBody(this, modes, {
        startTime: t + dt,
        gain: 0.052 * amp * randRange(0.55, 1.2),
        pan: randRange(-0.78, 0.78),
        reverb: isMetal ? 0.24 : 0.18,
        strikerDur: 0.003, strikerHz: 6200,
        ringMix: isMetal ? 0.32 : 0.14,
        pitchMul: randRange(0.82, 1.28),
      });
    }
  };

  P.playDistantStormRumble = function (intensity = 0.6) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.0);
    // Low sub-bass distant thunderhead rolling behind mountain ridges
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(118, t);
    lp.frequency.exponentialRampToValueAtTime(42, t + 3.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18 * amp, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 3.4);
    src.connect(lp); lp.connect(g);
    this._connectSfx(g, randRange(-0.6, 0.6), 0.62, 'valley');
    src.start(t, randRange(0, 0.8), 3.5);
  };

  P.playLightningArcSnap = function (pan = 0) {
    if (!this.ctx || this.muted || !this.whiteBuf) return;
    const t = this.ctx.currentTime;
    // Ultra-close (<200m) lightning leader ionization whip-crack + N-wave shockwave boom!
    playGranularScatter(this, {
      buffer: this.gritBuf || this.whiteBuf,
      startTime: t,
      count: 10, spreadSec: 0.085,
      grainDurLo: 0.008, grainDurHi: 0.022,
      freqLo: 2200, freqHi: 8400,
      qLo: 0.7, qHi: 1.8,
      gain: 0.18, pan, panSpread: 0.35, reverb: 0.55, space: 'valley',
    });
    const boom = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(125, t + 0.015);
    boom.frequency.exponentialRampToValueAtTime(24, t + 0.55);
    bg.gain.setValueAtTime(0.0001, t + 0.015);
    bg.gain.linearRampToValueAtTime(0.32, t + 0.028);
    bg.gain.exponentialRampToValueAtTime(0.0005, t + 0.62);
    boom.connect(bg);
    this._connectSfx(bg, pan, 0.65, 'valley');
    boom.start(t + 0.015); boom.stop(t + 0.68);
  };

  P.playBridgeCableHum = function (intensity = 0.55) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.15, 1.0);
    // Aeolian wind harmonics singing softly through vermilion steel arch bridge trusses
    [146.8, 220.0, 293.6].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.99, t);
      o.frequency.linearRampToValueAtTime(freq * 1.01, t + 1.4);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((0.018 / (i + 1)) * amp, t + 0.65);
      g.gain.exponentialRampToValueAtTime(0.0002, t + 2.2);
      o.connect(g);
      this._connectSfx(g, i === 1 ? 0 : (i === 0 ? -0.45 : 0.45), 0.42, 'valley');
      o.start(t); o.stop(t + 2.28);
    });
  };

  P.playSnowBlizzardWhip = function (intensity = 0.7) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.1);
    // High-altitude (>1,000m ASL) dry spindrift snow crystals whipping over alpine granite ridge
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1400, t);
    hp.frequency.linearRampToValueAtTime(2800, t + 0.9);
    hp.frequency.linearRampToValueAtTime(1100, t + 2.1);
    hp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075 * amp, t + 0.65);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 2.2);
    src.connect(hp); hp.connect(g);
    this._connectSfx(g, randRange(-0.5, 0.5), 0.36, 'valley');
    src.start(t, randRange(0, 1.5), 2.3);
  };

  // -----------------------------------------------------------------------
  // CATEGORY 4: EXTREME VEHICLE MECHANICS, HYDRAULICS & ROAD PHYSICS (+12)
  // -----------------------------------------------------------------------

  P.playVehicleHorn = function (vehicleKey = 'camper', dur = 0.42) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const isArmor = vehicleKey === 'armor';
    const isKei = vehicleKey === 'kei';
    // Realistic dual-tone brass diaphragm / compressed-air trumpet chords with valley echo!
    const freqs = isArmor ? [212, 267, 318] : (isKei ? [488] : [396, 498]);
    const hornDur = isArmor ? Math.max(0.55, dur) : (isKei ? Math.min(0.28, dur) : dur);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(isArmor ? 0.145 : (isKei ? 0.095 : 0.115), t + 0.022);
    out.gain.setValueAtTime(isArmor ? 0.135 : 0.105, t + hornDur - 0.05);
    out.gain.exponentialRampToValueAtTime(0.0004, t + hornDur + 0.06);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = isArmor ? 1450 : (isKei ? 2400 : 1950);
    lp.Q.value = 1.8;
    lp.connect(out);

    freqs.forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.985, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.035);
      const fg = this.ctx.createGain();
      fg.gain.value = idx === 2 ? 0.42 : 0.65;
      o.connect(fg);
      fg.connect(lp);
      o.start(t); o.stop(t + hornDur + 0.09);
    });
    // Compressed air burst attack on heavy Armor air horn
    if (isArmor && this.pinkBuf) {
      const air = this.ctx.createBufferSource();
      air.buffer = this.pinkBuf;
      const abp = this.ctx.createBiquadFilter();
      abp.type = 'bandpass'; abp.frequency.value = 1400; abp.Q.value = 1.2;
      const ag = this.ctx.createGain();
      ag.gain.setValueAtTime(0.06, t);
      ag.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      air.connect(abp); abp.connect(ag); ag.connect(out);
      air.start(t, randRange(0, 2.0), 0.14);
    }
    this._connectSfx(out, 0, 0.58, 'valley');
  };

  P.playGearShift = function (upshift = true, profile = 'diesel') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Heavy steel shift gate clunk + synchronized drivetrain thump + subtle turbo blow-off sigh
    playModalBody(this, [
      [185, 0.065, 0.72, 9],
      [540, 0.045, 0.55, 14],
      [1420, 0.025, 0.32, 18],
    ], {
      startTime: t, gain: 0.088, pan: 0.18, reverb: 0.14,
      strikerDur: 0.005, strikerHz: 3200, ringMix: 0.18,
      pitchMul: upshift ? 1.05 : 0.90,
    });
    if (upshift && (profile === 'diesel' || profile === 'armor') && this.pinkBuf) {
      // Subtle pneumatic turbo wastegate sigh ("シュッ") on upshift
      const pss = this.ctx.createBufferSource();
      pss.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200, t + 0.03);
      bp.frequency.exponentialRampToValueAtTime(950, t + 0.19);
      bp.Q.value = 2.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.03);
      g.gain.linearRampToValueAtTime(0.046, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.21);
      pss.connect(bp); bp.connect(g);
      this._connectSfx(g, 0, 0.15);
      pss.start(t + 0.03, randRange(0, 2.5), 0.24);
    }
  };

  P.playAirBrakeHiss = function (intensity = 0.8) {
    if (!this.ctx || this.muted || !this.whiteBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.25, 1.2);
    // Heavy truck pneumatic air-brake valve purge hiss ("プシュゥーッ！")
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, t);
    bp.frequency.exponentialRampToValueAtTime(1120, t + 0.42);
    bp.Q.value = 1.45;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.115 * amp, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.46);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.24, 'valley');
    src.start(t, randRange(0, 2.0), 0.50);
  };

  P.playHandbrakeRatchet = function (engage = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Tactile 5-tooth steel parking brake ratchet ("カリカリカリッ！")
    const clicks = engage ? 5 : 2;
    for (let i = 0; i < clicks; i++) {
      const dt = i * 0.034;
      playModalBody(this, [
        [980, 0.022, 0.62, 18],
        [2480, 0.014, 0.55, 22],
        [4600, 0.010, 0.35, 24],
      ], {
        startTime: t + dt, gain: 0.072 * (0.75 + i * 0.08),
        pan: 0.22, reverb: 0.10, strikerDur: 0.003, strikerHz: 6200,
        ringMix: 0.20, pitchMul: 0.94 + i * 0.04,
      });
    }
  };

  P.playWiperSweep = function (wetness = 0.8) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const wet = clamp(wetness, 0.2, 1.0);
    // Outward + return rubber blade wet sweep across windshield + quiet cabin wiper motor
    [0, 0.52].forEach((off, idx) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(idx === 0 ? 520 : 640, t + off);
      bp.frequency.linearRampToValueAtTime(idx === 0 ? 920 : 480, t + off + 0.36);
      bp.Q.value = 2.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.linearRampToValueAtTime(0.032 * wet, t + off + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0003, t + off + 0.40);
      src.connect(bp); bp.connect(g);
      this._connectSfx(g, idx === 0 ? -0.18 : 0.18, 0.08);
      src.start(t + off, randRange(0, 2.5), 0.44);
    });
  };

  P.playTurnSignalClick = function (highTick = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Authentic warm Japanese dashboard flasher relay ("カチッ / コチッ")
    playModalBody(this, [
      [highTick ? 1120 : 880, 0.016, 0.70, 14],
      [highTick ? 2850 : 2240, 0.010, 0.45, 18],
    ], {
      startTime: t, gain: 0.048, pan: -0.12, reverb: 0.06,
      strikerDur: 0.0025, strikerHz: 4400, ringMix: 0.14,
    });
  };

  P.playGravelUndercarriage = function (speedNorm = 0.6) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(speedNorm, 0.2, 1.2);
    // Tiny loose stones kicked up by tires pinging crisply against wheel wells & steel skid plate
    const pings = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < pings; i++) {
      const dt = Math.random() * 0.28;
      playModalBody(this, [
        [720, 0.035, 0.55, 16],
        [1840, 0.025, 0.62, 22],
        [3750, 0.016, 0.40, 26],
      ], {
        startTime: t + dt,
        gain: 0.044 * amp * randRange(0.5, 1.15),
        pan: randRange(-0.65, 0.65),
        reverb: 0.12, strikerDur: 0.003, strikerHz: 6000,
        ringMix: 0.26, pitchMul: randRange(0.80, 1.32),
      });
    }
  };

  P.playWaterFordSurge = function (speedNorm = 0.6, depth = 0.3) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(0.4 + speedNorm * 0.6 + depth * 0.5, 0.3, 1.3);
    // Heavy twin-wheel bow wave & wheel-arch spray surging through shallow stream / puddles
    [-0.55, 0.55].forEach((side, i) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1180, t + i * 0.04);
      bp.frequency.exponentialRampToValueAtTime(420, t + 0.55 + i * 0.04);
      bp.Q.value = 0.85;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.04);
      g.gain.linearRampToValueAtTime(0.145 * amp, t + 0.08 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.62 + i * 0.04);
      src.connect(bp); bp.connect(g);
      this._connectSfx(g, side, 0.25, 'valley');
      src.start(t + i * 0.04, randRange(0, 2.0), 0.68);
    });
  };

  P.playTurboSpool = function (boost = 0.7) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(boost, 0.2, 1.1);
    // Smooth aerodynamic turbocharger compressor spool-up on steep mountain ascent
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1250, t);
    bp.frequency.exponentialRampToValueAtTime(2480, t + 0.65);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 1.05);
    bp.Q.value = 5.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045 * amp, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 1.10);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.14);
    src.start(t, randRange(0, 2.0), 1.15);
  };

  P.playSeatbeltLatch = function (buckle = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Crisp stainless steel seatbelt tongue latching into buckle ("カチャッ！")
    playModalBody(this, [
      [1340, 0.032, 0.75, 22],
      [2980, 0.022, 0.65, 26],
      [5120, 0.014, 0.40, 28],
    ], {
      startTime: t, gain: 0.075, pan: 0.20, reverb: 0.10,
      strikerDur: 0.003, strikerHz: 6800, ringMix: 0.28,
      pitchMul: buckle ? 1.0 : 1.16,
    });
  };

  // -----------------------------------------------------------------------
  // CATEGORY 5: AIRSHIP K-11 AVIATION & SILO-40 MEGA-MACHINERY (+5)
  // -----------------------------------------------------------------------

  P.playK11PropFeather = function (climbing = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Variable-pitch ducted rotor blade angle servo whine + aerodynamic thrust bite
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(climbing ? 140 : 210, t);
    o.frequency.exponentialRampToValueAtTime(climbing ? 235 : 128, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.50);
    o.connect(g);
    this._connectSfx(g, 0, 0.20);
    o.start(t); o.stop(t + 0.54);
  };

  P.playK11CabinPressurize = function () {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Smooth high-altitude airship cabin pressure equalization valve + composite hull settle
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(880, t);
    bp.frequency.exponentialRampToValueAtTime(340, t + 0.72);
    bp.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.052, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.78);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.16);
    src.start(t, randRange(0, 2.0), 0.82);
  };

  P.playK11WindShear = function (speedNorm = 0.8) {
    if (!this.ctx || this.muted || !this.brownBuf) return;
    const t = this.ctx.currentTime;
    const amp = clamp(speedNorm, 0.3, 1.2);
    // High-speed stratospheric slipstream gust buffeting K-11 composite fuselage
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(160, t);
    bp.frequency.linearRampToValueAtTime(360, t + 0.35);
    bp.frequency.linearRampToValueAtTime(140, t + 0.95);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11 * amp, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 1.02);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, randRange(-0.4, 0.4), 0.22);
    src.start(t, randRange(0, 2.0), 1.08);
  };

  P.playSiloBlastKlaxon = function () {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Deep, warm, authoritative low brass bunker horn (138Hz + 207Hz — NEVER high-pitched beeping!)
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.105, t + 0.12);
    out.gain.setValueAtTime(0.095, t + 0.72);
    out.gain.exponentialRampToValueAtTime(0.0004, t + 1.15);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 540;
    lp.connect(out);
    [138, 207].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const fg = this.ctx.createGain();
      fg.gain.value = i === 0 ? 0.65 : 0.42;
      o.connect(fg); fg.connect(lp);
      o.start(t); o.stop(t + 1.20);
    });
    this._connectSfx(out, 0, 0.72, 'silo');
  };

  P.playSiloCryoPurge = function () {
    if (!this.ctx || this.muted || !this.whiteBuf) return;
    const t = this.ctx.currentTime;
    // Massive high-pressure cryogenic vent steam purge echoing across 40m concrete launch cavern
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(620, t + 1.45);
    bp.Q.value = 0.95;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.135, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 1.55);
    src.connect(bp); bp.connect(g);
    this._connectSfx(g, 0, 0.74, 'silo');
    src.start(t, randRange(0, 1.5), 1.65);
  };

  // -----------------------------------------------------------------------
  // CATEGORY 6: LIVING JAPANESE ARCHITECTURE, INTERIOR & LAB FOLEY (+7)
  // -----------------------------------------------------------------------

  P.playInteriorTimberSettle = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Authentic aged Hinoki timber beam slow thermal settle ("ミシッ…") in quiet Japanese interior
    playModalBody(this, [
      [132, 0.14, 0.55, 10],
      [310, 0.09, 0.68, 14],
      [690, 0.055, 0.42, 16],
      [1480, 0.030, 0.25, 18],
    ], {
      startTime: t, gain: 0.055, pan, reverb: 0.42, space: 'room',
      strikerDur: 0.012, strikerHz: 1800, ringMix: 0.22,
      pitchMul: randRange(0.88, 1.12),
    });
  };

  P.playInteriorTatamiCreak = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Woven Igusa rush tatami mat subtle fiber shift & sub-floor wood sigh
    playGranularScatter(this, {
      buffer: this.foliageBuf || this.pinkBuf,
      startTime: t,
      count: 6, spreadSec: 0.12,
      grainDurLo: 0.018, grainDurHi: 0.042,
      freqLo: 950, freqHi: 2600,
      gain: 0.042, pan, panSpread: 0.15, reverb: 0.30, space: 'room',
    });
  };

  P.playShrineBellSuzu = function (pan = 0, proximity = 0.85) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(proximity, 0.2, 1.0);
    // Traditional bronze Shinto Suzu bell rattle at Suginosato Mountain Shrine!
    for (let i = 0; i < 6; i++) {
      const dt = i * randRange(0.042, 0.078);
      playModalBody(this, [
        [920, 0.22, 0.55, 24],
        [1540, 0.18, 0.62, 28],
        [2420, 0.14, 0.45, 32],
        [3650, 0.08, 0.24, 30],
      ], {
        startTime: t + dt,
        gain: 0.058 * amp * Math.pow(0.88, i),
        pan: clamp(pan + randRange(-0.12, 0.12), -0.88, 0.88),
        reverb: 0.55, space: 'valley',
        strikerDur: 0.003, strikerHz: 5200,
        ringMix: 0.44, pitchMul: randRange(0.95, 1.06),
      });
    }
  };

  P.playSpaWaterLadle = function (pan = 0) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Wooden Hinoki Oke ladle gently pouring warm thermal spring water across granite bath floor
    const pour = this.ctx.createBufferSource();
    pour.buffer = this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1150, t);
    bp.frequency.linearRampToValueAtTime(760, t + 0.65);
    bp.Q.value = 1.3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.085, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.72);
    pour.connect(bp); bp.connect(g);
    this._connectSfx(g, pan, 0.58, 'spa');
    pour.start(t, randRange(0, 2.0), 0.78);

    playGranularScatter(this, {
      buffer: this.dropletBuf || this.crackleBuf,
      startTime: t + 0.05,
      count: 10, spreadSec: 0.62,
      grainDurLo: 0.018, grainDurHi: 0.048,
      freqLo: 800, freqHi: 2500,
      gain: 0.058, pan, panSpread: 0.24, reverb: 0.62, space: 'spa',
    });
  };

  P.playKettleSimmer = function (proximity = 0.8) {
    if (!this.ctx || this.muted) return;
    const amp = clamp(proximity, 0.15, 1.0);
    // Cast-iron Tetsubin kettle soft simmering steam bubbles over hearth
    playGranularScatter(this, {
      buffer: this.dropletBuf || this.crackleBuf,
      count: 9, spreadSec: 0.75,
      grainDurLo: 0.018, grainDurHi: 0.045,
      freqLo: 1100, freqHi: 2800,
      qLo: 2.0, qHi: 4.5,
      gain: 0.036 * amp, pan: 0, panSpread: 0.12, reverb: 0.24, space: 'room',
    });
  };

  P.playGeneratorThrob = function (intensity = 0.6) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const amp = clamp(intensity, 0.2, 1.0);
    // Deep B4F underground containment backup turbine slow harmonic pulse (55Hz + 110Hz)
    [55, 110].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((idx === 0 ? 0.055 : 0.025) * amp, t + 0.45);
      g.gain.exponentialRampToValueAtTime(0.0003, t + 1.45);
      o.connect(g);
      this._connectSfx(g, 0, 0.48, 'silo');
      o.start(t); o.stop(t + 1.50);
    });
  };

  P.playGlassRainDrip = function (pan = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Single crystal rainwater drop falling from timber eaves onto stone veranda / window glass
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const f0 = randRange(780, 1420);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.45, t + 0.042);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.038, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0002, t + 0.055);
    o.connect(g);
    this._connectSfx(g, pan, 0.44, 'room');
    o.start(t); o.stop(t + 0.065);
  };

  // -----------------------------------------------------------------------
  // CATEGORY 7: ULTRA-TACTILE CARTOGRAPHIC MAP & CAMERA UI FOLEY (+4)
  // -----------------------------------------------------------------------

  P.playMapPaperUnfold = function (opening = true) {
    if (!this.ctx || this.muted || !this.pinkBuf) return;
    const t = this.ctx.currentTime;
    // Archival cotton topographic map parchment smooth unfold + gentle crease snap
    const src = this.ctx.createBufferSource();
    src.buffer = this.foliageBuf || this.pinkBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opening ? 1350 : 2250, t);
    bp.frequency.exponentialRampToValueAtTime(opening ? 2550 : 1080, t + 0.16);
    bp.Q.value = 1.55;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.072, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.19);
    src.connect(bp); bp.connect(g);
    g.connect(this.uiBus);
    src.start(t, randRange(0, 2.0), 0.22);
  };

  P.playMapZoomTick = function (zoomIn = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Precision mechanical Leica-lens optical detent tick on map zoom buttons
    playModalBody(this, [
      [zoomIn ? 1680 : 1260, 0.015, 0.65, 22],
      [zoomIn ? 3420 : 2580, 0.010, 0.42, 26],
    ], {
      startTime: t, gain: 0.052, bus: this.uiBus,
      strikerDur: 0.0025, strikerHz: 6200, ringMix: 0.20,
    });
  };

  P.playMapWaypointLock = function () {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Magnetic brass compass needle detent + serene harmonic navigation confirmation
    playModalBody(this, [
      [880, 0.16, 0.55, 26],
      [1318.5, 0.22, 0.50, 30],
    ], {
      startTime: t, gain: 0.062, bus: this.uiBus,
      strikerDur: 0.003, strikerHz: 4800, ringMix: 0.48,
    });
  };

  P.playCameraShutter = function () {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Authentic dual-curtain precision SLR camera mirror & shutter click ("カシャッ")
    [0, 0.036].forEach((off, idx) => {
      playModalBody(this, [
        [idx === 0 ? 1480 : 1120, 0.018, 0.72, 18],
        [idx === 0 ? 3200 : 2450, 0.012, 0.48, 22],
      ], {
        startTime: t + off, gain: idx === 0 ? 0.068 : 0.052, bus: this.uiBus,
        strikerDur: 0.0025, strikerHz: 6800, ringMix: 0.16,
      });
    });
  };

  // -----------------------------------------------------------------------
  // UNIFIED CATALOG DISPATCHER (All 128 SFX directly playable by ID!)
  // -----------------------------------------------------------------------

  P.playById = function (id, opts = {}) {
    if (!this.ctx) this.init();
    if (!this.ctx || this.muted) return false;
    const pan = opts.pan ?? 0;
    const intensity = opts.intensity ?? 0.75;
    switch (id) {
      // Original 69 SFX
      case 'footstep_wood': return (this.playFootstep('wood', opts), true);
      case 'footstep_tatami': return (this.playFootstep('tatami', opts), true);
      case 'footstep_tile': return (this.playFootstep('tile', opts), true);
      case 'footstep_wet_stone': return (this.playFootstep('wet_stone', opts), true);
      case 'footstep_metal': return (this.playFootstep('metal', opts), true);
      case 'footstep_earth': return (this.playFootstep('earth', opts), true);
      case 'footstep_gravel': return (this.playFootstep('gravel', opts), true);
      case 'footstep_grass': return (this.playFootstep('grass', opts), true);
      case 'footstep_bridge': return (this.playFootstep('bridge', opts), true);
      case 'footstep_water': return (this.playFootstep('water', opts), true);
      case 'jump_pushoff': return (this.playJump(opts.surface || 'earth'), true);
      case 'land_impact': return (this.playLand(opts.surface || 'earth', intensity), true);
      case 'crouch_rustle': return (this.playCrouch(opts.down !== false), true);
      case 'stair_step': return (this.playStairStep(opts.material || 'wood', true), true);
      case 'door_wood_swing': return (this.playDoor('wood_swing', true), true);
      case 'door_shoji_slide': return (this.playDoor('shoji', true), true);
      case 'door_airtight_bunker': return (this.playDoor('airtight', true), true);
      case 'door_glass_slide': return (this.playDoor('glass', true), true);
      case 'door_vehicle_cab': return (this.playDoor('vehicle', true), true);
      case 'door_liftgate_strut': return (this.playDoor('liftgate', true), true);
      case 'door_armor_airlock': return (this.playDoor('armor_airlock', true), true);
      case 'door_k11_airlock': return (this.playDoor('k11_airlock', true), true);
      case 'garage_rollup_shutter': return (this.playShutterClank(true, 'garage_rollup'), true);
      case 'armor_storm_shutter': return (this.playShutterClank(true, 'armor_shutter'), true);
      case 'flashlight_click': return (this.playClick(true, 'flashlight'), true);
      case 'lamp_switch': return (this.playClick(true, 'lamp'), true);
      case 'washi_lantern_toggle': return (this.playClick(true, 'washi_lantern'), true);
      case 'fireplace_toggle': return (this.playFireplaceToggle(true), true);
      case 'sauna_loyly_steam': return (this.playSaunaLoyly(false), true);
      case 'thermal_console_cmd': return (this.playThermalConsole(true), true);
      case 'cooling_plenum_boost': return (this.playCoolingPlenum(true), true);
      case 'lab_uv_mode': return (this.playLabUvMode(true), true);
      case 'lab_containment_overdrive': return (this.playLabContainment(true), true);
      case 'tow_hitch_couple': return (this.playTowHitch(true), true);
      case 'elevator_button': return (this.playElevatorButton(), true);
      case 'elevator_brake': return (this.playElevatorBrake(false), true);
      case 'elevator_door': return (this.playElevatorDoor(true), true);
      case 'elevator_chime': return (this.playElevatorChime(1), true);
      case 'elevator_safety_cue': return (this.playElevatorSafetyBeep(), true);
      case 'elevator_motor_loop': return (this.updateElevatorMotor(true, 0.5), true);
      case 'silo_hydraulic_stage': return (this.playSiloHydraulic('unlock'), true);
      case 'k11_refuel_pump': return (this.playRefuelSound(), true);
      case 'autopilot_cue': return (this.playAutopilotCue('engage'), true);
      case 'engine_start_diesel': return (this.playEngineStart('diesel'), true);
      case 'engine_start_armor': return (this.playEngineStart('armor'), true);
      case 'engine_start_kei': return (this.playEngineStart('kei'), true);
      case 'engine_start_k11': return (this.playEngineStart('k11'), true);
      case 'engine_shutdown': return (this.playEngineStop('diesel'), true);
      case 'vehicle_engine_loop': return (this.updateEngine(true, 0.4, 'diesel', { onRoad: true }), true);
      case 'tire_surface_loop': return (this.updateEngine(true, 0.5, 'diesel', { onBridge: true }), true);
      case 'tire_hydroplane_skid': return (this.updateEngine(true, 0.6, 'diesel', { waterDepth: 0.25, slipSpeed: 2.2 }), true);
      case 'suspension_thud': return (this.playSuspensionThud(intensity), true);
      case 'bridge_expansion_joint': return (this.playBridgeJoint(intensity), true);
      case 'vehicle_collision_impact': return (this.playBump('forest', intensity), true);
      case 'vehicle_headlight_relay': return (this.playClick(true, 'headlight'), true);
      case 'k11_takeoff_boost': return (this.playK11Takeoff(), true);
      case 'k11_touchdown_struts': return (this.playK11Touchdown(false), true);
      case 'k11_airship_flight_loop': return (this.updateAirshipEngine(true, 0.5, { climbRate: 2 }), true);
      case 'forest_wind_ambience': return (this.updateOcclusion(0.85), true);
      case 'river_rapids_ambience': return (this.updateEnvironment(0.016, { riverDist: 8, isOutdoors: true }), true);
      case 'village_spring_ambience': return (this.updateEnvironment(0.016, { springDist: 3, isOutdoors: true }), true);
      case 'hearth_fire_ambience': return (this.updateEnvironment(0.016, { fireDist: 2 }), true);
      case 'sauna_spa_ambience': return (this.updateEnvironment(0.016, { inSpa: true }), true);
      case 'underground_hvac_ambience': return (this.updateEnvironment(0.016, { inUnderground: true }), true);
      case 'storm_rain_roof_ambience': return (this.updateStorm(0.7, 0.4, 'metal'), true);
      case 'thunder_lightning_crack': return (this.playThunder(220), true);
      case 'landslide_rockfall': return (this.playLandslideRumble(intensity), true);
      case 'wildlife_bird_owl_woodpecker': return (this.playBirdCall('uguisu', pan), true);
      case 'ui_tactile_feedback': return (this.playUiSound('click'), true);

      // 59 Brand-New V4 Ultra-Realistic SFX
      case 'footstep_snow': return (this.playFootstepSnow(opts), true);
      case 'footstep_mud': return (this.playFootstepMud(opts), true);
      case 'footstep_leaves': return (this.playFootstepLeaves(opts), true);
      case 'footstep_moss': return (this.playFootstepMoss(opts), true);
      case 'footstep_asphalt': return (this.playFootstepAsphalt(opts), true);
      case 'footstep_sand': return (this.playFootstepSand(opts), true);
      case 'body_cloth_brush': return (this.playBodyClothBrush(intensity, pan), true);
      case 'player_sprint_breath': return (this.playSprintBreath(intensity), true);
      case 'ladder_climb_rung': return (this.playLadderRung(opts.metal !== false), true);
      case 'water_wade_splash': return (this.playWaterWadeSplash(intensity), true);
      case 'wildlife_cuckoo': return (this.playCuckooCall(pan), true);
      case 'wildlife_crow': return (this.playCrowCaw(pan), true);
      case 'wildlife_kingfisher': return (this.playKingfisherDive(pan), true);
      case 'wildlife_deer_bark': return (this.playDeerBark(pan), true);
      case 'wildlife_frog_chorus': return (this.playFrogChorus(pan), true);
      case 'wildlife_branch_snap': return (this.playBranchSnap(pan, intensity), true);
      case 'wildlife_pinecone_drop': return (this.playPineconeDrop(pan), true);
      case 'wildlife_wing_flutter': return (this.playWingFlutter(pan), true);
      case 'wildlife_water_fish_jump': return (this.playWaterFishJump(pan), true);
      case 'wildlife_wind_chime_furin': return (this.playWindChimeFurin(pan, intensity), true);
      case 'wildlife_shishi_odoshi': return (this.playShishiOdoshi(pan, intensity), true);
      case 'wildlife_distant_waterfall': return (this.playDistantWaterfallSurge(intensity, pan), true);
      case 'wildlife_tree_creak_wind': return (this.playTreeCreakWind(pan, intensity), true);
      case 'wildlife_stream_pebble_roll': return (this.playStreamPebbleRoll(pan, intensity), true);
      case 'weather_wind_gust_howl': return (this.playWindGustHowl(intensity, pan), true);
      case 'weather_rain_drizzle_leaves': return (this.playRainDrizzleLeaves(intensity), true);
      case 'weather_hail_patter': return (this.playHailPatter(opts.roofKind || 'metal', intensity), true);
      case 'weather_distant_rumble': return (this.playDistantStormRumble(intensity), true);
      case 'weather_lightning_arc_snap': return (this.playLightningArcSnap(pan), true);
      case 'weather_bridge_cable_hum': return (this.playBridgeCableHum(intensity), true);
      case 'weather_snow_blizzard_whip': return (this.playSnowBlizzardWhip(intensity), true);
      case 'vehicle_horn_rv': return (this.playVehicleHorn('camper'), true);
      case 'vehicle_horn_armor': return (this.playVehicleHorn('armor'), true);
      case 'vehicle_horn_kei': return (this.playVehicleHorn('kei'), true);
      case 'vehicle_gear_shift': return (this.playGearShift(opts.upshift !== false, opts.profile || 'diesel'), true);
      case 'vehicle_air_brake_hiss': return (this.playAirBrakeHiss(intensity), true);
      case 'vehicle_handbrake_ratchet': return (this.playHandbrakeRatchet(opts.engage !== false), true);
      case 'vehicle_wiper_sweep': return (this.playWiperSweep(intensity), true);
      case 'vehicle_turn_signal_click': return (this.playTurnSignalClick(opts.highTick !== false), true);
      case 'vehicle_gravel_undercarriage': return (this.playGravelUndercarriage(intensity), true);
      case 'vehicle_water_ford_surge': return (this.playWaterFordSurge(intensity, opts.depth ?? 0.35), true);
      case 'vehicle_turbo_spool': return (this.playTurboSpool(intensity), true);
      case 'vehicle_seatbelt_latch': return (this.playSeatbeltLatch(opts.buckle !== false), true);
      case 'k11_prop_pitch_feather': return (this.playK11PropFeather(opts.climbing !== false), true);
      case 'k11_cabin_pressurize': return (this.playK11CabinPressurize(), true);
      case 'k11_altitude_wind_shear': return (this.playK11WindShear(intensity), true);
      case 'silo_blast_door_klaxon_low': return (this.playSiloBlastKlaxon(), true);
      case 'silo_cryo_vent_purge': return (this.playSiloCryoPurge(), true);
      case 'interior_timber_settle': return (this.playInteriorTimberSettle(pan), true);
      case 'interior_tatami_creak': return (this.playInteriorTatamiCreak(pan), true);
      case 'interior_shrine_bell_suzu': return (this.playShrineBellSuzu(pan, intensity), true);
      case 'interior_spa_water_ladle': return (this.playSpaWaterLadle(pan), true);
      case 'interior_kettle_simmer': return (this.playKettleSimmer(intensity), true);
      case 'interior_generator_hum_throb': return (this.playGeneratorThrob(intensity), true);
      case 'interior_glass_rain_drip': return (this.playGlassRainDrip(pan), true);
      case 'ui_map_paper_unfold': return (this.playMapPaperUnfold(opts.opening !== false), true);
      case 'ui_map_zoom_tick': return (this.playMapZoomTick(opts.zoomIn !== false), true);
      case 'ui_map_waypoint_lock': return (this.playMapWaypointLock(), true);
      case 'ui_camera_shutter': return (this.playCameraShutter(), true);
      default: return false;
    }
  };
}
