import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { MONSTERS, MONSTER_IDS } from '../data/monsters';
import { getMove } from '../data/moves';
import { loadSave } from '../storage/SaveData';
import type { GameSave } from '../storage/SaveData';

const HEADER_H   = 60;
const FOOTER_H   = 36;
const COLS       = 4;
const CARD_W     = 218;
const CARD_H     = 184;
const ROW_GAP    = 12;
const PAD_TOP    = 14;
const PAD_BOTTOM = 16;
// Column centers in screen X (4 cols evenly across 960)
const COL_XS     = [120, 360, 600, 840];

export class EncyclopediaScene extends Phaser.Scene {
  private scrollY    = 0;
  private maxScrollY = 0;
  private cardContainer!: Phaser.GameObjects.Container;
  private scrollBar?: Phaser.GameObjects.Rectangle;
  private dragStartY        = 0;
  private dragStartScrollY  = 0;
  private dragging          = false;

  constructor() { super('Encyclopedia'); }

  create(): void {
    const save = loadSave();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0e1a);

    // Scrollable content container – positioned just below the header
    this.cardContainer = this.add.container(0, HEADER_H);

    this.buildGrid(save);
    this.buildMask();
    this.buildHeader(save);   // drawn on top of mask
    this.buildFooter();
    this.buildScrollBar();
    this.setupScroll();
  }

  // ── Layout ─────────────────────────────────────────────────────────────

  /** Y-center of a card row inside the container (0-based) */
  private rowY(row: number): number {
    return PAD_TOP + row * (CARD_H + ROW_GAP) + CARD_H / 2;
  }

  private get contentHeight(): number {
    const rows = Math.ceil(MONSTER_IDS.length / COLS);
    return PAD_TOP + rows * (CARD_H + ROW_GAP) - ROW_GAP + PAD_BOTTOM;
  }

  private get viewportH(): number {
    return GAME_HEIGHT - HEADER_H - FOOTER_H;
  }

  // ── Build ───────────────────────────────────────────────────────────────

  private buildGrid(save: GameSave): void {
    const ownedSet = new Set(save.ownedMonsters.map(m => m.defId));
    MONSTER_IDS.forEach((id, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      this.buildCard(COL_XS[col], this.rowY(row), idx + 1, id as string, ownedSet.has(id as string), save);
    });

    // Recalculate max scroll after building
    this.maxScrollY = Math.max(0, this.contentHeight - this.viewportH);
  }

  private buildCard(cx: number, cy: number, num: number, defId: string, owned: boolean, save: GameSave): void {
    const def = MONSTERS[defId];

    const bg = this.add.rectangle(cx, cy, CARD_W, CARD_H, owned ? 0x1b1840 : 0x111120)
      .setStrokeStyle(2, owned ? 0x5544bb : 0x222234);
    this.cardContainer.add(bg);

    const numTxt = this.add.text(cx - CARD_W / 2 + 7, cy - CARD_H / 2 + 7, `No.${num}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#555577',
    });
    this.cardContainer.add(numTxt);

    if (this.textures.exists(def.frontSprite)) {
      const img = this.add.image(cx, cy - 34, def.frontSprite);
      img.setScale(Math.min(72 / img.width, 72 / img.height));
      if (!owned) img.setTint(0x000000);
      this.cardContainer.add(img);
    }

    const nameTxt = this.add.text(cx, cy + 46, owned ? def.name : '???', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px',
      color: owned ? '#e0e0ff' : '#3a3a55', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cardContainer.add(nameTxt);

    if (owned) {
      const count = save.ownedMonsters.filter(m => m.defId === defId).length;
      if (count > 1) {
        const cntTxt = this.add.text(cx + CARD_W / 2 - 7, cy - CARD_H / 2 + 7, `×${count}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#ffcc44',
        }).setOrigin(1, 0);
        this.cardContainer.add(cntTxt);
      }
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { if (!this.dragging) bg.setFillStyle(0x262255); });
      bg.on('pointerout',  () => bg.setFillStyle(0x1b1840));
      bg.on('pointerdown', () => this._cardPressY = this.input.activePointer.y);
      bg.on('pointerup',   () => {
        if (Math.abs(this.input.activePointer.y - this._cardPressY) < 8) {
          this.showDetail(defId, save);
        }
      });
    }
  }

  // small helper to distinguish tap vs drag on a card
  private _cardPressY = 0;

  private buildMask(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, HEADER_H, GAME_WIDTH, this.viewportH);
    this.cardContainer.setMask(g.createGeometryMask());
  }

  private buildHeader(save: GameSave): void {
    const hdr = this.add.container(0, 0).setDepth(100);
    hdr.add(this.add.rectangle(GAME_WIDTH / 2, HEADER_H / 2, GAME_WIDTH, HEADER_H, 0x14122a)
      .setStrokeStyle(1, 0x2a2850));
    hdr.add(this.add.text(22, HEADER_H / 2, '📖 図鑑', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#dde0ff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const owned = new Set(save.ownedMonsters.map(m => m.defId)).size;
    hdr.add(this.add.text(GAME_WIDTH / 2, HEADER_H / 2, `${owned} / ${MONSTER_IDS.length}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#8888aa',
    }).setOrigin(0.5));

    const nikukyu = save.nikukyu ?? 0;
    if (this.textures.exists('nikukyu')) {
      hdr.add(this.add.image(GAME_WIDTH - 188, HEADER_H / 2, 'nikukyu').setDisplaySize(28, 28));
    }
    hdr.add(this.add.text(GAME_WIDTH - 170, HEADER_H / 2, `×${nikukyu}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffbb88',
    }).setOrigin(0, 0.5));
    hdr.add(this.add.text(GAME_WIDTH - 18, HEADER_H / 2, `${save.winCount ?? 0}勝`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#88ffaa',
    }).setOrigin(1, 0.5));
  }

  private buildFooter(): void {
    const y = GAME_HEIGHT - FOOTER_H / 2;
    this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, FOOTER_H, 0x0c0b1c)
      .setStrokeStyle(1, 0x222238).setDepth(100);
    const btn = this.add.text(GAME_WIDTH - 20, y, '← もどる', {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#888899',
    }).setOrigin(1, 0.5).setDepth(101).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#888899'));
    btn.on('pointerdown', () => this.scene.start('Title'));
  }

  private buildScrollBar(): void {
    if (this.maxScrollY <= 0) return;
    const TRACK_X = GAME_WIDTH - 7;
    const TRACK_Y1 = HEADER_H + 4;
    const TRACK_H  = this.viewportH - 8;
    this.add.rectangle(TRACK_X, TRACK_Y1 + TRACK_H / 2, 4, TRACK_H, 0x222244)
      .setDepth(110);
    this.scrollBar = this.add.rectangle(TRACK_X, TRACK_Y1, 4, 30, 0x7766cc)
      .setOrigin(0.5, 0).setDepth(111);
    this.updateScrollBar();
  }

  private updateScrollBar(): void {
    if (!this.scrollBar || this.maxScrollY <= 0) return;
    const TRACK_Y1 = HEADER_H + 4;
    const TRACK_H  = this.viewportH - 8;
    const barH = Math.max(20, (this.viewportH / this.contentHeight) * TRACK_H);
    const barY = TRACK_Y1 + (this.scrollY / this.maxScrollY) * (TRACK_H - barH);
    this.scrollBar.setPosition(GAME_WIDTH - 7, barY).setSize(4, barH);
  }

  // ── Scrolling ───────────────────────────────────────────────────────────

  private setupScroll(): void {
    // Mouse wheel
    this.input.on('wheel', (_p: unknown, _g: unknown, _dx: number, dy: number) => {
      this.applyScroll(this.scrollY + dy * 0.6);
    });

    // Touch / pointer drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragStartY = p.y;
      this.dragStartScrollY = this.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      this.applyScroll(this.dragStartScrollY + (this.dragStartY - p.y));
    });
    this.input.on('pointerup', () => { this.dragging = false; });
  }

  private applyScroll(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScrollY);
    this.cardContainer.y = HEADER_H - this.scrollY;
    this.updateScrollBar();
  }

  // ── Detail modal ────────────────────────────────────────────────────────

  private showDetail(defId: string, save: GameSave): void {
    const def = MONSTERS[defId];
    const D = 500;
    const PW = 480;
    const PH = 400;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
      .setDepth(D).setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);

    panel.add(this.add.rectangle(0, 0, PW, PH, 0x17152e).setStrokeStyle(2, 0x8877ee));
    panel.add(this.add.text(0, -PH / 2 + 26, def.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#e8e0ff', fontStyle: 'bold',
    }).setOrigin(0.5));

    if (this.textures.exists(def.frontSprite)) {
      const img = this.add.image(-PW / 2 + 70, -30, def.frontSprite);
      img.setScale(Math.min(100 / img.width, 100 / img.height));
      panel.add(img);
    }

    const sx = -PW / 2 + 150;
    const statY = -75;
    [
      { label: 'HP',  val: def.baseStats.hp,  color: '#88ff88' },
      { label: 'ATK', val: def.baseStats.atk, color: '#ff9966' },
      { label: 'DEF', val: def.baseStats.def, color: '#6699ff' },
    ].forEach(({ label, val, color }, i) => {
      panel.add(this.add.text(sx, statY + i * 26, `${label}  ${val}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color,
      }));
    });

    panel.add(this.add.text(sx, statY + 82, '技構成', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#7777aa',
    }));
    def.moveIds.forEach((moveId, i) => {
      const move = getMove(moveId);
      panel.add(this.add.text(sx, statY + 100 + i * 36, move.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ccccee', fontStyle: 'bold',
      }));
      panel.add(this.add.text(sx + 4, statY + 116 + i * 36, move.description, {
        fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#888899',
        wordWrap: { width: PW - 175 },
      }));
    });

    const count = save.ownedMonsters.filter(m => m.defId === defId).length;
    panel.add(this.add.text(PW / 2 - 14, PH / 2 - 14, `所持: ${count}体`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#88ffbb',
    }).setOrigin(1, 1));

    const closeBtn = this.add.text(PW / 2 - 14, -PH / 2 + 14, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ff6666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(closeBtn);

    overlay.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
  }
}
