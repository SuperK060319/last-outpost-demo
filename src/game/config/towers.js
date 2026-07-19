// 安全可改区：新增炮塔、价格和三条成长曲线都集中在这里。
export const TOWER_TRACKS = ['power', 'cadence', 'payload'];
// 五次强化合计 200；单线专精可追，三线全满仍需约 600 补给。
export const TOWER_UPGRADE_COSTS = [18, 26, 38, 52, 66];
// 本轮只抬高火力曲线；价格、攻速和弹量保持不变，避免成长再次过早封顶。

export const TOWERS = {
  machineGun: {
    code: 'M-01',
    name: '重机枪',
    role: '持续压制 / 单体',
    description: '射速快，弹匣打空后短暂换弹。',
    texture: 'heavy-mg',
    // 安装点是 PNG 内实体炮座的中心，不是整张透明画布的几何中心。
    mountOrigin: { x: 0.5, y: 0.661 },
    buildCost: 24,
    reloadMs: 3800,
    tracks: {
      power: { name: '弹头威力', values: [20, 23, 26, 30, 34, 39], format: (value) => `${value} 伤害` },
      cadence: { name: '供弹速度', values: [740, 620, 520, 440, 375, 320], format: (value) => `${(1000 / value).toFixed(1)} 发/秒` },
      payload: { name: '弹匣容量', values: [12, 20, 34, 64, 150, 600], format: (value) => `${value} 发` },
    },
  },
  mortar: {
    code: 'A-02',
    name: '迫击炮',
    role: '区域轰炸 / 群体',
    description: '轰击目标周围敌人，每轮可追加炮弹。',
    texture: 'mortar',
    mountOrigin: { x: 0.498, y: 0.641 },
    buildCost: 24,
    blastRadius: 58,
    tracks: {
      power: { name: '爆炸威力', values: [4, 4.8, 5.8, 7, 8.4, 10], format: (value) => `${value} 范围伤害` },
      cadence: { name: '装填速度', values: [3200, 2700, 2300, 1980, 1720, 1510], format: (value) => `${(value / 1000).toFixed(2)} 秒/轮` },
      payload: { name: '每轮炮弹', values: [5, 6, 7, 8, 9, 10], format: (value) => `${value} 发/轮` },
    },
  },
  sniper: {
    code: 'S-03',
    name: '狙击塔',
    role: '重击穿透 / 单体',
    description: '优先击杀最靠近闸门的目标，可贯穿后排。',
    texture: 'sniper-tower',
    mountOrigin: { x: 0.476, y: 0.653 },
    buildCost: 32,
    tracks: {
      power: { name: '穿甲威力', values: [50, 57, 65, 74, 84, 95], format: (value) => `${value} 伤害` },
      cadence: { name: '锁定速度', values: [2500, 2200, 1940, 1710, 1510, 1340], format: (value) => `${(value / 1000).toFixed(2)} 秒/枪` },
      payload: { name: '贯穿目标', values: [1, 2, 3, 4, 5, 6], format: (value) => `${value} 个目标` },
    },
  },
};

// 新内容先与现有建造菜单隔离；完成行为分发和六项菜单适配后再读取 TOWER_CATALOG。
export const EXTRA_TOWERS = {
  flamethrower: {
    code: 'F-04',
    name: '火焰喷射器',
    role: '短程持续 / 范围燃烧',
    description: '灼烧门前扇区，持续点燃多个近距离目标。',
    texture: 'flame-turret',
    mountOrigin: { x: 0.501, y: 0.612 },
    buildCost: 28,
    behavior: {
      id: 'cone-burn',
      targetMode: 'nearest-in-range',
      rangePx: 185,
      coneWidthPx: 92,
      payloadStat: 'maxTargets',
      burn: { tickMs: 500, durationMs: 1500, damageRatio: 0.35, stackMode: 'refresh' },
    },
    tracks: {
      power: { name: '燃料温度', values: [6, 7, 8.2, 9.5, 11, 12.7], format: (value) => `${value} 点/跳` },
      cadence: { name: '喷射频率', values: [360, 315, 276, 243, 215, 191], format: (value) => `${(1000 / value).toFixed(1)} 跳/秒` },
      payload: { name: '喷射覆盖', values: [4, 5, 6, 7, 8, 9], format: (value) => `${value} 个目标` },
    },
  },
  grenadeLauncher: {
    code: 'G-05',
    name: '自动榴弹炮',
    role: '中速连爆 / 小范围',
    description: '连续抛射小范围榴弹，压制门前密集目标。',
    texture: 'auto-grenade',
    mountOrigin: { x: 0.499, y: 0.612 },
    buildCost: 30,
    behavior: {
      id: 'burst-aoe',
      targetMode: 'densest-cluster',
      blastRadiusPx: 38,
      projectileMs: 360,
      burstGapMs: 110,
      payloadStat: 'grenadesPerBurst',
    },
    tracks: {
      power: { name: '装药威力', values: [5, 6, 7.2, 8.6, 10.2, 12], format: (value) => `${value} 单发伤害` },
      cadence: { name: '循环速度', values: [2100, 1850, 1630, 1440, 1275, 1130], format: (value) => `${(value / 1000).toFixed(2)} 秒/轮` },
      payload: { name: '连发榴弹', values: [5, 6, 7, 8, 9, 10], format: (value) => `${value} 发/轮` },
    },
  },
  antiArmorRocket: {
    code: 'R-06',
    name: '反装甲火箭',
    role: '慢速重击 / 破甲',
    description: '优先锁定高护甲目标，命中后短暂削弱其防护。',
    texture: 'anti-armor-rocket',
    mountOrigin: { x: 0.5, y: 0.644 },
    buildCost: 36,
    behavior: {
      id: 'rocket-armor-break',
      targetMode: 'highest-armor-then-hp',
      projectileMs: 520,
      payloadStat: 'armorIgnore',
      armorBreak: { reduction: 0.18, durationMs: 2600, stackMode: 'refresh' },
    },
    tracks: {
      power: { name: '战斗部威力', values: [88, 99, 111, 125, 140, 157], format: (value) => `${value} 伤害` },
      cadence: { name: '再装填速度', values: [4200, 3750, 3350, 2990, 2670, 2390], format: (value) => `${(value / 1000).toFixed(2)} 秒/发` },
      payload: { name: '破甲深度', values: [0.25, 0.33, 0.41, 0.5, 0.6, 0.72], format: (value) => `忽略 ${Math.round(value * 100)}% 护甲` },
    },
  },
};

export const TOWER_CATALOG = { ...TOWERS, ...EXTRA_TOWERS };

export function createWeaponSlot() {
  return { type: null, upgrades: { power: 0, cadence: 0, payload: 0 } };
}

export function towerStats(slot) {
  if (!slot?.type || !TOWER_CATALOG[slot.type]) return null;
  const tower = TOWER_CATALOG[slot.type];
  return Object.fromEntries(TOWER_TRACKS.map((track) => [track, tower.tracks[track].values[slot.upgrades[track]]]));
}
