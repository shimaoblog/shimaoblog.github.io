// SmBLog 静态博客构建脚本
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const yaml = require('js-yaml');

// 读取配置
const configPath = path.join(__dirname, '_config.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
const base = config.base || '/';
const siteUrl = config.url || '';
const outputDir = path.resolve(__dirname, config.output_dir || './_site');
const author = config.author || '';
const siteTitle = config.title || 'SmBLog';
const siteDesc = config.description || '';

// 目录常量
const dirArticle = path.join(__dirname, 'WENZHANG');
const dirTalk = path.join(__dirname, 'TALK');
const dirSetting = path.join(__dirname, 'Setting');
const dirCss = path.join(__dirname, 'CSS');
const dirJs = path.join(__dirname, 'JS');

// 清空输出目录
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

// 复制静态资源目录
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    const d = path.join(dest, f);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}
copyDir(dirCss, path.join(outputDir, 'CSS'));
copyDir(dirJs, path.join(outputDir, 'JS'));

// 读取全局 head 片段
let globalHeadTpl = fs.readFileSync(path.join(dirSetting, 'head.html'), 'utf-8');

// 读取模板
const indexTpl = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const postTpl = fs.readFileSync(path.join(__dirname, 'post.html'), 'utf-8');
const pageTpl = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf-8');
const archiveTpl = fs.readFileSync(path.join(__dirname, 'archive.html'), 'utf-8');

// ============================================
// 收集独立页面（根目录 md，头部含 ---Page---）
// ============================================
let pageList = [];
for (const f of fs.readdirSync(__dirname)) {
  if (!f.endsWith('.md')) continue;
  const filePath = path.join(__dirname, f);
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (raw.startsWith('---Page---')) {
    const cleanRaw = raw.replace('---Page---', '').trim();
    const { data, content } = matter(cleanRaw);
    const slug = data.slug || path.basename(f, '.md');
    pageList.push({
      title: data.title || slug,
      slug: slug,
      content: marked.parse(content),
      desc: data.description || siteDesc,
      data: data
    });
  }
}

