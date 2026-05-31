import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { getMove } from '../data/moves';
import { BattleEngine, createBattleMonster } from '../engine/BattleEngine';
import { BattleAI } from '../ai/BattleAI';
import { Effects } from '../fx/Effects';
import { NetManager } from '../net/NetManager';
import { addOwnedMonster, loadSave, persistSave, randomIVs } from '../storage/SaveData';
import type { NetworkMsg } from '../net/messages';
import type { BattleAction, BattleEvent, BattleMonster, MoveDef, OwnedMonster, StatusEffect, StatusEffectType } from '../data/types';

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

const STATUS_DESCS: Record<string, string> = {
  burn:                '🔥 やけど\n毎ターン 最大HP÷18 ダメ',
  paralyze:            '⚡ まひ\n20%の確率で技が失敗',
  poison:              '☠ どく\n毎ターン 現在HP÷8 ダメ',
  confuse:             '😵 こんらん\n15%の確率で技失敗\n失敗時は自傷ダメあり',
  bind:                '🔒 そくばく\n1ターン 行動・交代不可',
  critBoost:           '✨ 急所の呪い\n必ず急所に当たる',
  atkDebuffOnOpponent: '⬇ こうげき低下\n攻撃力が下がっている',
  counterReady:        '🛡 カウンター準備中\n次の攻撃を跳ね返す',
  counterFailed:       '🔗 カウンター失敗\n次のターン行動不可',
};

export class BattleScene extends Phaser.Scene {
  private engine!: BattleEngine;
  private ai!: BattleAI;
  private fx!: Effects;
  private mode: 'quest' | 'pvp' | 'network' = 'quest';
  private localPlayer: 1 | 2 = 1;

  private phase: 'selecting' | 'revealing' | 'animating' | 'forcedSwitch' | 'forcedAttack' | 'gameOver' = 'selecting';

  private timerVal = 60;
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
  private p1StatusIcons: Phaser.GameObjects.Text[] = [];
  private p2StatusIcons: Phaser.GameObjects.Text[] = [];
  private p1StatusTypes: string[] = [];
  private p2StatusTypes: string[] = [];
  private bonusP1Action?: BattleAction;
  private bonusP2Action?: BattleAction;

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
    this.buildStatusIcons();
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
    this.refreshStatusIcons();
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
    this.timerText = this.add.text(GAME_WIDTH / 2, 14, '60', {
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
    // "自チーム" label + P1 dots (left group)
    this.add.text(722, 9, '自チーム', {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#66ccff',
    }).setDepth(200);
    for (let i = 0; i < this.engine.p1Team.length; i++) {
      this.p1TeamDots.push(this.add.circle(760 + i * 16, 18, 7, 0x66ccff).setDepth(200));
    }
    // "敵チーム" label + P2 dots (right group)
    this.add.text(820, 9, '敵チーム', {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#ff6b6b',
    }).setDepth(200);
    for (let i = 0; i < this.engine.p2Team.length; i++) {
      this.p2TeamDots.push(this.add.circle(858 + i * 16, 18, 7, 0xff6b6b).setDepth(200));
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
    this.timerVal = 60;

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
    this.timerText.setText('60').setStyle({ color: '#ffe066' });
    this.timerBar.setFillStyle(0xffe066); this.timerBar.width = GAME_WIDTH;
    this.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 59,
      callback: this.tickTimer, callbackScope: this,
    });
  }

