# LINE ZERO 音效API

## 声音层级

1. **警报层**：`bossAlert`、`waveAlert`，频率最低但信息优先级最高。
2. **重火力层**：`mortarImpact`、`sniper`、`hit`，负责爆点和基地受损反馈。
3. **连续火力层**：`machineGun`、`mortarLaunch`，声音短，避免覆盖战场信息。
4. **目标反馈层**：`enemyHit`、`enemyKill`，音量最低，只用于确认命中与击杀。
5. **界面奖励层**：`buy`、`reward`，使用短促上行音程，与战斗噪声区分。

所有声音经过统一总音量和动态压缩器。语义音效最多使用两个短声源；并发声源上限18，连续事件带35–1800ms冷却。

## GameScene替换表

| 事件 | 推荐调用 | 当前调用的直接替换 |
| --- | --- | --- |
| 机枪开火 | `audioService.machineGun()` | `tone(125, ...)` |
| 迫击炮出膛 | `audioService.mortarLaunch()` | 在炮弹创建后调用 |
| 迫击炮爆炸 | `audioService.mortarImpact()` | `tone(72, ...)` |
| 狙击枪开火 | `audioService.sniper()` | `tone(82, ...)` |
| 敌人受击 | `audioService.enemyHit()` | 在受击函数内调用，已有冷却 |
| 敌人死亡 | `audioService.enemyKill()` | 普通击杀使用 |
| 新波次 | `audioService.waveAlert()` | 普通波次Banner出现时调用 |
| Boss出现 | `audioService.bossAlert()` | Boss Banner出现时调用 |
| 购买/升级 | `audioService.buy()` | 旧调用保持兼容 |
| 结算/资源奖励 | `audioService.reward()` | 旧调用保持兼容 |
| 闸门受击 | `audioService.hit()` | 旧调用保持兼容 |

`tone(frequency, duration, volume, type)`继续保留，便于未迁移代码运行；新代码应优先使用语义方法。

## 性能边界

- 噪声只生成一次0.4秒缓存，不为每次爆炸重新计算采样数据。
- 每个声源结束后断开节点引用，当前设计不保留历史声音对象。
- 手机端并发超过18个声源时，新声音会被丢弃，优先保证帧率和避免爆音。
- 当前合成适合玩具军事质感，不替代后续正式录音；接入高射速武器时仍需检查真机CPU和扬声器失真。
