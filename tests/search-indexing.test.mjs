import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareIndexingFiles } from '../scripts/search-indexing.mjs'
import { robotsDirective, searchIndexingEnabled } from '../src/lib/search-indexing.ts'

test('launch preparation changes public meta, headers and sitemap advertisement together; private pages remain excluded', () => {
  const source = 'export const searchIndexingEnabled = false\n'
  const config = { headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }, { key: 'Example', value: 'preserved' }] }] }
  const launched = prepareIndexingFiles(true, source, config)
  assert.match(launched.source, /Enabled = true/)
  assert.match(launched.robots, /Sitemap: https:\/\/www.mychristiantutors.com\/sitemap.xml/)
  assert.equal(launched.config.headers[0].headers[0].key, 'Example')
  const privateRule = launched.config.headers.at(-1)
  const matcher = new RegExp('^' + privateRule.source + '$')
  for (const path of ['/admin', '/api/reservations', '/checkout/stripe', '/preview/order-emails']) assert.ok(matcher.test(path))
  for (const path of ['/', '/tutors', '/subjects/biology', '/privacy']) assert.ok(!matcher.test(path))
  const closed = prepareIndexingFiles(false, launched.source, launched.config)
  assert.match(closed.source, /Enabled = false/)
  assert.doesNotMatch(closed.robots, /Sitemap:/)
  assert.equal(closed.config.headers.at(-1).source, '/(.*)')
  assert.deepEqual(prepareIndexingFiles(false, closed.source, closed.config), closed)
})

test('private page directives stay noindex independently of the public setting', () => {
  assert.equal(robotsDirective(), searchIndexingEnabled ? 'index, follow' : 'noindex, nofollow, noarchive')
  assert.equal(robotsDirective(false), 'noindex, nofollow, noarchive')
})
