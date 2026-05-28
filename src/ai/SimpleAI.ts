import Phaser from 'phaser';
import { Fighter } from '../combat/Fighter';
import { SkillResolver } from '../combat/SkillResolver';
import { getSkill } from '../data/skills';

// ちゃくん用の簡単なAI。接近 → 間合いで技 → ときどき回避。

export class SimpleAI {
  private nextDecision = 0;

  constructor(
    private self: Fighter,
    private opponent: Fighter,
    private resolver: SkillResolver
  ) {}

  update(now: number): void {
    if (this.self.isDead || this.opponent.isDead || this.self.busy) {
      this.self.stop();
      return;
    }

    const tackle = getSkill('chakken');
    const dodge = getSkill('chaSmash');
    const dist = this.self.distanceTo(this.opponent);

    // 間合いに入ったらタックル
    if (dist <= tackle.range && this.self.isReady('chakken', now)) {
      this.resolver.use(this.self, this.opponent, tackle, now);
      this.nextDecision = now + 600;
      return;
    }

    // 相手が至近距離なら一定確率で回避
    if (dist < 150 && this.self.isReady('chaSmash', now) && Math.random() < 0.02) {
      this.resolver.use(this.self, this.opponent, dodge, now);
      return;
    }

    // 接近 / 間合い調整
    if (now >= this.nextDecision) {
      this.nextDecision = now + Phaser.Math.Between(200, 500);
    }
    const dir = this.opponent.x > this.self.x ? 1 : -1;
    if (dist > tackle.range * 0.8) {
      this.self.moveX(dir * this.self.def.stats.spd);
    } else {
      this.self.stop();
      this.self.faceTo(dir);
    }
  }
}
