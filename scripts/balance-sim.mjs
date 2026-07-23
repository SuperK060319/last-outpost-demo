import { BALANCE } from '../src/game/config/balance.js';
import { ENEMY_CATALOG as ENEMIES } from '../src/game/config/enemies.js';
import { TOWERS, TOWER_UPGRADE_COSTS } from '../src/game/config/towers.js';
import { expandWaveSchedule } from '../src/game/config/waves.js';

const FIRST_WAVE = {
  hp: 58,
  count: 5,
  spawnIntervalSeconds: 2.02,
  travelSeconds: 114 / 33,
  attackDelayMs: 980,
  attackDamage: 6,
  durationSeconds: 27,
};

// 改版前的配置只用于回归对比，不参与游戏运行。
const LEGACY_MACHINE_GUN = {
  power: [11, 15],
  cadence: [780, 660],
  payload: [18, 26],
  reloadMs: 900,
};

function sustainedDps(tower, upgrades = { power: 0, cadence: 0, payload: 0 }, targetCount = 1) {
  const power = tower.tracks.power.values[upgrades.power];
  const cadence = tower.tracks.cadence.values[upgrades.cadence];
  const payload = tower.tracks.payload.values[upgrades.payload];
  if (tower === TOWERS.machineGun) return power * 1000 / (cadence + tower.reloadMs / payload);
  if (tower === TOWERS.mortar) return power * payload * 1000 / cadence * targetCount;
  return power * Math.min(payload, targetCount) * 1000 / cadence;
}

function simulateFirstWaveMachineGun(config) {
  const stepSeconds = 0.01;
  const spawnTimes = Array.from({ length: FIRST_WAVE.count }, (_, index) => index * FIRST_WAVE.spawnIntervalSeconds);
  const enemies = [];
  let spawnIndex = 0;
  let attackClock = 0;
  let shots = 0;
  let kills = 0;
  let doorHp = BALANCE.startingDoorHp;

  for (let time = 0; time < FIRST_WAVE.durationSeconds && doorHp > 0; time += stepSeconds) {
    while (spawnIndex < spawnTimes.length && spawnTimes[spawnIndex] <= time) {
      enemies.push({ spawnTime: spawnTimes[spawnIndex], hp: FIRST_WAVE.hp, attackClock: 0 });
      spawnIndex += 1;
    }

    for (const enemy of enemies) {
      if (time - enemy.spawnTime < FIRST_WAVE.travelSeconds) continue;
      enemy.attackClock += stepSeconds * 1000;
      if (enemy.attackClock >= FIRST_WAVE.attackDelayMs) {
        enemy.attackClock = 0;
        doorHp = Math.max(0, doorHp - FIRST_WAVE.attackDamage);
      }
    }

    attackClock += stepSeconds * 1000;
    if (enemies.length === 0 || attackClock < config.cadence) continue;
    attackClock = 0;
    enemies[0].hp -= config.power;
    shots += 1;
    if (shots >= config.payload) {
      shots = 0;
      attackClock = -config.reloadMs;
    }
    if (enemies[0].hp <= 0) {
      enemies.shift();
      kills += 1;
    }
  }

  return { kills, doorHp };
}

function machineGunConfig(source, upgradedTrack = null) {
  return {
    power: source.power[upgradedTrack === 'power' ? 1 : 0],
    cadence: source.cadence[upgradedTrack === 'cadence' ? 1 : 0],
    payload: source.payload[upgradedTrack === 'payload' ? 1 : 0],
    reloadMs: source.reloadMs,
  };
}

const currentMachineGun = {
  power: TOWERS.machineGun.tracks.power.values,
  cadence: TOWERS.machineGun.tracks.cadence.values,
  payload: TOWERS.machineGun.tracks.payload.values,
  reloadMs: TOWERS.machineGun.reloadMs,
};
const tracks = ['power', 'cadence', 'payload'];

function waveKillIncome(waveNumber) {
  return expandWaveSchedule(waveNumber).reduce((total, event) => {
    if (event.enemyType === 'boss') return total + 60;
    const enemy = ENEMIES[event.enemyType];
    const reward = Math.max(1, Math.round((5 + waveNumber) * (enemy?.rewardMultiplier || 1)));
    return total + reward * (enemy?.packSize || 1);
  }, 0);
}

const openingPurchase = TOWERS.machineGun.buildCost + TOWER_UPGRADE_COSTS[0];
const baseSupplyRate = BALANCE.supplyPerSecond[1];
const preparationIncome = baseSupplyRate * BALANCE.preparationSeconds;
const firstCycleIncome = baseSupplyRate * (22 + 10);
const waveTwoBudgetAfterOpening = BALANCE.startingLeaves - openingPurchase + preparationIncome
  + BALANCE.bedIncome[1] * 2 + waveKillIncome(1) + firstCycleIncome;
