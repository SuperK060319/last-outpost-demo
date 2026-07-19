import Phaser from 'phaser';
import { createTextures } from '../utils/createTextures.js';

// v2 是已经按 A 方向统一视角、材质和比例的正式美术；v1 文件保留用于安全回退。
const ASSET_ROOT = 'assets/last-outpost-v2';
const assetUrl = (fileName) => globalThis.__LAST_OUTPOST_ASSETS__?.[fileName] ?? `${ASSET_ROOT}/${fileName}`;

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // 正式美术只在启动场景集中加载；加载失败时 createTextures 会补上程序占位图。
    this.load.image('battlefield-bg', assetUrl('battlefield-background.jpg'));
    this.load.image('commander', assetUrl('commander.png'));
    this.load.image('toy-zombie', assetUrl('zombie.png'));
    this.load.image('toy-boss', assetUrl('boss.png'));
    this.load.image('heavy-mg', assetUrl('heavy-mg.png'));
    this.load.image('mortar', assetUrl('mortar.png'));
    this.load.image('sniper-tower', assetUrl('sniper-tower.png'));
    this.load.image('flame-turret', assetUrl('flame-turret.png'));
    this.load.image('auto-grenade', assetUrl('auto-grenade.png'));
    this.load.image('anti-armor-rocket', assetUrl('anti-armor-rocket.png'));
    this.load.image('supply-depot', assetUrl('supply-depot.png'));
    this.load.image('deployment-pad', assetUrl('deployment-pad.png'));
    this.load.image('zombie-runner', assetUrl('zombie-runner.png'));
    this.load.image('zombie-armored', assetUrl('zombie-armored.png'));
    this.load.image('zombie-swarm', assetUrl('zombie-swarm.png'));
    this.load.image('zombie-shielded', assetUrl('zombie-shielded.png'));
    this.load.image('zombie-bomber', assetUrl('zombie-bomber.png'));
    this.load.image('zombie-toxic', assetUrl('zombie-toxic.png'));
    this.load.image('zombie-medic', assetUrl('zombie-medic.png'));
  }

  create() {
    clearTimeout(globalThis.__lastOutpostBootTimer);
    document.getElementById('boot-status')?.remove();
    createTextures(this);
    this.scene.start('MenuScene');
  }
}
