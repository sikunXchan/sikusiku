import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      workbox: {
        // Phaser のバンドルが大きいので上限を引き上げてプリキャッシュ
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // 実行時に未使用のアイコン元画像はプリキャッシュ対象外(低スペック端末の負荷軽減)
        globIgnores: ['**/app-icon-src.png', '**/524C4B73-81E4-4470-AF7E-45C79329D1BC.png'],
      },
      manifest: {
        name: 'しくん & ちゃくん バトル',
        short_name: 'クマバトル',
        description: 'ド派手な2Dリアルタイムアクションバトル',
        lang: 'ja',
        theme_color: '#5a4cd0',
        background_color: '#1a1530',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
