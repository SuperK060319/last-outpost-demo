import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};

const { GameStore, SAVE_KEY, normalizeProfile } = await import('../src/game/state/GameStore.js');
const { buildBattleReview, doctrineBonuses } = await import('../src/game/meta/doctrines.js');

function freshStore(profile) {
  memory.set(SAVE_KEY, JSON.stringify(profile));
  return new GameStore();
}

// 旧版 v1 只有三个字段；加载后必须无错误并自动补出三个 0 级条令。
const oldSave = freshStore({ bestWave: 4, jade: 50, wins: 1 });
assert.deepEqual(oldSave.profile.doctrines, { logistics: 0, fortification: 0, analysis: 0 });
assert.equal(oldSave.profile.bestWave, 4);
assert.equal(oldSave.profile.jade, 50);

// 正常购买：扣除当前等级的固定价格，只提升目标条令。
const purchaseStore = freshStore({ bestWave: 0, jade: 40, wins: 0 });
const purchase = purchaseStore.purchaseDoctrine('logistics');
assert.equal(purchase.ok, true);
assert.equal(purchase.cost, 10);
assert.equal(purchaseStore.profile.jade, 30);
assert.equal(purchaseStore.profile.doctrines.logistics, 1);
assert.equal(JSON.parse(memory.get(SAVE_KEY)).doctrines.logistics, 1);

// 余额不足与满级都不能扣费。
const poorStore = freshStore({ jade: 9, doctrines: { logistics: 0 } });
assert.equal(poorStore.purchaseDoctrine('logistics').reason, 'insufficient');
assert.equal(poorStore.profile.jade, 9);
assert.equal(poorStore.profile.doctrines.logistics, 0);

const maxStore = freshStore({ jade: 999, doctrines: { logistics: 3 } });
assert.equal(maxStore.purchaseDoctrine('logistics').reason, 'max');
assert.equal(maxStore.profile.jade, 999);
assert.equal(maxStore.profile.doctrines.logistics, 3);

// 满级战斗加成仍低于 15%；resetRun 同时兼容房间原有奖励。
const combatStore = freshStore({ doctrines: { logistics: 3, fortification: 3, analysis: 0 } });
combatStore.resetRun();
assert.equal(combatStore.leaves, 48);
assert.equal(combatStore.doorHp, 179); // round(160 * 1.12)
combatStore.resetRun({ id: 'stone', doorBonus: 0.25, leavesBonus: 5 });
assert.equal(combatStore.leaves, 53);
assert.equal(combatStore.doorHp, 219); // round(160 * 1.37)
assert.ok(doctrineBonuses(combatStore.profile).startingSupplies / 42 < 0.15);
assert.ok(doctrineBonuses(combatStore.profile).doorHpMultiplier < 0.15);

// 信息条令不改变任何战斗数值，只逐级增加事实型详情。
const analysisStore = freshStore({ doctrines: { analysis: 3 } });
analysisStore.resetRun();
assert.equal(analysisStore.leaves, 42);
assert.equal(analysisStore.doorHp, 160);
assert.equal(analysisStore.weaponSlots.length, 4);

const reviewInput = {
  victory: false,
  wave: 3,
  weaponSlots: [
    { type: 'machineGun', upgrades: { power: 2, cadence: 1, payload: 0 } },
    { type: null, upgrades: { power: 0, cadence: 0, payload: 0 } },
  ],
  doorLevel: 1,
  bedLevel: 2,
};
const basicReview = buildBattleReview({ ...reviewInput, analysisLevel: 0 });
assert.equal(basicReview.code, 'fill-slots');
assert.equal(basicReview.details.length, 0);
assert.equal(buildBattleReview({ ...reviewInput, analysisLevel: 1 }).details.length, 1);
assert.equal(buildBattleReview({ ...reviewInput, analysisLevel: 2 }).details.length, 2);
assert.equal(buildBattleReview({ ...reviewInput, analysisLevel: 3 }).details.length, 3);

// 异常/越界旧数据在进入商店前被标准化，避免负余额或超等级。
assert.deepEqual(normalizeProfile({ jade: -20, doctrines: { logistics: 99, analysis: '2' } }), {
  bestWave: 0,
  jade: 0,
  wins: 0,
  doctrines: { logistics: 3, fortification: 0, analysis: 2 },
});

console.log('meta progression simulation passed');
