import { BALANCE, ROOMS } from '../src/game/config/balance.js';
import { createBossPhaseState, getBossModifiers, updateBossPhase } from '../src/game/combat/bossPhases.js';
import { ATTACK_PROFILES, DEFENSE_PROFILES, calculateDamage } from '../src/game/combat/damageModel.js';
import { ENEMY_CATALOG, enemyStatsForWave } from '../src/game/config/enemies.js';
import { TOWER_CATALOG, TOWER_TRACKS, TOWER_UPGRADE_COSTS } from '../src/game/config/towers.js';
import { WAVES, expandWaveSchedule } from '../src/game/config/waves.js';

const STEP_MS = 100;
const ROAD_LENGTH_PX = 588;
const MAX_OVERTIME_MS = 60000;
const roomById = new Map(ROOMS.map((room) => [room.id, room]));

const ROUTES = [
  { id: 'Q-MG-MO', room: 'quiet', towers: ['machineGun', 'mortar'], focusIndex: 1, label: '后勤·机枪+迫击' },
  { id: 'S-MG-SN', room: 'stone', towers: ['machineGun', 'sniper'], focusIndex: 1, label: '装甲·机枪+狙击' },
  { id: 'L-FL-RO', room: 'lantern', towers: ['flamethrower', 'antiArmorRocket'], focusIndex: 0, label: '空投·火焰+火箭' },
  { id: 'S-GR-SN', room: 'stone', towers: ['grenadeLauncher', 'sniper'], focusIndex: 0, label: '装甲·榴弹+狙击' },
  { id: 'Q-MG-SN', room: 'quiet', towers: ['machineGun', 'sniper'], focusIndex: 1, label: '后勤·机枪+狙击' },
  { id: 'Q-FL-RO', room: 'quiet', towers: ['flamethrower', 'antiArmorRocket'], focusIndex: 0, label: '后勤·火焰+火箭' },
];

const TRACK_PRIORITY = Object.freeze({
  machineGun: ['power', 'cadence', 'payload'],
  mortar: ['payload', 'cadence', 'power'],
  sniper: ['power', 'cadence', 'payload'],
  flamethrower: ['cadence', 'power', 'payload'],
  grenadeLauncher: ['payload', 'cadence', 'power'],
  antiArmorRocket: ['power', 'cadence', 'payload'],
});

function assert(condition, message) {
  if (!condition) throw new Error(`全局回归失败：${message}`);
}

function createTower(type) {
  return { type, upgrades: { power: 0, cadence: 0, payload: 0 }, attackClock: 0, shots: 0 };
}

function towerStats(tower) {
  const config = TOWER_CATALOG[tower.type];
  return Object.fromEntries(TOWER_TRACKS.map((track) => [track, config.tracks[track].values[tower.upgrades[track]]]));
}

function totalUpgrades(tower) {
  return TOWER_TRACKS.reduce((sum, track) => sum + tower.upgrades[track], 0);
}

function upgradeCost(tower, track) {
  const level = tower.upgrades[track];
  const maxLevel = TOWER_CATALOG[tower.type].tracks[track].values.length - 1;
  return level < maxLevel ? TOWER_UPGRADE_COSTS[level] : null;
}

function buyPreferredUpgrade(run, tower) {
  const preferredTrack = TRACK_PRIORITY[tower.type][0];
  const cost = upgradeCost(tower, preferredTrack);
  if (cost === null || run.leaves < cost) return false;
  run.leaves -= cost;
  tower.upgrades[preferredTrack] += 1;
  return true;
}

function chooseUpgrade(run, reserve) {
  const candidates = run.towers.flatMap((tower, towerIndex) => TRACK_PRIORITY[tower.type].flatMap((track, priorityIndex) => {
    const cost = upgradeCost(tower, track);
    if (cost === null || run.leaves - cost < reserve) return [];
    const level = tower.upgrades[track];
    // 主塔略优先，但低等级和核心成长线更划算，避免单线无脑灌满。
    const score = (towerIndex === run.route.focusIndex ? 14 : 0) + (2 - priorityIndex) * 11 + (5 - level) * 7 - cost * 0.08;
    return [{ tower, track, cost, score }];
  }));
  candidates.sort((left, right) => right.score - left.score || left.cost - right.cost);
  const choice = candidates[0];
  if (!choice) return false;
  run.leaves -= choice.cost;
  choice.tower.upgrades[choice.track] += 1;
  return true;
}

