import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import slugify from 'slugify';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'src/data/channels.json');
const TPL_DIR = path.join(ROOT, 'src/templates');
const STATIC_DIR = path.join(ROOT, 'src/static');
const DIST = path.join(ROOT, 'dist');

function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
}

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function groupByCategory(items) {
  const map = {};
  for (const it of items) {
    const cat = it.category || '未分类';
    map[cat] ||= [];
    map[cat].push(it);
  }
  return map;
}

function copyStatic() {
  const files = fs.readdirSync(STATIC_DIR);
  for (const f of files) {
    fs.copyFileSync(path.join(STATIC_DIR, f), path.join(DIST, f));
  }
}

function slug(s) {
  const res = slugify(s || '', { lower: true, strict: true });
  return res || '';
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
}

function loadTpl(name) {
  return fs.readFileSync(path.join(TPL_DIR, name), 'utf-8');
}

function renderLayout(content, params = {}) {
  const tpl = loadTpl('layout.ejs');
  return ejs.render(tpl, { ...params, content });
}

function renderIndex(categories) {
  const tpl = loadTpl('index.ejs');
  const html = ejs.render(tpl, { categories });
  return renderLayout(html, { title: 'Telegram频道导航' });
}

function renderCategory(name, items) {
  const tpl = loadTpl('category.ejs');
  const html = ejs.render(tpl, { name, items });
  return renderLayout(html, { title: `分类：${name}` });
}

function renderChannel(item) {
  const tpl = loadTpl('channel.ejs');
  const html = ejs.render(tpl, { item });
  return renderLayout(html, { title: item.name });
}

function buildSearchIndex(items) {
  const index = items.map((it) => ({
    id: it.id,
    name: it.name,
    description: it.description || '',
    category: it.category || '',
    link: it.link,
    tags: it.tags || [],
    slug: it.id,
  }));
  return index;
}

function generateSitemap(allUrls, siteUrl) {
  const items = allUrls
    .map(
      (u) => `<url><loc>${siteUrl}${u}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

async function main() {
  try {
    cleanDist();
    copyStatic();
    const items = readData();
    const categoriesMap = groupByCategory(items);
    const categories = Object.entries(categoriesMap).map(([name, items]) => ({ name, items }));

    writeFile(path.join(DIST, 'index.html'), renderIndex(categories));

    const allUrls = ['/'];
    for (const { name, items: catItems } of categories) {
      const catPath = path.join(DIST, 'category', `${name}.html`);
      writeFile(catPath, renderCategory(name, catItems));
      allUrls.push(`/category/${encodeURIComponent(name)}.html`);
    }

    for (const it of items) {
      const chSlug = it.id;
      const chPath = path.join(DIST, 'channel', `${chSlug}.html`);
      writeFile(chPath, renderChannel(it));
      allUrls.push(`/channel/${encodeURIComponent(chSlug)}.html`);
      it.slug = chSlug;
    }

    const searchIndex = buildSearchIndex(items);
    writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

    const urlsTxt = allUrls.map((u) => (process.env.SITE_URL ? process.env.SITE_URL + u : u)).join('\n');
    writeFile(path.join(DIST, 'urls.txt'), urlsTxt);

    const siteUrl = process.env.SITE_URL || 'https://example.com';
    writeFile(path.join(DIST, 'sitemap.xml'), generateSitemap(allUrls, siteUrl));
    writeFile(
      path.join(DIST, 'robots.txt'),
      `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`
    );

    logger.info('构建完成', { pages: allUrls.length, dist: DIST });
  } catch (err) {
    logger.error('构建失败', { error: err.message });
    process.exitCode = 1;
  }
}

main();
