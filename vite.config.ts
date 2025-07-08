import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()], // Reactプラグインを復元
  base: mode === 'production' ? '/app-face-parts-manipulator/' : '/',
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true // 自動でブラウザを開く
  }
}))
