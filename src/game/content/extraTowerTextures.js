import { PALETTE } from '../config/layout.js';

// 新炮塔的程序回退纹理；主分支接入 BootScene 后才会进入正式加载流程。
export function createExtraTowerTextures(scene) {
  if (!scene.textures.exists('flame-turret')) createFlameTurret(scene);
  if (!scene.textures.exists('auto-grenade')) createGrenadeLauncher(scene);
  if (!scene.textures.exists('anti-armor-rocket')) createRocketLauncher(scene);
}

function createFlameTurret(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x202628, 1); g.fillCircle(48, 57, 34);
  g.fillStyle(PALETTE.olive, 1); g.fillCircle(48, 52, 25);
  g.fillStyle(0x30383a, 1); g.fillRoundedRect(37, 31, 22, 37, 7);
  g.fillStyle(0x1a1f21, 1); g.fillRoundedRect(43, 3, 10, 36, 4);
  g.fillStyle(PALETTE.orange, 1); g.fillEllipse(48, 5, 16, 9);
  g.fillStyle(0x8c3e2f, 1); g.fillCircle(30, 60, 8); g.fillCircle(66, 60, 8);
  g.generateTexture('flame-turret', 96, 94); g.destroy();
}

function createGrenadeLauncher(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x202628, 1); g.fillCircle(48, 59, 34);
  g.fillStyle(PALETTE.olive, 1); g.fillRoundedRect(25, 38, 46, 37, 10);
  g.fillStyle(0x171c1f, 1); g.fillRoundedRect(33, 10, 11, 39, 4); g.fillRoundedRect(52, 10, 11, 39, 4);
  g.fillStyle(PALETTE.sand, 1); g.fillCircle(38, 12, 6); g.fillCircle(57, 12, 6);
  g.fillStyle(PALETTE.orange, 1); g.fillRect(42, 51, 12, 8);
  g.generateTexture('auto-grenade', 96, 96); g.destroy();
}

function createRocketLauncher(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x202628, 1); g.fillCircle(48, 61, 33);
  g.fillStyle(PALETTE.olive, 1); g.fillRoundedRect(25, 42, 46, 31, 9);
  g.fillStyle(0x31383b, 1); g.fillRoundedRect(26, 14, 17, 42, 5); g.fillRoundedRect(53, 14, 17, 42, 5);
  g.fillStyle(0x151a1c, 1); g.fillEllipse(34, 14, 18, 10); g.fillEllipse(61, 14, 18, 10);
  g.lineStyle(3, PALETTE.orange, 0.9); g.strokeEllipse(34, 14, 18, 10); g.strokeEllipse(61, 14, 18, 10);
  g.generateTexture('anti-armor-rocket', 96, 98); g.destroy();
}
