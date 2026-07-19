// 安全可改区：游戏节奏、价格和强度集中在这里，改完运行 npm run build 验证。
export const BALANCE = {
  preparationSeconds: 18,
  waveSeconds: 25,
  totalWaves: 5,
  startingLeaves: 42,
  startingDoorHp: 160,
  // 持续补给负责“始终有增长”，波次运输负责维持原有购买节点。
  supplyPerSecond: [0, 0.2, 0.35, 0.55, 0.8],
  bedIncome: [0, 17, 36, 56, 78],
  bedCosts: [0, 0, 20, 36, 56],
  // 前两级承担Demo容错，后续升级仍保持明显成本压力。
  doorHp: [0, 160, 270, 420, 610, 850],
  doorCosts: [0, 0, 20, 56, 112, 200],
};

export const ROOMS = [
  { id: 'quiet', name: '后勤前哨', trait: '持续 +0.05/秒 · 每波 +6', supplyRateBonus: 0.05, incomeBonus: 6, doorBonus: 0, color: 0xb89a6a },
  { id: 'stone', name: '装甲阵地', trait: '闸门耐久 +25%', supplyRateBonus: 0, incomeBonus: 0, doorBonus: 0.25, color: 0x9aa3a8 },
  // 空投奖励压到5，确保三种房间开局都不能同时部署两座廉价塔。
  { id: 'lantern', name: '空投据点', trait: '初始补给 +5', supplyRateBonus: 0, incomeBonus: 0, doorBonus: 0, leavesBonus: 5, color: 0xe67932 },
];
