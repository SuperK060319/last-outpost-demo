import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相对路径，让同一份构建既能部署在 GitHub Pages 子目录，也能部署到独立域名。
  base: './',
});
