import { PALETTE } from '../config/layout.js';

// 四种扩展敌人的程序回退纹理；主分支接入BootScene后才会参与正式加载。
export function createExtraEnemyTextures(scene) {
  if (!scene.textures.exists('zombie-shielded')) createShielded(scene);
  if (!scene.textures.exists('zombie-bomber')) createBomber(scene);
  if (!scene.textures.exists('zombie-toxic')) createToxic(scene);
  if (!scene.textures.exists('zombie-medic')) createMedic(scene);
}

function drawBody(g, bodyColor, headColor = 0x929b7f) {
  g.fillStyle(bodyColor, 1); g.fillRoundedRect(29, 42, 42, 46, 11);
  g.fillStyle(headColor, 1); g.fillCircle(50, 31, 15);
  g.lineStyle(7, bodyColor, 1); g.lineBetween(35, 81, 29, 108); g.lineBetween(64, 81, 71, 108);
  g.fillStyle(PALETTE.red, 1); g.fillCircle(45, 30, 2.5); g.fillCircle(55, 30, 2.5);
}

function createShielded(scene) {
  const g = scene.make.graphics({ add: false });
  drawBody(g, 0x485354, 0x87917b);
  g.fillStyle(0x303a3d, 1); g.fillRoundedRect(16, 40, 54, 62, 8);
  g.lineStyle(4, 0x6da4a0, 0.95); g.strokeRoundedRect(16, 40, 54, 62, 8);
  g.fillStyle(0x171c1f, 1); g.fillRect(24, 51, 38, 9);
  g.fillStyle(PALETTE.orange, 1); g.fillRect(39, 82, 10, 10);
  g.generateTexture('zombie-shielded', 92, 112); g.destroy();
}

function createBomber(scene) {
  const g = scene.make.graphics({ add: false });
  drawBody(g, 0x555447, 0x9aa083);
  g.fillStyle(0x2b3032, 1); g.fillRoundedRect(25, 47, 50, 37, 8);
  [34, 50, 66].forEach((x) => { g.fillStyle(0x8f3b32, 1); g.fillRoundedRect(x - 5, 48, 10, 31, 4); });
  g.lineStyle(2, PALETTE.sand, 0.9); g.lineBetween(25, 60, 75, 60);
  g.fillStyle(PALETTE.red, 1); g.fillCircle(50, 65, 5);
  g.generateTexture('zombie-bomber', 100, 112); g.destroy();
}

function createToxic(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x66763d, 1); g.fillCircle(61, 47, 29);
  g.lineStyle(4, 0xb9c946, 0.9); g.strokeCircle(61, 47, 29);
  g.fillStyle(0xd7dc65, 0.75); g.fillCircle(70, 37, 7); g.fillCircle(53, 53, 6);
  drawBody(g, 0x526044, 0x939d79);
  g.lineStyle(8, 0x526044, 1); g.lineBetween(35, 53, 18, 77); g.lineBetween(66, 54, 82, 75);
  g.generateTexture('zombie-toxic', 100, 112); g.destroy();
}

function createMedic(scene) {
  const g = scene.make.graphics({ add: false });
  drawBody(g, 0x687066, 0xa0a78d);
  g.fillStyle(0x30383a, 1); g.fillRoundedRect(59, 45, 25, 42, 6);
  g.lineStyle(3, PALETTE.sand, 0.9); g.lineBetween(72, 45, 78, 10);
  g.fillStyle(PALETTE.orange, 1); g.fillCircle(78, 9, 4);
  g.fillStyle(0xe5e0cf, 1); g.fillRoundedRect(20, 51, 24, 24, 5);
  g.fillStyle(0x8f453e, 1); g.fillRect(29, 55, 6, 16); g.fillRect(24, 60, 16, 6);
  g.fillStyle(0xd4cf7a, 1); g.fillRoundedRect(60, 67, 10, 18, 4);
  g.generateTexture('zombie-medic', 100, 112); g.destroy();
}
