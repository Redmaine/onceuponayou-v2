#!/usr/bin/env node
// Prerender the built SPA's genuine public content pages for GEO/SEO
// crawlers, using a current, directly-installed Puppeteer.
//
// Same fix as Hormonely and Neuro Decoded (see those repos' history for the
// full react-snap root-cause writeup: react-snap's own bundled Puppeteer,
// pinned ~2019, deadlocks on Netlify's build image before its first page
// ever completes — a directly-installed current Puppeteer does not have
// that problem). This site never had react-snap wired up at all, so this
// is a clean addition, not a replacement.
//
// Scope is deliberately narrow: /admin is the internal ops dashboard and
// must never be crawled or written as a static page (it's not seeded, and
// discovery below only follows links into /blog, so even a stray link to
// /admin from a public page would not get pulled in). /order and /success
// are a live checkout/personalisation flow with no meaningful static
// content to prerender. Only the genuine evergreen public pages are
// seeded: home, privacy, terms, and the blog (list + posts, discovered via
// crawl so new posts — the ops platform's publish-approved-blog function
// commits these automatically — need no code change here).
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const puppeteer = require('puppeteer');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const NAV_TIMEOUT_MS = 30000;
const OVERALL_WATCHDOG_MS = 8 * 60 * 1000;

const SEED_ROUTES = ['/', '/privacy', '/terms', '/blog'];
const ALLOWED_DISCOVERY_PREFIXES = ['/blog'];

function outputPathFor(route) {
  const clean = route.split('?')[0].split('#')[0];
  if (clean === '/' || clean === '') return path.join(DIST_DIR, 'index.html');
  return path.join(DIST_DIR, clean.replace(/^\//, ''), 'index.html');
}

async function main() {
  const startedAt = Date.now();
  const log = (msg) => console.log(`[prerender +${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${msg}`);

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`dist directory not found at ${DIST_DIR} — run the build before postbuild`);
  }

  // SPA fallback — serve-static alone only serves real files; a client-side
  // route like /blog/some-post 404s there without this, and the crawl would
  // silently capture that 404 page as if it were real content instead.
  const serve = serveStatic(DIST_DIR);
  const server = http.createServer((req, res) => {
    serve(req, res, () => {
      req.url = '/index.html';
      serve(req, res, finalhandler(req, res));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const origin = `http://localhost:${port}`;
  log(`local server listening on ${origin}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  log('browser launched');

  const visited = new Set();
  const queue = [...SEED_ROUTES];
  const failed = [];
  let count = 0;

  try {
    while (queue.length > 0) {
      const route = queue.shift();
      if (visited.has(route)) continue;
      visited.add(route);

      const page = await browser.newPage();
      try {
        await page.goto(`${origin}${route}`, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT_MS });

        const rootHtml = await page.$eval('#root', (el) => el.innerHTML.trim()).catch(() => '');
        if (!rootHtml) {
          throw new Error('#root is empty after render — refusing to write this page');
        }

        const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
        for (const href of hrefs) {
          if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
          const normalised = href.startsWith('/') ? href : `/${href}`;
          if (visited.has(normalised)) continue;
          if (!ALLOWED_DISCOVERY_PREFIXES.some((p) => normalised === p || normalised.startsWith(`${p}/`))) continue;
          queue.push(normalised);
        }

        const html = await page.evaluate(() => document.documentElement.outerHTML);
        const outPath = outputPathFor(route);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, `<!doctype html>\n${html}`);
        count += 1;
        log(`✅ ${route} -> ${path.relative(DIST_DIR, outPath)}`);
      } catch (e) {
        failed.push({ route, error: String((e && e.message) || e) });
        log(`❌ ${route} FAILED: ${String((e && e.message) || e)}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }

  log(`done — ${count} page(s) prerendered, ${failed.length} failed`);
  if (failed.length > 0) {
    console.error('Prerender failures:', JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

const watchdog = setTimeout(() => {
  console.error(`[prerender] WATCHDOG — did not finish within ${OVERALL_WATCHDOG_MS / 1000}s. Failing loudly instead of hanging silently.`);
  process.exit(1);
}, OVERALL_WATCHDOG_MS);
watchdog.unref();

main()
  .then(() => { clearTimeout(watchdog); process.exit(0); })
  .catch((e) => {
    clearTimeout(watchdog);
    console.error('[prerender] fatal:', e && e.stack || e);
    process.exit(1);
  });
