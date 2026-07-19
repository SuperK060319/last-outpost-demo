import { BALANCE } from '../config/balance.js';
import { createWeaponSlot } from '../config/towers.js';
import {
  createDefaultDoctrineLevels,
  doctrineBonuses,
  doctrineUpgradeState,
  normalizeDoctrineLevels,
} from '../meta/doctrines.js';

export const SAVE_KEY = 'bamboo-night-defense-save-v1';
const DEFAULT_PROFILE = Object.freeze({
  bestWave: 0,
  jade: 0,
  wins: 0,
  doctrines: Object.freeze(createDefaultDoctrineLevels()),
});

function normalizeCounter(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number)));
}

export function normalizeProfile(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : DEFAULT_PROFILE;
  // 只接收已公开的兼容字段，避免旧存档中的字符串、负数或异常值污染结算。
  return {
    bestWave: normalizeCounter(source.bestWave),
    jade: normalizeCounter(source.jade),
    wins: normalizeCounter(source.wins),
    // v1 旧存档没有 doctrines 字段；标准化时自动补成三个 0 级，不需要迁移弹窗。
    doctrines: normalizeDoctrineLevels(source.doctrines),
  };
}

export class GameStore {
  constructor() {
    this.profile = this.loadProfile();
    this.resetRun();
  }

  loadProfile() {
    try {
      return normalizeProfile(JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch {
      return normalizeProfile(DEFAULT_PROFILE);
    }
  }

  saveProfile() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(normalizeProfile(this.profile)));
      return true;
    } catch {
      // 隐私模式或存储被禁用时仍允许进入结算页，仅放弃本次本地写入。
      return false;
    }
  }

  resetRun(room = null) {
    const bonuses = doctrineBonuses(this.profile);
    const roomDoorBonus = Number(room?.doorBonus) || 0;
    // room 是运行时快照：把永久工事加成合并进去，使闸门后续升级仍沿用同一倍率。
    this.room = {
      ...(room || {}),
      doorBonus: roomDoorBonus + bonuses.doorHpMultiplier,
    };
    this.leaves = BALANCE.startingLeaves + (Number(room?.leavesBonus) || 0) + bonuses.startingSupplies;
    this.wave = 0;
    this.kills = 0;
    this.bedLevel = 1;
    this.doorLevel = 1;
    this.doorHp = Math.round(BALANCE.startingDoorHp * (1 + this.room.doorBonus));
    // 旧字段继续保留，避免后续读取旧版运行数据时结构缺失。
    this.turrets = [0, 0, 0];
    // 四个通用武器位各自记录炮塔类型与三条独立升级线。
    this.weaponSlots = Array.from({ length: 4 }, () => createWeaponSlot());
    this.colorRestored = 0;
  }

  getDoctrineLevel(id) {
    return normalizeDoctrineLevels(this.profile?.doctrines)[id] ?? 0;
  }

  getDoctrineUpgradeState(id) {
    return doctrineUpgradeState(this.profile, id);
  }

  purchaseDoctrine(id) {
    this.profile = normalizeProfile(this.profile);
    const state = doctrineUpgradeState(this.profile, id);
    if (!state.valid) return { ok: false, reason: 'unknown', id };
    if (state.isMax) return { ok: false, reason: 'max', ...state, jade: this.profile.jade };
    if (!state.affordable) return { ok: false, reason: 'insufficient', ...state, jade: this.profile.jade };

    this.profile.jade = normalizeCounter(this.profile.jade - state.cost);
    this.profile.doctrines[id] = state.nextLevel;
    this.saveProfile();
    return {
      ok: true,
      reason: 'purchased',
      id,
      cost: state.cost,
      level: state.nextLevel,
      nextLevel: state.nextLevel,
      jade: this.profile.jade,
    };
  }

  finishRun(victory) {
    const reward = Math.max(1, this.wave * 2 + Math.floor(this.kills / 5) + (victory ? 12 : 0));
    this.profile = normalizeProfile(this.profile);
    this.profile.bestWave = Math.max(this.profile.bestWave, normalizeCounter(this.wave));
    this.profile.jade = normalizeCounter(this.profile.jade + reward);
    if (victory) this.profile.wins = normalizeCounter(this.profile.wins + 1);
    this.saveProfile();
    return reward;
  }
}

export const gameStore = new GameStore();
