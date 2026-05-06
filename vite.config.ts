import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/face-parts-manipulator/', // サーバー上のパス設定に合わせる
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
