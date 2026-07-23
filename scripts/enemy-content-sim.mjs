import {
  ENEMIES,
  ENEMY_CATALOG,
  ENEMY_CATALOG_IDS,
  EXTRA_ENEMIES,
  LIVE_ENEMY_CATALOG,
  enemyStatsForWave,
} from '../src/game/config/enemies.js';
import { createExtraEnemyTextures } from '../src/game/content/extraEnemyTextures.js';
import { WAVES } from '../src/game/config/waves.js';

const REQUIRED_FIELDS = [
  'id', 'name', 'role', 'texture', 'hpMultiplier', 'speedMultiplier', 'damageMultiplier',
  'rewardMultiplier', 'scaleMultiplier', 'packSize', 'primaryColor', 'accentColor',
  'silhouette', 'behavior', 'counterTower', 'counterHint', 'recommendedWave',
];

console.log('LINE ZERO · 九类敌人内容检查');
console.log('敌人 | 建议波次 | 单体HP | 到门秒数 | 单次门伤 | 组奖励 | 行为');

if (ENEMY_CATALOG_IDS.length !== 9) throw new Error(`敌人总类型应为9，当前为${ENEMY_CATALOG_IDS.length}`);
if (Object.keys(LIVE_ENEMY_CATALOG).length !== 9) throw new Error('当前已接入目录应包含9类');
if (Object.keys(EXTRA_ENEMIES).length !== 4) throw new Error('扩展目录应包含4类');
if (typeof createExtraEnemyTextures !== 'function') throw new Error('扩展敌人纹理API缺失');

const textures = new Set();
const behaviorIds = new Set();
for (const [id, enemy] of Object.entries(ENEMY_CATALOG)) {
  for (const field of REQUIRED_FIELDS) {
    if (enemy[field] === undefined || enemy[field] === null || enemy[field] === '') throw new Error(`${id}缺少字段${field}`);
  }
  if (enemy.id !== id) throw new Error(`${id}的内部id不一致`);
  if (textures.has(enemy.texture)) throw new Error(`${id}与其他敌人共用纹理key，轮廓可能无法区分`);
  if (behaviorIds.has(enemy.behavior.id)) throw new Error(`${id}的行为id不唯一`);
  textures.add(enemy.texture);
  behaviorIds.add(enemy.behavior.id);

  if (enemy.hpMultiplier <= 0 || enemy.speedMultiplier <= 0 || enemy.damageMultiplier <= 0 || enemy.rewardMultiplier <= 0) {
    throw new Error(`${id}存在非正数战斗倍率`);
  }
  if (enemy.hpMultiplier > 1 && enemy.speedMultiplier > 1 && enemy.damageMultiplier > 1.5) {
    throw new Error(`${id}同时拥有高血、高速和高伤，缺少弱点`);
  }
  const rewardPerHp = enemy.rewardMultiplier / enemy.hpMultiplier;
  if (rewardPerHp < 0.7 || rewardPerHp > 2.2) throw new Error(`${id}奖励与耐久不匹配`);

  const stats = enemyStatsForWave(id, enemy.recommendedWave);
  const groupReward = stats.reward * stats.packSize;
  console.log(`${enemy.name} | ${enemy.recommendedWave} | ${stats.hp} | ${stats.travelSeconds.toFixed(2)} | ${stats.damage} | ${groupReward} | ${enemy.behavior.id}`);
}

for (const id of Object.keys(EXTRA_ENEMIES)) {
  if (ENEMIES[id]) throw new Error(`${id}提前进入当前GameScene敌人目录`);
}

const waveEnemyTypes = new Set(WAVES.flatMap((wave) => wave.batches.map((batch) => batch.enemyType)));
for (const enemyType of waveEnemyTypes) {
  if (!LIVE_ENEMY_CATALOG[enemyType]) throw new Error(`当前波次引用未接入行为的敌人：${enemyType}`);
}

console.log('\n扩展敌人相对同波普通尸：');
for (const [id, enemy] of Object.entries(EXTRA_ENEMIES)) {
  const wave = enemy.recommendedWave;
  const normal = enemyStatsForWave('normal', wave);
  const current = enemyStatsForWave(id, wave);
  const hpRatio = current.hp / normal.hp;
  const contactRatio = current.damage / normal.damage;
  const arrivalRatio = normal.travelSeconds / current.travelSeconds;
  console.log(`${enemy.name}: 生命 ${hpRatio.toFixed(2)}x / 门伤 ${contactRatio.toFixed(2)}x / 抵达速度 ${arrivalRatio.toFixed(2)}x`);
}

console.log('\n检查通过：9类敌人均已接入；字段、纹理、行为、奖励与当前波次引用完整。');
