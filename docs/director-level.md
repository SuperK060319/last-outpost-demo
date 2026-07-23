# LINE ZERO：第一关三段敌潮设计

## 模块边界

`src/game/config/waves.js` 只描述“什么时候生成什么”，不保存运行状态，也不处理移动、伤害、胜负或暂停。

- `WAVES`：五波的时长、敌情预告和批次原始数据。
- `getWaveConfig(waveNumber)`：读取指定波次。
- `expandWaveSchedule(waveOrNumber)`：把批次展开为按 `atMs` 排序的出生事件。
- `getNextWavePreview(currentWaveNumber)`：休整阶段读取下一波的纯预告数据。

## 节奏设计

前四波都遵循三个阶段：

1. **试探**：1—2个目标，给玩家观察炮塔输出和换弹节奏。
2. **主力**：3—6个目标，以略密于旧版的间隔形成每波高潮。
3. **收尾**：1—3个目标，在短暂停顿后抵达，避免主力清完就只剩空等。

第五波保持原来的单Boss，不为满足形式强行增加杂兵。五波总数量仍是 `5/7/9/11/1`，共33个目标。

## 可直接集成的调用方式

GameScene后续只需做四处小连接：

1. `startWave()` 中读取 `getWaveConfig(gameStore.wave)`，将 `durationSeconds` 写入当前计时。
2. 将 `expandWaveSchedule(wave)` 保存为本波待生成事件队列，并记录波次已经运行的模拟时间。
3. 每帧取出所有 `atMs <= elapsedMs` 的事件，按 `enemyType === 'boss'` 调用现有生成函数。
4. 休整HUD通过 `getNextWavePreview(gameStore.wave)` 显示下一波标题、数量、威胁等级、图标和建议。

建议事件队列消费伪代码：

```js
while (spawnEvents[0]?.atMs <= waveElapsedMs) {
  const event = spawnEvents.shift();
  spawnEnemy(event.enemyType === 'boss');
}
```

## 模拟结果与验收

`scripts/wave-sim.mjs` 对比改版前后的出生时间，并复用当前敌人生命、门伤和移动公式估算：

- 各波数量与五波总数完全不变。
- 最早抵达时间不变。
- 最晚抵达时间与旧版最大差异小于0.5秒。
- 生命×门伤的总压力倍率均为1.00。
- 三秒内抵达峰值最高提升到旧版的1.5倍，形成高潮但没有突然翻倍。

## 集成风险

- **当前尚未接入GameScene**：本轮权限只落地配置、模拟和说明，实时游戏仍使用均匀刷新公式。
- **必须使用模拟时间**：不要直接用未扣除暂停的墙钟时间，否则暂停后可能一次生成整批敌人。
- **清场条件要看事件队列**：只有出生事件耗尽且场上敌人归零，才能结束波次。
- **预告类型要有素材映射**：目前只有 `normal` 和 `boss`；以后增加敌人类型时，先补纹理和生成映射，再写进波次。
- **主力批次不等于同时出生**：继续按配置间隔逐个生成，避免手机端同帧创建和特效峰值。
