import Phaser from 'phaser';
import { createGameConfig } from './game/config/gameConfig.js';
import { audioService } from './game/services/AudioService.js';
import './styles.css';

// 项目唯一入口。场景、数值和存档都由各自模块负责。
const game = new Phaser.Game(createGameConfig());
window.game = game;

// 首次触摸、鼠标点击或键盘操作时解锁声音；成功后立即移除全局监听。
const unlockEvents = ['pointerdown', 'touchstart', 'keydown'];
const unlockAudio = () => {
  void audioService.unlock().then((unlocked) => {
    if (!unlocked) return;
    unlockEvents.forEach((eventName) => window.removeEventListener(eventName, unlockAudio, true));
  });
};
unlockEvents.forEach((eventName) => window.addEventListener(eventName, unlockAudio, { capture: true, passive: true }));
