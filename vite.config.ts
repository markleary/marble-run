import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'

export default defineConfig({
  base: './',
  plugins: [{
    name: 'offline-game',
    apply: 'build',
    async writeBundle({ dir }) {
      if (!dir) throw new Error('Offline builds require an output directory')
      const files = (await readdir(dir, { recursive: true }))
        .map(path => path.split(sep).join('/'))
        .filter(path =>
          /^(assets|audio|icons)\/.+\.[^/]+$/.test(path) ||
          ['index.html', 'manifest.webmanifest', 'marble.svg'].includes(path)
        )
        .sort()
      const template = await readFile(new URL('./tools/offline-worker.js', import.meta.url), 'utf8')
      const version = createHash('sha256').update(template)
      for (const path of files) {
        version.update(path).update(await readFile(join(dir, path)))
      }
      const worker = template.replace('__BUILD_VERSION__', version.digest('hex').slice(0, 16))
        .replace('__ASSET_PATHS__', JSON.stringify(files))
      await writeFile(join(dir, 'sw.js'), worker)
    }
  }],
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
