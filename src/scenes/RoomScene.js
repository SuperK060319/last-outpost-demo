import Phaser from 'phaser';
import { ROOMS } from '../game/config/balance.js';
import { PALETTE } from '../game/config/layout.js';
import { gameStore } from '../game/state/GameStore.js';
import { FONT_BODY, FONT_DISPLAY } from '../utils/ui.js';

const OUTPOST_CODES = Object.freeze({ quiet: 'LOG', stone: 'ARM', lantern: 'AIR' });

export class RoomScene extends Phaser.Scene {
  constructor() { super('RoomScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#171c1f');
    this.drawMapBackdrop();
    this.add.text(270, 74, 'SELECT OUTPOST', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#f0eadc', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(270, 116, '选择本局前线特性  /  一经部署不可更换', { fontFamily: FONT_BODY, fontSize: '12px', color: '#9fa7a3' }).setOrigin(0.5);
    ROOMS.forEach((room, index) => this.createOutpostCard(room, 235 + index * 205, index));
    this.add.text(270, 875, '选择后立即开始 18 秒部署', { fontFamily: FONT_BODY, fontSize: '12px', color: '#737a77' }).setOrigin(0.5);
    this.cameras.main.fadeIn(300, 23, 28, 31);
  }

  drawMapBackdrop() {
    this.add.image(270, 480, 'battlefield-bg').setDisplaySize(540, 960).setAlpha(0.24);
    const g = this.add.graphics();
    g.fillStyle(0x111719, 0.78); g.fillRect(0, 0, 540, 960);
    g.lineStyle(1, 0x69706d, 0.09);
    for (let x = 0; x < 540; x += 36) g.lineBetween(x, 0, x, 960);
    for (let y = 0; y < 960; y += 36) g.lineBetween(0, y, 540, y);
  }

  createOutpostCard(room, y, index) {
    const panel = this.add.rectangle(270, y, 408, 162, 0x242b2c, 0.98).setStrokeStyle(1.5, room.color, 0.72).setInteractive({ useHandCursor: true });
    this.add.rectangle(69, y, 6, 162, room.color, 0.9);
    this.add.rectangle(114, y, 78, 116, 0x181e20, 1).setStrokeStyle(1, room.color, 0.5);
    this.add.text(114, y - 13, OUTPOST_CODES[room.id] || 'OPS', { fontFamily: FONT_DISPLAY, fontSize: '25px', color: '#e9e3d5', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5);
    this.add.text(114, y + 24, 'SECTOR', { fontFamily: FONT_DISPLAY, fontSize: '8px', color: '#858e8a', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(174, y - 38, room.name, { fontFamily: FONT_BODY, fontSize: '23px', color: '#e9e3d5', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.add.text(174, y + 1, room.trait, { fontFamily: FONT_BODY, fontSize: '15px', color: Phaser.Display.Color.IntegerToColor(room.color).rgba }).setOrigin(0, 0.5);
    this.add.text(174, y + 38, '点击部署  →', { fontFamily: FONT_BODY, fontSize: '12px', color: '#aeb5b1' }).setOrigin(0, 0.5);
    panel.on('pointerover', () => panel.setFillStyle(0x3b443a, 1).setStrokeStyle(2, room.color, 1));
    panel.on('pointerout', () => panel.setFillStyle(0x242b2c, 0.98).setStrokeStyle(1.5, room.color, 0.72));
    panel.on('pointerup', () => {
      gameStore.resetRun(room);
      this.cameras.main.fadeOut(240, 23, 28, 31);
      this.time.delayedCall(250, () => this.scene.start('GameScene'));
    });
  }
}
