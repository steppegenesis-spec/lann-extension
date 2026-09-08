import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const manifestPath = join(root, 'manifest.json')

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/

function parseSemver (version) {
  if (!SEMVER_REGEX.test(version)) {
    throw new Error(`Invalid semantic version format: "${version}". Expected X.Y.Z`)
  }
  const [major, minor, patch] = version.split('.').map(Number)
  return { major, minor, patch }
}

function calculateNextVersion (currentVersion, bumpType = 'patch') {
  const normType = bumpType.toLowerCase().trim()
  const { major, minor, patch } = parseSemver(currentVersion)

  switch (normType) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
    default:
      if (SEMVER_REGEX.test(normType)) {
        return normType
      }
      throw new Error(
        `Unknown bump type or invalid version: "${bumpType}". Use "patch", "minor", "major", or explicit "X.Y.Z".`,
      )
  }
}

function run () {
  const arg = process.argv[2] || 'patch'

  const pkgRaw = readFileSync(pkgPath, 'utf8')
  const manifestRaw = readFileSync(manifestPath, 'utf8')

  const pkg = JSON.parse(pkgRaw)
  const manifest = JSON.parse(manifestRaw)

  const currentVersion = pkg.version || manifest.version || '0.1.0'

  if (pkg.version !== manifest.version) {
    console.warn(
      `[WARN] Version mismatch detected: package.json is ${pkg.version}, manifest.json is ${manifest.version}. Re-aligning to next version.`,
    )
  }

  const nextVersion = calculateNextVersion(currentVersion, arg)

  pkg.version = nextVersion
  manifest.version = nextVersion

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`Bumped version: v${currentVersion} -> v${nextVersion}`)
  console.log('Updated:')
  console.log('  - package.json')
  console.log('  - manifest.json')
}

run()
