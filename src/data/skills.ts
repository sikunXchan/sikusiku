import type { Skill } from './types';

// 技の定義。MVPでは設計書の技から代表的なものを抜粋して実装する。
// baseDamage 等の数値は仮の値（後でバランス調整可）。

export const SKILLS: Record<string, Skill> = {
  // ── しくん（白いクマ）の技 ──
  shikken: {
    id: 'shikken',
    name: 'しっけん',
    category: 'chargeShot',
    baseDamage: 70,
    stages: 3, // 設計書: 3段階のダメージ
    stageMultiplier: 1.0, // 設計書: 倍率 +100%
    range: 360, // 基準 + 30% のイメージ
    cooldown: 1500,
    color: 0x66ccff,
  },
  smash: {
    id: 'smash',
    name: 'スマッシュ',
    category: 'dodge',
    baseDamage: 40, // 設計書: かわす + ダメージ
    range: 120,
    cooldown: 2500,
    invulnTime: 450,
    color: 0xffe066,
  },
  shikkenDrive: {
    id: 'shikkenDrive',
    name: 'しっけんドライブ',
    short: 'ドライブ',
    category: 'chargeBreak',
    baseDamage: 520, // 強烈な一撃
    range: 300,
    cooldown: 9000,
    chargeTime: 1600, // 設計書では3秒。MVPは操作感優先で短縮（仮）。
    ultimate: true,
    color: 0xff4d6d,
  },

  // ── ちゃくん（茶色いクマ）の技 ──
  chakken: {
    id: 'chakken',
    name: 'ちゃっけん',
    category: 'tackle',
    baseDamage: 95,
    range: 160,
    cooldown: 1400,
    color: 0xffa552,
  },
  chaSmash: {
    id: 'chaSmash',
    name: 'スマッシュ',
    category: 'dodge',
    baseDamage: 0, // 設計書: ちゃくんのスマッシュは回避のみ
    range: 100,
    cooldown: 3000,
    invulnTime: 400,
    color: 0xffd28a,
  },
};

export function getSkill(id: string): Skill {
  const skill = SKILLS[id];
  if (!skill) throw new Error(`Unknown skill id: ${id}`);
  return skill;
}
