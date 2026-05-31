import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { loadSave } from '../storage/SaveData';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildMenu();
  }

  private buildBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);

    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(0.5, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.8)
      );
      this.tweens.add({
        targets: star,
        alpha: 0.05,
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  private buildTitle(): void {
    this.add.text(GAME_WIDTH / 2, 100, 'しくん&ちゃくん', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '54px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#5a4cd0',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 160, 'モンスターバトル', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#9be7ff',
    }).setOrigin(0.5);

    // Show monster sprites preview
    const monsterKeys = [
      { key: 'chakun_front', x: 180 },
      { key: 'shikun_front', x: GAME_WIDTH / 2 },
      { key: 'lily_front', x: GAME_WIDTH - 180 },
    ];

    for (const { key, x } of monsterKeys) {
      if (this.textures.exists(key)) {
        const sprite = this.add.image(x, 290, key).setScale(2.5).setAlpha(0.7);
        this.tweens.add({
          targets: sprite,
          y: 285,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Phaser.Math.Between(0, 500),
        });
      }
    }
  }

  private buildMenu(): void {
    const buttons = [
      { label: '⚔ バトル', sub: '2人で対戦', color: 0xff6b6b, action: () => this.startBattle() },
      { label: '🌿 クエスト', sub: 'モンスターを倒して仲間に', color: 0x66ccff, action: () => this.startQuest() },
      { label: '📦 マイモンスター', sub: '所持モンスター一覧', color: 0xffd700, action: () => this.openMonsterList() },
    ];

    const totalW = buttons.length * 260 + (buttons.length - 1) * 20;
    let startX = (GAME_WIDTH - totalW) / 2;

    for (const btn of buttons) {
      const x = startX + 130;
      const y = 440;

      const bg = this.add.rectangle(x, y, 260, 80, btn.color, 0.15);
      bg.setStrokeStyle(2, btn.color, 0.8);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y - 12, btn.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const sub = this.add.text(x, y + 18, btn.sub, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#aaaaaa',
      }).setOrigin(0.5);

      bg.on('pointerover', () => {
        bg.setAlpha(0.35);
        this.tweens.add({ targets: [label, sub], y: { value: '-=3' }, duration: 80 });
      });
      bg.on('pointerout', () => {
        bg.setAlpha(0.15);
        label.y += 3;
        sub.y += 3;
      });
      bg.on('pointerdown', btn.action);

      startX += 280;
    }
  }

  private startBattle(): void {
    const save = loadSave();
    this.scene.start('TeamSelect', {
      mode: 'pvp',
      save,
      playerNum: 1,
      p1Team: null,
    });
  }

  private startQuest(): void {
    const save = loadSave();
    this.scene.start('TeamSelect', {
      mode: 'quest',
      save,
      playerNum: 1,
      p1Team: null,
    });
  }

  private openMonsterList(): void {
    const save = loadSave();
    this.scene.start('MonsterList', { save });
  }
}
