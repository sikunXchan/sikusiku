import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { TitleScene } from './scenes/TitleScene';
import { MonsterListScene } from './scenes/MonsterListScene';
import { TeamSelectScene } from './scenes/TeamSelectScene';
import { LobbyScene } from './scenes/LobbyScene';
import { setupMobile } from './mobile';

setupMobile();

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_Y = GAME_HEIGHT - 90;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1530',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3, // 移動 + 技 の同時タッチを許可
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1400 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, LobbyScene, MonsterListScene, TeamSelectScene, BattleScene],
};

new Phaser.Game(config);
