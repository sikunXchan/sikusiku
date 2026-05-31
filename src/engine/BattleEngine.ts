import { getMove } from '../data/moves';
import { getMonsterDef } from '../data/monsters';
import { applyIV } from '../data/types';
import type {
  BattleAction,
  BattleEvent,
  BattleMonster,
  OwnedMonster,
  StatusEffect,
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
    return (monster.moveCooldowns[moveId] ?? 0) <= this.turn;
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

  resolveTurn(p1Action: BattleAction, p2Action: BattleAction): BattleEvent[] {
    const events: BattleEvent[] = [];

    events.push({ type: 'revealActions', p1: p1Action, p2: p2Action });

    // Switches happen first
    if (p1Action.type === 'switch') {
      const from = this.p1ActiveIdx;
      this.p1ActiveIdx = p1Action.targetIndex;
      events.push({ type: 'switch', player: 1, fromIdx: from, toIdx: p1Action.targetIndex });
    }
    if (p2Action.type === 'switch') {
      const from = this.p2ActiveIdx;
      this.p2ActiveIdx = p2Action.targetIndex;
      events.push({ type: 'switch', player: 2, fromIdx: from, toIdx: p2Action.targetIndex });
    }

    const p1 = this.p1Active;
    const p2 = this.p2Active;

    // Determine if each player is attacking (for conditionalDamage)
    const p1Attacking = p1Action.type === 'move' && getMove(p1Action.moveId).baseDamage > 0;
    const p2Attacking = p2Action.type === 'move' && getMove(p2Action.moveId).baseDamage > 0;

    // Set dodge flags before processing any damage
    if (p1Action.type === 'move' && getMove(p1Action.moveId).effects.some(e => e.type === 'dodge')) {
      p1.dodgingThisTurn = true;
      events.push({ type: 'dodge', player: 1 });
    }
    if (p2Action.type === 'move' && getMove(p2Action.moveId).effects.some(e => e.type === 'dodge')) {
      p2.dodgingThisTurn = true;
      events.push({ type: 'dodge', player: 2 });
    }

    // Process both moves (simultaneous: compute damage from snapshot stats)
    const p1AtkSnap = this.snapshotAtk(p1);
    const p2AtkSnap = this.snapshotAtk(p2);

    if (p1Action.type === 'move' && !getMove(p1Action.moveId).effects.some(e => e.type === 'dodge')) {
      this.processMoveEffects(p1, p2, p1AtkSnap, p1Action.moveId, events, 1, p2Attacking);
    }
    if (p2Action.type === 'move' && !getMove(p2Action.moveId).effects.some(e => e.type === 'dodge')) {
      this.processMoveEffects(p2, p1, p2AtkSnap, p2Action.moveId, events, 2, p1Attacking);
    }

    // Apply dodge cooldowns
    if (p1Action.type === 'move' && getMove(p1Action.moveId).effects.some(e => e.type === 'dodge')) {
      p1.moveCooldowns[p1Action.moveId] = this.turn + getMove(p1Action.moveId).cooldownTurns;
    }
    if (p2Action.type === 'move' && getMove(p2Action.moveId).effects.some(e => e.type === 'dodge')) {
      p2.moveCooldowns[p2Action.moveId] = this.turn + getMove(p2Action.moveId).cooldownTurns;
    }

    // Clear dodge flags
    p1.dodgingThisTurn = false;
    p2.dodgingThisTurn = false;

    // Tick status effects
    this.tickStatusEffects(p1);
    this.tickStatusEffects(p2);

    this.turn++;

    // Check faints and game over
    if (p1.fainted) events.push({ type: 'faint', player: 1 });
    if (p2.fainted) events.push({ type: 'faint', player: 2 });

    const p1Alive = this.p1Team.some(m => !m.fainted);
    const p2Alive = this.p2Team.some(m => !m.fainted);
    if (!p1Alive) events.push({ type: 'gameOver', winner: 2 });
    else if (!p2Alive) events.push({ type: 'gameOver', winner: 1 });

    return events;
  }

  /** Resolve a "bonus attack" from a forced-switch replacement monster */
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

  /** Perform a forced switch for a fainted monster */
  doForcedSwitch(player: 1 | 2, targetIdx: number): void {
    if (player === 1) {
      this.p1ActiveIdx = targetIdx;
    } else {
      this.p2ActiveIdx = targetIdx;
    }
  }

  private snapshotAtk(m: BattleMonster): number {
    let atk = m.atkStat;
    for (const se of m.statusEffects) {
      if (se.type === 'atkDown' && se.delay === 0) {
        atk = Math.floor(atk * se.multiplier);
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
          // delay=1 so it takes effect next turn (simultaneous resolution fairness)
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
              const dmg = this.applyDamage(attacker, defender, effect.value, atkSnap, false);
              events.push({ type: 'conditionalDamage', player, damage: dmg, dodged: false });
            } else {
              events.push({ type: 'conditionalDamage', player, damage: 0, dodged: true });
            }
          }
          break;
      }
    }

    if (move.baseDamage > 0) {
      const dodged = defender.dodgingThisTurn && !move.guaranteed;
      if (dodged) {
        events.push({ type: 'attack', player, moveId, damage: 0, critical: false, dodged: true });
      } else {
        const critical = Math.random() < CRIT_RATE;
        const raw = this.calcDamage(attacker, defender, atkSnap, move.baseDamage, critical);
        const actual = this.applyDamage(attacker, defender, raw, atkSnap, critical);
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
    let dmg = Math.floor(baseDmg * (atkSnap / 100) * (100 / Math.max(1, defender.defStat)));

    // Consume damage boost
    const boostIdx = attacker.statusEffects.findIndex(se => se.type === 'damageBoostSelf' && se.delay === 0);
    if (boostIdx >= 0) {
      dmg = Math.floor(dmg * attacker.statusEffects[boostIdx].multiplier);
      attacker.statusEffects.splice(boostIdx, 1);
    }

    if (critical) dmg = Math.floor(dmg * CRIT_MULT);
    return Math.max(1, dmg);
  }

  private applyDamage(
    _attacker: BattleMonster,
    defender: BattleMonster,
    damage: number,
    _atkSnap: number,
    _critical: boolean,
  ): number {
    // Consume damageTakenBoost
    const takenIdx = defender.statusEffects.findIndex(se => se.type === 'damageTakenBoostSelf' && se.delay === 0);
    let mult = 1;
    if (takenIdx >= 0) {
      mult = defender.statusEffects[takenIdx].multiplier;
      defender.statusEffects.splice(takenIdx, 1);
    }

    const final = Math.floor(damage * mult);
    defender.currentHp = Math.max(0, defender.currentHp - final);
    if (defender.currentHp <= 0) defender.fainted = true;
    return final;
  }

  private tickStatusEffects(monster: BattleMonster): void {
    monster.statusEffects = monster.statusEffects.filter((se: StatusEffect) => {
      if (se.delay > 0) {
        se.delay--;
        return true;
      }
      if (se.turnsLeft < 0) return true; // until-consumed
      se.turnsLeft--;
      return se.turnsLeft > 0;
    });
  }
}
