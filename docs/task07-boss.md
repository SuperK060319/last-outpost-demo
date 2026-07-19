# 任务7：Boss两阶段模块

## 模块设计

[`bossPhases.js`](../src/game/combat/bossPhases.js)只负责Boss阶段状态、倍率和事件时间轴，不读取Phaser、敌人配置或全局时间。

- 第一阶段：100%–55% HP，速度与攻击间隔均为1倍。
- 第二阶段：严格低于55% HP时切换，产生一次 `roar`。
- 第二阶段倍率：移动速度 `1.18`，攻击间隔 `0.85`。
- 第二阶段每累计4000ms产生一次 `shockwave`。
- 冲击波事件自带 `avoidable: true`、`interruptible: true` 和700ms预警时间。
- Boss回血不会退回第一阶段，怒吼不会再次触发。
- Boss死亡后不会再产生事件，`canAct`变为false。

## API

```js
let phaseState = createBossPhaseState(enemy.maxHp);

// 暂停时传入delta=0，冲击波计时自然冻结。
phaseState = updateBossPhase(phaseState, enemy.hp, delta);
const modifiers = getBossModifiers(phaseState);

enemy.speed = baseSpeed * modifiers.moveSpeedMultiplier;
const attackInterval = baseAttackInterval * modifiers.attackIntervalMultiplier;

phaseState.events.forEach((event) => {
  if (event.type === 'roar') showBossRoar();
  if (event.type === 'shockwave') createInterruptibleShockwave(event);
});
```

`updateBossPhase`返回新对象，不修改旧state；`events`只包含本次更新产生的事件，不需要调用清空函数。

## 场景接入约束

1. GameScene仍负责冲击波的视觉、碰撞、躲避条件和打断判定。
2. 场景暂停或升级弹窗冻结时必须传入0 delta。
3. 冲击波打断只取消对应场景实体，不回退阶段计时。
4. Boss死亡回调应先更新阶段状态，再执行结算，防止死亡帧补发事件。

## 验证

运行 `node scripts/boss-phase-sim.mjs`，脚本覆盖：

- 55%边界与低于55%的单次切换。
- 怒吼只出现一次，回血不降阶。
- 二阶段速度和攻击间隔倍率。
- 连续多次 `delta=0` 的暂停冻结。
- 3999ms不触发、4000ms触发一次。
- 8500ms大步进补发两次并保留500ms余数。
- 死亡当帧及死亡后的更新均不产生事件。

随后运行 `npm run build` 确认工程兼容。
