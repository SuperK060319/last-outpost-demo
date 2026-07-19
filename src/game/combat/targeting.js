export const TARGET_MODES = Object.freeze([
  'nearestGate',
  'highestHp',
  'lowestHp',
  'fastest',
  'highestArmor',
  'densestCluster',
]);

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function candidates(enemies) {
  if (!Array.isArray(enemies)) return [];
  return enemies.flatMap((enemy, index) => {
    const sprite = enemy?.sprite;
    const hp = Number(enemy?.hp);
    if (!sprite || sprite.active === false || !Number.isFinite(hp) || hp <= 0) return [];
    if (!Number.isFinite(Number(sprite.x)) || !Number.isFinite(Number(sprite.y))) return [];
    return [{ enemy, index, x: Number(sprite.x), y: Number(sprite.y) }];
  });
}

function stableSort(items, compare) {
  return items.slice().sort((left, right) => compare(left, right) || left.index - right.index);
}

function targetCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.floor(value));
}

function gateDistance(candidate, context) {
  const gateX = Number(context?.gate?.x ?? context?.gateX);
  const gateY = Number(context?.gate?.y ?? context?.gateY);
  if (Number.isFinite(gateX) && Number.isFinite(gateY)) {
    return (candidate.x - gateX) ** 2 + (candidate.y - gateY) ** 2;
  }
  if (Number.isFinite(gateY)) return Math.abs(candidate.y - gateY);
  // 未提供闸门坐标时，默认越靠下越接近基地。
  return -candidate.y;
}

function ranked(items, mode, context) {
  const descending = (field) => stableSort(items, (left, right) => (
    finiteNumber(right.enemy[field]) - finiteNumber(left.enemy[field])
  ));
  if (mode === 'nearestGate') return stableSort(items, (left, right) => gateDistance(left, context) - gateDistance(right, context));
  if (mode === 'highestHp') return descending('hp');
  if (mode === 'lowestHp') return stableSort(items, (left, right) => finiteNumber(left.enemy.hp) - finiteNumber(right.enemy.hp));
  if (mode === 'fastest') return descending('speed');
  if (mode === 'highestArmor') return descending('armor');
  throw new RangeError(`Unsupported targeting mode: ${mode}`);
}

function densestCluster(items, limit, context) {
  if (items.length === 0 || limit === 0) return { targets: [], center: null };
  const radius = Math.max(0, finiteNumber(context?.radius, 58));
  const radiusSquared = radius ** 2;
  let best = null;

  items.forEach((candidate) => {
    const members = items.filter((other) => (
      (other.x - candidate.x) ** 2 + (other.y - candidate.y) ** 2 <= radiusSquared
    ));
    // 密度相同时保留更早出现的中心，避免每帧在并列簇之间抖动。
    if (!best || members.length > best.members.length) best = { candidate, members };
  });

  return {
    center: { x: best.candidate.x, y: best.candidate.y },
    targets: best.members.slice(0, limit).map((item) => item.enemy),
  };
}

/**
 * 纯函数目标选择器：不修改敌人数组，返回稳定、可直接消费的选择结果。
 */
export function selectTargets(enemies, mode = 'nearestGate', count = 1, context = {}) {
  if (!TARGET_MODES.includes(mode)) throw new RangeError(`Unsupported targeting mode: ${mode}`);
  const items = candidates(enemies);
  const limit = targetCount(count);
  if (mode === 'densestCluster') return densestCluster(items, limit, context);
  return {
    center: null,
    targets: ranked(items, mode, context).slice(0, limit).map((item) => item.enemy),
  };
}
