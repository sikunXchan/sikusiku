import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from '../main';
import { getCharacter } from '../data/characters';
import { getSkill } from '../data/skills';
import { Fighter } from '../combat/Fighter';
import { SkillResolver } from '../combat/SkillResolver';
import { Effects } from '../fx/Effects';
import { SimpleAI } from '../ai/SimpleAI';
import { HealthBar } from '../ui/HealthBar';
import { SkillBar } from '../ui/SkillBar';
import { TouchControls } from '../ui/TouchControls';
import type { Skill } from '../data/types';

// メインのバトル画面。しくん(プレイヤー) vs ちゃくん(AI) のリアルタイム1対1。

const CHARGE_PER_STAGE_MS = 360;

export class BattleScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter;
  private resolver!: SkillResolver;
  private fx!: Effects;
  private ai!: SimpleAI;

  private playerHpBar!: HealthBar;
  private enemyHpBar!: HealthBar;
  private skillBar!: SkillBar;
  private touch!: TouchControls;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;

  private playerSkills: Skill[] = [];
  private chargingShikken = false;
  private chargeStart = 0;
  private chargeAura?: Phaser.GameObjects.Particles.ParticleEmitter;

  private over = false;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.over = false;
    this.chargingShikken = false;
    this.buildBackground();

    // 地面（静的ボディ）
    const ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 20, GAME_WIDTH, 40, 0x2a2350);
    this.physics.add.existing(ground, true);

    // キャラ生成
    this.player = new Fighter(this, getCharacter('sikun'), 280, 1);
    this.enemy = new Fighter(this, getCharacter('chakun'), GAME_WIDTH - 280, -1);
    this.physics.add.collider(this.player.sprite, ground);
    this.physics.add.collider(this.enemy.sprite, ground);

    // 戦闘システム
    this.fx = new Effects(this);
    this.resolver = new SkillResolver(this, this.fx);
    this.ai = new SimpleAI(this.enemy, this.player, this.resolver);

    // UI
    this.playerHpBar = new HealthBar(this, 24, 60, this.player.def.name, 0x66ccff, false);
    this.enemyHpBar = new HealthBar(this, GAME_WIDTH - 24, 60, this.enemy.def.name, 0xffa552, true);
    this.add.text(GAME_WIDTH / 2, 28, 'VS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.playerSkills = this.player.def.skills.map(getSkill);
    this.skillBar = new SkillBar(
      this,
      this.player,
      this.playerSkills,
      ['J', 'K', 'L'],
      (skill) => this.activateSkill(skill)
    );

    // モバイル用タッチ操作（移動パッド + ジャンプ）
    this.touch = new TouchControls(this, () => this.player.jump());

    // 入力
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey('A');
    this.keyD = kb.addKey('D');
    this.keyJ = kb.addKey('J');
    this.keyK = kb.addKey('K');
    this.keyL = kb.addKey('L');

    // しっけんは長押しチャージ
    this.keyJ.on('down', () => this.startCharge());
    this.keyJ.on('up', () => this.releaseCharge());
    this.keyK.on('down', () => this.activateSkill(this.playerSkills[1]));
    this.keyL.on('down', () => this.activateSkill(this.playerSkills[2]));
    this.cursors.space.on('down', () => this.player.jump());

    this.showStartBanner();
  }

  update(_time: number, _delta: number): void {
    const now = this.time.now;
    this.playerHpBar.update();
    this.enemyHpBar.update();
    this.skillBar.update(now);

    if (this.over) return;

    this.handlePlayerMovement();
    this.ai.update(now);

    // 向きを相手に合わせる（移動中以外）
    this.playerHpBar.setRatio(this.player.hpRatio);
    this.enemyHpBar.setRatio(this.enemy.hpRatio);

    // チャージ中のオートリリース（最大段階で発射）
    if (this.chargingShikken) {
      const held = now - this.chargeStart;
      const stages = (this.playerSkills[0].stages ?? 1);
      if (held >= stages * CHARGE_PER_STAGE_MS) this.releaseCharge();
    }

    if (this.player.isDead || this.enemy.isDead) this.endBattle();
  }

  private handlePlayerMovement(): void {
    if (this.player.busy || this.chargingShikken) {
      this.player.stop();
      return;
    }
    const kbLeft = this.cursors.left.isDown || this.keyA.isDown;
    const kbRight = this.cursors.right.isDown || this.keyD.isDown;
    const kbAxis = (kbLeft ? -1 : 0) + (kbRight ? 1 : 0);
    // ジョイスティック優先、無入力ならキーボード
    const axis = this.touch.axisX !== 0 ? this.touch.axisX : kbAxis;
    const spd = this.player.def.stats.spd;
    if (axis !== 0) this.player.moveX(axis * spd);
    else this.player.stop();

    if (this.cursors.up.isDown) this.player.jump();
  }

  private startCharge(): void {
    const skill = this.playerSkills[0];
    if (this.over || this.player.busy || this.chargingShikken) return;
    if (!this.player.isReady(skill.id, this.time.now)) return;
    this.chargingShikken = true;
    this.chargeStart = this.time.now;
    this.player.faceTo(this.player.x <= this.enemy.x ? 1 : -1);
    this.player.stop();
    this.chargeAura = this.fx.chargeAura(this.player.sprite, skill.color);
  }

  private releaseCharge(): void {
    if (!this.chargingShikken) return;
    this.chargingShikken = false;
    this.chargeAura?.destroy();
    this.chargeAura = undefined;
    const skill = this.playerSkills[0];
    const held = this.time.now - this.chargeStart;
    const level = Phaser.Math.Clamp(1 + Math.floor(held / CHARGE_PER_STAGE_MS), 1, skill.stages ?? 1);
    this.resolver.use(this.player, this.enemy, skill, this.time.now, level);
  }

  private activateSkill(skill: Skill): void {
    if (this.over) return;
    // しっけん（チャージショット）はボタン押下時は最大段階で即発射
    if (skill.category === 'chargeShot') {
      if (this.player.isReady(skill.id, this.time.now)) {
        this.resolver.use(this.player, this.enemy, skill, this.time.now, skill.stages ?? 1);
      }
      return;
    }
    this.resolver.use(this.player, this.enemy, skill, this.time.now);
  }

  private endBattle(): void {
    if (this.over) return;
    this.over = true;
    const win = this.enemy.isDead;
    const text = win ? 'YOU WIN!' : 'YOU LOSE…';
    const color = win ? '#9be7ff' : '#ff4d6d';

    this.fx.shake(0.02, 400);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
    overlay.setDepth(2000);
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '64px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2001);
    banner.setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 400, ease: 'Back.easeOut' });

    const restart = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 'クリック / スペースキーでリスタート', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(2001);
    this.tweens.add({ targets: restart, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => this.scene.restart());
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.restart());
  }

  private showStartBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'バトル開始!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '54px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(2001);
    banner.setScale(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          y: banner.y - 40,
          delay: 500,
          duration: 400,
          onComplete: () => banner.destroy(),
        });
      },
    });

    const hint = this.add.text(GAME_WIDTH / 2, 116,
      '左下で移動・ジャンプ / 右下の技ボタンで攻撃',
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#cfc8ff',
      }).setOrigin(0.5).setDepth(900);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 800, onComplete: () => hint.destroy() });
  }

  private buildBackground(): void {
    // グラデ風の背景
    const top = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1530);
    top.setDepth(-10);
    // 遠景の光の粒
    for (let i = 0; i < 40; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GROUND_Y),
        Phaser.Math.FloatBetween(0.5, 1.8),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.7)
      );
      star.setDepth(-9);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(1200, 2600),
        yoyo: true,
        repeat: -1,
      });
    }
    // 床のライン
    const floor = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y, GAME_WIDTH, 4, 0x6a5acd, 0.8);
    floor.setDepth(-8);
  }
}
