const MIN_GAIN = 0.0001;
const SETTINGS_KEY = 'last-outpost-audio-settings-v1';

const HIGH_FREQUENCY_LIMITS = Object.freeze({
  machineGun: { cooldown: 0.045, maxVoices: 6 },
  enemyHit: { cooldown: 0.05, maxVoices: 4 },
  enemyKill: { cooldown: 0.085, maxVoices: 4 },
  mortarImpact: { cooldown: 0.1, maxVoices: 4 },
});

export const AUDIO_VARIANTS = Object.freeze({
  machineGun: Object.freeze([
    { from: 148, to: 70, duration: 0.062, volume: 0.024, noiseFrequency: 1040 },
    { from: 158, to: 74, duration: 0.067, volume: 0.026, noiseFrequency: 1160 },
    { from: 170, to: 78, duration: 0.06, volume: 0.023, noiseFrequency: 1280 },
  ]),
  enemyHit: Object.freeze([
    { from: 188, to: 108, duration: 0.052, volume: 0.01 },
    { from: 205, to: 118, duration: 0.055, volume: 0.011 },
    { from: 226, to: 126, duration: 0.05, volume: 0.0095 },
  ]),
  enemyKill: Object.freeze([
    { from: 132, to: 44, duration: 0.13, volume: 0.017, noiseFrequency: 470 },
    { from: 145, to: 48, duration: 0.14, volume: 0.018, noiseFrequency: 520 },
    { from: 158, to: 52, duration: 0.15, volume: 0.016, noiseFrequency: 580 },
  ]),
  mortarImpact: Object.freeze([
    { from: 84, to: 31, duration: 0.28, volume: 0.043, noiseFrequency: 700 },
    { from: 92, to: 34, duration: 0.3, volume: 0.046, noiseFrequency: 780 },
    { from: 102, to: 37, duration: 0.32, volume: 0.044, noiseFrequency: 860 },
  ]),
});

