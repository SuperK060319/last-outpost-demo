// 基础类型由现有场景直接处理；保留完整配置供图鉴、预告和模拟读取。
export const BASE_ENEMIES = {
  normal: {
    id: 'normal', name: '普通感染体', role: '基础推进 / 均衡', texture: 'toy-zombie',
    hpMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1, rewardMultiplier: 1,
    scaleMultiplier: 1, packSize: 1, primaryColor: 0x555b4d, accentColor: 0xb8b49d,
    silhouette: '中等体型、窄肩直立、双臂前伸，以灰绿皮肤和破损作训服作为全部敌人的视觉基准。',
    behavior: { id: 'basic-melee', description: '沿直路推进，抵达闸门后进行稳定近战攻击。' },
    counterTower: 'machineGun', counterHint: '任何稳定单体火力都能处理，机枪成本最低。', recommendedWave: 1,
  },
  boss: {
    id: 'boss', name: '重型感染体', role: '首领攻坚 / 极高耐久', texture: 'toy-boss',
    hpMultiplier: 4.44, speedMultiplier: 0.66, damageMultiplier: 1.71, rewardMultiplier: 6,
    scaleMultiplier: 1.68, packSize: 1, primaryColor: 0x343634, accentColor: 0xc9453b,
    absoluteStats: { hp: 720, damage: 24, reward: 60 },
    silhouette: '最高大宽厚的轮廓，重型护具、粗壮双臂和红色警戒标记使其在道路顶部即可识别。',
    behavior: { id: 'boss-melee', description: '单独入场，以高生命和更快的闸门攻击频率进行最终攻坚。' },
    counterTower: 'sniper', counterHint: '集中威力与攻速专精，穿透目标数在单Boss战中没有收益。', recommendedWave: 5,
  },
};

// 当前已经接入GameScene与波次的三种原型；这里新增字段不会改变既有行为。
export const ENEMIES = {
  runner: {
    id: 'runner', name: '跑尸', role: '快速突进 / 低耐久', texture: 'zombie-runner',
    hpMultiplier: 0.62, speedMultiplier: 1.28, damageMultiplier: 0.7, rewardMultiplier: 1,
    scaleMultiplier: 0.86, packSize: 1, primaryColor: 0x626957, accentColor: 0xd27b3f,
    silhouette: '窄肩长腿、身体明显前倾、双臂向前伸展，橙色撕裂背心形成速度警示。',
    behavior: { id: 'fast-melee', description: '以更短旅行时间抢先抵达闸门，但生命明显低于普通尸。' },
    counterTower: 'machineGun', counterHint: '高射速可减少瞄准和重炮落空，优先处理跑尸。', recommendedWave: 2,
  },
  armored: {
    id: 'armored', name: '装甲尸', role: '慢速承伤 / 高耐久', texture: 'zombie-armored',
    hpMultiplier: 1.55, speedMultiplier: 0.68, damageMultiplier: 1.1, rewardMultiplier: 1.5,
    scaleMultiplier: 1.13, packSize: 1, primaryColor: 0x3f4747, accentColor: 0xb69a67,
    silhouette: '宽肩、厚胸甲、低头推进，一侧防护板扩大横向轮廓，枪铁灰与沙色边缘强调护甲。',
    behavior: { id: 'heavy-melee', description: '用较慢速度交换更高生命，持续吸收前线单体火力。' },
    counterTower: 'sniper', counterHint: '狙击重击能减少长时间磨血，反装甲火箭接入后效率更高。', recommendedWave: 3,
  },
  swarm: {
    id: 'swarm', name: '尸群感染体', role: '群体填线 / 低单体', texture: 'zombie-swarm',
    hpMultiplier: 0.38, speedMultiplier: 0.9, damageMultiplier: 0.35, rewardMultiplier: 0.67,
    scaleMultiplier: 0.74, packSize: 3, primaryColor: 0x858b73, accentColor: 0xc1a45f,
    silhouette: '小体型、驼背、双臂横张，灰黄色感染斑形成群体色块，依靠成组出现而非单体压迫。',
    behavior: { id: 'spawn-pack', description: '一个波次事件生成三只小型单位，以数量占用炮塔射击节奏。' },
    counterTower: 'mortar', counterHint: '范围爆炸可同时覆盖整组，避免单体武器逐只浪费射击。', recommendedWave: 3,
  },
};

