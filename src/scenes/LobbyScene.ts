import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { NetManager } from '../net/NetManager';
import { loadSave } from '../storage/SaveData';

function genCode(): string {
  const chars = 'ABCDEFHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class LobbyScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private codeDisplay!: Phaser.GameObjects.Text;
  private inputChars: string[] = [];
  private inputDisplay!: Phaser.GameObjects.Text;
  private connecting = false;

  constructor() {
    super('Lobby');
  }

  create(): void {
    NetManager.destroy();
    this.connecting = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    this.add.rectangle(GAME_WIDTH / 2, 35, GAME_WIDTH, 70, 0x0f0c1e);
    this.add.text(GAME_WIDTH / 2, 35, 'ちかくで対戦', {
      fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 55, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffdd88',
    }).setOrigin(0.5);

    this.buildHostSection();
    this.buildGuestSection();
    this.buildKeyboard();
    this.buildBackButton();
  }

  private buildHostSection(): void {
    const c = this.add.container(GAME_WIDTH / 4, GAME_HEIGHT / 2 - 20);

    c.add(this.add.rectangle(0, 0, 360, 260, 0x2a2350).setStrokeStyle(2, 0x5a4cd0, 0.8));
    c.add(this.add.text(0, -100, '🏠 部屋を作る', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9be7ff', fontStyle: 'bold',
    }).setOrigin(0.5));

    this.codeDisplay = this.add.text(0, -30, '------', {
      fontFamily: 'monospace', fontSize: '40px', color: '#ffe066', fontStyle: 'bold',
      letterSpacing: 8,
    }).setOrigin(0.5);
    c.add(this.codeDisplay);

    c.add(this.add.text(0, 30, '相手にこのコードを教えてね', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#888888',
    }).setOrigin(0.5));

    const btn = this.add.rectangle(0, 85, 200, 50, 0x5a4cd0, 0.8).setStrokeStyle(2, 0x9b8fff);
    btn.setInteractive({ useHandCursor: true });
    const btnLabel = this.add.text(0, 85, '部屋を作る', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.on('pointerover', () => btn.setAlpha(1));
    btn.on('pointerout', () => btn.setAlpha(0.8));
    btn.on('pointerdown', () => { if (!this.connecting) this.startHost(); });
    c.add([btn, btnLabel]);
  }

  private buildGuestSection(): void {
    const c = this.add.container((GAME_WIDTH * 3) / 4, GAME_HEIGHT / 2 - 20);

    c.add(this.add.rectangle(0, 0, 360, 260, 0x2a2350).setStrokeStyle(2, 0x5a4cd0, 0.8));
    c.add(this.add.text(0, -100, '🚪 部屋に入る', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ff9b9b', fontStyle: 'bold',
    }).setOrigin(0.5));

    this.inputDisplay = this.add.text(0, -25, '_ _ _ _ _ _', {
      fontFamily: 'monospace', fontSize: '32px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(this.inputDisplay);

    const joinBtn = this.add.rectangle(0, 85, 200, 50, 0x993333, 0.8).setStrokeStyle(2, 0xff8888);
    joinBtn.setInteractive({ useHandCursor: true });
    const joinLabel = this.add.text(0, 85, '接続する', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    joinBtn.on('pointerover', () => joinBtn.setAlpha(1));
    joinBtn.on('pointerout', () => joinBtn.setAlpha(0.8));
    joinBtn.on('pointerdown', () => { if (!this.connecting) this.startGuest(); });
    c.add([joinBtn, joinLabel]);

    c.add(this.add.text(0, 40, '↓ キーボードでコードを入力', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#666666',
    }).setOrigin(0.5));
  }

  private buildKeyboard(): void {
    const c = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 110);

    const rows = ['ABCDEFHJ', 'KLMNPQRS', 'TUVWXYZ2', '3456789⌫'];
    const btnW = 68, btnH = 42, gap = 4;

    rows.forEach((row, ri) => {
      const chars = row.split('');
      const rowW = chars.length * (btnW + gap);
      const startX = -rowW / 2 + btnW / 2;
      chars.forEach((ch, ci) => {
        const bx = startX + ci * (btnW + gap);
        const by = ri * (btnH + gap) - ((rows.length - 1) * (btnH + gap)) / 2;
        const bg = this.add.rectangle(bx, by, btnW, btnH, 0x2a2350).setStrokeStyle(1, 0x5a4cd0, 0.7);
        const label = this.add.text(bx, by, ch, {
          fontFamily: 'monospace', fontSize: '16px', color: '#cccccc', fontStyle: 'bold',
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x3a3360));
        bg.on('pointerout', () => bg.setFillStyle(0x2a2350));
        bg.on('pointerdown', () => { if (!this.connecting) this.pressKey(ch); });
        c.add([bg, label]);
      });
    });
  }

  private pressKey(ch: string): void {
    if (ch === '⌫') {
      this.inputChars.pop();
    } else if (this.inputChars.length < 6) {
      this.inputChars.push(ch);
    }
    const padded = this.inputChars.join(' ').padEnd(11, ' _ ');
    this.inputDisplay.setText(padded.slice(0, 11));
  }

  private async startHost(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    const code = genCode();
    this.codeDisplay.setText(code);
    this.setStatus('部屋を作っています...');

    try {
      await NetManager.createRoom(code);
      this.setStatus(`コード: ${code} — 相手の接続を待っています...`);

      NetManager.onConnect = () => {
        this.setStatus('接続されました! チームを選んでください');
        const save = loadSave();
        this.time.delayedCall(600, () => {
          this.scene.start('TeamSelect', {
            mode: 'network',
            save,
            playerNum: 1,
            p1Team: null,
            localPlayer: 1,
          });
        });
      };
    } catch {
      this.setStatus('エラー: 部屋の作成に失敗しました');
      this.connecting = false;
    }
  }

  private async startGuest(): Promise<void> {
    if (this.connecting) return;
    const code = this.inputChars.join('').trim();
    if (code.length !== 6) { this.setStatus('6文字のコードを入力してください'); return; }
    this.connecting = true;
    this.setStatus(`${code} に接続中...`);

    try {
      await NetManager.joinRoom(code);
      this.setStatus('接続されました! チームを選んでください');
      const save = loadSave();
      this.time.delayedCall(400, () => {
        this.scene.start('TeamSelect', {
          mode: 'network',
          save,
          playerNum: 1,
          p1Team: null,
          localPlayer: 2,
        });
      });
    } catch {
      this.setStatus('接続に失敗しました。コードを確認してください');
      this.connecting = false;
    }
  }

  private setStatus(msg: string): void {
    this.statusText?.setText(msg);
  }

  private buildBackButton(): void {
    const btn = this.add.text(60, GAME_HEIGHT - 18, '← もどる', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#9be7ff',
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#9be7ff' }));
    btn.on('pointerdown', () => { NetManager.destroy(); this.scene.start('Title'); });
  }
}
