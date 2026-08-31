import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  manifest: {
    name: 'jike.k',
    description: '为即刻网页版提供看图模式和双栏帖子详情。',
    permissions: ['storage'],
    host_permissions: ['https://web.okjike.com/*'],
    icons: {
      '16': 'icon/16.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
  },
});
