import Phaser from 'phaser';
import { gameStore } from '../game/state/GameStore.js';
import { PALETTE } from '../game/config/layout.js';
import {
  DOCTRINE_IDS,
  DOCTRINES,
  buildBattleReview,
  formatDoctrineEffect,
} from '../game/meta/doctrines.js';
import { addButton, FONT_BODY, FONT_DISPLAY } from '../utils/ui.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene'); }

  create(data = {}) {
    const victory = Boolean(data.victory);
    this.resultData = { victory, reward: Number(data.reward) || 0 };
    this.cameras.main.setBackgroundColor(victory ? '#252c29' : '#211d1e');
    this.drawBackdrop(victory);
    const hero = this.add.image(270, 124, victory ? 'commander' : 'toy-zombie');
    hero.setScale((victory ? 150 : 138) / hero.height);
    this.add.text(270, 228, victory ? 'OUTPOST SECURED' : 'OUTPOST LOST', { fontFamily: FONT_DISPLAY, fontSize: '32px', color: '#f0eadc', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(270, 266, victory ? '基地守住了最后一道防线。' : '闸门失守，感染潮突破防线。', { fontFamily: FONT_BODY, fontSize: '13px', color: '#aeb4b0' }).setOrigin(0.5);

    const summary = `抵达第 ${gameStore.wave} 波   ·   消灭 ${gameStore.kills}   ·   勋章 +${this.resultData.reward}`;
    this.add.text(270, 310, summary, { fontFamily: FONT_BODY, fontSize: '14px', color: '#c8b38c', align: 'center' }).setOrigin(0.5);

    this.add.rectangle(270, 420, 432, 164, 0x12181a, 0.9).setStrokeStyle(1.5, PALETTE.sand, 0.46);
    this.add.rectangle(57, 420, 6, 164, victory ? PALETTE.orange : PALETTE.red, 0.9);
    this.add.text(72, 352, '战后复盘 / AFTER ACTION', { fontFamily: FONT_BODY, fontSize: '11px', color: '#8f9692', fontStyle: 'bold' });
    this.reviewText = this.add.text(72, 380, '', {
      fontFamily: FONT_BODY,
      fontSize: '14px',
      color: '#e9e3d5',
      fontStyle: 'bold',
      wordWrap: { width: 396 },
      lineSpacing: 5,
    });
    this.reviewDetails = this.add.text(72, 446, '', {
      fontFamily: FONT_BODY,
      fontSize: '11px',
      color: '#949c98',
      wordWrap: { width: 396 },
      lineSpacing: 3,
    });
    this.refreshReview();

    this.medalText = this.add.text(72, 526, '', { fontFamily: FONT_BODY, fontSize: '13px', color: '#c8b38c', fontStyle: 'bold' });
    this.statusText = this.add.text(468, 526, '', { fontFamily: FONT_BODY, fontSize: '11px', color: '#d7c8aa' }).setOrigin(1, 0);
    this.add.text(270, 526, '永久条令（每项最高 3 级）', { fontFamily: FONT_BODY, fontSize: '11px', color: '#858d89' }).setOrigin(0.5, 0);
    this.doctrineRows = {};
    DOCTRINE_IDS.forEach((id, index) => this.createDoctrineRow(id, 572 + index * 57));
    this.refreshDoctrineRows();

    addButton(this, 270, 790, 292, 56, '再次部署  /  REDEPLOY', () => this.scene.start('RoomScene'), { fill: PALETTE.olive, stroke: PALETTE.orange, fontSize: '18px' });
    const home = this.add.text(270, 846, '返回标题', { fontFamily: FONT_BODY, fontSize: '13px', color: '#8c9390' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    home.on('pointerup', () => this.scene.start('MenuScene'));
    this.cameras.main.fadeIn(420, 23, 28, 31);
  }

  createDoctrineRow(id, y) {
    const doctrine = DOCTRINES[id];
    this.add.rectangle(270, y, 432, 48, 0x242a29, 0.96).setStrokeStyle(1, 0x777267, 0.42);
    this.add.rectangle(57, y, 4, 48, PALETTE.sand, 0.42);
    const name = this.add.text(72, y - 13, doctrine.name, { fontFamily: FONT_BODY, fontSize: '13px', color: '#e1dacb', fontStyle: 'bold' });
    const effect = this.add.text(72, y + 6, '', { fontFamily: FONT_BODY, fontSize: '10px', color: '#949c98' });
    const button = addButton(this, 402, y, 112, 32, '', () => this.buyDoctrine(id), {
      fill: PALETTE.gunmetal,
      hoverFill: 0x4c554c,
      stroke: PALETTE.orange,
      fontSize: '12px',
    });
    this.doctrineRows[id] = { name, effect, button };
  }

  buyDoctrine(id) {
    const result = gameStore.purchaseDoctrine(id);
    if (result.ok) {
      this.statusText.setColor('#9fc49a').setText(`已升级 ${DOCTRINES[id].shortName}`);
      this.refreshDoctrineRows();
      this.refreshReview();
      return;
    }
    const message = result.reason === 'insufficient' ? `还差 ${Math.max(0, result.cost - result.jade)} 枚` : result.reason === 'max' ? '已经满级' : '条令不可用';
    this.statusText.setColor('#d68c76').setText(message);
  }

  refreshDoctrineRows() {
    this.medalText.setText(`勋章余额 ${gameStore.profile.jade}`);
    DOCTRINE_IDS.forEach((id) => {
      const state = gameStore.getDoctrineUpgradeState(id);
      const row = this.doctrineRows[id];
      row.name.setText(`${DOCTRINES[id].name}  ${state.level}/${state.maxLevel}`);
      row.effect.setText(formatDoctrineEffect(id, state.level));
      row.button.setLabel(state.isMax ? '已满级' : `${state.cost} 枚升级`);
      row.button.setEnabled(!state.isMax);
    });
  }

  refreshReview() {
    const review = buildBattleReview({
      victory: this.resultData.victory,
      wave: gameStore.wave,
      weaponSlots: gameStore.weaponSlots,
      doorLevel: gameStore.doorLevel,
      bedLevel: gameStore.bedLevel,
      analysisLevel: gameStore.getDoctrineLevel('analysis'),
    });
    this.reviewText.setText(review.suggestion);
    this.reviewDetails.setText(review.details.length ? review.details.join('\n') : '升级“战报分析”可解锁更多复盘数据。');
  }

  drawBackdrop(victory) {
    this.add.image(270, 480, 'battlefield-bg').setDisplaySize(540, 960).setAlpha(0.22);
    const g = this.add.graphics();
    g.fillGradientStyle(victory ? 0x3c473d : 0x472e31, 0x272d2d, 0x111719, 0x111719, 0.82); g.fillRect(0, 0, 540, 960);
    g.fillStyle(victory ? PALETTE.orange : PALETTE.red, 0.14); g.fillCircle(270, 125, 94);
    g.lineStyle(1, 0xb89a6a, 0.34); g.strokeRect(48, 32, 444, 842);
    g.fillStyle(victory ? PALETTE.orange : PALETTE.red, 0.9); g.fillRect(48, 32, 86, 4);
  }
}
