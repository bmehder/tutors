import assert from 'node:assert/strict'
import test from 'node:test'
import { structuredDataJson } from '../src/lib/seo.ts'

test('admin-editable profile text cannot close the structured-data script', () => {
  const data = { name: '</script><script>alert("example")</script>', description: 'Math & science <support>' }
  const json = structuredDataJson(data)
  assert.doesNotMatch(json, /</)
  assert.deepEqual(JSON.parse(json), data)
})
