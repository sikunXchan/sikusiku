import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMonsterDef } from '../data/monsters';
import { applyIV } from '../data/types';
import { persistSave } from '../storage/SaveData';
import type { GameSave } from '../storage/SaveData';

export interface MonsterListSceneData {
  save: GameSave;
}

export class MonsterListScene extends Phaser.Scene {
  private save!: GameSave;

  constructor() {
    super('MonsterList');
  }

  create(data: MonsterListSceneData): void {
    this.save = data.save;
    this.buildBackground();
    this.buildHeader();
    this.buildMonsterGrid();
    this.buildBackButton();
  }

  private buildBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    this.add.rectangle(GAME_WIDTH / 2, 35, GAME_WIDTH, 70, 0x0f0c1e);
  }

  private buildHeader(): void {
    this.add.text(GAME_WIDTH / 2, 35, 'マイモンスター', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private buildMonsterGrid(): void {
    const monsters = this.save.ownedMonsters;
    const colW = 280;
    const rowH = 175;
    const cols = 3;
    const startX = (GAME_WIDTH - cols * colW) / 2 + colW / 2;
    const startY = 120;

    for (let i = 0; i < monsters.length; i++) {
      this.buildCard(i, monsters, startX, startY, colW, rowH, cols);
    }

    if (monsters.length === 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'モンスターがいません\nクエストで仲間を増やそう!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#888888',
        align: 'center',
      }).setOrigin(0.5);
    }
  }

  private buildCard(
    i: number,
    monsters: GameSave['ownedMonsters'],
    startX: number, startY: number, colW: number, rowH: number, cols: number,
  ): void {
    const owned = monsters[i];
    const def = getMonsterDef(owned.defId);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * colW;
    const y = startY + row * rowH;

    const card = this.add.rectangle(x, y, colW - 10, rowH - 10, 0x2a2350);
    card.setStrokeStyle(1, 0x5a4cd0, 0.6);

    const spriteKey = def.frontSprite;
    if (this.textures.exists(spriteKey)) {
      const img = this.add.image(x - 70, y, spriteKey);
      img.setDisplaySize(110, 110);
    }

    this.add.text(x + 10, y - 65, def.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const computedHp = applyIV(def.baseStats.hp, owned.ivs.hp);
    const computedAtk = applyIV(def.baseStats.atk, owned.ivs.atk);
    const computedDef = applyIV(def.baseStats.def, owned.ivs.def);

    const stats = [
      { label: 'HP', val: computedHp, iv: owned.ivs.hp, color: '#66ff99' },
      { label: 'ATK', val: computedAtk, iv: owned.ivs.atk, color: '#ff6b6b' },
      { label: 'DEF', val: computedDef, iv: owned.ivs.def, color: '#66ccff' },
    ];

    // IV elements (hidden by default, shown on long-press)
    const ivElems: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];

    for (let s = 0; s < stats.length; s++) {
      const stat = stats[s];
      const sy = y - 28 + s * 28;

      this.add.text(x + 10, sy, stat.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aaaaaa',
      }).setOrigin(0, 0.5);

      this.add.text(x + 52, sy, `${stat.val}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: stat.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      const barX = x + 100;
      const barW = 85;
      const barColor = Phaser.Display.Color.HexStringToColor(stat.color.replace('#', '')).color;
      const barBg = this.add.rectangle(barX + barW / 2, sy, barW, 8, 0x222222).setVisible(false);
      const fillW = Math.max(2, (barW * stat.iv) / 100);
      const barFill = this.add.rectangle(barX, sy, fillW, 8, barColor).setOrigin(0, 0.5).setVisible(false);
      const ivLabel = this.add.text(barX + barW + 4, sy, `${stat.iv}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#cccccc', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setVisible(false);

      ivElems.push(barBg, barFill, ivLabel);
    }

    // No. label
    this.add.text(x - 95, y + 60, `No.${(i + 1).toString().padStart(3, '0')}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#555555',
    }).setOrigin(0, 0.5);

    // Release button (only if 4+ monsters)
    const releaseBtn = this.add.text(x + colW / 2 - 15, y + 60, 'さようなら', {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#884444',
    }).setOrigin(1, 0.5);
    if (monsters.length >= 4) {
      releaseBtn.setInteractive({ useHandCursor: true });
      releaseBtn.on('pointerover', () => releaseBtn.setStyle({ color: '#ff6666' }));
      releaseBtn.on('pointerout', () => releaseBtn.setStyle({ color: '#884444' }));
      releaseBtn.on('pointerdown', () => this.confirmRelease(i, def.name));
    }

    // Long-press hit area
    const hitArea = this.add.rectangle(x, y, colW - 10, rowH - 10, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    let holdTimer: Phaser.Time.TimerEvent | undefined;
    let ivShowing = false;

    const showIv = (v: boolean) => {
      ivShowing = v;
      ivElems.forEach(el => el.setVisible(v));
    };
    hitArea.on('pointerdown', () => {
      holdTimer = this.time.delayedCall(400, () => showIv(true));
    });
    hitArea.on('pointerup', () => { holdTimer?.remove(); holdTimer = undefined; if (ivShowing) showIv(false); });
    hitArea.on('pointerout', () => { holdTimer?.remove(); holdTimer = undefined; if (ivShowing) showIv(false); });
  }

  private confirmRelease(idx: number, name: string): void {
    const D = 600;
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(D).setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);
    panel.add(this.add.rectangle(0, 0, 420, 180, 0x1a1530).setStrokeStyle(2, 0xff4444));
    panel.add(this.add.text(0, -55, `${name} とおわかれしますか?`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));

    const yes = this.add.rectangle(-70, 20, 140, 50, 0x882222).setStrokeStyle(1, 0xff4444);
    const yesLabel = this.add.text(-70, 20, 'さようなら', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5);
    yes.setInteractive({ useHandCursor: true });
    yes.on('pointerover', () => yes.setFillStyle(0xaa3333));
    yes.on('pointerout', () => yes.setFillStyle(0x882222));
    yes.on('pointerdown', () => {
      overlay.destroy(); panel.destroy();
      this.save.ownedMonsters.splice(idx, 1);
      persistSave(this.save);
      this.scene.restart({ save: this.save });
    });

    const no = this.add.rectangle(70, 20, 140, 50, 0x223355).setStrokeStyle(1, 0x5566aa);
    const noLabel = this.add.text(70, 20, 'キャンセル', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#aaaacc',
    }).setOrigin(0.5);
    no.setInteractive({ useHandCursor: true });
    no.on('pointerover', () => no.setFillStyle(0x334466));
    no.on('pointerout', () => no.setFillStyle(0x223355));
    no.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });

    panel.add([yes, yesLabel, no, noLabel]);
  }

  private buildBackButton(): void {
    const btn = this.add.text(60, GAME_HEIGHT - 25, '← もどる', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#9be7ff',
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#9be7ff' }));
    btn.on('pointerdown', () => this.scene.start('Title'));
  }
}
