import type { OwnedMonster, IVs } from '../data/types';

export interface GameSave {
  ownedMonsters: OwnedMonster[];
  winCount: number;
  nikukyu: number;
}

const SAVE_KEY = 'sikusiku_save_v2';
let _uid = 0;

export function generateUid(): string {
  return `m_${Date.now()}_${_uid++}`;
}

export function randomIVs(): IVs {
  return {
    hp: Math.floor(Math.random() * 101),
    atk: Math.floor(Math.random() * 101),
    def: Math.floor(Math.random() * 101),
  };
}

function defaultSave(): GameSave {
  return {
    ownedMonsters: [
      { uid: generateUid(), defId: 'shikun',  ivs: randomIVs() },
      { uid: generateUid(), defId: 'lily',    ivs: randomIVs() },
      { uid: generateUid(), defId: 'chakun',  ivs: randomIVs() },
      { uid: generateUid(), defId: 'roncha',  ivs: randomIVs() },
    ],
    winCount: 0,
    nikukyu: 0,
  };
}

export function loadSave(): GameSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const save = JSON.parse(raw) as GameSave;
      if (save.winCount === undefined) save.winCount = 0;
      if (save.nikukyu === undefined) save.nikukyu = 0;
      return save;
    }
  } catch {
    // ignore
  }
  const save = defaultSave();
  persistSave(save);
  return save;
}

export function persistSave(save: GameSave): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function addOwnedMonster(save: GameSave, defId: string, ivs: IVs): OwnedMonster {
  const mon: OwnedMonster = { uid: generateUid(), defId, ivs };
  save.ownedMonsters.push(mon);
  persistSave(save);
  return mon;
}
