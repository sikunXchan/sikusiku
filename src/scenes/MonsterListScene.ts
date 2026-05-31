import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMonsterDef } from '../data/monsters';
import { applyIV } from '../data/types';
import type { GameSave } from '../storage/SaveData';

export interface MonsterListSceneData {
  save: GameSave;
}

export class MonsterListScene extends Phaser.Scene {
  constructor() {
    super('MonsterList');
  }

  create(data: MonsterListSceneData): void {
    this.buildBackground();
    this.buildHeader();
    this.buildMonsterGrid(data.save);
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

  private buildMonsterGrid(save: GameSave): void {
    const monsters = save.ownedMonsters;
    const colW = 280;
    const rowH = 170;
    const cols = 3;
    const startX = (GAME_WIDTH - cols * colW) / 2 + colW / 2;
    const startY = 110;

    for (let i = 0; i < monsters.length; i++) {
      const owned = monsters[i];
      const def = getMonsterDef(owned.defId);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * colW;
      const y = startY + row * rowH;

      // Card background
      const card = this.add.rectangle(x, y, colW - 10, rowH - 10, 0x2a2350);
      card.setStrokeStyle(1, 0x5a4cd0, 0.6);

      // Sprite
      const spriteKey = def.frontSprite;
      if (this.textures.exists(spriteKey)) {
        this.add.image(x - 70, y, spriteKey).setScale(1.8);
      }

      // Name
      this.add.text(x + 10, y - 60, def.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      // IVs and computed stats
      const computedHp = applyIV(def.baseStats.hp, owned.ivs.hp);
      const computedAtk = applyIV(def.baseStats.atk, owned.ivs.atk);
      const computedDef = applyIV(def.baseStats.def, owned.ivs.def);

      const stats = [
        { label: 'HP', val: computedHp, iv: owned.ivs.hp, color: '#66ff99' },
        { label: 'ATK', val: computedAtk, iv: owned.ivs.atk, color: '#ff6b6b' },
        { label: 'DEF', val: computedDef, iv: owned.ivs.def, color: '#66ccff' },
      ];

      for (let s = 0; s < stats.length; s++) {
        const stat = stats[s];
        const sy = y - 25 + s * 28;

        this.add.text(x + 10, sy, stat.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#aaaaaa',
        }).setOrigin(0, 0.5);

        this.add.text(x + 55, sy, `${stat.val}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: stat.color,
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // IV bar
        const barX = x + 100;
        const barW = 90;
        this.add.rectangle(barX + barW / 2, sy, barW, 8, 0x333333);
        this.add.rectangle(barX, sy, (barW * stat.iv) / 100, 8, Phaser.Display.Color.HexStringToColor(stat.color.replace('#', '')).color)
          .setOrigin(0, 0.5);

        this.add.text(barX + barW + 6, sy, `${stat.iv}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#666666',
        }).setOrigin(0, 0.5);
      }

      // No. label
      this.add.text(x - 95, y + 55, `No.${(i + 1).toString().padStart(3, '0')}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#555555',
      }).setOrigin(0, 0.5);
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

  private buildBackButton(): void {
    const btn = this.add.text(60, GAME_HEIGHT - 30, '← もどる', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#9be7ff',
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#9be7ff' }));
    btn.on('pointerdown', () => this.scene.start('Title'));
  }
}
