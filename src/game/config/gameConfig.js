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
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#071a21',
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, RoomScene, GameScene, ResultScene],
  };
}
