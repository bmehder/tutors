// Read-only check of the running site's public sitemap, pages and links.
import assert from 'node:assert/strict'
import { siteUrl } from '../src/lib/seo.ts'

const base = new URL(process.argv[2] || 'http://127.0.0.1:5200')
const sitemapResponse = await fetch(new URL('/sitemap.xml', base))
assert.equal(sitemapResponse.status, 200, 'Sitemap should be available')
const sitemap = await sitemapResponse.text()
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
assert.ok(locations.length > 1, 'Sitemap should contain public pages')
assert.equal(locations.length, new Set(locations).size, 'Sitemap should not repeat URLs')
const pages = new Map()
let next = 0
async function checkPages() {
  while (next < locations.length) {
    const location = locations[next++]
    const canonical = new URL(location)
    assert.equal(canonical.origin, siteUrl, 'Use the real canonical domain')
    assert.match(canonical.pathname, /^\/(?:tutors(?:\/[^/]+)?|subjects(?:\/[^/]+)?|booking-policy|privacy)?$/, 'Only public pages belong in the sitemap')
    const response = await fetch(new URL(canonical.pathname, base))
    const html = await response.text()
    assert.equal(response.status, 200, canonical.pathname)
    assert.match(html, /<title>[^<]+<\/title>/, canonical.pathname + ' title')
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, canonical.pathname + ' main heading')
    assert.ok(html.includes(`href="${location}"`), canonical.pathname + ' canonical')
    assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/, canonical.pathname + ' prelaunch indexing protection')
    const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    assert.ok(data.length, canonical.pathname + ' structured data')
    data.forEach(match => JSON.parse(match[1]))
    pages.set(canonical.pathname, html)
  }
}
await Promise.all(Array.from({ length: 4 }, checkPages))
const privatePages = new Map()
for (const [path, html] of pages) {
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/g)) {
    const href = match[1].replaceAll('&amp;', '&')
    if (!href.startsWith('/') && !href.startsWith('#')) continue
    const target = new URL(href, new URL(path, base))
    if (target.pathname === '/admin') {
      if (!privatePages.has('/admin')) {
        const response = await fetch(new URL('/admin', base))
        const privateHtml = await response.text()
        assert.equal(response.status, 200, 'Admin login link')
        assert.match(privateHtml, /name="robots" content="noindex/, 'Admin must remain excluded from indexing')
        privatePages.set('/admin', privateHtml)
      }
      continue
    }
    assert.ok(pages.has(target.pathname), `${path}: missing internal page ${href}`)
    if (target.hash) {
      const id = decodeURIComponent(target.hash.slice(1))
      assert.ok(pages.get(target.pathname).includes(`id="${id}"`), `${path}: missing anchor ${href}`)
    }
  }
}
for (const price of ['$300', '$550', '$1,000']) assert.ok(pages.get('/').includes(price), `${price} should be readable before JavaScript loads`)
for (const asset of ['/favicon.svg', '/images/my-christian-tutors-social.png', '/images/my-fun-science-logo.png'])
  assert.equal((await fetch(new URL(asset, base))).status, 200, asset)
for (const path of ['/subjects/unknown-subject', '/tutors/unknown-tutor'])
  assert.equal((await fetch(new URL(path, base))).status, 404, path)
console.log(`PASS — ${pages.size} public pages: metadata, headings, structured data, canonicals, indexing protection, internal links, anchors, package prices, key assets and 404s.`)