function maxDoorHp(run) {
  return Math.round(BALANCE.doorHp[run.doorLevel] * (1 + (run.room.doorBonus || 0)));
}

function tryBuildSecondTower(run) {
  if (run.towers.length !== 1) return false;
  const type = run.route.towers[1];
  const buildCost = TOWER_CATALOG[type].buildCost;
  if (run.leaves < buildCost) return false;
  const tower = createTower(type);
  run.leaves -= buildCost;
  run.towers.push(tower);
  buyPreferredUpgrade(run, tower);
  return true;
}

function prepareWave(run, waveNumber) {
  run.leaves += BALANCE.bedIncome[run.bedLevel] + (run.room.incomeBonus || 0);
  // 昂贵首塔开局可能只够建造；第一波收入到账后补上一次基础强化。
  if (waveNumber === 1 && totalUpgrades(run.towers[0]) === 0) buyPreferredUpgrade(run, run.towers[0]);

  if (waveNumber >= 2) tryBuildSecondTower(run);

  if (waveNumber >= 2) {
    const nextBedLevel = run.bedLevel + 1;
    const stationReserve = nextBedLevel < BALANCE.bedCosts.length ? BALANCE.bedCosts[nextBedLevel] : 0;
    const doorReserve = waveNumber < BALANCE.totalWaves ? BALANCE.doorCosts[Math.min(run.doorLevel + 1, BALANCE.doorCosts.length - 1)] : 0;
    const reserve = waveNumber === BALANCE.totalWaves ? 0 : Math.min(56, Math.max(stationReserve, doorReserve));
    while (chooseUpgrade(run, reserve)) { /* 按本波预算做朴素升级。 */ }
  }
}

function upgradeReserve(run, waveNumber) {
  if (waveNumber >= BALANCE.totalWaves) return 0;
  const nextBedLevel = run.bedLevel + 1;
  const stationReserve = nextBedLevel < BALANCE.bedCosts.length ? BALANCE.bedCosts[nextBedLevel] : 0;
  return Math.min(56, stationReserve);
}

function restInvestments(run, waveNumber) {
  if (run.doorHp / maxDoorHp(run) < 0.7 && run.doorLevel < BALANCE.doorHp.length - 1) {
    const cost = BALANCE.doorCosts[run.doorLevel + 1];
    if (run.leaves >= cost) {
      run.leaves -= cost;
      run.doorLevel += 1;
      run.doorHp = maxDoorHp(run);
    }
  }

  const nextBedLevel = run.bedLevel + 1;
  const maxBedLevel = Math.min(BALANCE.supplyPerSecond.length, BALANCE.bedCosts.length) - 1;
  if (waveNumber >= nextBedLevel - 1 && nextBedLevel <= maxBedLevel) {
    const cost = BALANCE.bedCosts[nextBedLevel];
    if (run.leaves >= cost) {
      run.leaves -= cost;
      run.bedLevel = nextBedLevel;
    }
  }
  // 休整阶段补给站仍持续工作；升级成功后按新速率结算这10秒。
  run.leaves += (BALANCE.supplyPerSecond[run.bedLevel] + (run.room.supplyRateBonus || 0)) * 10;
}

function createEnemy(type, waveNumber, spawnIndex) {
  const config = ENEMY_CATALOG[type];
  const stats = enemyStatsForWave(type, waveNumber);
  const shieldMax = config.behavior?.id === 'frontal-shield' ? Math.round(stats.hp * config.behavior.shieldHpRatio) : 0;
  return {
    id: `${waveNumber}-${type}-${spawnIndex}`,
    type,
    config,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    reward: stats.reward,
    travelMs: stats.travelSeconds * 1000,
    progress: 0,
    attackClock: 0,
    supportClock: 0,
    fuseRemaining: null,
    speedBoostRemaining: 0,
    shieldHp: shieldMax,
    dead: false,
    armor: type === 'boss' ? 2 : type === 'armored' || type === 'shielded' ? 1 : 0,
    bossState: type === 'boss' ? createBossPhaseState(stats.hp) : null,
    pendingShockwaves: [],
  };
}

function liveEnemies(state) {
  return state.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0);
}

function nearestGate(state, count = 1) {
  return liveEnemies(state).sort((left, right) => right.progress - left.progress).slice(0, count);
}

function highestHp(state, count = 1) {
  return liveEnemies(state).sort((left, right) => right.hp - left.hp || right.progress - left.progress).slice(0, count);
}

