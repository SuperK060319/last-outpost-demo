import Phaser from 'phaser';
import { gameStore } from '../game/state/GameStore.js';
import { PALETTE } from '../game/config/layout.js';
import { DOCTRINES, DOCTRINE_IDS, doctrineBonuses } from '../game/meta/doctrines.js';
import { addButton, FONT_BODY, FONT_DISPLAY } from '../utils/ui.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#171c1f');
    this.drawBackdrop();
    this.add.text(270, 112, 'LAST OUTPOST', { fontFamily: FONT_DISPLAY, fontSize: '52px', color: '#f0eadc', fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5);
    this.add.text(270, 163, '最后哨站', { fontFamily: FONT_BODY, fontSize: '18px', color: '#d7aa70', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(270, 198, 'FIELD DEFENSE COMMAND  //  05 WAVES', { fontFamily: FONT_DISPLAY, fontSize: '11px', color: '#8f9995', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(270, 224, '自动火力已上线。守住最后一道闸门。', { fontFamily: FONT_BODY, fontSize: '12px', color: '#aab0ad' }).setOrigin(0.5);

    this.add.ellipse(270, 511, 244, 34, 0x000000, 0.42);
    const commander = this.add.image(270, 391, 'commander');
    commander.setScale(286 / commander.height);
    this.add.text(270, 536, 'OUTPOST COMMAND // UNIT 07', { fontFamily: FONT_DISPLAY, fontSize: '10px', color: '#8a918e', letterSpacing: 3 }).setOrigin(0.5);

    const stats = `最高波次 ${gameStore.profile.bestWave}    ·    勋章 ${gameStore.profile.jade}`;
    this.add.text(270, 575, stats, { fontFamily: FONT_BODY, fontSize: '14px', color: '#d7c19a', fontStyle: 'bold' }).setOrigin(0.5);

    const levels = DOCTRINE_IDS.map((id) => `${DOCTRINES[id].shortName} ${gameStore.getDoctrineLevel(id)}/3`).join('  ·  ');
    const bonuses = doctrineBonuses(gameStore.profile);
    this.add.text(270, 614, `永久条令  ${levels}`, { fontFamily: FONT_BODY, fontSize: '12px', color: '#d9d2c3' }).setOrigin(0.5);
    this.add.text(270, 642, `战备加成  开局补给 +${bonuses.startingSupplies}  ·  闸门耐久 +${Math.round(bonuses.doorHpMultiplier * 100)}%`, { fontFamily: FONT_BODY, fontSize: '11px', color: '#8f9894' }).setOrigin(0.5);

    addButton(this, 270, 710, 292, 64, '部署防线  /  DEPLOY', () => {
      this.cameras.main.fadeOut(260, 23, 28, 31);
      this.time.delayedCall(270, () => this.scene.start('RoomScene'));
    }, { fill: PALETTE.olive, hoverFill: 0x65734c, stroke: PALETTE.orange, fontSize: '21px' });

    this.add.text(270, 774, '竖屏单线塔防 · 全自动战斗 · 本地存档', { fontFamily: FONT_BODY, fontSize: '11px', color: '#717775' }).setOrigin(0.5);
    this.add.text(270, 887, 'DEMO BUILD 03  /  AUTO DEFENSE', { fontFamily: FONT_DISPLAY, fontSize: '9px', color: '#626a67', letterSpacing: 2 }).setOrigin(0.5);
    this.cameras.main.fadeIn(400, 23, 28, 31);
  }

  drawBackdrop() {
    this.add.image(270, 480, 'battlefield-bg').setDisplaySize(540, 960).setAlpha(0.6);
    const g = this.add.graphics();
    g.fillGradientStyle(0x111719, 0x111719, 0x111719, 0x111719, 0.62); g.fillRect(0, 0, 540, 960);
    g.lineStyle(1, PALETTE.sand, 0.38); g.strokeRect(34, 34, 472, 860);
    g.fillStyle(PALETTE.orange, 0.92); g.fillRect(34, 62, 6, 178);
    g.fillStyle(0x111719, 0.86); g.fillRect(66, 548, 408, 290);
    g.lineStyle(1, 0x8d8678, 0.44); g.strokeRect(66, 548, 408, 290);
    g.fillStyle(PALETTE.orange, 0.68);
    for (let x = 70; x < 470; x += 22) g.fillRect(x, 548, 10, 3);
    g.lineStyle(2, PALETTE.red, 0.54); g.lineBetween(468, 66, 468, 118);
  }
}
