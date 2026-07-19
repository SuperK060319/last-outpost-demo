// 安全可改区：战中经验节奏、三选一强度和叠加上限集中在这里。
export const COMBAT_UPGRADE_ORDER = ['firepower', 'cadence', 'barrage', 'fieldSupport'];

export const COMBAT_UPGRADES = Object.freeze({
  firepower: Object.freeze({
    code: 'DMG', name: '火力校准', maxLevel: 4, color: 0xe67932,
    description: '所有炮塔伤害 +12%',
  }),
  cadence: Object.freeze({
    code: 'RPM', name: '快速供弹', maxLevel: 4, color: 0x79afb6,
    description: '所有炮塔攻击间隔 -10%',
  }),
  barrage: Object.freeze({
    code: '2X', name: '齐射协议', maxLevel: 3, color: 0xb89a6a,
    description: '周期性追加一次可见齐射',
  }),
  fieldSupport: Object.freeze({
    code: 'AID', name: '战地支援', maxLevel: 4, color: 0x778653,
    description: '立即 +18 补给，修复 15% 闸门',
  }),
});

export function createCombatProgress() {
  return {
    level: 0,
    xp: 0,
    pendingChoices: 0,
    upgrades: Object.fromEntries(COMBAT_UPGRADE_ORDER.map((id) => [id, 0])),
  };
}

export function combatXpThreshold(level) {
  return Math.min(12, 4 + Math.max(0, Math.floor(Number(level) || 0)) * 2);
}

export function combatXpReward(enemyType) {
  if (enemyType === 'boss') return 0;
  if (['armored', 'shielded', 'bomber', 'toxic', 'medic'].includes(enemyType)) return 2;
  return 1;
}

export function combatUpgradeModifiers(levels = {}) {
  const firepower = Math.max(0, Number(levels.firepower) || 0);
  const cadence = Math.max(0, Number(levels.cadence) || 0);
  const barrage = Math.max(0, Math.min(3, Number(levels.barrage) || 0));
  return {
    damageMultiplier: 1 + firepower * 0.12,
    cadenceMultiplier: 0.9 ** cadence,
    barrageEvery: barrage > 0 ? 6 - barrage : 0,
  };
}

export function chooseCombatUpgradeIds(levels = {}, count = 3, random = Math.random) {
  const pool = COMBAT_UPGRADE_ORDER.filter((id) => (Number(levels[id]) || 0) < COMBAT_UPGRADES[id].maxLevel);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const roll = Math.min(0.999999, Math.max(0, Number(random()) || 0));
    const swapIndex = Math.floor(roll * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.max(0, count));
}