function clampVolume(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

export class AudioService {
  constructor({ random = Math.random, windowRef = globalThis.window, context = null, storage } = {}) {
    this.random = typeof random === 'function' ? random : Math.random;
    this.windowRef = windowRef;
    this.context = context;
    this.storage = storage === undefined ? this.resolveStorage() : storage;
    this.unlockPromise = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.alertGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.activeSources = 0;
    this.activeByEffect = new Map();
    this.maxSources = 18;
    this.lastPlayedAt = new Map();
    this.masterVolume = 0.58;
    this.sfxVolume = 1;
    this.mute = false;
    this.loadSettings();
  }

  resolveStorage() {
    try {
      return this.windowRef?.localStorage || null;
    } catch {
      return null;
    }
  }

  settings() {
    return { masterVolume: this.masterVolume, sfxVolume: this.sfxVolume, mute: this.mute };
  }

  loadSettings() {
    try {
      const saved = JSON.parse(this.storage?.getItem(SETTINGS_KEY) || '{}');
      this.masterVolume = clampVolume(saved.masterVolume, this.masterVolume);
      this.sfxVolume = clampVolume(saved.sfxVolume, this.sfxVolume);
      if (typeof saved.mute === 'boolean') this.mute = saved.mute;
    } catch {
      // 隐私模式、存储被禁用或损坏数据时继续使用内存默认值。
    }
    this.applyVolumes();
    return this.settings();
  }

  saveSettings() {
    try {
      if (!this.storage) return false;
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(this.settings()));
      return true;
    } catch {
      return false;
    }
  }

  setMasterVolume(value) {
    this.masterVolume = clampVolume(value, this.masterVolume);
    this.applyVolumes();
    this.saveSettings();
    return this.masterVolume;
  }

  setSfxVolume(value) {
    this.sfxVolume = clampVolume(value, this.sfxVolume);
    this.applyVolumes();
    this.saveSettings();
    return this.sfxVolume;
  }

  setMute(value) {
    this.mute = Boolean(value);
    this.applyVolumes();
    this.saveSettings();
    return this.mute;
  }

  toggleMute() {
    return this.setMute(!this.mute);
  }

  applyVolumes() {
    if (this.masterGain) this.masterGain.gain.value = this.mute ? 0 : this.masterVolume;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    if (this.alertGain) this.alertGain.gain.value = this.sfxVolume;
  }

  ensureContext() {
    try {
      if (!this.context) {
        const AudioContextClass = this.windowRef?.AudioContext || this.windowRef?.webkitAudioContext;
        if (!AudioContextClass) return null;
        this.context = new AudioContextClass();
      }
      this.createOutputGraph(this.context);
      return this.context;
    } catch {
      return null;
    }
  }

  createOutputGraph(context) {
    if (this.masterGain) return;
    this.masterGain = context.createGain();
    this.sfxGain = context.createGain();
    this.alertGain = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 8;
    this.compressor.ratio.value = 7;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.16;
    this.sfxGain.connect(this.masterGain);
    this.alertGain.connect(this.masterGain);
    this.masterGain.connect(this.compressor).connect(context.destination);
    this.applyVolumes();
  }

  unlock() {
    if (this.unlockPromise) return this.unlockPromise;

    // Safari/移动端要求 resume 发生在用户手势中；失败只静音，不能阻断游戏。
    const pending = (async () => {
      try {
        const context = this.ensureContext();
        if (!context) return false;
        if (context.state === 'suspended') await context.resume();
        return context.state === 'running';
      } catch {
        return false;
      }
    })();
    this.unlockPromise = pending;
    void pending.then(() => {
      if (this.unlockPromise === pending) this.unlockPromise = null;
    });
    return pending;
  }

  ready(effectName = '', cooldown = 0) {
    try {
      if (this.mute || this.masterVolume <= 0 || this.sfxVolume <= 0) return null;
      const context = this.ensureContext();
      if (!context || context.state !== 'running') {
        void this.unlock();
        return null;
      }
      if (this.activeSources >= this.maxSources) return null;
      const limit = HIGH_FREQUENCY_LIMITS[effectName];
      if (limit && (this.activeByEffect.get(effectName) || 0) >= limit.maxVoices) return null;
      if (effectName) {
        const lastPlayed = this.lastPlayedAt.get(effectName) ?? -Infinity;
        const effectiveCooldown = Math.max(cooldown, limit?.cooldown || 0);
        if (context.currentTime - lastPlayed < effectiveCooldown) return null;
        this.lastPlayedAt.set(effectName, context.currentTime);
      }
      return context;
    } catch {
      return null;
    }
  }

  trackSource(source, nodes, effectName = '') {
    this.activeSources += 1;
    if (effectName) this.activeByEffect.set(effectName, (this.activeByEffect.get(effectName) || 0) + 1);
    source.onended = () => {
      this.activeSources = Math.max(0, this.activeSources - 1);
      if (effectName) {
        const remaining = Math.max(0, (this.activeByEffect.get(effectName) || 0) - 1);
        if (remaining === 0) this.activeByEffect.delete(effectName);
        else this.activeByEffect.set(effectName, remaining);
      }
      try { source.disconnect(); } catch { /* 节点可能已被浏览器回收。 */ }
      nodes.forEach((node) => {
        try { node.disconnect(); } catch { /* 同上。 */ }
      });
    };
  }

  oscillator(context, { from, to = from, duration, volume, type = 'sine', attack = 0.004, delay = 0, bus = this.sfxGain, effectName = '' }) {
    if (this.activeSources >= this.maxSources) return;
    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, from), startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), endAt);
    gain.gain.setValueAtTime(MIN_GAIN, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.08, volume), startAt + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, endAt);
    oscillator.connect(gain).connect(bus);
    this.trackSource(oscillator, [gain], effectName);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.01);
  }

  noise(context, { duration, volume, filterType = 'lowpass', frequency = 900, delay = 0, bus = this.sfxGain, effectName = '' }) {
    if (this.activeSources >= this.maxSources) return;
    if (!this.noiseBuffer) {
      const frameCount = Math.floor(context.sampleRate * 0.4);
      this.noiseBuffer = context.createBuffer(1, frameCount, context.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = this.random() * 2 - 1;
    }

    const startAt = context.currentTime + delay;
    const endAt = startAt + Math.min(duration, 0.38);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, startAt);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(Math.min(0.08, volume), startAt);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, endAt);
    source.connect(filter).connect(gain).connect(bus);
    this.trackSource(source, [filter, gain], effectName);
    source.start(startAt);
    source.stop(endAt);
  }

  sequence(context, notes, { volume = 0.025, type = 'triangle', bus = this.sfxGain, effectName = '' } = {}) {
    if (this.activeSources >= this.maxSources) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime;
    let cursor = startAt;
    oscillator.type = type;
    gain.gain.setValueAtTime(MIN_GAIN, startAt);
    notes.forEach(({ frequency, duration = 0.07, gap = 0.025 }) => {
      oscillator.frequency.setValueAtTime(frequency, cursor);
      gain.gain.setValueAtTime(MIN_GAIN, cursor);
      gain.gain.exponentialRampToValueAtTime(Math.min(0.07, volume), cursor + 0.006);
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, cursor + duration);
      cursor += duration + gap;
    });
    oscillator.connect(gain).connect(bus);
    this.trackSource(oscillator, [gain], effectName);
    oscillator.start(startAt);
    oscillator.stop(cursor);
  }

  pickVariant(effectName) {
    const variants = AUDIO_VARIANTS[effectName];
    const randomValue = clampVolume(this.random(), 0);
    return variants[Math.min(variants.length - 1, Math.floor(randomValue * variants.length))];
  }

  duckOtherSfx(context, duration, ratio) {
    const gain = this.sfxGain?.gain;
    if (!gain) return;
    const now = context.currentTime;
    const endAt = now + duration;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.min(gain.value, this.sfxVolume), now);
    gain.linearRampToValueAtTime(this.sfxVolume * ratio, now + 0.025);
    gain.setValueAtTime(this.sfxVolume * ratio, Math.max(now + 0.025, endAt - 0.09));
    gain.linearRampToValueAtTime(this.sfxVolume, endAt);
  }

  // 兼容旧调用：单音仍可用，但统一经过分组音量、总音量和压缩器。
  tone(frequency, duration = 0.08, volume = 0.025, type = 'sine') {
    const context = this.ready();
    if (!context) return;
    this.oscillator(context, { from: frequency, duration, volume, type });
  }

  machineGun() {
    const context = this.ready('machineGun', 0.035);
    if (!context) return;
    const variant = this.pickVariant('machineGun');
    this.oscillator(context, { ...variant, type: 'square', effectName: 'machineGun' });
    this.noise(context, { duration: 0.045, volume: 0.014, filterType: 'highpass', frequency: variant.noiseFrequency, effectName: 'machineGun' });
  }

  mortarLaunch() {
    const context = this.ready('mortarLaunch', 0.12);
    if (!context) return;
    this.oscillator(context, { from: 220, to: 58, duration: 0.16, volume: 0.025, type: 'triangle', effectName: 'mortarLaunch' });
    this.noise(context, { duration: 0.1, volume: 0.012, filterType: 'bandpass', frequency: 620, effectName: 'mortarLaunch' });
  }

  mortarImpact() {
    const context = this.ready('mortarImpact', 0.08);
    if (!context) return;
    const variant = this.pickVariant('mortarImpact');
    this.oscillator(context, { ...variant, type: 'sawtooth', effectName: 'mortarImpact' });
    this.noise(context, { duration: variant.duration, volume: 0.036, filterType: 'lowpass', frequency: variant.noiseFrequency, effectName: 'mortarImpact' });
  }

  sniper() {
    const context = this.ready('sniper', 0.1);
    if (!context) return;
    this.oscillator(context, { from: 520, to: 96, duration: 0.11, volume: 0.034, type: 'square', effectName: 'sniper' });
    this.noise(context, { duration: 0.07, volume: 0.018, filterType: 'highpass', frequency: 1700, effectName: 'sniper' });
  }

  enemyHit() {
    const context = this.ready('enemyHit', 0.045);
    if (!context) return;
    const variant = this.pickVariant('enemyHit');
    this.oscillator(context, { ...variant, type: 'triangle', effectName: 'enemyHit' });
  }

  enemyKill() {
    const context = this.ready('enemyKill', 0.075);
    if (!context) return;
    const variant = this.pickVariant('enemyKill');
    this.oscillator(context, { ...variant, type: 'triangle', effectName: 'enemyKill' });
    this.noise(context, { duration: 0.1, volume: 0.01, filterType: 'lowpass', frequency: variant.noiseFrequency, effectName: 'enemyKill' });
  }

  waveAlert() {
    const context = this.ready('waveAlert', 0.8);
    if (!context) return;
    this.duckOtherSfx(context, 0.52, 0.46);
    this.sequence(context, [
      { frequency: 620, duration: 0.09, gap: 0.055 },
      { frequency: 780, duration: 0.12, gap: 0 },
    ], { volume: 0.028, type: 'square', bus: this.alertGain, effectName: 'waveAlert' });
  }

  bossAlert() {
    const context = this.ready('bossAlert', 1.8);
    if (!context) return;
    this.duckOtherSfx(context, 0.9, 0.3);
    this.sequence(context, [
      { frequency: 118, duration: 0.16, gap: 0.06 },
      { frequency: 168, duration: 0.16, gap: 0.06 },
      { frequency: 118, duration: 0.22, gap: 0 },
    ], { volume: 0.04, type: 'sawtooth', bus: this.alertGain, effectName: 'bossAlert' });
    this.noise(context, { duration: 0.34, volume: 0.012, filterType: 'bandpass', frequency: 430, bus: this.alertGain, effectName: 'bossAlert' });
  }

  buy() {
    const context = this.ready('buy', 0.08);
    if (!context) return;
    this.sequence(context, [
      { frequency: 460, duration: 0.065, gap: 0.02 },
      { frequency: 650, duration: 0.09, gap: 0 },
    ], { volume: 0.026, effectName: 'buy' });
  }

  reward() {
    const context = this.ready('reward', 0.11);
    if (!context) return;
    this.sequence(context, [
      { frequency: 610, duration: 0.055, gap: 0.018 },
      { frequency: 820, duration: 0.085, gap: 0 },
    ], { volume: 0.022, effectName: 'reward' });
  }

  hit() {
    const context = this.ready('hit', 0.075);
    if (!context) return;
    this.oscillator(context, { from: 112, to: 54, duration: 0.12, volume: 0.03, type: 'square', effectName: 'hit' });
    this.noise(context, { duration: 0.08, volume: 0.013, filterType: 'lowpass', frequency: 680, effectName: 'hit' });
  }
}

export const audioService = new AudioService();
