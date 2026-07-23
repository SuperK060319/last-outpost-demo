import assert from 'node:assert/strict';
import {
  COMBAT_UPGRADES,
  chooseCombatUpgradeIds,
  combatUpgradeModifiers,
  combatXpReward,
  combatXpThreshold,
  createCombatProgress,
} from '../src/game/config/combatUpgrades.js';
import { ENEMY_CATALOG } from '../src/game/config/enemies.js';
import { WAVES, expandWaveSchedule } from '../src/game/config/waves.js';

const progress = createCombatProgress();
assert.equal(progress.level, 0);
assert.deepEqual([0, 1, 2, 3, 4].map(combatXpThreshold), [4, 6, 8, 10, 12]);
assert.equal(combatXpReward('normal'), 1);
assert.equal(combatXpReward('armored'), 2);
assert.equal(combatXpReward('boss'), 0);

const rolls = [0.8, 0.2, 0.6];
let cursor = 0;
const choices = chooseCombatUpgradeIds(progress.upgrades, 3, () => rolls[cursor++ % rolls.length]);
assert.equal(choices.length, 3);
assert.equal(new Set(choices).size, 3);
choices.forEach((id) => assert.ok(COMBAT_UPGRADES[id]));

const capped = { firepower: 4, cadence: 4, barrage: 3, fieldSupport: 0 };
assert.deepEqual(chooseCombatUpgradeIds(capped, 3, () => 0.5), ['fieldSupport']);

const modifiers = combatUpgradeModifiers({ firepower: 2, cadence: 2, barrage: 2 });
assert.equal(modifiers.damageMultiplier, 1.24);
assert.equal(Number(modifiers.cadenceMultiplier.toFixed(2)), 0.81);
assert.equal(modifiers.barrageEvery, 4);

const runXp = WAVES.flatMap(expandWaveSchedule).reduce((sum, event) => {
  const packSize = ENEMY_CATALOG[event.enemyType]?.packSize || 1;
  return sum + combatXpReward(event.enemyType) * packSize;
}, 0);
let simulatedLevel = 0;
let simulatedXp = runXp;
while (simulatedXp >= combatXpThreshold(simulatedLevel)) {
  simulatedXp -= combatXpThreshold(simulatedLevel);
  simulatedLevel += 1;
}
assert.equal(runXp, 41);
assert.equal(simulatedLevel, 5, '完整Demo应稳定触发5次战中选择');

console.log('LINE ZERO · 战中成长检查通过');
console.log('经验门槛：4 / 6 / 8 / 10 / 12；普通敌人 1 XP，特种敌人 2 XP。');
console.log('三选一不重复，满级项自动移出候选，强化倍率可预测。');
console.log(`五波共 ${runXp} XP，可稳定触发 ${simulatedLevel} 次三选一。`);
