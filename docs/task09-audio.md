# 任务9：音效变体与混音层次

## 模块设计

音频路由两个分组汇入总线：

```text
普通战斗音效 → sfxGain ─┐
                            ├→ masterGain → compressor → 设备
Boss / 波次警报 → alertGain ─┘
```

Boss 或波次警报播放时，`sfxGain` 短暂降低后自动恢复，警报自身不被压低。总线压缩器继续兜底限制六塔和尸群同时发声的峰值。

## 变体与防爆音

- `machineGun`、`enemyHit`、`enemyKill`、`mortarImpact` 各有 3 个轻微音高、时长或滤波差异。
- 变体由构造器注入的 `random` 选择；生产环境默认使用 `Math.random`，测试可使用固定种子。
- 机枪、受击、击杀和迫击炮爆炸同时受独立冷却和活跃声源上限保护。
- 服务全局最多保留 18 个活跃声源，单个音效达到上限不会阻塞其他重要音效。

## 音量和存储

`audioService` 公开以下状态与方法：

- `masterVolume` / `setMasterVolume(value)`
- `sfxVolume` / `setSfxVolume(value)`
- `mute` / `setMute(value)` / `toggleMute()`
- `settings()` / `loadSettings()` / `saveSettings()`

音量会夹到 `0–1`，设置保存在 `last-outpost-audio-settings-v1`。localStorage 不可用、数据损坏或隐私模式拒绝写入时，方法只返回 `false` 而不影响游戏。

## 兼容与验证

已保留 `tone`、`machineGun`、`mortarLaunch`、`mortarImpact`、`sniper`、`enemyHit`、`enemyKill`、`waveAlert`、`bossAlert`、`buy`、`reward` 和 `hit` 的无参调用方式。WebAudio 未解锁、浏览器不支持或 `resume()` 失败时，所有音效方法安静降级，不抛出异常。

验证命令：

```powershell
node scripts/audio-service-sim.mjs
npm run build
```

Mock AudioContext 覆盖四类三变体、冷却和并发上限、音量夹取、静音/恢复、警报 duck、安全存储、随机可复现和无 WebAudio 降级。
