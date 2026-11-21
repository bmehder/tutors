// Preview by default. The launch decision must precede --enable --write and publication.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export function prepareIndexingFiles(enabled, source, config) {
  const noindex = { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }
  const headers = (config.headers ?? []).flatMap(rule => {
    const remaining = rule.headers.filter(header => header.key.toLowerCase() !== 'x-robots-tag')
    return remaining.length ? [{ ...rule, headers: remaining }] : []
  })
  headers.push({ source: enabled ? '/(admin|api|checkout|preview)(.*)' : '/(.*)', headers: [noindex] })
  if (!/export const searchIndexingEnabled = (true|false)/.test(source)) throw new Error('Indexing setting could not be located.')
  return {
    source: source.replace(/export const searchIndexingEnabled = (true|false)/, 'export const searchIndexingEnabled = ' + enabled),
    config: { ...config, headers },
    robots: 'User-agent: *\nAllow: /\n' + (enabled ? '\nSitemap: https://www.mychristiantutors.com/sitemap.xml\n' : ''),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.some(arg => !['--enable', '--disable', '--write'].includes(arg)) ||
      args.includes('--enable') === args.includes('--disable'))
    throw new Error('Use --enable or --disable; add --write only after approval to change indexing.')
  const enabled = args.includes('--enable')
  const root = new URL('../', import.meta.url)
  const sourcePath = new URL('src/lib/search-indexing.ts', root)
  const configPath = new URL('vercel.json', root)
  const robotsPath = new URL('public/robots.txt', root)
  const files = prepareIndexingFiles(enabled, await readFile(sourcePath, 'utf8'), JSON.parse(await readFile(configPath, 'utf8')))
  console.log(`${args.includes('--write') ? 'Applying' : 'Preview only:'} public indexing ${enabled ? 'enabled' : 'disabled'}; private routes stay noindex.`)
  console.log('Files: src/lib/search-indexing.ts, vercel.json, public/robots.txt')
  console.log(JSON.stringify(files.config.headers, null, 2))
  if (args.includes('--write')) {
    await writeFile(sourcePath, files.source)
    await writeFile(configPath, JSON.stringify(files.config, null, 2) + '\n')
    await writeFile(robotsPath, files.robots)
    console.log('Run the tests/build, review all three files, then publish together.')
  }
}