// 新四类先留在扩展目录，主分支完成行为分发后再放入波次。
export const EXTRA_ENEMIES = {
  shielded: {
    id: 'shielded', name: '护盾兵', role: '正面防护 / 慢速推进', texture: 'zombie-shielded',
    hpMultiplier: 1.25, speedMultiplier: 0.72, damageMultiplier: 0.9, rewardMultiplier: 1.45,
    scaleMultiplier: 1.08, packSize: 1, primaryColor: 0x485354, accentColor: 0x6da4a0,
    silhouette: '身体前方竖起接近身高的矩形防暴盾，露出单侧头肩，青灰盾面形成最宽的正面轮廓。',
    behavior: { id: 'frontal-shield', description: '护盾存在时减少55%正面直射伤害；护盾生命为本体最大生命的35%。', frontalReduction: 0.55, shieldHpRatio: 0.35 },
    counterTower: 'mortar', counterHint: '爆炸和燃烧绕过正面直射减伤；不要只用机枪硬磨。', recommendedWave: 3,
  },
  bomber: {
    id: 'bomber', name: '爆破尸', role: '高速爆门 / 中低耐久', texture: 'zombie-bomber',
    hpMultiplier: 0.78, speedMultiplier: 1.05, damageMultiplier: 2.4, rewardMultiplier: 1.3,
    scaleMultiplier: 0.94, packSize: 1, primaryColor: 0x555447, accentColor: 0xd94b3f,
    silhouette: '胸前绑有三枚粗大爆破筒，红色警示灯位于轮廓中心，双臂外张避免遮挡炸药。',
    behavior: { id: 'gate-detonation', description: '抵达闸门后引燃650毫秒并自毁，单次造成高额门伤。', fuseMs: 650, selfDestruct: true },
    counterTower: 'machineGun', counterHint: '低生命但门伤极高，应由高射速或高优先级单体火力提前击杀。', recommendedWave: 3,
  },
  toxic: {
    id: 'toxic', name: '毒囊尸', role: '死亡干扰 / 慢速', texture: 'zombie-toxic',
    hpMultiplier: 0.9, speedMultiplier: 0.78, damageMultiplier: 0.65, rewardMultiplier: 1.3,
    scaleMultiplier: 1.02, packSize: 1, primaryColor: 0x526044, accentColor: 0xb9c946,
    silhouette: '背部隆起巨大黄绿色毒囊，身体向前弯曲以平衡重量，毒囊高度超过头部。',
    behavior: { id: 'death-cloud', description: '死亡时留下3秒毒雾，使范围内炮塔攻击间隔增加25%。', radiusPx: 64, durationMs: 3000, cadencePenalty: 0.25 },
    counterTower: 'sniper', counterHint: '在远离基地的位置击杀，避免毒雾覆盖两座武器位。', recommendedWave: 4,
  },
  medic: {
    id: 'medic', name: '强化军医尸', role: '后排支援 / 低攻击', texture: 'zombie-medic',
    hpMultiplier: 0.82, speedMultiplier: 0.86, damageMultiplier: 0.5, rewardMultiplier: 1.55,
    scaleMultiplier: 0.98, packSize: 1, primaryColor: 0x687066, accentColor: 0xe5e0cf,
    silhouette: '背负方形医疗电台与高天线，左臂旧白色识别带和明亮药剂罐突出后排支援身份。',
    behavior: { id: 'support-pulse', description: '每1.8秒治疗附近友军6%最大生命，并提高其8%移动速度。', radiusPx: 92, pulseMs: 1800, healRatio: 0.06, speedBoost: 0.08 },
    counterTower: 'sniper', counterHint: '设置为高价值优先目标，先击杀军医再处理被强化的前排。', recommendedWave: 4,
  },
};

export const ENEMY_CATALOG = { ...BASE_ENEMIES, ...ENEMIES, ...EXTRA_ENEMIES };
// 四种行为已经接入主战场，LIVE目录现在与完整图鉴一致。
export const LIVE_ENEMY_CATALOG = ENEMY_CATALOG;
export const ENEMY_IDS = Object.keys(LIVE_ENEMY_CATALOG);
export const ENEMY_CATALOG_IDS = Object.keys(ENEMY_CATALOG);

// 从出生点到闸门接敌线的目标旅行时间；所有实时速度都由这里反算。
export const ENEMY_TRAVEL = {
  normalByWave: [0, 8.8, 8.25, 7.7, 7.2],
  bossSeconds: 11,
  profiles: {
    runner: { multiplier: 0.8, minSeconds: 6, maxSeconds: 7 },
    armored: { multiplier: 1.42, minSeconds: 10, maxSeconds: 12 },
    swarm: { multiplier: 1.05, minSeconds: 7.5, maxSeconds: 9 },
    shielded: { multiplier: 1.28, minSeconds: 9.4, maxSeconds: 11 },
    bomber: { multiplier: 0.95, minSeconds: 6.8, maxSeconds: 8.2 },
    toxic: { multiplier: 1.18, minSeconds: 8.5, maxSeconds: 10.5 },
    medic: { multiplier: 1.08, minSeconds: 8, maxSeconds: 9.5 },
  },
};

export function getEnemyConfig(enemyType, includeExtra = true) {
  return (includeExtra ? ENEMY_CATALOG : LIVE_ENEMY_CATALOG)[enemyType] || null;
}

export function enemyTravelSeconds(enemyType = 'normal', waveNumber = 1) {
  if (enemyType === 'boss') return ENEMY_TRAVEL.bossSeconds;
  const waveIndex = Math.min(ENEMY_TRAVEL.normalByWave.length - 1, Math.max(1, Math.floor(waveNumber)));
  const normalSeconds = ENEMY_TRAVEL.normalByWave[waveIndex];
  const profile = ENEMY_TRAVEL.profiles[enemyType];
  if (!profile) return normalSeconds;
  return Math.min(profile.maxSeconds, Math.max(profile.minSeconds, normalSeconds * profile.multiplier));
}

// 图鉴、预告与模拟共用的纯数值接口；不创建场景对象。
export function enemyStatsForWave(enemyType = 'normal', waveNumber = 1) {
  const enemy = getEnemyConfig(enemyType) || BASE_ENEMIES.normal;
  if (enemy.absoluteStats) return { ...enemy.absoluteStats, travelSeconds: enemyTravelSeconds(enemyType, waveNumber), packSize: enemy.packSize };
  const baseHp = 32 + waveNumber * 26;
  const baseDamage = 4 + waveNumber * 2;
  const baseReward = 5 + waveNumber;
  return {
    hp: Math.round(baseHp * enemy.hpMultiplier),
    damage: Number((baseDamage * enemy.damageMultiplier).toFixed(2)),
    reward: Math.max(1, Math.round(baseReward * enemy.rewardMultiplier)),
    travelSeconds: enemyTravelSeconds(enemyType, waveNumber),
    packSize: enemy.packSize,
  };
}
