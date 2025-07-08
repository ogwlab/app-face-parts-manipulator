import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/', // Vercel用に修正（GitHub Pages設定を削除）
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // 本番用にsourcemap無効化
    rollupOptions: {
      output: {
        manualChunks: {
          // face-api.jsを別チャンクに分離してパフォーマンス向上
          'face-api': ['face-api.js'],
          // MUIを別チャンクに分離
          'mui': ['@mui/material', '@mui/icons-material'],
          // React系を別チャンクに分離
          'react-vendor': ['react', 'react-dom']
        }
      }
    },
    // アセット最適化
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000
  },
  // 静的ファイル配信設定
  publicDir: 'public',
  // 開発用の設定
  define: {
    __DEV__: mode === 'development'
  }
}))
