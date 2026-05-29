import Phaser from 'phaser';

// モバイル用の操作: 左半分のフローティング・ジョイスティック + 右側のジャンプボタン。
// 技ボタンは SkillBar 側。マルチタッチ対応。

export class TouchControls {
  /** 横方向の入力。-1(左)〜+1(右)。デッドゾーン処理済み。 */
  axisX = 0;

  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private home: { x: number; y: number };
  private pointerId: number | null = null;
  private readonly radius = 78;
  private readonly zoneRatio = 0.5; // 画面左半分をジョイスティック領域とする

  constructor(scene: Phaser.Scene, onJump: () => void) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.home = { x: 160, y: H - 120 };

    // ジョイスティック本体
    this.base = scene.add
      .circle(this.home.x, this.home.y, this.radius, 0x66ccff, 0.16)
      .setStrokeStyle(4, 0xffffff, 0.45)
      .setDepth(900);
    this.knob = scene.add
      .circle(this.home.x, this.home.y, this.radius * 0.46, 0x66ccff, 0.45)
      .setStrokeStyle(3, 0xffffff, 0.7)
      .setDepth(901);

    // ジャンプボタン（技ボタンの左隣・右側ゾーン内）
    const jump = scene.add.container(W - 360, H - 92).setDepth(900);
    const jumpCircle = scene.add.circle(0, 0, 50, 0x9be7ff, 0.32).setStrokeStyle(3, 0xffffff, 0.6);
    jumpCircle.setInteractive(new Phaser.Geom.Circle(0, 0, 50), Phaser.Geom.Circle.Contains);
    const jumpText = scene.add.text(0, 0, '⤴', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '40px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    jump.add([jumpCircle, jumpText]);
    jumpCircle.on('pointerdown', () => {
      jumpCircle.setAlpha(0.6);
      onJump();
      scene.time.delayedCall(120, () => jumpCircle.setAlpha(0.32));
    });

    // ── ジョイスティック入力 ──
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null) return;
      if (p.x > W * this.zoneRatio) return; // 右側はジャンプ/技に任せる
      this.pointerId = p.id;
      // フローティング: 押した位置に土台を移動
      const bx = Phaser.Math.Clamp(p.x, this.radius, W * this.zoneRatio);
      const by = Phaser.Math.Clamp(p.y, this.radius, H - this.radius);
      this.base.setPosition(bx, by).setAlpha(0.28);
      this.knob.setPosition(bx, by).setAlpha(0.75);
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      const dx = p.x - this.base.x;
      const dy = p.y - this.base.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.radius);
      const ang = Math.atan2(dy, dx);
      this.knob.setPosition(
        this.base.x + Math.cos(ang) * clamped,
        this.base.y + Math.sin(ang) * clamped
      );
      let ax = (Math.cos(ang) * clamped) / this.radius;
      if (Math.abs(ax) < 0.18) ax = 0; // デッドゾーン
      this.axisX = ax;
    });

    const reset = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = null;
      this.axisX = 0;
      this.base.setPosition(this.home.x, this.home.y).setAlpha(0.16);
      this.knob.setPosition(this.home.x, this.home.y).setAlpha(0.45);
    };
    scene.input.on('pointerup', reset);
    scene.input.on('pointerupoutside', reset);
  }
}
