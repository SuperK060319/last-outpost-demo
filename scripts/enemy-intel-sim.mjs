import { ENEMY_CATALOG } from '../src/game/config/enemies.js';
import { TOWER_CATALOG } from '../src/game/config/towers.js';
import { getWaveConfig } from '../src/game/config/waves.js';
import { buildEnemyIntel, truncateIntelText } from '../src/game/ui/enemyIntel.js';

const catalogs = { enemies: ENEMY_CATALOG, towers: TOWER_CATALOG };

function previewFor(waveNumber) {
  return getWaveConfig(waveNumber).preview;
}

function printIntel(label, intel) {
  const items = intel.items.map((item) => `${item.name}${item.countLabel}→${item.counterName}`).join(' | ');
  console.log(`${label}: ${intel.variant} / ${intel.badge} / ${items}${intel.overflow ? ` / ${intel.overflow.label}` : ''}`);
}

console.log('LINE ZERO · 敌情预告view model检查');

const wave1 = buildEnemyIntel(previewFor(1), catalogs);
printIntel('W1', wave1);
if (wave1.variant !== 'standard' || wave1.items.length !== 1 || wave1.items[0].count !== 5) throw new Error('W1预告结构错误');
if (wave1.items[0].counterTexture !== 'heavy-mg') throw new Error('W1普通尸克制炮塔错误');

const wave3 = buildEnemyIntel(previewFor(3), catalogs);
printIntel('W3', wave3);
if (wave3.items.length !== 4 || wave3.overflow?.label !== '其余1类') throw new Error('W3五类敌人应压缩为四格+其余1类');
if (!wave3.items.some((item) => item.enemyType === 'armored' && item.counterTower === 'sniper')) throw new Error('W3装甲尸克制提示错误');

const wave4 = buildEnemyIntel(previewFor(4), catalogs);
printIntel('W4', wave4);
if (wave4.items.length !== 4 || wave4.overflow?.label !== '其余4类') throw new Error('W4八类敌人应压缩为四格+其余4类');

const boss = buildEnemyIntel(previewFor(5), catalogs);
printIntel('Boss', boss);
if (boss.variant !== 'boss' || boss.badge !== 'BOSS' || boss.items.length !== 1) throw new Error('Boss独立样式错误');
if (!boss.items[0].isBoss || boss.items[0].threatColor !== '#c9453b') throw new Error('Boss威胁色错误');

const missingPreview = {
  headline: '这是一段用于验证窄屏自动裁切的超长敌情标题',
  summary: '未知目标数量与行为均未能确认',
  threatLevel: 4,
  icons: Array.from({ length: 5 }, (_, index) => ({ enemyType: `unknown-${index + 1}`, count: index + 1 })),
  advice: '配置缺失时仍应返回安全占位，不得阻断休整阶段界面。',
};
const missing = buildEnemyIntel(missingPreview, { enemies: {}, towers: {} }, { maxHeadlineChars: 8, maxHintChars: 10 });
printIntel('Missing', missing);
if (missing.items.length !== 4 || missing.overflow?.label !== '其余1类') throw new Error('缺失配置或溢出结构错误');
if (!missing.items.every((item) => item.missingEnemyConfig && item.texture === 'toy-zombie' && item.counterTexture === 'heavy-mg')) {
  throw new Error('缺失配置没有使用安全占位');
}
if (Array.from(missing.headline).length > 8 || !missing.headline.endsWith('…')) throw new Error('长中文标题未裁切');
if (truncateIntelText('自动榴弹炮需要一段非常长的说明', 6) !== '自动榴弹炮…') throw new Error('中文裁切函数结果错误');

const duplicated = buildEnemyIntel({ threatLevel: 2, icons: [{ enemyType: 'runner', count: 1 }, { enemyType: 'runner', count: 2 }] }, catalogs);
if (duplicated.items.length !== 1 || duplicated.items[0].count !== 3) throw new Error('重复敌人类型没有合并');

console.log('\n检查通过：W1/W3/W4/Boss/缺失配置均返回窄屏安全view model。');
