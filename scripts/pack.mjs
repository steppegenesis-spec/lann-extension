import { deflateRawSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Files Chrome actually loads. Keep this an allowlist so docs/.git never ship. */
const FILES = [
  'manifest.json',
  'background.js',
  'config.js',
  'steamClient.js',
  'steamSession.js',
  'snapshot.js',
  'inventoryItems.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
]

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[i] = c >>> 0
}

function crc32 (buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function u16 (value) {
  const buf = Buffer.alloc(2)
  buf.writeUInt16LE(value)
  return buf
}

function u32 (value) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value)
  return buf
}

function zipFiles (entries) {
  const locals = []
  const centrals = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const compressed = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      compressed,
    ])

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ])

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const centralDir = Buffer.concat(centrals)
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])

  return Buffer.concat([...locals, centralDir, end])
}

const iconPngs = FILES.filter((file) => file.startsWith('icons/icon') && file.endsWith('.png'))
if (iconPngs.some((file) => !existsSync(join(root, file)))) {
  await import(pathToFileURL(join(root, 'scripts', 'make-icons.mjs')).href)
}

const missing = FILES.filter((file) => !existsSync(join(root, file)))
if (missing.length) {
  throw new Error(`Missing files: ${missing.join(', ')}`)
}

const entries = FILES.map((name) => ({
  name,
  data: readFileSync(join(root, name)),
}))

const distDir = join(root, 'dist')
mkdirSync(distDir, { recursive: true })
const outPath = join(distDir, `lann-extension-${pkg.version}.zip`)
writeFileSync(outPath, zipFiles(entries))

console.log(`Wrote ${outPath} (${entries.length} files)`)
