import assert from 'node:assert/strict';
import { BALANCE } from '../src/game/config/balance.js';
import { ATTACK_PROFILES, DEFENSE_PROFILES, calculateDamage } from '../src/game/combat/damageModel.js';
import { SPELL_ORDER, SPELLS } from '../src/game/config/spells.js';
import { TOWER_CATALOG } from '../src/game/config/towers.js';

assert.deepEqual(SPELL_ORDER, ['incendiary', 'frost'], '应同时提供燃烧弹和冰霜弹');
SPELL_ORDER.forEach((type) => {
  const spell = SPELLS[type];
  assert.ok(spell.cost > 0, `${spell.name}必须消耗补给`);
  assert.ok(spell.cooldownMs > spell.durationMs, `${spell.name}冷却应长于场上效果`);
  assert.ok(spell.radius >= 60, `${spell.name}范围在手机上应该足够容错`);
});

const openingBuild = Math.min(...Object.values(TOWER_CATALOG).map((tower) => tower.buildCost));
assert.equal(openingBuild + SPELLS.frost.cost, BALANCE.startingLeaves, '开局应可选择一座基础炮塔+一次冰霜弹');
assert.ok(openingBuild + SPELLS.incendiary.cost > BALANCE.startingLeaves, '燃烧弹不应与基础炮塔同时无条件开局');

const fireTick = calculateDamage(
  SPELLS.incendiary.damage,
  ATTACK_PROFILES.incendiary,
  DEFENSE_PROFILES.normal,
).damage;
const totalFireDamage = fireTick * Math.floor(SPELLS.incendiary.durationMs / SPELLS.incendiary.tickMs);
assert.ok(totalFireDamage >= 120 && totalFireDamage <= 180, '完整火场应能清理普通尸，但不能秒杀Boss');
assert.ok(SPELLS.frost.slowMultiplier >= 0.45, '普通敌人减速不应超过55%');
assert.ok(SPELLS.frost.bossSlowMultiplier > SPELLS.frost.slowMultiplier, 'Boss应抵抗部分冰霜效果');

console.log('LAST OUTPOST · 战术弹药数值检查');
console.log(`燃烧弹：${SPELLS.incendiary.cost}补给 / ${SPELLS.incendiary.cooldownMs / 1000}秒冷却 / 普通目标完整伤害 ${totalFireDamage.toFixed(1)}`);
console.log(`冰霜弹：${SPELLS.frost.cost}补给 / ${SPELLS.frost.cooldownMs / 1000}秒冷却 / 普通减速 ${Math.round((1 - SPELLS.frost.slowMultiplier) * 100)}% / Boss减速 ${Math.round((1 - SPELLS.frost.bossSlowMultiplier) * 100)}%`);
console.log('检查通过：两种法术均有成本、冷却和可辨识的战术用途。');
