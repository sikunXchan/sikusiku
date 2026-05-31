import { getMove } from '../data/moves';
import { getMonsterDef } from '../data/monsters';
import { applyIV } from '../data/types';
import type {
  BattleAction,
  BattleEvent,
  BattleMonster,
  OwnedMonster,
  StatusEffect,
  StatusEffectType,
} from '../data/types';

export const CRIT_RATE = 0.1;
export const CRIT_MULT = 1.5;

export function createBattleMonster(owned: OwnedMonster): BattleMonster {
  const def = getMonsterDef(owned.defId);
  const maxHp = applyIV(def.baseStats.hp, owned.ivs.hp);
  return {
    owned,
    monsterDef: def,
    currentHp: maxHp,
    maxHp,
    atkStat: applyIV(def.baseStats.atk, owned.ivs.atk),
    defStat: applyIV(def.baseStats.def, owned.ivs.def),
    moveCooldowns: {},
    statusEffects: [],
    fainted: false,
    dodgingThisTurn: false,
  };
}

export class BattleEngine {
  public p1Team: BattleMonster[];
  public p2Team: BattleMonster[];
  public p1ActiveIdx = 0;
  public p2ActiveIdx = 0;
  public turn = 1;

  constructor(p1Team: BattleMonster[], p2Team: BattleMonster[]) {
    this.p1Team = p1Team;
    this.p2Team = p2Team;
  }

  get p1Active(): BattleMonster { return this.p1Team[this.p1ActiveIdx]; }
  get p2Active(): BattleMonster { return this.p2Team[this.p2ActiveIdx]; }

  isMoveReady(monster: BattleMonster, moveId: string): boolean {
    if (this.hasStatus(monster, 'bind') || this.hasStatus(monster, 'counterFailed')) return false;
    return (monster.moveCooldowns[moveId] ?? 0) <= this.turn;
  }

  canSwitch(monster: BattleMonster): boolean {
    return !this.hasStatus(monster, 'bind') && !this.hasStatus(monster, 'counterFailed');
  }

  private clearSwitchStatus(monster: BattleMonster): void {
    const toClear = new Set<StatusEffectType>([
      'burn', 'paralyze', 'poison', 'confuse', 'bind',
      'atkDown', 'damageTakenBoostSelf', 'damageBoostSelf',
      'counterFailed', 'atkDebuffOnOpponent',
    ]);
    monster.statusEffects = monster.statusEffects.filter(se => !toClear.has(se.type));
  }

  availableMoves(monster: BattleMonster): string[] {
    return monster.monsterDef.moveIds.filter(id => this.isMoveReady(monster, id));
  }

