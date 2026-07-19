import { createBossPhaseState, getBossModifiers, updateBossPhase } from '../src/game/combat/bossPhases.js';

function assert(condition, message) {
  if (!condition) throw new Error(`Boss阶段模拟失败：${message}`);
}

const timeline = [];
let state = createBossPhaseState(720);
const initialState = state;

function step(label, hp, delta) {
  state = updateBossPhase(state, hp, delta);
  const modifiers = getBossModifiers(state);
  timeline.push({
    步骤: label,
    HP: state.currentHp,
    阶段: state.phase,
    Delta: delta,
    二阶段计时: state.shockwaveElapsedMs,
    事件: state.events.map((event) => event.type).join(', ') || '-',
    移速: modifiers.moveSpeedMultiplier,
    攻击间隔: modifiers.attackIntervalMultiplier,
  });
  return state.events;
}

step('稳定推进', 500, 1000);
assert(state.phase === 1, '高于55%时不应切阶段');
step('正好55%', 396, 1000);
assert(state.phase === 1, '正好55%仍应属于第一阶段');

const transitionEvents = step('低于55%', 395, 0);
assert(state.phase === 2, '低于55%没有进入第二阶段');
assert(transitionEvents.filter((event) => event.type === 'roar').length === 1, '阶段切换必须且只能产生一次怒吼');
assert(initialState.phase === 1 && initialState.roarTriggered === false, 'update不应修改旧state');

const phaseTwoModifiers = getBossModifiers(state);
assert(phaseTwoModifiers.moveSpeedMultiplier === 1.18, '二阶段移速应增加18%');
assert(phaseTwoModifiers.attackIntervalMultiplier === 0.85, '二阶段攻击间隔应减少15%');

const healedEvents = step('回血不降阶', 520, 1000);
assert(state.phase === 2, '回血后阶段不可退回');
assert(healedEvents.every((event) => event.type !== 'roar'), '怒吼不得重复触发');

const clockBeforePause = state.shockwaveElapsedMs;
for (let index = 0; index < 5; index += 1) step(`暂停${index + 1}`, 520, 0);
assert(state.shockwaveElapsedMs === clockBeforePause, 'delta=0时冲击波计时没有冻结');
assert(state.events.length === 0, '暂停时不应产生时间事件');

step('累计到3999ms', 500, 2999);
assert(state.events.length === 0, '不足4秒不应产生冲击波');
const firstShockwave = step('第4000ms', 500, 1);
assert(firstShockwave.length === 1 && firstShockwave[0].type === 'shockwave', '每4秒应产生一次冲击波');
assert(firstShockwave[0].avoidable && firstShockwave[0].interruptible, '冲击波必须可躲避且可打断');

const largeDeltaEvents = step('大帧步进8500ms', 300, 8500);
assert(largeDeltaEvents.filter((event) => event.type === 'shockwave').length === 2, '大delta应补发跨过的两个4秒周期');
assert(state.shockwaveElapsedMs === 500, '大delta余数计时错误');

const deathEvents = step('Boss死亡', 0, 12000);
assert(state.dead && deathEvents.length === 0, '死亡当帧不得产生事件');
const postDeathEvents = step('死亡后更新', 300, 12000);
assert(postDeathEvents.length === 0, '死亡后不得恢复或产生事件');
assert(getBossModifiers(state).canAct === false, '死亡后Boss仍可行动');

console.table(timeline);
console.log('Boss两阶段模拟通过：阶段单次切换、暂停冻结、4秒冲击波与死亡终止均正确。');
