export const INTEL_THREAT_COLORS = {
  0: '#7f8783',
  1: '#81966b',
  2: '#c9a054',
  3: '#df873f',
  4: '#d95a43',
  5: '#c9453b',
};

const DEFAULT_OPTIONS = {
  maxIcons: 4,
  bossMaxIcons: 1,
  maxNameChars: 7,
  maxTowerNameChars: 7,
  maxHintChars: 18,
  maxHeadlineChars: 14,
  maxSummaryChars: 20,
  maxAdviceChars: 24,
  fallbackEnemyTexture: 'toy-zombie',
  fallbackTowerTexture: 'heavy-mg',
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function truncateIntelText(value, maxChars) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  const characters = Array.from(normalized);
  if (characters.length <= maxChars) return normalized;
  if (maxChars <= 1) return '…';
  return `${characters.slice(0, maxChars - 1).join('')}…`;
}

function mergePreviewIcons(icons) {
  const merged = new Map();
  for (const icon of Array.isArray(icons) ? icons : []) {
    const enemyType = typeof icon?.enemyType === 'string' && icon.enemyType ? icon.enemyType : 'unknown';
    const count = Math.max(0, Math.floor(Number(icon?.count) || 0));
    if (count === 0) continue;
    if (merged.has(enemyType)) merged.get(enemyType).count += count;
    else merged.set(enemyType, { enemyType, count });
  }
  return [...merged.values()];
}

function buildItem(entry, previewThreat, enemyCatalog, towerCatalog, options) {
  const enemy = enemyCatalog[entry.enemyType] || null;
  const isBoss = entry.enemyType === 'boss' || enemy?.behavior?.id === 'boss-melee';
  const threatLevel = isBoss ? 5 : clamp(Math.max(previewThreat, Number(enemy?.recommendedWave) || 1), 1, 5);
  const counterType = enemy?.counterTower || null;
  const counter = counterType ? towerCatalog[counterType] : null;
  const fullName = enemy?.name || '未知目标';
  const fullCounterName = counter?.name || '通用火力';
  const fullHint = enemy?.counterHint || '资料不足，保持通用火力覆盖并优先观察。';

  return {
    enemyType: entry.enemyType,
    texture: enemy?.texture || options.fallbackEnemyTexture,
    name: truncateIntelText(fullName, options.maxNameChars),
    fullName,
    count: entry.count,
    countLabel: `×${entry.count}`,
    threatLevel,
    threatColor: INTEL_THREAT_COLORS[threatLevel],
    isBoss,
    counterTower: counterType,
    counterTexture: counter?.texture || options.fallbackTowerTexture,
    counterName: truncateIntelText(fullCounterName, options.maxTowerNameChars),
    fullCounterName,
    hint: truncateIntelText(fullHint, options.maxHintChars),
    fullHint,
    missingEnemyConfig: !enemy,
    missingCounterConfig: Boolean(counterType && !counter),
  };
}

/**
 * 把波次preview转换为窄屏HUD可直接渲染的纯view model。
 * catalogs格式：{ enemies: ENEMY_CATALOG, towers: TOWER_CATALOG }。
 */
export function buildEnemyIntel(preview, catalogs = {}, customOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  options.maxIcons = clamp(Math.floor(options.maxIcons) || DEFAULT_OPTIONS.maxIcons, 1, 4);
  options.bossMaxIcons = clamp(Math.floor(options.bossMaxIcons) || DEFAULT_OPTIONS.bossMaxIcons, 1, 4);
  const enemyCatalog = catalogs.enemies || {};
  const towerCatalog = catalogs.towers || {};
  const mergedEntries = mergePreviewIcons(preview?.icons);
  const hasBoss = mergedEntries.some((entry) => entry.enemyType === 'boss');
  if (hasBoss) mergedEntries.sort((left, right) => Number(right.enemyType === 'boss') - Number(left.enemyType === 'boss'));

  const threatLevel = hasBoss ? 5 : clamp(Math.floor(Number(preview?.threatLevel) || 1), 1, 5);
  const visibleLimit = hasBoss ? options.bossMaxIcons : options.maxIcons;
  const visibleEntries = mergedEntries.slice(0, visibleLimit);
  const hiddenEntries = mergedEntries.slice(visibleLimit);
  const items = visibleEntries.map((entry) => buildItem(entry, threatLevel, enemyCatalog, towerCatalog, options));
  const hiddenUnitCount = hiddenEntries.reduce((sum, entry) => sum + entry.count, 0);
  const overflow = hiddenEntries.length > 0 ? {
    typeCount: hiddenEntries.length,
    unitCount: hiddenUnitCount,
    label: `其余${hiddenEntries.length}类`,
  } : null;
  const headline = truncateIntelText(preview?.headline || (hasBoss ? '重型感染体' : '敌情未确认'), options.maxHeadlineChars);
  const summary = truncateIntelText(preview?.summary || items.map((item) => `${item.fullName}${item.countLabel}`).join(' · '), options.maxSummaryChars);
  const advice = truncateIntelText(preview?.advice || '保持火力覆盖，观察敌人轮廓。', options.maxAdviceChars);
  const totalUnits = mergedEntries.reduce((sum, entry) => sum + entry.count, 0);

  return {
    variant: mergedEntries.length === 0 ? 'empty' : hasBoss ? 'boss' : 'standard',
    badge: hasBoss ? 'BOSS' : `THREAT ${threatLevel}`,
    headline,
    summary,
    advice,
    threatLevel,
    threatColor: INTEL_THREAT_COLORS[threatLevel],
    totalTypes: mergedEntries.length,
    totalUnits,
    items,
    overflow,
    accessibleLabel: mergedEntries.length === 0
      ? '敌情资料为空'
      : `${hasBoss ? 'Boss警报' : `威胁等级${threatLevel}`}，${mergedEntries.map((entry) => `${enemyCatalog[entry.enemyType]?.name || '未知目标'}${entry.count}个`).join('，')}`,
  };
}