  availableSwitchTargets(team: BattleMonster[], activeIdx: number): number[] {
    return team
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => !m.fainted && i !== activeIdx)
      .map(({ i }) => i);
  }

  hasStatus(monster: BattleMonster, type: StatusEffectType): boolean {
    return monster.statusEffects.some(se => se.type === type && se.delay === 0 && se.turnsLeft !== 0);
  }

  resolveTurn(p1Action: BattleAction, p2Action: BattleAction): BattleEvent[] {
    const events: BattleEvent[] = [];
    events.push({ type: 'revealActions', p1: p1Action, p2: p2Action });

    // Switches first
    if (p1Action.type === 'switch' && this.canSwitch(this.p1Active)) {
      const from = this.p1ActiveIdx;
      this.clearSwitchStatus(this.p1Team[from]);
      this.p1ActiveIdx = p1Action.targetIndex;
      events.push({ type: 'switch', player: 1, fromIdx: from, toIdx: p1Action.targetIndex });
    }
    if (p2Action.type === 'switch' && this.canSwitch(this.p2Active)) {
      const from = this.p2ActiveIdx;
      this.clearSwitchStatus(this.p2Team[from]);
      this.p2ActiveIdx = p2Action.targetIndex;
      events.push({ type: 'switch', player: 2, fromIdx: from, toIdx: p2Action.targetIndex });
    }

    const p1 = this.p1Active;
    const p2 = this.p2Active;

    const p1Attacking = p1Action.type === 'move' && getMove(p1Action.moveId).baseDamage > 0;
    const p2Attacking = p2Action.type === 'move' && getMove(p2Action.moveId).baseDamage > 0;

    // Dodge flags
    if (p1Action.type === 'move' && getMove(p1Action.moveId).effects.some(e => e.type === 'dodge')) {
      p1.dodgingThisTurn = true;
      events.push({ type: 'dodge', player: 1 });
    }
    if (p2Action.type === 'move' && getMove(p2Action.moveId).effects.some(e => e.type === 'dodge')) {
      p2.dodgingThisTurn = true;
      events.push({ type: 'dodge', player: 2 });
    }

    // Counter flags
    if (p1Action.type === 'move' && getMove(p1Action.moveId).effects.some(e => e.type === 'counter')) {
      p1.statusEffects.push({ type: 'counterReady', turnsLeft: 1, delay: 0 });
    }
    if (p2Action.type === 'move' && getMove(p2Action.moveId).effects.some(e => e.type === 'counter')) {
      p2.statusEffects.push({ type: 'counterReady', turnsLeft: 1, delay: 0 });
    }

    // Snapshot ATK before mutations
    const p1AtkSnap = this.snapshotAtk(p1);
    const p2AtkSnap = this.snapshotAtk(p2);

    // Resolve moves (non-dodge, non-counter)
    if (p1Action.type === 'move') {
      const mv = getMove(p1Action.moveId);
      if (!mv.effects.some(e => e.type === 'dodge' || e.type === 'counter')) {
        this.processMoveEffects(p1, p2, p1AtkSnap, p1Action.moveId, events, 1, p2Attacking);
      }
    }
    if (p2Action.type === 'move') {
      const mv = getMove(p2Action.moveId);
      if (!mv.effects.some(e => e.type === 'dodge' || e.type === 'counter')) {
        this.processMoveEffects(p2, p1, p2AtkSnap, p2Action.moveId, events, 2, p1Attacking);
      }
    }

    // Resolve counter
    if (this.hasStatus(p1, 'counterReady')) {
      this.resolveCounter(p1, p2, p2Action, p2AtkSnap, events, 1);
    }
    if (this.hasStatus(p2, 'counterReady')) {
      this.resolveCounter(p2, p1, p1Action, p1AtkSnap, events, 2);
    }

    // Dodge cooldown
    if (p1Action.type === 'move' && getMove(p1Action.moveId).effects.some(e => e.type === 'dodge')) {
      p1.moveCooldowns[p1Action.moveId] = this.turn + getMove(p1Action.moveId).cooldownTurns;
    }
    if (p2Action.type === 'move' && getMove(p2Action.moveId).effects.some(e => e.type === 'dodge')) {
      p2.moveCooldowns[p2Action.moveId] = this.turn + getMove(p2Action.moveId).cooldownTurns;
    }

    // Counter cooldown
    if (p1Action.type === 'move' && getMove(p1Action.moveId).effects.some(e => e.type === 'counter')) {
      p1.moveCooldowns[p1Action.moveId] = this.turn + getMove(p1Action.moveId).cooldownTurns;
    }
    if (p2Action.type === 'move' && getMove(p2Action.moveId).effects.some(e => e.type === 'counter')) {
      p2.moveCooldowns[p2Action.moveId] = this.turn + getMove(p2Action.moveId).cooldownTurns;
    }

    // Clear this-turn flags
    p1.dodgingThisTurn = false;
    p2.dodgingThisTurn = false;
    p1.statusEffects = p1.statusEffects.filter(se => se.type !== 'counterReady');
    p2.statusEffects = p2.statusEffects.filter(se => se.type !== 'counterReady');

    // Status tick damage
    this.tickStatusDamage(p1, events, 1);
    this.tickStatusDamage(p2, events, 2);

    // Tick durations
    this.tickStatusEffects(p1);
    this.tickStatusEffects(p2);

    this.turn++;

    if (p1.fainted) events.push({ type: 'faint', player: 1 });
    if (p2.fainted) events.push({ type: 'faint', player: 2 });

    const p1Alive = this.p1Team.some(m => !m.fainted);
    const p2Alive = this.p2Team.some(m => !m.fainted);
    if (!p1Alive) events.push({ type: 'gameOver', winner: 2 });
    else if (!p2Alive) events.push({ type: 'gameOver', winner: 1 });

    return events;
  }

  private resolveCounter(
    user: BattleMonster,
    opponent: BattleMonster,
    oppAction: BattleAction,
    oppAtkSnap: number,
    events: BattleEvent[],
    player: 1 | 2,
  ): void {
    const oppAttacking = oppAction.type === 'move' && getMove(oppAction.moveId).baseDamage > 0;

    if (!oppAttacking) {
      // Counter failed: apply bind to self next turn
      user.statusEffects.push({ type: 'counterFailed', turnsLeft: 1, delay: 1 });
      events.push({ type: 'counter', player, damage: 0, failed: true });
      return;
    }

    // Calculate what the opponent's damage would have been
    const oppMove = getMove((oppAction as { moveId: string }).moveId);
    const rawDmg = this.calcDamage(opponent, user, oppAtkSnap, oppMove.baseDamage, false);

    // Reflect back to opponent
    opponent.currentHp = Math.max(0, opponent.currentHp - rawDmg);
    if (opponent.currentHp <= 0) opponent.fainted = true;

    events.push({ type: 'counter', player, damage: rawDmg, failed: false });
  }

  /** Bonus turn after forced switch: BOTH sides get to attack */
  resolveBonusTurn(p1Action: BattleAction, p2Action: BattleAction): BattleEvent[] {
    const events: BattleEvent[] = [];

    const p1 = this.p1Active;
    const p2 = this.p2Active;

    const p1Attacking = p1Action.type === 'move';
    const p2Attacking = p2Action.type === 'move';

    const p1AtkSnap = this.snapshotAtk(p1);
    const p2AtkSnap = this.snapshotAtk(p2);

    if (p1Attacking && p1Action.type === 'move') {
      this.processMoveEffects(p1, p2, p1AtkSnap, p1Action.moveId, events, 1, p2Attacking);
    }
    if (p2Attacking && p2Action.type === 'move') {
      this.processMoveEffects(p2, p1, p2AtkSnap, p2Action.moveId, events, 2, p1Attacking);
    }

    // Clear this-turn dodge flags
    p1.dodgingThisTurn = false;
    p2.dodgingThisTurn = false;

    if (p1.fainted) events.push({ type: 'faint', player: 1 });
    if (p2.fainted) events.push({ type: 'faint', player: 2 });

    const p1Alive = this.p1Team.some(m => !m.fainted);
    const p2Alive = this.p2Team.some(m => !m.fainted);
    if (!p1Alive) events.push({ type: 'gameOver', winner: 2 });
    else if (!p2Alive) events.push({ type: 'gameOver', winner: 1 });

    return events;
  }

  /** @deprecated use resolveBonusTurn */
  resolveBonusAttack(player: 1 | 2, action: BattleAction): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (action.type !== 'move') return events;

    const attacker = player === 1 ? this.p1Active : this.p2Active;
    const defender = player === 1 ? this.p2Active : this.p1Active;
    const atkSnap = this.snapshotAtk(attacker);

    this.processMoveEffects(attacker, defender, atkSnap, action.moveId, events, player, false);

    if (attacker.fainted) events.push({ type: 'faint', player });
    if (defender.fainted) events.push({ type: 'faint', player: (player === 1 ? 2 : 1) as 1 | 2 });

    const p1Alive = this.p1Team.some(m => !m.fainted);
    const p2Alive = this.p2Team.some(m => !m.fainted);
    if (!p1Alive) events.push({ type: 'gameOver', winner: 2 });
    else if (!p2Alive) events.push({ type: 'gameOver', winner: 1 });

    return events;
  }

  doForcedSwitch(player: 1 | 2, targetIdx: number): void {
    if (player === 1) this.p1ActiveIdx = targetIdx;
    else this.p2ActiveIdx = targetIdx;
  }

  captureNetState(): import('../net/messages').GameNetState {
    const snap = (team: BattleMonster[]) => team.map(m => ({
      currentHp: m.currentHp, fainted: m.fainted,
      moveCooldowns: { ...m.moveCooldowns },
      statusEffects: m.statusEffects.map(se => ({ ...se })),
      atkStat: m.atkStat, defStat: m.defStat,
    }));
    return { turn: this.turn, p1ActiveIdx: this.p1ActiveIdx, p2ActiveIdx: this.p2ActiveIdx, p1Team: snap(this.p1Team), p2Team: snap(this.p2Team) };
  }

  applyNetState(state: import('../net/messages').GameNetState): void {
    this.turn = state.turn;
    this.p1ActiveIdx = state.p1ActiveIdx;
    this.p2ActiveIdx = state.p2ActiveIdx;
    const apply = (team: BattleMonster[], states: import('../net/messages').MonsterNetState[]) => {
      for (let i = 0; i < team.length && i < states.length; i++) {
        const s = states[i];
        team[i].currentHp = s.currentHp; team[i].fainted = s.fainted;
        team[i].moveCooldowns = { ...s.moveCooldowns };
        team[i].statusEffects = (s.statusEffects as StatusEffect[]).map(se => ({ ...se }));
        team[i].atkStat = s.atkStat; team[i].defStat = s.defStat;
      }
    };
    apply(this.p1Team, state.p1Team);
    apply(this.p2Team, state.p2Team);
  }

  private snapshotAtk(m: BattleMonster): number {
    let atk = m.atkStat;
    for (const se of m.statusEffects) {
      if (se.type === 'atkDown' && se.delay === 0) {
        atk = Math.floor(atk * (se.multiplier ?? 0.8));
      }
    }
    return atk;
  }

  private processMoveEffects(
    attacker: BattleMonster,
    defender: BattleMonster,
    atkSnap: number,
    moveId: string,
    events: BattleEvent[],
    player: 1 | 2,
    opponentAttacked: boolean,
  ): void {
    const move = getMove(moveId);
    attacker.moveCooldowns[moveId] = this.turn + move.cooldownTurns;

    // Paralysis check: 20% chance move fails
    if (this.hasStatus(attacker, 'paralyze') && Math.random() < 0.2) {
      events.push({ type: 'statusTick', player, statusType: 'paralyze', damage: 0 });
      return;
    }
    // Confusion check: 15% chance fails + self damage
    if (this.hasStatus(attacker, 'confuse') && Math.random() < 0.15) {
      const selfDmg = Math.max(1, Math.floor(attacker.atkStat / 16));
      attacker.currentHp = Math.max(0, attacker.currentHp - selfDmg);
      if (attacker.currentHp <= 0) attacker.fainted = true;
      events.push({ type: 'statusTick', player, statusType: 'confuse', damage: selfDmg });
      return;
    }

    for (const effect of move.effects) {
      switch (effect.type) {
        case 'drumming':
          attacker.statusEffects.push({ type: 'damageBoostSelf', multiplier: effect.value, turnsLeft: -1, delay: 0 });
          attacker.statusEffects.push({ type: 'damageTakenBoostSelf', multiplier: effect.value, turnsLeft: -1, delay: 0 });
          events.push({ type: 'buff', player, moveId, description: `与ダメ×${effect.value} & 被ダメ×${effect.value}` });
          break;
        case 'damageTakenUp':
          attacker.statusEffects.push({ type: 'damageTakenBoostSelf', multiplier: effect.value, turnsLeft: -1, delay: 0 });
          break;
        case 'atkDown':
          defender.statusEffects.push({ type: 'atkDown', multiplier: effect.value, turnsLeft: 3, delay: 1 });
          events.push({ type: 'atkDebuff', player, target: player === 1 ? 2 : 1 });
          break;
        case 'reduceCooldowns':
          for (const id of Object.keys(attacker.moveCooldowns)) {
            attacker.moveCooldowns[id] = Math.max(this.turn, (attacker.moveCooldowns[id] ?? 0) - 1);
          }
          events.push({ type: 'buff', player, moveId, description: '全技-1ターン' });
          break;
        case 'conditionalDamage':
          if (!opponentAttacked) {
            const dodged = defender.dodgingThisTurn && !move.guaranteed;
            if (!dodged) {
              const dmg = this.applyDamage(attacker, defender, effect.value, atkSnap, false, events, player);
              events.push({ type: 'conditionalDamage', player, damage: dmg, dodged: false });
            } else {
              events.push({ type: 'conditionalDamage', player, damage: 0, dodged: true });
            }
          }
          break;
        case 'applyParalyze':
          if (!this.hasStatus(defender, 'paralyze')) {
            defender.statusEffects.push({ type: 'paralyze', turnsLeft: effect.value, delay: 0 });
            events.push({ type: 'statusApply', player, target: player === 1 ? 2 : 1, statusType: 'paralyze' });
          }
          break;
        case 'applyBurn':
          if (!this.hasStatus(defender, 'burn')) {
            defender.statusEffects.push({ type: 'burn', turnsLeft: effect.value || 2, delay: 0 });
            events.push({ type: 'statusApply', player, target: player === 1 ? 2 : 1, statusType: 'burn' });
          }
          break;
        case 'applyPoison':
          if (!this.hasStatus(defender, 'poison')) {
            defender.statusEffects.push({ type: 'poison', turnsLeft: effect.value || 2, delay: 0 });
            events.push({ type: 'statusApply', player, target: player === 1 ? 2 : 1, statusType: 'poison' });
          }
          break;
        case 'applyConfuse':
          if (!this.hasStatus(defender, 'confuse')) {
            defender.statusEffects.push({ type: 'confuse', turnsLeft: effect.value || 2, delay: 0 });
            events.push({ type: 'statusApply', player, target: player === 1 ? 2 : 1, statusType: 'confuse' });
          }
          break;
        case 'applyBind':
          if (!this.hasStatus(defender, 'bind')) {
            defender.statusEffects.push({ type: 'bind', turnsLeft: 1, delay: 0 });
            events.push({ type: 'statusApply', player, target: player === 1 ? 2 : 1, statusType: 'bind' });
          }
          break;
        case 'applyCritBoost':
          attacker.statusEffects.push({ type: 'critBoost', turnsLeft: effect.value, delay: 0 });
          events.push({ type: 'buff', player, moveId, description: `${effect.value}ターン間、必ず急所!` });
          break;
        case 'applyAtkDebuff':
          // Persistent ATK debuff on opponent (最悪な呪い: -10% for N turns)
          defender.statusEffects.push({ type: 'atkDebuffOnOpponent', multiplier: 0.9, turnsLeft: effect.value, delay: 0 });
          events.push({ type: 'buff', player, moveId, description: `${effect.value}ターン間、相手ATK-10%` });
          break;
        case 'applyHealPercent':
          // Heal self X% max HP per turn for 2 turns
          attacker.statusEffects.push({ type: 'healPercent', multiplier: effect.value, turnsLeft: 2, delay: 0 });
          events.push({ type: 'buff', player, moveId, description: `2ターン間、毎ターン最大HP${effect.value}%回復` });
          break;
        case 'applyShield':
          if (!this.hasStatus(attacker, 'shield')) {
            attacker.statusEffects.push({ type: 'shield', multiplier: effect.value, turnsLeft: -1, delay: 0 });
            events.push({ type: 'buff', player, moveId, description: `${effect.value}ダメージまで吸収するシールド!` });
          }
          break;
        case 'sacrificeRevive': {
          const team = player === 1 ? this.p1Team : this.p2Team;
          const activeIdx = player === 1 ? this.p1ActiveIdx : this.p2ActiveIdx;
          const fainted = team.map((m, i) => ({ m, i })).filter(({ m, i }) => m.fainted && i !== activeIdx);
          const alive   = team.map((m, i) => ({ m, i })).filter(({ m, i }) => !m.fainted && i !== activeIdx);
          attacker.currentHp = 0;
          attacker.fainted = true;
          if (fainted.length > 0) {
            const pick = fainted[Math.floor(Math.random() * fainted.length)];
            pick.m.currentHp = pick.m.maxHp;
            pick.m.fainted = false;
            pick.m.statusEffects = [];
            events.push({ type: 'sacrifice', player, revived: true, allyIdx: pick.i });
          } else if (alive.length > 0) {
            const pick = alive[Math.floor(Math.random() * alive.length)];
            pick.m.currentHp = pick.m.maxHp;
            events.push({ type: 'sacrifice', player, revived: false, allyIdx: pick.i });
          } else {
            events.push({ type: 'sacrifice', player, revived: false, allyIdx: -1 });
          }
          return; // no further processing (attacker is dead)
        }
        case 'ohko': {
          const dodged = defender.dodgingThisTurn;
          const countered = this.hasStatus(defender, 'counterReady');
          if (dodged || countered) {
            // Self dies instead
            attacker.currentHp = 0;
            attacker.fainted = true;
            events.push({ type: 'ohko', player, succeeded: false });
          } else {
            // Opponent HP to 0, self takes 100 damage
            defender.currentHp = 0;
            defender.fainted = true;
            const selfDmg = Math.min(effect.value, attacker.currentHp - 1);
            attacker.currentHp = Math.max(1, attacker.currentHp - selfDmg);
            events.push({ type: 'ohko', player, succeeded: true });
          }
          break;
        }
        default:
          break;
      }
    }

    if (move.baseDamage > 0) {
      const dodged = defender.dodgingThisTurn && !move.guaranteed;
      const countered = !dodged && this.hasStatus(defender, 'counterReady');
      if (dodged) {
        events.push({ type: 'attack', player, moveId, damage: 0, critical: false, dodged: true });
      } else if (countered) {
        // Damage will be resolved in resolveCounter
        events.push({ type: 'attack', player, moveId, damage: 0, critical: false, dodged: false });
      } else {
        const forceCrit = this.hasStatus(attacker, 'critBoost');
        const critical = forceCrit || Math.random() < CRIT_RATE;
        const raw = this.calcDamage(attacker, defender, atkSnap, move.baseDamage, critical);
        const actual = this.applyDamage(attacker, defender, raw, atkSnap, critical, events, player);
        events.push({ type: 'attack', player, moveId, damage: actual, critical, dodged: false });
      }
    }
  }

  private calcDamage(
    attacker: BattleMonster,
    defender: BattleMonster,
    atkSnap: number,
    baseDmg: number,
    critical: boolean,
  ): number {
    // Apply atkDebuffOnOpponent (最悪な呪い: reduces attacker's effective ATK)
    let effectiveAtk = atkSnap;
    for (const se of attacker.statusEffects) {
      if (se.type === 'atkDebuffOnOpponent' && se.delay === 0) {
        effectiveAtk = Math.floor(effectiveAtk * (se.multiplier ?? 0.9));
      }
    }

    let dmg = Math.floor(baseDmg * (effectiveAtk / 100) * (100 / Math.max(1, defender.defStat)));

    const boostIdx = attacker.statusEffects.findIndex(se => se.type === 'damageBoostSelf' && se.delay === 0);
    if (boostIdx >= 0) {
      dmg = Math.floor(dmg * (attacker.statusEffects[boostIdx].multiplier ?? 1));
      attacker.statusEffects.splice(boostIdx, 1);
    }

    if (critical) dmg = Math.floor(dmg * CRIT_MULT);
    return Math.max(1, dmg);
  }

  private applyDamage(
    attacker: BattleMonster,
    defender: BattleMonster,
    damage: number,
    _atkSnap: number,
    _critical: boolean,
    events?: BattleEvent[],
    atkPlayer?: 1|2,
  ): number {
    const takenIdx = defender.statusEffects.findIndex(se => se.type === 'damageTakenBoostSelf' && se.delay === 0);
    let mult = 1;
    if (takenIdx >= 0) {
      mult = defender.statusEffects[takenIdx].multiplier ?? 1;
      defender.statusEffects.splice(takenIdx, 1);
    }

    let final = Math.floor(damage * mult);

    // Shield absorption
    const shieldIdx = defender.statusEffects.findIndex(se => se.type === 'shield' && se.delay === 0);
    if (shieldIdx >= 0 && events && atkPlayer !== undefined) {
      const se = defender.statusEffects[shieldIdx];
      const remaining = se.multiplier ?? 50;
      const absorbed = Math.min(final, remaining);
      se.multiplier = remaining - absorbed;
      final -= absorbed;
      if (se.multiplier <= 0) {
        // Shield breaks — reflect 50% of total capacity (25) back to attacker
        defender.statusEffects.splice(shieldIdx, 1);
        const reflectedDmg = 25; // half of 50 cap
        attacker.currentHp = Math.max(0, attacker.currentHp - reflectedDmg);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        const defPlayer: 1|2 = atkPlayer === 1 ? 2 : 1;
        events.push({ type: 'shieldBreak', player: defPlayer, reflectDamage: reflectedDmg });
      }
    }

    defender.currentHp = Math.max(0, defender.currentHp - final);
    if (defender.currentHp <= 0) defender.fainted = true;
    return final;
  }

  private tickStatusDamage(monster: BattleMonster, events: BattleEvent[], player: 1 | 2): void {
    for (const se of monster.statusEffects) {
      if (se.delay > 0) continue;
      if (se.type === 'burn') {
        const dmg = Math.max(1, Math.floor(monster.maxHp / 18));
        monster.currentHp = Math.max(0, monster.currentHp - dmg);
        if (monster.currentHp <= 0) monster.fainted = true;
        events.push({ type: 'statusTick', player, statusType: 'burn', damage: dmg });
      } else if (se.type === 'poison') {
        const dmg = Math.max(1, Math.floor(monster.currentHp / 8));
        monster.currentHp = Math.max(0, monster.currentHp - dmg);
        if (monster.currentHp <= 0) monster.fainted = true;
        events.push({ type: 'statusTick', player, statusType: 'poison', damage: dmg });
      } else if (se.type === 'healPercent') {
        const amt = Math.max(1, Math.floor(monster.maxHp * (se.multiplier ?? 10) / 100));
        monster.currentHp = Math.min(monster.maxHp, monster.currentHp + amt);
        events.push({ type: 'heal', player, amount: amt });
      }
    }
  }

  private tickStatusEffects(monster: BattleMonster): void {
    monster.statusEffects = monster.statusEffects.filter((se: StatusEffect) => {
      if (se.delay > 0) { se.delay--; return true; }
      if (se.turnsLeft < 0) return true;
      se.turnsLeft--;
      return se.turnsLeft > 0;
    });
  }
}
