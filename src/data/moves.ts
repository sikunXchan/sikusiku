import type { MoveDef } from './types';

export const MOVES: Record<string, MoveDef> = {
  kawasu: {
    id: 'kawasu',
    name: 'かわす',
    cooldownTurns: 2,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'dodge', value: 1 }],
    color: 0x9be7ff,
    description: '必中でない技を避ける (2ターン毎)',
  },
  chakken: {
    id: 'chakken',
    name: 'ちゃっけん',
    cooldownTurns: 1,
    baseDamage: 50,
    guaranteed: false,
    effects: [],
    color: 0xffa552,
    description: '50ダメージを与える (毎ターン)',
  },
  drumming: {
    id: 'drumming',
    name: 'ドラミング',
    cooldownTurns: 2,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'drumming', value: 1.2 }],
    color: 0xff8c00,
    description: '次の与ダメ×1.2 & 被ダメ×1.2 (2ターン毎)',
  },
  shikken: {
    id: 'shikken',
    name: 'しっけん',
    cooldownTurns: 2,
    baseDamage: 70,
    guaranteed: false,
    effects: [{ type: 'damageTakenUp', value: 1.1 }],
    color: 0x66ccff,
    description: '70ダメ (自分の被ダメ×1.1) (2ターン毎)',
  },
  backflip: {
    id: 'backflip',
    name: 'バックフリップ',
    cooldownTurns: 3,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'reduceCooldowns', value: 1 }],
    color: 0xc0ff70,
    description: '全技を1ターン短縮 (3ターン毎)',
  },
  kamitsuku: {
    id: 'kamitsuku',
    name: 'かみつく',
    cooldownTurns: 1,
    baseDamage: 55,
    guaranteed: false,
    effects: [],
    color: 0xff6b9d,
    description: '55ダメージを与える (毎ターン)',
  },
  furueru: {
    id: 'furueru',
    name: '震える',
    cooldownTurns: 3,
    baseDamage: 0,
    guaranteed: false,
    effects: [
      { type: 'atkDown', value: 0.8 },
      { type: 'conditionalDamage', value: 100 },
    ],
    color: 0xd070ff,
    description: '相手ATK-20% / 相手不攻撃なら100ダメ (3ターン毎)',
  },
};

export function getMove(id: string): MoveDef {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}