  private tickTimer(): void {
    this.timerVal--;
    this.timerText.setText(`${this.timerVal}`);
    this.timerBar.width = GAME_WIDTH * (this.timerVal / 60);
    if (this.timerVal <= 10) {
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
      case 'buff':              this.aBuff(ev.player, ev.moveId, ev.description, done); break;
      case 'atkDebuff':         this.aAtkDebuff(ev.target, done); break;
      case 'conditionalDamage': this.aConditional(ev.player, ev.damage, ev.dodged, done); break;
      case 'counter':           this.aCounter(ev.player, ev.damage, ev.failed, done); break;
      case 'ohko':              this.aOhko(ev.player, ev.succeeded, done); break;
      case 'statusApply':       this.aStatusApply(ev.target, ev.statusType, done); break;
      case 'statusTick':        this.aStatusTick(ev.player, ev.statusType, ev.damage, done); break;
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
      targets: sp, x: origX + dir * 200, alpha: 0, duration: 360,
      onComplete: () => {
        sp.setTexture(key);
        this.fitSprite(sp, player === 1 ? PLAYER_MAX_W : ENEMY_MAX_W, player === 1 ? PLAYER_MAX_H : ENEMY_MAX_H);
        sp.setAlpha(0).setX(origX - dir * 200);
        this.tweens.add({
          targets: sp, x: origX, alpha: 1, duration: 380, ease: 'Cubic.easeOut',
          onComplete: () => { this.syncAllHpBars(); this.time.delayedCall(600, done); },
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
      targets: sp, x: origX + dir * 72, duration: 150, ease: 'Cubic.easeOut',
      onComplete: () => this.tweens.add({
        targets: sp, x: origX, duration: 300, ease: 'Cubic.easeIn',
        onComplete: () => this.time.delayedCall(350, done),
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
        this.time.delayedCall(800, done);
      });
      return;
    }

    const rushX = player === 1 ? defSp.x - 110 : defSp.x + 110;
    this.tweens.add({
      targets: atkSp, x: rushX, duration: 290, ease: 'Cubic.easeIn',
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
          targets: atkSp, x: origX, duration: 260, ease: 'Cubic.easeOut',
          onComplete: () => this.time.delayedCall(600, done),
        });
      },
    });
  }

