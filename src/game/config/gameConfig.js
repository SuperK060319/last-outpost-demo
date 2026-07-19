import Phaser from 'phaser';
import { BootScene } from '../../scenes/BootScene.js';
import { MenuScene } from '../../scenes/MenuScene.js';
import { RoomScene } from '../../scenes/RoomScene.js';
import { GameScene } from '../../scenes/GameScene.js';
import { ResultScene } from '../../scenes/ResultScene.js';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

export function createGameConfig() {
  return {
    // 低端 Android WebView 的 WebGL 驱动可能创建成功但只显示黑屏；2D Canvas 更稳定。
    type: Phaser.CANVAS,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#071a21',
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, RoomScene, GameScene, ResultScene],
  };
}
