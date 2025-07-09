import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: '/face-parts-manipulator/', // サーバー上のパス設定に合わせる
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true
  }
}))