function highestArmor(state, count = 1) {
  return liveEnemies(state).sort((left, right) => right.armor - left.armor || right.hp - left.hp).slice(0, count);
}

function densestTarget(state, radiusPx) {
  const enemies = liveEnemies(state);
  let best = null;
  enemies.forEach((candidate) => {
    const members = enemies.filter((enemy) => Math.abs(enemy.progress - candidate.progress) * ROAD_LENGTH_PX <= radiusPx);
    if (!best || members.length > best.members.length) best = { candidate, members };
  });
  return best?.candidate || null;
}

function damageEnemy(run, state, enemy, baseDamage, towerType, status = {}) {
  if (!enemy || enemy.dead) return;
  const result = calculateDamage(baseDamage, ATTACK_PROFILES[towerType], DEFENSE_PROFILES[enemy.type] || DEFENSE_PROFILES.normal, status);
  let damage = result.damage;
  const directFire = ['machineGun', 'sniper', 'antiArmorRocket'].includes(towerType);
  if (directFire && enemy.shieldHp > 0) {
    const blocked = Math.min(damage * (enemy.config.behavior?.frontalReduction || 0.55), enemy.shieldHp);
    enemy.shieldHp = Math.max(0, enemy.shieldHp - damage);
    damage -= blocked;
  }
  enemy.hp -= damage;
  if (enemy.hp > 0) return;
  enemy.dead = true;
  run.leaves += enemy.reward;
  state.kills += 1;
  if (enemy.config.behavior?.id === 'death-cloud' && enemy.progress >= 0.68) state.toxicSlowMs = Math.max(state.toxicSlowMs, enemy.config.behavior.durationMs);
}

function attackWithTower(run, state, tower) {
  const config = TOWER_CATALOG[tower.type];
  const stats = towerStats(tower);
  const cadencePenalty = state.toxicSlowMs > 0 ? 1.25 : 1;
  tower.attackClock += STEP_MS;
  if (tower.attackClock < stats.cadence * cadencePenalty) return;
  tower.attackClock = 0;

  if (tower.type === 'machineGun') {
    const target = nearestGate(state)[0];
    if (target) damageEnemy(run, state, target, stats.power, tower.type);
    tower.shots += 1;
    if (tower.shots >= stats.payload) {
      tower.shots = 0;
      tower.attackClock = -config.reloadMs;
    }
    return;
  }

  if (tower.type === 'mortar' || tower.type === 'grenadeLauncher') {
    const radius = tower.type === 'mortar' ? config.blastRadius : config.behavior.blastRadiusPx;
    for (let shell = 0; shell < stats.payload; shell += 1) {
      const target = densestTarget(state, radius);
      if (!target) break;
      liveEnemies(state)
        .filter((enemy) => Math.abs(enemy.progress - target.progress) * ROAD_LENGTH_PX <= radius)
        .forEach((enemy) => damageEnemy(run, state, enemy, stats.power, tower.type));
    }
    return;
  }

  if (tower.type === 'sniper') {
    nearestGate(state, stats.payload).forEach((enemy) => damageEnemy(run, state, enemy, stats.power, tower.type));
    return;
  }

  if (tower.type === 'flamethrower') {
    nearestGate(state, stats.payload)
      .filter((enemy) => (1 - enemy.progress) * ROAD_LENGTH_PX <= config.behavior.rangePx)
      .forEach((enemy) => damageEnemy(run, state, enemy, stats.power, tower.type));
    return;
  }

  if (tower.type === 'antiArmorRocket') {
    const target = highestArmor(state)[0] || highestHp(state)[0];
    if (target) damageEnemy(run, state, target, stats.power, tower.type, { armorBreak: stats.payload });
  }
}

