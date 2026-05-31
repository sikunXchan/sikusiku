import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMonsterDef } from '../data/monsters';
import { applyIV } from '../data/types';
import { persistSave } from '../storage/SaveData';
import type { GameSave } from '../storage/SaveData';

export interface MonsterListSceneData {
  save: GameSave;
}

const HEADER_H = 70;
const FOOTER_H = 50;

export class MonsterListScene extends Phaser.Scene {
  private save!: GameSave;
  private cardContainer!: Phaser.GameObjects.Container;
  private scrollOffsetY = 0;
  private maxScrollOffsetY = 0;

  constructor() {
    super('MonsterList');
  }

  create(data: MonsterListSceneData): void {
    this.save = data.save;
    this.scrollOffsetY = 0;
    this.buildBackground();
    this.buildMonsterGrid();
    this.buildHeader();
    this.buildBackButton();
  }

  private buildBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
  }

  private buildHeader(): void {
    this.add.rectangle(GAME_WIDTH / 2, HEADER_H / 2, GAME_WIDTH, HEADER_H, 0x0f0c1e).setDepth(30);
    this.add.text(GAME_WIDTH / 2, HEADER_H / 2, 'マイモンスター', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
  }

  private buildMonsterGrid(): void {
    const monsters = this.save.ownedMonsters;
    const colW = 280;
    const rowH = 175;
    const cols = 3;
    const startX = (GAME_WIDTH - cols * colW) / 2 + colW / 2;
    const startY = HEADER_H + rowH / 2 + 10;

    this.cardContainer = this.add.container(0, 0).setDepth(10);

    // Mask: only render cards between header and footer
    const maskGfx = this.add.graphics().setVisible(false);
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(0, HEADER_H, GAME_WIDTH, GAME_HEIGHT - HEADER_H - FOOTER_H);
    this.cardContainer.setMask(maskGfx.createGeometryMask());

    for (let i = 0; i < monsters.length; i++) {
      this.buildCard(i, monsters, startX, startY, colW, rowH, cols);
    }

    if (monsters.length === 0) {
      const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'モンスターがいません\nクエストで仲間を増やそう!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#888888',
        align: 'center',
      }).setOrigin(0.5);
      this.cardContainer.add(t);
    } else {
      const rows = Math.ceil(monsters.length / cols);
      const totalH = startY + rows * rowH;
      this.maxScrollOffsetY = Math.max(0, totalH - (GAME_HEIGHT - FOOTER_H));
    }

    this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
      this.applyScroll(dy * 1.2);
    });

    let dragY0 = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY0 = p.y; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const diff = dragY0 - p.y;
      if (Math.abs(diff) > 6) {
        this.applyScroll(diff);
        dragY0 = p.y;
      }
    });
  }

  private applyScroll(delta: number): void {
    this.scrollOffsetY = Phaser.Math.Clamp(this.scrollOffsetY + delta, 0, this.maxScrollOffsetY);
    this.cardContainer.y = -this.scrollOffsetY;
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

    const cardObjs: Phaser.GameObjects.GameObject[] = [];

    const card = this.add.rectangle(x, y, colW - 10, rowH - 10, 0x2a2350);
    card.setStrokeStyle(1, 0x5a4cd0, 0.6);
    cardObjs.push(card);

    const spriteKey = def.frontSprite;
    if (this.textures.exists(spriteKey)) {
      const img = this.add.image(x - 70, y, spriteKey);
      img.setDisplaySize(110, 110);
      cardObjs.push(img);
    }

    const nameText = this.add.text(x + 10, y - 65, def.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    cardObjs.push(nameText);

    const computedHp = applyIV(def.baseStats.hp, owned.ivs.hp);
    const computedAtk = applyIV(def.baseStats.atk, owned.ivs.atk);
    const computedDef = applyIV(def.baseStats.def, owned.ivs.def);

    const stats = [
      { label: 'HP', val: computedHp, iv: owned.ivs.hp, color: '#66ff99' },
      { label: 'ATK', val: computedAtk, iv: owned.ivs.atk, color: '#ff6b6b' },
      { label: 'DEF', val: computedDef, iv: owned.ivs.def, color: '#66ccff' },
    ];

    const ivElems: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];

    for (let s = 0; s < stats.length; s++) {
      const stat = stats[s];
      const sy = y - 28 + s * 28;

      const lbl = this.add.text(x + 10, sy, stat.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aaaaaa',
      }).setOrigin(0, 0.5);
      const val = this.add.text(x + 52, sy, `${stat.val}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: stat.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      cardObjs.push(lbl, val);

      const barX = x + 100;
      const barW = 85;
      const barH = 14;
      const barColor = Phaser.Display.Color.HexStringToColor(stat.color.replace('#', '')).color;
      const barBg = this.add.rectangle(barX + barW / 2, sy, barW, barH, 0x222222).setVisible(false);
      const fillW = Math.max(2, (barW * stat.iv) / 100);
      const barFill = this.add.rectangle(barX, sy, fillW, barH, barColor).setOrigin(0, 0.5).setVisible(false);
      const ivLabel = this.add.text(barX + barW / 2, sy, `${stat.iv}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0.5).setVisible(false);
      ivElems.push(barBg, barFill, ivLabel);
      cardObjs.push(barBg, barFill, ivLabel);
    }

    const noLabel = this.add.text(x - 95, y + 60, `No.${(i + 1).toString().padStart(3, '0')}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#555555',
    }).setOrigin(0, 0.5);
    cardObjs.push(noLabel);

    const releaseBtn = this.add.text(x + colW / 2 - 15, y + 60, 'さようなら', {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#884444',
    }).setOrigin(1, 0.5);
    if (monsters.length >= 4) {
      releaseBtn.setInteractive({ useHandCursor: true });
      releaseBtn.on('pointerover', () => releaseBtn.setStyle({ color: '#ff6666' }));
      releaseBtn.on('pointerout', () => releaseBtn.setStyle({ color: '#884444' }));
      releaseBtn.on('pointerdown', () => this.confirmRelease(i, def.name));
    }
    cardObjs.push(releaseBtn);

    // Transparent hit area for long-press IV reveal
    const hitArea = this.add.rectangle(x, y, colW - 10, rowH - 10, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    let holdTimer: Phaser.Time.TimerEvent | undefined;
    let ivShowing = false;
    const showIv = (v: boolean) => {
      ivShowing = v;
      ivElems.forEach(el => el.setVisible(v));
    };
    hitArea.on('pointerdown', () => { holdTimer = this.time.delayedCall(400, () => showIv(true)); });
    hitArea.on('pointerup', () => { holdTimer?.remove(); holdTimer = undefined; if (ivShowing) showIv(false); });
    hitArea.on('pointerout', () => { holdTimer?.remove(); holdTimer = undefined; if (ivShowing) showIv(false); });
    cardObjs.push(hitArea);

    this.cardContainer.add(cardObjs);
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
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setDepth(30);
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#9be7ff' }));
    btn.on('pointerdown', () => this.scene.start('Title'));
    // Footer background so cards don't bleed over button
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - FOOTER_H / 2, GAME_WIDTH, FOOTER_H, 0x0f0c1e).setDepth(29);
  }
}
