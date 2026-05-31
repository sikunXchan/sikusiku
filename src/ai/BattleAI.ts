import { getMove } from '../data/moves';
import type { BattleAction, BattleMonster } from '../data/types';
import type { BattleEngine } from '../engine/BattleEngine';

export class BattleAI {
  decide(engine: BattleEngine, player: 1 | 2): BattleAction {
    const team = player === 1 ? engine.p1Team : engine.p2Team;
    const activeIdx = player === 1 ? engine.p1ActiveIdx : engine.p2ActiveIdx;
    const monster = player === 1 ? engine.p1Active : engine.p2Active;
    const opponent = player === 1 ? engine.p2Active : engine.p1Active;

    const moves = engine.availableMoves(monster);

    if (moves.length === 0) {
      if (engine.canSwitch(monster)) {
        const switches = engine.availableSwitchTargets(team, activeIdx);
        if (switches.length > 0) {
          return { type: 'switch', targetIndex: this.chooseForcedSwitch(team, activeIdx, engine, player) };
        }
      }
      return { type: 'none' };
    }

    const hpRatio = monster.currentHp / monster.maxHp;
    const oppHpRatio = opponent.currentHp / opponent.maxHp;
    const oppFull = !engine.hasStatus(opponent, 'burn') && !engine.hasStatus(opponent, 'poison')
      && !engine.hasStatus(opponent, 'paralyze') && !engine.hasStatus(opponent, 'confuse')
      && !engine.hasStatus(opponent, 'bind');

    const categorize = (pred: (id: string) => boolean) => moves.filter(pred);

    const attackMoves = categorize(id => {
      const m = getMove(id);
      return m.baseDamage > 0 || m.effects.some(e =>
        e.type === 'maxHpDamage' || e.type === 'ohko' || e.type === 'conditionalDamage');
    });
    const healMoves = categorize(id => getMove(id).effects.some(e => e.type === 'applyHealPercent'));
    const shieldMoves = categorize(id => getMove(id).effects.some(e => e.type === 'applyShield'));
    const statusMoves = categorize(id => getMove(id).effects.some(e =>
      e.type === 'applyBurn' || e.type === 'applyPoison' || e.type === 'applyParalyze'
      || e.type === 'applyConfuse' || e.type === 'applyBind'));
    const buffMoves = categorize(id => getMove(id).effects.some(e =>
      e.type === 'drumming' || e.type === 'applyCritBoost' || e.type === 'applyAtkDebuff'));
    const dodgeMoves = categorize(id => getMove(id).effects.some(e => e.type === 'dodge'));
    const debuffAtkMoves = categorize(id => getMove(id).effects.some(e => e.type === 'atkDown'));

    const r = Math.random();

    // Critically low HP: heal immediately if possible
    if (hpRatio < 0.25 && healMoves.length > 0 && r < 0.9) {
      return { type: 'move', moveId: healMoves[0] };
    }

    // Low HP: use shield
    if (hpRatio < 0.45 && shieldMoves.length > 0
      && !engine.hasStatus(monster, 'shield') && r < 0.65) {
      return { type: 'move', moveId: shieldMoves[0] };
    }

    // Opponent full-health: apply status if possible
    if (oppFull && oppHpRatio > 0.5 && statusMoves.length > 0 && r < 0.4) {
      return { type: 'move', moveId: statusMoves[Math.floor(Math.random() * statusMoves.length)] };
    }

    // ATK debuff on opponent occasionally
    if (debuffAtkMoves.length > 0 && r < 0.25) {
      return { type: 'move', moveId: debuffAtkMoves[0] };
    }

    // Use a buff when at reasonable HP
    if (hpRatio > 0.5 && buffMoves.length > 0 && r < 0.22) {
      return { type: 'move', moveId: buffMoves[Math.floor(Math.random() * buffMoves.length)] };
    }

    // Dodge when opponent likely attacking and AI is healthy
    if (dodgeMoves.length > 0 && hpRatio > 0.6 && oppHpRatio > 0.4 && r < 0.18) {
      return { type: 'move', moveId: dodgeMoves[0] };
    }

    // Attack
    if (attackMoves.length > 0) {
      return { type: 'move', moveId: attackMoves[Math.floor(Math.random() * attackMoves.length)] };
    }

    return { type: 'move', moveId: moves[Math.floor(Math.random() * moves.length)] };
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
    // Pick the one with highest HP percentage (most battle-ready)
    let best = targets[0];
    for (const i of targets) {
      const ratio = team[i].currentHp / team[i].maxHp;
      const bestRatio = team[best].currentHp / team[best].maxHp;
      if (ratio > bestRatio) best = i;
    }
    return best;
  }
}
