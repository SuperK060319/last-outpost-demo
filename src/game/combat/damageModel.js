export const DAMAGE_TYPES = Object.freeze(['kinetic', 'explosive', 'fire', 'piercing']);
export const DEFENSE_TAGS = Object.freeze(['armor', 'shield', 'flesh', 'swarm', 'boss']);

export const DAMAGE_TYPE_NAMES = Object.freeze({
  kinetic: '动能',
  explosive: '爆炸',
  fire: '火焰',
  piercing: '穿甲',
});

export const DEFENSE_TAG_NAMES = Object.freeze({
  armor: '护甲',
  shield: '护盾',
  flesh: '血肉',
  swarm: '集群',
  boss: '首领',
});

// 主防御标签只进入一次倍率表，避免“护甲+血肉+Boss”连乘后产生极端伤害。
export const TYPE_VS_DEFENSE = Object.freeze({
  kinetic: Object.freeze({ armor: 0.75, shield: 0.82, flesh: 1.3, swarm: 1.08, boss: 0.82 }),
  explosive: Object.freeze({ armor: 0.95, shield: 0.78, flesh: 1.1, swarm: 1.45, boss: 0.88 }),
  fire: Object.freeze({ armor: 0.78, shield: 0.7, flesh: 1.35, swarm: 1.3, boss: 0.8 }),
  piercing: Object.freeze({ armor: 1.45, shield: 1.3, flesh: 0.95, swarm: 0.72, boss: 1.1 }),
});

export const ATTACK_PROFILES = Object.freeze({
  machineGun: Object.freeze({ damageType: 'kinetic', label: '重机枪动能弹' }),
  mortar: Object.freeze({ damageType: 'explosive', label: '迫击炮高爆弹' }),
  sniper: Object.freeze({ damageType: 'piercing', label: '狙击塔穿甲弹' }),
  flamethrower: Object.freeze({ damageType: 'fire', label: '火焰喷射' }),
  grenadeLauncher: Object.freeze({ damageType: 'explosive', label: '自动榴弹' }),
  antiArmorRocket: Object.freeze({ damageType: 'piercing', label: '反装甲火箭' }),
  incendiary: Object.freeze({ damageType: 'fire', label: '燃烧弹火场' }),
});

export const DEFENSE_PROFILES = Object.freeze({
  normal: Object.freeze({ primaryTag: 'flesh', tags: ['flesh'], label: '普通感染体' }),
  runner: Object.freeze({ primaryTag: 'flesh', tags: ['flesh'], label: '跑尸' }),
  armored: Object.freeze({ primaryTag: 'armor', tags: ['armor', 'flesh'], label: '装甲尸' }),
  shielded: Object.freeze({ primaryTag: 'shield', tags: ['shield', 'flesh'], label: '护盾感染体' }),
  bomber: Object.freeze({ primaryTag: 'flesh', tags: ['flesh'], label: '爆破尸' }),
  toxic: Object.freeze({ primaryTag: 'flesh', tags: ['flesh'], label: '毒囊尸' }),
  medic: Object.freeze({ primaryTag: 'flesh', tags: ['flesh'], label: '强化军医尸' }),
  swarm: Object.freeze({ primaryTag: 'swarm', tags: ['swarm', 'flesh'], label: '尸群感染体' }),
  boss: Object.freeze({ primaryTag: 'boss', tags: ['boss', 'armor', 'flesh'], label: '重型感染体' }),
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeMultiplier(value, minimum = 0.5, maximum = 2) {
  const number = Number(value ?? 1);
  return Number.isFinite(number) ? clamp(number, minimum, maximum) : 1;
}

/**
 * 纯伤害计算：不读取场景、不修改传入对象，方便战斗层和模拟脚本共同使用。
 * status 支持 vulnerability、resistance、armorBreak，均使用0~1的小数比例。
 */
export function calculateDamage(baseDamage, attackProfile = {}, defenseProfile = {}, status = {}) {
  const safeBaseDamage = Math.max(0, Number.isFinite(Number(baseDamage)) ? Number(baseDamage) : 0);
  const damageType = DAMAGE_TYPES.includes(attackProfile.damageType) ? attackProfile.damageType : 'neutral';
  const profileTags = Array.isArray(defenseProfile.tags) ? defenseProfile.tags : [];
  const requestedPrimary = defenseProfile.primaryTag || profileTags[0];
  const primaryTag = DEFENSE_TAGS.includes(requestedPrimary) ? requestedPrimary : 'neutral';
  const typeMultiplier = TYPE_VS_DEFENSE[damageType]?.[primaryTag] ?? 1;
  const attackMultiplier = safeMultiplier(attackProfile.damageMultiplier, 0.5, 2);
  const defenseMultiplier = safeMultiplier(defenseProfile.damageTakenMultiplier, 0.5, 2);

  const vulnerability = clamp(Number(status.vulnerability) || 0, 0, 0.35);
  const resistance = clamp(Number(status.resistance) || 0, 0, 0.35);
  const armorBreak = primaryTag === 'armor' || primaryTag === 'shield'
    ? clamp(Number(status.armorBreak) || 0, 0, 0.5)
    : 0;
  const statusMultiplier = (1 + vulnerability) * (1 - resistance) * (1 + armorBreak);
  // 状态和自定义倍率可以扩大差异，但总伤害永不低于基础值的50%，不存在免疫。
  const totalMultiplier = clamp(typeMultiplier * attackMultiplier * defenseMultiplier * statusMultiplier, 0.5, 2.5);
  const damage = Math.round(safeBaseDamage * totalMultiplier * 100) / 100;

  const effectiveness = typeMultiplier >= 1.2 ? 'advantage' : typeMultiplier <= 0.9 ? 'resisted' : 'neutral';
  const typeName = DAMAGE_TYPE_NAMES[damageType] || '中性';
  const defenseName = DEFENSE_TAG_NAMES[primaryTag] || '无标签';
  const breakdown = [
    { source: 'type', label: `${typeName} → ${defenseName}`, multiplier: typeMultiplier },
    { source: 'attack', label: attackProfile.label || '攻击配置', multiplier: attackMultiplier },
    { source: 'defense', label: defenseProfile.label || '防御配置', multiplier: defenseMultiplier },
  ];
  if (statusMultiplier !== 1) breakdown.push({ source: 'status', label: '状态修正', multiplier: statusMultiplier });

  return {
    damage,
    baseDamage: safeBaseDamage,
    damageType,
    defenseTag: primaryTag,
    effectiveness,
    typeMultiplier,
    attackMultiplier,
    defenseMultiplier,
    statusMultiplier,
    totalMultiplier,
    breakdown,
  };
}
