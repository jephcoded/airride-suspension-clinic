import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_SEO, SITE_NAME, isIndexable } from './seo';

function meta(selector: string, create: () => HTMLElement) {
  return (document.head.querySelector(selector) as HTMLElement | null) ?? document.head.appendChild(create());
}

/**
 * Keeps the tab title, description, canonical address and "noindex" in step with the page being
 * viewed, so Google indexes each public page on its own and skips private ones (tracking, staff).
 */
export function useSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const seo = PAGE_SEO[path];
    const origin = window.location.origin;

    if (seo) {
      document.title = seo.title;
      meta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' })).setAttribute('content', seo.description);
      meta('meta[property="og:title"]', () => document.createElement('meta')).setAttribute('content', seo.title);
      meta('meta[property="og:description"]', () => document.createElement('meta')).setAttribute('content', seo.description);
    } else if (path.startsWith('/staff')) {
      document.title = `Staff | ${SITE_NAME}`;
    } else if (path.startsWith('/track/')) {
      document.title = `Track My Repair | ${SITE_NAME}`;
    } else if (path === '/account') {
      document.title = `My Repairs | ${SITE_NAME}`;
    } else {
      document.title = `Page not found | ${SITE_NAME}`;
    }

    const canonical = meta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }));
    canonical.setAttribute('href', origin + path);
    meta('meta[property="og:url"]', () => document.createElement('meta')).setAttribute('content', origin + path);

    // Private or unknown pages: ask search engines not to list them.
    const robots = meta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }));
    robots.setAttribute('content', isIndexable(path) ? 'index, follow' : 'noindex, nofollow');
  }, [pathname]);
}
