import { BALANCE } from '../src/game/config/balance.js';
import { ENEMY_CATALOG as ENEMIES, enemyTravelSeconds } from '../src/game/config/enemies.js';
import { TOWERS } from '../src/game/config/towers.js';
import { WAVES, expandWaveSchedule } from '../src/game/config/waves.js';

const ARRIVAL_WINDOW_MS = 3000;
const EXPECTED_COUNTS = [5, 6, 9, 11, 1];
const SIM_STEP_MS = 20;

function legacySchedule(waveNumber) {
  if (waveNumber === 5) return [{ atMs: 0, enemyType: 'boss' }];
  const count = 3 + waveNumber * 2;
  const intervalMs = Math.max(900, 2200 - waveNumber * 180);
  return Array.from({ length: count }, (_, index) => ({ atMs: index * intervalMs, enemyType: 'normal' }));
}

function legacyTravelSeconds(waveNumber, enemyType) {
  if (enemyType === 'boss') return 114 / 26;
  return 114 / (30 + waveNumber * 3) / (ENEMIES[enemyType]?.speedMultiplier || 1);
}

function arrivalTimes(waveNumber, schedule, travelFn = enemyTravelSeconds) {
  // 峰值沿用压力名额；尸群三只在局部压力中等价于两个普通名额。
  return schedule
    .flatMap((event) => Array.from({ length: event.slotWeight || 1 }, () => event.atMs + travelFn(event.enemyType, waveNumber) * 1000))
    .sort((left, right) => left - right);
}

function maxArrivalsInWindow(times, windowMs) {
  let maximum = 0;
  for (let start = 0; start < times.length; start += 1) {
    let end = start;
    while (end < times.length && times[end] - times[start] <= windowMs) end += 1;
    maximum = Math.max(maximum, end - start);
  }
  return maximum;
}

function maxUnitsOnRoad(waveNumber, schedule) {
  const edges = schedule.flatMap((event) => {
    const units = ENEMIES[event.enemyType]?.packSize || 1;
    const arrival = event.atMs + enemyTravelSeconds(event.enemyType, waveNumber) * 1000;
    return Array.from({ length: units }, () => [
      { atMs: event.atMs, delta: 1 },
      { atMs: arrival, delta: -1 },
    ]).flat();
  }).sort((left, right) => left.atMs - right.atMs || left.delta - right.delta);
  let active = 0;
  let peak = 0;
  for (const edge of edges) {
    active += edge.delta;
    peak = Math.max(peak, active);
  }
  return peak;
}

function totalPressure(waveNumber, schedule) {
  return schedule.reduce((sum, event) => {
    if (event.enemyType === 'boss') return sum + 720 * 24;
    const enemy = ENEMIES[event.enemyType];
    const hp = 32 + waveNumber * 26;
    const damage = 4 + waveNumber * 2;
    return sum + hp * damage * (enemy?.hpMultiplier || 1) * (enemy?.damageMultiplier || 1) * (enemy?.packSize || 1);
  }, 0);
}

function slotCount(schedule) {
  return schedule.reduce((sum, event) => sum + (event.slotWeight || 1), 0);
}

function visualUnitCount(schedule) {
  return schedule.reduce((sum, event) => sum + (ENEMIES[event.enemyType]?.packSize || 1), 0);
}

function buildCombatUnits(waveNumber, travelFn) {
  return expandWaveSchedule(waveNumber).flatMap((event) => {
    const archetype = ENEMIES[event.enemyType];
    const packSize = archetype?.packSize || 1;
    const baseHp = event.enemyType === 'boss' ? 720 : 32 + waveNumber * 26;
    const baseDamage = event.enemyType === 'boss' ? 24 : 4 + waveNumber * 2;
    return Array.from({ length: packSize }, (_, packIndex) => ({
      enemyType: event.enemyType,
      spawnAtMs: event.atMs,
      travelMs: travelFn(event.enemyType, waveNumber) * 1000,
      hp: Math.round(baseHp * (archetype?.hpMultiplier || 1)),
      damage: baseDamage * (archetype?.damageMultiplier || 1),
      x: (packIndex - (packSize - 1) / 2) * 18,
      attackClock: 0,
      alive: true,
      spawned: false,
      y: 0,
    }));
  });
}

