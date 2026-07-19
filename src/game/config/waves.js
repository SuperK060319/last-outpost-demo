// 安全可改区：波次数量、三段刷新节奏与敌情预告集中在这里。
export const WAVE_PHASES = {
  probe: { id: 'probe', label: '试探', radio: '零散目标进入射界' },
  assault: { id: 'assault', label: '主力', radio: '主力感染群正在推进' },
  cleanup: { id: 'cleanup', label: '收尾', radio: '最后一批目标接近' },
  boss: { id: 'boss', label: '首领', radio: '重型感染体单独入场' },
};

export const WAVES = [
  {
    number: 1,
    durationSeconds: 27,
    preview: {
      headline: '小规模感染群',
      summary: '普通感染体 ×5',
      threatLevel: 1,
      icons: [{ enemyType: 'normal', count: 5 }],
      advice: '先观察火力覆盖，再决定第二座炮塔。',
    },
    batches: [
      { phase: 'probe', enemyType: 'normal', startMs: 0, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'normal', startMs: 3500, count: 3, intervalMs: 1150 },
      { phase: 'cleanup', enemyType: 'normal', startMs: 8500, count: 1, intervalMs: 0 },
    ],
  },
  {
    number: 2,
    durationSeconds: 29,
    preview: {
      headline: '快速目标混入',
      summary: '普通 ×5 · 跑尸 ×1',
      threatLevel: 2,
      icons: [{ enemyType: 'normal', count: 5 }, { enemyType: 'runner', count: 1 }],
      advice: '跑尸耐久低但速度快，持续火力更稳。',
    },
    batches: [
      { phase: 'probe', enemyType: 'normal', startMs: 0, count: 1, intervalMs: 0 },
      { phase: 'probe', enemyType: 'runner', startMs: 1600, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'normal', startMs: 4200, count: 3, intervalMs: 1500 },
      { phase: 'cleanup', enemyType: 'normal', startMs: 14000, count: 1, intervalMs: 0 },
    ],
  },
  {
    number: 3,
    durationSeconds: 31,
    preview: {
      headline: '特种感染体出现',
      summary: '普通 ×4 · 装甲/护盾/爆破 ×1 · 尸群 ×3',
      threatLevel: 3,
      icons: [{ enemyType: 'normal', count: 4 }, { enemyType: 'armored', count: 1 }, { enemyType: 'shielded', count: 1 }, { enemyType: 'bomber', count: 1 }, { enemyType: 'swarm', count: 3 }],
      advice: '爆炸绕过护盾；爆破尸必须在抵门前优先击杀。',
    },
    batches: [
      { phase: 'probe', enemyType: 'normal', startMs: 0, count: 1, intervalMs: 0 },
      { phase: 'probe', enemyType: 'shielded', startMs: 1550, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'normal', startMs: 4200, count: 3, intervalMs: 1200 },
      { phase: 'assault', enemyType: 'armored', startMs: 6800, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'bomber', startMs: 8700, count: 1, intervalMs: 0 },
      // 一组尸群在压力计算中替代两个普通名额，但场上实际出现三只小型单位。
      { phase: 'cleanup', enemyType: 'swarm', startMs: 12200, count: 1, intervalMs: 0, slotWeight: 2 },
    ],
  },
  {
    number: 4,
    durationSeconds: 33,
    preview: {
      headline: '支援与污染混合潮',
      summary: '九类感染体混合推进',
      threatLevel: 4,
      icons: [{ enemyType: 'normal', count: 3 }, { enemyType: 'runner', count: 1 }, { enemyType: 'armored', count: 1 }, { enemyType: 'shielded', count: 1 }, { enemyType: 'bomber', count: 1 }, { enemyType: 'toxic', count: 1 }, { enemyType: 'medic', count: 1 }, { enemyType: 'swarm', count: 3 }],
      advice: '先点杀军医与爆破尸，毒囊尽量在远端击破。',
    },
    batches: [
      { phase: 'probe', enemyType: 'normal', startMs: 0, count: 1, intervalMs: 0 },
      { phase: 'probe', enemyType: 'runner', startMs: 1300, count: 1, intervalMs: 0 },
      { phase: 'probe', enemyType: 'shielded', startMs: 2850, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'normal', startMs: 4500, count: 2, intervalMs: 1250 },
      { phase: 'assault', enemyType: 'armored', startMs: 6700, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'medic', startMs: 8150, count: 1, intervalMs: 0 },
      { phase: 'assault', enemyType: 'bomber', startMs: 9700, count: 1, intervalMs: 0 },
      { phase: 'cleanup', enemyType: 'toxic', startMs: 11700, count: 1, intervalMs: 0 },
      { phase: 'cleanup', enemyType: 'swarm', startMs: 13900, count: 1, intervalMs: 0, slotWeight: 2 },
    ],
  },
  {
    number: 5,
    durationSeconds: 35,
    preview: {
      headline: '重型感染体',
      summary: 'Boss ×1',
      threatLevel: 5,
      icons: [{ enemyType: 'boss', count: 1 }],
      advice: '单体高生命目标，集中穿甲与持续火力。',
    },
    batches: [
      { phase: 'boss', enemyType: 'boss', startMs: 0, count: 1, intervalMs: 0 },
    ],
  },
];

export function getWaveConfig(waveNumber) {
  return WAVES.find((wave) => wave.number === waveNumber) || null;
}

// 返回按出生时间排序的纯事件；场景只需要消费事件，不需要理解批次结构。
export function expandWaveSchedule(waveOrNumber) {
  const wave = typeof waveOrNumber === 'number' ? getWaveConfig(waveOrNumber) : waveOrNumber;
  if (!wave) return [];
  return wave.batches
    .flatMap((batch) => Array.from({ length: batch.count }, (_, index) => ({
      atMs: batch.startMs + index * batch.intervalMs,
      enemyType: batch.enemyType,
      phase: batch.phase,
      phaseLabel: WAVE_PHASES[batch.phase].label,
      slotWeight: batch.slotWeight || 1,
      indexInBatch: index,
    })))
    .sort((left, right) => left.atMs - right.atMs);
}

// 休整阶段读取下一波预告；最后一波结束后返回 null。
export function getNextWavePreview(currentWaveNumber) {
  const nextWave = getWaveConfig(currentWaveNumber + 1);
  return nextWave ? { waveNumber: nextWave.number, ...nextWave.preview } : null;
}
