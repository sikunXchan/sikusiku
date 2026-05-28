import Phaser from 'phaser';

// ド派手な演出をまとめたヘルパー。パーティクル・画面シェイク・ヒットフラッシュ・チャージ光。

export class Effects {
  constructor(private scene: Phaser.Scene) {}

  /** ヒット時の火花パーティクル。 */
  hitBurst(x: number, y: number, color: number, big = false): void {
    const count = big ? 28 : 14;
    const emitter = this.scene.add.particles(x, y, 'spark', {
      speed: { min: big ? 180 : 100, max: big ? 460 : 260 },
      angle: { min: 0, max: 360 },
      scale: { start: big ? 1.6 : 1.0, end: 0 },
      lifespan: { min: 250, max: big ? 650 : 450 },
      quantity: count,
      tint: [color, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.explode(count);
    this.scene.time.delayedCall(800, () => emitter.destroy());

    // 衝撃リング
    const ring = this.scene.add.circle(x, y, big ? 12 : 8, color, 0.5);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      radius: big ? 80 : 44,
      alpha: 0,
      duration: big ? 420 : 280,
      onComplete: () => ring.destroy(),
    });
  }

  /** 画面シェイク。 */
  shake(intensity = 0.008, duration = 160): void {
    this.scene.cameras.main.shake(duration, intensity);
  }

  /** ヒットした対象を白く点滅させる。 */
  flash(target: Phaser.GameObjects.Sprite): void {
    target.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => target.clearTint());
  }

  /** チャージ中の集中光。完了まで対象に追従するエミッタを返す。 */
  chargeAura(target: Phaser.GameObjects.Sprite, color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, 'spark', {
      speed: { min: 30, max: 90 },
      scale: { start: 0.2, end: 1.0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 400,
      frequency: 30,
      tint: [color, 0xffffff],
      blendMode: 'ADD',
      // 周囲から中心へ吸い込まれる演出
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, 50),
        quantity: 16,
      },
      moveToX: 0,
      moveToY: 0,
    });
    emitter.startFollow(target, 0, -10);
    return emitter;
  }

  /** ダッシュ/回避時の残像トレイル。 */
  dashTrail(target: Phaser.GameObjects.Sprite, color: number): void {
    const ghost = this.scene.add.sprite(target.x, target.y, target.texture.key);
    ghost.setTint(color);
    ghost.setAlpha(0.5);
    ghost.setScale(target.scaleX, target.scaleY);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
  }
}
