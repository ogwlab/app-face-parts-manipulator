import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: '/', // ローカル開発専用（GitHub Pages設定を削除）
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true
  }
}))