  private aBuff(player: 1|2, moveId: string, desc: string, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name}: ${desc}`);

    const isCurse = ['akumanoroi','kyuushoNoroi','drumming','furueru'].includes(moveId);
    const color = isCurse ? 0xaa44ff : 0xffd700;

    if (isCurse) {
      // Curse: dark spiral effect
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const orb = this.add.circle(sp.x + Math.cos(angle) * 50, sp.y + Math.sin(angle) * 50, 6, color, 0.9)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: orb, x: sp.x, y: sp.y, alpha: 0, duration: 500, delay: i * 60,
          onComplete: () => orb.destroy() });
      }
    } else {
      const glow = this.add.circle(sp.x, sp.y, 56, color, 0.25).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
    }

    this.tweens.add({ targets: sp, scaleX: sp.scaleX * 1.12, scaleY: sp.scaleY * 1.12, duration: 200, yoyo: true });
    this.pop(sp.x, sp.y - 90, desc, isCurse ? '#dd88ff' : '#ffd700', 17);
    this.refreshStatusIcons();
    this.time.delayedCall(1400, done);
  }

  private aAtkDebuff(target: 1|2, done: () => void): void {
    const sp = target === 1 ? this.playerSprite : this.enemySprite;
    const mon = target === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name} の こうげきが さがった!`);
    const aura = this.add.circle(sp.x, sp.y, 50, 0x880000, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: aura, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 600, onComplete: () => aura.destroy() });
    // Shikken/Chakken special: blade slash streak
    for (let i = 0; i < 3; i++) {
      const slash = this.add.rectangle(sp.x + (i - 1) * 18, sp.y - 20, 4, 55, 0x66ccff, 0.85)
        .setAngle(-35).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: slash, alpha: 0, x: slash.x + 28, duration: 280, delay: i * 60,
        onComplete: () => slash.destroy() });
    }
    this.tweens.add({ targets: sp, x: sp.x + 12, duration: 55, yoyo: true, repeat: 4 });
    this.pop(sp.x, sp.y - 90, 'こうげき↓', '#ff6666', 20);
    this.time.delayedCall(1200, done);
  }

  private aCounter(player: 1|2, damage: number, failed: boolean, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const defSp = player === 1 ? this.enemySprite : this.playerSprite;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;

    if (failed) {
      this.setLog(`${mon.monsterDef.name} のカウンター — 不発!`);
      const fail = this.add.circle(sp.x, sp.y, 40, 0x444444, 0.5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: fail, alpha: 0, scaleX: 2, scaleY: 2, duration: 600, onComplete: () => fail.destroy() });
      this.pop(sp.x, sp.y - 80, '不発…', '#888888', 22);
      this.time.delayedCall(1000, done);
      return;
    }

    this.setLog(`${mon.monsterDef.name} のカウンター! ${damage}ダメ返し!`);
    // Shield flash then burst toward opponent
    const shield = this.add.circle(sp.x, sp.y, 50, 0xff6600, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: shield, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 500, onComplete: () => shield.destroy() });
    this.time.delayedCall(250, () => {
      this.fx.hitBurst(defSp.x, defSp.y - 30, 0xff6600, true);
      this.flashImg(defSp);
      this.fx.shake(0.01, 200);
      this.syncAllHpBars();
      this.pop(defSp.x, defSp.y - 85, `${damage}!`, '#ff8800', 36);
    });
    this.time.delayedCall(1200, done);
  }

  private aOhko(player: 1|2, succeeded: boolean, done: () => void): void {
    const atkSp = player === 1 ? this.playerSprite : this.enemySprite;
    const defSp = player === 1 ? this.enemySprite : this.playerSprite;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;

    if (!succeeded) {
      this.setLog(`${mon.monsterDef.name} の漆黒のつるぎ — 無効化された!`);
      this.fx.shake(0.015, 300);
      const dark = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
        .setDepth(500);
      this.tweens.add({ targets: dark, alpha: 0.8, duration: 400, yoyo: true, onComplete: () => dark.destroy() });
      this.syncAllHpBars();
      this.time.delayedCall(900, done);
      return;
    }

    this.setLog(`${mon.monsterDef.name} の漆黒のつるぎ! 一撃!`);
    // Dark explosion
    const dark = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(500);
    this.tweens.add({ targets: dark, alpha: 0.95, duration: 280 });
    this.time.delayedCall(280, () => {
      this.fx.hitBurst(defSp.x, defSp.y - 30, 0x440088, true);
      this.fx.shake(0.02, 350);
      this.syncAllHpBars();
      this.pop(defSp.x, defSp.y - 85, '一撃!!', '#cc44ff', 48);
      this.tweens.add({ targets: dark, alpha: 0, duration: 600, delay: 400, onComplete: () => dark.destroy() });
      // Self damage flash
      this.tweens.add({ targets: atkSp, alpha: 0.4, duration: 100, yoyo: true, repeat: 2 });
      this.pop(atkSp.x, atkSp.y - 70, '-100', '#ff8888', 20);
    });
    this.time.delayedCall(1500, done);
  }

  private aStatusApply(target: 1|2, statusType: StatusEffectType, done: () => void): void {
    const sp = target === 1 ? this.playerSprite : this.enemySprite;
    const labels: Record<string, [string, number]> = {
      burn:     ['🔥 やけど!', 0xff4400],
      paralyze: ['⚡ まひ!',   0xffee00],
      poison:   ['☠ どく!',   0x88ff44],
      confuse:  ['😵 こんらん!', 0xff88ff],
      bind:     ['🔒 そくばく!', 0x4488ff],
    };
    const [label, color] = labels[statusType] ?? [`${statusType}!`, 0xffffff];
    this.pop(sp.x, sp.y - 90, label, `#${color.toString(16).padStart(6,'0')}`, 22);
    const ring = this.add.circle(sp.x, sp.y, 44, color, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scaleX: 2, scaleY: 2, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
    this.refreshStatusIcons();
    this.time.delayedCall(1000, done);
  }

  private aStatusTick(player: 1|2, statusType: StatusEffectType, damage: number, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const colors: Record<string, number> = { burn: 0xff4400, poison: 0x88ff44, paralyze: 0xffee00, confuse: 0xff88ff };
    const col = `#${(colors[statusType] ?? 0xffffff).toString(16).padStart(6,'0')}`;
    if (statusType === 'paralyze') {
      this.pop(sp.x, sp.y - 70, 'まひ! 技が失敗!', '#ffee00', 18);
    } else if (statusType === 'confuse') {
      this.pop(sp.x, sp.y - 70, `こんらん! ${damage}ダメ`, '#ff88ff', 18);
      this.syncAllHpBars();
    } else if (damage > 0) {
      this.pop(sp.x, sp.y - 70, `-${damage}`, col, 20);
      this.syncAllHpBars();
    }
    this.time.delayedCall(900, done);
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
    this.time.delayedCall(1100, done);
  }

  private aFaint(player: 1|2, done: () => void): void {
    const sp = player === 1 ? this.playerSprite : this.enemySprite;
    const mon = player === 1 ? this.engine.p1Active : this.engine.p2Active;
    this.setLog(`${mon.monsterDef.name} は たおれた!`);
    this.syncAllHpBars();
    this.tweens.add({
      targets: sp, alpha: 0, y: sp.y + 80, duration: 800, ease: 'Cubic.easeIn',
      onComplete: () => this.time.delayedCall(450, done),
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
        this.time.delayedCall(300, () => this.startBonusTurn());
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
          this.startBonusTurn();
        }
      },
      () => {/* forced — no cancel */},
    );
  }

  // Both sides attack after forced switch (new spec)
  private startBonusTurn(): void {
    this.phase = 'forcedAttack';
    this.bonusP1Action = undefined;
    this.bonusP2Action = undefined;

    if (this.mode === 'quest') {
      this.bonusP2Action = this.ai.decide(this.engine, 2);
      if ((this.bonusP2Action as BattleAction).type !== 'move') this.bonusP2Action = { type: 'none' };
    }

    const mon = this.myActive;
    this.buildMoveBtns(mon);
    this.setLog(`${mon.monsterDef.name} 登場! 技を選べ!`);
    this.p1StatusText.setText('');
    this.refreshMoveBtns();
    this.swEnabled = false; this.swDim.setVisible(true);

    this.moveBtns.forEach((btn, i) => {
      btn.container.removeAllListeners('pointerdown');
      btn.container.on('pointerdown', () => {
        if (!btn.enabled || this.phase !== 'forcedAttack') return;
        const moveId = mon.monsterDef.moveIds[i];
        if (!moveId || !this.engine.isMoveReady(mon, moveId)) return;
        if (this.localPlayer === 1) {
          this.bonusP1Action = { type: 'move', moveId };
        } else {
          this.bonusP2Action = { type: 'move', moveId };
        }
        this.disableAllBtns();
        this.execBonusTurn();
      });
    });

    this.timerEvent?.remove();
    this.timerVal = 20;
    this.timerText.setText('20').setStyle({ color: '#ffe066' });
    this.timerBar.setFillStyle(0xffe066); this.timerBar.width = GAME_WIDTH * (20 / 60);
    this.timerEvent = this.time.addEvent({
      delay: 1000, repeat: 19,
      callback: () => {
        this.timerVal--;
        this.timerText.setText(`${this.timerVal}`);
        this.timerBar.width = GAME_WIDTH * (this.timerVal / 60);
        if (this.timerVal <= 0 && this.phase === 'forcedAttack') {
          this.timerEvent?.remove();
          this.disableAllBtns();
          if (this.localPlayer === 1) this.bonusP1Action = { type: 'none' };
          else this.bonusP2Action = { type: 'none' };
          this.execBonusTurn();
        }
      },
    });
  }

  private execBonusTurn(): void {
    const p1A = this.bonusP1Action ?? { type: 'none' };
    const p2A = this.bonusP2Action ?? { type: 'none' };
    this.phase = 'animating';
    this.eventQueue = this.engine.resolveBonusTurn(
      this.localPlayer === 1 ? p1A : p2A,
      this.localPlayer === 1 ? p2A : p1A,
    );
    this.processingEvent = false;
    this.nextEvent();
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

    const isWin = this.mode === 'network' ? winner === this.localPlayer : winner === 1;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(2000);
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 28,
      isWin ? 'YOU WIN!' : 'YOU LOSE…', {
      fontFamily: 'system-ui, sans-serif', fontSize: '72px',
      color: isWin ? '#9be7ff' : '#ff4d6d',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2001).setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 380, ease: 'Back.easeOut' });

    if (isWin && this.mode === 'quest') {
      this.time.delayedCall(800, () => this.showCatchReward());
    } else {
      const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 62, 'タップでタイトルへ', {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(2001);
      this.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
      this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.scene.start('Title')));
    }
  }

  private showCatchReward(): void {
    const cpuTeam = this.engine.p2Team;
    const D = 2100;
    const panelW = Math.min(GAME_WIDTH - 60, cpuTeam.length * 195 + 40);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setDepth(D);
    overlay.setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);
    panel.add(this.add.rectangle(0, 0, panelW, 230, 0x1a1530).setStrokeStyle(2, 0xffe066));
    panel.add(this.add.text(0, -95, '🎉 仲間にするモンスターを選ぼう!', {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5));

    const startOff = -((cpuTeam.length - 1) * 190) / 2;
    cpuTeam.forEach((mon, ti) => {
      const bx = startOff + ti * 190;
      const bg = this.add.rectangle(bx, 20, 175, 115, 0x2a2350).setStrokeStyle(2, 0x5a4cd0);
      panel.add(bg);
      panel.add(this.add.text(bx, -30, mon.monsterDef.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
      if (this.textures.exists(mon.monsterDef.frontSprite)) {
        const img = this.add.image(bx, 25, mon.monsterDef.frontSprite);
        img.setScale(Math.min(70 / img.width, 70 / img.height));
        panel.add(img);
      }
      panel.add(this.add.text(bx, 72, `HP:${mon.maxHp} ATK:${mon.atkStat} DEF:${mon.defStat}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#aaaaaa',
      }).setOrigin(0.5));
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x3a3560));
      bg.on('pointerout', () => bg.setFillStyle(0x2a2350));
      bg.on('pointerdown', () => {
        overlay.destroy(); panel.destroy();
        const save = loadSave();
        const newIvs = randomIVs();
        addOwnedMonster(save, mon.monsterDef.id, newIvs);
        persistSave(save);
        this.showCatchConfirm(mon.monsterDef.name);
      });
    });
  }

  private showCatchConfirm(name: string): void {
    const D = 2200;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(D);
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, `${name} を仲間にした!`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#9be7ff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(D + 1).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 340, ease: 'Back.easeOut' });
    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 'タップでタイトルへ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(D + 1);
    this.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    this.time.delayedCall(500, () => this.input.once('pointerdown', () => this.scene.start('Title')));
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

  // ── Status icon bar ───────────────────────────────────────────────────

  private buildStatusIcons(): void {
    const makeSet = (
      baseX: number, baseY: number,
      list: Phaser.GameObjects.Text[], typeList: string[],
    ) => {
      for (let i = 0; i < 5; i++) {
        typeList.push('');
        const ic = this.add.text(baseX + i * 30, baseY, '', {
          fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
        }).setDepth(62).setInteractive({ useHandCursor: true });

        let holdTimer: Phaser.Time.TimerEvent | undefined;
        let tip: Phaser.GameObjects.Container | undefined;
        const hideTip = () => { tip?.destroy(); tip = undefined; };
        ic.on('pointerdown', () => {
          holdTimer = this.time.delayedCall(350, () => {
            const st = typeList[i];
            if (!st) return;
            const desc = STATUS_DESCS[st] ?? st;
            hideTip();
            tip = this.showStatusTip(ic.x, baseY < 100 ? ic.y + 60 : ic.y - 80, desc);
          });
        });
        ic.on('pointerup', () => { holdTimer?.remove(); holdTimer = undefined; hideTip(); });
        ic.on('pointerout', () => { holdTimer?.remove(); holdTimer = undefined; hideTip(); });
        list.push(ic);
      }
    };
    makeSet(PLAYER_HP_X, PLAYER_HP_Y + 28, this.p1StatusIcons, this.p1StatusTypes);
    makeSet(ENEMY_HP_X, ENEMY_HP_Y + 28, this.p2StatusIcons, this.p2StatusTypes);
  }

  private showStatusTip(iconX: number, iconY: number, desc: string): Phaser.GameObjects.Container {
    const cX = Phaser.Math.Clamp(iconX, 150, GAME_WIDTH - 150);
    const cY = Phaser.Math.Clamp(iconY, 50, PANEL_Y - 50);
    const c = this.add.container(cX, cY).setDepth(500);
    const lines = desc.split('\n');
    const bg = this.add.rectangle(0, 0, 220, 22 + lines.length * 20, 0x0d0b1a, 0.92)
      .setStrokeStyle(1, 0x9be7ff);
    const txt = this.add.text(0, 0, desc, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    c.add([bg, txt]);
    return c;
  }

  private refreshStatusIcons(): void {
    const icons: Record<string, string> = {
      burn: '🔥', paralyze: '⚡', poison: '☠', confuse: '😵', bind: '🔒',
      critBoost: '✨', atkDebuffOnOpponent: '⬇', counterReady: '🛡', counterFailed: '🔗',
    };
    const fillIcons = (
      team: BattleMonster[], list: Phaser.GameObjects.Text[], typeList: string[],
    ) => {
      const active = team
        .flatMap(m => m.statusEffects.filter((se: StatusEffect) => se.delay === 0 && se.turnsLeft !== 0));
      list.forEach((t, i) => {
        const se = active[i];
        t.setText(se ? (icons[se.type] ?? '') : '');
        typeList[i] = se?.type ?? '';
      });
    };
    fillIcons([this.engine.p1Active], this.p1StatusIcons, this.p1StatusTypes);
    fillIcons([this.engine.p2Active], this.p2StatusIcons, this.p2StatusTypes);
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
