import type { BattleAction, BattleEvent, OwnedMonster } from '../data/types';

export interface MonsterNetState {
  currentHp: number;
  fainted: boolean;
  moveCooldowns: Record<string, number>;
  statusEffects: unknown[];
  atkStat: number;
  defStat: number;
}

export interface GameNetState {
  turn: number;
  p1ActiveIdx: number;
  p2ActiveIdx: number;
  p1Team: MonsterNetState[];
  p2Team: MonsterNetState[];
}

export type NetworkMsg =
  | { type: 'team'; team: OwnedMonster[] }
  | { type: 'startBattle'; p1Team: OwnedMonster[]; p2Team: OwnedMonster[] }
  | { type: 'action'; action: BattleAction }
  | { type: 'turnResult'; p1Action: BattleAction; p2Action: BattleAction; events: BattleEvent[]; state: GameNetState }
  | { type: 'forcedSwitch'; player: 1 | 2; idx: number }
  | { type: 'bonusAction'; player: 1 | 2; action: BattleAction; events: BattleEvent[]; state: GameNetState }
  | { type: 'ping' };