// ============================================
// 收集文章 WENZHANG/
// ============================================
let postList = [];
if (fs.existsSync(dirArticle)) {
  for (const f of fs.readdirSync(dirArticle)) {
    if (!f.endsWith('.md')) continue;
    const filePath = path.join(dirArticle, f);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    const dateStr = data.date || f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '2026-01-01';
    const dt = new Date(dateStr);
    const slug = data.slug || path.basename(f, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const category = data.category || 'note';
    postList.push({
      title: data.title || slug,
      date: dt,
      category: category,
      slug: slug,
      content: marked.parse(content),
      desc: data.description || content.replace(/[#*`>\-]/g, '').slice(0, 80) + '...',
      data: data
    });
  }
}
postList.sort((a, b) => b.date.getTime() - a.date.getTime());

// ============================================
// 收集说说 TALK/
// ============================================
let talkList = [];
if (fs.existsSync(dirTalk)) {
  for (const f of fs.readdirSync(dirTalk)) {
    if (!f.endsWith('.md')) continue;
    const filePath = path.join(dirTalk, f);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    const dateStr = data.date || f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '2026-01-01';
    const dt = new Date(dateStr);
    const slug = data.slug || path.basename(f, '.md');
    talkList.push({
      title: data.title || '说说',
      date: dt,
      slug: slug,
      content: marked.parse(content),
      data: data
    });
  }
}
talkList.sort((a, b) => b.date.getTime() - a.date.getTime());

// ============================================
// 预渲染完整说说列表HTML，供给talk页面注入
// ============================================
let talkFullListHtml = '';
for (const t of talkList) {
  const y = t.date.getFullYear();
  const m = String(t.date.getMonth() + 1).padStart(2, '0');
  const d = String(t.date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  talkFullListHtml += `
<div class="talk-item">
  <div class="talk-meta">${dateStr}</div>
  <div class="talk-content">${t.content}</div>
</div>
`;
}



  // ============================================
// 渲染导航（适配你自研SmBLog，实现：顶部显示站名，滚动后自动替换为文章h1标题，样式兼容你线上配色）
// ============================================
let desktopNavLinks = `<a class="nav-item" href="${base}index.html"><i class="fa-solid fa-house nav-icon"></i>首页</a>`;

for (const p of pageList) {
  desktopNavLinks += `<a class="nav-item" href="${base}${p.slug}/">${p.title}</a>`;
}

let navHtml = `
<!-- 顶部固定导航栏 -->
<header class="topbar" id="topbar">
  <!-- 左侧：站点标题 + 滚动后展示文章标题占位 -->
  <div class="topbar-left">
    <a href="${base}index.html" class="topbar-brand" id="siteBrand">${siteTitle}</a>
    <span class="topbar-post-title" id="postTitle"></span>
  </div>
  <!-- 中间桌面导航 -->
  <div class="topbar-center">
    <div class="nav-desktop">
      ${desktopNavLinks}
    </div>
  </div>
</header>

<style>
.topbar {
  display: flex;
  align-items: center;
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 99;
  transition: box-shadow .28s ease;
}
.topbar-left {
  display: flex;
  align-items: center;
  position: relative;
}
.topbar-brand {
  transition: opacity .28s ease;
  white-space: nowrap;
}
.topbar-post-title {
  position: absolute;
  left: 0;
  transition: opacity .28s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
</style>

<!-- 滚动监听JS：滚动后顶栏切换显示文章一级标题 -->
<script>
// 获取DOM元素
const topbar = document.getElementById('topbar');
const siteBrand = document.getElementById('siteBrand');
const postTitleEl = document.getElementById('postTitle');
// 获取文章内所有一级标题 h1
const headings = Array.from(document.querySelectorAll('.markdown-body h1'));
// 记录当前显示的标题，避免频繁更新
let currentHeadingText = '';

// 滚动更新标题逻辑
function updateTitle() {
  const scrollY = window.scrollY;
  // 滚动阈值，超过该像素才切换标题
  const threshold = 80;
  let activeHeading = null;

  // 遍历标题，找到当前进入可视区域的h1
  for(const h of headings){
    const rect = h.getBoundingClientRect();
    if(rect.top <= 120){
      activeHeading = h;
    }
  }

  // 页面顶部：显示站点名，隐藏文章标题
  if(scrollY < threshold){
    siteBrand.style.opacity = '1';
    postTitleEl.style.opacity = '0';
    postTitleEl.style.width = '0';
    currentHeadingText = '';
  }
  // 向下滚动：隐藏站点名，展示当前文章标题
  else{
    siteBrand.style.opacity = '0';
    postTitleEl.style.opacity = '1';
    postTitleEl.style.width = 'auto';
    if(activeHeading){
      const text = activeHeading.innerText.trim();
      if(currentHeadingText !== text){
        postTitleEl.innerText = text;
        currentHeadingText = text;
      }
    }
  }
}
// 绑定滚动、页面加载事件
window.addEventListener('scroll', updateTitle);
window.addEventListener('load', updateTitle);
</script>
`;

// ============================================
// 渲染首页文章列表
// ============================================
let articleListHtml = '';
for (const p of postList.slice(0, 10)) {
  const y = p.date.getFullYear();
  const m = String(p.date.getMonth() + 1).padStart(2, '0');
  const d = String(p.date.getDate()).padStart(2, '0');
  const url = `${base}${p.category}/${y}/${m}/${d}/${p.slug}.html`;
  const dateStr = `${y}-${m}-${d}`;
  articleListHtml += `
    <div class="article-card">
      <a href="${url}">
        <span class="article-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
        <span class="article-title">${p.title}</span>
        <p class="article-desc">${p.desc}</p>
      </a>
    </div>`;
}

// ============================================
// 渲染首页说说列表
// ============================================
let talkListHtml = '';
for (const t of talkList.slice(0, 5)) {
  const y = t.date.getFullYear();
  const m = String(t.date.getMonth() + 1).padStart(2, '0');
  const d = String(t.date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const plainText = t.content.replace(/<[^>]+>/g, '').slice(0, 60) + '...';
  talkListHtml += `
    <div class="article-card">
      <span class="article-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
      <p class="article-desc">${plainText}</p>
    </div>`;
}

// ============================================
// 渲染归档页
// ============================================
let archiveHtml = '';
const yearMap = {};
for (const p of postList) {
  const y = p.date.getFullYear();
  if (!yearMap[y]) yearMap[y] = [];
  yearMap[y].push(p);
}
const years = Object.keys(yearMap).sort((a, b) => b - a);
for (const y of years) {
  const posts = yearMap[y];
  archiveHtml += `<div class="year-group">`;
  archiveHtml += `<div class="timeline-year">${y}<span class="year-count">${posts.length} 篇</span></div>`;
  archiveHtml += `<div class="timeline-posts">`;
  for (const p of posts) {
    const m = String(p.date.getMonth() + 1).padStart(2, '0');
    const d = String(p.date.getDate()).padStart(2, '0');
    const url = `${base}${p.category}/${y}/${m}/${d}/${p.slug}.html`;
    archiveHtml += `
      <div class="timeline-post">
        <span class="timeline-post-date">${m}-${d}</span>
        <a class="timeline-post-title" href="${url}">${p.title}</a>
      </div>`;
  }
  archiveHtml += `</div></div>`;
}

// ============================================
// 输出首页
// ============================================
const indexPageUrl = new URL(base, siteUrl).href;
let indexHead = globalHeadTpl
  .replaceAll('{{pageUrl}}', indexPageUrl)
  .replaceAll('{{post_title}}', siteTitle)
  .replaceAll('{{post_desc}}', siteDesc)
  .replaceAll('{{base}}', base);

let indexHtml = indexTpl
  .replaceAll('{{global_head}}', indexHead)
  .replaceAll('{{site_title}}', siteTitle)
  .replaceAll('{{base}}', base)
  .replaceAll('{{nav}}', navHtml)
  .replaceAll('{{article_list}}', articleListHtml)
  .replaceAll('{{talk_list}}', talkListHtml)
  .replaceAll('{{author}}', author);
fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');

// ============================================
// 输出归档页
// ============================================
const archiveRelPath = `${base}archive.html`;
const archivePageUrl = new URL(archiveRelPath, siteUrl).href;
let archiveHead = globalHeadTpl
  .replaceAll('{{pageUrl}}', archivePageUrl)
  .replaceAll('{{post_title}}', `归档 - ${siteTitle}`)
  .replaceAll('{{post_desc}}', `文章归档 | ${siteDesc}`)
  .replaceAll('{{base}}', base);

let archivePageHtml = archiveTpl
  .replaceAll('{{global_head}}', archiveHead)
  .replaceAll('{{site_title}}', siteTitle)
  .replaceAll('{{base}}', base)
  .replaceAll('{{nav}}', navHtml)
  .replaceAll('{{archive_content}}', archiveHtml)
  .replaceAll('{{author}}', author);
fs.writeFileSync(path.join(outputDir, 'archive.html'), archivePageHtml, 'utf-8');

// ============================================
// 输出独立页面，slug=talk时替换内容为完整说说列表
// ============================================
for (const p of pageList) {
  let pageContentOut = p.content;
  if (p.slug === 'talk') {
    pageContentOut = talkFullListHtml;
  }
  const pageRelUrl = `${base}${p.slug}/`;
  const pageFullUrl = new URL(pageRelUrl, siteUrl).href;
  let pageHead = globalHeadTpl
    .replaceAll('{{pageUrl}}', pageFullUrl)
    .replaceAll('{{post_title}}', `${p.title} | ${siteTitle}`)
    .replaceAll('{{post_desc}}', p.desc)
    .replaceAll('{{base}}', base);

  let html = pageTpl
    .replaceAll('{{global_head}}', pageHead)
    .replaceAll('{{site_title}}', siteTitle)
    .replaceAll('{{base}}', base)
    .replaceAll('{{nav}}', navHtml)
    .replaceAll('{{page_title}}', p.title)
    .replaceAll('{{page_content}}', pageContentOut)
    .replaceAll('{{author}}', author);
  const pageFolder = path.join(outputDir, p.slug);
  fs.mkdirSync(pageFolder, { recursive: true });
  fs.writeFileSync(path.join(pageFolder, 'index.html'), html, 'utf-8');
}

// ============================================
// 输出文章页（路径：/分类/YYYY/MM/DD/slug.html）
// ============================================
for (const p of postList) {
  const y = p.date.getFullYear();
  const m = String(p.date.getMonth() + 1).padStart(2, '0');
  const d = String(p.date.getDate()).padStart(2, '0');
  const outSub = path.join(outputDir, p.category, String(y), m, d);
  fs.mkdirSync(outSub, { recursive: true });

  const dateStr = `${y}-${m}-${d}`;
  const postRelUrl = `${base}${p.category}/${y}/${m}/${d}/${p.slug}.html`;
  const postFullUrl = new URL(postRelUrl, siteUrl).href;
  let postHead = globalHeadTpl
    .replaceAll('{{pageUrl}}', postFullUrl)
    .replaceAll('{{post_title}}', `${p.title} | ${siteTitle}`)
    .replaceAll('{{post_desc}}', p.desc)
    .replaceAll('{{base}}', base);

  let html = postTpl
    .replaceAll('{{global_head}}', postHead)
    .replaceAll('{{site_title}}', siteTitle)
    .replaceAll('{{base}}', base)
    .replaceAll('{{nav}}', navHtml)
    .replaceAll('{{post_title}}', p.title)
    .replaceAll('{{post_date}}', dateStr)
    .replaceAll('{{post_content}}', p.content)
    .replaceAll('{{author}}', author);
  fs.writeFileSync(path.join(outSub, `${p.slug}.html`), html, 'utf-8');
}

// ============================================
// 复制根目录静态文件（favicon、robots.txt、sitemap.xml、404.html）
// ============================================
const rootAllowFiles = [
  'robots.txt',
  'sitemap.xml',
  '404.html'
];
for (const f of fs.readdirSync(__dirname)) {
  if (
    f.endsWith('.ico') ||
    f.endsWith('.png') ||
    f.endsWith('.jpg') ||
    f.endsWith('.svg') ||
    rootAllowFiles.includes(f)
  ) {
    fs.copyFileSync(path.join(__dirname, f), path.join(outputDir, f));
  }
}

// 拷贝根目录img文件夹
const srcImg = path.join(__dirname, 'img');
const outImg = path.join(outputDir, 'img');
if(fs.existsSync(srcImg)) copyDir(srcImg, outImg);

// ============================================
// RSS + JSON Feed
// ============================================
function xmlEscape(str){
    if(!str) return "";
    return String(str)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&apos;");
}

const rssPosts = postList.slice(0,10);
let rssItemXml = "";

for(const p of rssPosts){
    const y = p.date.getFullYear();
    const m = String(p.date.getMonth() + 1).padStart(2, '0');
    const d = String(p.date.getDate()).padStart(2, '0');
    const relUrl = `${base}${p.category}/${y}/${m}/${d}/${p.slug}.html`;
    const fullUrl = new URL(relUrl, siteUrl).href;
    const pubDate = p.date.toUTCString();

    rssItemXml += `
<item>
  <title>${xmlEscape(p.title)}</title>
  <link>${xmlEscape(fullUrl)}</link>
  <guid>${xmlEscape(fullUrl)}</guid>
  <pubDate>${pubDate}</pubDate>
  <description>${xmlEscape(p.desc||"")}</description>
</item>
`;
}

const channelLink = new URL(base, siteUrl).href;
const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${xmlEscape(config.title||"SmBLog")}</title>
  <link>${xmlEscape(channelLink)}</link>
  <description>${xmlEscape(config.description||"")}</description>
  <language>zh-CN</language>
${rssItemXml}
</channel>
</rss>
`;
fs.writeFileSync(path.join(outputDir,"feed.xml"), rssXml,"utf8");

const jsonFeedItems = rssPosts.map(p=>{
    const y = p.date.getFullYear();
    const m = String(p.date.getMonth() + 1).padStart(2, '0');
    const d = String(p.date.getDate()).padStart(2, '0');
    const relUrl = `${base}${p.category}/${y}/${m}/${d}/${p.slug}.html`;
    const fullUrl = new URL(relUrl, siteUrl).href;
    return {
      "id": fullUrl,
      "url": fullUrl,
      "title": p.title,
      "summary": p.desc||"",
      "date_published": p.date.toISOString()
    };
});

const feedUrl = new URL(`${base}feed.json`, siteUrl).href;
const feedHomeUrl = new URL(base, siteUrl).href;
const jsonFeed = {
  "version":"https://jsonfeed.org/version/1.1",
  "title": config.title||"SmBLog",
  "description": config.description||"",
  "home_page_url": feedHomeUrl,
  "feed_url": feedUrl,
  "items": jsonFeedItems
};
fs.writeFileSync(path.join(outputDir,"feed.json"),JSON.stringify(jsonFeed,null,2),"utf8");

console.log("✅ RSS feed.xml 已生成");
console.log("✅ JSON feed.json 已生成");
console.log('✅ SmBLog 构建完成！');
console.log(`📁 输出目录: ${outputDir}`);
console.log(`📝 文章数量: ${postList.length}`);
console.log(`💬 说说数量: ${talkList.length}`);
console.log(`📄 独立页面: ${pageList.length}`);
