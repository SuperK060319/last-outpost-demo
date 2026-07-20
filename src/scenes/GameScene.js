import Phaser from 'phaser';
import { BALANCE } from '../game/config/balance.js';
import {
  COMBAT_UPGRADES,
  chooseCombatUpgradeIds,
  combatUpgradeModifiers,
  combatXpReward,
  combatXpThreshold,
  createCombatProgress,
} from '../game/config/combatUpgrades.js';
import { ENEMY_CATALOG, enemyTravelSeconds, getEnemyConfig } from '../game/config/enemies.js';
import { LAYOUT, PALETTE } from '../game/config/layout.js';
import { SPELL_ORDER, SPELLS } from '../game/config/spells.js';
import { TOWER_CATALOG, TOWER_TRACKS, TOWER_UPGRADE_COSTS, createWeaponSlot, towerStats } from '../game/config/towers.js';
import { ATTACK_PROFILES, DEFENSE_PROFILES, calculateDamage } from '../game/combat/damageModel.js';
import { createBossPhaseState, getBossModifiers, updateBossPhase } from '../game/combat/bossPhases.js';
import { TARGET_MODES, selectTargets } from '../game/combat/targeting.js';
import { getTowerResaleQuote } from '../game/economy/towerResale.js';
import { buildEnemyIntel } from '../game/ui/enemyIntel.js';
import { WAVE_PHASES, expandWaveSchedule, getNextWavePreview, getWaveConfig } from '../game/config/waves.js';
import { gameStore } from '../game/state/GameStore.js';
import { audioService } from '../game/services/AudioService.js';
import { addButton, FONT_BODY } from '../utils/ui.js';

const TARGET_MODE_LABELS = Object.freeze({
  nearestGate: '离闸门最近',
  highestHp: '生命最高',
  lowestHp: '残血优先',
  fastest: '速度最快',
  highestArmor: '护甲最高',
  densestCluster: '敌群最密集',
});

