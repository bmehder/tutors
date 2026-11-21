export const siteUrl = 'https://www.mychristiantutors.com'

export function canonicalUrl(path: string) {
  const url = new URL(path, siteUrl)
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url.toString()
}

export const organization = {
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: 'MyChristianTutors',
  url: siteUrl,
  logo: `${siteUrl}/favicon.svg`,
  email: 'admin@mychristiantutors.com',
}

// Tutor names and descriptions can be edited in admin. Keep them inside JSON.
export function structuredDataJson(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

export function sitemapXml(paths: readonly string[]) {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const urls = [...new Set(paths.map(canonicalUrl))]
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n') + '\n</urlset>\n'
}
