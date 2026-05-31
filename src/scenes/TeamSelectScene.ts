import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMonsterDef, MONSTER_IDS } from '../data/monsters';
import { applyIV } from '../data/types';
import type { OwnedMonster } from '../data/types';
import type { GameSave } from '../storage/SaveData';
import { randomIVs, generateUid } from '../storage/SaveData';
import { NetManager } from '../net/NetManager';
import type { NetworkMsg } from '../net/messages';

export interface TeamSelectData {
  mode: 'quest' | 'pvp' | 'network' | 'survival';
  save: GameSave;
  playerNum: 1 | 2;
  p1Team: OwnedMonster[] | null;
  localPlayer?: 1 | 2;
}

const TEAM_SIZE = 3;

export class TeamSelectScene extends Phaser.Scene {
  private selectedIndices: number[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private cardContainer!: Phaser.GameObjects.Container;
  private scrollOffsetY = 0;
  private maxScrollOffsetY = 0;
  private isDragging = false;
  private startBtn!: Phaser.GameObjects.Container;
  private sceneData!: TeamSelectData;

  constructor() {
    super('TeamSelect');
  }

  init(data: TeamSelectData): void {
    this.sceneData = data;
    this.selectedIndices = [];
    this.cards = [];
    this.scrollOffsetY = 0;
    this.isDragging = false;
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
    this.add.rectangle(GAME_WIDTH / 2, 35, GAME_WIDTH, 70, 0x0f0c1e).setDepth(3);
    // Solid overlay to clip cards that scroll into the footer area
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 55, GAME_WIDTH, 110, 0x1a1530).setDepth(3);
  }

  private buildHeader(): void {
    const playerLabel = this.sceneData.playerNum === 1 ? 'P1' : 'P2';
    const modeLabel = this.sceneData.mode === 'quest'
      ? 'クエスト'
      : this.sceneData.mode === 'survival'
        ? 'サバイバル'
        : this.sceneData.mode === 'network'
          ? `無線対戦 (${this.sceneData.localPlayer === 1 ? 'ホスト' : 'ゲスト'})`
          : `バトル (${playerLabel})`;

    this.add.text(GAME_WIDTH / 2, 20, `チームを選べ — ${modeLabel}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(4);

    this.add.text(GAME_WIDTH / 2, 50, `${TEAM_SIZE}体選んでください (順番が先鋒になります)`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0).setDepth(4);
  }

  private buildMonsterCards(): void {
    const monsters = this.sceneData.save.ownedMonsters;
    const cardW = 220;
    const cardH = 290;
    const perRow = Math.min(monsters.length, 4);
    const totalW = perRow * (cardW + 15);
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const startY = 230;

    this.cardContainer = this.add.container(0, 0);

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

      const statsText = this.add.text(0, 68, `HP:${hp}  ATK:${atk}  DEF:${defStat}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#aaaaaa',
      }).setOrigin(0.5);

      const orderText = this.add.text(0, 108, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffe066',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const dimOverlay = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0.5);
      dimOverlay.setVisible(false);

      // IV overlay elements (hidden by default, shown on long-press)
      const ivStats = [
        { label: 'HP',  val: hp,      iv: owned.ivs.hp,  color: '#66ff99' },
        { label: 'ATK', val: atk,     iv: owned.ivs.atk, color: '#ff6b6b' },
        { label: 'DEF', val: defStat, iv: owned.ivs.def, color: '#66ccff' },
      ];
      const ivElems: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];
      const barW = 90;
      const barX = -18;

      for (let s = 0; s < ivStats.length; s++) {
        const st = ivStats[s];
        const sy = 50 + s * 22;
        const barColor = Phaser.Display.Color.HexStringToColor(st.color.replace('#', '')).color;

        const lbl = this.add.text(-90, sy, st.label, {
          fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#aaaaaa',
        }).setOrigin(0, 0.5).setVisible(false);

        const valTxt = this.add.text(-54, sy, `${st.val}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: st.color, fontStyle: 'bold',
        }).setOrigin(0, 0.5).setVisible(false);

        const barBg = this.add.rectangle(barX + barW / 2, sy, barW, 14, 0x222222)
          .setVisible(false);
        const fillW = Math.max(2, (barW * st.iv) / 100);
        const barFill = this.add.rectangle(barX, sy, fillW, 14, barColor)
          .setOrigin(0, 0.5).setVisible(false);
        const ivNum = this.add.text(barX + barW / 2, sy, `${st.iv}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);

        ivElems.push(lbl, valTxt, barBg, barFill, ivNum);
      }

      container.add([bg, sprite, nameText, statsText, orderText, dimOverlay, ...ivElems]);
      container.setSize(cardW, cardH);
      container.setInteractive({ useHandCursor: true });

