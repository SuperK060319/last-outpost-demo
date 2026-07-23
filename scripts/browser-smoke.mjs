import { spawn } from 'node:child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9333;
const BASE_URL = process.env.SMOKE_URL || 'http://127.0.0.1:4178/';

const edge = spawn(EDGE_PATH, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=C:\\Windows\\Temp\\last-outpost-browser-smoke',
  BASE_URL,
], { stdio: 'ignore' });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findPage() {
  const expectedUrl = decodeURI(BASE_URL).replace(/\/$/, '');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`).then((response) => response.json());
      const page = targets.find((target) => target.type === 'page'
        && decodeURI(target.url).replace(/\/$/, '') === expectedUrl);
      if (page) return page;
    } catch { /* Edge仍在启动，继续短轮询。 */ }
    await wait(150);
  }
  throw new Error('无法连接本地Edge调试页面');
}

async function run() {
  const page = await findPage();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let commandId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    if (!message.id || !pending.has(message.id)) return;
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
    else handler.resolve(message.result);
  };

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || '页面脚本执行失败');
    return result.result.value;
  };

  await command('Runtime.enable');
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command('Page.reload', { ignoreCache: true });

  let bootState = null;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    await wait(100);
    bootState = await evaluate(`window.game ? ({ scene: window.game.scene.getScenes(true)[0]?.scene.key, width: document.querySelector('canvas')?.clientWidth, height: document.querySelector('canvas')?.clientHeight }) : null`);
    if (bootState?.scene === 'MenuScene') break;
  }
  if (bootState?.scene !== 'MenuScene') {
    const bootDiagnostic = await evaluate(`(() => { const status = document.getElementById('boot-status'); return { text: status?.innerText, error: status?.dataset.error }; })()`);
    throw new Error(`启动场景异常：${bootState?.scene}；页面=${JSON.stringify(bootDiagnostic)}；运行错误=${runtimeErrors.join(' | ')}`);
  }

  const brandState = await evaluate(`(() => {
    const menu = window.game.scene.getScene('MenuScene');
    const menuTexts = menu.children.list.filter((object) => typeof object.text === 'string').map((object) => object.text);
    return {
      pageTitle: document.title,
      hasEnglishName: menuTexts.includes('LINE ZERO'),
      hasChineseName: menuTexts.includes('零号防线'),
      hasLegacyName: menuTexts.some((text) => text.includes('LAST OUTPOST') || text.includes('最后哨站')),
    };
  })()`);
  if (brandState.pageTitle !== 'LINE ZERO / 零号防线' || !brandState.hasEnglishName
    || !brandState.hasChineseName || brandState.hasLegacyName) throw new Error(`品牌名称未完整统一：${JSON.stringify(brandState)}`);

  await evaluate(`window.game.scene.start('GameScene'); true`);
  await wait(500);

  const towerMenu = await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    const textures = ['flame-turret', 'auto-grenade', 'anti-armor-rocket'].every((key) => scene.textures.exists(key));
    const enemyTextures = ['zombie-shielded', 'zombie-bomber', 'zombie-toxic', 'zombie-medic'].every((key) => scene.textures.exists(key));
    scene.openBuildMenu(0);
    const labels = scene.modal.objects.filter((object) => typeof object.text === 'string').map((object) => object.text);
    const names = ['重机枪', '迫击炮', '狙击塔', '火焰喷射器', '自动榴弹炮', '反装甲火箭'];
    const allNamesVisible = names.every((name) => labels.some((label) => label.includes(name)));
    scene.closeModal();
    const allSlotMenus = [0, 1, 2, 3].every((index) => {
      scene.openBuildMenu(index);
      const opened = scene.modal?.objects.some((object) => typeof object.text === 'string' && object.text.includes('武器位 ' + (index + 1)));
      scene.closeModal();
      return opened;
    });
    const weaponPanels = scene.facilityPanels.filter((panel) => !panel.isSupply);
    const supplyPanel = scene.facilityPanels.find((panel) => panel.isSupply);
    return {
      textures, enemyTextures, allNamesVisible,
      continuousLabel: supplyPanel.label.text.includes('/秒'),
      weaponSlotCount: weaponPanels.length,
      runtimeCount: scene.weaponRuntime.length,
      twoRows: new Set(weaponPanels.map((panel) => panel.panel.y)).size === 2,
      padsVisible: weaponPanels.every((panel) => panel.pad?.mount?.active && panel.pad?.shadow?.visible),
      allSlotMenus,
    };
  })()`);
  if (!towerMenu.textures || !towerMenu.enemyTextures || !towerMenu.allNamesVisible || !towerMenu.continuousLabel
    || towerMenu.weaponSlotCount !== 4 || towerMenu.runtimeCount !== 4 || !towerMenu.twoRows || !towerMenu.padsVisible
    || !towerMenu.allSlotMenus) throw new Error(`六炮塔菜单、四炮位布局或持续补给标签未完整接入：${JSON.stringify(towerMenu)}`);

  const preparationBudget = await evaluate(`Number(window.game.scene.getScene('GameScene').leafText.text)`);
  await wait(5500);
  const preparationBudgetAfterWait = await evaluate(`Number(window.game.scene.getScene('GameScene').leafText.text)`);
  if (preparationBudgetAfterWait <= preparationBudget) throw new Error('准备阶段没有持续产出补给');

  const progressionState = await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    for (let kill = 0; kill < 4; kill += 1) scene.addCombatXp('normal');
    const cards = scene.modal?.objects.filter((object) => object.upgradeId) || [];
    const chosenId = cards[0]?.upgradeId;
    const frozen = scene.time.timeScale === 0 && scene.tweens.timeScale === 0;
    cards[0]?.emit('pointerup');
    return {
      choiceCount: cards.length,
      chosenId,
      frozen,
      resumed: scene.time.timeScale === 1 && scene.tweens.timeScale === 1,
      level: scene.combatProgress.level,
      appliedLevel: scene.combatProgress.upgrades[chosenId],
      hudLevel: scene.combatLevelText.text,
    };
  })()`);
  if (progressionState.choiceCount !== 3 || !progressionState.chosenId || !progressionState.frozen || !progressionState.resumed
    || progressionState.level !== 1 || progressionState.appliedLevel !== 1 || !progressionState.hudLevel.includes('LV.1')) throw new Error(`战中三选一未完整生效：${JSON.stringify(progressionState)}`);

  const spellState = await evaluate(`(async () => {
    const scene = window.game.scene.getScene('GameScene');
    scene.startWave();
    scene.spawnEvents = []; scene.spawnQueue = 0;
    scene.spawnEnemy('normal', 0);
    const enemy = scene.enemies.at(-1);
    enemy.sprite.setPosition(270, 360);
    const hpBefore = enemy.hp;
    scene.selectSpell('incendiary');
    const fireCast = scene.tryCastSelectedSpell(270, 360);
    await new Promise((resolve) => setTimeout(resolve, 340));
    const fireDamaged = enemy.hp < hpBefore;
    scene.selectSpell('frost');
    const frostCast = scene.tryCastSelectedSpell(270, enemy.sprite.y);
    await new Promise((resolve) => setTimeout(resolve, 340));
    const slowed = enemy.slowUntil > scene.time.now && enemy.slowMultiplier < 1;
    return {
      buttons: scene.spellButtons.map((button) => button.type),
      fireCast, fireDamaged, frostCast, slowed,
      fireCooldown: scene.spellRuntime.incendiary.cooldownMs,
      frostCooldown: scene.spellRuntime.frost.cooldownMs,
    };
  })()`);
  if (spellState.buttons.length !== 2 || !spellState.fireCast || !spellState.fireDamaged || !spellState.frostCast || !spellState.slowed
    || spellState.fireCooldown <= 0 || spellState.frostCooldown <= 0) throw new Error(`战术弹药未完整生效：${JSON.stringify(spellState)}`);

  await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.enemies.forEach((enemy) => { enemy.sprite.destroy(); enemy.bar.destroy(); enemy.barBack.destroy(); });
    scene.enemies = []; scene.spawnEvents = []; scene.spawnQueue = 0; scene.waveElapsedMs = 1000;
  })()`);
  await wait(150);
  const earlyClearPhase = await evaluate(`window.game.scene.getScene('GameScene').phase`);
  if (earlyClearPhase !== 'rest') throw new Error('普通波清场后没有立即进入休整');

  const waveTwo = await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.startWave(); scene.waveElapsedMs = 1700;
    return { phase: scene.phase, wave: scene.waveText.text, budget: Number(scene.leafText.text) };
  })()`);
  await wait(150);
  const runnerTypes = await evaluate(`window.game.scene.getScene('GameScene').enemies.map((enemy) => enemy.enemyType)`);
  if (!runnerTypes.includes('runner')) throw new Error('第2波没有生成跑尸');

  const pausedAt = await evaluate(`(() => { const scene = window.game.scene.getScene('GameScene'); scene.togglePause(); return scene.waveElapsedMs; })()`);
  await wait(300);
  const pausedAfter = await evaluate(`(() => { const scene = window.game.scene.getScene('GameScene'); const elapsed = scene.waveElapsedMs; scene.togglePause(); return elapsed; })()`);
  if (pausedAt !== pausedAfter) throw new Error('暂停期间波次事件队列仍在推进');

  await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.enemies.forEach((enemy) => { enemy.sprite.destroy(); enemy.bar.destroy(); enemy.barBack.destroy(); });
    scene.enemies = []; scene.spawnEvents = []; scene.spawnQueue = 0; scene.phase = 'rest';
    scene.startWave(); scene.waveElapsedMs = 13300;
  })()`);
  await wait(180);
  const mixedTypes = await evaluate(`window.game.scene.getScene('GameScene').enemies.map((enemy) => enemy.enemyType)`);
  for (const required of ['normal', 'armored', 'swarm']) {
    if (!mixedTypes.includes(required)) throw new Error(`第3波缺少敌人类型：${required}`);
  }
  if (mixedTypes.filter((type) => type === 'swarm').length !== 3) throw new Error('尸群没有按三只一组生成');

  await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.enemies.forEach((enemy) => { enemy.sprite.destroy(); enemy.bar.destroy(); enemy.barBack.destroy(); enemy.shieldBar?.destroy(); enemy.shieldBarBack?.destroy(); });
    scene.enemies = []; scene.spawnEvents = []; scene.spawnQueue = 0; scene.phase = 'rest';
    scene.startWave(); scene.waveElapsedMs = 14500;
  })()`);
  await wait(180);
  const behaviorState = await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    const specialTypes = scene.enemies.map((enemy) => enemy.enemyType);
    const medic = scene.enemies.find((enemy) => enemy.enemyType === 'medic');
    const ally = scene.enemies.find((enemy) => enemy.enemyType === 'normal');
    medic.sprite.setPosition(ally.sprite.x, ally.sprite.y); ally.hp = 1; medic.supportClock = medic.behavior.pulseMs;
    scene.updateMedicPulse(medic, 0);
    const medicHealed = ally.hp > 1;
    const bomber = scene.enemies.find((enemy) => enemy.enemyType === 'bomber');
    scene.updateBomberFuse(bomber, bomber.behavior.fuseMs + 1);
    const bomberRemoved = !scene.enemies.includes(bomber);
    const toxic = scene.enemies.find((enemy) => enemy.enemyType === 'toxic');
    scene.damageEnemy(toxic, toxic.maxHp + 1);
    const toxicCloudCreated = scene.toxicClouds.length > 0;
    const shielded = scene.enemies.find((enemy) => enemy.enemyType === 'shielded');
    const shieldBefore = shielded.shieldHp;
    scene.damageEnemy(shielded, 10, 'machineGun');
    return { specialTypes, medicHealed, bomberRemoved, toxicCloudCreated, shieldDamaged: shielded.shieldHp < shieldBefore };
  })()`);
  for (const required of ['shielded', 'bomber', 'toxic', 'medic']) {
    if (!behaviorState.specialTypes.includes(required)) throw new Error(`第4波缺少特种敌人：${required}`);
  }
  if (!behaviorState.medicHealed || !behaviorState.bomberRemoved || !behaviorState.toxicCloudCreated || !behaviorState.shieldDamaged) throw new Error('扩展敌人行为未完整触发');

  const lateGameState = await evaluate(`(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.enemies.forEach((enemy) => { enemy.sprite.destroy(); enemy.bar.destroy(); enemy.barBack.destroy(); enemy.shieldBar?.destroy(); enemy.shieldBarBack?.destroy(); });
    scene.enemies = []; scene.spawnEvents = []; scene.spawnQueue = 0; scene.finishWave();
    const intelTexts = scene.enemyIntelObjects.filter((object) => typeof object.text === 'string').map((object) => object.text);
    const bossIntelVisible = intelTexts.some((text) => text.includes('BOSS'));

    scene.buildWeapon(0, 'machineGun');
    const afterBuild = Number(scene.leafText.text);
    scene.confirmTowerRemoval(0, false);
    const afterResale = Number(scene.leafText.text);
    const resaleClearedSlot = scene.facilityPanels[0].label.text.includes('空位');

    scene.startWave(); scene.waveElapsedMs = 1; scene.spawnFromQueue();
    const boss = scene.enemies.find((enemy) => enemy.boss);
    boss.hp = boss.maxHp * 0.54;
    scene.updateEnemies(0, 16);
    const phaseTwo = boss.bossPhaseState.phase === 2 && boss.bossPhaseState.events.some((event) => event.type === 'roar');
    boss.bossPhaseState.shockwaveElapsedMs = 3990;
    scene.updateEnemies(0, 20);
    const shockwave = boss.bossPhaseState.events.some((event) => event.type === 'shockwave');
    return { bossIntelVisible, resaleRefunded: afterResale > afterBuild, resaleClearedSlot, phaseTwo, shockwave };
  })()`);
  if (!Object.values(lateGameState).every(Boolean)) throw new Error(`后期系统回归失败：${JSON.stringify(lateGameState)}`);
  if (runtimeErrors.length) throw new Error(`浏览器运行错误：${runtimeErrors.join(' | ')}`);

  socket.close();
  return { bootState, brandState, towerMenu, preparationBudget, preparationBudgetAfterWait, progressionState, spellState, earlyClearPhase, waveTwo, runnerTypes, pausedAt, pausedAfter, mixedTypes, behaviorState, lateGameState };
}

try {
  const result = await run();
  console.log('LINE ZERO · 浏览器冒烟测试通过');
  console.log(JSON.stringify(result, null, 2));
} finally {
  edge.kill();
}
