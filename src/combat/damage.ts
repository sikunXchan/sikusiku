// ダメージ計算式（Phaser 非依存の純粋関数。単体テスト対象）。
// 設計書「キャラの仕組み」:
//   技のダメージ = 技の basedamage × (ATK / 相手の DEF)
//   LUK = クリティカル率

export interface DamageInput {
  baseDamage: number;
  atk: number;
  /** 相手の防御力 */
  enemyDef: number;
  /** 段階倍率（チャージショット等）。既定 1。 */
  stageMultiplier?: number;
  /** クリティカルかどうか。 */
  isCritical?: boolean;
  /** クリティカル倍率。既定 1.5。 */
  critMultiplier?: number;
}

export const DEFAULT_CRIT_MULTIPLIER = 1.5;

/** 設計書の計算式に基づき最終ダメージを算出する。 */
export function computeDamage(input: DamageInput): number {
  const {
    baseDamage,
    atk,
    enemyDef,
    stageMultiplier = 1,
    isCritical = false,
    critMultiplier = DEFAULT_CRIT_MULTIPLIER,
  } = input;

  if (enemyDef <= 0) throw new Error('enemyDef must be > 0');

  let dmg = baseDamage * (atk / enemyDef) * stageMultiplier;
  if (isCritical) dmg *= critMultiplier;
  return Math.max(0, Math.floor(dmg));
}

/** LUK(クリティカル率)に基づきクリティカル判定を行う。rng は 0〜1。 */
export function rollCritical(luk: number, rng: number = Math.random()): boolean {
  return rng < luk;
}

/**
 * チャージショット/ブレイクの段階倍率を求める。
 * stages 段階で各段階 stageMultiplier ずつ倍率が上がる想定。
 * 例: stages=3, stageMultiplier=1.0 → 1 + 1.0 + 1.0 = 3.0（最終段でフル）。
 * level は 1〜stages。
 */
export function stageMultiplierAt(level: number, stageMultiplier: number): number {
  const clamped = Math.max(1, level);
  return 1 + (clamped - 1) * stageMultiplier;
}
