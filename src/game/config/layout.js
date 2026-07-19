// 安全可改区：所有战斗画面的核心坐标集中在这里，避免场景内散落魔法数字。
export const LAYOUT = {
  hud: { top: 0, bottom: 84 },
  battlefield: { top: 84, bottom: 700 },
  base: { top: 700, bottom: 890 },
  footer: { top: 890, bottom: 960 },
  lane: { centerX: 270, width: 166, spawnY: 108, gateY: 696 },
  gate: { x: 270, y: 704, width: 176, height: 42 },
  // 四个交互锚点与 v2 底图的实体炮座一一对齐；以后换底图时只需改这里。
  facilities: [
    { x: 160, y: 754 },
    { x: 340, y: 754 },
    { x: 160, y: 820 },
    { x: 340, y: 820 },
  ],
  supply: { x: 422, y: 785 },
};

export const PALETTE = {
  olive: 0x4e5b3a,
  sand: 0xb89a6a,
  gunmetal: 0x2c3338,
  orange: 0xe67932,
  red: 0xc9453b,
  plastic: 0xe9e3d5,
  night: 0x171c1f,
};
