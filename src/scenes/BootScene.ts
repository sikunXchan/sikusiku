import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('chakun_front', 'chakun.PNG');
    this.load.image('chakun_back', 'chakun_behind.PNG');
    this.load.image('shikun_front', 'shikun.PNG');
    this.load.image('shikun_back', 'shikun_behind.PNG');
    this.load.image('lily_front', 'lily.PNG');
    this.load.image('lily_back', 'lily_behind.PNG');
    this.load.image('splash', 'E70C9508-DA99-44B5-983B-A35932A601AF.png');
  }

  create(): void {
    this.makeParticleTexture();
    this.scene.start('Title');
  }

  private makeParticleTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }
}