      (container as any).monsterIdx = i;
      (container as any).orderText = orderText;
      (container as any).bg = bg;
      (container as any).dimOverlay = dimOverlay;
      (container as any).selected = false;

      let holdTimer: Phaser.Time.TimerEvent | undefined;
      let ivShowing = false;
      let longPressed = false;

      const showIv = (v: boolean) => {
        ivShowing = v;
        statsText.setVisible(!v);
        ivElems.forEach(el => el.setVisible(v));
        container.setDepth(v ? 5 : 0); // bring to front of cardContainer when IV visible
      };

      container.on('pointerover', () => {
        if (!(container as any).selected && this.selectedIndices.length < TEAM_SIZE) {
          bg.setAlpha(0.5);
        }
      });
      container.on('pointerout', () => {
        if (!(container as any).selected) bg.setAlpha(1);
        holdTimer?.remove(); holdTimer = undefined;
        if (ivShowing) showIv(false);
        longPressed = false;
      });
      container.on('pointerdown', () => {
        longPressed = false;
        holdTimer = this.time.delayedCall(400, () => {
          longPressed = true;
          showIv(true);
        });
      });
      container.on('pointerup', () => {
        holdTimer?.remove(); holdTimer = undefined;
        if (this.isDragging) { this.isDragging = false; return; }
        if (ivShowing) {
          showIv(false);
        } else if (!longPressed) {
          this.toggleSelect(i, container);
        }
        longPressed = false;
      });

