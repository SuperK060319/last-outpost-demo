import {
  ATTACK_PROFILES,
  DAMAGE_TYPES,
  DEFENSE_PROFILES,
  DEFENSE_TAGS,
  TYPE_VS_DEFENSE,
  calculateDamage,
} from '../src/game/combat/damageModel.js';

const BASE_DAMAGE = 100;
const towerRows = [
  ['重机枪', ATTACK_PROFILES.machineGun],
  ['迫击炮', ATTACK_PROFILES.mortar],
  ['火焰喷射器', ATTACK_PROFILES.flamethrower],
  ['狙击塔', ATTACK_PROFILES.sniper],
];
const defenseColumns = [
  ['血肉', DEFENSE_PROFILES.normal],
  ['护甲', DEFENSE_PROFILES.armored],
  ['护盾', DEFENSE_PROFILES.shielded],
  ['集群', DEFENSE_PROFILES.swarm],
  ['Boss', DEFENSE_PROFILES.boss],
];

function assert(condition, message) {
  if (!condition) throw new Error(`伤害模型验证失败：${message}`);
}

const matrix = towerRows.map(([towerName, attack]) => {
  const row = { 塔型: towerName };
  defenseColumns.forEach(([defenseName, defense]) => {
    const result = calculateDamage(BASE_DAMAGE, attack, defense);
    row[defenseName] = `${result.damage} (${result.typeMultiplier.toFixed(2)}x)`;
    assert(result.damage > 0, `${towerName}对${defenseName}出现免疫`);
  });
  return row;
});

DAMAGE_TYPES.forEach((damageType) => {
  DEFENSE_TAGS.forEach((defenseTag) => {
    const multiplier = TYPE_VS_DEFENSE[damageType][defenseTag];
    assert(multiplier >= 0.65 && multiplier <= 1.5, `${damageType}对${defenseTag}倍率${multiplier}越界`);
  });
});

const intendedCounters = [
  ['重机枪克制血肉', ATTACK_PROFILES.machineGun, DEFENSE_PROFILES.normal],
  ['迫击炮克制集群', ATTACK_PROFILES.mortar, DEFENSE_PROFILES.swarm],
  ['火焰克制血肉', ATTACK_PROFILES.flamethrower, DEFENSE_PROFILES.normal],
  ['狙击克制护甲', ATTACK_PROFILES.sniper, DEFENSE_PROFILES.armored],
];
intendedCounters.forEach(([label, attack, defense]) => {
  const multiplier = calculateDamage(BASE_DAMAGE, attack, defense).typeMultiplier;
  assert(multiplier >= 1.25 && multiplier <= 1.5, `${label}应为1.25~1.5倍，实际${multiplier}`);
});

const intendedWeaknesses = [
  ['重机枪受制于护甲', ATTACK_PROFILES.machineGun, DEFENSE_PROFILES.armored],
  ['迫击炮受制于护盾', ATTACK_PROFILES.mortar, DEFENSE_PROFILES.shielded],
  ['火焰受制于护盾', ATTACK_PROFILES.flamethrower, DEFENSE_PROFILES.shielded],
  ['狙击受制于集群', ATTACK_PROFILES.sniper, DEFENSE_PROFILES.swarm],
];
intendedWeaknesses.forEach(([label, attack, defense]) => {
  const multiplier = calculateDamage(BASE_DAMAGE, attack, defense).typeMultiplier;
  assert(multiplier >= 0.65 && multiplier <= 0.85, `${label}应为0.65~0.85倍，实际${multiplier}`);
});

const armorBreak = calculateDamage(BASE_DAMAGE, ATTACK_PROFILES.antiArmorRocket, DEFENSE_PROFILES.armored, { armorBreak: 0.18 });
const neutral = calculateDamage(BASE_DAMAGE, { damageType: 'unknown' }, { primaryTag: 'unknown' });
const maximumResistance = calculateDamage(BASE_DAMAGE, ATTACK_PROFILES.flamethrower, DEFENSE_PROFILES.shielded, { resistance: 1 });
assert(armorBreak.damage > BASE_DAMAGE * armorBreak.typeMultiplier, '破甲状态没有提高护甲目标所受伤害');
assert(neutral.damage === BASE_DAMAGE, '未知类型应回退到中性伤害');
assert(maximumResistance.damage > 0, '最大抗性不得产生免疫');

console.table(matrix);
console.table([
  { 场景: '反装甲火箭+18%破甲', 伤害: armorBreak.damage, 总倍率: armorBreak.totalMultiplier.toFixed(3) },
  { 场景: '未知标签安全回退', 伤害: neutral.damage, 总倍率: neutral.totalMultiplier.toFixed(3) },
  { 场景: '火焰对护盾+最大抗性', 伤害: maximumResistance.damage, 总倍率: maximumResistance.totalMultiplier.toFixed(3) },
]);
console.log('伤害标签矩阵验证通过。');
