# LAST OUTPOST / 最后哨站 Demo

竖屏单线自动塔防原型。现代军事基地使用六种自动炮塔抵御多类型感染体，面向鼠标和手机触控操作。

## 当前可玩闭环

1. 三种前线据点特性。
2. 18 秒部署、五波感染潮和波间补给。
3. 四个固定炮位、六种自动炮塔，以及威力、射速和载荷三条强化线。
4. 持续补给站、基地闸门、燃烧弹和冰霜弹。
5. 九类感染体、最终 Boss、敌潮预告与克制提示。
6. 战斗内三选一成长、胜败结算、永久条令和本地存档。

## 运行

```powershell
npm install
npm run dev
```

浏览器打开终端显示的地址，通常为 `http://127.0.0.1:5173`。

生产构建：

```powershell
npm run build
```

## 安全可改区

- 数值、价格、波次：`src/game/config/balance.js`
- HUD、道路、基地比例和设施锚点：`src/game/config/layout.js`
- 用户可见战斗规则：`src/scenes/GameScene.js`
- 正式战场、角色与设施素材：`public/assets/last-outpost-v2/`
- 六种炮塔的图片安装锚点：`src/game/config/towers.js` 中的 `mountOrigin`
- 素材加载失败时的程序回退纹理：`src/utils/createTextures.js`

敌人阶段切换、敌人数组清理、结算与存档属于核心逻辑。调整布局时优先修改 `layout.js`，不要在场景内重新散落坐标。

## 美术资源

当前版本采用原创高分辨率军事沙盘模型风格，非像素画。正式运行素材统一从 `public/assets/last-outpost-v2/` 加载，包括战场、指挥官、六种炮塔、四炮位底座、补给站、九类感染体和 Boss。

## 验证

项目内的 `scripts/*-sim.mjs` 覆盖经济、波次、伤害、敌人、炮塔、Boss、法术和永久成长等纯逻辑验证。发布前至少运行 `npm run build`。
