// 安全可改区：法术的补给消耗、冷却和效果强度都集中在这里。
export const SPELL_ORDER = ['incendiary', 'frost'];

export const SPELLS = Object.freeze({
  incendiary: Object.freeze({
    code: 'HE',
    name: '燃烧弹',
    cost: 24,
    cooldownMs: 18000,
    radius: 72,
    durationMs: 4500,
    tickMs: 500,
    damage: 12,
    color: 0xe67932,
    fill: 0x4a2b20,
  }),
  frost: Object.freeze({
    code: 'CRYO',
    name: '冰霜弹',
    cost: 18,
    cooldownMs: 15000,
    radius: 84,
    durationMs: 4000,
    tickMs: 160,
    slowMultiplier: 0.5,
    bossSlowMultiplier: 0.72,
    color: 0x79afb6,
    fill: 0x20383d,
  }),
});
