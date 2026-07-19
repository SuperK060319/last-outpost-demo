import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相对路径，让同一份构建既能部署在 GitHub Pages 子目录，也能部署到独立域名。
  base: './',
  build: {
    // 兼容仍在使用较旧 Android WebView 的微信、QQ 等内置浏览器。
    target: 'es2018',
  },
});
