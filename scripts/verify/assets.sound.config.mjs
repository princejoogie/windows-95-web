// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  publicDir: false,
  build: {
    outDir: resolve('out/renderer/system-sound'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve('src/renderer/src/system/sound.ts'),
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: 'sound.js' },
    },
  },
})
