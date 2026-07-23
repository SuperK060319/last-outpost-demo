import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const imageDir = path.join(projectRoot, 'public', 'assets', 'last-outpost-v2');
const releaseDir = path.join(projectRoot, 'release');
const outputFile = path.join(releaseDir, '零号防线.html');
// 旧文件名只作为 GitHub Pages 工作流兼容入口，玩家看到的品牌仍是“零号防线”。
const legacyOutputFile = path.join(releaseDir, '最后哨站.html');

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function builtFile(reference) {
  const relativePath = reference.replace(/^\.\//, '').replace(/^\//, '');
  return path.join(distDir, ...relativePath.split('/'));
}

async function createImageMap() {
  const fileNames = await readdir(imageDir);
  const entries = await Promise.all(fileNames.map(async (fileName) => {
    const extension = path.extname(fileName).toLowerCase();
    const mimeType = mimeTypes[extension];
    if (!mimeType) throw new Error(`不支持的素材格式：${fileName}`);
    const base64 = await readFile(path.join(imageDir, fileName), 'base64');
    return [fileName, `data:${mimeType};base64,${base64}`];
  }));
  return Object.fromEntries(entries);
}

let html = await readFile(path.join(distDir, 'index.html'), 'utf8');
const scriptTag = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleTag = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
const faviconTag = html.match(/<link rel="icon" href="([^"]+)" type="image\/svg\+xml" \/>/);

if (!scriptTag || !styleTag) throw new Error('没有找到 Vite 生成的脚本或样式入口');

const [javascript, stylesheet, imageMap] = await Promise.all([
  readFile(builtFile(scriptTag[1]), 'utf8'),
  readFile(builtFile(styleTag[1]), 'utf8'),
  createImageMap(),
]);

const safeJavascript = javascript.replaceAll('</script', '<\\/script');
const safeStylesheet = stylesheet.replaceAll('</style', '<\\/style');
const assetBootstrap = `<script>globalThis.__LAST_OUTPOST_ASSETS__=${JSON.stringify(imageMap)};<\/script>`;

html = html.replace(styleTag[0], `<style>${safeStylesheet}</style>`);
// 脚本放到 body 末尾，让慢速网络先显示加载提示，而不是下载 7 MB 时一直黑屏。
html = html.replace(scriptTag[0], '');
html = html.replace('</body>', `${assetBootstrap}<script type="module">${safeJavascript}</script></body>`);

if (faviconTag) {
  const favicon = await readFile(builtFile(faviconTag[1]), 'base64');
  html = html.replace(faviconTag[0], `<link rel="icon" href="data:image/svg+xml;base64,${favicon}" type="image/svg+xml" />`);
}

await mkdir(releaseDir, { recursive: true });
await Promise.all([
  writeFile(outputFile, html),
  writeFile(legacyOutputFile, html),
]);

const sizeMb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`单文件版本已生成：${outputFile} (${sizeMb} MB)`);
