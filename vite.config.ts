import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    license: { fileName: "third-party-licenses.md" },
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat']
        }
      }
    }
  }
})
