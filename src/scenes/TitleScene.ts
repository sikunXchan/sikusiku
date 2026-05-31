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
    // Splash illustration as background
    if (this.textures.exists('splash')) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash');
      // Fit to canvas keeping aspect ratio, then cover
      const scaleX = GAME_WIDTH / img.width;
      const scaleY = GAME_HEIGHT / img.height;
      img.setScale(Math.max(scaleX, scaleY));
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    }
    // Dark gradient overlay for text legibility
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 120, GAME_WIDTH, 240, 0x000000, 0.6);
  }

  private buildTitle(): void {
    this.add.text(GAME_WIDTH / 2, 80, 'しくん&ちゃくん', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '54px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#1a1530',
      strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 148, 'モンスターバトル', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#9be7ff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
  }

  private buildMenu(): void {
    const buttons = [
      { label: '⚔ バトル', sub: '2人で対戦', color: 0xff6b6b, action: () => this.startBattle() },
      { label: '🌿 クエスト', sub: 'モンスターを倒して仲間に', color: 0x66ccff, action: () => this.startQuest() },
      { label: '📡 ちかくで対戦', sub: '別デバイスで無線対戦', color: 0xcc88ff, action: () => this.openLobby() },
      { label: '📦 マイモンスター', sub: '所持モンスター一覧', color: 0xffd700, action: () => this.openMonsterList() },
    ];

    const totalW = buttons.length * 230 + (buttons.length - 1) * 14;
    let startX = (GAME_WIDTH - totalW) / 2;

    for (const btn of buttons) {
      const x = startX + 130;
      const y = 440;

      const bg = this.add.rectangle(x, y, 230, 80, btn.color, 0.15);
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

      startX += 244;
    }
  }

  private openLobby(): void {
    this.scene.start('Lobby');
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
