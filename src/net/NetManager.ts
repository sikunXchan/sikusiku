import Peer, { type DataConnection } from 'peerjs';
import type { NetworkMsg } from './messages';

let _peer: Peer | undefined;
let _conn: DataConnection | undefined;
let _isHost = false;

function setupConn(conn: DataConnection): void {
  _conn = conn;
  conn.on('data', (data) => { NetManager.onMessage?.(data as NetworkMsg); });
  conn.on('close', () => { NetManager.onDisconnect?.(); });
  conn.on('error', () => { NetManager.onDisconnect?.(); });
}

export const NetManager = {
  get isHost(): boolean { return _isHost; },
  get connected(): boolean { return !!_conn && _conn.open; },

  onConnect: undefined as (() => void) | undefined,
  onMessage: undefined as ((msg: NetworkMsg) => void) | undefined,
  onDisconnect: undefined as (() => void) | undefined,

  createRoom(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      _isHost = true;
      _peer = new Peer(code, { debug: 0 });
      _peer.on('open', () => resolve());
      _peer.on('connection', (conn) => {
        setupConn(conn);
        conn.on('open', () => { NetManager.onConnect?.(); });
      });
      _peer.on('error', (err) => reject(err));
    });
  },

  joinRoom(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      _isHost = false;
      _peer = new Peer({ debug: 0 });
      _peer.on('open', () => {
        const conn = _peer!.connect(code, { reliable: true });
        setupConn(conn);
        conn.on('open', () => { resolve(); NetManager.onConnect?.(); });
        conn.on('error', (err: unknown) => reject(err));
      });
      _peer.on('error', (err) => reject(err));
    });
  },

  send(msg: NetworkMsg): void {
    _conn?.send(msg);
  },

  destroy(): void {
    _conn?.close();
    _peer?.destroy();
    _conn = undefined;
    _peer = undefined;
    _isHost = false;
    NetManager.onConnect = undefined;
    NetManager.onMessage = undefined;
    NetManager.onDisconnect = undefined;
  },
};
