import Phaser from 'phaser';
import type { Skill } from '../data/types';
import { Fighter } from '../combat/Fighter';

// 画面下部の技ボタン。クリック/タップで発動。クールタイムを暗転オーバーレイで表示。

interface SkillButton {
  skill: Skill;
  container: Phaser.GameObjects.Container;
  cover: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
  size: number;
}

export class SkillBar {
  private buttons: SkillButton[] = [];

  constructor(
    scene: Phaser.Scene,
    private player: Fighter,
    skills: Skill[],
    keys: string[],
    private onActivate: (skill: Skill) => void
  ) {
    // 格ゲー風に画面右下へ寄せる（右端から左へ並べる）。
    const size = 82;
    const gap = 12;
    const total = skills.length * size + (skills.length - 1) * gap;
    const rightMargin = 28;
    const startX = scene.scale.width - rightMargin - total + size / 2;
    const y = scene.scale.height - 60;

    skills.forEach((skill, i) => {
      const x = startX + i * (size + gap);
      const container = scene.add.container(x, y);

      const bg = scene.add.rectangle(0, 0, size, size, skill.color, 0.85).setStrokeStyle(3, 0xffffff, 0.9);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.onActivate(skill));

      const labelText = skill.short ?? skill.name;
      // 文字数に応じてフォントを縮小し、ボタン内に収める
      const fontPx = Phaser.Math.Clamp(Math.floor((size - 14) / labelText.length), 11, 16);
      const label = scene.add.text(0, -6, labelText, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${fontPx}px`,
        color: '#1a1a1a',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);

      const keyLabel = scene.add.text(0, size / 2 - 14, `[${keys[i] ?? ''}]`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#1a1a1a',
      }).setOrigin(0.5);

      const cover = scene.add.rectangle(0, 0, size, size, 0x000000, 0.6).setOrigin(0.5);
      cover.setVisible(false);
      const cdText = scene.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      container.add([bg, label, keyLabel, cover, cdText]);
      container.setDepth(900);
      this.buttons.push({ skill, container, cover, cdText, size });
    });
  }

  update(now: number): void {
    for (const b of this.buttons) {
      const remain = this.player.cooldownRemaining(b.skill.id, now);
      if (remain > 0) {
        b.cover.setVisible(true);
        b.cdText.setText((remain / 1000).toFixed(1));
        // クールタイムの割合で高さを変える（下から回復するイメージ）
        const ratio = Phaser.Math.Clamp(remain / b.skill.cooldown, 0, 1);
        b.cover.height = b.size * ratio;
        b.cover.y = b.size / 2 - (b.size * ratio) / 2;
      } else {
        b.cover.setVisible(false);
        b.cdText.setText('');
      }
    }
  }
}
