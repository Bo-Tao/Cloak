import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(
          fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
          'src/renderer/src',
        ),
      },
    },
    plugins: [react()],
  },
})