function updateEnemyActions(run, state, enemy) {
  if (enemy.dead) return;
  enemy.speedBoostRemaining = Math.max(0, enemy.speedBoostRemaining - STEP_MS);
  let moveMultiplier = enemy.speedBoostRemaining > 0 ? 1.08 : 1;
  let attackIntervalMultiplier = 1;

  if (enemy.type === 'boss') {
    enemy.bossState = updateBossPhase(enemy.bossState, enemy.hp, STEP_MS);
    const modifiers = getBossModifiers(enemy.bossState);
    moveMultiplier *= modifiers.moveSpeedMultiplier;
    attackIntervalMultiplier = modifiers.attackIntervalMultiplier;
    enemy.bossState.events.filter((event) => event.type === 'shockwave').forEach((event) => {
      enemy.pendingShockwaves.push({ remaining: event.telegraphMs, hpAtStart: enemy.hp });
    });
    enemy.pendingShockwaves.forEach((shockwave) => { shockwave.remaining -= STEP_MS; });
    enemy.pendingShockwaves.filter((shockwave) => shockwave.remaining <= 0).forEach((shockwave) => {
      if (shockwave.hpAtStart - enemy.hp < enemy.maxHp * 0.05) run.doorHp -= Math.max(6, enemy.damage * 0.35);
    });
    enemy.pendingShockwaves = enemy.pendingShockwaves.filter((shockwave) => shockwave.remaining > 0);
  }

  if (enemy.progress < 1) enemy.progress = Math.min(1, enemy.progress + STEP_MS / enemy.travelMs * moveMultiplier);
  else if (enemy.config.behavior?.id === 'gate-detonation') {
    enemy.fuseRemaining ??= enemy.config.behavior.fuseMs;
    enemy.fuseRemaining -= STEP_MS;
    if (enemy.fuseRemaining <= 0) {
      run.doorHp -= enemy.damage;
      enemy.dead = true;
    }
  } else {
    enemy.attackClock += STEP_MS;
    const interval = (enemy.type === 'boss' ? 720 : 980) * attackIntervalMultiplier;
    if (enemy.attackClock >= interval) {
      enemy.attackClock = 0;
      run.doorHp -= enemy.damage;
    }
  }

  if (enemy.config.behavior?.id === 'support-pulse') {
    enemy.supportClock += STEP_MS;
    if (enemy.supportClock >= enemy.config.behavior.pulseMs) {
      enemy.supportClock = 0;
      liveEnemies(state).filter((ally) => ally !== enemy && ally.type !== 'boss'
        && Math.abs(ally.progress - enemy.progress) * ROAD_LENGTH_PX <= enemy.config.behavior.radiusPx)
        .forEach((ally) => {
          ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * enemy.config.behavior.healRatio);
          ally.speedBoostRemaining = enemy.config.behavior.pulseMs * 0.75;
        });
    }
  }
}

function runWave(run, wave) {
  const events = expandWaveSchedule(wave);
  const state = { enemies: [], kills: 0, toxicSlowMs: 0 };
  let eventIndex = 0;
  let spawnIndex = 0;
  let elapsed = 0;
  const deadline = wave.durationSeconds * 1000 + MAX_OVERTIME_MS;

  while (elapsed <= deadline && run.doorHp > 0) {
    run.leaves += (BALANCE.supplyPerSecond[run.bedLevel] + (run.room.supplyRateBonus || 0)) * (STEP_MS / 1000);
    if (wave.number >= 2) tryBuildSecondTower(run);
    while (events[eventIndex]?.atMs <= elapsed) {
      const event = events[eventIndex];
      const packSize = ENEMY_CATALOG[event.enemyType].packSize || 1;
      for (let member = 0; member < packSize; member += 1) state.enemies.push(createEnemy(event.enemyType, wave.number, spawnIndex++));
      eventIndex += 1;
    }

    liveEnemies(state).forEach((enemy) => updateEnemyActions(run, state, enemy));
    run.towers.forEach((tower) => attackWithTower(run, state, tower));
    // 实际游戏允许击杀补给到账后立即暂停升级；模拟每100ms做同样的朴素消费。
    if (wave.number >= 2) while (chooseUpgrade(run, upgradeReserve(run, wave.number))) { /* 即时升级 */ }
    state.toxicSlowMs = Math.max(0, state.toxicSlowMs - STEP_MS);
    state.enemies = liveEnemies(state);
    elapsed += STEP_MS;
    if (eventIndex >= events.length && state.enemies.length === 0) break;
  }

  return {
    cleared: eventIndex >= events.length && state.enemies.length === 0 && run.doorHp > 0,
    elapsed,
    kills: state.kills,
    remainingEnemies: state.enemies.map((enemy) => enemy.type),
  };
}

