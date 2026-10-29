import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { PAGE_SEO } from './src/lib/seo.ts'

// The public web address. Set SITE_URL in Vercel when the domain changes, then redeploy.
const SITE_URL = (process.env.SITE_URL || 'https://airride-suspension-clinic.vercel.app').replace(/\/+$/, '')

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function fillPage(html: string, page: string) {
  const seo = PAGE_SEO[page]
  return html
    .replaceAll('__PAGE_TITLE__', attr(seo.title))
    .replaceAll('__PAGE_DESC__', attr(seo.description))
    .replaceAll('__PAGE_PATH__', page)
}

/**
 * Search engines and link previews:
 * - writes a ready-made HTML file per public page (own title, description and canonical address),
 * - robots.txt and sitemap.xml with the real web address.
 */
function siteFiles(): Plugin {
  let outDir = 'dist'
  return {
    name: 'airride-site-files',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir)
    },
    transformIndexHtml(html, ctx) {
      const withSite = html.replaceAll('__SITE_URL__', SITE_URL)
      // In development there is one page; at build time each page gets its own file below.
      return ctx.server ? fillPage(withSite, '/') : withSite
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /staff\nDisallow: /account\nDisallow: /track/\nDisallow: /t/\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      })
      const today = new Date().toISOString().slice(0, 10)
      const urls = Object.keys(PAGE_SEO)
        .map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod><priority>${p === '/' ? '1.0' : p === '/book' || p === '/services' ? '0.9' : '0.7'}</priority></url>`)
        .join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
    closeBundle() {
      const indexFile = path.join(outDir, 'index.html')
      if (!fs.existsSync(indexFile)) return
      const template = fs.readFileSync(indexFile, 'utf8')
      for (const page of Object.keys(PAGE_SEO)) {
        const file = page === '/' ? 'index.html' : `${page.slice(1)}.html`
        fs.writeFileSync(path.join(outDir, file), fillPage(template, page))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), siteFiles()],
  server: {
    port: 5173,
    // Same-origin API in development so the staff session cookie just works.
    proxy: { '/api': 'http://localhost:4000', '/t/': 'http://localhost:4000' },
  },
})
