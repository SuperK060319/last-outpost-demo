import Phaser from 'phaser';
import { createTextures } from '../utils/createTextures.js';

// v2 是已经按 A 方向统一视角、材质和比例的正式美术；v1 文件保留用于安全回退。
const ASSET_ROOT = 'assets/last-outpost-v2';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // 正式美术只在启动场景集中加载；加载失败时 createTextures 会补上程序占位图。
    this.load.image('battlefield-bg', `${ASSET_ROOT}/battlefield-background.jpg`);
    this.load.image('commander', `${ASSET_ROOT}/commander.png`);
    this.load.image('toy-zombie', `${ASSET_ROOT}/zombie.png`);
    this.load.image('toy-boss', `${ASSET_ROOT}/boss.png`);
    this.load.image('heavy-mg', `${ASSET_ROOT}/heavy-mg.png`);
    this.load.image('mortar', `${ASSET_ROOT}/mortar.png`);
    this.load.image('sniper-tower', `${ASSET_ROOT}/sniper-tower.png`);
    this.load.image('flame-turret', `${ASSET_ROOT}/flame-turret.png`);
    this.load.image('auto-grenade', `${ASSET_ROOT}/auto-grenade.png`);
    this.load.image('anti-armor-rocket', `${ASSET_ROOT}/anti-armor-rocket.png`);
    this.load.image('supply-depot', `${ASSET_ROOT}/supply-depot.png`);
    this.load.image('deployment-pad', `${ASSET_ROOT}/deployment-pad.png`);
    this.load.image('zombie-runner', `${ASSET_ROOT}/zombie-runner.png`);
    this.load.image('zombie-armored', `${ASSET_ROOT}/zombie-armored.png`);
    this.load.image('zombie-swarm', `${ASSET_ROOT}/zombie-swarm.png`);
    this.load.image('zombie-shielded', `${ASSET_ROOT}/zombie-shielded.png`);
    this.load.image('zombie-bomber', `${ASSET_ROOT}/zombie-bomber.png`);
    this.load.image('zombie-toxic', `${ASSET_ROOT}/zombie-toxic.png`);
    this.load.image('zombie-medic', `${ASSET_ROOT}/zombie-medic.png`);
  }

  create() {
    createTextures(this);
    this.scene.start('MenuScene');
  }
}
