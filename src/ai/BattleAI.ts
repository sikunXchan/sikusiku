import { getMove } from '../data/moves';
import type { BattleAction, BattleMonster } from '../data/types';
import type { BattleEngine } from '../engine/BattleEngine';

export class BattleAI {
  decide(engine: BattleEngine, player: 1 | 2): BattleAction {
    const team = player === 1 ? engine.p1Team : engine.p2Team;
    const activeIdx = player === 1 ? engine.p1ActiveIdx : engine.p2ActiveIdx;
    const monster = player === 1 ? engine.p1Active : engine.p2Active;

    const moves = engine.availableMoves(monster);

    if (moves.length === 0) {
      const switches = engine.availableSwitchTargets(team, activeIdx);
      if (switches.length > 0) {
        return { type: 'switch', targetIndex: switches[0] };
      }
      return { type: 'none' };
    }

    // Prefer attacking moves 70% of the time
    const attackMoves = moves.filter(id => getMove(id).baseDamage > 0);
    const utilityMoves = moves.filter(id => getMove(id).baseDamage === 0 && getMove(id).id !== 'kawasu');
    const dodge = moves.find(id => id === 'kawasu');

    const r = Math.random();

    // Use utility move (buff/debuff) sometimes
    if (utilityMoves.length > 0 && r < 0.25) {
      const id = utilityMoves[Math.floor(Math.random() * utilityMoves.length)];
      return { type: 'move', moveId: id };
    }

    // Use dodge occasionally
    if (dodge && r < 0.15) {
      return { type: 'move', moveId: dodge };
    }

    // Prefer attack
    if (attackMoves.length > 0) {
      const id = attackMoves[Math.floor(Math.random() * attackMoves.length)];
      return { type: 'move', moveId: id };
    }

    const id = moves[Math.floor(Math.random() * moves.length)];
    return { type: 'move', moveId: id };
  }

  /** Choose which monster to send in after a forced switch */
  chooseForcedSwitch(
    team: BattleMonster[],
    activeIdx: number,
    engine: BattleEngine,
    _player: 1 | 2,
  ): number {
    const targets = engine.availableSwitchTargets(team, activeIdx);
    if (targets.length === 0) return activeIdx;
    // Pick the one with most HP remaining
    let best = targets[0];
    for (const i of targets) {
      if (team[i].currentHp > team[best].currentHp) best = i;
    }
    return best;
  }
}