function simulateCombat(waveNumber, towerTypes, travelFn = enemyTravelSeconds) {
  const units = buildCombatUnits(waveNumber, travelFn);
  const runtimes = towerTypes.map((entry) => ({
    type: typeof entry === 'string' ? entry : entry.type,
    upgrades: typeof entry === 'string' ? {} : entry.upgrades || {},
    attackClock: 0,
    shots: 0,
  }));
  const impacts = [];
  const wave = WAVES[waveNumber - 1];
  const simulationLimitMs = wave.durationSeconds * 1000 + 30000;
  let doorHp = BALANCE.startingDoorHp;
  let kills = 0;
  let finishAtMs = simulationLimitMs;

  for (let timeMs = 0; timeMs <= simulationLimitMs && doorHp > 0; timeMs += SIM_STEP_MS) {
    for (const unit of units) {
      if (!unit.spawned && timeMs >= unit.spawnAtMs) unit.spawned = true;
      if (!unit.spawned || !unit.alive) continue;
      const progress = Math.min(1, (timeMs - unit.spawnAtMs) / unit.travelMs);
      unit.y = progress * 570;
      if (progress < 1) continue;
      unit.attackClock += SIM_STEP_MS;
      const attackDelay = unit.enemyType === 'boss' ? 720 : 980;
      if (unit.attackClock >= attackDelay) {
        unit.attackClock = 0;
        doorHp = Math.max(0, doorHp - unit.damage);
      }
    }

    for (let index = impacts.length - 1; index >= 0; index -= 1) {
      const impact = impacts[index];
      if (impact.atMs > timeMs) continue;
      for (const unit of units) {
        if (!unit.alive || !unit.spawned) continue;
        if (Math.hypot(unit.y - impact.y, unit.x - impact.x) <= impact.radius) unit.hp -= impact.damage;
      }
      impacts.splice(index, 1);
    }

    const living = units.filter((unit) => unit.spawned && unit.alive);
    for (const runtime of runtimes) {
      if (living.length === 0) continue;
      const tower = TOWERS[runtime.type];
      runtime.attackClock += SIM_STEP_MS;
      const cadence = tower.tracks.cadence.values[runtime.upgrades.cadence || 0];
      const power = tower.tracks.power.values[runtime.upgrades.power || 0];
      const payload = tower.tracks.payload.values[runtime.upgrades.payload || 0];
      if (runtime.attackClock < cadence) continue;
      runtime.attackClock = 0;
      const targets = living.slice().sort((left, right) => right.y - left.y);
      if (runtime.type === 'machineGun') {
        targets[0].hp -= power;
        runtime.shots += 1;
        if (runtime.shots >= payload) {
          runtime.shots = 0;
          runtime.attackClock = -tower.reloadMs;
        }
      } else if (runtime.type === 'mortar') {
        for (let shell = 0; shell < payload; shell += 1) {
          impacts.push({ atMs: timeMs + 420 + shell * 165, x: targets[0].x, y: targets[0].y, radius: tower.blastRadius, damage: power });
        }
      } else if (runtime.type === 'sniper') {
        targets.slice(0, payload).forEach((target) => { target.hp -= power; });
      }
    }

    for (const unit of units) {
      if (unit.alive && unit.hp <= 0) {
        unit.alive = false;
        kills += 1;
      }
    }
    if (kills === units.length) {
      finishAtMs = timeMs;
      break;
    }
  }
  return { kills, total: units.length, doorHp: Math.round(doorHp), finishSeconds: finishAtMs / 1000 };
}

console.log('LINE ZERO · 实时难度与旅行时间检查');
console.log('波次 | 名额/实敌 | 抵达窗口 | 同屏峰值 | 3秒抵达峰值 | 总压力 | 时限余量');

