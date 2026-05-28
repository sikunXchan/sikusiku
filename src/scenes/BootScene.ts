import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';

// 仮のドット絵テクスチャを Graphics から生成する。
// あとで本物の画像に差し替える場合は、ここで load.image したものを
// 同じテクスチャキー（キャラ id）で使えばよい。

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    for (const id in CHARACTERS) {
      this.makeBearTexture(id, CHARACTERS[id].bodyColor);
    }
    this.makeParticleTexture();
    this.scene.start('Battle');
  }

  /** 簡単なクマのドット絵テクスチャを生成。原点は中央下（足元）。 */
  private makeBearTexture(key: string, bodyColor: number): void {
    const w = 64;
    const h = 72;
    const g = this.add.graphics();

    const dark = Phaser.Display.Color.ValueToColor(bodyColor).darken(28).color;
    const earColor = dark;

    // 体
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(14, 28, 36, 40, 10);
    // 足
    g.fillRoundedRect(16, 60, 14, 12, 5);
    g.fillRoundedRect(34, 60, 14, 12, 5);
    // 腕
    g.fillRoundedRect(6, 34, 12, 22, 6);
    g.fillRoundedRect(46, 34, 12, 22, 6);
    // 耳
    g.fillStyle(earColor, 1);
    g.fillCircle(20, 12, 9);
    g.fillCircle(44, 12, 9);
    // 頭
    g.fillStyle(bodyColor, 1);
    g.fillCircle(32, 18, 18);
    // マズル
    const muzzle = Phaser.Display.Color.ValueToColor(bodyColor).lighten(12).color;
    g.fillStyle(muzzle, 1);
    g.fillEllipse(32, 24, 18, 12);
    // 目
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(26, 16, 2.5);
    g.fillCircle(38, 16, 2.5);
    // 鼻
    g.fillCircle(32, 22, 2.5);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /** パーティクル用の白い小さな四角テクスチャ。 */
  private makeParticleTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }
}
