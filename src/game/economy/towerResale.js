import { TOWER_CATALOG, TOWER_TRACKS, TOWER_UPGRADE_COSTS } from '../config/towers.js';

export const TOWER_RESALE_RATE = 0.6;

export function isTowerManagementPhase(phase) {
  return phase === 'preparation' || phase === 'rest';
}

function paidUpgradeCost(level) {
  const paidLevels = Math.min(TOWER_UPGRADE_COSTS.length, Math.max(0, Math.floor(Number(level) || 0)));
  return TOWER_UPGRADE_COSTS.slice(0, paidLevels).reduce((sum, cost) => sum + cost, 0);
}

export function towerInvestment(slot) {
  const tower = slot?.type ? TOWER_CATALOG[slot.type] : null;
  if (!tower) return 0;
  const upgradeCost = TOWER_TRACKS.reduce((sum, track) => sum + paidUpgradeCost(slot.upgrades?.[track]), 0);
  return tower.buildCost + upgradeCost;
}

export function getTowerResaleQuote(slot, phase) {
  const invested = towerInvestment(slot);
  const refund = Math.floor(invested * TOWER_RESALE_RATE);
  if (!slot?.type || invested === 0) return { allowed: false, reason: 'empty', invested: 0, refund: 0 };
  if (!isTowerManagementPhase(phase)) return { allowed: false, reason: 'phase', invested, refund };
  return { allowed: true, reason: null, invested, refund };
}
