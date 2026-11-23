/**
 * INNOVATION 4B: Procedural Web Audio API Midnight Deep-Forest & Footstep Soundscape.
 *
 * Zero external audio assets — synthesizes:
 *  - Deep cedar forest wind with real-time indoor/outdoor acoustic low-pass occlusion
 *  - Subtle distant nocturnal forest crickets
 *  - Material-aware protagonist footsteps (oak wood / terrazzo tile / tatami / forest earth)
 *  - Door swing/slide foley & tactile flashlight mechanical click
 */

export class SpatialForestAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.muted = false;
    this.windFilter = null;
    this.windGain = null;
    this.cricketGain = null;
    this.noiseBuffer = null;
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

    // Generate 3-second soft brown/pink noise buffer for wind & footsteps
    const len = this.ctx.sampleRate * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      data[i] = last * 3.2;
    }

    // Continuous deep forest wind through cedar boughs
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 180;
    this.windFilter.Q.value = 1.4;

    // Gentle mountain breeze LFO
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 65;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windFilter.frequency);
    lfo.start();

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.09;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    windSrc.start();

    // Subtle distant night forest insect shimmer
    const cOsc = this.ctx.createOscillator();
    cOsc.type = 'sine';
    cOsc.frequency.value = 4150;
    const cPulse = this.ctx.createOscillator();
    cPulse.frequency.value = 6.5;
    const cPulseGain = this.ctx.createGain();
    cPulseGain.gain.value = 0.0022;
    this.cricketGain = this.ctx.createGain();
    this.cricketGain.gain.value = 0.0018;
    cPulse.connect(cPulseGain);
    cPulseGain.connect(this.cricketGain.gain);
    cOsc.connect(this.cricketGain);
    this.cricketGain.connect(this.ctx.destination);
    cOsc.start();
    cPulse.start();
  }

  toggleMute() {
    if (!this.ctx) this.init();
    this.muted = !this.muted;
    if (this.windGain) this.windGain.gain.setTargetAtTime(this.muted ? 0 : 0.09, this.ctx.currentTime, 0.15);
    if (this.cricketGain) this.cricketGain.gain.setTargetAtTime(this.muted ? 0 : 0.0018, this.ctx.currentTime, 0.15);
    return !this.muted;
  }

  /**
   * Real-time acoustic occlusion: forest wind & insects grow clearer near South window or open Front Door!
   */
  updateOcclusion(openness) {
    if (!this.ctx || !this.windFilter || this.muted) return;
    const t = this.ctx.currentTime;
    const freq = 155 + openness * 420;
    const gain = 0.065 + openness * 0.11;
    this.windFilter.frequency.setTargetAtTime(freq, t, 0.2);
    this.windGain.gain.setTargetAtTime(gain, t, 0.2);
  }

  playFootstep(surface = 'wood') {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    if (surface === 'tile') {
      filt.type = 'bandpass';
      filt.frequency.value = 1150 + Math.random() * 240;
      filt.Q.value = 2.2;
      g.gain.setValueAtTime(0.085, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    } else if (surface === 'tatami') {
      filt.type = 'lowpass';
      filt.frequency.value = 340 + Math.random() * 60;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    } else if (surface === 'earth') {
      filt.type = 'bandpass';
      filt.frequency.value = 620 + Math.random() * 180;
      filt.Q.value = 1.0;
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    } else {
      // Warm hollow oak floorboard footstep
      filt.type = 'lowpass';
      filt.frequency.value = 460 + Math.random() * 90;
      filt.Q.value = 2.0;
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    }

    src.connect(filt);
    filt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t, Math.random() * 2.0, 0.14);
  }

  playClick(high = true) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(high ? 1400 : 760, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.032);
    g.gain.setValueAtTime(0.075, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.036);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  playDoor(isPocket = false) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(isPocket ? 480 : 280, t);
    filt.frequency.linearRampToValueAtTime(isPocket ? 320 : 420, t + 0.28);
    filt.Q.value = isPocket ? 1.8 : 4.2;
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t, Math.random() * 1.5, 0.32);
  }

  updateEngine(active, speedNorm = 0, profile = 'diesel') {
    if (!this.ctx || this.muted) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.12);
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 46;
      this.engineFilt = this.ctx.createBiquadFilter();
      this.engineFilt.type = 'lowpass';
      this.engineFilt.frequency.value = 125;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilt);
      this.engineFilt.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    const isKei = profile === 'kei';
    const targetGain = active ? ((isKei ? 0.036 : 0.048) + Math.min(1, speedNorm) * 0.040) : 0.0;
    const targetFreq = (isKei ? 68 : 44) + Math.min(1, speedNorm) * (isKei ? 74 : 42);
    const targetCutoff = (isKei ? 195 : 115) + Math.min(1, speedNorm) * (isKei ? 260 : 165);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.10);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.09);
    this.engineFilt.frequency.setTargetAtTime(targetCutoff, t, 0.10);
  }

  playBump() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.14);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playElevatorButton() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1240, t);
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.085);
  }

  playElevatorBrake(engaging = false) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Heavy metallic electromagnetic disc brake solenoid CLUNK + steel housing resonance
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(engaging ? 92 : 114, t);
    body.frequency.exponentialRampToValueAtTime(34, t + 0.14);
    bg.gain.setValueAtTime(0.11, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    body.connect(bg);
    bg.connect(this.ctx.destination);
    body.start(t);
    body.stop(t + 0.17);

    const clack = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clack.type = 'square';
    clack.frequency.setValueAtTime(engaging ? 440 : 620, t);
    clack.frequency.exponentialRampToValueAtTime(140, t + 0.035);
    cg.gain.setValueAtTime(0.035, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    clack.connect(cg);
    cg.connect(this.ctx.destination);
    clack.start(t);
    clack.stop(t + 0.045);
  }

  playElevatorSafetyBeep() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [0, 0.12].forEach((delay) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1560, t + delay);
      g.gain.setValueAtTime(0.06, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.08);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.09);
    });
  }

  playElevatorDoor(isOpening = true) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(isOpening ? 320 : 510, t);
    filt.frequency.linearRampToValueAtTime(isOpening ? 540 : 250, t + 1.05);
    filt.Q.value = 3.8;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.052, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.12);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t, Math.random() * 1.2, 1.15);
  }

  playElevatorChime(dir = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Direction-specific authentic Japanese arrival chime (UP: bright G5->C6, DOWN: deep A5->E5)
    const notes = dir >= 0
      ? [[784.0, 0.0, 0.36], [1046.5, 0.24, 0.72]]
      : [[880.0, 0.0, 0.38], [659.25, 0.26, 0.76]];
    notes.forEach(([freq, delay, dur]) => {
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + delay);
      osc2.frequency.setValueAtTime(freq * 2.0, t + delay);
      g.gain.setValueAtTime(0.001, t + delay);
      g.gain.linearRampToValueAtTime(0.085, t + delay + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + delay + dur);
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.20;
      osc.connect(g);
      osc2.connect(g2);
      g2.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + delay);
      osc2.start(t + delay);
      osc.stop(t + delay + dur + 0.02);
      osc2.stop(t + delay + dur + 0.02);
    });
  }

  updateElevatorMotor(moving, speedNorm = 0) {
    if (!this.ctx || this.muted) {
      if (this.elvGain && this.ctx) {
        this.elvGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.12);
      }
      if (this.elvPwmGain && this.ctx) {
        this.elvPwmGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.12);
      }
      return;
    }
    if (!this.elvOsc) {
      // Layer 1: Low gearless permanent-magnet traction torque hum
      this.elvOsc = this.ctx.createOscillator();
      this.elvOsc.type = 'triangle';
      this.elvOsc.frequency.value = 76;
      this.elvFilt = this.ctx.createBiquadFilter();
      this.elvFilt.type = 'lowpass';
      this.elvFilt.frequency.value = 260;
      this.elvGain = this.ctx.createGain();
      this.elvGain.gain.value = 0.0;
      this.elvOsc.connect(this.elvFilt);
      this.elvFilt.connect(this.elvGain);
      this.elvGain.connect(this.ctx.destination);
      this.elvOsc.start();

      // Layer 2: Authentic VVVF Inverter PWM Carrier Harmonic Sweep!
      this.elvPwmOsc = this.ctx.createOscillator();
      this.elvPwmOsc.type = 'sine';
      this.elvPwmOsc.frequency.value = 340;
      this.elvPwmGain = this.ctx.createGain();
      this.elvPwmGain.gain.value = 0.0;
      this.elvPwmOsc.connect(this.elvPwmGain);
      this.elvPwmGain.connect(this.ctx.destination);
      this.elvPwmOsc.start();
    }
    const t = this.ctx.currentTime;
    const s = Math.max(0, Math.min(1, speedNorm));
    this.elvGain.gain.setTargetAtTime(moving ? (0.016 + s * 0.036) : 0.0, t, 0.10);
    this.elvOsc.frequency.setTargetAtTime(68 + s * 118, t, 0.08);
    this.elvFilt.frequency.setTargetAtTime(190 + s * 360, t, 0.08);
    this.elvPwmGain.gain.setTargetAtTime(moving ? (0.004 + s * 0.012) : 0.0, t, 0.10);
    this.elvPwmOsc.frequency.setTargetAtTime(340 + s * 740, t, 0.08);
  }

  updateStorm(intensity, muffle = 0.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    if (!this.rainGain) {
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;
      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.value = 1400;
      this.rainFilter.Q.value = 0.7;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0.0;
      rainSrc.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.ctx.destination);
      rainSrc.start();
    }
    const t = this.ctx.currentTime;
    const active = this.muted ? 0 : Math.max(0, Math.min(1, intensity));
    const atten = 1.0 - Math.max(0, Math.min(0.85, muffle));
    this.rainGain.gain.setTargetAtTime(active * 0.16 * atten, t, 0.18);
    this.rainFilter.frequency.setTargetAtTime(520 + 1350 * atten, t, 0.18);
  }

  playThunder(distanceM = 300) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const delay = Math.min(1.6, Math.max(0.08, distanceM / 420));
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(190, t);
    filt.frequency.exponentialRampToValueAtTime(48, t + 2.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t, Math.random() * 0.5, 2.7);
  }

  playShutterClank(closing = true) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(closing ? 340 : 480, t);
    filt.frequency.linearRampToValueAtTime(closing ? 160 : 620, t + 0.42);
    filt.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.ctx.destination);
    src.start(t, Math.random() * 1.2, 0.48);
  }

  updateAirshipEngine(active, speedNorm = 0) {
    if (!this.ctx || this.muted) {
      if (this.airGain && this.ctx) {
        this.airGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.14);
      }
      if (this.airTurbGain && this.ctx) {
        this.airTurbGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.14);
      }
      return;
    }
    if (!this.airOsc) {
      // Layer 1: Smooth TF-E11 rotary-turbo hybrid low harmonic thrum
      this.airOsc = this.ctx.createOscillator();
      this.airOsc.type = 'triangle';
      this.airOsc.frequency.value = 54;
      this.airFilt = this.ctx.createBiquadFilter();
      this.airFilt.type = 'lowpass';
      this.airFilt.frequency.value = 180;
      this.airGain = this.ctx.createGain();
      this.airGain.gain.value = 0.0;
      this.airOsc.connect(this.airFilt);
      this.airFilt.connect(this.airGain);
      this.airGain.connect(this.ctx.destination);
      this.airOsc.start();

      // Layer 2: Sleek coaxial ducted-fan high-efficiency turbine whistle
      this.airTurbOsc = this.ctx.createOscillator();
      this.airTurbOsc.type = 'sine';
      this.airTurbOsc.frequency.value = 210;
      this.airTurbGain = this.ctx.createGain();
      this.airTurbGain.gain.value = 0.0;
      this.airTurbOsc.connect(this.airTurbGain);
      this.airTurbGain.connect(this.ctx.destination);
      this.airTurbOsc.start();
    }
    const t = this.ctx.currentTime;
    const s = Math.max(0, Math.min(1, speedNorm));
    this.airGain.gain.setTargetAtTime(active ? (0.026 + s * 0.042) : 0.0, t, 0.12);
    this.airOsc.frequency.setTargetAtTime(52 + s * 64, t, 0.10);
    this.airFilt.frequency.setTargetAtTime(160 + s * 290, t, 0.10);
    this.airTurbGain.gain.setTargetAtTime(active ? (0.005 + s * 0.016) : 0.0, t, 0.12);
    this.airTurbOsc.frequency.setTargetAtTime(205 + s * 420, t, 0.10);
  }

  playSiloHydraulic(stage = 'unlock') {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    // Deep heavy hydraulic mecha thrum + metallic latch clank
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sawtooth';
    const f0 = stage === 'surface_lock' ? 96 : (stage === 'roof_open' ? 68 : 82);
    sub.frequency.setValueAtTime(f0, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime(0.11, t + 0.04);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 180;
    sub.connect(lpf);
    lpf.connect(sg);
    sg.connect(this.ctx.destination);
    sub.start(t);
    sub.stop(t + 0.65);

    // Pneumatic hiss layer for mecha blast plates
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(stage === 'roof_open' ? 680 : 420, t);
    bp.frequency.linearRampToValueAtTime(240, t + 0.72);
    bp.Q.value = 2.4;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.09, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(t, Math.random() * 1.1, 0.78);

    // Warning / Confirmation aerospace chime on launch unlock or lock
    if (stage === 'unlock' || stage === 'surface_lock') {
      const notes = stage === 'unlock' ? [523.25, 659.25, 783.99] : [783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const og = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.14);
        og.gain.setValueAtTime(0.055, t + idx * 0.14);
        og.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.14 + 0.24);
        osc.connect(og);
        og.connect(this.ctx.destination);
        osc.start(t + idx * 0.14);
        osc.stop(t + idx * 0.14 + 0.26);
      });
    }
  }

  playRefuelSound() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [587.33, 880.0, 1174.66].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.09);
      g.gain.setValueAtTime(0.07, t + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.25);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + idx * 0.09);
      osc.stop(t + idx * 0.09 + 0.27);
    });
  }
}
