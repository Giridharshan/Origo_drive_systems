/**
 * sound.js
 * Synthesized electric motor acoustics, tire squeal, and UI feedback
 * using Web Audio API (Zero external audio file dependencies).
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // muted by default until user toggles or interacts
    this.motorOsc = null;
    this.motorGain = null;
    this.humOsc = null;
    this.humGain = null;
    this.filter = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master motor oscillator (dual-tone brushless motor whine)
      this.motorOsc = this.ctx.createOscillator();
      this.motorOsc.type = 'sawtooth';
      this.motorOsc.frequency.setValueAtTime(60, this.ctx.currentTime);

      this.humOsc = this.ctx.createOscillator();
      this.humOsc.type = 'sine';
      this.humOsc.frequency.setValueAtTime(120, this.ctx.currentTime);

      // Low-pass filter to soften the sawtooth
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.humGain = this.ctx.createGain();
      this.humGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.motorOsc.connect(this.filter);
      this.filter.connect(this.motorGain);
      this.motorGain.connect(this.ctx.destination);

      this.humOsc.connect(this.humGain);
      this.humGain.connect(this.ctx.destination);

      this.motorOsc.start();
      this.humOsc.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio not initialized:', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted && (!this.isInitialized || this.ctx.state === 'suspended')) {
      if (!this.isInitialized) this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
    if (this.isMuted && this.motorGain) {
      this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.humGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return !this.isMuted;
  }

  updateMotorSound(linearSpeed, angularSpeed) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    const normalizedSpeed = Math.min(1.0, (linearSpeed * 0.7 + Math.abs(angularSpeed) * 35) / 240);

    const now = this.ctx.currentTime;
    if (normalizedSpeed > 0.02) {
      // Frequency ramps up smoothly with robot speed (from 80Hz idle up to 480Hz top RPM)
      const targetFreq = 80 + normalizedSpeed * 380;
      const targetVolume = Math.min(0.12, normalizedSpeed * 0.12);

      this.motorOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
      this.humOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.05);
      this.motorGain.gain.setTargetAtTime(targetVolume, now, 0.05);
      this.humGain.gain.setTargetAtTime(targetVolume * 0.6, now, 0.05);
    } else {
      this.motorGain.gain.setTargetAtTime(0, now, 0.1);
      this.humGain.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  playClick() {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }
}
