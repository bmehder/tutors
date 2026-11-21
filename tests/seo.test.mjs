import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalUrl, sitemapXml, structuredDataJson } from '../src/lib/seo.ts'

test('admin-editable profile text cannot close the structured-data script', () => {
  const data = { name: '</script><script>alert("example")</script>', description: 'Math & science <support>' }
  const json = structuredDataJson(data)
  assert.doesNotMatch(json, /</)
  assert.deepEqual(JSON.parse(json), data)
})


test('prerendered and dynamic paths use the same canonical URLs as the sitemap', () => {
  for (const path of ['/booking-policy', '/privacy', '/tutors/heather-barrieau']) {
    assert.equal(canonicalUrl(path + '/'), canonicalUrl(path))
    assert.ok(sitemapXml([path]).includes('<loc>' + canonicalUrl(path + '/') + '</loc>'))
  }
  assert.equal(canonicalUrl('/'), 'https://www.mychristiantutors.com/')
})
