import Phaser from 'phaser';

// ダメージ数値のポップアップ。クリティカルは大きく赤く弾む。

export function showDamage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  isCritical: boolean
): void {
  const text = scene.add.text(x, y, isCritical ? `${amount}!` : `${amount}`, {
    fontFamily: 'system-ui, sans-serif',
    fontSize: isCritical ? '44px' : '28px',
    color: isCritical ? '#ff4d6d' : '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: isCritical ? 6 : 4,
  });
  text.setOrigin(0.5, 0.5);
  text.setDepth(1000);

  const dx = Phaser.Math.Between(-30, 30);
  scene.tweens.add({
    targets: text,
    y: y - (isCritical ? 90 : 60),
    x: x + dx,
    alpha: 0,
    scale: isCritical ? { from: 1.6, to: 1.0 } : { from: 1.2, to: 1.0 },
    duration: isCritical ? 900 : 650,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });

  if (isCritical) {
    const crit = scene.add.text(x, y - 36, 'CRITICAL!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffe066',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1000);
    scene.tweens.add({
      targets: crit,
      y: y - 120,
      alpha: 0,
      duration: 900,
      onComplete: () => crit.destroy(),
    });
  }
}

/** 「MISS」「かわした!」等のラベル表示。 */
export function showLabel(scene: Phaser.Scene, x: number, y: number, label: string, color = '#9be7ff'): void {
  const text = scene.add.text(x, y, label, {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '22px',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(1000);
  scene.tweens.add({
    targets: text,
    y: y - 50,
    alpha: 0,
    duration: 700,
    onComplete: () => text.destroy(),
  });
}
