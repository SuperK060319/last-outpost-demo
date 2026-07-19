import { BALANCE, ROOMS } from '../src/game/config/balance.js';
import { ENEMIES } from '../src/game/config/enemies.js';
import { TOWERS, TOWER_UPGRADE_COSTS } from '../src/game/config/towers.js';
import { WAVES } from '../src/game/config/waves.js';

const cheapestBuildCost = Math.min(...Object.values(TOWERS).map((tower) => tower.buildCost));
const firstUpgradeCost = TOWER_UPGRADE_COSTS[0] ?? 0;
const openingPackage = cheapestBuildCost + firstUpgradeCost;
const secondPackage = cheapestBuildCost + firstUpgradeCost;
const repairReserve = BALANCE.doorCosts[2] ?? 0;
const waveByNumber = new Map(WAVES.map((wave) => [wave.number, wave]));

function enemyReward(waveNumber, enemyType) {
  if (enemyType === 'boss') return 60;
  const archetype = ENEMIES[enemyType];
  const packSize = archetype?.packSize || 1;
  const reward = Math.max(1, Math.round((5 + waveNumber) * (archetype?.rewardMultiplier || 1)));
  return reward * packSize;
}

function waveKillReward(waveNumber) {
  const wave = waveByNumber.get(waveNumber);
  if (!wave) return 0;
  return wave.batches.reduce((total, batch) => total + batch.count * enemyReward(waveNumber, batch.enemyType), 0);
}

function simulate(room, investSupply) {
  let leaves = BALANCE.startingLeaves + (room.leavesBonus || 0) - openingPackage;
  let bedLevel = 1;
  let supplySpent = 0;
  let waveTwoBudget = 0;
  const timeline = [];

  const supplyRate = () => BALANCE.supplyPerSecond[bedLevel] + (room.supplyRateBonus || 0);
  leaves += supplyRate() * BALANCE.preparationSeconds;

  for (let wave = 1; wave <= BALANCE.totalWaves; wave += 1) {
    const delivery = BALANCE.bedIncome[bedLevel] + (room.incomeBonus || 0);
    leaves += delivery;
    if (wave === 2) {
      waveTwoBudget = leaves;
      leaves -= secondPackage + repairReserve;
    }

    timeline.push({ wave, bedLevel, rate: supplyRate(), delivery, beforeKills: leaves });
    if (wave >= BALANCE.totalWaves) continue;
    leaves += waveKillReward(wave);
    const activeSeconds = Math.min(22, waveByNumber.get(wave)?.durationSeconds || 22);
    leaves += supplyRate() * activeSeconds;

    // 与游戏解锁规则一致：完成第N波后，最多购买到补给站N+1级。
    const nextLevel = bedLevel + 1;
    const maxBedLevel = Math.min(BALANCE.supplyPerSecond.length, BALANCE.bedCosts.length) - 1;
    if (investSupply && wave < BALANCE.totalWaves && nextLevel <= maxBedLevel && wave >= nextLevel - 1) {
      const cost = BALANCE.bedCosts[nextLevel];
      if (leaves >= cost) {
        leaves -= cost;
        supplySpent += cost;
        bedLevel = nextLevel;
      }
    }
    leaves += supplyRate() * 10;
  }

  return { room: room.name, investSupply, waveTwoBudget, bossBudget: leaves, supplySpent, timeline };
}

function assert(condition, message) {
  if (!condition) throw new Error(`经济模拟失败：${message}`);
}

const results = ROOMS.flatMap((room) => [simulate(room, false), simulate(room, true)]);
const mainUpgradeDepth = Math.min(4, TOWER_UPGRADE_COSTS.length);
const mainFollowUp = TOWER_UPGRADE_COSTS.slice(1, mainUpgradeDepth).reduce((sum, cost) => sum + cost, 0);
const mediumFollowUp = firstUpgradeCost;
const mainAndMediumTarget = mainFollowUp + mediumFollowUp;
const fullMaxTwoTowers = cheapestBuildCost * 2
  + 2 * 3 * TOWER_UPGRADE_COSTS.reduce((sum, cost) => sum + cost, 0);

ROOMS.forEach((room) => {
  const openingBudget = BALANCE.startingLeaves + (room.leavesBonus || 0);
  assert(openingBudget >= openingPackage, `${room.name}开局买不起一座廉价塔和一次初级强化`);
  assert(openingBudget < cheapestBuildCost * 2, `${room.name}开局可以直接部署两座廉价塔`);
});

results.forEach((result) => {
  assert(result.waveTwoBudget >= secondPackage + repairReserve, `${result.room}${result.investSupply ? '投资' : '不投资'}补给站时，第2波无法完成双塔、低级强化和修门预留`);
  assert(result.bossBudget >= mainAndMediumTarget, `${result.room}${result.investSupply ? '投资' : '不投资'}补给站时，Boss前不足以形成一主一副`);
  assert(result.bossBudget + openingPackage + secondPackage + repairReserve < fullMaxTwoTowers, `${result.room}Boss前可以把两座塔全部升满`);
});

ROOMS.forEach((room) => {
  const plain = results.find((result) => result.room === room.name && !result.investSupply);
  const invested = results.find((result) => result.room === room.name && result.investSupply);
  assert(invested.bossBudget > plain.bossBudget, `${room.name}投资补给站在Boss前没有正收益`);
});

console.log(`开局套餐 ${openingPackage}｜第2波新增承诺 ${secondPackage + repairReserve}｜一主一副后续目标 ${mainAndMediumTarget}｜双塔全满 ${fullMaxTwoTowers}`);
console.table(results.map((result) => ({
  房间: result.room,
  补给站: result.investSupply ? `投资 ${result.supplySpent}` : '不投资',
  第2波可用: result.waveTwoBudget,
  扣除双塔与修门后Boss预算: result.bossBudget,
})));
console.log('经济模拟通过。升级成本级数：', TOWER_UPGRADE_COSTS.length);
