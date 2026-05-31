import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main';
import { MONSTERS } from '../data/monsters';
import { loadSave, persistSave, addOwnedMonster, randomIVs } from '../storage/SaveData';
import type { GameSave } from '../storage/SaveData';

interface ShopItem {
  defId: string;
  price: number;
}

const ITEMS: ShopItem[] = [
  { defId: 'lilyenma', price: 10000 },
];

export class ShopScene extends Phaser.Scene {
  private save!: GameSave;
  private nikukyuText!: Phaser.GameObjects.Text;

  constructor() { super('Shop'); }

  create(): void {
    this.save = loadSave();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0e1a);
    this.buildHeader();
    this.buildItems();
    this.buildFooter();
  }

  private buildHeader(): void {
    this.add.rectangle(GAME_WIDTH / 2, 30, GAME_WIDTH, 60, 0x14102a).setStrokeStyle(1, 0x2a2040);
    this.add.text(22, 30, '🛒 ショップ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffe0aa', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    if (this.textures.exists('nikukyu')) {
      this.add.image(GAME_WIDTH - 188, 30, 'nikukyu').setDisplaySize(28, 28);
    }
    this.nikukyuText = this.add.text(GAME_WIDTH - 170, 30, `×${this.save.nikukyu ?? 0}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffbb88',
    }).setOrigin(0, 0.5);
  }

  private buildItems(): void {
    const cardW = 320;
    const startX = GAME_WIDTH / 2 - ((ITEMS.length - 1) * (cardW + 24)) / 2;
    ITEMS.forEach((item, i) => {
      this.buildItemCard(startX + i * (cardW + 24), GAME_HEIGHT / 2 - 10, item);
    });
  }

  private buildItemCard(cx: number, cy: number, item: ShopItem): void {
    const def = MONSTERS[item.defId];
    if (!def) return;
    const W = 320;
    const H = 380;

    this.add.rectangle(cx, cy, W, H, 0x1a1530).setStrokeStyle(2, 0x7755cc);

    // Sprite
    if (this.textures.exists(def.frontSprite)) {
      const img = this.add.image(cx, cy - 80, def.frontSprite);
      img.setScale(Math.min(140 / img.width, 140 / img.height));
    }

    // Name
    this.add.text(cx, cy + 30, def.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#e8e0ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Stats
    const { hp, atk, def: defStat } = def.baseStats;
    this.add.text(cx, cy + 62, `HP ${hp}  ATK ${atk}  DEF ${defStat}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#8888aa',
    }).setOrigin(0.5);

    // Price
    if (this.textures.exists('nikukyu')) {
      this.add.image(cx - 60, cy + 100, 'nikukyu').setDisplaySize(26, 26);
    }
    this.add.text(cx - 34, cy + 100, `×${item.price.toLocaleString()}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffcc66', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Buy button
    const canAfford = (this.save.nikukyu ?? 0) >= item.price;
    const btnBg = this.add.rectangle(cx, cy + 150, 200, 48, canAfford ? 0x224422 : 0x222222)
      .setStrokeStyle(2, canAfford ? 0x44cc66 : 0x444444)
      .setInteractive({ useHandCursor: canAfford });
    const btnLabel = this.add.text(cx, cy + 150, '購入', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px',
      color: canAfford ? '#88ffaa' : '#555555', fontStyle: 'bold',
    }).setOrigin(0.5);

    if (canAfford) {
      btnBg.on('pointerover', () => btnBg.setFillStyle(0x336633));
      btnBg.on('pointerout',  () => btnBg.setFillStyle(0x224422));
      btnBg.on('pointerdown', () => this.confirmPurchase(item, def.name, btnBg, btnLabel));
    }
  }

  private confirmPurchase(item: ShopItem, name: string, btnBg: Phaser.GameObjects.Rectangle, _btnLabel: Phaser.GameObjects.Text): void {
    const D = 500;
    const PW = 420;
    const PH = 180;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(D).setInteractive();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(D + 1);

    panel.add(this.add.rectangle(0, 0, PW, PH, 0x14102a).setStrokeStyle(2, 0xffe066));
    panel.add(this.add.text(0, -PH / 2 + 30, `${name} を購入しますか？`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5));
    if (this.textures.exists('nikukyu')) {
      panel.add(this.add.image(-50, 4, 'nikukyu').setDisplaySize(24, 24));
    }
    panel.add(this.add.text(-24, 4, `×${item.price.toLocaleString()} 消費`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffcc66',
    }).setOrigin(0, 0.5));

    const yesBg = this.add.rectangle(-80, PH / 2 - 30, 150, 40, 0x224422)
      .setStrokeStyle(1, 0x44cc66).setInteractive({ useHandCursor: true });
    yesBg.on('pointerdown', () => {
      overlay.destroy(); panel.destroy();
      this.executePurchase(item, name, btnBg);
    });
    panel.add([yesBg, this.add.text(-80, PH / 2 - 30, 'はい', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#88ffaa',
    }).setOrigin(0.5)]);

    const noBg = this.add.rectangle(80, PH / 2 - 30, 150, 40, 0x2a1414)
      .setStrokeStyle(1, 0xaa4444).setInteractive({ useHandCursor: true });
    noBg.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add([noBg, this.add.text(80, PH / 2 - 30, 'やめる', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ff8888',
    }).setOrigin(0.5)]);

    overlay.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
  }

  private executePurchase(item: ShopItem, name: string, btnBg: Phaser.GameObjects.Rectangle): void {
    this.save.nikukyu = (this.save.nikukyu ?? 0) - item.price;
    addOwnedMonster(this.save, item.defId, randomIVs());
    persistSave(this.save);

    // Update balance display
    this.nikukyuText.setText(`×${this.save.nikukyu}`);

    // Refresh buy button affordability
    const canStillAfford = this.save.nikukyu >= item.price;
    btnBg.setFillStyle(canStillAfford ? 0x224422 : 0x222222)
         .setStrokeStyle(2, canStillAfford ? 0x44cc66 : 0x444444);
    if (!canStillAfford) btnBg.removeInteractive();

    // Success toast
    const D = 400;
    const toast = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60).setDepth(D);
    toast.add(this.add.rectangle(0, 0, 380, 50, 0x1a2a1a, 0.95).setStrokeStyle(1, 0x44cc66));
    toast.add(this.add.text(0, 0, `${name} を仲間にした！`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#88ffaa', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.tweens.add({ targets: toast, y: GAME_HEIGHT / 2 - 80, duration: 200 });
    this.tweens.add({ targets: toast, alpha: 0, duration: 500, delay: 1200, onComplete: () => toast.destroy() });
  }

  private buildFooter(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 18, GAME_WIDTH, 36, 0x0c0b1c)
      .setStrokeStyle(1, 0x1a1830);
    const btn = this.add.text(GAME_WIDTH - 22, GAME_HEIGHT - 18, '← もどる', {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#888899',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#888899'));
    btn.on('pointerdown', () => this.scene.start('Title'));
  }
}
