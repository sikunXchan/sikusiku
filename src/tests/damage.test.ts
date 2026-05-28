import { describe, it, expect } from 'vitest';
import {
  computeDamage,
  rollCritical,
  stageMultiplierAt,
  DEFAULT_CRIT_MULTIPLIER,
} from '../combat/damage';

describe('computeDamage', () => {
  it('applies the design-doc formula: base × (atk / enemyDef)', () => {
    // 100 × (120 / 100) = 120
    expect(computeDamage({ baseDamage: 100, atk: 120, enemyDef: 100 })).toBe(120);
  });

  it('applies stage multiplier', () => {
    // 100 × (100/100) × 3 = 300
    expect(
      computeDamage({ baseDamage: 100, atk: 100, enemyDef: 100, stageMultiplier: 3 })
    ).toBe(300);
  });

  it('applies critical multiplier', () => {
    // 100 × 1 × 1.5 = 150
    expect(
      computeDamage({ baseDamage: 100, atk: 100, enemyDef: 100, isCritical: true })
    ).toBe(100 * DEFAULT_CRIT_MULTIPLIER);
  });

  it('floors the result', () => {
    // 100 × (110/100) = 110, but 33 × (10/9) = 36.66 → 36
    expect(computeDamage({ baseDamage: 33, atk: 10, enemyDef: 9 })).toBe(36);
  });

  it('throws on non-positive enemyDef', () => {
    expect(() => computeDamage({ baseDamage: 10, atk: 10, enemyDef: 0 })).toThrow();
  });
});

describe('rollCritical', () => {
  it('is true when rng below luk', () => {
    expect(rollCritical(0.1, 0.05)).toBe(true);
  });
  it('is false when rng at or above luk', () => {
    expect(rollCritical(0.1, 0.1)).toBe(false);
    expect(rollCritical(0.1, 0.5)).toBe(false);
  });
});

describe('stageMultiplierAt', () => {
  it('returns 1 at level 1', () => {
    expect(stageMultiplierAt(1, 1.0)).toBe(1);
  });
  it('grows by stageMultiplier each level', () => {
    expect(stageMultiplierAt(3, 1.0)).toBe(3); // 1 + 2*1.0
    expect(stageMultiplierAt(3, 0.75)).toBe(2.5); // 1 + 2*0.75
  });
});