let totalEnemies = 0;
for (const wave of WAVES) {
  const current = expandWaveSchedule(wave);
  const legacy = legacySchedule(wave.number);
  const currentArrivals = arrivalTimes(wave.number, current);
  const legacyArrivals = arrivalTimes(wave.number, legacy, (type, number) => legacyTravelSeconds(number, type));
  const currentPeak = maxArrivalsInWindow(currentArrivals, ARRIVAL_WINDOW_MS);
  const legacyPeak = maxArrivalsInWindow(legacyArrivals, ARRIVAL_WINDOW_MS);
  const pressureRatio = totalPressure(wave.number, current) / totalPressure(wave.number, legacy);
  const slots = slotCount(current);
  const visualUnits = visualUnitCount(current);
  const marginSeconds = wave.durationSeconds - currentArrivals.at(-1) / 1000;
  totalEnemies += slots;

  console.log([
    `${wave.number}`.padStart(2),
    `${slots}/${visualUnits}`.padStart(7),
    `${(currentArrivals[0] / 1000).toFixed(2)}-${(currentArrivals.at(-1) / 1000).toFixed(2)}s`.padStart(13),
    `${maxUnitsOnRoad(wave.number, current)}`.padStart(8),
    `${currentPeak}/${legacyPeak}`.padStart(11),
    `${pressureRatio.toFixed(2)}x`.padStart(7),
    `${marginSeconds.toFixed(2)}s`.padStart(8),
  ].join(' | '));

  if (slots !== EXPECTED_COUNTS[wave.number - 1]) throw new Error(`第${wave.number}波压力名额发生变化`);
  if (marginSeconds < 0) throw new Error(`第${wave.number}波最后一批无法在波次时长内抵达`);
  // 第2波是本次主动降难的缓冲波，其余波次仍保持原压力的 ±15%。
  const minimumPressure = wave.number === 2 ? 0.75 : 0.85;
  if (pressureRatio < minimumPressure || pressureRatio > 1.15) throw new Error(`第${wave.number}波总压力偏移超过允许范围`);
  if (currentPeak / legacyPeak > 2) throw new Error(`第${wave.number}波局部到达密度过高`);
}

const travelChecks = {
  normalWave1: enemyTravelSeconds('normal', 1),
  normalWave4: enemyTravelSeconds('normal', 4),
  runnerWave2: enemyTravelSeconds('runner', 2),
  runnerWave4: enemyTravelSeconds('runner', 4),
  armoredWave3: enemyTravelSeconds('armored', 3),
  armoredWave4: enemyTravelSeconds('armored', 4),
  boss: enemyTravelSeconds('boss', 5),
};
console.log('\n旅行时间：', travelChecks);

if (Math.abs(travelChecks.normalWave1 - 8.8) > 0.01 || Math.abs(travelChecks.normalWave4 - 7.2) > 0.01) throw new Error('普通尸旅行时间曲线偏离目标');
if (travelChecks.runnerWave2 < 6 || travelChecks.runnerWave4 > 7) throw new Error('跑尸旅行时间应保持在6–7秒');
if (travelChecks.armoredWave3 < 10 || travelChecks.armoredWave4 > 12) throw new Error('装甲尸旅行时间应保持在10–12秒');
if (Math.abs(travelChecks.boss - 11) > 0.01) throw new Error('Boss旅行时间应为11秒');

const firstWaveBefore = simulateCombat(1, ['machineGun'], legacyTravelSeconds);
const firstWaveAfter = simulateCombat(1, ['machineGun']);
const reasonableDual = [{ type: 'machineGun', upgrades: { power: 1 } }, 'mortar'];
const secondWaveBefore = simulateCombat(2, reasonableDual, legacyTravelSeconds);
const secondWaveAfter = simulateCombat(2, reasonableDual);
console.log('\n战斗近似模拟（基础塔，无升级）：');
console.log(`第1波单机枪  改前 ${firstWaveBefore.kills}/${firstWaveBefore.total}杀 门${firstWaveBefore.doorHp}  →  改后 ${firstWaveAfter.kills}/${firstWaveAfter.total}杀 门${firstWaveAfter.doorHp}`);
console.log(`第2波双塔（机枪威力I）  改前 ${secondWaveBefore.kills}/${secondWaveBefore.total}杀 门${secondWaveBefore.doorHp}  →  改后 ${secondWaveAfter.kills}/${secondWaveAfter.total}杀 门${secondWaveAfter.doorHp}`);

if (firstWaveAfter.kills !== firstWaveAfter.total || firstWaveAfter.doorHp < 75) throw new Error('第1波基础机枪仍可能轻易失败');
if (secondWaveAfter.kills !== secondWaveAfter.total || secondWaveAfter.doorHp < 75) throw new Error('第2波合理双塔仍不稳定');
if (totalEnemies !== 32) throw new Error(`五波总数应为32，当前为${totalEnemies}`);

console.log(`\n检查通过：五波保持 ${totalEnemies} 个压力名额；旅行时间、抵达峰值、时限余量和前两波基础构筑均满足目标。`);
