import type { MoveDef } from './types';

export const MOVES: Record<string, MoveDef> = {
  // ── ちゃくん moves ────────────────────────────────────────────────────
  kawasu: {
    id: 'kawasu',
    name: 'かわす',
    cooldownTurns: 2,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'dodge', value: 1 }],
    color: 0x9be7ff,
    description: '必中でない技を避ける (2ターン毎)',
    category: 'status',
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
    category: 'physical',
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
    category: 'curse',
  },
  // ── しくん moves ──────────────────────────────────────────────────────
  shikken: {
    id: 'shikken',
    name: 'しっけん',
    cooldownTurns: 2,
    baseDamage: 70,
    guaranteed: false,
    effects: [{ type: 'damageTakenUp', value: 1.1 }],
    color: 0x66ccff,
    description: '70ダメ (自分の被ダメ×1.1) (2ターン毎)',
    category: 'physical',
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
    category: 'status',
  },
  // ── リリー moves ──────────────────────────────────────────────────────
  kamitsuku: {
    id: 'kamitsuku',
    name: 'かみつく',
    cooldownTurns: 1,
    baseDamage: 55,
    guaranteed: false,
    effects: [],
    color: 0xff6b9d,
    description: '55ダメージを与える (毎ターン)',
    category: 'physical',
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
    category: 'curse',
  },
  // ── めだまモンスター moves ─────────────────────────────────────────────
  akumanoroi: {
    id: 'akumanoroi',
    name: '最悪な呪い',
    cooldownTurns: 3,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'applyAtkDebuff', value: 3 }],  // value = turns
    color: 0x880088,
    description: '3ターン間、相手の攻撃力を10%下げる (3ターン毎)',
    category: 'curse',
  },
  kyuushoNoroi: {
    id: 'kyuushoNoroi',
    name: '急所の呪い',
    cooldownTurns: 2,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'applyCritBoost', value: 2 }],  // value = turns
    color: 0xff3388,
    description: '2ターン間、自分の攻撃が全て急所になる (2ターン毎)',
    category: 'curse',
  },
  raimei: {
    id: 'raimei',
    name: '雷鳴',
    cooldownTurns: 2,
    baseDamage: 40,
    guaranteed: true,
    effects: [{ type: 'applyParalyze', value: 2 }],  // value = turns
    color: 0xffee00,
    description: '必中40ダメ + まひ付与 (2ターン毎)',
    category: 'special',
  },
  // ── 闇の王 moves ──────────────────────────────────────────────────────
  counter: {
    id: 'counter',
    name: 'カウンター',
    cooldownTurns: 3,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'counter', value: 1 }],
    color: 0xff4400,
    description: '相手のダメージを反射。不発なら次のターン行動不能 (3ターン毎)',
    category: 'counter',
  },
  shikkokunoTsurugi: {
    id: 'shikkokunoTsurugi',
    name: '漆黒のつるぎ',
    cooldownTurns: 999,  // one-use per battle
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'ohko', value: 100 }],  // value = self HP cost on success
    color: 0x220044,
    description: '相手HPを0にする。無効化されたら自分が倒れる。成功で自HP-100 (1回限り)',
    category: 'special',
  },
  kawasu2: {
    id: 'kawasu2',
    name: 'かわす',
    cooldownTurns: 2,
    baseDamage: 0,
    guaranteed: false,
    effects: [{ type: 'dodge', value: 1 }],
    color: 0x9be7ff,
    description: '必中でない技を避ける (2ターン毎)',
    category: 'status',
  },
};

export function getMove(id: string): MoveDef {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}
