import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: '/face-parts-manipulator/', // サブディレクトリ配置用
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true
  }
}))
