import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { MONSTERS, MONSTER_IDS } from '../data/monsters';
import { getMove } from '../data/moves';
import { loadSave } from '../storage/SaveData';
import type { GameSave } from '../storage/SaveData';

const COLS = 4;
const CARD_W = 204;
const CARD_H = 182;
const HEADER_H = 60;
// Card center positions
const COL_XS = [126, 344, 616, 834];
const ROW_YS = [HEADER_H + 18 + CARD_H / 2, HEADER_H + 18 + CARD_H * 1.5 + 16];

export class EncyclopediaScene extends Phaser.Scene {
  constructor() {
    super('Encyclopedia');
  }

  create(): void {
    const save = loadSave();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0e1a);
    this.buildHeader(save);
    this.buildGrid(save);
    this.buildFooter();
  }

  private buildHeader(save: GameSave): void {
    this.add.rectangle(GAME_WIDTH / 2, HEADER_H / 2, GAME_WIDTH, HEADER_H, 0x14122a)
      .setStrokeStyle(1, 0x2a2850);
    this.add.text(22, HEADER_H / 2, '📖 図鑑', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#dde0ff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const owned = new Set(save.ownedMonsters.map(m => m.defId)).size;
    this.add.text(GAME_WIDTH / 2, HEADER_H / 2, `${owned} / ${MONSTER_IDS.length}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#8888aa',
    }).setOrigin(0.5);

    // Nikukyu count
    const nikukyu = save.nikukyu ?? 0;
    if (this.textures.exists('nikukyu')) {
      this.add.image(GAME_WIDTH - 190, HEADER_H / 2, 'nikukyu').setDisplaySize(30, 30);
    } else {
      this.add.text(GAME_WIDTH - 190, HEADER_H / 2, '🐾', { fontSize: '20px' }).setOrigin(0.5);
    }
    this.add.text(GAME_WIDTH - 170, HEADER_H / 2, `×${nikukyu}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffbb88',
    }).setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH - 20, HEADER_H / 2, `${save.winCount ?? 0}勝`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#88ffaa',
    }).setOrigin(1, 0.5);
  }

  private buildGrid(save: GameSave): void {
    const ownedSet = new Set(save.ownedMonsters.map(m => m.defId));
    MONSTER_IDS.forEach((id, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cx = COL_XS[col];
      const cy = ROW_YS[row];
      this.buildCard(cx, cy, idx + 1, id as string, ownedSet.has(id as string), save);
    });
  }

  private buildCard(cx: number, cy: number, num: number, defId: string, owned: boolean, save: GameSave): void {
    const def = MONSTERS[defId];

    const bg = this.add.rectangle(cx, cy, CARD_W, CARD_H, owned ? 0x1b1840 : 0x111120)
      .setStrokeStyle(2, owned ? 0x5544bb : 0x222234);

    // Number badge
    this.add.text(cx - CARD_W / 2 + 7, cy - CARD_H / 2 + 7, `No.${num}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#555577',
    });

    // Sprite
    if (this.textures.exists(def.frontSprite)) {
      const img = this.add.image(cx, cy - 32, def.frontSprite);
      const scale = Math.min(70 / img.width, 70 / img.height);
      img.setScale(scale);
      if (!owned) img.setTint(0x000000);
    }

    // Name
    this.add.text(cx, cy + 44, owned ? def.name : '???', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px',
      color: owned ? '#e0e0ff' : '#3a3a55', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Duplicate count
    if (owned) {
      const count = save.ownedMonsters.filter(m => m.defId === defId).length;
      if (count > 1) {
        this.add.text(cx + CARD_W / 2 - 7, cy - CARD_H / 2 + 7, `×${count}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#ffcc44',
        }).setOrigin(1, 0);
      }

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x262255));
      bg.on('pointerout',  () => bg.setFillStyle(0x1b1840));
      bg.on('pointerdown', () => this.showDetail(defId, save));
    }
  }

  private showDetail(defId: string, save: GameSave): void {
    const def = MONSTERS[defId];
    const D = 1000;
    const PW = 480;
    const PH = 400;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
      .setDepth(D).setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);

    panel.add(this.add.rectangle(0, 0, PW, PH, 0x17152e).setStrokeStyle(2, 0x8877ee));

    // Name
    panel.add(this.add.text(0, -PH / 2 + 26, def.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#e8e0ff', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Sprite
    if (this.textures.exists(def.frontSprite)) {
      const img = this.add.image(-PW / 2 + 70, -30, def.frontSprite);
      img.setScale(Math.min(100 / img.width, 100 / img.height));
      panel.add(img);
    }

    // Stats
    const statY = -75;
    const sx = -PW / 2 + 150;
    [
      { label: 'HP',  val: def.baseStats.hp,  color: '#88ff88' },
      { label: 'ATK', val: def.baseStats.atk, color: '#ff9966' },
      { label: 'DEF', val: def.baseStats.def, color: '#6699ff' },
    ].forEach(({ label, val, color }, i) => {
      panel.add(this.add.text(sx, statY + i * 26, `${label}  ${val}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color,
      }));
    });

    // Moves
    panel.add(this.add.text(sx, statY + 80, '技構成', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#7777aa',
    }));
    def.moveIds.forEach((moveId, i) => {
      const move = getMove(moveId);
      panel.add(this.add.text(sx, statY + 100 + i * 36, move.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ccccee', fontStyle: 'bold',
      }));
      panel.add(this.add.text(sx + 4, statY + 116 + i * 36, move.description, {
        fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#888899',
        wordWrap: { width: PW - 180 },
      }));
    });

    // Owned count
    const count = save.ownedMonsters.filter(m => m.defId === defId).length;
    panel.add(this.add.text(PW / 2 - 14, PH / 2 - 14, `所持: ${count}体`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#88ffbb',
    }).setOrigin(1, 1));

    // Close button
    const closeBtn = this.add.text(PW / 2 - 14, -PH / 2 + 14, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ff6666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(closeBtn);

    overlay.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
  }

  private buildFooter(): void {
    const btn = this.add.text(GAME_WIDTH - 22, GAME_HEIGHT - 18, '← もどる', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#888899',
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#888899'));
    btn.on('pointerdown', () => this.scene.start('Title'));
  }
}
