import type { OwnedMonster, IVs } from '../data/types';

export interface GameSave {
  ownedMonsters: OwnedMonster[];
}

const SAVE_KEY = 'sikusiku_save';
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
      { uid: generateUid(), defId: 'chakun',   ivs: randomIVs() },
      { uid: generateUid(), defId: 'shikun',   ivs: randomIVs() },
      { uid: generateUid(), defId: 'lily',     ivs: randomIVs() },
      { uid: generateUid(), defId: 'medama',     ivs: randomIVs() },
      { uid: generateUid(), defId: 'darkking',  ivs: randomIVs() },
      { uid: generateUid(), defId: 'roncha',    ivs: randomIVs() },
      { uid: generateUid(), defId: 'darkshikun',ivs: randomIVs() },
    ],
  };
}

function migrateSave(save: GameSave): GameSave {
  const additions: string[] = ['medama', 'darkking', 'roncha', 'darkshikun'];
  let changed = false;
  for (const defId of additions) {
    if (!save.ownedMonsters.some(m => m.defId === defId)) {
      save.ownedMonsters.push({ uid: generateUid(), defId, ivs: randomIVs() });
      changed = true;
    }
  }
  if (changed) persistSave(save);
  return save;
}

export function loadSave(): GameSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return migrateSave(JSON.parse(raw) as GameSave);
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
