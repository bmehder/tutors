// Change through scripts/search-indexing.mjs so response headers and robots.txt agree.
export const searchIndexingEnabled = false

export function robotsDirective(indexable = true) {
  return searchIndexingEnabled && indexable ? 'index, follow' : 'noindex, nofollow, noarchive'
}
