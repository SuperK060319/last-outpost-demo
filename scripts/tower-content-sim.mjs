import { BALANCE } from '../src/game/config/balance.js';
import { EXTRA_TOWERS, TOWER_CATALOG, TOWER_TRACKS, TOWER_UPGRADE_COSTS } from '../src/game/config/towers.js';

const LEGACY_BASE_DPS = { machineGun: 12.5, mortar: 9 / 3.2, sniper: 36 / 2.6 };
const UPGRADE_SUM = TOWER_UPGRADE_COSTS.reduce((sum, cost) => sum + cost, 0);

function statsAt(tower, track = null, level = 0) {
  return Object.fromEntries(TOWER_TRACKS.map((name) => [name, tower.tracks[name].values[name === track ? level : 0]]));
}

function throughput(type, stats, scenario = {}) {
  const tower = TOWER_CATALOG[type];
  if (type === 'machineGun') return stats.power * 1000 / (stats.cadence + tower.reloadMs / stats.payload);
  if (type === 'mortar') return stats.power * stats.payload * 1000 / stats.cadence;
  if (type === 'sniper') {
    const groupedChance = scenario.groupedChance ?? 0;
    const availableTargets = scenario.targets ?? 6;
    const expectedTargets = (1 - groupedChance) + groupedChance * Math.min(stats.payload, availableTargets);
    return stats.power * expectedTargets * 1000 / stats.cadence;
  }
  if (type === 'flamethrower') {
    const targets = Math.min(stats.payload, scenario.targets ?? 1);
    const direct = stats.power * 1000 / stats.cadence;
    const burn = stats.power * tower.behavior.burn.damageRatio * 1000 / tower.behavior.burn.tickMs;
    return (direct + burn) * targets;
  }
  if (type === 'grenadeLauncher') return stats.power * stats.payload * 1000 / stats.cadence * (scenario.targets ?? 1);
  const armor = scenario.armor ?? 0;
  const armorAfterIgnore = Math.max(0, armor - stats.payload);
  return stats.power * (1 - armorAfterIgnore) * 1000 / stats.cadence;
}

function firstUpgradeBenefits(type) {
  const firstScenario = {
    machineGun: {},
    mortar: {},
    sniper: { groupedChance: 0.15, targets: 2 },
    flamethrower: { targets: 5 },
    grenadeLauncher: { targets: 2 },
    antiArmorRocket: { armor: 0.5 },
  }[type];
  const base = throughput(type, statsAt(TOWER_CATALOG[type]), firstScenario);
  return TOWER_TRACKS.map((track) => throughput(type, statsAt(TOWER_CATALOG[type], track, 1), firstScenario) / base - 1);
}

function specializationScenario(type) {
  if (type === 'sniper') return { groupedChance: 1, targets: 6 };
  if (type === 'flamethrower') return { targets: 9 };
  if (type === 'grenadeLauncher') return { targets: 2 };
  if (type === 'antiArmorRocket') return { armor: 0.9 };
  return {};
}

console.log('LAST OUTPOST · 六炮塔内容检查');
console.log(`升级成本：${TOWER_UPGRADE_COSTS.join(' / ')}，单线合计 ${UPGRADE_SUM}`);
console.log('炮塔 | 建造 | 完整塔成本 | 基础DPS | 三条首级收益');

for (const [type, tower] of Object.entries(TOWER_CATALOG)) {
  const fullCost = tower.buildCost + UPGRADE_SUM * TOWER_TRACKS.length;
  const baseScenario = type === 'antiArmorRocket' ? { armor: 0.5 } : {};
  const baseDps = throughput(type, statsAt(tower), baseScenario);
  const firstBenefits = firstUpgradeBenefits(type);
  console.log(`${tower.name} | ${tower.buildCost} | ${fullCost} | ${baseDps.toFixed(2)} | ${firstBenefits.map((value) => `${(value * 100).toFixed(1)}%`).join(' / ')}`);

  if (fullCost < 500 || fullCost > 650) throw new Error(`${tower.name}完整成本不在500-650区间`);
  if (Math.max(...firstBenefits) - Math.min(...firstBenefits) > 0.15) throw new Error(`${tower.name}首级升级存在明显必选`);
  if (firstBenefits.some((benefit) => benefit <= 0)) throw new Error(`${tower.name}存在无收益首级升级`);

  for (const track of TOWER_TRACKS) {
    const values = tower.tracks[track].values;
    if (values.length !== 6) throw new Error(`${tower.name}/${track}不是基础+5级`);
    if (new Set(values).size !== values.length) throw new Error(`${tower.name}/${track}存在重复值`);

    const scenario = specializationScenario(type);
    const outputs = values.map((_value, level) => throughput(type, statsAt(tower, track, level), scenario));
    if (outputs.some((output, index) => index > 0 && output <= outputs[index - 1])) {
      throw new Error(`${tower.name}/${track}存在无实际收益等级`);
    }
  }
}

const newTowerCosts = Object.values(EXTRA_TOWERS).map((tower) => tower.buildCost).sort((left, right) => left - right);
if (newTowerCosts[0] + newTowerCosts[1] <= BALANCE.startingLeaves) throw new Error('开局可以同时购买两座新炮塔');

console.log('\n现有三塔基础火力变化：');
for (const type of ['machineGun', 'mortar', 'sniper']) {
  const current = throughput(type, statsAt(TOWER_CATALOG[type]));
  console.log(`${TOWER_CATALOG[type].name}: ${LEGACY_BASE_DPS[type].toFixed(2)} → ${current.toFixed(2)} (${((current / LEGACY_BASE_DPS[type] - 1) * 100).toFixed(1)}%)`);
}
console.log('\n检查通过：六塔均为基础+5级；每一级有效；新塔不能开局购买两座。');
