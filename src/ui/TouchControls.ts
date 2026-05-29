import Phaser from 'phaser';

// モバイル用の画面タッチ操作。左下に移動パッド(←→)とジャンプ。
// マルチタッチ対応：どの指(pointer)がどのボタンを押しているかを id で追跡する。

export class TouchControls {
  left = false;
  right = false;
  private heldBy = new Map<number, 'left' | 'right'>();

  constructor(scene: Phaser.Scene, onJump: () => void) {
    const H = scene.scale.height;
    const makeBtn = (
      x: number,
      y: number,
      r: number,
      label: string,
      color: number
    ): Phaser.GameObjects.Container => {
      const c = scene.add.container(x, y).setDepth(900);
      const circle = scene.add.circle(0, 0, r, color, 0.35).setStrokeStyle(3, 0xffffff, 0.6);
      circle.setInteractive(
        new Phaser.Geom.Circle(0, 0, r),
        Phaser.Geom.Circle.Contains
      );
      const text = scene.add.text(0, 0, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.round(r * 0.9)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      c.add([circle, text]);
      c.setData('circle', circle);
      return c;
    };

    const leftBtn = makeBtn(78, H - 70, 44, '◀', 0x66ccff);
    const rightBtn = makeBtn(186, H - 70, 44, '▶', 0x66ccff);
    const jumpBtn = makeBtn(132, H - 168, 40, '⤴', 0x9be7ff);

    const press = (c: Phaser.GameObjects.Container) =>
      (c.getData('circle') as Phaser.GameObjects.Arc).setAlpha(0.7);
    const release = (c: Phaser.GameObjects.Container) =>
      (c.getData('circle') as Phaser.GameObjects.Arc).setAlpha(0.35);

    (leftBtn.getData('circle') as Phaser.GameObjects.Arc).on(
      'pointerdown',
      (p: Phaser.Input.Pointer) => {
        this.heldBy.set(p.id, 'left');
        press(leftBtn);
        this.recompute();
      }
    );
    (rightBtn.getData('circle') as Phaser.GameObjects.Arc).on(
      'pointerdown',
      (p: Phaser.Input.Pointer) => {
        this.heldBy.set(p.id, 'right');
        press(rightBtn);
        this.recompute();
      }
    );
    (jumpBtn.getData('circle') as Phaser.GameObjects.Arc).on('pointerdown', () => {
      press(jumpBtn);
      onJump();
      scene.time.delayedCall(120, () => release(jumpBtn));
    });

    const onUp = (p: Phaser.Input.Pointer) => {
      this.heldBy.delete(p.id);
      release(leftBtn);
      release(rightBtn);
      // どちらかがまだ押されていれば見た目を戻す
      for (const dir of this.heldBy.values()) {
        if (dir === 'left') press(leftBtn);
        if (dir === 'right') press(rightBtn);
      }
      this.recompute();
    };
    scene.input.on('pointerup', onUp);
    scene.input.on('pointerupoutside', onUp);
  }

  private recompute(): void {
    const dirs = [...this.heldBy.values()];
    this.left = dirs.includes('left');
    this.right = dirs.includes('right');
  }
}
