import { PALETTE } from '../game/config/layout.js';
import { createExtraTowerTextures } from '../game/content/extraTowerTextures.js';
import { createExtraEnemyTextures } from '../game/content/extraEnemyTextures.js';

/**
 * 正式 PNG 的安全回退素材。
 * 只有对应文件加载失败时才生成，战斗逻辑始终使用同一组纹理 key。
 */
export function createTextures(scene) {
  if (!scene.textures.exists('commander')) createCommander(scene);
  if (!scene.textures.exists('toy-zombie')) createZombie(scene, 'toy-zombie', false);
  if (!scene.textures.exists('toy-boss')) createZombie(scene, 'toy-boss', true);
  if (!scene.textures.exists('zombie-runner')) createRunnerZombie(scene);
  if (!scene.textures.exists('zombie-armored')) createArmoredZombie(scene);
  if (!scene.textures.exists('zombie-swarm')) createSwarmZombie(scene);
  if (!scene.textures.exists('heavy-mg')) createMachineGun(scene);
  if (!scene.textures.exists('mortar')) createMortar(scene);
  if (!scene.textures.exists('sniper-tower')) createSniper(scene);
  if (!scene.textures.exists('supply-depot')) createSupplyDepot(scene);
  if (!scene.textures.exists('tracer')) createTracer(scene);
  // 新炮塔暂时使用高分辨率程序回退图，后续可直接用同名 PNG 覆盖。
  createExtraTowerTextures(scene);
  createExtraEnemyTextures(scene);
}

function createCommander(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x273126, 1); g.fillCircle(40, 29, 18); g.fillRoundedRect(22, 42, 36, 34, 10);
  g.fillStyle(0x626f46, 1); g.fillEllipse(40, 23, 48, 16); g.fillRect(18, 21, 44, 7);
  g.fillStyle(0xd1ad7e, 1); g.fillCircle(40, 32, 12);
  g.fillStyle(0x202529, 1); g.fillRect(54, 48, 25, 6); g.fillCircle(79, 51, 4);
  g.fillStyle(PALETTE.plastic, 1); g.fillCircle(35, 31, 2); g.fillCircle(45, 31, 2);
  g.generateTexture('commander', 88, 82); g.destroy();
}

function createZombie(scene, key, boss) {
  const size = boss ? 118 : 76;
  const g = scene.make.graphics({ add: false });
  const center = size / 2;
  g.fillStyle(boss ? 0x343634 : 0x555b4d, 1); g.fillRoundedRect(size * 0.27, size * 0.38, size * 0.46, size * 0.43, size * 0.13);
  g.fillStyle(boss ? 0x8d9a75 : 0x9da88a, 1); g.fillCircle(center, size * 0.3, size * 0.18);
  g.fillStyle(0x32312f, 1); g.fillEllipse(center, size * 0.2, size * 0.38, size * 0.17);
  g.lineStyle(boss ? 9 : 6, 0x757c65, 1);
  g.lineBetween(size * 0.29, size * 0.48, size * 0.1, size * 0.69);
  g.lineBetween(size * 0.71, size * 0.48, size * 0.9, size * 0.68);
  g.lineBetween(size * 0.4, size * 0.78, size * 0.31, size * 0.98);
  g.lineBetween(size * 0.6, size * 0.78, size * 0.7, size * 0.98);
  g.fillStyle(PALETTE.red, 1); g.fillCircle(size * 0.43, size * 0.3, boss ? 4 : 2.5); g.fillCircle(size * 0.58, size * 0.3, boss ? 4 : 2.5);
  g.lineStyle(2, 0x262728, 1); g.lineBetween(size * 0.42, size * 0.39, size * 0.61, size * 0.4);
  if (boss) { g.lineStyle(4, PALETTE.orange, 0.75); g.strokeCircle(center, size * 0.5, size * 0.39); }
  g.generateTexture(key, size, size); g.destroy();
}

function createRunnerZombie(scene) {
  const g = scene.make.graphics({ add: false });
  // 前倾躯干和大跨步让跑尸在很小的竖屏尺寸下仍能表达速度。
  g.fillStyle(0x626957, 1); g.fillRoundedRect(28, 28, 24, 34, 8);
  g.fillStyle(0x9ea686, 1); g.fillCircle(41, 20, 11);
  g.fillStyle(0x303331, 1); g.fillEllipse(40, 13, 29, 10);
  g.fillStyle(0xd27b3f, 1); g.fillRect(29, 35, 22, 8);
  g.lineStyle(5, 0x707761, 1);
  g.lineBetween(31, 38, 11, 49); g.lineBetween(49, 39, 68, 45);
  g.lineBetween(36, 59, 21, 82); g.lineBetween(45, 59, 61, 78);
  g.fillStyle(0xc9453b, 1); g.fillCircle(37, 20, 2.4); g.fillCircle(44, 20, 2.4);
  g.generateTexture('zombie-runner', 76, 86); g.destroy();
}

