// モバイル向けの補助。
// 初回タップで全画面化＋横画面ロックを試みる（主に Android Chrome / インストール済みPWAで有効）。
// iOS Safari は画面ロックAPI非対応なので、index.html の縦持ちオーバーレイがフォールバックになる。

export function setupMobile(): void {
  const tryLock = async () => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      }
    } catch {
      /* ユーザー操作以外/未対応では失敗するが問題なし */
    }
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientation.lock?.('landscape');
    } catch {
      /* 未対応端末では無視 */
    }
  };

  // 最初の操作で1回だけ実行
  const once = () => {
    void tryLock();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);

  // iOS のダブルタップズーム抑止
  document.addEventListener(
    'gesturestart',
    (e) => e.preventDefault(),
    { passive: false }
  );
}
