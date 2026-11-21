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
}
