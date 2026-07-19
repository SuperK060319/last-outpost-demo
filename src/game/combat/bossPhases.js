export const BOSS_PHASE_RULES = Object.freeze({
  phaseTwoThreshold: 0.55,
  phaseTwoMoveSpeedMultiplier: 1.18,
  phaseTwoAttackIntervalMultiplier: 0.85,
  shockwaveIntervalMs: 4000,
  shockwaveTelegraphMs: 700,
});

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function createBossPhaseState(maxHp) {
  return {
    maxHp: Math.max(1, finiteNonNegative(maxHp, 1)),
    currentHp: Math.max(1, finiteNonNegative(maxHp, 1)),
    phase: 1,
    dead: false,
    roarTriggered: false,
    shockwaveElapsedMs: 0,
    shockwaveSequence: 0,
    // events只表示本次update产生的事件，场景读取后无需再手动清空。
    events: [],
  };
}

/**
 * 不修改旧state；delta由场景传入，暂停时传0即可冻结二阶段计时。
 * 返回的新state.events包含本次更新产生的怒吼或冲击波事件。
 */
export function updateBossPhase(state, currentHp, delta) {
  if (!state || typeof state !== 'object') throw new TypeError('Boss phase state is required');
  if (state.dead) return { ...state, events: [] };

  const hp = Math.min(state.maxHp, finiteNonNegative(currentHp));
  if (hp <= 0) return { ...state, currentHp: 0, dead: true, events: [] };

  const safeDelta = finiteNonNegative(delta);
  const hpRatio = hp / state.maxHp;
  let phase = state.phase;
  let roarTriggered = state.roarTriggered;
  let shockwaveElapsedMs = state.shockwaveElapsedMs;
  let shockwaveSequence = state.shockwaveSequence;
  const events = [];

  // 55%本身仍属于第一阶段；只有严格低于55%才触发，且阶段不可逆。
  if (phase === 1 && hpRatio < BOSS_PHASE_RULES.phaseTwoThreshold) {
    phase = 2;
    if (!roarTriggered) {
      roarTriggered = true;
      events.push({ type: 'roar', phase: 2, once: true });
    }
  }

  if (phase === 2) {
    shockwaveElapsedMs += safeDelta;
    while (shockwaveElapsedMs >= BOSS_PHASE_RULES.shockwaveIntervalMs) {
      shockwaveElapsedMs -= BOSS_PHASE_RULES.shockwaveIntervalMs;
      shockwaveSequence += 1;
      events.push({
        type: 'shockwave',
        id: `boss-shockwave-${shockwaveSequence}`,
        sequence: shockwaveSequence,
        avoidable: true,
        interruptible: true,
        telegraphMs: BOSS_PHASE_RULES.shockwaveTelegraphMs,
      });
    }
  }

  return {
    ...state,
    currentHp: hp,
    phase,
    roarTriggered,
    shockwaveElapsedMs,
    shockwaveSequence,
    events,
  };
}

export function getBossModifiers(state) {
  const phaseTwo = state?.phase === 2;
  return {
    phase: phaseTwo ? 2 : 1,
    canAct: !state?.dead,
    moveSpeedMultiplier: state?.dead ? 0 : phaseTwo ? BOSS_PHASE_RULES.phaseTwoMoveSpeedMultiplier : 1,
    attackIntervalMultiplier: phaseTwo ? BOSS_PHASE_RULES.phaseTwoAttackIntervalMultiplier : 1,
    shockwaveIntervalMs: phaseTwo ? BOSS_PHASE_RULES.shockwaveIntervalMs : null,
  };
}
