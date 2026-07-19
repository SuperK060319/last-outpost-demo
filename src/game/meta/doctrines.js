const MAX_DOCTRINE_LEVEL = 3;

export const DOCTRINES = Object.freeze({
  logistics: Object.freeze({
    id: 'logistics',
    name: '后勤储备',
    shortName: '后勤',
    maxLevel: MAX_DOCTRINE_LEVEL,
    costs: Object.freeze([10, 22, 38]),
    description: '每级让下一局多携带 2 点补给。',
  }),
  fortification: Object.freeze({
    id: 'fortification',
    name: '加固工事',
    shortName: '工事',
    maxLevel: MAX_DOCTRINE_LEVEL,
    costs: Object.freeze([12, 26, 42]),
    description: '每级让闸门初始与最大耐久提高 4%。',
  }),
  analysis: Object.freeze({
    id: 'analysis',
    name: '战报分析',
    shortName: '分析',
    maxLevel: MAX_DOCTRINE_LEVEL,
    costs: Object.freeze([8, 18, 30]),
    description: '逐级解锁武器位、强化分布和防线详情。',
  }),
});

export const DOCTRINE_IDS = Object.freeze(Object.keys(DOCTRINES));

export function createDefaultDoctrineLevels() {
  return {
    logistics: 0,
    fortification: 0,
    analysis: 0,
  };
}

function normalizeLevel(value, maxLevel = MAX_DOCTRINE_LEVEL) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(maxLevel, Math.floor(number)));
}

export function normalizeDoctrineLevels(value) {
  const source = value && typeof value === 'object' ? value : {};
  return DOCTRINE_IDS.reduce((levels, id) => {
    levels[id] = normalizeLevel(source[id], DOCTRINES[id].maxLevel);
    return levels;
  }, createDefaultDoctrineLevels());
}

function resolveLevels(profileOrLevels) {
  const source = profileOrLevels?.doctrines ?? profileOrLevels;
  return normalizeDoctrineLevels(source);
}

export function doctrineBonuses(profileOrLevels) {
  const levels = resolveLevels(profileOrLevels);
  return {
    // 满级仅 +6 补给（相对基础 42 为 14.3%），避免新玩家被永久成长拉开过大差距。
    startingSupplies: levels.logistics * 2,
    doorHpMultiplier: levels.fortification * 0.04,
    analysisLevel: levels.analysis,
  };
}

export function doctrineUpgradeState(profile, id) {
  const doctrine = DOCTRINES[id];
  if (!doctrine) return { id, valid: false, reason: 'unknown' };

  const levels = resolveLevels(profile);
  const level = levels[id];
  const isMax = level >= doctrine.maxLevel;
  const cost = isMax ? null : doctrine.costs[level];
  const jade = Math.max(0, Math.floor(Number(profile?.jade) || 0));

  return {
    id,
    valid: true,
    level,
    nextLevel: isMax ? level : level + 1,
    maxLevel: doctrine.maxLevel,
    isMax,
    cost,
    affordable: !isMax && jade >= cost,
  };
}

export function formatDoctrineEffect(id, level) {
  const safeLevel = normalizeLevel(level);
  if (id === 'logistics') return `开局补给 +${safeLevel * 2}`;
  if (id === 'fortification') return `闸门耐久 +${safeLevel * 4}%`;
  if (id === 'analysis') return `战报详情 ${safeLevel}/3`;
  return '';
}

const TOWER_NAMES = Object.freeze({
  machineGun: '重机枪',
  mortar: '迫击炮',
  supply: '补给站',
  sniper: '狙击塔',
  flamethrower: '火焰喷射器',
  grenadeLauncher: '自动榴弹炮',
  antiArmorRocket: '反装甲火箭',
});

const UPGRADE_LABELS = Object.freeze({
  power: '威力',
  cadence: '频率',
  payload: '载荷',
});

function readSlot(slot) {
  if (!slot?.type) return { name: '空', towerType: null, upgrades: {} };
  return {
    name: TOWER_NAMES[slot.type] ?? slot.type,
    towerType: slot.type,
    upgrades: slot.upgrades ?? {},
  };
}

function upgradeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

/**
 * 生成一条可执行建议，并根据“战报分析”等级逐步追加事实型复盘信息。
 * 这个函数保持纯函数，便于结果页与自动化测试使用同一套判断。
 */
export function buildBattleReview({
  victory = false,
  wave = 0,
  weaponSlots = [],
  doorLevel = 1,
  bedLevel = 1,
  analysisLevel = 0,
} = {}) {
  const slots = Array.from({ length: 4 }, (_, index) => readSlot(weaponSlots[index]));
  const filled = slots.filter((slot) => slot.towerType);
  const filledSlots = filled.length;
  const duplicateTowers = filledSlots >= 2 && new Set(filled.map((slot) => slot.towerType)).size === 1;
  const upgrades = { power: 0, cadence: 0, payload: 0 };

  slots.forEach((slot) => {
    Object.keys(upgrades).forEach((key) => {
      upgrades[key] += upgradeCount(slot.upgrades[key]);
    });
  });

  const totalUpgrades = Object.values(upgrades).reduce((sum, value) => sum + value, 0);
  const rankedTracks = Object.entries(upgrades).sort((a, b) => a[1] - b[1]);
  const weakestTrack = UPGRADE_LABELS[rankedTracks[0][0]];
  let code = 'focus-upgrade';
  let suggestion = `下局优先强化${weakestTrack}，不要把资源平均铺开。`;

  if (!victory && filledSlots < 3) {
    code = 'fill-slots';
    suggestion = `第 ${Math.max(1, wave)} 波失守：先部署三座不同职责的炮塔，再购买高阶强化。`;
  } else if (!victory && duplicateTowers) {
    code = 'diversify-towers';
    suggestion = `两座都是${slots[0].name}：下局改成单体与群攻各一座。`;
  } else if (!victory && totalUpgrades < 2) {
    code = 'buy-upgrades';
    suggestion = '火力强化不足：下局先把主力炮塔的一项强化升到 2 级。';
  } else if (!victory && doorLevel <= 1) {
    code = 'upgrade-door';
    suggestion = '闸门仍是 1 级：下一局在中段敌潮前完成一次闸门升级。';
  } else if (victory && filledSlots < 4) {
    code = 'victory-fill-slots';
    suggestion = '已经守住哨站：下局继续补齐炮位，尝试更完整的单体与群攻组合。';
  } else if (victory && duplicateTowers) {
    code = 'victory-diversify';
    suggestion = `已经通关：把一座${slots[0].name}换成不同职责的武器，比较效率。`;
  } else if (victory) {
    code = 'victory-focus-upgrade';
    suggestion = `已经通关：下局集中提升${weakestTrack}，验证更高效的强化路线。`;
  }

  const details = [];
  const safeAnalysisLevel = normalizeLevel(analysisLevel);
  if (safeAnalysisLevel >= 1) details.push(`武器位：${slots.map((slot) => slot.name).join(' / ')}`);
  if (safeAnalysisLevel >= 2) {
    details.push(`强化分布：威力 ${upgrades.power} · 频率 ${upgrades.cadence} · 载荷 ${upgrades.payload}`);
  }
  if (safeAnalysisLevel >= 3) {
    details.push(`防线：闸门 Lv.${Math.max(1, doorLevel)} · 补给站 Lv.${Math.max(1, bedLevel)} · 抵达第 ${Math.max(0, wave)} 波`);
  }

  return {
    code,
    suggestion,
    details,
    metrics: { filledSlots, duplicateTowers, totalUpgrades, upgrades },
  };
}
