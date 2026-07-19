# 任务4：炮塔目标优先级纯模块

## 设计边界

`src/game/combat/targeting.js` 只根据当前敌人快照做选择，不保存状态、不修改原数组，也不依赖 Phaser。因此它可以在场景、模拟脚本和后续测试中共用。

统一 API：

```js
selectTargets(enemies, mode, count, context)
// => { targets: Enemy[], center: null | { x, y } }
```

- `targets` 是最多 `count` 个目标的新数组。
- `center` 仅在 `densestCluster` 中返回最佳命中中心，其余策略为 `null`。
- 死亡、缺失 sprite、sprite 已失效或坐标非数字的敌人会被过滤。
- 评分相同时按输入数组的原始顺序决胜，避免目标每帧抖动。

## 六种策略

- `nearestGate`：优先离闸门最近的敌人。`context` 可传 `{ gate: { x, y } }` 或 `{ gateY }`；未传坐标时按 y 值从大到小。
- `highestHp`：当前生命最高优先。
- `lowestHp`：当前生命最低优先。
- `fastest`：`speed` 最高优先。
- `highestArmor`：`armor` 最高优先。
- `densestCluster`：以每个有效敌人为候选中心，计算 `context.radius` 内的敌人数，返回最密中心与集合；默认半径为 58px。

## 调用与修改

场景后续接入时，只需从结果中读取 `targets`；迫击炮或榴弹炮还可使用 `center` 作为落点。如果游戏新增护甲值，应统一写入敌人运行对象的 `armor` 字段，不要在目标模块中猜测敌人类型。

验证命令：

```powershell
node scripts/targeting-sim.mjs
npm run build
```

`targeting-sim.mjs` 覆盖六种策略、并列稳定性、死亡/失效目标过滤、空输入和未知策略。
