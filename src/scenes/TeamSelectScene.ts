import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMonsterDef, MONSTER_IDS } from '../data/monsters';
import { applyIV } from '../data/types';
import type { OwnedMonster } from '../data/types';
import type { GameSave } from '../storage/SaveData';
import { randomIVs, generateUid } from '../storage/SaveData';

export interface TeamSelectData {
  mode: 'quest' | 'pvp';
  save: GameSave;
  playerNum: 1 | 2;
  p1Team: OwnedMonster[] | null;
}

const TEAM_SIZE = 3;

export class TeamSelectScene extends Phaser.Scene {
  private selectedIndices: number[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private startBtn!: Phaser.GameObjects.Container;
  private sceneData!: TeamSelectData;

  constructor() {
    super('TeamSelect');
  }

  init(data: TeamSelectData): void {
    this.sceneData = data;
    this.selectedIndices = [];
    this.cards = [];
  }

  create(): void {
    this.buildBackground();
    this.buildHeader();
    this.buildMonsterCards();
    this.buildStartButton();
    this.buildSelectedIndicator();
  }

  private buildBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    this.add.rectangle(GAME_WIDTH / 2, 35, GAME_WIDTH, 70, 0x0f0c1e);
  }

  private buildHeader(): void {
    const playerLabel = this.sceneData.playerNum === 1 ? 'P1' : 'P2';
    const modeLabel = this.sceneData.mode === 'quest' ? 'クエスト' : `バトル (${playerLabel})`;

    this.add.text(GAME_WIDTH / 2, 20, `チームを選べ — ${modeLabel}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.add.text(GAME_WIDTH / 2, 50, `${TEAM_SIZE}体選んでください (順番が先鋒になります)`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0);
  }

  private buildMonsterCards(): void {
    const monsters = this.sceneData.save.ownedMonsters;
    const cardW = 220;
    const cardH = 290;
    const perRow = Math.min(monsters.length, 4);
    const totalW = perRow * (cardW + 15);
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const startY = 230;

    for (let i = 0; i < monsters.length; i++) {
      const owned = monsters[i];
      const def = getMonsterDef(owned.defId);
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = startX + col * (cardW + 15);
      const y = startY + row * (cardH + 15);

      const container = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x2a2350);
      bg.setStrokeStyle(2, 0x5a4cd0, 0.6);

      const sprite = this.textures.exists(def.frontSprite)
        ? this.add.image(0, -60, def.frontSprite).setDisplaySize(140, 130)
        : this.add.rectangle(0, -60, 60, 70, 0x555555) as unknown as Phaser.GameObjects.Image;

      const nameText = this.add.text(0, 25, def.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const hp = applyIV(def.baseStats.hp, owned.ivs.hp);
      const atk = applyIV(def.baseStats.atk, owned.ivs.atk);
      const defStat = applyIV(def.baseStats.def, owned.ivs.def);

      const statsText = this.add.text(0, 58, `HP:${hp}  ATK:${atk}  DEF:${defStat}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#aaaaaa',
      }).setOrigin(0.5);

