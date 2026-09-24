import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// @types/node を入れずに Actions の環境変数だけ読むための宣言
declare const process: { env: Record<string, string | undefined> }

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages（Actions でのビルド）と Xserver（手作業デプロイ）で配置パスが異なる
  base: process.env.GITHUB_ACTIONS ? '/app-face-parts-manipulator/' : '/face-parts-manipulator/',
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true
  }
}))
