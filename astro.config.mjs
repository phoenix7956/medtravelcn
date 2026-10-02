import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Vercel 部署配置
// - serverless: 原生适配 Vercel Function（better-sqlite3 只读打包进函数）
// - 本地 dev 仍用 node adapter，见下方的注释切换说明
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4321, host: true },
  vite: {
    ssr: {
      external: ['better-sqlite3'],
    },
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
  },
});
