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
  moveIds: string[];
  catchRate: number;
}

export interface OwnedMonster {
  uid: string;
  defId: string;
  ivs: IVs;
}

export type MoveEffectType =
  | 'dodge'
  | 'drumming'
  | 'atkDown'
  | 'reduceCooldowns'
  | 'conditionalDamage'
  | 'damageTakenUp'
  | 'applyBurn'
  | 'applyParalyze'
  | 'applyPoison'
  | 'applyConfuse'
  | 'applyBind'
  | 'applyCritBoost'
  | 'applyAtkDebuff'
  | 'counter'
  | 'ohko'
  | 'applyHeal'
  | 'applyBarrier'
  | 'applyExplosion'
  | 'applyShield'
  | 'applyHealPercent'
  | 'sacrificeRevive';

export interface MoveEffect {
  type: MoveEffectType;
  value: number;
}

export interface MoveDef {
  id: string;
  name: string;
  cooldownTurns: number;
  baseDamage: number;
  guaranteed: boolean;
  effects: MoveEffect[];
  color: number;
  description: string;
  category?: 'physical' | 'special' | 'status' | 'curse' | 'barrier' | 'heal' | 'explosion' | 'counter' | 'sacrifice' | 'shield';
}

export type StatusEffectType =
  | 'damageBoostSelf'
  | 'damageTakenBoostSelf'
  | 'atkDown'
  | 'burn'
  | 'paralyze'
  | 'poison'
  | 'confuse'
  | 'bind'
  | 'critBoost'
  | 'atkDebuffOnOpponent'
  | 'counterReady'
  | 'counterFailed'
  | 'shield'
  | 'healPercent';

export interface StatusEffect {
  type: StatusEffectType;
  multiplier?: number;
  turnsLeft: number;  // -1 = until-consumed, >0 = N turns
  delay: number;      // 0 = active now, >0 = delayed
}

export interface BattleMonster {
  owned: OwnedMonster;
  monsterDef: MonsterDef;
  currentHp: number;
  maxHp: number;
  atkStat: number;
  defStat: number;
  moveCooldowns: Record<string, number>;
  statusEffects: StatusEffect[];
  fainted: boolean;
  dodgingThisTurn: boolean;
}

export interface MoveAction { type: 'move'; moveId: string }
export interface SwitchAction { type: 'switch'; targetIndex: number }
export interface NoneAction { type: 'none' }
export type BattleAction = MoveAction | SwitchAction | NoneAction;

export type BattlePhase = 'selecting' | 'revealing' | 'animating' | 'forcedSwitch' | 'forcedAttack' | 'gameOver';

export type BattleEvent =
  | { type: 'revealActions'; p1: BattleAction; p2: BattleAction }
  | { type: 'switch'; player: 1 | 2; fromIdx: number; toIdx: number }
  | { type: 'dodge'; player: 1 | 2 }
  | { type: 'attack'; player: 1 | 2; moveId: string; damage: number; critical: boolean; dodged: boolean }
  | { type: 'buff'; player: 1 | 2; moveId: string; description: string }
  | { type: 'atkDebuff'; player: 1 | 2; target: 1 | 2 }
  | { type: 'conditionalDamage'; player: 1 | 2; damage: number; dodged: boolean }
  | { type: 'counter'; player: 1 | 2; damage: number; failed: boolean }
  | { type: 'ohko'; player: 1 | 2; succeeded: boolean }
  | { type: 'statusApply'; player: 1 | 2; target: 1 | 2; statusType: StatusEffectType }
  | { type: 'statusTick'; player: 1 | 2; statusType: StatusEffectType; damage: number }
  | { type: 'heal'; player: 1 | 2; amount: number }
  | { type: 'shieldBreak'; player: 1 | 2; reflectDamage: number }
  | { type: 'sacrifice'; player: 1 | 2; revived: boolean; allyIdx: number }
  | { type: 'faint'; player: 1 | 2 }
  | { type: 'gameOver'; winner: 1 | 2 };
