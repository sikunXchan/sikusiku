import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMove } from '../data/moves';
import { BattleEngine, createBattleMonster } from '../engine/BattleEngine';
import { BattleAI } from '../ai/BattleAI';
import { Effects } from '../fx/Effects';
import { NetManager } from '../net/NetManager';
import type { NetworkMsg } from '../net/messages';
import type { BattleAction, BattleEvent, BattleMonster, MoveDef, OwnedMonster } from '../data/types';

// Layout constants
const PANEL_Y = 388;
const ENEMY_X = 660;
const ENEMY_Y = 192;
const PLAYER_X = 265;
const PLAYER_Y = 298;
const HP_BAR_W = 440;
const HP_BAR_H = 18;
const ENEMY_HP_X = 490;
const ENEMY_HP_Y = 36;
const PLAYER_HP_X = 30;
const PLAYER_HP_Y = 356;
const BTN_H = 138;
const BTN_Y_CENTER = PANEL_Y + 10 + BTN_H / 2;
const MOVE_BTN_W = 207;
const MOVE_BTN_CENTERS_X = [113, 330, 547];
const SW_BTN_X = 812;
const SW_BTN_W = 138;
// Max display sizes for battle sprites (fit-to-box, aspect preserved)
const ENEMY_MAX_W = 240;
const ENEMY_MAX_H = 210;
const PLAYER_MAX_W = 210;
const PLAYER_MAX_H = 175;

interface HpBarUI {
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  maxW: number;
  defaultColor: number;
}

interface MoveBtn {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  cdLabel: Phaser.GameObjects.Text;
  dimOverlay: Phaser.GameObjects.Rectangle;
  moveId: string;
  enabled: boolean;
}

export interface BattleSceneData {
  mode: 'quest' | 'pvp' | 'network';
  p1Team: OwnedMonster[];
  p2Team: OwnedMonster[];
  localPlayer?: 1 | 2;
}

export class BattleScene extends Phaser.Scene {
  private engine!: BattleEngine;
  private ai!: BattleAI;
  private fx!: Effects;
  private mode: 'quest' | 'pvp' | 'network' = 'quest';
  private localPlayer: 1 | 2 = 1;

  private phase: 'selecting' | 'revealing' | 'animating' | 'forcedSwitch' | 'forcedAttack' | 'gameOver' = 'selecting';

  private timerVal = 20;
  private timerEvent?: Phaser.Time.TimerEvent;
  private timerText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;

  private p1Action?: BattleAction;
  private p2Action?: BattleAction;

  private enemySprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;

  private enemyHpUI!: HpBarUI;
  private playerHpUI!: HpBarUI;

  private p1TeamDots: Phaser.GameObjects.Arc[] = [];
  private p2TeamDots: Phaser.GameObjects.Arc[] = [];

  private moveBtns: MoveBtn[] = [];
  private swContainer!: Phaser.GameObjects.Container;
  private swDim!: Phaser.GameObjects.Rectangle;
  private swEnabled = true;

  private logText!: Phaser.GameObjects.Text;
  private p1StatusText!: Phaser.GameObjects.Text;

  private eventQueue: BattleEvent[] = [];
  private processingEvent = false;
  private tooltipBox?: Phaser.GameObjects.Container;
  private netPrecomputedEvents?: BattleEvent[];

  // ── Network helpers ───────────────────────────────────────────────────
  private get myActive(): BattleMonster {
    return this.localPlayer === 1 ? this.engine.p1Active : this.engine.p2Active;
  }
  private get myActiveIdx(): number {
    return this.localPlayer === 1 ? this.engine.p1ActiveIdx : this.engine.p2ActiveIdx;
  }
  private get myTeam(): BattleMonster[] {
    return this.localPlayer === 1 ? this.engine.p1Team : this.engine.p2Team;
  }
  private get myAction(): BattleAction | undefined {
    return this.localPlayer === 1 ? this.p1Action : this.p2Action;
  }
  private setMyAction(action: BattleAction): void {
    if (this.localPlayer === 1) this.p1Action = action;
    else this.p2Action = action;
  }

  constructor() {
    super('Battle');
  }

  init(data: BattleSceneData): void {
    this.mode = data.mode;
    this.localPlayer = data.localPlayer ?? 1;
    this.engine = new BattleEngine(
      data.p1Team.map(createBattleMonster),
      data.p2Team.map(createBattleMonster),
    );
    this.ai = new BattleAI();
    this.moveBtns = [];
    this.p1TeamDots = [];
    this.p2TeamDots = [];
    this.eventQueue = [];
    this.processingEvent = false;
    this.p1Action = undefined;
    this.p2Action = undefined;

    if (this.mode === 'network') {
      NetManager.onMessage = (msg: NetworkMsg) => this.handleNetMsg(msg);
      NetManager.onDisconnect = () => this.handleDisconnect();
    }
  }

  create(): void {
    this.fx = new Effects(this);
    this.buildBg();
    this.buildHpBars();
    this.buildSprites();
    this.buildStatusBar();
    this.buildLog();
    this.buildMoveBtns(this.myActive);
    this.buildSwBtn();
    this.buildTeamDots();
    this.showBanner('バトル開始!', '#9be7ff', () => this.startTurn());
  }

