import type { MonsterDef } from './types';

export const MONSTERS: Record<string, MonsterDef> = {
  chakun: {
    id: 'chakun',
    name: 'ちゃくん',
    type: 'fight',
    frontSprite: 'chakun_front',
    backSprite: 'chakun_back',
    baseStats: { hp: 220, atk: 100, def: 110 },
    moveIds: ['kawasu', 'chakken', 'drumming'],
    catchRate: 30,
  },
  shikun: {
    id: 'shikun',
    name: 'しくん',
    type: 'normal',
    frontSprite: 'shikun_front',
    backSprite: 'shikun_back',
    baseStats: { hp: 200, atk: 120, def: 90 },
    moveIds: ['kawasu', 'shikken', 'backflip'],
    catchRate: 25,
  },
  lily: {
    id: 'lily',
    name: 'リリー',
    type: 'nature',
    frontSprite: 'lily_front',
    backSprite: 'lily_back',
    baseStats: { hp: 240, atk: 90, def: 100 },
    moveIds: ['kawasu', 'kamitsuku', 'furueru'],
    catchRate: 35,
  },
  medama: {
    id: 'medama',
    name: 'めだまモンスター',
    type: 'mystic',
    frontSprite: 'medama_front',
    backSprite: 'medama_back',
    baseStats: { hp: 190, atk: 95, def: 105 },
    moveIds: ['akumanoroi', 'kyuushoNoroi', 'raimei'],
    catchRate: 20,
  },
  darkking: {
    id: 'darkking',
    name: '闇の王',
    type: 'dark',
    frontSprite: 'darkking_front',
    backSprite: 'darkking_back',
    baseStats: { hp: 210, atk: 130, def: 70 },
    moveIds: ['yamiNoTsurugi', 'shikkokunoTsurugi', 'kawasu2'],
    catchRate: 15,
  },
  roncha: {
    id: 'roncha',
    name: 'ロンチャ',
    type: 'nature',
    frontSprite: 'roncha_front',
    backSprite: 'roncha_back',
    baseStats: { hp: 200, atk: 80, def: 130 },
    moveIds: ['shinpiNoroi', 'migawari', 'hakkyou'],
    catchRate: 25,
  },
  darkshikun: {
    id: 'darkshikun',
    name: '闇堕ちしくん',
    type: 'dark',
    frontSprite: 'darkshikun_front',
    backSprite: 'darkshikun_back',
    baseStats: { hp: 190, atk: 115, def: 95 },
    moveIds: ['kyoufu', 'haki', 'yamiNoShikken'],
    catchRate: 20,
  },
};

export const MONSTER_IDS = Object.keys(MONSTERS) as (keyof typeof MONSTERS)[];

export function getMonsterDef(id: string): MonsterDef {
  const d = MONSTERS[id];
  if (!d) throw new Error(`Unknown monster: ${id}`);
  return d;
}
