import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'icons', 'lann-symbol.svg')

function rasterize (size) {
  const inner = Math.max(1, Math.round(size * 0.76))
  const outPath = join(root, 'icons', `icon${size}.png`)
  const result = spawnSync(
    'magick',
    [
      '-density', '384',
      '-background', 'none',
      svgPath,
      '-resize', `${inner}x${inner}`,
      '-gravity', 'center',
      '-extent', `${size}x${size}`,
      outPath,
    ],
    { stdio: 'inherit' },
  )

  if (result.error || result.status !== 0) {
    throw new Error(
      result.error?.message ??
        `ImageMagick failed for ${size}px (exit ${result.status}). ` +
          'Install ImageMagick and keep `magick` on PATH.',
    )
  }
}

for (const size of [16, 48, 128]) {
  rasterize(size)
}

console.log('Wrote icons/icon16.png, icon48.png, icon128.png from lann-symbol.svg')