const bossStartBudgetBeforeSpending = BALANCE.startingLeaves
  + BALANCE.bedIncome[1] * 5
  + baseSupplyRate * (BALANCE.preparationSeconds + (22 + 10) * 4)
  + [1, 2, 3, 4].reduce((sum, waveNumber) => sum + waveKillIncome(waveNumber), 0);
const fullTowerCost = TOWERS.machineGun.buildCost + 3 * TOWER_UPGRADE_COSTS.reduce((sum, cost) => sum + cost, 0);
const meaningfulMainTowerCost = TOWERS.machineGun.buildCost
  + 3 * TOWER_UPGRADE_COSTS.slice(0, 3).reduce((sum, cost) => sum + cost, 0);

console.log('LINE ZERO · 首关数值检查');
console.log(`开局补给 ${BALANCE.startingLeaves}；一级补给站持续 +${BALANCE.supplyPerSecond[1]}/秒、每波运输 +${BALANCE.bedIncome[1]}`);
console.log(`机枪/迫击炮“建造+首级强化”成本 ${TOWERS.machineGun.buildCost + TOWER_UPGRADE_COSTS[0]}；狙击 ${TOWERS.sniper.buildCost + TOWER_UPGRADE_COSTS[0]}`);
console.log(`完成开局建造后，第2波开始预算 ${waveTwoBudgetAfterOpening}（旧版约328）`);
console.log(`不消费时Boss波开始预算 ${bossStartBudgetBeforeSpending}；一座全强化 ${fullTowerCost}；两座 ${fullTowerCost * 2}`);

console.log('\n单机枪 + 一条首级强化，第一波结束闸门状态：');
for (const track of tracks) {
  const before = simulateFirstWaveMachineGun(machineGunConfig(LEGACY_MACHINE_GUN, track));
  const after = simulateFirstWaveMachineGun(machineGunConfig(currentMachineGun, track));
  console.log(`${track.padEnd(8)} 改前 ${before.kills}杀/门${before.doorHp}  →  改后 ${after.kills}杀/门${after.doorHp}`);
}

console.log('\n三炮塔首级强化的持续输出（单体；括号为满足群体条件）：');
for (const [key, tower] of Object.entries(TOWERS)) {
  const values = tracks.map((track) => {
    const upgrades = { power: 0, cadence: 0, payload: 0, [track]: 1 };
    const single = sustainedDps(tower, upgrades, 1);
    const groupTargets = key === 'machineGun' ? 1 : key === 'mortar' ? 3 : 2;
    const group = sustainedDps(tower, upgrades, groupTargets);
    return `${track} ${single.toFixed(2)}${groupTargets > 1 ? ` (${group.toFixed(2)})` : ''}`;
  });
  console.log(`${tower.name.padEnd(5)} ${values.join(' | ')}`);
}

const upgradedDoorResults = tracks.map((track) => simulateFirstWaveMachineGun(machineGunConfig(currentMachineGun, track)).doorHp);
const mortarFirstUpgradeDps = tracks.map((track) => sustainedDps(TOWERS.mortar, { power: 0, cadence: 0, payload: 0, [track]: 1 }, 3));
const sniperFirstUpgradeDps = tracks.map((track) => sustainedDps(TOWERS.sniper, { power: 0, cadence: 0, payload: 0, [track]: 1 }, 1));

if (TOWERS.machineGun.buildCost + TOWER_UPGRADE_COSTS[0] > BALANCE.startingLeaves) throw new Error('机枪开局建造线形成经济死局');
if (TOWERS.mortar.buildCost + TOWER_UPGRADE_COSTS[0] > BALANCE.startingLeaves) throw new Error('迫击炮开局建造线形成经济死局');
if (waveTwoBudgetAfterOpening < 50 || waveTwoBudgetAfterOpening > 90) throw new Error('第2波预算没有落在目标成长区间');
if (bossStartBudgetBeforeSpending >= fullTowerCost * 2) throw new Error('Boss前仍能无选择地养满两座炮塔');
if (bossStartBudgetBeforeSpending >= fullTowerCost) throw new Error('Boss前仍会过早养满一座炮塔');
if (bossStartBudgetBeforeSpending <= meaningfulMainTowerCost) throw new Error('Boss前无法形成一座中高成长核心炮塔');
if (BALANCE.supplyPerSecond.length !== 5 || BALANCE.bedIncome.length !== 5 || BALANCE.bedCosts.length !== 5) throw new Error('补给站应限制为四级成长');
if (Math.min(...upgradedDoorResults) <= 0) throw new Error('机枪任一首级强化仍会在第一波形成必败路线');
if (Math.max(...mortarFirstUpgradeDps) / Math.min(...mortarFirstUpgradeDps) > 1.13) throw new Error('迫击炮三条首级强化失衡');
if (Math.max(...sniperFirstUpgradeDps) / Math.min(...sniperFirstUpgradeDps) > 1.15) throw new Error('狙击三条首级强化失衡');

console.log('\n检查通过：第2波预算受控；Boss前可形成核心塔但不能提前满级；三炮塔首级强化不存在一眼必选项。');
