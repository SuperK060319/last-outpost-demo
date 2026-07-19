import { strict as assert } from 'node:assert';
import { getTowerResaleQuote, isTowerManagementPhase, towerInvestment } from '../src/game/economy/towerResale.js';

function slot(type, power = 0, cadence = 0, payload = 0) {
  return { type, upgrades: { power, cadence, payload } };
}

const empty = slot(null);
const baseMachineGun = slot('machineGun');
const powerOne = slot('machineGun', 1, 0, 0);
const mixed = slot('machineGun', 2, 1, 0);
const fullMachineGun = slot('machineGun', 5, 5, 5);
const fullRocket = slot('antiArmorRocket', 5, 5, 5);

assert.equal(towerInvestment(empty), 0);
assert.deepEqual(getTowerResaleQuote(empty, 'rest'), { allowed: false, reason: 'empty', invested: 0, refund: 0 });

assert.deepEqual(getTowerResaleQuote(baseMachineGun, 'preparation'), { allowed: true, reason: null, invested: 24, refund: 14 });
assert.deepEqual(getTowerResaleQuote(powerOne, 'rest'), { allowed: true, reason: null, invested: 42, refund: 25 });
assert.deepEqual(getTowerResaleQuote(mixed, 'rest'), { allowed: true, reason: null, invested: 86, refund: 51 });
assert.deepEqual(getTowerResaleQuote(fullMachineGun, 'rest'), { allowed: true, reason: null, invested: 624, refund: 374 });
assert.deepEqual(getTowerResaleQuote(fullRocket, 'rest'), { allowed: true, reason: null, invested: 636, refund: 381 });

assert.equal(isTowerManagementPhase('preparation'), true);
assert.equal(isTowerManagementPhase('rest'), true);
assert.equal(isTowerManagementPhase('wave'), false);
assert.deepEqual(getTowerResaleQuote(mixed, 'wave'), { allowed: false, reason: 'phase', invested: 86, refund: 51 });

// 计算只读取快照，取消拆除时不会偷改原炮塔。
const before = JSON.stringify(mixed);
getTowerResaleQuote(mixed, 'rest');
assert.equal(JSON.stringify(mixed), before);

console.log('TOWER RESALE SIM PASS');
console.log('基础机枪返还 14，混合升级返还 51，满级机枪返还 374，满级火箭返还 381。');
console.log('空槽与战斗期锁定正确，计算过程不修改 slot。');
