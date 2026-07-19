import { strict as assert } from 'node:assert';
import { AudioService } from '../src/game/services/AudioService.js';

class MockAudioParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  record(type, value, time) { this.value = value; this.events.push({ type, value, time }); }
  setValueAtTime(value, time) { this.record('set', value, time); }
  exponentialRampToValueAtTime(value, time) { this.record('exponential', value, time); }
  linearRampToValueAtTime(value, time) { this.record('linear', value, time); }
  cancelScheduledValues(time) { this.events.push({ type: 'cancel', time }); }
}

class MockNode {
  constructor() { this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
}

class MockSource extends MockNode {
  constructor() { super(); this.onended = null; this.starts = []; this.stops = []; }
  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); }
}

class MockAudioContext {
  constructor(state = 'running') {
    this.state = state;
    this.currentTime = 0;
    this.sampleRate = 100;
    this.destination = new MockNode();
    this.oscillators = [];
    this.bufferSources = [];
  }
  async resume() { this.state = 'running'; }
  createGain() { const node = new MockNode(); node.gain = new MockAudioParam(1); return node; }
  createDynamicsCompressor() {
    const node = new MockNode();
    ['threshold', 'knee', 'ratio', 'attack', 'release'].forEach((key) => { node[key] = new MockAudioParam(); });
    return node;
  }
  createOscillator() {
    const node = new MockSource();
    node.frequency = new MockAudioParam();
    this.oscillators.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = new MockNode();
    node.frequency = new MockAudioParam();
    node.Q = new MockAudioParam();
    return node;
  }
  createBuffer(_channels, frames) {
    const samples = new Float32Array(frames);
    return { getChannelData: () => samples };
  }
  createBufferSource() {
    const node = new MockSource();
    this.bufferSources.push(node);
    return node;
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key),
  };
}

function firstFrequency(effectName, randomValue) {
  const context = new MockAudioContext();
  const service = new AudioService({ context, random: () => randomValue, storage: null, windowRef: null });
  service[effectName]();
  return context.oscillators[0].frequency.events[0].value;
}

['machineGun', 'enemyHit', 'enemyKill', 'mortarImpact'].forEach((effectName) => {
  const variants = [0.01, 0.4, 0.8].map((randomValue) => firstFrequency(effectName, randomValue));
  assert.equal(new Set(variants).size, 3, `${effectName} 应有3个可区分变体`);
});

const throttleContext = new MockAudioContext();
const throttled = new AudioService({ context: throttleContext, random: () => 0.4, storage: null, windowRef: null });
throttled.machineGun();
throttled.machineGun();
assert.equal(throttleContext.oscillators.length, 1, '同一时刻的机枪声应被冷却节流');
throttleContext.currentTime = 0.05; throttled.machineGun();
throttleContext.currentTime = 0.1; throttled.machineGun();
throttleContext.currentTime = 0.15; throttled.machineGun();
assert.equal(throttleContext.oscillators.length, 3, '机枪活跃声源达到上限后应拒绝新播放');
assert.equal(throttled.activeByEffect.get('machineGun'), 6);

const storage = memoryStorage();
const volumeContext = new MockAudioContext();
const volumeService = new AudioService({ context: volumeContext, storage, windowRef: null });
volumeService.ensureContext();
assert.equal(volumeService.setMasterVolume(4), 1);
assert.equal(volumeService.setSfxVolume(-2), 0);
assert.equal(volumeService.setSfxVolume(0.5), 0.5);
assert.equal(volumeService.setMasterVolume(0.7), 0.7);
const sourcesBeforeMute = volumeContext.oscillators.length;
assert.equal(volumeService.setMute(true), true);
assert.equal(volumeService.masterGain.gain.value, 0);
volumeService.tone(440);
assert.equal(volumeContext.oscillators.length, sourcesBeforeMute, '静音时不应新建声源');
assert.equal(volumeService.toggleMute(), false);
assert.equal(volumeService.masterGain.gain.value, 0.7);
volumeService.tone(440);
assert.equal(volumeContext.oscillators.length, sourcesBeforeMute + 1, '恢复后应可再次播放');
assert.deepEqual(JSON.parse(storage.value('last-outpost-audio-settings-v1')), { masterVolume: 0.7, sfxVolume: 0.5, mute: false });

const loaded = new AudioService({
  context: new MockAudioContext(),
  windowRef: null,
  storage: memoryStorage({ 'last-outpost-audio-settings-v1': JSON.stringify({ masterVolume: 8, sfxVolume: -1, mute: true }) }),
});
assert.deepEqual(loaded.settings(), { masterVolume: 1, sfxVolume: 0, mute: true });

const duckContext = new MockAudioContext();
const ducked = new AudioService({ context: duckContext, storage: null, windowRef: null });
ducked.bossAlert();
assert.equal(ducked.sfxGain.gain.events.some(({ type, value }) => type === 'linear' && value === 0.3), true);
assert.equal(ducked.sfxGain.gain.events.at(-1).value, 1, '压低后应排程恢复SFX音量');
assert.equal(ducked.alertGain.connections[0], ducked.masterGain, '警报应使用独立分组');

const unsupported = new AudioService({ windowRef: null, storage: null });
assert.equal(await unsupported.unlock(), false);
assert.doesNotThrow(() => {
  unsupported.machineGun();
  unsupported.enemyHit();
  unsupported.bossAlert();
});

const brokenStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const safeStorage = new AudioService({ windowRef: null, storage: brokenStorage });
assert.equal(safeStorage.saveSettings(), false);

const seed = () => {
  let value = 7;
  return () => ((value = (value * 48271) % 2147483647) / 2147483647);
};
const seededA = firstFrequency('enemyHit', seed()());
const seededB = firstFrequency('enemyHit', seed()());
assert.equal(seededA, seededB, '相同随机种子应产生相同变体');

console.log('AUDIO SERVICE SIM PASS');
console.log('四类核心音效各 3 个变体；节流、并发、duck、音量、静音恢复、存储与无 WebAudio 降级均通过。');
