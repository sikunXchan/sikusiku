import Phaser from 'phaser';
import type { CharacterDef } from '../data/types';
import { GROUND_Y } from '../main';

// 戦闘中のキャラ。物理スプライトと戦闘状態（HP・クールタイム・無敵・行動中）を持つ。

export class Fighter {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public currentHp: number;
  public readonly maxHp: number;
  /** 向き。1 = 右, -1 = 左。 */
  public facing: 1 | -1 = 1;
  /** 行動中（技の発動中・溜め中）は移動/他技を制限。 */
  public busy = false;

  private invulnUntil = 0;
  private cooldowns = new Map<string, number>();

  constructor(
    public scene: Phaser.Scene,
    public def: CharacterDef,
    x: number,
    facing: 1 | -1
  ) {
    this.maxHp = def.stats.hp;
    this.currentHp = def.stats.hp;
    this.facing = facing;

    // 表示は2倍。原点は中央（Arcadeボディの扱いを単純にするため）。
    this.sprite = scene.physics.add.sprite(x, GROUND_Y - 80, def.id);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(2);
    this.faceTo(facing);
  }

  faceTo(dir: 1 | -1): void {
    this.facing = dir;
    this.sprite.setFlipX(dir === -1);
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  /** ヒット表示用：体の上あたり。 */
  get centerY(): number {
    return this.sprite.y - 70;
  }

  isOnGround(): boolean {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnUntil;
  }

  setInvulnerable(now: number, ms: number): void {
    this.invulnUntil = now + ms;
  }

  isReady(skillId: string, now: number): boolean {
    if (this.busy) return false;
    const readyAt = this.cooldowns.get(skillId) ?? 0;
    return now >= readyAt;
  }

  cooldownRemaining(skillId: string, now: number): number {
    const readyAt = this.cooldowns.get(skillId) ?? 0;
    return Math.max(0, readyAt - now);
  }

  triggerCooldown(skillId: string, now: number, ms: number): void {
    this.cooldowns.set(skillId, now + ms);
  }

  moveX(velocity: number): void {
    if (this.busy) {
      this.sprite.setVelocityX(0);
      return;
    }
    this.sprite.setVelocityX(velocity);
    if (velocity !== 0) this.faceTo(velocity > 0 ? 1 : -1);
  }

  stop(): void {
    this.sprite.setVelocityX(0);
  }

  jump(): void {
    if (this.busy || !this.isOnGround()) return;
    this.sprite.setVelocityY(-620);
  }

  /** ダメージを適用し、実際に減ったHPを返す。 */
  applyDamage(amount: number): number {
    const before = this.currentHp;
    this.currentHp = Math.max(0, this.currentHp - amount);
    return before - this.currentHp;
  }

  get isDead(): boolean {
    return this.currentHp <= 0;
  }

  get hpRatio(): number {
    return this.currentHp / this.maxHp;
  }

  distanceTo(other: Fighter): number {
    return Math.abs(this.x - other.x);
  }
}