      const orderText = this.add.text(0, 100, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffe066',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const dimOverlay = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0.5);
      dimOverlay.setVisible(false);

      container.add([bg, sprite, nameText, statsText, orderText, dimOverlay]);
      container.setSize(cardW, cardH);
      container.setInteractive({ useHandCursor: true });

      (container as any).monsterIdx = i;
      (container as any).orderText = orderText;
      (container as any).bg = bg;
      (container as any).dimOverlay = dimOverlay;
      (container as any).selected = false;

      container.on('pointerover', () => {
        if (!(container as any).selected && this.selectedIndices.length < TEAM_SIZE) {
          bg.setAlpha(0.5);
        }
      });
      container.on('pointerout', () => {
        if (!(container as any).selected) bg.setAlpha(1);
      });
      container.on('pointerdown', () => this.toggleSelect(i, container));

      this.cards.push(container);
    }
  }

  private toggleSelect(idx: number, container: Phaser.GameObjects.Container): void {
    const pos = this.selectedIndices.indexOf(idx);
    const orderText = (container as any).orderText as Phaser.GameObjects.Text;
    const bg = (container as any).bg as Phaser.GameObjects.Rectangle;
    const dimOverlay = (container as any).dimOverlay as Phaser.GameObjects.Rectangle;

    if (pos >= 0) {
      // Deselect
      this.selectedIndices.splice(pos, 1);
      (container as any).selected = false;
      orderText.setText('');
      bg.setStrokeStyle(2, 0x5a4cd0, 0.6);
      bg.setAlpha(1);
      dimOverlay.setVisible(false);
      this.updateAllOrderLabels();
    } else if (this.selectedIndices.length < TEAM_SIZE) {
      // Select
      this.selectedIndices.push(idx);
      (container as any).selected = true;
      orderText.setText(`${this.selectedIndices.length}`);
      bg.setStrokeStyle(3, 0xffe066, 1);
      bg.setFillStyle(0x3a3060);
    }

    this.updateStartButton();
  }

  private updateAllOrderLabels(): void {
    for (let i = 0; i < this.cards.length; i++) {
      const container = this.cards[i];
      const orderText = (container as any).orderText as Phaser.GameObjects.Text;
      const selPos = this.selectedIndices.indexOf(i);
      if (selPos >= 0) {
        orderText.setText(`${selPos + 1}`);
      }
    }
  }

  private buildStartButton(): void {
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 45;

    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 280, 60, 0x5a4cd0, 0.3);
    bg.setStrokeStyle(2, 0x9b8fff, 0.8);

    const label = this.add.text(0, 0, '決定！', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '26px',
      color: '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const dimOverlay = this.add.rectangle(0, 0, 280, 60, 0x000000, 0.4);

    c.add([bg, label, dimOverlay]);
    c.setSize(280, 60);
    c.setInteractive({ useHandCursor: true });

    c.on('pointerover', () => {
      if ((c as any).active) bg.setAlpha(0.6);
    });
    c.on('pointerout', () => {
      if ((c as any).active) bg.setAlpha(0.3);
    });
    c.on('pointerdown', () => {
      if ((c as any).active) this.confirmTeam();
    });

    (c as any).active = false;
    (c as any).label = label;
    (c as any).dimOverlay = dimOverlay;
    this.startBtn = c;
  }

  private buildSelectedIndicator(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 85, `選択中: 0 / ${TEAM_SIZE}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setName('selectCount');
  }

  private updateStartButton(): void {
    const ready = this.selectedIndices.length === TEAM_SIZE;
    const label = (this.startBtn as any).label as Phaser.GameObjects.Text;
    const dim = (this.startBtn as any).dimOverlay as Phaser.GameObjects.Rectangle;

    label.setStyle({ color: ready ? '#ffffff' : '#888888' });
    dim.setVisible(!ready);
    (this.startBtn as any).active = ready;

    const countText = this.children.getByName('selectCount') as Phaser.GameObjects.Text;
    if (countText) {
      countText.setText(`選択中: ${this.selectedIndices.length} / ${TEAM_SIZE}`);
      countText.setStyle({ color: ready ? '#ffe066' : '#aaaaaa' });
    }
  }

  private confirmTeam(): void {
    if (this.selectedIndices.length !== TEAM_SIZE) return;

    const selectedTeam = this.selectedIndices.map(i => this.sceneData.save.ownedMonsters[i]);

    if (this.sceneData.mode === 'quest') {
      // Build CPU team from random monsters
      const cpuTeam: OwnedMonster[] = Array.from({ length: TEAM_SIZE }, () => ({
        uid: generateUid(),
        defId: MONSTER_IDS[Math.floor(Math.random() * MONSTER_IDS.length)],
        ivs: randomIVs(),
      }));

      this.scene.start('Battle', {
        mode: 'quest',
        p1Team: selectedTeam,
        p2Team: cpuTeam,
      });
    } else if (this.sceneData.playerNum === 1) {
      // PvP: P1 done, now P2 selects
      this.scene.start('TeamSelect', {
        mode: 'pvp',
        save: this.sceneData.save,
        playerNum: 2,
        p1Team: selectedTeam,
      });
    } else {
      // PvP: both teams selected
      this.scene.start('Battle', {
        mode: 'pvp',
        p1Team: this.sceneData.p1Team!,
        p2Team: selectedTeam,
      });
    }
  }
}
