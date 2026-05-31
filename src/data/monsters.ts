import type { MonsterDef } from './types';

export const MONSTERS: Record<string, MonsterDef> = {
  chakun: {
    id: 'chakun',
    name: 'ちゃくん',
    frontSprite: 'chakun_front',
    backSprite: 'chakun_back',
    baseStats: { hp: 220, atk: 100, def: 110 },
    moveIds: ['kawasu', 'chakken', 'drumming'],
    catchRate: 30,
  },
  shikun: {
    id: 'shikun',
    name: 'しくん',
    frontSprite: 'shikun_front',
    backSprite: 'shikun_back',
    baseStats: { hp: 200, atk: 120, def: 90 },
    moveIds: ['kawasu', 'shikken', 'backflip'],
    catchRate: 25,
  },
  lily: {
    id: 'lily',
    name: 'リリー',
    frontSprite: 'lily_front',
    backSprite: 'lily_back',
    baseStats: { hp: 240, atk: 90, def: 100 },
    moveIds: ['kawasu', 'kamitsuku', 'furueru'],
    catchRate: 35,
  },
  medama: {
    id: 'medama',
    name: 'めだまモンスター',
    frontSprite: 'medama_front',
    backSprite: 'medama_back',
    baseStats: { hp: 190, atk: 95, def: 105 },
    moveIds: ['akumanoroi', 'kyuushoNoroi', 'raimei'],
    catchRate: 20,
  },
  darkking: {
    id: 'darkking',
    name: '闇の王',
    frontSprite: 'darkking_front',
    backSprite: 'darkking_back',
    baseStats: { hp: 210, atk: 130, def: 70 },
    moveIds: ['counter', 'shikkokunoTsurugi', 'kawasu2'],
    catchRate: 15,
  },
};

export const MONSTER_IDS = Object.keys(MONSTERS) as (keyof typeof MONSTERS)[];

export function getMonsterDef(id: string): MonsterDef {
  const d = MONSTERS[id];
  if (!d) throw new Error(`Unknown monster: ${id}`);
  return d;
}
