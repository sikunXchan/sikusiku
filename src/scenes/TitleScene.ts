import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { loadSave } from '../storage/SaveData';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildMenu();
    this.buildNikukyuBadge();
  }

  private buildBackground(): void {
    if (this.textures.exists('splash')) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash');
      img.setScale(Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height));
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 95, GAME_WIDTH, 190, 0x000000, 0.65);
  }

  private buildTitle(): void {
    this.add.text(GAME_WIDTH / 2, 72, 'しくん&ちゃくん', {
      fontFamily: 'system-ui, sans-serif', fontSize: '52px', color: '#ffffff',
      fontStyle: 'bold', stroke: '#1a1530', strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 140, 'モンスターバトル', {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#9be7ff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
  }

  private buildMenu(): void {
    // 2 cols × 3 rows
    const BTN_W  = 445;
    const BTN_H  = 54;
    const GAP_X  = 20;
    const ROW_YS = [388, 450, 512];
    const LX = GAME_WIDTH / 2 - BTN_W / 2 - GAP_X / 2;
    const RX = GAME_WIDTH / 2 + BTN_W / 2 + GAP_X / 2;

    const buttons = [
      // Row 1
      { label: '🌿 クエスト',      sub: 'モンスターを倒して仲間に', color: 0x66ccff, x: LX, y: ROW_YS[0], action: () => this.startMode('quest')    },
      { label: '⚔️ サバイバル',    sub: 'HP持越しで連勝に挑戦',     color: 0xff8844, x: RX, y: ROW_YS[0], action: () => this.startMode('survival') },
      // Row 2
      { label: '📦 マイモンスター', sub: '所持モンスター一覧',         color: 0xffd700, x: LX, y: ROW_YS[1], action: () => this.openMonsterList()    },
      { label: '📖 図鑑',          sub: '全モンスターを確認',          color: 0x88ffcc, x: RX, y: ROW_YS[1], action: () => this.openEncyclopedia()   },
      // Row 3
      { label: '📡 ちかくで対戦', sub: '別デバイスで無線対戦',        color: 0xcc88ff, x: LX, y: ROW_YS[2], action: () => this.openLobby()          },
      { label: '🛒 ショップ',      sub: 'にくきゅうでアイテムを購入', color: 0xffaa44, x: RX, y: ROW_YS[2], action: () => this.openShop()           },
    ];

    for (const btn of buttons) {
      const bg = this.add.rectangle(btn.x, btn.y, BTN_W, BTN_H, btn.color, 0.12)
        .setStrokeStyle(2, btn.color, 0.7).setInteractive({ useHandCursor: true });
      const label = this.add.text(btn.x, btn.y - 10, btn.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const sub = this.add.text(btn.x, btn.y + 14, btn.sub, {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5);
      bg.on('pointerover', () => { bg.setAlpha(0.30); this.tweens.add({ targets: [label, sub], y: { value: '-=3' }, duration: 80 }); });
      bg.on('pointerout',  () => { bg.setAlpha(0.12); label.y += 3; sub.y += 3; });
      bg.on('pointerdown', btn.action);
    }
  }

  private buildNikukyuBadge(): void {
    const save = loadSave();
    if (this.textures.exists('nikukyu')) {
      this.add.image(GAME_WIDTH - 58, 30, 'nikukyu').setDisplaySize(28, 28);
    }
    this.add.text(GAME_WIDTH - 38, 30, `×${save.nikukyu ?? 0}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffbb88',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0, 0.5);
  }

  private startMode(mode: 'quest' | 'survival'): void {
    const save = loadSave();
    this.scene.start('TeamSelect', { mode, save, playerNum: 1, p1Team: null });
  }

  private openLobby():       void { this.scene.start('Lobby'); }
  private openMonsterList(): void { this.scene.start('MonsterList', { save: loadSave() }); }
  private openEncyclopedia(): void { this.scene.start('Encyclopedia'); }
  private openShop():        void { this.scene.start('Shop'); }
}
