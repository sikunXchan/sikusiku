// Core types for turn-based monster battle game

export interface IVs {
  hp: number;   // 0-100
  atk: number;
  def: number;
}

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
}

/** IV multiplier: 1 + (iv / 100) * 0.2  (max +20% at IV=100) */
export function applyIV(base: number, iv: number): number {
  return Math.round(base * (1 + (iv / 100) * 0.2));
}

export interface MonsterDef {
  id: string;
  name: string;
  frontSprite: string;
  backSprite: string;
  baseStats: BaseStats;
  moveIds: string[];   // up to 3 (4th unlockable later)
  catchRate: number;   // 0-100 percent chance
}

export interface OwnedMonster {
  uid: string;
  defId: string;
  ivs: IVs;
}

export type MoveEffectType =
  | 'dodge'              // avoid non-guaranteed moves this turn
  | 'drumming'           // next damage dealt ×N AND next damage taken ×N (on self)
  | 'atkDown'            // reduce TARGET's ATK by multiplier (e.g. 0.8 = -20%)
  | 'reduceCooldowns'    // backflip: reduce all own cooldowns by 1 turn
  | 'conditionalDamage'  // tremble: deal N damage if opponent didn't attack
  | 'damageTakenUp';     // shikken self-debuff: next incoming hit ×N

export interface MoveEffect {
  type: MoveEffectType;
  value: number;
}

export interface MoveDef {
  id: string;
  name: string;
  cooldownTurns: number;  // can use once every N turns (1 = every turn)
  baseDamage: number;     // 0 for non-damage moves
  guaranteed: boolean;    // true = cannot be dodged
  effects: MoveEffect[];
  color: number;          // hex color for UI/animations
  description: string;
}

export type StatusEffectType = 'damageBoostSelf' | 'damageTakenBoostSelf' | 'atkDown';

export interface StatusEffect {
  type: StatusEffectType;
  multiplier: number;
  turnsLeft: number;  // -1 = until-consumed (one-shot), >0 = N turns duration
  delay: number;      // 0 = active now, >0 = activate after N turns (for simultaneous resolution)
}

export interface BattleMonster {
  owned: OwnedMonster;
  monsterDef: MonsterDef;
  currentHp: number;
  maxHp: number;
  atkStat: number;
  defStat: number;
  moveCooldowns: Record<string, number>;  // moveId -> next available turn number
  statusEffects: StatusEffect[];
  fainted: boolean;
  dodgingThisTurn: boolean;
}

export interface MoveAction { type: 'move'; moveId: string }
export interface SwitchAction { type: 'switch'; targetIndex: number }
export interface NoneAction { type: 'none' }
export type BattleAction = MoveAction | SwitchAction | NoneAction;

export type BattlePhase = 'selecting' | 'revealing' | 'animating' | 'forcedSwitch' | 'forcedAttack' | 'gameOver';

// Battle events produced by BattleEngine.resolveTurn()
export type BattleEvent =
  | { type: 'revealActions'; p1: BattleAction; p2: BattleAction }
  | { type: 'switch'; player: 1 | 2; fromIdx: number; toIdx: number }
  | { type: 'dodge'; player: 1 | 2 }
  | { type: 'attack'; player: 1 | 2; moveId: string; damage: number; critical: boolean; dodged: boolean }
  | { type: 'buff'; player: 1 | 2; moveId: string; description: string }
  | { type: 'atkDebuff'; player: 1 | 2; target: 1 | 2 }
  | { type: 'conditionalDamage'; player: 1 | 2; damage: number; dodged: boolean }
  | { type: 'faint'; player: 1 | 2 }
  | { type: 'gameOver'; winner: 1 | 2 };