const DEFAULT_TARGET_MODES = Object.freeze({
  machineGun: 'nearestGate',
  mortar: 'densestCluster',
  sniper: 'highestHp',
  flamethrower: 'nearestGate',
  grenadeLauncher: 'densestCluster',
  antiArmorRocket: 'highestArmor',
});

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.enemies = [];
    this.toxicClouds = [];
    this.enemyIntelObjects = [];
    this.phase = 'preparation';
    this.phaseTime = BALANCE.preparationSeconds;
    this.spawnQueue = 0;
    this.spawnEvents = [];
    this.waveElapsedMs = 0;
    this.currentSpawnPhase = null;
    this.supplyPulseClock = 0;
    this.supplyPulseAmount = 0;
    // 运行态不进存档：换弹计数和开火计时只服务当前战斗。
    this.weaponRuntime = gameStore.weaponSlots.map(() => ({ attackClock: 0, shots: 0, volleyClock: 0 }));
    this.combatProgress = createCombatProgress();
    this.spellRuntime = Object.fromEntries(SPELL_ORDER.map((type) => [type, { cooldownMs: 0 }]));
    this.spellZones = [];
    this.selectedSpell = null;
    this.spellReticle = null;
    this.isEnding = false;
    this.isPausedByUser = false;
    this.modal = null;

    this.drawBattlefield();
    this.createHud();
    this.createBase();
    this.createFooter();
    this.updateAllLabels();
    this.showBanner('PREPARE', '升级基地设施，自动火力即将接敌');
    this.cameras.main.fadeIn(350, 23, 28, 31);
  }

  drawBattlefield() {
    // 正式环境图承担道路、地形与基地整体光影，交互和战斗物件仍保持独立。
    this.add.image(270, 480, 'battlefield-bg').setDisplaySize(540, 960);
    const g = this.add.graphics();
    const roadLeft = LAYOUT.lane.centerX - LAYOUT.lane.width / 2;
    // 出生区只做轻提示，避免遮挡背景的沙盘细节。
    g.fillStyle(PALETTE.red, 0.12); g.fillRect(roadLeft, 84, LAYOUT.lane.width, 42);
    g.lineStyle(2, PALETTE.red, 0.42); g.lineBetween(roadLeft, 126, roadLeft + LAYOUT.lane.width, 126);

    this.add.text(270, 103, 'ZOMBIE ENTRY', { fontFamily: 'Arial Narrow, Arial', fontSize: '11px', color: '#c98578', letterSpacing: 2 }).setOrigin(0.5);
  }

  createHud() {
    this.add.rectangle(270, 42, 540, 84, 0x111719, 0.985).setDepth(20);
    this.add.rectangle(3, 42, 6, 84, PALETTE.orange, 0.96).setDepth(21);
    this.add.rectangle(270, 82, 540, 4, 0x252d2d, 1).setDepth(20);
    this.add.rectangle(270, 83, 540, 1, PALETTE.orange, 0.76).setDepth(21);
    this.add.rectangle(181, 35, 1, 54, PALETTE.sand, 0.22).setDepth(21);
    this.add.rectangle(359, 35, 1, 54, PALETTE.sand, 0.22).setDepth(21);
    this.add.circle(24, 17, 4, 0x84aa62, 1).setDepth(22);
    this.leafText = this.add.text(38, 8, '', { fontFamily: 'Bahnschrift Condensed, Arial Narrow, Arial', fontSize: '22px', color: '#f0b25f', fontStyle: 'bold' }).setDepth(21);
    this.add.text(24, 48, 'SUPPLY / 补给库存', { fontFamily: FONT_BODY, fontSize: '9px', color: '#8f9995' }).setDepth(21);
    this.waveText = this.add.text(270, 10, '', { fontFamily: 'Bahnschrift Condensed, Arial Narrow, Arial', fontSize: '23px', color: '#e9e3d5', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5, 0).setDepth(21);
    this.timerText = this.add.text(270, 48, '', { fontFamily: 'Bahnschrift Condensed, Arial Narrow, Arial', fontSize: '13px', color: '#d7aa70', letterSpacing: 1 }).setOrigin(0.5, 0).setDepth(21);
    this.killText = this.add.text(516, 14, '', { fontFamily: FONT_BODY, fontSize: '13px', color: '#c1c6c3', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(21);
    this.combatLevelText = this.add.text(515, 53, '', {
      fontFamily: 'Arial Narrow, Arial', fontSize: '10px', color: '#9fc8c3', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(21);
    this.xpBarBack = this.add.rectangle(270, 78, 300, 6, 0x30393a, 1).setDepth(21);
    this.xpBar = this.add.rectangle(120, 78, 300, 6, 0x79afb6, 1).setOrigin(0, 0.5).setScale(0, 1).setDepth(22);
  }

  createBase() {
    // 背景已经包含闸门和空平台；这里保留低透明交互层与状态信息。
    this.doorPanel = this.add.rectangle(LAYOUT.gate.x, LAYOUT.gate.y, LAYOUT.gate.width, LAYOUT.gate.height, 0x30393a, 0.08)
      .setStrokeStyle(1.5, PALETTE.sand, 0.55).setInteractive({ useHandCursor: true });
    this.doorPanel.on('pointerup', () => this.openUpgrade('door'));
    this.doorLabel = this.add.text(270, 703, '', {
      fontFamily: 'Bahnschrift Condensed, Microsoft YaHei', fontSize: '10px', color: '#f0eadc', align: 'center',
      backgroundColor: '#111719dd', padding: { x: 6, y: 2 },
    }).setOrigin(0.5);
    this.doorBarBack = this.add.rectangle(270, 681, 190, 9, 0x351f20, 1);
    this.doorBar = this.add.rectangle(175, 681, 190, 9, PALETTE.red, 1).setOrigin(0, 0.5);

    const positions = [
      ...LAYOUT.facilities.map((position, slotIndex) => ({ ...position, slotIndex, isSupply: false })),
      { ...LAYOUT.supply, slotIndex: -1, isSupply: true },
    ];
    this.facilityPanels = positions.map((position) => {
      const { isSupply, slotIndex } = position;
      const pad = isSupply ? null : this.createDeploymentPad(position, slotIndex);
      const panel = this.add.rectangle(position.x, position.y, isSupply ? 72 : 104, isSupply ? 126 : 62, 0x171c1f, 0.035)
        .setStrokeStyle(1.2, 0x9a9f94, 0.38).setInteractive({ useHandCursor: true });
      // 空武器位先显示军械挂点标识，避免玩家把未建造状态误认为素材没有加载。
      const emptyRing = isSupply ? null : this.add.circle(position.x, position.y - 2, 18, PALETTE.gunmetal, 0.84)
        .setStrokeStyle(2, PALETTE.orange, 0.72);
      const emptyPlus = isSupply ? null : this.add.text(position.x, position.y - 4, '+', {
        fontFamily: 'Arial Narrow, Arial', fontSize: '25px', color: '#e6a05d', fontStyle: 'bold',
      }).setOrigin(0.5);
      const texture = isSupply ? 'supply-depot' : 'heavy-mg';
      const icon = this.add.image(position.x, position.y - (isSupply ? 5 : 4), texture);
      // 补给站已经烘焙进底图；炮塔使用独立 PNG 覆盖空炮座，避免出现“双建筑”重影。
      icon.setScale((isSupply ? 80 : 102) / Math.max(icon.width, icon.height)).setVisible(false);
      const label = this.add.text(position.x, position.y + (isSupply ? 58 : 28), '', {
        fontFamily: 'Bahnschrift Condensed, Microsoft YaHei', fontSize: isSupply ? '8px' : '8px', color: '#f1ecdf',
        backgroundColor: '#171c1fcc', padding: { x: 3, y: 1 }, align: 'center',
      }).setOrigin(0.5);
      panel.on('pointerup', () => (isSupply ? this.openUpgrade('bed') : this.openWeaponSlot(slotIndex)));
      panel.on('pointerover', () => {
        panel.setFillStyle(PALETTE.orange, 0.12).setStrokeStyle(1.8, PALETTE.orange, 0.9);
        if (pad?.mount) pad.mount.setAlpha(1);
      });
      panel.on('pointerout', () => {
        const occupied = !isSupply && Boolean(gameStore.weaponSlots[slotIndex]?.type);
        panel.setFillStyle(0x171c1f, 0.025)
          .setStrokeStyle(1.2, occupied ? PALETTE.sand : 0x9a9f94, occupied ? 0.48 : 0.22);
        if (pad?.mount) pad.mount.setAlpha(0.76);
      });
      return { panel, icon, label, isSupply, slotIndex, pad, emptyRing, emptyPlus };
    });
  }

  createDeploymentPad(position, slotIndex) {
    // 独立底座精确覆盖背景锚点，空位和建成状态都不会再少一张“座椅”。
    const { x, y } = position;
    const shadow = this.add.ellipse(x, y + 20, 90, 25, 0x101416, 0.34);
    const mount = this.add.image(x, y, 'deployment-pad')
      .setOrigin(0.5, 0.617)
      .setDisplaySize(100, 100)
      .setAlpha(0.76);
    const stencil = this.add.text(x - 42, y + 22, `P${slotIndex + 1}`, {
      fontFamily: 'Arial Narrow, Arial', fontSize: '7px', color: '#c4ad7c', fontStyle: 'bold',
    }).setAlpha(0.72);
    return { shadow, mount, stencil };
  }

  createFooter() {
    this.add.rectangle(270, 925, 540, 70, 0x111719, 1);
    this.add.rectangle(270, 891, 540, 2, PALETTE.orange, 0.72);
    this.add.rectangle(4, 925, 8, 70, PALETTE.orange, 0.88);
    // 手机会把 540px 画布继续缩小，因此底栏主提示必须保持较大的中文正文和高对比度。
    this.messageText = this.add.text(24, 914, '点击基地设施进行建造或升级', {
      fontFamily: FONT_BODY, fontSize: '14px', color: '#e7e2d8', fontStyle: 'bold',
      lineSpacing: 2, wordWrap: { width: 205 },
    }).setOrigin(0, 0.5);
    this.add.circle(29, 942, 3, PALETTE.orange, 1);
    this.add.text(38, 942, '自动防御运行中', {
      fontFamily: FONT_BODY, fontSize: '11px', color: '#e0a05a', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.rectangle(240, 925, 2, 50, PALETTE.sand, 0.34);
    this.spellButtons = SPELL_ORDER.map((type, index) => this.createSpellButton(type, 277 + index * 68));
    this.pauseButton = addButton(this, 462, 925, 108, 50, '暂停', () => this.togglePause(), {
      fill: 0x303638, stroke: 0x8f9994, fontSize: '16px', fontFamily: FONT_BODY,
    });

    this.input.on('pointermove', (pointer) => this.moveSpellReticle(pointer.worldX, pointer.worldY));
    this.input.on('pointerup', (pointer) => this.tryCastSelectedSpell(pointer.worldX, pointer.worldY));

    // 暂停必须是持续状态而非瞬时提示；弹窗会覆盖它，返回战场后仍保持可见。
    const pausePanel = this.add.rectangle(270, 166, 326, 72, 0x171c1f, 0.97).setStrokeStyle(2, PALETTE.orange, 0.82).setDepth(75);
    const pauseStripe = this.add.rectangle(111, 166, 7, 72, PALETTE.orange, 0.95).setDepth(76);
    const pauseTitle = this.add.text(270, 149, 'PAUSED / 已暂停', { fontFamily: 'Arial Narrow, Microsoft YaHei', fontSize: '23px', color: '#f1eadc', fontStyle: 'bold' }).setOrigin(0.5).setDepth(76);
    const pauseCopy = this.add.text(270, 181, '战斗计时、敌人和自动火力均已冻结', { fontFamily: FONT_BODY, fontSize: '13px', color: '#c7b38c' }).setOrigin(0.5).setDepth(76);
    this.pauseOverlay = [pausePanel, pauseStripe, pauseTitle, pauseCopy];
    this.pauseOverlay.forEach((object) => object.setVisible(false));
  }

  createSpellButton(type, x) {
    const spell = SPELLS[type];
    const panel = this.add.rectangle(x, 925, 62, 52, spell.fill, 0.96)
      .setStrokeStyle(1.5, spell.color, 0.78).setInteractive({ useHandCursor: true });
    const stripe = this.add.rectangle(x, 900, 62, 4, spell.color, 0.95);
    const code = this.add.text(x, 907, spell.code, {
      fontFamily: 'Bahnschrift Condensed, Arial Narrow, Arial', fontSize: '10px', color: '#eef2ef', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5);
    const text = this.add.text(x, 931, '', {
      fontFamily: 'Bahnschrift Condensed, Microsoft YaHei', fontSize: '11px', color: '#f1eadc',
      fontStyle: 'bold', align: 'center', lineSpacing: 1,
    }).setOrigin(0.5);
    panel.on('pointerdown', () => this.tweens.add({ targets: [panel, text], scale: 0.96, duration: 55, yoyo: true }));
    panel.on('pointerup', (_pointer, _localX, _localY, event) => {
      event.stopPropagation();
      this.selectSpell(type);
    });
    return { type, panel, stripe, code, text };
  }

  selectSpell(type) {
    const spell = SPELLS[type];
    const runtime = this.spellRuntime[type];
    if (!spell || !runtime || this.modal || this.isEnding) return;
    if (this.selectedSpell === type) {
      this.clearSpellSelection();
      this.message('已取消战术投放');
      return;
    }
    if (this.phase !== 'wave') {
      this.message('战术弹药只能在敌潮期间投放');
      return;
    }
    if (runtime.cooldownMs > 0) {
      this.message(`${spell.name}冷却中 · ${Math.ceil(runtime.cooldownMs / 1000)}秒`);
      return;
    }
    if (gameStore.leaves < spell.cost) {
      this.message(`补给不足 · ${spell.name}需要 ${spell.cost}`);
      return;
    }

    this.clearSpellSelection();
    this.selectedSpell = type;
    this.spellReticle = this.add.circle(LAYOUT.lane.centerX, 360, spell.radius, spell.color, 0.12)
      .setStrokeStyle(2, spell.color, 0.88).setDepth(18);
    this.messageText.setText(`${spell.name}待命 · 点击道路投放，再点按钮取消`).setColor('#e9e3d5');
    this.updateSpellButtons();
  }

  clearSpellSelection() {
    this.selectedSpell = null;
    this.spellReticle?.destroy();
    this.spellReticle = null;
    this.updateSpellButtons();
  }

  spellTargetIsValid(x, y) {
    const halfWidth = LAYOUT.lane.width / 2;
    return x >= LAYOUT.lane.centerX - halfWidth
      && x <= LAYOUT.lane.centerX + halfWidth
      && y >= 128
      && y <= LAYOUT.lane.gateY - 22;
  }

  moveSpellReticle(x, y) {
    if (!this.spellReticle || !this.selectedSpell) return;
    this.spellReticle.setPosition(x, y);
    this.spellReticle.setAlpha(this.spellTargetIsValid(x, y) ? 1 : 0.28);
  }

  tryCastSelectedSpell(x, y) {
    if (!this.selectedSpell || this.modal || this.isPausedByUser || this.isEnding) return false;
    if (!this.spellTargetIsValid(x, y)) {
      this.messageText.setText('投放位置无效 · 请点击中央道路').setColor('#df7468');
      return false;
    }
    const type = this.selectedSpell;
    const spell = SPELLS[type];
    const runtime = this.spellRuntime[type];
    if (runtime.cooldownMs > 0 || gameStore.leaves < spell.cost) {
      this.clearSpellSelection();
      this.message(runtime.cooldownMs > 0 ? `${spell.name}尚未冷却` : `补给不足 · 需要 ${spell.cost}`);
      return false;
    }

    gameStore.leaves -= spell.cost;
    runtime.cooldownMs = spell.cooldownMs;
    this.clearSpellSelection();
    this.launchSpell(type, x, y);
    this.updateAllLabels();
    this.message(`${spell.name}已投放 · 消耗 ${spell.cost} 补给`);
    return true;
  }

  launchSpell(type, x, y) {
    const spell = SPELLS[type];
    const shell = this.add.circle(x, y - 150, type === 'incendiary' ? 7 : 9, spell.color, 1)
      .setStrokeStyle(3, type === 'incendiary' ? 0xffd18c : 0xd4fbff, 0.9).setDepth(19);
    const shadow = this.add.ellipse(x, y, spell.radius * 1.35, spell.radius * 0.52, 0x111719, 0.22).setDepth(7);
    audioService.mortarLaunch();
    this.tweens.add({ targets: shell, y, duration: 280, ease: 'Quad.In', onComplete: () => {
      shell.destroy();
      shadow.destroy();
      if (type === 'incendiary') this.createExplosion(x, y, 46);
      else {
        audioService.tone(760, 0.18, 0.025, 'sine');
        const impact = this.add.circle(x, y, 14, 0x000000, 0).setStrokeStyle(5, spell.color, 0.92).setDepth(15);
        this.tweens.add({ targets: impact, radius: spell.radius, alpha: 0, duration: 360, onComplete: () => impact.destroy() });
      }
      this.createSpellZone(type, x, y);
    } });
  }

  createSpellZone(type, x, y) {
    const spell = SPELLS[type];
    const view = this.add.circle(x, y, spell.radius, spell.fill, type === 'incendiary' ? 0.24 : 0.2)
      .setStrokeStyle(3, spell.color, 0.68).setDepth(7);
    const core = this.add.circle(x, y, 8, spell.color, 0.72).setDepth(8);
    const zone = {
      type, x, y, view, core,
      remainingMs: spell.durationMs,
      tickClock: spell.tickMs,
      pulseTween: this.tweens.add({ targets: view, scale: 1.06, alpha: type === 'incendiary' ? 0.13 : 0.11, duration: 520, yoyo: true, repeat: -1 }),
    };
    this.spellZones.push(zone);
  }

  updateSpellRuntime(delta) {
    SPELL_ORDER.forEach((type) => {
      this.spellRuntime[type].cooldownMs = Math.max(0, this.spellRuntime[type].cooldownMs - delta);
    });
  }

  updateSpellZones(delta) {
    for (let index = this.spellZones.length - 1; index >= 0; index -= 1) {
      const zone = this.spellZones[index];
      const spell = SPELLS[zone.type];
      zone.remainingMs -= delta;
      zone.tickClock += delta;
      while (zone.tickClock >= spell.tickMs && zone.remainingMs > 0) {
        zone.tickClock -= spell.tickMs;
        this.applySpellZoneTick(zone, spell);
      }
      if (zone.remainingMs > 0) continue;
      this.spellZones.splice(index, 1);
      zone.pulseTween.stop();
      this.tweens.add({ targets: [zone.view, zone.core], alpha: 0, duration: 180, onComplete: () => {
        zone.view.destroy();
        zone.core.destroy();
      } });
    }
  }

  applySpellZoneTick(zone, spell) {
    const targets = this.enemies.slice().filter((enemy) => enemy.sprite.active
      && Phaser.Math.Distance.Between(zone.x, zone.y, enemy.sprite.x, enemy.sprite.y) <= spell.radius);
    if (zone.type === 'incendiary') {
      targets.forEach((enemy) => this.damageEnemy(enemy, spell.damage, 'incendiary'));
      return;
    }
    targets.forEach((enemy) => {
      const newlySlowed = this.time.now >= (enemy.slowUntil || 0);
      enemy.slowMultiplier = enemy.boss ? spell.bossSlowMultiplier : spell.slowMultiplier;
      enemy.slowUntil = this.time.now + spell.tickMs + 180;
      if (newlySlowed) this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset, '减速', '#a8dce0');
    });
  }

  update(_time, delta) {
    if (this.isEnding || this.isPausedByUser || this.modal) return;
    const seconds = delta / 1000;
    this.gainContinuousSupply(seconds);
    this.updateSpellRuntime(delta);
    this.updateSpellZones(delta);
    this.phaseTime -= seconds;
    if (this.phase === 'wave') {
      this.waveElapsedMs += delta;
      this.spawnFromQueue();
      this.updateEnemies(seconds, delta);
      this.updateWeaponSlots(delta);
      // 普通波清场后立即休整，避免空等倒计时继续获取资源。
      if (gameStore.wave < BALANCE.totalWaves && this.spawnQueue === 0 && this.enemies.length === 0 && this.waveElapsedMs > 750) {
        this.finishWave();
        this.updateHud();
        return;
      }
    }
    if (this.phaseTime <= 0) this.advancePhase();
    this.updateHud();
  }

  gainContinuousSupply(seconds) {
    const rate = BALANCE.supplyPerSecond[gameStore.bedLevel] + (gameStore.room?.supplyRateBonus || 0);
    const amount = rate * seconds;
    gameStore.leaves += amount;
    this.supplyPulseClock += seconds;
    this.supplyPulseAmount += amount;
    if (this.supplyPulseClock >= 10) {
      this.floatText(LAYOUT.supply.x, 746, `持续 +${this.supplyPulseAmount.toFixed(1)}`, '#f0b25f');
      this.supplyPulseClock %= 10;
      this.supplyPulseAmount = 0;
    }
  }

  gainWaveIncome() {
    const amount = BALANCE.bedIncome[gameStore.bedLevel] + (gameStore.room?.incomeBonus || 0);
    gameStore.leaves += amount;
    this.floatText(LAYOUT.supply.x, 746, `运输 +${amount}`, '#f0b25f');
    return amount;
  }

  advancePhase() {
    if (this.phase === 'preparation' || this.phase === 'rest') this.startWave();
    else if (this.phase === 'wave') this.finishWave();
  }

  startWave() {
    this.clearEnemyIntel();
    gameStore.wave += 1;
    const wave = getWaveConfig(gameStore.wave);
    this.phase = 'wave';
    this.phaseTime = wave?.durationSeconds || BALANCE.waveSeconds + gameStore.wave * 2;
    this.spawnEvents = expandWaveSchedule(wave);
    this.spawnQueue = this.spawnEvents.length;
    this.waveElapsedMs = 0;
    this.currentSpawnPhase = null;
    this.messageText.setText('自动火力接敌中').setColor('#8f9693');
    const waveIncome = this.gainWaveIncome();
    const bossWave = gameStore.wave === BALANCE.totalWaves;
    if (bossWave) audioService.bossAlert();
    else audioService.waveAlert();
    this.showBanner(bossWave ? 'BOSS INBOUND' : `WAVE ${gameStore.wave}`, bossWave ? `重型感染体正在接近 · 运输 +${waveIncome}` : `${wave?.preview.headline || '自动防御系统已开火'} · 运输 +${waveIncome}`);
  }

  finishWave() {
    // 波次计时结束后仍要清完场，不能把存活敌人直接删除。
    if (this.spawnQueue > 0 || this.enemies.length > 0) {
      this.phaseTime = 1;
      return;
    }
    if (gameStore.wave >= BALANCE.totalWaves) {
      this.endGame(true);
      return;
    }
    this.clearSpellSelection();
    this.phase = 'rest';
    this.phaseTime = 10;
    this.updateAllLabels();
    const preview = getNextWavePreview(gameStore.wave);
    this.showBanner('RESUPPLY', preview ? `下一波：${preview.summary}` : '准备最终接战');
    if (preview) {
      this.messageText.setText(`敌情：${preview.headline} · ${preview.advice}`).setColor('#d8b47b');
      this.showEnemyIntel(preview);
    }
  }

  spawnFromQueue() {
    while (this.spawnEvents[0]?.atMs <= this.waveElapsedMs) {
      const event = this.spawnEvents.shift();
      this.spawnQueue = this.spawnEvents.length;
      if (event.phase !== this.currentSpawnPhase) {
        this.currentSpawnPhase = event.phase;
        if (event.phase !== 'probe' && event.phase !== 'boss') this.message(`敌潮·${event.phaseLabel}：${WAVE_PHASES[event.phase].radio}`);
      }
      const archetype = getEnemyConfig(event.enemyType);
      const packSize = archetype?.packSize || 1;
      const packCenter = Phaser.Math.Between(-12, 12);
      for (let index = 0; index < packSize; index += 1) {
        const spread = (index - (packSize - 1) / 2) * 18;
        this.spawnEnemy(event.enemyType, Phaser.Math.Clamp(packCenter + spread, -28, 28));
      }
    }
  }

  spawnEnemy(enemyType = 'normal', forcedLaneOffset = null) {
    const boss = enemyType === 'boss';
    const archetype = ENEMY_CATALOG[enemyType] || ENEMY_CATALOG.normal;
    const laneOffset = forcedLaneOffset ?? Phaser.Math.Between(-22, 22);
    const x = LAYOUT.lane.centerX + laneOffset;
    const texture = boss ? 'toy-boss' : archetype?.texture || 'toy-zombie';
    const targetHeight = boss ? 128 : 76 * (archetype?.scaleMultiplier || 1);
    const shadow = this.add.ellipse(x, LAYOUT.lane.spawnY + targetHeight * 0.42, targetHeight * 0.62, targetHeight * 0.16, 0x070a0b, 0.38)
      .setAlpha(0).setDepth(7);
    const sprite = this.add.image(x, LAYOUT.lane.spawnY, texture).setAlpha(0).setDepth(8);
    const targetScale = targetHeight / sprite.height;
    sprite.setScale(targetScale * 0.68);
    const baseHp = boss ? 720 : 32 + gameStore.wave * 26;
    const maxHp = Math.round(baseHp * (archetype?.hpMultiplier || 1));
    // 速度统一由目标旅行时间反算；使用实际接敌线，保证视觉秒数与模拟结果一致。
    const travelSeconds = enemyTravelSeconds(enemyType, gameStore.wave);
    const contactY = LAYOUT.lane.gateY - 18;
    const speed = (contactY - LAYOUT.lane.spawnY) / travelSeconds;
    const barWidth = boss ? 150 : Math.round(65 * Phaser.Math.Clamp(archetype?.scaleMultiplier || 1, 0.76, 1.16));
    const shieldMax = archetype.behavior?.id === 'frontal-shield' ? Math.round(maxHp * archetype.behavior.shieldHpRatio) : 0;
    const enemy = {
      sprite, shadow, shadowOffset: targetHeight * 0.42, maxHp, hp: maxHp, speed, travelSeconds, barWidth, barOffset: targetHeight / 2 + 5,
      armor: archetype?.armor || (enemyType === 'armored' || enemyType === 'shielded' ? 1 : boss ? 2 : 0),
      behavior: archetype.behavior,
      shieldHp: shieldMax,
      shieldMax,
      damage: (boss ? 24 : 4 + gameStore.wave * 2) * (archetype?.damageMultiplier || 1),
      reward: boss ? 60 : Math.max(1, Math.round((5 + gameStore.wave) * (archetype?.rewardMultiplier || 1))),
      attackClock: 0, boss, enemyType,
      barBack: this.add.rectangle(x, 92, barWidth, 6, 0x351f20, 1).setAlpha(0).setDepth(9),
      bar: this.add.rectangle(x - barWidth / 2, 92, barWidth, 6, boss ? PALETTE.red : archetype?.accentColor || 0xb8b49d, 1).setOrigin(0, 0.5).setAlpha(0).setDepth(10),
    };
    if (boss) enemy.bossPhaseState = createBossPhaseState(maxHp);
    if (shieldMax > 0) {
      enemy.shieldBarBack = this.add.rectangle(x, 84, barWidth, 4, 0x17333a, 1).setAlpha(0).setDepth(9);
      enemy.shieldBar = this.add.rectangle(x - barWidth / 2, 84, barWidth, 4, 0x6da4a0, 1).setOrigin(0, 0.5).setAlpha(0).setDepth(10);
    }
    this.enemies.push(enemy);
    this.tweens.add({ targets: [sprite, shadow, enemy.barBack, enemy.bar, enemy.shieldBarBack, enemy.shieldBar].filter(Boolean), alpha: 1, duration: 300 });
    this.tweens.add({ targets: sprite, scale: targetScale, duration: 360, ease: 'Back.Out' });
  }

  updateEnemies(seconds, delta) {
    this.enemies.slice().forEach((enemy) => {
      if (!enemy.sprite.active) return;
      let bossModifiers = { moveSpeedMultiplier: 1, attackIntervalMultiplier: 1 };
      if (enemy.boss) {
        enemy.bossPhaseState = updateBossPhase(enemy.bossPhaseState, enemy.hp, delta);
        bossModifiers = getBossModifiers(enemy.bossPhaseState);
        enemy.bossPhaseState.events.forEach((event) => this.handleBossPhaseEvent(enemy, event));
      }
      if (enemy.sprite.y < LAYOUT.lane.gateY - 18) {
        const speedBoost = this.time.now < (enemy.speedBoostUntil || 0) ? 1.08 : 1;
        const frostSlow = this.time.now < (enemy.slowUntil || 0) ? (enemy.slowMultiplier || 1) : 1;
        enemy.sprite.y += enemy.speed * speedBoost * frostSlow * bossModifiers.moveSpeedMultiplier * seconds;
        enemy.sprite.x += (LAYOUT.lane.centerX + Math.sin((this.time.now + enemy.sprite.x) / 240) * 15 - enemy.sprite.x) * 0.035;
      } else {
        if (enemy.behavior?.id === 'gate-detonation') {
          this.updateBomberFuse(enemy, delta);
        } else {
          enemy.attackClock += delta;
          const attackInterval = (enemy.boss ? 720 : 980) * bossModifiers.attackIntervalMultiplier;
          if (enemy.attackClock >= attackInterval) { enemy.attackClock = 0; this.damageDoor(enemy.damage); }
        }
      }
      if (enemy.behavior?.id === 'support-pulse') this.updateMedicPulse(enemy, delta);
      const barY = enemy.sprite.y - enemy.barOffset;
      const width = enemy.barWidth;
      enemy.shadow.setPosition(enemy.sprite.x, enemy.sprite.y + enemy.shadowOffset);
      enemy.barBack.setPosition(enemy.sprite.x, barY);
      enemy.bar.setPosition(enemy.sprite.x - width / 2, barY);
      if (enemy.shieldBarBack) {
        enemy.shieldBarBack.setPosition(enemy.sprite.x, barY - 7);
        enemy.shieldBar.setPosition(enemy.sprite.x - width / 2, barY - 7);
      }
    });
  }

  handleBossPhaseEvent(enemy, event) {
    if (event.type === 'roar') {
      this.showBanner('BOSS ENRAGED', '重型感染体进入第二阶段 · 移速与攻击频率提升');
      this.cameras.main.shake(260, 0.006);
      enemy.sprite.setTint(0xff5548);
      this.time.delayedCall(220, () => enemy.sprite.active && enemy.sprite.clearTint());
      return;
    }
    if (event.type !== 'shockwave') return;
    const hpAtTelegraph = enemy.hp;
    const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 18, 0x000000, 0)
      .setStrokeStyle(5, PALETTE.red, 0.72).setDepth(14);
    this.tweens.add({ targets: ring, radius: 104, alpha: 0.18, duration: event.telegraphMs, ease: 'Sine.Out' });
    this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset - 10, '冲击波蓄力', '#df7468');
    this.time.delayedCall(event.telegraphMs, () => {
      ring.destroy();
      if (!enemy.sprite.active || enemy.hp <= 0) return;
      const interrupted = hpAtTelegraph - enemy.hp >= enemy.maxHp * 0.05;
      if (interrupted) {
        this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset - 10, '已打断', '#f0b25f');
        return;
      }
      const blast = this.add.circle(enemy.sprite.x, enemy.sprite.y, 24, 0x000000, 0)
        .setStrokeStyle(8, PALETTE.red, 0.82).setDepth(13);
      this.tweens.add({ targets: blast, radius: 250, alpha: 0, duration: 380, onComplete: () => blast.destroy() });
      this.damageDoor(Math.max(6, enemy.damage * 0.35));
      this.message('Boss冲击波命中闸门 · 5%最大生命伤害可打断');
    });
  }

  updateBomberFuse(enemy, delta) {
    if (!enemy.detonating) {
      enemy.detonating = true;
      enemy.fuseRemaining = enemy.behavior.fuseMs;
      this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset, '引爆！', '#df5d50');
    }
    enemy.fuseRemaining -= delta;
    enemy.sprite.setTint(Math.floor(enemy.fuseRemaining / 100) % 2 === 0 ? 0xff6759 : 0xffffff);
    if (enemy.fuseRemaining > 0) return;
    enemy.sprite.clearTint();
    this.damageDoor(enemy.damage);
    this.createExplosion(enemy.sprite.x, enemy.sprite.y, 48);
    this.removeEnemyWithoutReward(enemy);
  }

  updateMedicPulse(enemy, delta) {
    enemy.supportClock = (enemy.supportClock || 0) + delta;
    if (enemy.supportClock < enemy.behavior.pulseMs) return;
    enemy.supportClock = 0;
    const allies = this.enemies.filter((ally) => ally !== enemy && !ally.boss && ally.sprite.active
      && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, ally.sprite.x, ally.sprite.y) <= enemy.behavior.radiusPx);
    if (allies.length === 0) return;
    allies.forEach((ally) => {
      ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * enemy.behavior.healRatio);
      ally.bar.displayWidth = ally.barWidth * Math.max(0, ally.hp / ally.maxHp);
      ally.speedBoostUntil = this.time.now + enemy.behavior.pulseMs * 0.75;
    });
    const pulse = this.add.circle(enemy.sprite.x, enemy.sprite.y, 10, 0x000000, 0).setStrokeStyle(3, 0xded9b8, 0.72).setDepth(11);
    this.tweens.add({ targets: pulse, radius: enemy.behavior.radiusPx, alpha: 0, duration: 420, onComplete: () => pulse.destroy() });
    this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset, `治疗 ${allies.length}`, '#d9ddaa');
  }

  damageDoor(amount) {
    gameStore.doorHp = Math.max(0, gameStore.doorHp - amount);
    audioService.hit();
    this.cameras.main.shake(85, 0.004);
    this.doorPanel.setFillStyle(0x8c302e, 0.45);
    this.time.delayedCall(90, () => this.doorPanel.active && this.doorPanel.setFillStyle(0x30393a, 0.08));
    if (gameStore.doorHp <= 0) this.endGame(false);
    this.updateAllLabels();
  }

  updateWeaponSlots(delta) {
    if (this.enemies.length === 0) return;
    const modifiers = combatUpgradeModifiers(this.combatProgress.upgrades);
    gameStore.weaponSlots.forEach((slot, index) => {
      const stats = towerStats(slot);
      if (!stats) return;
      const runtime = this.weaponRuntime[index];
      runtime.attackClock += delta;
      if (runtime.attackClock < stats.cadence * this.towerCadenceMultiplier(index)) return;
      runtime.attackClock = 0;

      const target = this.selectTowerTargets(slot, 1).targets[0];
      const damage = stats.power * modifiers.damageMultiplier;
      if (slot.type === 'machineGun') {
        this.fireMachineGun(index, target, damage);
        runtime.shots += 1;
        if (runtime.shots >= stats.payload) {
          runtime.shots = 0;
          runtime.attackClock = -TOWER_CATALOG.machineGun.reloadMs;
        }
      } else if (slot.type === 'mortar') {
        for (let shell = 0; shell < stats.payload; shell += 1) {
          this.time.delayedCall(shell * 165, () => {
            const liveTarget = this.selectTowerTargets(slot, 1).targets[0];
            if (liveTarget) this.fireMortar(index, liveTarget, damage, TOWER_CATALOG.mortar.blastRadius);
          });
        }
      } else if (slot.type === 'sniper') {
        this.fireSniper(index, damage, stats.payload);
      } else if (slot.type === 'flamethrower') {
        this.fireFlamethrower(index, damage, stats.payload, TOWER_CATALOG.flamethrower.behavior.rangePx);
      } else if (slot.type === 'grenadeLauncher') {
        for (let shell = 0; shell < stats.payload; shell += 1) {
          this.time.delayedCall(shell * TOWER_CATALOG.grenadeLauncher.behavior.burstGapMs, () => {
            const liveTarget = this.selectTowerTargets(slot, 1).targets[0];
            if (liveTarget) this.fireGrenade(index, liveTarget, damage, TOWER_CATALOG.grenadeLauncher.behavior.blastRadiusPx);
          });
        }
      } else if (slot.type === 'antiArmorRocket') {
        const armoredTarget = this.selectTowerTargets(slot, 1).targets[0];
        if (armoredTarget) this.fireRocket(index, armoredTarget, damage, stats.payload);
      }

      if (target && modifiers.barrageEvery > 0) {
        runtime.volleyClock = (runtime.volleyClock || 0) + 1;
        if (runtime.volleyClock >= modifiers.barrageEvery) {
          runtime.volleyClock = 0;
          this.time.delayedCall(110, () => this.fireBonusVolley(slot, index, damage, stats));
        }
      }
    });
  }

  fireBonusVolley(slot, slotIndex, damage, stats) {
    if (this.isEnding || !slot?.type) return;
    const target = this.selectTowerTargets(slot, 1).targets[0];
    if (!target) return;
    const position = LAYOUT.facilities[slotIndex];
    this.floatText(position.x, position.y - 42, '齐射', '#f0b25f');
    if (slot.type === 'machineGun') this.fireMachineGun(slotIndex, target, damage);
    else if (slot.type === 'mortar') this.fireMortar(slotIndex, target, damage, TOWER_CATALOG.mortar.blastRadius);
    else if (slot.type === 'sniper') this.fireSniper(slotIndex, damage, stats.payload);
    else if (slot.type === 'flamethrower') this.fireFlamethrower(slotIndex, damage, stats.payload, TOWER_CATALOG.flamethrower.behavior.rangePx);
    else if (slot.type === 'grenadeLauncher') this.fireGrenade(slotIndex, target, damage, TOWER_CATALOG.grenadeLauncher.behavior.blastRadiusPx);
    else if (slot.type === 'antiArmorRocket') this.fireRocket(slotIndex, target, damage, stats.payload);
  }

  towerCadenceMultiplier(slotIndex) {
    const position = LAYOUT.facilities[slotIndex];
    const poisoned = this.toxicClouds.some((cloud) => (
      Phaser.Math.Distance.Between(position.x, position.y, cloud.x, cloud.y) <= cloud.radius + 80
    ));
    const upgradeMultiplier = combatUpgradeModifiers(this.combatProgress.upgrades).cadenceMultiplier;
    return (poisoned ? 1.25 : 1) * upgradeMultiplier;
  }

  frontEnemies(count) {
    return selectTargets(this.enemies, 'nearestGate', count, {
      gate: { x: LAYOUT.lane.centerX, y: LAYOUT.lane.gateY },
    }).targets;
  }

  selectTowerTargets(slot, count = 1) {
    const mode = TARGET_MODES.includes(slot?.targetMode) ? slot.targetMode : DEFAULT_TARGET_MODES[slot?.type] || 'nearestGate';
    return selectTargets(this.enemies, mode, count, {
      gate: { x: LAYOUT.lane.centerX, y: LAYOUT.lane.gateY },
      radius: TOWER_CATALOG[slot?.type]?.blastRadius || TOWER_CATALOG[slot?.type]?.behavior?.blastRadiusPx || 58,
    });
  }

  towerMuzzleOrigin(slotIndex) {
    const position = LAYOUT.facilities[slotIndex];
    return { x: position.x, y: position.y - 30 };
  }

  fireMachineGun(slotIndex, enemy, damage) {
    if (!enemy?.sprite.active) return;
    const origin = this.towerMuzzleOrigin(slotIndex);
    this.createMuzzleFlash(slotIndex, 0.78);
    this.createShotStreak(origin.x, origin.y, enemy.sprite.x, enemy.sprite.y, PALETTE.orange, 88);
    const tracer = this.add.image(origin.x, origin.y, 'tracer').setDepth(12);
    audioService.machineGun();
    this.tweens.add({ targets: tracer, x: enemy.sprite.x, y: enemy.sprite.y, duration: 115, onComplete: () => { tracer.destroy(); this.damageEnemy(enemy, damage, 'machineGun'); } });
  }

  fireMortar(slotIndex, target, damage, radius) {
    if (!target?.sprite.active) return;
    const origin = this.towerMuzzleOrigin(slotIndex);
    const impactX = target.sprite.x;
    const impactY = target.sprite.y;
    this.createMuzzleFlash(slotIndex, 0.95);
    const reticle = this.add.circle(impactX, impactY, Math.max(18, radius * 0.45), 0x000000, 0)
      .setStrokeStyle(2, PALETTE.orange, 0.46).setDepth(7);
    const shell = this.add.circle(origin.x, origin.y, 5, 0x1b1f20, 1).setDepth(12);
    audioService.mortarLaunch();
    const flight = { progress: 0 };
    const startX = origin.x;
    const startY = origin.y;
    const controlX = (startX + impactX) / 2;
    const controlY = Math.min(startY, impactY) - 118;
    // 二次曲线只改变炮弹视觉轨迹，命中时机、范围和伤害保持原值。
    this.tweens.add({ targets: flight, progress: 1, duration: 420, ease: 'Linear', onUpdate: () => {
      const t = flight.progress;
      const inv = 1 - t;
      shell.setPosition(
        inv * inv * startX + 2 * inv * t * controlX + t * t * impactX,
        inv * inv * startY + 2 * inv * t * controlY + t * t * impactY,
      );
      reticle.setAlpha(0.24 + t * 0.38).setScale(0.82 + t * 0.18);
    }, onComplete: () => {
      shell.destroy();
      reticle.destroy();
      this.createExplosion(impactX, impactY, radius);
      this.enemies.slice().forEach((enemy) => {
        if (Phaser.Math.Distance.Between(impactX, impactY, enemy.sprite.x, enemy.sprite.y) <= radius) this.damageEnemy(enemy, damage, 'mortar');
      });
    } });
  }

  fireSniper(slotIndex, damage, penetration) {
    const targets = this.frontEnemies(penetration);
    if (targets.length === 0) return;
    const origin = this.towerMuzzleOrigin(slotIndex);
    const lastTarget = targets[targets.length - 1];
    this.createMuzzleFlash(slotIndex, 1.28);
    const tracer = this.add.graphics().setDepth(12);
    tracer.lineStyle(8, PALETTE.orange, 0.16);
    tracer.lineBetween(origin.x, origin.y, lastTarget.sprite.x, lastTarget.sprite.y);
    tracer.lineStyle(2, 0xffedbd, 0.98);
    tracer.lineBetween(origin.x, origin.y, lastTarget.sprite.x, lastTarget.sprite.y);
    audioService.sniper();
    targets.forEach((enemy) => {
      const impact = this.add.circle(enemy.sprite.x, enemy.sprite.y, 5, 0x000000, 0)
        .setStrokeStyle(2, 0xffedbd, 0.9).setDepth(13);
      this.tweens.add({ targets: impact, radius: 15, alpha: 0, duration: 170, onComplete: () => impact.destroy() });
      this.damageEnemy(enemy, damage, 'sniper');
    });
    this.tweens.add({ targets: tracer, alpha: 0, duration: 150, onComplete: () => tracer.destroy() });
  }

  fireFlamethrower(slotIndex, damage, maxTargets, rangePx) {
    const origin = this.towerMuzzleOrigin(slotIndex);
    const targets = this.enemies
      .filter((enemy) => enemy.sprite.active && Phaser.Math.Distance.Between(origin.x, origin.y, enemy.sprite.x, enemy.sprite.y) <= rangePx)
      .sort((a, b) => b.sprite.y - a.sprite.y)
      .slice(0, maxTargets);
    if (targets.length === 0) return;
    this.createMuzzleFlash(slotIndex, 0.7);
    targets.forEach((enemy, targetIndex) => {
      const flame = this.add.graphics().setDepth(12);
      flame.lineStyle(12, PALETTE.orange, 0.15);
      flame.lineBetween(origin.x, origin.y, enemy.sprite.x, enemy.sprite.y);
      flame.lineStyle(4, 0xffd17b, 0.76 - targetIndex * 0.05);
      flame.lineBetween(origin.x, origin.y, enemy.sprite.x, enemy.sprite.y);
      this.damageEnemy(enemy, damage, 'flamethrower');
      this.tweens.add({ targets: flame, alpha: 0, duration: 130, onComplete: () => flame.destroy() });
    });
  }

  fireGrenade(slotIndex, target, damage, radius) {
    if (!target?.sprite.active) return;
    const origin = this.towerMuzzleOrigin(slotIndex);
    const impactX = target.sprite.x;
    const impactY = target.sprite.y;
    const grenade = this.add.circle(origin.x, origin.y, 5, 0x343a32, 1).setStrokeStyle(2, PALETTE.sand, 0.8).setDepth(12);
    this.createMuzzleFlash(slotIndex, 0.72);
    this.tweens.add({ targets: grenade, x: impactX, y: impactY, duration: 280, ease: 'Quad.Out', onComplete: () => {
      grenade.destroy();
      this.createExplosion(impactX, impactY, radius);
      this.enemies.slice().forEach((enemy) => {
        if (Phaser.Math.Distance.Between(impactX, impactY, enemy.sprite.x, enemy.sprite.y) <= radius) this.damageEnemy(enemy, damage, 'grenadeLauncher');
      });
    } });
  }

  fireRocket(slotIndex, enemy, damage, armorIgnore) {
    if (!enemy?.sprite.active) return;
    const origin = this.towerMuzzleOrigin(slotIndex);
    const rocket = this.add.rectangle(origin.x, origin.y, 7, 19, 0x30383a, 1)
      .setStrokeStyle(2, PALETTE.orange, 0.9).setDepth(12);
    const trail = this.add.graphics().setDepth(11);
    trail.lineStyle(7, 0xd8d0bf, 0.18).lineBetween(origin.x, origin.y, enemy.sprite.x, enemy.sprite.y);
    trail.lineStyle(2, PALETTE.orange, 0.56).lineBetween(origin.x, origin.y, enemy.sprite.x, enemy.sprite.y);
    this.createMuzzleFlash(slotIndex, 1.05);
    this.tweens.add({ targets: rocket, x: enemy.sprite.x, y: enemy.sprite.y, duration: 420, ease: 'Sine.In', onComplete: () => {
      rocket.destroy();
      trail.destroy();
      if (!enemy.sprite.active) return;
      this.createExplosion(enemy.sprite.x, enemy.sprite.y, 32);
      this.damageEnemy(enemy, damage, 'antiArmorRocket', { armorBreak: armorIgnore });
    } });
    this.tweens.add({ targets: trail, alpha: 0, duration: 430 });
  }

  createMuzzleFlash(slotIndex, strength = 1) {
    const origin = this.towerMuzzleOrigin(slotIndex);
    const flash = this.add.circle(origin.x, origin.y, 6 * strength, 0xffe09b, 0.98)
      .setStrokeStyle(4, PALETTE.orange, 0.55).setDepth(14);
    this.tweens.add({ targets: flash, radius: 17 * strength, alpha: 0, duration: 95, onComplete: () => flash.destroy() });

    const icon = this.facilityPanels[slotIndex]?.icon;
    if (!icon?.visible) return;
    const restingY = LAYOUT.facilities[slotIndex].y;
    this.tweens.add({ targets: icon, y: restingY + 4 * strength, duration: 38, yoyo: true, onComplete: () => { if (icon.active) icon.y = restingY; } });
  }

  createShotStreak(startX, startY, endX, endY, color, duration) {
    const streak = this.add.graphics().setDepth(11);
    streak.lineStyle(6, color, 0.16);
    streak.lineBetween(startX, startY, endX, endY);
    streak.lineStyle(1, 0xfff0c4, 0.88);
    streak.lineBetween(startX, startY, endX, endY);
    this.tweens.add({ targets: streak, alpha: 0, duration, onComplete: () => streak.destroy() });
  }

  createExplosion(x, y, radius = 42) {
    audioService.mortarImpact();
    const flash = this.add.circle(x, y, 7, 0xfff0c4, 0.98).setDepth(15);
    const blast = this.add.circle(x, y, 10, PALETTE.orange, 0.85).setDepth(13);
    blast.setStrokeStyle(5, 0xffd18c, 0.8);
    const ring = this.add.circle(x, y, 14, 0x000000, 0).setStrokeStyle(3, 0xffc36d, 0.72).setDepth(14);
    this.tweens.add({ targets: flash, radius: radius * 0.44, alpha: 0, duration: 120, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: blast, radius, alpha: 0, duration: 260, onComplete: () => blast.destroy() });
    this.tweens.add({ targets: ring, radius: radius * 1.18, alpha: 0, duration: 330, onComplete: () => ring.destroy() });
    for (let piece = 0; piece < 7; piece += 1) {
      const angle = (Math.PI * 2 * piece) / 7 + 0.35;
      const dust = this.add.circle(x, y, 3 + (piece % 4), piece % 3 === 0 ? 0x3a3f3d : 0x8d6745, 0.8).setDepth(12);
      this.tweens.add({ targets: dust, x: x + Math.cos(angle) * radius * 0.72, y: y + Math.sin(angle) * radius * 0.48, scale: 0.45, alpha: 0, duration: 360, onComplete: () => dust.destroy() });
    }
    this.cameras.main.shake(70, 0.0025);
  }

  damageEnemy(enemy, amount, attackType = null, status = {}) {
    if (!enemy?.sprite.active) return;
    const defenseProfile = DEFENSE_PROFILES[enemy.enemyType] || DEFENSE_PROFILES.normal;
    const result = attackType
      ? calculateDamage(amount, ATTACK_PROFILES[attackType], defenseProfile, status)
      : { damage: amount, effectiveness: 'neutral' };
    let appliedDamage = result.damage;
    const directFire = ['machineGun', 'sniper', 'antiArmorRocket'].includes(attackType);
    if (directFire && enemy.shieldHp > 0) {
      const blocked = Math.min(appliedDamage * (enemy.behavior?.frontalReduction || 0.55), enemy.shieldHp);
      enemy.shieldHp = Math.max(0, enemy.shieldHp - appliedDamage);
      appliedDamage -= blocked;
      if (enemy.shieldBar) enemy.shieldBar.displayWidth = enemy.barWidth * (enemy.shieldHp / enemy.shieldMax);
      if (enemy.shieldHp <= 0) {
        this.tweens.add({ targets: [enemy.shieldBar, enemy.shieldBarBack], alpha: 0, duration: 140, onComplete: () => {
          enemy.shieldBar?.destroy(); enemy.shieldBarBack?.destroy(); enemy.shieldBar = null; enemy.shieldBarBack = null;
        } });
        this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset - 8, '破盾', '#75bbb5');
      }
    }
    enemy.hp -= appliedDamage;
    enemy.bar.displayWidth = enemy.barWidth * Math.max(0, enemy.hp / enemy.maxHp);
    // Phaser 4 使用显式填充模式，保持受击闪白同时避免旧 API 的控制台警告。
    enemy.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(45, () => enemy.sprite.active && enemy.sprite.clearTint());
    if (result.effectiveness !== 'neutral' && this.time.now - (enemy.lastEffectTextAt || 0) > 650) {
      enemy.lastEffectTextAt = this.time.now;
      this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.barOffset - 7, result.effectiveness === 'advantage' ? '克制' : '抵抗', result.effectiveness === 'advantage' ? '#f0b25f' : '#8faaa4');
    }
    audioService.enemyHit();
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index === -1) return;
    this.enemies.splice(index, 1);
    gameStore.kills += 1;
    gameStore.leaves += enemy.reward;
    gameStore.colorRestored = Math.min(100, gameStore.colorRestored + (enemy.boss ? 25 : 4));
    this.addCombatXp(enemy.enemyType);
    audioService.enemyKill();
    if (enemy.boss) audioService.reward();
    if (enemy.behavior?.id === 'death-cloud') this.createToxicCloud(enemy);
    this.destroyEnemy(enemy, true);
    this.updateAllLabels();
    if (enemy.boss) this.time.delayedCall(650, () => this.endGame(true));
  }

  destroyEnemy(enemy, rewardAnimation) {
    if (!enemy.sprite.active) return;
    enemy.barBack.destroy(); enemy.bar.destroy();
    enemy.shadow?.destroy();
    enemy.shieldBarBack?.destroy(); enemy.shieldBar?.destroy();
    // 按角色当前比例缩放，避免高分辨率素材在死亡动画中突然放大数倍。
    const targetScale = enemy.sprite.scaleX * (rewardAnimation ? 1.12 : 0.72);
    this.tweens.add({ targets: enemy.sprite, alpha: 0, scale: targetScale, duration: 240, onComplete: () => enemy.sprite.destroy() });
  }

  removeEnemyWithoutReward(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index === -1) return;
    this.enemies.splice(index, 1);
    this.destroyEnemy(enemy, false);
  }

  createToxicCloud(enemy) {
    const radius = enemy.behavior.radiusPx;
    const cloud = {
      x: enemy.sprite.x,
      y: enemy.sprite.y,
      radius,
      view: this.add.circle(enemy.sprite.x, enemy.sprite.y, radius, 0x7f993f, 0.2)
        .setStrokeStyle(3, 0xb9c946, 0.42).setDepth(6),
    };
    this.toxicClouds.push(cloud);
    this.tweens.add({ targets: cloud.view, alpha: 0.08, scale: 1.12, duration: enemy.behavior.durationMs, ease: 'Sine.InOut' });
    this.time.delayedCall(enemy.behavior.durationMs, () => {
      const index = this.toxicClouds.indexOf(cloud);
      if (index >= 0) this.toxicClouds.splice(index, 1);
      cloud.view?.destroy();
    });
  }

  addCombatXp(enemyType) {
    const gained = combatXpReward(enemyType);
    if (gained <= 0) return;
    this.combatProgress.xp += gained;
    let leveledUp = false;
    while (this.combatProgress.xp >= combatXpThreshold(this.combatProgress.level)) {
      this.combatProgress.xp -= combatXpThreshold(this.combatProgress.level);
      this.combatProgress.level += 1;
      this.combatProgress.pendingChoices += 1;
      leveledUp = true;
    }
    this.updateHud();
    if (leveledUp && !this.modal) this.openCombatUpgrade();
  }

  openCombatUpgrade() {
    if (this.modal || this.isEnding || this.combatProgress.pendingChoices <= 0) return;
    const choices = chooseCombatUpgradeIds(this.combatProgress.upgrades, 3);
    if (choices.length === 0) {
      this.combatProgress.pendingChoices = 0;
      return;
    }
    this.combatProgress.pendingChoices -= 1;
    const choiceLevel = this.combatProgress.level - this.combatProgress.pendingChoices;
    const shade = this.add.rectangle(270, 480, 540, 960, 0x080b0c, 0.78).setDepth(80).setInteractive();
    const panel = this.add.rectangle(270, 421, 518, 548, 0x171c1f, 0.98)
      .setStrokeStyle(2, PALETTE.sand, 0.7).setDepth(81);
    const panelStripe = this.add.rectangle(270, 149, 518, 6, PALETTE.orange, 0.9).setDepth(82);
    const title = this.add.text(270, 175, `COMBAT LEVEL ${choiceLevel}`, {
      fontFamily: 'Arial Narrow, Microsoft YaHei', fontSize: '27px', color: '#f1eadc', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(83);
    const subtitle = this.add.text(270, 210, '选择一项战地命令 · 选择后立即生效', {
      fontFamily: FONT_BODY, fontSize: '12px', color: '#aeb5b1',
    }).setOrigin(0.5).setDepth(83);
    const objects = [shade, panel, panelStripe, title, subtitle];

    const cardXs = choices.length === 3 ? [103, 270, 437] : choices.map((_, index) => 270 + (index - (choices.length - 1) / 2) * 167);
    choices.forEach((id, index) => {
      const upgrade = COMBAT_UPGRADES[id];
      const level = this.combatProgress.upgrades[id];
      const x = cardXs[index];
      const card = this.add.rectangle(x, 421, 148, 342, 0x2a3132, 1)
        .setStrokeStyle(3, upgrade.color, 0.9).setDepth(82).setInteractive({ useHandCursor: true });
      card.upgradeId = id;
      const tape = this.add.rectangle(x, 254, 148, 8, upgrade.color, 0.96).setDepth(83);
      const codeRing = this.add.circle(x, 336, 38, 0x293033, 1).setStrokeStyle(4, upgrade.color, 0.9).setDepth(83);
      const code = this.add.text(x, 336, upgrade.code, {
        fontFamily: 'Arial Narrow, Arial', fontSize: '24px', color: '#f1eadc', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(84);
      const name = this.add.text(x, 395, upgrade.name, {
        fontFamily: 'Bahnschrift Condensed, Microsoft YaHei', fontSize: '16px', color: '#f0eadc', fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5).setDepth(84);
      const description = this.add.text(x, 452, upgrade.description, {
        fontFamily: FONT_BODY, fontSize: '11px', color: '#aeb5b1', align: 'center',
        wordWrap: { width: 120 }, lineSpacing: 4,
      }).setOrigin(0.5).setDepth(84);
      const levelCopy = this.add.text(x, 523, id === 'fieldSupport' ? `已呼叫 ${level} 次` : `Lv.${level}  →  Lv.${level + 1}`, {
        fontFamily: 'Bahnschrift Condensed, Microsoft YaHei', fontSize: '12px', color: '#c7b38c', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(84);
      const action = this.add.text(x, 568, '执行命令', {
        fontFamily: FONT_BODY, fontSize: '12px', color: '#f0eadc', fontStyle: 'bold',
        backgroundColor: '#4e5b3a', padding: { x: 12, y: 5 },
      }).setOrigin(0.5).setDepth(84);
      card.on('pointerover', () => card.setFillStyle(0x3a4440, 1));
      card.on('pointerout', () => card.setFillStyle(0x2a3132, 1));
      card.on('pointerdown', () => this.tweens.add({ targets: [card, codeRing, code, name, description, levelCopy, action], scale: 0.98, duration: 55, yoyo: true }));
      card.on('pointerup', () => this.applyCombatUpgrade(id));
      objects.push(card, tape, codeRing, code, name, description, levelCopy, action);
    });
    const footer = this.add.text(270, 646, '战场已冻结 · 此次选择不消耗补给', {
      fontFamily: FONT_BODY, fontSize: '11px', color: '#c7b38c', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(83);
    objects.push(footer);
    this.setModal(objects);
  }

  applyCombatUpgrade(id) {
    const upgrade = COMBAT_UPGRADES[id];
    const currentLevel = this.combatProgress.upgrades[id] || 0;
    if (!upgrade || currentLevel >= upgrade.maxLevel) return;
    this.combatProgress.upgrades[id] = currentLevel + 1;
    if (id === 'fieldSupport') {
      gameStore.leaves += 18;
      gameStore.doorHp = Math.min(this.maxDoorHp(), gameStore.doorHp + this.maxDoorHp() * 0.15);
    }
    audioService.reward();
    this.closeModal();
    this.updateAllLabels();
    if (this.combatProgress.pendingChoices > 0) {
      this.openCombatUpgrade();
      return;
    }
    this.showBanner('FIELD UPGRADE', `${upgrade.name} Lv.${this.combatProgress.upgrades[id]} 已生效`);
    this.message(`${upgrade.name} 已执行`);
  }

  openUpgrade(type, index = -1) {
    if (this.modal || this.isEnding) return;
    const level = type === 'bed' ? gameStore.bedLevel : gameStore.doorLevel;
    const maxLevel = type === 'bed' ? 4 : 5;
    const nextLevel = level + 1;
    const name = type === 'bed' ? '补给站' : '基地闸门';
    const isMax = level >= maxLevel;
    const cost = isMax ? 0 : type === 'bed' ? BALANCE.bedCosts[nextLevel] : BALANCE.doorCosts[nextLevel];
    // 补给站只在休整期按已完成波次逐级开放，避免第一波内滚雪球升满。
    const isLocked = type === 'bed' && !isMax && (this.phase !== 'rest' || gameStore.wave < nextLevel - 1);
    const lockCopy = gameStore.wave < nextLevel - 1 ? `完成第 ${nextLevel - 1} 波后解锁` : '仅休整阶段可升级';

    const shade = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.6).setDepth(80).setInteractive();
    const panel = this.add.rectangle(270, 512, 414, 320, 0x23292b, 0.99).setStrokeStyle(2, PALETTE.sand, 0.72).setDepth(81);
    const stripe = this.add.rectangle(270, 354, 414, 6, type === 'bed' ? PALETTE.orange : PALETTE.red, 0.88).setDepth(82);
    const facilityIcon = this.add.image(132, 438, type === 'bed' ? 'supply-depot' : 'deployment-pad').setDepth(82);
    facilityIcon.setScale(92 / Math.max(facilityIcon.width, facilityIcon.height));
    const title = this.add.text(315, 390, name, { fontFamily: 'Bahnschrift Condensed, Microsoft YaHei', fontSize: '28px', color: '#e9e3d5', fontStyle: 'bold' }).setOrigin(0.5).setDepth(82);
    const copy = this.add.text(315, 446, `${this.upgradeDescription(type, index, level)}\n当前等级 ${level}${isMax ? ' · 已满级' : ` → ${nextLevel}`}`, { fontFamily: FONT_BODY, fontSize: '13px', color: '#b9bfbb', align: 'center', lineSpacing: 8 }).setOrigin(0.5).setDepth(82);
    const notice = this.add.text(270, 577, isMax ? '设施已达到最高等级' : isLocked ? lockCopy : `当前库存 ${Math.floor(gameStore.leaves)} 补给`, {
      fontFamily: FONT_BODY, fontSize: '13px', color: isMax || isLocked || gameStore.leaves >= cost ? '#9fa6a2' : '#df7468', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(83);
    const buy = addButton(this, 270, 535, 250, 57, isMax ? '已满级' : isLocked ? '尚未解锁' : `升级 · ${cost} 补给`, () => {
      if (isMax || isLocked) return;
      if (gameStore.leaves < cost) {
        notice.setText(`补给不足 · 还差 ${cost - Math.floor(gameStore.leaves)}`).setColor('#df7468');
        return;
      }
      gameStore.leaves -= cost;
      if (type === 'bed') gameStore.bedLevel += 1;
      else { gameStore.doorLevel += 1; gameStore.doorHp = this.maxDoorHp(); }
      audioService.buy();
      this.closeModal();
      this.updateAllLabels();
      this.message(`${name} 已升级`);
    }, { fill: PALETTE.olive, hoverFill: 0x66734c, stroke: PALETTE.orange, fontSize: '16px' });
    buy.panel.setDepth(82); buy.text.setDepth(83); buy.setEnabled(!isMax && !isLocked);
    const close = addButton(this, 270, 625, 166, 54, '返回战场', () => this.closeModal(), { fill: 0x303638, stroke: 0x737b77, fontSize: '14px', color: '#c5cbc7' });
    close.panel.setDepth(82); close.text.setDepth(83);
    this.setModal([shade, panel, stripe, facilityIcon, title, copy, notice, buy.panel, buy.text, close.panel, close.text]);
  }

  upgradeDescription(type, _index, level) {
    if (type === 'bed') return `持续 ${BALANCE.supplyPerSecond[level].toFixed(2)}/秒 · 每波运输 ${BALANCE.bedIncome[level]}`;
    return `耐久上限 ${this.maxDoorHp()} · 升级后回满`;
  }

  openWeaponSlot(index) {
    if (this.modal || this.isEnding) return;
    if (gameStore.weaponSlots[index].type) this.openWeaponUpgrade(index);
    else this.openBuildMenu(index);
  }

  openBuildMenu(index) {
    const objects = [];
    const shade = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.66).setDepth(80).setInteractive();
    const panel = this.add.rectangle(270, 478, 500, 710, 0x202629, 0.995).setStrokeStyle(2, PALETTE.sand, 0.78).setDepth(81);
    const headerStripe = this.add.rectangle(270, 125, 500, 6, PALETTE.orange, 0.9).setDepth(82);
    const title = this.add.text(270, 147, `武器位 ${index + 1} · 选择炮塔`, { fontFamily: 'Arial Narrow, Microsoft YaHei', fontSize: '25px', color: '#e9e3d5', fontStyle: 'bold' }).setOrigin(0.5).setDepth(82);
    const copy = this.add.text(270, 181, '六种火力定位 · 每座炮塔有三条五级强化线', { fontFamily: FONT_BODY, fontSize: '12px', color: '#a9b0ad' }).setOrigin(0.5).setDepth(82);
    objects.push(shade, panel, headerStripe, title, copy);

    Object.entries(TOWER_CATALOG).forEach(([type, tower], cardIndex) => {
      const column = cardIndex % 2;
      const rowIndex = Math.floor(cardIndex / 2);
      const x = 145 + column * 250;
      const y = 292 + rowIndex * 171;
      const card = this.add.rectangle(x, y, 224, 150, 0x2b3233, 0.985).setStrokeStyle(1.2, PALETTE.sand, 0.5).setDepth(82).setInteractive({ useHandCursor: true });
      const cardStripe = this.add.rectangle(x - 109, y, 5, 150, PALETTE.orange, 0.68).setDepth(83);
      const icon = this.add.image(x - 69, y - 30, tower.texture).setDepth(83);
      icon.setScale(72 / Math.max(icon.width, icon.height));
      const name = this.add.text(x - 31, y - 61, `${tower.code}\n${tower.name}`, { fontFamily: 'Arial Narrow, Microsoft YaHei', fontSize: '15px', color: '#f0eadc', fontStyle: 'bold', lineSpacing: 3 }).setDepth(83);
      const role = this.add.text(x - 99, y + 24, tower.role, { fontFamily: FONT_BODY, fontSize: '11px', color: '#d69b58' }).setDepth(83);
      const description = this.add.text(x - 99, y + 47, tower.description, { fontFamily: FONT_BODY, fontSize: '10px', color: '#aeb5b1', wordWrap: { width: 188 } }).setDepth(83);
      const price = this.add.text(x + 96, y - 61, `${tower.buildCost}`, { fontFamily: 'Arial Narrow, Arial', fontSize: '17px', color: gameStore.leaves >= tower.buildCost ? '#f0b25f' : '#c96a61', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(83);
      card.on('pointerover', () => card.setFillStyle(PALETTE.olive, 1).setStrokeStyle(2, PALETTE.orange, 0.92));
      card.on('pointerout', () => card.setFillStyle(0x2b3233, 0.985).setStrokeStyle(1.2, PALETTE.sand, 0.5));
      card.on('pointerup', () => this.buildWeapon(index, type));
      objects.push(card, cardStripe, icon, name, role, description, price);
    });

    const close = addButton(this, 270, 817, 168, 54, '返回战场', () => this.closeModal(), { fill: 0x303638, stroke: 0x737b77, fontSize: '14px', color: '#c5cbc7' });
    close.panel.setDepth(82); close.text.setDepth(83);
    objects.push(close.panel, close.text);
    this.setModal(objects);
  }

  buildWeapon(index, type) {
    const tower = TOWER_CATALOG[type];
    if (gameStore.leaves < tower.buildCost) {
      this.closeModal();
      this.message(`补给不足 · ${tower.name}需要 ${tower.buildCost}`);
      return;
    }
    gameStore.leaves -= tower.buildCost;
    gameStore.weaponSlots[index] = {
      type,
      upgrades: { power: 0, cadence: 0, payload: 0 },
      targetMode: DEFAULT_TARGET_MODES[type] || 'nearestGate',
    };
    this.weaponRuntime[index] = { attackClock: 0, shots: 0, volleyClock: 0 };
    gameStore.turrets[index] = 1;
    audioService.buy();
    this.closeModal();
    this.updateAllLabels();
    this.message(`${tower.name} 已部署到武器位 ${index + 1}`);
  }

  openWeaponUpgrade(index) {
    const slot = gameStore.weaponSlots[index];
    const tower = TOWER_CATALOG[slot.type];
    const resale = getTowerResaleQuote(slot, this.phase);
    const objects = [];
    const shade = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.66).setDepth(80).setInteractive();
    const panel = this.add.rectangle(270, 478, 430, 710, 0x202629, 0.995).setStrokeStyle(2, PALETTE.sand, 0.78).setDepth(81);
    const headerStripe = this.add.rectangle(270, 125, 430, 6, PALETTE.orange, 0.9).setDepth(82);
    const icon = this.add.image(142, 276, tower.texture).setDepth(82);
    icon.setScale(108 / Math.max(icon.width, icon.height));
    const title = this.add.text(194, 248, `${tower.code}  ${tower.name}`, { fontFamily: 'Arial Narrow, Microsoft YaHei', fontSize: '25px', color: '#e9e3d5', fontStyle: 'bold' }).setDepth(82);
    const role = this.add.text(194, 282, tower.role, { fontFamily: FONT_BODY, fontSize: '12px', color: '#d69b58' }).setDepth(82);
    objects.push(shade, panel, headerStripe, icon, title, role);

    if (!TARGET_MODES.includes(slot.targetMode)) slot.targetMode = DEFAULT_TARGET_MODES[slot.type] || 'nearestGate';
    let targetButton;
    targetButton = addButton(this, 270, 330, 286, 46, `目标：${TARGET_MODE_LABELS[slot.targetMode]}`, () => {
      const currentIndex = TARGET_MODES.indexOf(slot.targetMode);
      slot.targetMode = TARGET_MODES[(currentIndex + 1) % TARGET_MODES.length];
      targetButton.setLabel(`目标：${TARGET_MODE_LABELS[slot.targetMode]}`);
      this.message(`${tower.name}目标策略：${TARGET_MODE_LABELS[slot.targetMode]}`);
    }, { fill: 0x343c3d, hoverFill: PALETTE.olive, stroke: PALETTE.orange, fontSize: '13px' });
    targetButton.panel.setDepth(82); targetButton.text.setDepth(83);
    objects.push(targetButton.panel, targetButton.text);

    TOWER_TRACKS.forEach((track, rowIndex) => {
      const trackData = tower.tracks[track];
      const level = slot.upgrades[track];
      const maxed = level >= trackData.values.length - 1;
      const cost = maxed ? 0 : TOWER_UPGRADE_COSTS[level];
      const current = trackData.format(trackData.values[level]);
      const next = maxed ? '已满级' : trackData.format(trackData.values[level + 1]);
      const y = 420 + rowIndex * 104;
      const row = this.add.rectangle(270, y, 382, 86, 0x30383a, 0.98).setStrokeStyle(1.2, maxed ? 0x69706d : PALETTE.sand, 0.58).setDepth(82);
      const rowStripe = this.add.rectangle(82, y, 5, 86, maxed ? 0x69706d : PALETTE.orange, 0.72).setDepth(83);
      const name = this.add.text(101, y - 24, `${trackData.name}  Lv.${level}`, { fontFamily: FONT_BODY, fontSize: '15px', color: '#f0eadc', fontStyle: 'bold' }).setDepth(83);
      const values = this.add.text(101, y + 8, `${current}  →  ${next}`, { fontFamily: FONT_BODY, fontSize: '12px', color: '#adb4b0' }).setDepth(83);
      const buy = addButton(this, 408, y, 92, 54, maxed ? 'MAX' : `${cost} 补给`, () => this.upgradeWeapon(index, track), { fill: maxed ? 0x34393a : PALETTE.olive, hoverFill: 0x66734c, stroke: maxed ? 0x69706d : PALETTE.orange, fontSize: '12px' });
      buy.panel.setDepth(83); buy.text.setDepth(84); buy.setEnabled(!maxed);
      objects.push(row, rowStripe, name, values, buy.panel, buy.text);
    });

    const resaleNotice = this.add.text(270, 684, resale.allowed
      ? `返还为总投入的 60% · 本塔可返还 ${resale.refund} 补给`
      : '战斗中不可拆除或更换 · 请等待休整阶段', {
      fontFamily: FONT_BODY, fontSize: '11px', color: resale.allowed ? '#b7c3a1' : '#d69b58', align: 'center',
    }).setOrigin(0.5).setDepth(83);
    const sell = addButton(this, 173, 718, 176, 44, resale.allowed ? `拆除返还 +${resale.refund}` : '拆除锁定', () => this.openTowerRemovalConfirm(index, false), {
      fill: 0x4a3430, hoverFill: 0x6b4038, stroke: PALETTE.red, fontSize: '12px', color: '#f0d8cc',
    });
    const replace = addButton(this, 367, 718, 176, 44, resale.allowed ? '更换炮塔' : '更换锁定', () => this.openTowerRemovalConfirm(index, true), {
      fill: 0x3d4938, hoverFill: PALETTE.olive, stroke: PALETTE.orange, fontSize: '12px', color: '#f0eadc',
    });
    sell.panel.setDepth(82); sell.text.setDepth(83); sell.setEnabled(resale.allowed);
    replace.panel.setDepth(82); replace.text.setDepth(83); replace.setEnabled(resale.allowed);
    const close = addButton(this, 270, 775, 168, 48, '返回战场', () => this.closeModal(), { fill: 0x303638, stroke: 0x737b77, fontSize: '14px', color: '#c5cbc7' });
    close.panel.setDepth(82); close.text.setDepth(83);
    objects.push(resaleNotice, sell.panel, sell.text, replace.panel, replace.text, close.panel, close.text);
    this.setModal(objects);
  }

  openTowerRemovalConfirm(index, replacing) {
    const slot = gameStore.weaponSlots[index];
    const tower = slot?.type ? TOWER_CATALOG[slot.type] : null;
    const resale = getTowerResaleQuote(slot, this.phase);
    if (!tower || !resale.allowed) {
      this.message(resale.reason === 'phase' ? '战斗中不可拆除或更换炮塔' : '该武器位已为空');
      return;
    }

    // 先确认再改状态；取消时旧塔、升级和补给都不会变。
    this.closeModal();
    const objects = [];
    const shade = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.7).setDepth(80).setInteractive();
    const panel = this.add.rectangle(270, 488, 414, 360, 0x23292b, 0.995).setStrokeStyle(2, PALETTE.orange, 0.78).setDepth(81);
    const stripe = this.add.rectangle(270, 310, 414, 6, replacing ? PALETTE.orange : PALETTE.red, 0.9).setDepth(82);
    const title = this.add.text(270, 358, replacing ? '确认拆除并更换？' : '确认拆除炮塔？', {
      fontFamily: 'Arial Narrow, Microsoft YaHei', fontSize: '25px', color: '#f0eadc', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(82);
    const copy = this.add.text(270, 438, replacing
      ? `${tower.name}将立即拆除并返还 ${resale.refund} 补给。\n之后进入同一槽位的建造菜单；若取消建造，槽位保持为空。`
      : `${tower.name}总投入 ${resale.invested} 补给。\n按 60% 向下取整，本次返还 ${resale.refund} 补给。`, {
      fontFamily: FONT_BODY, fontSize: '14px', color: '#b9bfbb', align: 'center', lineSpacing: 8, wordWrap: { width: 350 },
    }).setOrigin(0.5).setDepth(82);
    const confirm = addButton(this, 270, 536, 264, 54, replacing ? `确认拆除并更换 · +${resale.refund}` : `确认拆除 · +${resale.refund}`, () => this.confirmTowerRemoval(index, replacing), {
      fill: replacing ? PALETTE.olive : 0x5a3531, hoverFill: replacing ? 0x66734c : 0x75433a, stroke: replacing ? PALETTE.orange : PALETTE.red, fontSize: '14px',
    });
    const cancel = addButton(this, 270, 604, 180, 48, '保留原炮塔', () => {
      this.closeModal();
      this.openWeaponUpgrade(index);
    }, { fill: 0x303638, stroke: 0x737b77, fontSize: '13px', color: '#c5cbc7' });
    confirm.panel.setDepth(82); confirm.text.setDepth(83);
    cancel.panel.setDepth(82); cancel.text.setDepth(83);
    objects.push(shade, panel, stripe, title, copy, confirm.panel, confirm.text, cancel.panel, cancel.text);
    this.setModal(objects);
  }

  confirmTowerRemoval(index, replacing) {
    const slot = gameStore.weaponSlots[index];
    const tower = slot?.type ? TOWER_CATALOG[slot.type] : null;
    const resale = getTowerResaleQuote(slot, this.phase);
    if (!tower || !resale.allowed) {
      this.closeModal();
      this.message(resale.reason === 'phase' ? '战斗阶段已开始，拆除已取消' : '炮塔已不存在');
      return;
    }

    this.closeModal();
    gameStore.leaves += resale.refund;
    gameStore.weaponSlots[index] = createWeaponSlot();
    gameStore.turrets[index] = 0;
    this.weaponRuntime[index] = { attackClock: 0, shots: 0, volleyClock: 0 };
    this.updateAllLabels();
    this.message(`${tower.name}已拆除 · 返还 ${resale.refund} 补给`);
    if (replacing) this.openBuildMenu(index);
  }

  upgradeWeapon(index, track) {
    const slot = gameStore.weaponSlots[index];
    const tower = TOWER_CATALOG[slot.type];
    const level = slot.upgrades[track];
    if (level >= tower.tracks[track].values.length - 1) return;
    const cost = TOWER_UPGRADE_COSTS[level];
    if (gameStore.leaves < cost) {
      this.closeModal();
      this.message(`补给不足 · 本次强化需要 ${cost}`);
      return;
    }
    gameStore.leaves -= cost;
    slot.upgrades[track] += 1;
    audioService.buy();
    this.closeModal();
    this.updateAllLabels();
    this.message(`${tower.name} · ${tower.tracks[track].name} 已强化`);
  }

  setModal(objects) {
    this.modal = { objects };
    this.syncSimulationPause();
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.objects.forEach((object) => object.destroy());
    this.modal = null;
    this.syncSimulationPause();
  }

  togglePause() {
    this.isPausedByUser = !this.isPausedByUser;
    this.syncSimulationPause();
    this.pauseButton.setLabel(this.isPausedByUser ? '继续' : '暂停');
    this.pauseOverlay.forEach((object) => object.setVisible(this.isPausedByUser));
    this.message(this.isPausedByUser ? '战斗已暂停 · 再点一次继续' : '自动防御继续运行');
  }

  syncSimulationPause() {
    const frozen = Boolean(this.modal || this.isPausedByUser);
    this.time.timeScale = frozen ? 0 : 1;
    this.tweens.timeScale = frozen ? 0 : 1;
  }

  maxDoorHp() {
    return Math.round(BALANCE.doorHp[gameStore.doorLevel] * (1 + (gameStore.room?.doorBonus || 0)));
  }

  updateAllLabels() {
    const maxHp = this.maxDoorHp();
    this.doorLabel.setText(`闸门 Lv.${gameStore.doorLevel}  ${Math.ceil(gameStore.doorHp)} / ${maxHp}`);
    this.doorBar.displayWidth = 190 * Phaser.Math.Clamp(gameStore.doorHp / maxHp, 0, 1);
    this.facilityPanels.forEach((view) => {
      if (view.isSupply) {
        const rate = BALANCE.supplyPerSecond[gameStore.bedLevel] + (gameStore.room?.supplyRateBonus || 0);
        view.label.setText(`补给 Lv.${gameStore.bedLevel}\n+${rate.toFixed(2)}/秒`);
        return;
      }
      const slot = gameStore.weaponSlots[view.slotIndex];
      const tower = slot.type ? TOWER_CATALOG[slot.type] : null;
      if (tower) {
        view.emptyRing?.setVisible(false);
        view.emptyPlus?.setVisible(false);
        const mountOrigin = tower.mountOrigin || { x: 0.5, y: 0.64 };
        view.icon.setTexture(tower.texture)
          .setOrigin(mountOrigin.x, mountOrigin.y)
          .setPosition(LAYOUT.facilities[view.slotIndex].x, LAYOUT.facilities[view.slotIndex].y)
          .setVisible(true);
        view.icon.setScale(102 / Math.max(view.icon.width, view.icon.height));
        const upgradeCount = TOWER_TRACKS.reduce((sum, track) => sum + slot.upgrades[track], 0);
        view.label.setText(`${tower.code}\n强化 +${upgradeCount}`);
      } else {
        view.emptyRing?.setVisible(true);
        view.emptyPlus?.setVisible(true);
        view.icon.setVisible(false);
        view.label.setText(`P${view.slotIndex + 1}  空位`);
      }
      view.panel.setFillStyle(0x171c1f, 0.025);
      view.panel.setStrokeStyle(1.2, tower ? PALETTE.sand : 0x9a9f94, tower ? 0.48 : 0.22);
      view.label.setColor(tower ? '#f1ecdf' : '#f0b26b');
    });
    this.updateHud();
  }

  updateHud() {
    this.leafText.setText(`${Math.floor(gameStore.leaves)}`);
    this.waveText.setText(this.phase === 'preparation' ? 'PREPARE' : this.phase === 'rest' ? 'RESUPPLY' : `WAVE ${gameStore.wave}`);
    this.timerText.setText(`${Math.max(0, Math.ceil(this.phaseTime)).toString().padStart(2, '0')} SEC`);
    this.killText.setText(`击杀 ${gameStore.kills}`);
    const threshold = combatXpThreshold(this.combatProgress.level);
    this.xpBar.setScale(Phaser.Math.Clamp(this.combatProgress.xp / threshold, 0, 1), 1);
    this.combatLevelText.setText(`TACTICAL LV.${this.combatProgress.level}  ${this.combatProgress.xp}/${threshold}`);
    this.updateSpellButtons();
  }

  updateSpellButtons() {
    if (!this.spellButtons) return;
    this.spellButtons.forEach((button) => {
      const spell = SPELLS[button.type];
      const cooldown = this.spellRuntime[button.type].cooldownMs;
      const selected = this.selectedSpell === button.type;
      const ready = this.phase === 'wave' && cooldown <= 0 && gameStore.leaves >= spell.cost;
      button.panel.setFillStyle(selected ? spell.color : spell.fill, selected ? 0.42 : 0.96);
      button.panel.setStrokeStyle(selected ? 2.5 : 1.5, spell.color, selected ? 1 : 0.78);
      button.text.setText(cooldown > 0 ? `${spell.name}\n${Math.ceil(cooldown / 1000)}秒` : `${spell.name}\n补给 ${spell.cost}`);
      button.text.setColor(selected ? '#ffffff' : ready ? '#f1eadc' : '#8f9d9b');
      button.panel.setAlpha(selected || ready ? 1 : 0.58);
      button.stripe.setAlpha(selected || ready ? 1 : 0.5);
    });
  }

  showBanner(title, body) {
    // 指挥警报短暂接管HUD，不再覆盖出生区和道路上的首个敌人。
    const alertColor = title.includes('BOSS') ? PALETTE.red : PALETTE.orange;
    const panel = this.add.rectangle(270, 42, 540, 84, 0x171c1f, 1).setDepth(70);
    const accent = this.add.rectangle(4, 42, 8, 84, alertColor, 0.98).setDepth(71);
    const divider = this.add.rectangle(270, 82, 540, 2, alertColor, 0.72).setDepth(71);
    const heading = this.add.text(24, 12, title, { fontFamily: 'Arial Narrow, Arial', fontSize: '25px', color: '#f1eadc', fontStyle: 'bold', letterSpacing: 1 }).setDepth(72);
    const copy = this.add.text(24, 50, body, { fontFamily: FONT_BODY, fontSize: '13px', color: '#c8c1b2' }).setDepth(72);
    const tag = this.add.text(516, 51, 'COMMAND ALERT', { fontFamily: 'Arial Narrow, Arial', fontSize: '10px', color: '#a9a399', letterSpacing: 2 }).setOrigin(1, 0).setDepth(72);
    const objects = [panel, accent, divider, heading, copy, tag];
    this.tweens.add({ targets: objects, alpha: 0, delay: 1120, duration: 280, onComplete: () => objects.forEach((object) => object.destroy()) });
  }

  showEnemyIntel(preview) {
    this.clearEnemyIntel();
    const intel = buildEnemyIntel(preview, { enemies: ENEMY_CATALOG, towers: TOWER_CATALOG });
    const objects = [];
    const panel = this.add.rectangle(270, 192, 508, 178, 0x1b2224, 0.96)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(intel.threatColor).color, 0.76).setDepth(58);
    const title = this.add.text(29, 116, `NEXT WAVE · ${intel.badge}`, {
      fontFamily: 'Arial Narrow, Arial', fontSize: '14px', color: intel.threatColor, fontStyle: 'bold', letterSpacing: 1,
    }).setDepth(59);
    const headline = this.add.text(511, 116, intel.headline, {
      fontFamily: FONT_BODY, fontSize: '12px', color: '#e9e3d5', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(59);
    objects.push(panel, title, headline);

    const cardWidth = intel.items.length === 1 ? 190 : 108;
    const totalWidth = cardWidth * intel.items.length;
    const startX = 270 - totalWidth / 2 + cardWidth / 2;
    intel.items.forEach((item, index) => {
      const x = startX + index * cardWidth;
      const card = this.add.rectangle(x, 183, cardWidth - 8, 88, 0x30383a, 0.9)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(item.threatColor).color, 0.52).setDepth(59);
      const enemyIcon = this.add.image(x - 25, 174, item.texture).setDepth(60);
      enemyIcon.setScale(46 / Math.max(enemyIcon.width, enemyIcon.height));
      const name = this.add.text(x + 6, 151, `${item.name} ${item.countLabel}`, {
        fontFamily: FONT_BODY, fontSize: '10px', color: '#f0eadc', fontStyle: 'bold',
      }).setDepth(60);
      const counterIcon = this.add.image(x + 5, 190, item.counterTexture).setDepth(60);
      counterIcon.setScale(22 / Math.max(counterIcon.width, counterIcon.height));
      const counter = this.add.text(x + 21, 181, `克制\n${item.counterName}`, {
        fontFamily: FONT_BODY, fontSize: '8px', color: '#d8a45f', lineSpacing: 1,
      }).setDepth(60);
      const hint = this.add.text(x, 222, item.hint, {
        fontFamily: FONT_BODY, fontSize: '8px', color: '#aeb5b1', align: 'center', wordWrap: { width: cardWidth - 16 },
      }).setOrigin(0.5, 0).setDepth(60);
      objects.push(card, enemyIcon, name, counterIcon, counter, hint);
    });
    const footerCopy = intel.overflow ? `${intel.overflow.label} · ${intel.advice}` : intel.advice;
    const footer = this.add.text(270, 264, footerCopy, {
      fontFamily: FONT_BODY, fontSize: '10px', color: '#c7b38c', align: 'center',
    }).setOrigin(0.5).setDepth(60);
    objects.push(footer);
    this.enemyIntelObjects = objects;
  }

  clearEnemyIntel() {
    this.enemyIntelObjects.forEach((object) => object?.active && object.destroy());
    this.enemyIntelObjects = [];
  }

  floatText(x, y, value, color) {
    const text = this.add.text(x, y, value, { fontFamily: FONT_BODY, fontSize: '12px', color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: text, y: y - 24, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  message(value) {
    this.messageText.setText(value).setColor('#e9e3d5');
    this.time.delayedCall(1300, () => {
      if (!this.messageText.active) return;
      const selected = this.selectedSpell ? SPELLS[this.selectedSpell] : null;
      this.messageText.setText(selected ? `${selected.name}待命 · 点击道路投放` : '点击基地设施进行建造或升级')
        .setColor(selected ? '#ffffff' : '#e7e2d8');
    });
  }

  endGame(victory) {
    if (this.isEnding) return;
    this.isEnding = true;
    this.clearSpellSelection();
    this.closeModal();
    const reward = gameStore.finishRun(victory);
    this.cameras.main.fadeOut(620, 23, 28, 31);
    this.time.delayedCall(640, () => this.scene.start('ResultScene', { victory, reward }));
  }
}