function createArmoredZombie(scene) {
  const g = scene.make.graphics({ add: false });
  // 装甲尸横向更宽，并用盾板和肩甲形成与普通尸完全不同的外轮廓。
  g.fillStyle(0x313738, 1); g.fillRoundedRect(23, 34, 53, 45, 10);
  g.fillStyle(0x545e5b, 1); g.fillRoundedRect(15, 38, 19, 34, 6); g.fillRoundedRect(66, 38, 18, 34, 6);
  g.fillStyle(0x89917c, 1); g.fillCircle(50, 25, 15);
  g.fillStyle(0x272c2d, 1); g.fillEllipse(50, 16, 43, 15); g.fillRect(29, 16, 42, 7);
  g.lineStyle(4, 0xb69a67, 0.9); g.strokeRoundedRect(26, 38, 47, 34, 7);
  g.fillStyle(0x3f4747, 1); g.fillRoundedRect(7, 44, 23, 38, 5);
  g.lineStyle(8, 0x4b5350, 1); g.lineBetween(38, 75, 33, 94); g.lineBetween(62, 75, 68, 94);
  g.fillStyle(0xc9453b, 1); g.fillCircle(44, 26, 3); g.fillCircle(56, 26, 3);
  g.generateTexture('zombie-armored', 98, 98); g.destroy();
}

function createSwarmZombie(scene) {
  const g = scene.make.graphics({ add: false });
  // 尸群单位保持小、矮、横向张开；多只同屏会形成可识别的灰黄色色块。
  g.fillStyle(0x777d69, 1); g.fillRoundedRect(22, 29, 24, 28, 10);
  g.fillStyle(0xa5aa8e, 1); g.fillCircle(35, 23, 11);
  g.fillStyle(0x393b37, 1); g.fillEllipse(35, 16, 28, 9);
  g.fillStyle(0xc1a45f, 1); g.fillCircle(29, 39, 4); g.fillCircle(40, 46, 3);
  g.lineStyle(5, 0x858b73, 1);
  g.lineBetween(24, 36, 6, 48); g.lineBetween(44, 36, 63, 48);
  g.lineBetween(29, 54, 22, 70); g.lineBetween(40, 54, 49, 70);
  g.fillStyle(0xc9453b, 1); g.fillCircle(31, 23, 2); g.fillCircle(38, 23, 2);
  g.generateTexture('zombie-swarm', 70, 74); g.destroy();
}

function createMachineGun(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x23292b, 1); g.fillCircle(45, 53, 31);
  g.fillStyle(PALETTE.olive, 1); g.fillCircle(45, 47, 23); g.fillRoundedRect(34, 17, 22, 43, 6);
  g.fillStyle(0x171b1d, 1); g.fillRect(41, 0, 8, 26);
  g.fillStyle(PALETTE.orange, 1); g.fillCircle(45, 43, 5);
  g.generateTexture('heavy-mg', 90, 88); g.destroy();
}

function createMortar(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x292f31, 1); g.fillCircle(44, 57, 29);
  g.fillStyle(PALETTE.olive, 1); g.fillRoundedRect(35, 10, 18, 57, 8);
  g.fillStyle(0x171b1d, 1); g.fillEllipse(44, 11, 22, 10);
  g.lineStyle(7, 0x596345, 1); g.lineBetween(28, 67, 17, 83); g.lineBetween(60, 67, 72, 83);
  g.generateTexture('mortar', 88, 90); g.destroy();
}

function createSniper(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x292f31, 1); g.fillCircle(45, 58, 30);
  g.lineStyle(8, PALETTE.sand, 1); g.strokeCircle(45, 58, 27);
  g.fillStyle(PALETTE.olive, 1); g.fillRoundedRect(35, 30, 20, 42, 6);
  g.fillStyle(0x171b1d, 1); g.fillRect(41, 0, 8, 43);
  g.fillStyle(0x8fc7aa, 1); g.fillCircle(38, 44, 4);
  g.generateTexture('sniper-tower', 90, 90); g.destroy();
}

function createSupplyDepot(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x252b2d, 1); g.fillRoundedRect(5, 20, 82, 61, 7);
  g.fillStyle(PALETTE.olive, 1); g.fillRoundedRect(12, 27, 68, 47, 5);
  g.lineStyle(3, PALETTE.sand, 0.7); g.strokeRoundedRect(12, 27, 68, 47, 5); g.lineBetween(46, 27, 46, 74);
  g.fillStyle(PALETTE.orange, 1); g.fillRect(40, 43, 13, 7);
  g.generateTexture('supply-depot', 92, 92); g.destroy();
}

function createTracer(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(PALETTE.orange, 0.22); g.fillCircle(10, 10, 9);
  g.fillStyle(0xffe19a, 1); g.fillCircle(10, 10, 4);
  g.generateTexture('tracer', 20, 20); g.destroy();
}
