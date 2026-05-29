// ゲーム設計書に対応した型定義。
// キャラと技はすべてデータとして定義し、将来の追加をデータ追加だけで行えるようにする。

/** キャラの基礎ステータス。設計書「キャラの仕組み」に対応。 */
export interface Stats {
  /** 体力 */
  hp: number;
  /** 攻撃力 */
  atk: number;
  /** 防御力 */
  def: number;
  /** 速度（移動速度の基準） */
  spd: number;
  /** クリティカル率（0〜1の割合）。設計書では LUK がクリティカル率。 */
  luk: number;
}

/** 技のカテゴリー。設計書「カテゴリー一覧」に対応（MVPでは一部のみ挙動を実装）。 */
export type SkillCategory =
  | 'tackle' // タックル: 前進してダメージ
  | 'dodge' // かわす: 相手の技を避ける（短時間無敵）
  | 'chargeShot' // チャージショット: 溜めて段階ダメージ
  | 'chargeBreak'; // チャージブレイク: 溜め後に強烈な一撃

/** 技の定義。 */
export interface Skill {
  id: string;
  /** 表示名（日本語） */
  name: string;
  /** ボタン用の短い表示名（省略時は name を使用）。 */
  short?: string;
  category: SkillCategory;
  /** 技の基礎ダメージ（ダメージ計算式の basedamage）。攻撃でない技は 0。 */
  baseDamage: number;
  /** チャージショット/ブレイクの段階数（各段階で baseDamage 分を加算）。 */
  stages?: number;
  /** 段階ごとの倍率上昇（例: +1.0 で +100%）。設計書の「倍率」に対応。 */
  stageMultiplier?: number;
  /** 攻撃の届く距離（px）。 */
  range: number;
  /** クールタイム（ms）。 */
  cooldown: number;
  /** チャージブレイク等の溜め時間（ms）。 */
  chargeTime?: number;
  /** かわす技の無敵時間（ms）。 */
  invulnTime?: number;
  /** 必殺技枠かどうか（⭐︎ 印の技）。 */
  ultimate?: boolean;
  /** UI 表示用の色（16進）。 */
  color: number;
}

/** キャラの定義。 */
export interface CharacterDef {
  id: string;
  name: string;
  /** 体の色（仮ドット絵生成用）。 */
  bodyColor: number;
  /** 基礎ステータス。 */
  stats: Stats;
  /** このキャラが使える技 id の並び。 */
  skills: string[];
}
