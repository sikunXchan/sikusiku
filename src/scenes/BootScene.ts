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
    this.load.image('medama_front', 'monster1.PNG');
    this.load.image('medama_back', 'monster1_behind.PNG');
    this.load.image('darkking_front', 'monster2.PNG');
    this.load.image('darkking_back', 'monster2_behind.PNG');
    this.load.image('roncha_front', 'roncha.PNG');
    this.load.image('roncha_back', 'roncha_behind.PNG');
    this.load.image('darkshikun_front', 'shikun_yami.PNG');
    this.load.image('darkshikun_back', 'shikun_yami_behind.PNG');
    this.load.image('lilyenma_front', 'lilyenma.PNG');
    this.load.image('lilyenma_back', 'lilyenma_behind.PNG');
    this.load.image('nikukyu', '6106BD9E-1007-4FC7-A51F-52D13950B21C.png');
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
