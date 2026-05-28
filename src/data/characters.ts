import type { CharacterDef } from './types';

// キャラの基礎ステータスと技構成。
// 設計書に数値の記載がないため、バランスの取れた仮の初期値を設定（後で調整可）。

export const CHARACTERS: Record<string, CharacterDef> = {
  sikun: {
    id: 'sikun',
    name: 'しくん',
    bodyColor: 0xf3e0c0, // 白〜クリーム色のクマ
    stats: {
      hp: 1000,
      atk: 120,
      def: 100,
      spd: 240, // 移動速度(px/s)。設計書 SPD の基準。
      luk: 0.1, // クリティカル率 10%
    },
    skills: ['shikken', 'smash', 'shikkenDrive'],
  },
  chakun: {
    id: 'chakun',
    name: 'ちゃくん',
    bodyColor: 0xa9703f, // 茶色いクマ
    stats: {
      hp: 1100,
      atk: 110,
      def: 110,
      spd: 210,
      luk: 0.08, // クリティカル率 8%
    },
    skills: ['chakken', 'chaSmash'],
  },
};

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`Unknown character id: ${id}`);
  return c;
}
