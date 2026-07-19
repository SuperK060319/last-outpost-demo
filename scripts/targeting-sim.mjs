import { strict as assert } from 'node:assert';
import { selectTargets, TARGET_MODES } from '../src/game/combat/targeting.js';

function enemy(id, { x, y, hp, speed = 0, armor = 0, active = true }) {
  return { id, hp, speed, armor, sprite: { x, y, active } };
}

const alpha = enemy('alpha', { x: 260, y: 510, hp: 80, speed: 42, armor: 2 });
const bravo = enemy('bravo', { x: 270, y: 650, hp: 140, speed: 28, armor: 8 });
const charlie = enemy('charlie', { x: 280, y: 590, hp: 35, speed: 72, armor: 0 });
const tied = enemy('tied', { x: 290, y: 570, hp: 140, speed: 28, armor: 8 });
const dead = enemy('dead', { x: 270, y: 690, hp: 0, speed: 999, armor: 99 });
const inactive = enemy('inactive', { x: 270, y: 695, hp: 999, active: false });
const missingSprite = { id: 'missing-sprite', hp: 999, speed: 999, armor: 999 };
const enemies = [alpha, bravo, charlie, tied, dead, inactive, missingSprite];

assert.deepEqual(TARGET_MODES, ['nearestGate', 'highestHp', 'lowestHp', 'fastest', 'highestArmor', 'densestCluster']);
assert.deepEqual(selectTargets(enemies, 'nearestGate', 2, { gateY: 700 }).targets.map(({ id }) => id), ['bravo', 'charlie']);
assert.deepEqual(selectTargets(enemies, 'highestHp', 2).targets.map(({ id }) => id), ['bravo', 'tied']);
assert.deepEqual(selectTargets(enemies, 'lowestHp', 2).targets.map(({ id }) => id), ['charlie', 'alpha']);
assert.deepEqual(selectTargets(enemies, 'fastest', 2).targets.map(({ id }) => id), ['charlie', 'alpha']);
assert.deepEqual(selectTargets(enemies, 'highestArmor', 2).targets.map(({ id }) => id), ['bravo', 'tied']);

const cluster = [
  enemy('far', { x: 20, y: 20, hp: 40 }),
  enemy('cluster-a', { x: 200, y: 300, hp: 40 }),
  enemy('cluster-b', { x: 216, y: 302, hp: 40 }),
  enemy('cluster-c', { x: 205, y: 318, hp: 40 }),
  enemy('outside', { x: 260, y: 360, hp: 40 }),
];
const denseResult = selectTargets(cluster, 'densestCluster', 3, { radius: 28 });
assert.deepEqual(denseResult.center, { x: 200, y: 300 });
assert.deepEqual(denseResult.targets.map(({ id }) => id), ['cluster-a', 'cluster-b', 'cluster-c']);

assert.deepEqual(selectTargets(null, 'nearestGate', 3), { center: null, targets: [] });
assert.deepEqual(selectTargets(enemies, 'fastest', 0), { center: null, targets: [] });
assert.throws(() => selectTargets(enemies, 'typo', 1), RangeError);
assert.deepEqual(enemies.map(({ id }) => id), ['alpha', 'bravo', 'charlie', 'tied', 'dead', 'inactive', 'missing-sprite']);

console.log('TARGETING SIM PASS');
console.log('策略：', TARGET_MODES.join(', '));
console.log('无效目标已过滤，五种排序稳定，密集区中心与集合正确。');
