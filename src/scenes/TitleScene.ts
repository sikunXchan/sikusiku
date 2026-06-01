import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { loadSave, persistSave } from '../storage/SaveData';
import type { GameSave } from '../storage/SaveData';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildMenu();
    this.buildNikukyuBadge();
    this.buildGearButton();
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
      this.add.image(GAME_WIDTH - 58, 22, 'nikukyu').setDisplaySize(28, 28);
    }
    this.add.text(GAME_WIDTH - 38, 22, `×${save.nikukyu ?? 0}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffbb88',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0, 0.5);
  }

  private buildGearButton(): void {
    const btn = this.add.text(GAME_WIDTH - 12, 50, '⚙️', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setAlpha(0.65);
    btn.on('pointerover', () => btn.setAlpha(1));
    btn.on('pointerout',  () => btn.setAlpha(0.65));
    btn.on('pointerdown', () => this.showSettingsModal());
  }

  private showSettingsModal(): void {
    const D = 500;
    const PW = 300;
    const PH = 190;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.60)
      .setDepth(D).setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);
    panel.add(this.add.rectangle(0, 0, PW, PH, 0x16142a).setStrokeStyle(2, 0x555577));
    panel.add(this.add.text(0, -PH / 2 + 22, '⚙️ セーブデータ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ccccdd', fontStyle: 'bold',
    }).setOrigin(0.5));

    const close = () => { overlay.destroy(); panel.destroy(); };

    // Download button
    const dlBg = this.add.rectangle(0, -22, PW - 40, 42, 0x1a2235).setStrokeStyle(1, 0x4466aa);
    dlBg.setInteractive({ useHandCursor: true });
    dlBg.on('pointerover', () => dlBg.setFillStyle(0x223050));
    dlBg.on('pointerout',  () => dlBg.setFillStyle(0x1a2235));
    dlBg.on('pointerdown', () => { close(); this.downloadSave(); });
    panel.add([dlBg, this.add.text(0, -22, '📤 ダウンロード', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#99bbff',
    }).setOrigin(0.5)]);

    // Load button
    const ldBg = this.add.rectangle(0, 34, PW - 40, 42, 0x1a2235).setStrokeStyle(1, 0x4466aa);
    ldBg.setInteractive({ useHandCursor: true });
    ldBg.on('pointerover', () => ldBg.setFillStyle(0x223050));
    ldBg.on('pointerout',  () => ldBg.setFillStyle(0x1a2235));
    ldBg.on('pointerdown', () => { close(); this.loadSaveFromFile(); });
    panel.add([ldBg, this.add.text(0, 34, '📥 読み込み', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#99bbff',
    }).setOrigin(0.5)]);

    // Close button
    const closeBtn = this.add.text(PW / 2 - 10, -PH / 2 + 12, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ff6666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', close);
    panel.add(closeBtn);

    overlay.on('pointerdown', close);
  }

  private downloadSave(): void {
    const save = loadSave();
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sikusiku_save.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private loadSaveFromFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const save = JSON.parse(reader.result as string) as GameSave;
          if (!Array.isArray(save.ownedMonsters)) throw new Error('invalid');
          if (save.winCount  === undefined) save.winCount  = 0;
          if (save.nikukyu   === undefined) save.nikukyu   = 0;
          persistSave(save);
          this.scene.restart();
        } catch {
          // ファイルが不正な場合は何もしない
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private startMode(mode: 'quest' | 'survival'): void {
    const save = loadSave();
    this.scene.start('TeamSelect', { mode, save, playerNum: 1, p1Team: null });
  }

  private openLobby():        void { this.scene.start('Lobby'); }
  private openMonsterList():  void { this.scene.start('MonsterList', { save: loadSave() }); }
  private openEncyclopedia(): void { this.scene.start('Encyclopedia'); }
  private openShop():         void { this.scene.start('Shop'); }
}
