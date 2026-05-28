import Phaser from 'phaser';

// 画面上部に表示するHPバー。なめらかに減少する。

export class HealthBar {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private displayRatio = 1;
  private readonly width = 360;
  private readonly height = 22;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    color: number,
    alignRight = false
  ) {
    const originX = alignRight ? 1 : 0;
    this.bg = scene.add.rectangle(x, y, this.width, this.height, 0x000000, 0.5).setOrigin(originX, 0);
    this.bg.setStrokeStyle(2, 0xffffff, 0.7);
    this.fill = scene.add.rectangle(
      alignRight ? x - 2 : x + 2,
      y + 2,
      this.width - 4,
      this.height - 4,
      color
    ).setOrigin(originX, 0);
    scene.add.text(x, y - 22, name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(originX, 0);
  }

  /** 0〜1 の割合をセット（補間表示）。 */
  setRatio(ratio: number): void {
    this.displayRatio = Phaser.Math.Clamp(ratio, 0, 1);
  }

  update(): void {
    const target = this.displayRatio;
    const current = this.fill.width / (this.width - 4);
    const next = Phaser.Math.Linear(current, target, 0.15);
    this.fill.width = (this.width - 4) * next;
    // 残量で色を変える（緑→黄→赤の代わりにアルファ演出）
    this.fill.setAlpha(next < 0.25 ? 0.6 + Math.sin(this.scene.time.now / 120) * 0.3 : 1);
  }
}
