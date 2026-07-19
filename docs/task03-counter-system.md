# 任务3：真实克制与伤害标签

## 模块边界

[`damageModel.js`](../src/game/combat/damageModel.js)是独立纯函数模块，不读取Phaser场景，也不修改炮塔、敌人或波次配置。本轮只建立规则和验证矩阵，GameScene接入后才会影响实际战斗。

## 伤害类型与防御标签

| 伤害类型 | 主要优势 | 主要弱势 |
| --- | --- | --- |
| kinetic 动能 | 血肉1.30倍 | 护甲0.75、护盾0.82 |
| explosive 爆炸 | 集群1.45倍 | 护盾0.78 |
| fire 火焰 | 血肉1.35、集群1.30 | 护甲0.78、护盾0.70 |
| piercing 穿甲 | 护甲1.45、护盾1.30 | 集群0.72 |

防御标签包括 `armor / shield / flesh / swarm / boss`。敌人可以保留多个描述标签，但只有 `primaryTag` 进入克制表，避免多标签连乘产生极端数值。

## 调用方式

```js
const result = calculateDamage(
  baseDamage,
  ATTACK_PROFILES.sniper,
  DEFENSE_PROFILES.armored,
  { armorBreak: 0.18 },
);

enemy.hp -= result.damage;
```

返回值包含：最终伤害、总倍率、类型倍率、状态倍率、`advantage/resisted/neutral`判定，以及可直接用于战报或图鉴的 `breakdown`。

可选状态：

- `vulnerability`：易伤，最高35%。
- `resistance`：抗性，最高35%。
- `armorBreak`：仅对护甲/护盾生效，最高50%。

无论状态如何，总倍率最低为0.5，不会出现免疫。

## 建议接入映射

| 炮塔 | 攻击配置 |
| --- | --- |
| 重机枪 | `ATTACK_PROFILES.machineGun` |
| 迫击炮 | `ATTACK_PROFILES.mortar` |
| 狙击塔 | `ATTACK_PROFILES.sniper` |
| 火焰喷射器 | `ATTACK_PROFILES.flamethrower` |
| 自动榴弹炮 | `ATTACK_PROFILES.grenadeLauncher` |
| 反装甲火箭 | `ATTACK_PROFILES.antiArmorRocket` |

普通尸/跑尸用 `flesh`，装甲尸用 `armor`，尸群用 `swarm`，Boss用 `boss`；未来护盾敌人使用 `shield`。

## 验证

运行 `node scripts/damage-model-sim.mjs` 输出完整矩阵并检查：

1. 克制倍率为1.25–1.5。
2. 被克制倍率为0.65–0.85。
3. 所有类型×标签组合均大于0。
4. 未知类型安全回退到1倍。
5. 状态修正不会产生免疫。

随后运行 `npm run build` 验证工程引用兼容性。
