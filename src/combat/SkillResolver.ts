import Phaser from 'phaser';
import type { Skill } from '../data/types';
import { Fighter } from './Fighter';
import { Effects } from '../fx/Effects';
import { computeDamage, rollCritical, stageMultiplierAt } from './damage';
import { showDamage, showLabel } from '../ui/DamageText';

// 技カテゴリーごとの挙動を解決する。設計書「カテゴリー一覧」に対応。

export class SkillResolver {
  constructor(
    private scene: Phaser.Scene,
    private fx: Effects
  ) {}

  /** 技を発動する。発動できた場合 true。 */
  use(attacker: Fighter, target: Fighter, skill: Skill, now: number, chargeLevel = 1): boolean {
    if (!attacker.isReady(skill.id, now)) return false;

    // 相手の方を向く
    attacker.faceTo(attacker.x <= target.x ? 1 : -1);

    switch (skill.category) {
      case 'tackle':
        this.doTackle(attacker, target, skill, now);
        break;
      case 'dodge':
        this.doDodge(attacker, target, skill, now);
        break;
      case 'chargeShot':
        this.doChargeShot(attacker, target, skill, now, chargeLevel);
        break;
      case 'chargeBreak':
        this.doChargeBreak(attacker, target, skill, now);
        break;
    }

    attacker.triggerCooldown(skill.id, now, skill.cooldown);
    return true;
  }

  /** 前進してダメージ（タックル）。 */
  private doTackle(attacker: Fighter, target: Fighter, skill: Skill, now: number): void {
    attacker.busy = true;
    const dir = attacker.facing;
    attacker.sprite.setVelocityX(dir * 520);
    this.fx.dashTrail(attacker.sprite, skill.color);

    // 突進中の接触判定を少しの間チェック
    let landed = false;
    const check = this.scene.time.addEvent({
      delay: 30,
      repeat: 8,
      callback: () => {
        if (!landed && this.inRange(attacker, target, skill.range)) {
          landed = true;
          this.tryHit(attacker, target, skill, now, 1, false);
          attacker.sprite.setVelocityX(0);
        }
      },
    });

    this.scene.time.delayedCall(280, () => {
      attacker.sprite.setVelocityX(0);
      attacker.busy = false;
      check.remove();
    });
  }

  /** 回避（かわす）。短時間無敵 + 後方ステップ。技にダメージがあれば近接で与える。 */
  private doDodge(attacker: Fighter, target: Fighter, skill: Skill, now: number): void {
    attacker.setInvulnerable(now, skill.invulnTime ?? 400);
    attacker.sprite.setVelocityX(-attacker.facing * 360);
    this.fx.dashTrail(attacker.sprite, skill.color);
    showLabel(this.scene, attacker.x, attacker.centerY, '回避', '#ffe066');

    if (skill.baseDamage > 0 && this.inRange(attacker, target, skill.range)) {
      this.tryHit(attacker, target, skill, now, 1, false);
    }
    this.scene.time.delayedCall(180, () => attacker.sprite.setVelocityX(0));
  }

  /** チャージショット（段階ダメージ）。chargeLevel に応じて倍率上昇。 */
  private doChargeShot(attacker: Fighter, target: Fighter, skill: Skill, now: number, level: number): void {
    const stages = skill.stages ?? 1;
    const lv = Phaser.Math.Clamp(level, 1, stages);
    const mult = stageMultiplierAt(lv, skill.stageMultiplier ?? 0);

    // 前方に衝撃波エフェクト
    const tx = attacker.x + attacker.facing * Math.min(skill.range, attacker.distanceTo(target));
    this.fx.hitBurst(tx, attacker.centerY, skill.color, lv >= stages);

    if (this.inRange(attacker, target, skill.range)) {
      this.tryHit(attacker, target, skill, now, mult, lv >= stages);
    } else {
      showLabel(this.scene, target.x, target.centerY, 'とどかない', '#aaaaaa');
    }
  }

  /** チャージブレイク（溜め後に強烈な一撃）。 */
  private doChargeBreak(attacker: Fighter, target: Fighter, skill: Skill, now: number): void {
    attacker.busy = true;
    attacker.stop();
    const aura = this.fx.chargeAura(attacker.sprite, skill.color);
    showLabel(this.scene, attacker.x, attacker.centerY, 'チャージ…', '#ff4d6d');

    const chargeTime = skill.chargeTime ?? 1500;
    this.scene.time.delayedCall(chargeTime, () => {
      aura.destroy();
      attacker.busy = false;
      if (attacker.isDead) return;

      attacker.faceTo(attacker.x <= target.x ? 1 : -1);
      // 大きな衝撃
      this.fx.shake(0.02, 320);
      const tx = attacker.x + attacker.facing * Math.min(skill.range, attacker.distanceTo(target));
      this.fx.hitBurst(tx, attacker.centerY, skill.color, true);

      // 必殺はクリティカル率上昇のボーナス
      const critBonus = 0.3;
      if (this.inRange(attacker, target, skill.range)) {
        this.tryHit(attacker, target, skill, now, 1, false, critBonus);
      } else {
        showLabel(this.scene, target.x, target.centerY, 'とどかない', '#aaaaaa');
      }
    });
  }

  private inRange(attacker: Fighter, target: Fighter, range: number): boolean {
    const facingTarget = (target.x - attacker.x) * attacker.facing >= -20;
    return facingTarget && attacker.distanceTo(target) <= range;
  }

  /** 命中処理：無敵チェック → クリティカル判定 → ダメージ計算・適用 → 演出。 */
  private tryHit(
    attacker: Fighter,
    target: Fighter,
    skill: Skill,
    now: number,
    stageMultiplier: number,
    big: boolean,
    critBonus = 0
  ): void {
    if (target.isInvulnerable(now)) {
      showLabel(this.scene, target.x, target.centerY, 'かわした!', '#9be7ff');
      return;
    }

    const isCritical = rollCritical(attacker.def.stats.luk + critBonus);
    const dmg = computeDamage({
      baseDamage: skill.baseDamage,
      atk: attacker.def.stats.atk,
      enemyDef: target.def.stats.def,
      stageMultiplier,
      isCritical,
    });

    target.applyDamage(dmg);

    // 演出
    this.fx.hitBurst(target.x, target.centerY, skill.color, big || isCritical);
    this.fx.flash(target.sprite);
    this.fx.shake(isCritical ? 0.012 : 0.006, isCritical ? 220 : 130);
    showDamage(this.scene, target.x, target.centerY, dmg, isCritical);

    // ノックバック
    const knock = (big || isCritical ? 260 : 150) * attacker.facing;
    target.sprite.setVelocityX(knock);
    target.sprite.setVelocityY(-180);
  }
}