  // ── Background ────────────────────────────────────────────────────────

  private buildBg(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    for (let i = 0; i < 30; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, PANEL_Y - 20),
        Phaser.Math.FloatBetween(0.5, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.15, 0.7),
      );
      this.tweens.add({
        targets: s, alpha: 0.05,
        duration: Phaser.Math.Between(1200, 2800), yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
    this.add.rectangle(GAME_WIDTH / 2, PANEL_Y, GAME_WIDTH, 3, 0x5a4cd0, 0.6);
    this.add.rectangle(GAME_WIDTH / 2, (PANEL_Y + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - PANEL_Y, 0x0d0b1a);
  }

  // ── HP bars ───────────────────────────────────────────────────────────

  private buildHpBars(): void {
    this.enemyHpUI = this.makeHpBar(ENEMY_HP_X, ENEMY_HP_Y, this.engine.p2Active, 0xff6b6b);
    this.playerHpUI = this.makeHpBar(PLAYER_HP_X, PLAYER_HP_Y, this.engine.p1Active, 0x66ccff);
  }

  private makeHpBar(x: number, y: number, mon: BattleMonster, color: number): HpBarUI {
    const D = 60; // depth above sprites
    const nameText = this.add.text(x, y - 22, mon.monsterDef.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#cccccc', fontStyle: 'bold',
    }).setDepth(D);
    this.add.rectangle(x + HP_BAR_W / 2, y + HP_BAR_H / 2, HP_BAR_W, HP_BAR_H, 0x111111).setDepth(D);
    this.add.rectangle(x + HP_BAR_W / 2, y + HP_BAR_H / 2, HP_BAR_W, HP_BAR_H, 0).setStrokeStyle(1, 0x444444).setDepth(D);
    const fill = this.add.rectangle(x, y, HP_BAR_W, HP_BAR_H, color).setOrigin(0, 0).setDepth(D);
    const text = this.add.text(x + HP_BAR_W + 6, y + HP_BAR_H / 2, `${mon.currentHp}/${mon.maxHp}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#aaaaaa',
    }).setOrigin(0, 0.5).setDepth(D);
    return { fill, text, nameText, maxW: HP_BAR_W, defaultColor: color };
  }

  private syncHpBar(mon: BattleMonster, ui: HpBarUI): void {
    const ratio = mon.maxHp > 0 ? mon.currentHp / mon.maxHp : 0;
    this.tweens.add({ targets: ui.fill, width: Math.max(0, ui.maxW * ratio), duration: 380, ease: 'Cubic.easeOut' });
    ui.text.setText(`${mon.currentHp}/${mon.maxHp}`);
    ui.nameText.setText(mon.monsterDef.name);
    ui.fill.setFillStyle(ratio < 0.2 ? 0xff3333 : ratio < 0.5 ? 0xffaa00 : ui.defaultColor);
  }

  private syncAllHpBars(): void {
    this.syncHpBar(this.engine.p2Active, this.enemyHpUI);
    this.syncHpBar(this.engine.p1Active, this.playerHpUI);
  }

  // ── Sprites ───────────────────────────────────────────────────────────

  private fitSprite(img: Phaser.GameObjects.Image, maxW: number, maxH: number): void {
    img.setScale(1); // reset to get native texture dimensions
    const scale = Math.min(maxW / img.width, maxH / img.height);
    img.setScale(scale);
  }

  private buildSprites(): void {
    this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, this.engine.p2Active.monsterDef.frontSprite);
    this.fitSprite(this.enemySprite, ENEMY_MAX_W, ENEMY_MAX_H);
    this.playerSprite = this.add.image(PLAYER_X, PLAYER_Y, this.engine.p1Active.monsterDef.backSprite);
    this.fitSprite(this.playerSprite, PLAYER_MAX_W, PLAYER_MAX_H);
  }

  private resetSprites(): void {
    this.enemySprite.setTexture(this.engine.p2Active.monsterDef.frontSprite)
      .setAlpha(1).setPosition(ENEMY_X, ENEMY_Y).setAngle(0);
    this.fitSprite(this.enemySprite, ENEMY_MAX_W, ENEMY_MAX_H);
    this.playerSprite.setTexture(this.engine.p1Active.monsterDef.backSprite)
      .setAlpha(1).setPosition(PLAYER_X, PLAYER_Y).setAngle(0);
    this.fitSprite(this.playerSprite, PLAYER_MAX_W, PLAYER_MAX_H);
  }

  // ── Status bar & log ──────────────────────────────────────────────────

  private buildStatusBar(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, 10, 0x222222).setOrigin(0, 0);
    this.timerBar = this.add.rectangle(0, 0, GAME_WIDTH, 10, 0xffe066).setOrigin(0, 0);
    this.timerText = this.add.text(GAME_WIDTH / 2, 14, '20', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffe066',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(200);
    this.p1StatusText = this.add.text(28, 14, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#66ff66',
    }).setDepth(200);
  }

  private buildLog(): void {
    this.logText = this.add.text(GAME_WIDTH / 2, PANEL_Y - 18, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1).setDepth(100);
  }

  private setLog(msg: string): void { this.logText.setText(msg); }

  // ── Move buttons ──────────────────────────────────────────────────────

  private buildMoveBtns(mon: BattleMonster): void {
    for (const b of this.moveBtns) b.container.destroy();
    this.moveBtns = [];

    mon.monsterDef.moveIds.forEach((moveId, i) => {
      const move = getMove(moveId);
      const container = this.add.container(MOVE_BTN_CENTERS_X[i], BTN_Y_CENTER);

      // Opaque dark base + colored tint overlay
      container.add(this.add.rectangle(0, 0, MOVE_BTN_W, BTN_H, 0x080810, 1.0));
      const bg = this.add.rectangle(0, 0, MOVE_BTN_W, BTN_H, move.color, 0.35);
      bg.setStrokeStyle(2, move.color, 0.9);

      container.add([
        bg,
        this.add.text(0, -32, move.name, {
          fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5),
        this.add.text(0, 2, this.trunc(move.description, 18), {
          fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#cccccc',
        }).setOrigin(0.5),
        this.add.text(0, 32, `${move.cooldownTurns}ターン毎`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#aaaaaa',
        }).setOrigin(0.5),
      ]);

      const dimOverlay = this.add.rectangle(0, 0, MOVE_BTN_W, BTN_H, 0x000000, 0.6);
      dimOverlay.setVisible(false);
      const cdLabel = this.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ff5555', fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add([dimOverlay, cdLabel]);

      container.setSize(MOVE_BTN_W, BTN_H).setInteractive({ useHandCursor: true });

      const btn: MoveBtn = { container, bg, cdLabel, dimOverlay, moveId, enabled: true };
      this.moveBtns.push(btn);

      const idx = i;
      let holdTimer: Phaser.Time.TimerEvent | undefined;
      let showingTooltip = false;

      container.on('pointerover', () => { if (btn.enabled) bg.setAlpha(0.6); });
      container.on('pointerout', () => {
        if (btn.enabled) bg.setAlpha(0.35);
        holdTimer?.remove(); holdTimer = undefined;
        if (showingTooltip) { this.hideMoveTooltip(); showingTooltip = false; }
      });
      container.on('pointerdown', () => {
        showingTooltip = false;
        holdTimer = this.time.delayedCall(400, () => {
          showingTooltip = true;
          this.showMoveTooltip(move, MOVE_BTN_CENTERS_X[idx]);
        });
      });
      container.on('pointerup', () => {
        holdTimer?.remove(); holdTimer = undefined;
        if (showingTooltip) {
          this.hideMoveTooltip(); showingTooltip = false;
        } else if (btn.enabled && this.phase === 'selecting' && !this.p1Action) {
          this.onMove(idx);
        }
      });
    });
  }

  private buildSwBtn(): void {
    this.swContainer = this.add.container(SW_BTN_X, BTN_Y_CENTER);
    this.swContainer.add(this.add.rectangle(0, 0, SW_BTN_W, BTN_H, 0x080810, 1.0));
    const bg = this.add.rectangle(0, 0, SW_BTN_W, BTN_H, 0x556677, 0.35);
    bg.setStrokeStyle(2, 0xaaaaaa, 0.8);
    this.swContainer.add([
      bg,
      this.add.text(0, -14, '交代', {
        fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#cccccc', fontStyle: 'bold',
      }).setOrigin(0.5),
      this.add.text(0, 22, 'Switch', {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aaaaaa',
      }).setOrigin(0.5),
    ]);
    this.swDim = this.add.rectangle(0, 0, SW_BTN_W, BTN_H, 0x000000, 0.6);
    this.swDim.setVisible(false);
    this.swContainer.add(this.swDim);
    this.swContainer.setSize(SW_BTN_W, BTN_H).setInteractive({ useHandCursor: true });
    this.swContainer.on('pointerover', () => { if (this.swEnabled) bg.setAlpha(0.6); });
    this.swContainer.on('pointerout', () => { if (this.swEnabled) bg.setAlpha(0.35); });
    this.swContainer.on('pointerdown', () => {
      if (this.swEnabled && this.phase === 'selecting' && !this.p1Action) this.onSwitch();
    });
  }

  // ── Team dots ─────────────────────────────────────────────────────────

  private buildTeamDots(): void {
    for (let i = 0; i < this.engine.p1Team.length; i++) {
      this.p1TeamDots.push(this.add.circle(870 + i * 20, 18, 7, 0x66ccff).setDepth(200));
    }
    for (let i = 0; i < this.engine.p2Team.length; i++) {
      this.p2TeamDots.push(this.add.circle(GAME_WIDTH - 110 + i * 20, 18, 7, 0xff6b6b).setDepth(200));
    }
  }

  private refreshDots(): void {
    this.p1TeamDots.forEach((d, i) => {
      const m = this.engine.p1Team[i];
      d.setFillStyle(m.fainted ? 0x333333 : i === this.engine.p1ActiveIdx ? 0xffffff : 0x66ccff);
    });
    this.p2TeamDots.forEach((d, i) => {
      const m = this.engine.p2Team[i];
      d.setFillStyle(m.fainted ? 0x333333 : i === this.engine.p2ActiveIdx ? 0xffffff : 0xff6b6b);
    });
  }

  // ── Turn flow ─────────────────────────────────────────────────────────

  private startTurn(): void {
    this.phase = 'selecting';
    this.p1Action = undefined;
    this.p2Action = undefined;
    this.timerVal = 20;

    this.refreshMoveBtns();
    this.syncAllHpBars();
    this.refreshDots();
    this.resetSprites();
    this.p1StatusText.setText('');
    this.setLog(`ターン ${this.engine.turn} — 技を選べ!`);

    if (this.mode === 'quest') {
      this.p2Action = this.ai.decide(this.engine, 2);
    }

    this.timerEvent?.remove();
    this.timerText.setText('20').setStyle({ color: '#ffe066' });
    this.timerBar.setFillStyle(0xffe066); this.timerBar.width = GAME_WIDTH;
    this.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 19,
      callback: this.tickTimer, callbackScope: this,
    });
  }

  private tickTimer(): void {
    this.timerVal--;
    this.timerText.setText(`${this.timerVal}`);
    this.timerBar.width = GAME_WIDTH * (this.timerVal / 20);
    if (this.timerVal <= 5) {
      this.timerText.setStyle({ color: '#ff4444' });
      this.timerBar.setFillStyle(0xff4444);
    }
    if (this.timerVal <= 0 && this.phase === 'selecting') {
      this.timerEvent?.remove();
      if (this.mode === 'network') {
        if (!this.myAction) { this.setMyAction({ type: 'none' }); this.markReady(); this.checkReady(); }
      } else {
        if (!this.p1Action) this.p1Action = { type: 'none' };
        if (!this.p2Action) this.p2Action = { type: 'none' };
        this.startReveal();
      }
    }
  }

  private onMove(idx: number): void {
    if (this.phase !== 'selecting' || this.myAction) return;
    const moveId = this.myActive.monsterDef.moveIds[idx];
    if (!moveId || !this.engine.isMoveReady(this.myActive, moveId)) return;
    this.setMyAction({ type: 'move', moveId });
    this.markReady();
    this.checkReady();
  }

  private onSwitch(): void {
    if (this.phase !== 'selecting' || this.myAction) return;
    const targets = this.engine.availableSwitchTargets(this.myTeam, this.myActiveIdx);
    if (!targets.length) return;
    this.switchPopup(this.myTeam, targets, false,
      (idx) => {
        this.setMyAction({ type: 'switch', targetIndex: idx });
        this.markReady();
        this.checkReady();
      },
      () => {/* cancelled */},
    );
  }

  private markReady(): void {
    this.disableAllBtns();
    this.p1StatusText.setText('✓ 選択済み');
  }

  private checkReady(): void {
    if (this.mode === 'network') {
      if (this.localPlayer === 2) {
        // Guest: send action to host and wait for turnResult
        NetManager.send({ type: 'action', action: this.p2Action! });
      } else {
        // Host: check if both actions available
        if (!this.p1Action || !this.p2Action) return;
        this.timerEvent?.remove();
        this.time.delayedCall(300, () => this.startReveal());
      }
      return;
    }
    if (!this.p1Action || !this.p2Action) return;
    this.timerEvent?.remove();
    this.time.delayedCall(300, () => this.startReveal());
  }

  // ── Reveal ────────────────────────────────────────────────────────────

  private startReveal(): void {
    if (this.phase !== 'selecting') return;
    this.phase = 'revealing';
    this.disableAllBtns();

    const p1A = this.p1Action!;
    const p2A = this.p2Action!;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(300);
    this.tweens.add({ targets: overlay, alpha: 0.62, duration: 250 });

    const p1txt = this.add.text(80, GAME_HEIGHT / 2 + 14, this.actionStr(p1A, 1), {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#66ccff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0, 0.5).setDepth(301).setAlpha(0);
    this.tweens.add({ targets: p1txt, alpha: 1, duration: 340, ease: 'Back.easeOut' });

    const p2txt = this.add.text(GAME_WIDTH - 80, GAME_HEIGHT / 2 - 14, this.actionStr(p2A, 2), {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#ff6b6b',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(1, 0.5).setDepth(301).setAlpha(0);

    this.tweens.add({
      targets: p2txt, alpha: 1, duration: 340, ease: 'Back.easeOut', delay: 220,
      onComplete: () => {
        const fight = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'バトル!!', {
          fontFamily: 'system-ui, sans-serif', fontSize: '62px', color: '#ffe066',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 10,
        }).setOrigin(0.5).setDepth(302).setScale(0);
        this.tweens.add({
          targets: fight, scale: 1, duration: 280, ease: 'Back.easeOut',
          onComplete: () => {
            this.time.delayedCall(680, () => {
              this.tweens.add({
                targets: [overlay, p1txt, p2txt, fight], alpha: 0, duration: 320,
                onComplete: () => {
                  overlay.destroy(); p1txt.destroy(); p2txt.destroy(); fight.destroy();
                  this.execTurn(p1A, p2A);
                },
              });
            });
          },
        });
      },
    });
  }

  private actionStr(a: BattleAction, player: 1 | 2): string {
    const name = (player === 1 ? this.engine.p1Active : this.engine.p2Active).monsterDef.name;
    if (a.type === 'move') return `${name}の【${getMove(a.moveId).name}】`;
    if (a.type === 'switch') {
      const team = player === 1 ? this.engine.p1Team : this.engine.p2Team;
      return `${name} → ${team[a.targetIndex]?.monsterDef.name ?? '?'}へ交代`;
    }
    return `${name} — なにもしない`;
  }

  // ── Execute turn ──────────────────────────────────────────────────────

  private execTurn(p1A: BattleAction, p2A: BattleAction): void {
    this.phase = 'animating';
    if (this.netPrecomputedEvents) {
      this.eventQueue = this.netPrecomputedEvents;
      this.netPrecomputedEvents = undefined;
    } else {
      const rawEvents = this.engine.resolveTurn(p1A, p2A);
      if (this.mode === 'network' && this.localPlayer === 1) {
        NetManager.send({
          type: 'turnResult', p1Action: p1A, p2Action: p2A,
          events: rawEvents, state: this.engine.captureNetState(),
        });
      }
      this.eventQueue = rawEvents.filter(e => e.type !== 'revealActions');
    }
    this.processingEvent = false;
    this.nextEvent();
  }

  private nextEvent(): void {
    if (this.processingEvent) return;
    if (!this.eventQueue.length) { this.allDone(); return; }
    const ev = this.eventQueue.shift()!;
    this.processingEvent = true;
    this.playEv(ev, () => { this.processingEvent = false; this.nextEvent(); });
  }

  private playEv(ev: BattleEvent, done: () => void): void {
    switch (ev.type) {
      case 'switch':            this.aSwitch(ev.player, ev.toIdx, done); break;
      case 'dodge':             this.aDodge(ev.player, done); break;
      case 'attack':            this.aAttack(ev.player, ev.moveId, ev.damage, ev.critical, ev.dodged, done); break;
      case 'buff':              this.aBuff(ev.player, ev.description, done); break;
      case 'atkDebuff':         this.aAtkDebuff(ev.target, done); break;
      case 'conditionalDamage': this.aConditional(ev.player, ev.damage, ev.dodged, done); break;
      case 'faint':             this.aFaint(ev.player, done); break;
      case 'gameOver':          this.showGameOver(ev.winner); break;
      default:                  done();
    }
  }

  // ── Animations ────────────────────────────────────────────────────────

  private aSwitch(player: 1|2, toIdx: number, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const origX = player === 1 ? PLAYER_X : ENEMY_X;
    const dir = player === 1 ? -1 : 1;
    const mon = (player === 1 ? this.engine.p1Team : this.engine.p2Team)[toIdx];
    const key = player === 1 ? mon.monsterDef.backSprite : mon.monsterDef.frontSprite;
    this.setLog(`${mon.monsterDef.name} 登場!`);
    this.tweens.add({
      targets: sp, x: origX + dir * 200, alpha: 0, duration: 240,
      onComplete: () => {
        sp.setTexture(key);
        this.fitSprite(sp, player === 1 ? PLAYER_MAX_W : ENEMY_MAX_W, player === 1 ? PLAYER_MAX_H : ENEMY_MAX_H);
        sp.setAlpha(0).setX(origX - dir * 200);
        this.tweens.add({
          targets: sp, x: origX, alpha: 1, duration: 260, ease: 'Cubic.easeOut',
          onComplete: () => { this.syncAllHpBars(); this.time.delayedCall(350, done); },
        });
      },
    });
  }

  private aDodge(player: 1|2, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const origX = sp.x;
    const dir = player === 1 ? -1 : 1;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name} の かわす!`);
    const ghost = this.add.image(origX, sp.y, sp.texture.key)
      .setScale(sp.scaleX).setAlpha(0.35).setTint(0x9be7ff).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 400, onComplete: () => ghost.destroy() });
    this.tweens.add({
      targets: sp, x: origX + dir * 72, duration: 100, ease: 'Cubic.easeOut',
      onComplete: () => this.tweens.add({
        targets: sp, x: origX, duration: 200, ease: 'Cubic.easeIn',
        onComplete: () => this.time.delayedCall(180, done),
      }),
    });
  }

  private aAttack(
    player: 1|2, moveId: string, damage: number,
    critical: boolean, dodged: boolean, done: () => void,
  ): void {
    const atkSp = player === 1 ? this.playerSprite : this.enemySprite;
    const defSp = player === 1 ? this.enemySprite : this.playerSprite;
    const atk = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    const move = getMove(moveId);
    const origX = atkSp.x;
    this.setLog(`${atk.monsterDef.name} の ${move.name}!`);

    if (dodged) {
      this.time.delayedCall(120, () => {
        this.pop(defSp.x, defSp.y - 80, 'かわした!', '#9be7ff', 24);
        this.time.delayedCall(550, done);
      });
      return;
    }

    const rushX = player === 1 ? defSp.x - 110 : defSp.x + 110;
    this.tweens.add({
      targets: atkSp, x: rushX, duration: 210, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.fx.hitBurst(defSp.x, defSp.y - 38, move.color, critical);
        this.flashImg(defSp);
        this.fx.shake(critical ? 0.012 : 0.006, critical ? 220 : 130);
        this.pop(defSp.x, defSp.y - 85, critical ? `${damage}!` : `${damage}`,
          critical ? '#ff4444' : '#ffffff', critical ? 46 : 30);
        if (critical) this.pop(defSp.x, defSp.y - 125, 'CRITICAL!', '#ffe066', 18);
        if (moveId === 'shikken') this.pop(atkSp.x, atkSp.y - 75, '防御低下!', '#ffaa55', 15);
        this.syncAllHpBars();
        const kdir = player === 1 ? 1 : -1;
        this.tweens.add({ targets: defSp, x: defSp.x + kdir * 28, duration: 75, yoyo: true });
        this.tweens.add({
          targets: atkSp, x: origX, duration: 190, ease: 'Cubic.easeOut',
          onComplete: () => this.time.delayedCall(320, done),
        });
      },
    });
  }

  private aBuff(player: 1|2, desc: string, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name}: ${desc}`);
    const glow = this.add.circle(sp.x, sp.y, 56, 0xffd700, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
    this.tweens.add({ targets: sp, scaleX: sp.scaleX * 1.12, scaleY: sp.scaleY * 1.12, duration: 200, yoyo: true });
    this.pop(sp.x, sp.y - 90, desc, '#ffd700', 17);
    this.time.delayedCall(820, done);
  }

  private aAtkDebuff(target: 1|2, done: () => void): void {
    const sp = target === 1 ? this.playerSprite : this.enemySprite;
    const mon = target === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name} の こうげきが さがった!`);
    const aura = this.add.circle(sp.x, sp.y, 50, 0x880000, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: aura, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 600, onComplete: () => aura.destroy() });
    this.tweens.add({ targets: sp, x: sp.x + 12, duration: 55, yoyo: true, repeat: 4 });
    this.pop(sp.x, sp.y - 90, 'こうげき↓', '#ff6666', 20);
    this.time.delayedCall(720, done);
  }

  private aConditional(player: 1|2, damage: number, dodged: boolean, done: () => void): void {
    const defSp = player === 1 ? this.enemySprite : this.playerSprite;
    const atkSp = player === 1 ? this.playerSprite : this.enemySprite;
    const atk = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    const def = player === 1 ? this.engine.p2Active : this.engine.p1Active;

    if (dodged) {
      this.setLog(`震える... ${def.monsterDef.name} にかわされた!`);
      this.pop(defSp.x, defSp.y - 80, 'かわした!', '#9be7ff', 24);
      this.time.delayedCall(580, done);
      return;
    }
    if (damage === 0) { done(); return; }

    this.setLog(`${atk.monsterDef.name} のチャンス! 震える追撃!`);
    this.tweens.add({ targets: atkSp, angle: 6, duration: 75, yoyo: true, repeat: 3, onComplete: () => atkSp.setAngle(0) });
    this.fx.hitBurst(defSp.x, defSp.y - 38, 0xd070ff, true);
    this.flashImg(defSp);
    this.fx.shake(0.01, 200);
    this.pop(defSp.x, defSp.y - 88, `${damage}!`, '#d070ff', 42);
    this.syncAllHpBars();
    this.time.delayedCall(720, done);
  }

  private aFaint(player: 1|2, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name} は たおれた!`);
    this.syncAllHpBars();
    this.tweens.add({
      targets: sp, alpha: 0, y: sp.y + 65, duration: 580, ease: 'Cubic.easeIn',
      onComplete: () => this.time.delayedCall(220, done),
    });
  }

  // ── Post-event ────────────────────────────────────────────────────────

  private allDone(): void {
    const p1Fainted = this.engine.p1Active.fainted && this.engine.p1Team.some(m => !m.fainted);
    const p2Fainted = this.engine.p2Active.fainted && this.engine.p2Team.some(m => !m.fainted);

    if (this.mode === 'network') {
      if (p1Fainted || p2Fainted) {
        this.phase = 'forcedSwitch';
        const faintedPlayer: 1|2 = p1Fainted ? 1 : 2;
        if (faintedPlayer === this.localPlayer) {
          this.doForcedSwitch(faintedPlayer);
        }
        // else: wait for opponent's forcedSwitch net message
      } else {
        this.nextTurn();
      }
      return;
    }

    if (p1Fainted) {
      this.doForcedSwitch(1);
    } else if (p2Fainted) {
      if (this.mode === 'quest') {
        const idx = this.ai.chooseForcedSwitch(this.engine.p2Team, this.engine.p2ActiveIdx, this.engine, 2);
        this.engine.doForcedSwitch(2, idx);
        this.resetSprites(); this.syncAllHpBars();
        this.time.delayedCall(300, () => this.nextTurn());
      } else {
        this.doForcedSwitch(2);
      }
    } else {
      this.nextTurn();
    }
  }

  private doForcedSwitch(player: 1|2): void {
    this.phase = 'forcedSwitch';
    const team = player === 1 ? this.engine.p1Team : this.engine.p2Team;
    const activeIdx = player === 1 ? this.engine.p1ActiveIdx : this.engine.p2ActiveIdx;
    const targets = this.engine.availableSwitchTargets(team, activeIdx);
    if (!targets.length) { this.nextTurn(); return; }

    this.setLog('つぎのモンスターを選べ!');
    this.switchPopup(team, targets, true,
      (idx) => {
        if (this.mode === 'network') {
          NetManager.send({ type: 'forcedSwitch', player, idx });
        }
        this.engine.doForcedSwitch(player, idx);
        this.resetSprites(); this.syncAllHpBars();
        if (this.mode === 'network') {
          this.time.delayedCall(300, () => { this.buildMoveBtns(this.myActive); this.nextTurn(); });
        } else {
          this.doForcedAttack(player);
        }
      },
      () => {/* forced — no cancel */},
    );
  }

  private doForcedAttack(player: 1|2): void {
    this.phase = 'forcedAttack';
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;

    // CPU handles player 2 (or player 1 in quest with no controls needed)
    if (player !== 1) {
      const action = this.ai.decide(this.engine, player);
      const atk: BattleAction = action.type === 'move' ? action : { type: 'none' };
      this.setLog(`${mon.monsterDef.name} 登場!`);
      this.time.delayedCall(380, () => {
        this.eventQueue = this.engine.resolveBonusAttack(player, atk);
        this.processingEvent = false; this.nextEvent();
      });
      return;
    }

    // Human player 1 forced attack
    this.buildMoveBtns(mon);
    this.setLog(`${mon.monsterDef.name} 登場! 技を選べ! (交代不可)`);
    this.p1StatusText.setText('');
    this.refreshMoveBtns();
    this.swEnabled = false; this.swDim.setVisible(true);

    this.moveBtns.forEach((btn, i) => {
      btn.container.removeAllListeners('pointerdown');
      btn.container.on('pointerdown', () => {
        if (!btn.enabled || this.phase !== 'forcedAttack') return;
        const moveId = mon.monsterDef.moveIds[i];
        if (!moveId || !this.engine.isMoveReady(mon, moveId)) return;
        this.disableAllBtns();
        this.eventQueue = this.engine.resolveBonusAttack(1, { type: 'move', moveId });
        this.processingEvent = false; this.nextEvent();
      });
    });

    this.timerEvent?.remove();
    this.timerVal = 10;
    this.timerText.setText('10').setStyle({ color: '#ffe066' });
    this.timerBar.setFillStyle(0xffe066); this.timerBar.width = GAME_WIDTH * 0.5;
    this.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 9,
      callback: () => {
        this.timerVal--;
        this.timerText.setText(`${this.timerVal}`);
        this.timerBar.width = GAME_WIDTH * (this.timerVal / 20);
        if (this.timerVal <= 0 && this.phase === 'forcedAttack') {
          this.timerEvent?.remove();
          this.disableAllBtns();
          this.eventQueue = this.engine.resolveBonusAttack(1, { type: 'none' });
          this.processingEvent = false; this.nextEvent();
        }
      },
    });
  }

  private nextTurn(): void {
    if (!this.engine.p1Team.some(m => !m.fainted)) { this.showGameOver(2); return; }
    if (!this.engine.p2Team.some(m => !m.fainted)) { this.showGameOver(1); return; }
    this.buildMoveBtns(this.myActive);
    this.startTurn();
  }

  // ── Game Over ─────────────────────────────────────────────────────────

  private showGameOver(winner: 1|2): void {
    this.phase = 'gameOver';
    this.timerEvent?.remove();
    this.fx.shake(0.018, 380);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(2000);
    const isWin = this.mode === 'network' ? winner === this.localPlayer : winner === 1;
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 28,
      isWin ? 'YOU WIN!' : 'YOU LOSE…', {
      fontFamily: 'system-ui, sans-serif', fontSize: '72px',
      color: isWin ? '#9be7ff' : '#ff4d6d',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2001).setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 62, 'タップでタイトルへ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(2001);
    this.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });

    this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.scene.start('Title')));
  }

  // ── Switch popup ──────────────────────────────────────────────────────

  private switchPopup(
    team: BattleMonster[],
    targets: number[],
    forced: boolean,
    onSelect: (idx: number) => void,
    onCancel: () => void,
  ): void {
    const panelW = Math.max(480, targets.length * 188 + 40);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(600).setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(601);

    const panelBg = this.add.rectangle(0, 0, panelW, 200, 0x1a1530);
    panelBg.setStrokeStyle(2, forced ? 0xff4444 : 0x5a4cd0);
    panel.add(panelBg);
    panel.add(this.add.text(0, -80, forced ? 'つぎのモンスターを選べ!' : '交代するモンスターを選べ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px',
      color: forced ? '#ff6666' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));

    const startOff = -((targets.length - 1) * 185) / 2;
    targets.forEach((idx, ti) => {
      const mon = team[idx];
      const bx = startOff + ti * 185;
      const ratio = mon.maxHp > 0 ? mon.currentHp / mon.maxHp : 0;
      const bColor = ratio < 0.2 ? 0xff3333 : ratio < 0.5 ? 0xffaa00 : 0x66ccff;
      const bw = 130 * ratio;

      const bg = this.add.rectangle(bx, 18, 172, 110, 0x2a2350).setStrokeStyle(2, 0x5a4cd0);
      const nm = this.add.text(bx, -18, mon.monsterDef.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const hp = this.add.text(bx, 5, `HP: ${mon.currentHp}/${mon.maxHp}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#66ccff',
      }).setOrigin(0.5);
      const barBg = this.add.rectangle(bx, 30, 130, 8, 0x333333).setOrigin(0.5);
      const barFg = this.add.rectangle(bx - 65 + bw / 2, 30, Math.max(0, bw), 8, bColor).setOrigin(0.5);
      panel.add([bg, nm, hp, barBg, barFg]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { overlay.destroy(); panel.destroy(); onSelect(idx); });
      bg.on('pointerover', () => bg.setFillStyle(0x3a3560));
      bg.on('pointerout', () => bg.setFillStyle(0x2a2350));
    });

    if (!forced) {
      const cancel = this.add.text(0, 82, 'キャンセル', {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#888888',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cancel.on('pointerdown', () => { overlay.destroy(); panel.destroy(); onCancel(); });
      cancel.on('pointerover', () => cancel.setStyle({ color: '#ffffff' }));
      cancel.on('pointerout', () => cancel.setStyle({ color: '#888888' }));
      panel.add(cancel);
    }
  }

  // ── Button refresh ────────────────────────────────────────────────────

  private refreshMoveBtns(): void {
    const mon = this.myActive;
    this.moveBtns.forEach((btn, i) => {
      const moveId = mon.monsterDef.moveIds[i];
      if (!moveId) { btn.container.setVisible(false); return; }
      btn.container.setVisible(true);
      btn.moveId = moveId;
      const ready = this.engine.isMoveReady(mon, moveId);
      btn.enabled = ready;
      btn.dimOverlay.setVisible(!ready);
      if (!ready) {
        const left = (mon.moveCooldowns[moveId] ?? 0) - this.engine.turn;
        btn.cdLabel.setText(`あと${left}T`);
      } else {
        btn.cdLabel.setText('');
      }
    });
    const canSw = this.engine.availableSwitchTargets(this.myTeam, this.myActiveIdx).length > 0;
    this.swEnabled = canSw; this.swDim.setVisible(!canSw);
  }

  private disableAllBtns(): void {
    this.moveBtns.forEach(b => { b.enabled = false; b.dimOverlay.setVisible(true); });
    this.swEnabled = false; this.swDim.setVisible(true);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private pop(x: number, y: number, text: string, color: string, size = 28): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: t, y: y - 55, alpha: 0, duration: 780, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private flashImg(img: Phaser.GameObjects.Image): void {
    img.setTint(0xffffff);
    this.time.delayedCall(65, () => img.clearTint());
  }

  private showBanner(text: string, color: string, cb: () => void): void {
    const b = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 28, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '58px', color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2001).setScale(0);
    this.tweens.add({
      targets: b, scale: 1, duration: 340, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: b, alpha: 0, y: b.y - 50, delay: 480, duration: 380,
        onComplete: () => { b.destroy(); cb(); },
      }),
    });
  }

  private showMoveTooltip(move: MoveDef, btnX: number): void {
    this.hideMoveTooltip();
    const cx = Phaser.Math.Clamp(btnX, 140, GAME_WIDTH - 140);
    const cy = PANEL_Y - 55;
    const w = 260;
    const c = this.add.container(cx, cy).setDepth(600);
    c.add(this.add.rectangle(0, 0, w, 95, 0x000000, 0.93).setStrokeStyle(1, 0x777777));
    c.add(this.add.text(0, -30, move.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(0, -6, move.description, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#dddddd',
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5));
    c.add(this.add.text(0, 34, `クールダウン ${move.cooldownTurns}ターン`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#aaaaaa',
    }).setOrigin(0.5));
    this.tooltipBox = c;
  }

  private hideMoveTooltip(): void {
    this.tooltipBox?.destroy();
    this.tooltipBox = undefined;
  }

  private trunc(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  // ── Network message handling ──────────────────────────────────────────

  private handleNetMsg(msg: NetworkMsg): void {
    switch (msg.type) {
      case 'action':
        // Host receives guest's action
        if (this.localPlayer === 1 && this.phase === 'selecting') {
          this.p2Action = msg.action;
          this.checkReady();
        }
        break;

      case 'turnResult':
        // Guest receives resolved turn from host
        if (this.localPlayer !== 2 || this.phase !== 'selecting') break;
        this.timerEvent?.remove();
        this.p1Action = msg.p1Action;
        this.p2Action = msg.p2Action;
        this.engine.applyNetState(msg.state);
        this.netPrecomputedEvents = msg.events.filter(e => e.type !== 'revealActions');
        this.time.delayedCall(100, () => this.startReveal());
        break;

      case 'forcedSwitch':
        // Other player made their forced switch
        if (this.phase !== 'forcedSwitch') break;
        this.engine.doForcedSwitch(msg.player, msg.idx);
        this.resetSprites();
        this.syncAllHpBars();
        this.time.delayedCall(300, () => { this.buildMoveBtns(this.myActive); this.nextTurn(); });
        break;

      default:
        break;
    }
  }

  private handleDisconnect(): void {
    if (this.phase === 'gameOver') return;
    this.phase = 'gameOver';
    this.timerEvent?.remove();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(2000);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, '接続が切れました', {
      fontFamily: 'system-ui, sans-serif', fontSize: '40px', color: '#ff8888',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2001);
    this.time.delayedCall(2000, () => this.input.once('pointerdown', () => this.scene.start('Title')));
  }
}