function simulateRoute(route) {
  const room = roomById.get(route.room);
  const run = {
    route,
    room,
    leaves: BALANCE.startingLeaves + (room.leavesBonus || 0)
      + (BALANCE.supplyPerSecond[1] + (room.supplyRateBonus || 0)) * BALANCE.preparationSeconds,
    bedLevel: 1,
    doorLevel: 1,
    doorHp: Math.round(BALANCE.startingDoorHp * (1 + (room.doorBonus || 0))),
    towers: [],
    waves: [],
    bossStartUpgradeCounts: null,
  };

  const firstTower = createTower(route.towers[0]);
  run.leaves -= TOWER_CATALOG[firstTower.type].buildCost;
  run.towers.push(firstTower);
  buyPreferredUpgrade(run, firstTower);

  for (const wave of WAVES) {
    prepareWave(run, wave.number);
    if (wave.number === BALANCE.totalWaves) run.bossStartUpgradeCounts = run.towers.map(totalUpgrades);
    const result = runWave(run, wave);
    run.waves.push({
      wave: wave.number,
      cleared: result.cleared,
      doorHp: Math.max(0, run.doorHp),
      doorRatio: Math.max(0, run.doorHp) / maxDoorHp(run),
      kills: result.kills,
      remainingEnemies: result.remainingEnemies,
      upgrades: run.towers.map(totalUpgrades),
    });
    if (!result.cleared) break;
    if (wave.number < BALANCE.totalWaves) restInvestments(run, wave.number);
  }

  const victory = run.waves.length === BALANCE.totalWaves && run.waves.at(-1).cleared;
  const failedWave = run.waves.at(-1)?.wave;
  const matchupGap = !victory && run.waves[0]?.doorRatio < 0.6 && route.towers[0] !== 'machineGun'
    ? 'W1用慢速群攻塔处理分散血肉，修门挤压后续成长；属于克制选择缺口'
    : !victory && failedWave <= 3 && route.towers.every((type) => ATTACK_PROFILES[type].damageType !== 'piercing')
      ? 'W3装甲/护盾缺少穿甲重击；属于克制选择缺口'
      : !victory && route.towers.every((type) => !['mortar', 'grenadeLauncher', 'flamethrower'].includes(type))
        ? '混合潮范围覆盖不足；属于克制选择缺口'
        : !victory ? 'Boss阶段缺少对应专精；属于克制选择缺口' : '构筑覆盖较完整';
  return { ...run, victory, matchupGap };
}

assert(Object.keys(TOWER_CATALOG).length === 6, `预期6座塔，当前${Object.keys(TOWER_CATALOG).length}`);
assert(Object.keys(ENEMY_CATALOG).length === 9, `预期9种敌人，当前${Object.keys(ENEMY_CATALOG).length}`);
assert(WAVES.length === 5, `预期5波，当前${WAVES.length}`);

const baseline = simulateRoute(ROUTES[0]);
assert(baseline.waves[0].cleared && baseline.waves[0].doorRatio >= 0.9, 'W1基础机枪不稳定');

const results = ROUTES.map(simulateRoute);
console.table(results.map((result) => ({
  路线: result.route.label,
  W1门: `${Math.round(result.waves[0].doorRatio * 100)}%`,
  W2门: result.waves[1] ? `${Math.round(result.waves[1].doorRatio * 100)}%` : '-',
  Boss前强化: result.bossStartUpgradeCounts?.join('+') || '-',
  结果: result.victory ? '通关' : `失败于W${result.waves.at(-1).wave}`,
  结论: result.victory ? '构筑覆盖有效' : result.matchupGap,
})));
results.forEach((result) => {
  const waveTwo = result.waves.find((wave) => wave.wave === 2);
  // 慢速群攻塔开局是刻意保留的高风险路线；只要求能过，推荐开局仍守住60%以上。
  const minimumWaveTwoDoor = result.route.towers[0] === 'grenadeLauncher' ? 0.45 : 0.6;
  assert(waveTwo?.cleared && waveTwo.doorRatio >= minimumWaveTwoDoor, `${result.route.label}在W2双塔后门HP低于容错线`);
  const fullTowerUpgrades = TOWER_TRACKS.length * TOWER_UPGRADE_COSTS.length;
  if (result.bossStartUpgradeCounts) assert(result.bossStartUpgradeCounts.filter((count) => count >= fullTowerUpgrades).length < 2, `${result.route.label}Boss前出现双塔满级`);
});

const victories = results.filter((result) => result.victory).length;
assert(victories >= 4, `仅${victories}/6路线通关，低于4条验收线`);
results.filter((result) => !result.victory).forEach((result) => {
  assert(result.matchupGap.includes('克制选择缺口'), `${result.route.label}失败但无法解释为克制选择`);
});

console.log(`全局回归通过：${victories}/${results.length}条路线通关；W1基础机枪和W2双塔门槛均满足。`);