      this.cardContainer.add(container); // removes from scene, adds to scroll container
      this.cards.push(container);
    }

    // Calculate how far we need to scroll to see all rows
    const numRows = Math.ceil(monsters.length / 4);
    const contentBottom = startY + (numRows - 1) * (cardH + 15) + cardH / 2 + 30;
    this.maxScrollOffsetY = Math.max(0, contentBottom - (GAME_HEIGHT - 120));

    if (this.maxScrollOffsetY > 0) {
      // Mouse wheel scroll
      this.input.on('wheel', (_p: unknown, _g: unknown, _dx: number, dy: number) => {
        this.applyScroll(dy > 0 ? 80 : -80);
      });

      // Touch / pointer drag scroll
      let dragY0 = 0;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        dragY0 = p.y;
        this.isDragging = false;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        const diff = dragY0 - p.y;
        if (Math.abs(diff) > 8) {
          this.isDragging = true;
          this.applyScroll(diff);
          dragY0 = p.y;
        }
      });
    }
  }

  private applyScroll(delta: number): void {
    this.scrollOffsetY = Phaser.Math.Clamp(this.scrollOffsetY + delta, 0, this.maxScrollOffsetY);
    this.cardContainer.y = -this.scrollOffsetY;
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
      // Prevent duplicate character
      const newDefId = this.sceneData.save.ownedMonsters[idx].defId;
      if (this.selectedIndices.some(si => this.sceneData.save.ownedMonsters[si].defId === newDefId)) return;
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
    c.setDepth(5);
  }

  private buildSelectedIndicator(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 85, `選択中: 0 / ${TEAM_SIZE}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(5).setName('selectCount');
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
      this.showTargetSelection(selectedTeam);
      return;

    } else if (this.sceneData.mode === 'survival') {
      const cpuTeam = this.buildRandomCpuTeam();
      this.scene.start('Battle', { mode: 'survival', p1Team: selectedTeam, p2Team: cpuTeam, survivalStreak: 0 });
      return;

    } else if (this.sceneData.mode === 'network') {
      this.confirmNetworkTeam(selectedTeam);

    } else if (this.sceneData.playerNum === 1) {
      this.scene.start('TeamSelect', {
        mode: 'pvp', save: this.sceneData.save, playerNum: 2, p1Team: selectedTeam,
      });
    } else {
      this.scene.start('Battle', { mode: 'pvp', p1Team: this.sceneData.p1Team!, p2Team: selectedTeam });
    }
  }

  private buildRandomCpuTeam(): OwnedMonster[] {
    const shuffled = [...MONSTER_IDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, TEAM_SIZE).map(id => ({
      uid: generateUid(), defId: id as string, ivs: randomIVs(),
    }));
  }

  private showTargetSelection(playerTeam: OwnedMonster[]): void {
    const D = 700;
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.82)
      .setDepth(D).setInteractive();
    const panelW = 860;
    const panelH = 280;
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);
    panel.add(this.add.rectangle(0, 0, panelW, panelH, 0x0f0c1e).setStrokeStyle(2, 0xffe066));
    panel.add(this.add.text(0, -panelH / 2 + 22, '狙うモンスターを選んでください', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5));
    panel.add(this.add.text(0, -panelH / 2 + 46, '(選ばない場合はランダム)', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#888888',
    }).setOrigin(0.5));

    const cols = Math.min(MONSTER_IDS.length, 7);
    const cardW = 112;
    const startOff = -((cols - 1) * cardW) / 2;

    const launch = (targetDefId: string | null) => {
      overlay.destroy(); panel.destroy();
      const cpuTeam: OwnedMonster[] = [];
      if (targetDefId) {
        cpuTeam.push({ uid: generateUid(), defId: targetDefId, ivs: randomIVs() });
      }
      while (cpuTeam.length < TEAM_SIZE) {
        const id = MONSTER_IDS[Math.floor(Math.random() * MONSTER_IDS.length)];
        cpuTeam.push({ uid: generateUid(), defId: id, ivs: randomIVs() });
      }
      this.scene.start('Battle', { mode: 'quest', p1Team: playerTeam, p2Team: cpuTeam });
    };

    MONSTER_IDS.forEach((defId, ti) => {
      const def = getMonsterDef(defId);
      const bx = startOff + ti * cardW;
      const by = 20;

      const bg = this.add.rectangle(bx, by, cardW - 8, 160, 0x1a1842).setStrokeStyle(2, 0x5a4cd0);
      bg.setInteractive({ useHandCursor: true });

      const nameT = this.add.text(bx, by + 60, def.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#cccccc', fontStyle: 'bold',
        wordWrap: { width: cardW - 12 }, align: 'center',
      }).setOrigin(0.5);

      panel.add([bg, nameT]);

      if (this.textures.exists(def.frontSprite)) {
        const img = this.add.image(bx, by - 20, def.frontSprite);
        img.setScale(Math.min(70 / img.width, 60 / img.height));
        panel.add(img);
      }

      bg.on('pointerover', () => { bg.setFillStyle(0x2a2860); bg.setStrokeStyle(2, 0xffe066); });
      bg.on('pointerout', () => { bg.setFillStyle(0x1a1842); bg.setStrokeStyle(2, 0x5a4cd0); });
      bg.on('pointerdown', () => launch(defId));
    });

    // Skip button
    const skipBg = this.add.rectangle(0, panelH / 2 - 28, 160, 36, 0x222233).setStrokeStyle(1, 0x555566);
    const skipLabel = this.add.text(0, panelH / 2 - 28, 'ランダムでいい', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#888888',
    }).setOrigin(0.5);
    skipBg.setInteractive({ useHandCursor: true });
    skipBg.on('pointerover', () => { skipBg.setFillStyle(0x333355); skipLabel.setStyle({ color: '#aaaaaa' }); });
    skipBg.on('pointerout', () => { skipBg.setFillStyle(0x222233); skipLabel.setStyle({ color: '#888888' }); });
    skipBg.on('pointerdown', () => launch(null));
    panel.add([skipBg, skipLabel]);
  }

  private confirmNetworkTeam(myTeam: OwnedMonster[]): void {
    const localPlayer = this.sceneData.localPlayer ?? 1;
    this.disableAllCards();

    const countText = this.children.getByName('selectCount') as Phaser.GameObjects.Text | null;
    if (countText) countText.setText('相手のチームを待っています...');

    if (localPlayer === 1) {
      // Host: wait for guest's team, then send startBattle to guest
      NetManager.onMessage = (msg: NetworkMsg) => {
        if (msg.type !== 'team') return;
        const p2Team = msg.team;
        NetManager.send({ type: 'startBattle', p1Team: myTeam, p2Team });
        NetManager.onMessage = undefined;
        this.scene.start('Battle', {
          mode: 'network', localPlayer: 1, p1Team: myTeam, p2Team,
        });
      };
      // Signal readiness by sending our team first
      NetManager.send({ type: 'team', team: myTeam });
    } else {
      // Guest: send team to host, wait for startBattle
      NetManager.send({ type: 'team', team: myTeam });
      NetManager.onMessage = (msg: NetworkMsg) => {
        if (msg.type !== 'startBattle') return;
        NetManager.onMessage = undefined;
        this.scene.start('Battle', {
          mode: 'network', localPlayer: 2, p1Team: msg.p1Team, p2Team: msg.p2Team,
        });
      };
    }
  }

  private disableAllCards(): void {
    this.cards.forEach(c => {
      c.removeAllListeners();
      (c as any).bg?.setFillStyle(0x111111);
    });
    const dim = (this.startBtn as any).dimOverlay as Phaser.GameObjects.Rectangle;
    dim.setVisible(true);
    this.startBtn.removeAllListeners();
  }
}
