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
    this.buildNikukyuBadge();
  }

  private buildBackground(): void {
    if (this.textures.exists('splash')) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash');
      const scaleX = GAME_WIDTH / img.width;
      const scaleY = GAME_HEIGHT / img.height;
      img.setScale(Math.max(scaleX, scaleY));
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 110, GAME_WIDTH, 220, 0x000000, 0.65);
  }

  private buildTitle(): void {
    this.add.text(GAME_WIDTH / 2, 80, 'しくん&ちゃくん', {
      fontFamily: 'system-ui, sans-serif', fontSize: '54px', color: '#ffffff',
      fontStyle: 'bold', stroke: '#1a1530', strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 148, 'モンスターバトル', {
      fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: '#9be7ff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
  }

  private buildMenu(): void {
    const buttons = [
      { label: '🌿 クエスト',      sub: 'モンスターを倒して仲間に', color: 0x66ccff, action: () => this.startQuest() },
      { label: '📡 ちかくで対戦', sub: '別デバイスで無線対戦',       color: 0xcc88ff, action: () => this.openLobby() },
      { label: '📦 マイモンスター', sub: '所持モンスター一覧',         color: 0xffd700, action: () => this.openMonsterList() },
      { label: '📖 図鑑',          sub: '全モンスターを確認',          color: 0x88ffcc, action: () => this.openEncyclopedia() },
    ];

    // 2 columns × 2 rows
    const BTN_W = 430;
    const BTN_H = 72;
    const GAP_X = 20;
    const ROW1_Y = 408;
    const ROW2_Y = 490;
    const LEFT_X  = GAME_WIDTH / 2 - BTN_W / 2 - GAP_X / 2;
    const RIGHT_X = GAME_WIDTH / 2 + BTN_W / 2 + GAP_X / 2;
    const xs = [LEFT_X, RIGHT_X, LEFT_X, RIGHT_X];
    const ys = [ROW1_Y, ROW1_Y, ROW2_Y, ROW2_Y];

    buttons.forEach((btn, i) => {
      const x = xs[i];
      const y = ys[i];

      const bg = this.add.rectangle(x, y, BTN_W, BTN_H, btn.color, 0.12);
      bg.setStrokeStyle(2, btn.color, 0.7);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y - 11, btn.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const sub = this.add.text(x, y + 15, btn.sub, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#aaaaaa',
      }).setOrigin(0.5);

      bg.on('pointerover', () => { bg.setAlpha(0.32); this.tweens.add({ targets: [label, sub], y: { value: '-=3' }, duration: 80 }); });
      bg.on('pointerout',  () => { bg.setAlpha(0.12); label.y += 3; sub.y += 3; });
      bg.on('pointerdown', btn.action);
    });
  }

  private buildNikukyuBadge(): void {
    const save = loadSave();
    const nikukyu = save.nikukyu ?? 0;
    if (this.textures.exists('nikukyu')) {
      this.add.image(GAME_WIDTH - 60, 30, 'nikukyu').setDisplaySize(30, 30);
    }
    this.add.text(GAME_WIDTH - 38, 30, `×${nikukyu}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffbb88',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0, 0.5);
  }

  private openLobby(): void { this.scene.start('Lobby'); }

  private startQuest(): void {
    const save = loadSave();
    this.scene.start('TeamSelect', { mode: 'quest', save, playerNum: 1, p1Team: null });
  }

  private openMonsterList(): void {
    const save = loadSave();
    this.scene.start('MonsterList', { save });
  }

  private openEncyclopedia(): void {
    this.scene.start('Encyclopedia');
  }
}
